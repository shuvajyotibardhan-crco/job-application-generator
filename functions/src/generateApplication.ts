import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import type { Bucket } from '@google-cloud/storage';
import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
import mammoth from 'mammoth';
import { isCacheStale, selectUrls } from './lib/utils';
import { searchCompany, searchRole } from './lib/searchClient';
import { generateDocuments, checkAiDetection, rewriteFlaggedSections } from './lib/claudeClient';
import { renderResume, renderCoverLetter, ResumeSection, CoverLetterHeader } from './lib/docRenderer';

interface RequestData {
  companySlug: string;
  companyName: string;
  roleTitle: string;
  jobDescription: string;
}

interface ParsedOutput {
  resume: { sections: ResumeSection[] };
  coverLetter: { header: CoverLetterHeader; body: string };
}

export const generateApplication = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    // 1. Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const uid = context.auth.uid;

    const { companySlug, companyName, roleTitle, jobDescription } = data as RequestData;
    if (!companySlug || !companyName || !roleTitle || !jobDescription) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    const db      = admin.firestore();
    const bucket  = admin.storage().bucket();
    const progress = (stage: string) => setProgress(db, uid, stage);

    // 2. Load user profile + base resume text
    await progress('Reading your profile and resume…');
    functions.logger.info('generateApplication: loading profile', { uid });
    const profileSnap = await db.collection('users').doc(uid).collection('private').doc('profile').get();
    if (!profileSnap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Profile not found');
    }
    const profile = profileSnap.data()!;
    if (!profile.baseResumeRef || !profile.baseResumeType) {
      throw new functions.https.HttpsError('failed-precondition', 'No base resume uploaded. Please add a resume on your Profile page.');
    }
    functions.logger.info('generateApplication: extracting resume text', { type: profile.baseResumeType });
    let baseResumeText: string;
    try {
      baseResumeText = await extractResumeText(bucket, profile.baseResumeRef, profile.baseResumeType);
    } catch (e) {
      functions.logger.error('generateApplication: resume extraction failed', { e });
      throw new functions.https.HttpsError('internal', `Failed to read your base resume: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 3. Load / refresh company cache
    await progress('Researching the company and role…');
    const { companyProfile, roleInfo } = await loadCompanyData(db, companySlug, companyName, roleTitle);

    // 4. Generate resume + cover letter
    const generationDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const selectedUrls   = selectUrls(profile.profileUrls ?? [], 2);

    await progress('Writing your tailored resume and cover letter…');
    functions.logger.info('generateApplication: calling Claude');
    let rawOutput: string;
    try {
      rawOutput = await generateDocuments({
      baseResumeText,
      jobDescription,
      companyProfile,
      roleInfo,
      personalDetails: {
        fullName: profile.fullName,
        email:    profile.email,
        phone:    profile.phone,
        city:     profile.city,
        state:    profile.state,
        urls:     selectedUrls,
      },
        generationDate,
      });
    } catch (e) {
      functions.logger.error('generateApplication: Claude API failed', { e });
      throw new functions.https.HttpsError('internal', `AI generation failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 5. AI-detection check loop (max 3 iterations)
    let parsed = parseOutput(rawOutput);
    let aiDetectionWarning = false;

    for (let i = 0; i < 3; i++) {
      await progress(i === 0 ? 'Checking for AI patterns…' : 'Refining language…');
      const resumeText = sectionsToText(parsed.resume.sections);
      const clResult   = await checkAiDetection(resumeText, parsed.coverLetter.body);
      if (clResult.clean) break;
      if (i === 2) { aiDetectionWarning = true; break; }
      const rewritten = await rewriteFlaggedSections(
        JSON.stringify(parsed.resume),
        JSON.stringify(parsed.coverLetter),
        clResult.flaggedSections,
      );
      const reParsed = tryParseOutput(rewritten);
      if (reParsed) parsed = reParsed;
    }

    const personalDetails = {
      fullName: profile.fullName,
      email:    profile.email,
      phone:    profile.phone,
      city:     profile.city,
      state:    profile.state,
      urls:     selectedUrls,
    };

    // 6. Render DOCX
    await progress('Formatting your documents…');
    const resumeDocx      = await renderResume(parsed.resume.sections, personalDetails);
    const coverLetterDocx = await renderCoverLetter(parsed.coverLetter.body, personalDetails, generationDate, parsed.coverLetter.header);

    // 7. Upload to Storage
    await progress('Saving your application…');
    const appRef = db.collection('users').doc(uid).collection('applications').doc();
    const appId  = appRef.id;
    const basePath = `users/${uid}/applications/${appId}`;

    await Promise.all([
      bucket.file(`${basePath}/resume.docx`).save(resumeDocx,           { metadata: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } }),
      bucket.file(`${basePath}/cover-letter.docx`).save(coverLetterDocx, { metadata: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } }),
    ]);

    // 8. Write application record
    await appRef.set({
      appId,
      uid,
      companyName,
      companySlug,
      roleTitle,
      jobDescription,
      status: 'Submitted',
      generatedAt:            admin.firestore.Timestamp.now(),
      resumeStoragePath:      `${basePath}/resume.docx`,
      coverLetterStoragePath: `${basePath}/cover-letter.docx`,
      aiDetectionWarning,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    await clearProgress(db, uid);
    return { appId };
  });

// ─── Helpers ────────────────────────────────────────────────────────────────

async function setProgress(db: admin.firestore.Firestore, uid: string, stage: string): Promise<void> {
  try {
    await db.collection('users').doc(uid).collection('private').doc('generationProgress').set({ stage });
  } catch {
    // Best-effort — don't fail generation if progress write fails
  }
}

async function clearProgress(db: admin.firestore.Firestore, uid: string): Promise<void> {
  try {
    await db.collection('users').doc(uid).collection('private').doc('generationProgress').delete();
  } catch { /* ignore */ }
}

async function extractResumeText(
  bucket: Bucket,
  ref: string,
  type: string,
): Promise<string> {
  if (type === 'gdocs') {
    // Extract doc ID from Google Docs URL
    const match = ref.match(/\/document\/d\/([\w-]+)/);
    if (!match) throw new functions.https.HttpsError('invalid-argument', 'Invalid Google Docs URL');
    const exportUrl = `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
    const { data } = await axios.get<string>(exportUrl, { responseType: 'text' });
    return data;
  }

  const [fileBuffer] = await bucket.file(ref).download();

  if (type === 'pdf') {
    const result = await pdfParse(fileBuffer);
    return result.text;
  }

  if (type === 'docx') {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  }

  if (type === 'png' || type === 'jpg') {
    const { extractTextFromImage } = await import('./lib/claudeClient');
    const mediaType = type === 'png' ? 'image/png' : 'image/jpeg';
    return extractTextFromImage(fileBuffer, mediaType);
  }

  throw new functions.https.HttpsError('invalid-argument', 'Unknown resume type');
}

async function loadCompanyData(
  db: admin.firestore.Firestore,
  slug: string,
  name: string,
  roleTitle: string,
): Promise<{ companyProfile: string; roleInfo: string }> {
  const cacheDoc = await db.collection('companyCache').doc(slug).get();

  if (cacheDoc.exists && !isCacheStale(cacheDoc.data()!.cachedAt)) {
    return {
      companyProfile: cacheDoc.data()!.profile ?? '',
      roleInfo: '',
    };
  }

  // Refresh cache — fall back to empty strings if Google Search fails
  let companyProfile = '';
  let roleInfo = '';
  try {
    const [companyResults, roleResults] = await Promise.all([
      searchCompany(name),
      searchRole(name, roleTitle),
    ]);
    companyProfile = companyResults.map(r => r.snippet).join(' ');
    roleInfo       = roleResults.map(r => r.snippet).join(' ');
  } catch (e) {
    functions.logger.warn('Google Search failed during generateApplication, continuing without company data', { name, e });
  }

  await db.collection('companyCache').doc(slug).set({
    slug,
    companyName: name,
    profile: companyProfile,
    cachedAt: admin.firestore.Timestamp.now(),
  });

  return { companyProfile, roleInfo };
}

function parseOutput(raw: string): ParsedOutput {
  const parsed = tryParseOutput(raw);
  if (!parsed) throw new functions.https.HttpsError('internal', 'Failed to parse Claude output');
  return parsed;
}

function tryParseOutput(raw: string): ParsedOutput | null {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const obj = JSON.parse(cleaned);
    if (obj?.resume?.sections && obj?.coverLetter?.body) return obj as ParsedOutput;
    return null;
  } catch {
    return null;
  }
}

function sectionsToText(sections: ResumeSection[]): string {
  return sections.map(s =>
    `${s.heading}\n` + s.items.map(item =>
      [item.title, item.subtitle, item.period, item.text, ...(item.bullets ?? [])].filter(Boolean).join('\n')
    ).join('\n'),
  ).join('\n\n');
}
