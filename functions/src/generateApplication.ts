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
import { renderResumePdf, renderCoverLetterPdf } from './lib/pdfConverter';

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

    // 2. Load user profile + base resume text
    const profileSnap = await db.collection('users').doc(uid).collection('private').doc('profile').get();
    if (!profileSnap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Profile not found');
    }
    const profile = profileSnap.data()!;
    const baseResumeText = await extractResumeText(bucket, profile.baseResumeRef, profile.baseResumeType);

    // 3. Load / refresh company cache
    const { companyProfile, roleInfo } = await loadCompanyData(db, companySlug, companyName, roleTitle);

    // 4. Generate resume + cover letter
    const generationDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const selectedUrls   = selectUrls(profile.profileUrls ?? [], 2);

    let rawOutput = await generateDocuments({
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

    // 5. AI-detection check loop (max 3 iterations)
    let parsed = parseOutput(rawOutput);
    let aiDetectionWarning = false;

    for (let i = 0; i < 3; i++) {
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
    const resumeDocx      = await renderResume(parsed.resume.sections, personalDetails);
    const coverLetterDocx = await renderCoverLetter(parsed.coverLetter.body, personalDetails, generationDate, parsed.coverLetter.header);

    // 7. Render PDF
    const resumePdf      = await renderResumePdf(parsed.resume.sections, personalDetails);
    const coverLetterPdf = await renderCoverLetterPdf(parsed.coverLetter.body, personalDetails, generationDate, parsed.coverLetter.header);

    // 8. Create Firestore doc ID and upload files
    const appRef = db.collection('users').doc(uid).collection('applications').doc();
    const appId  = appRef.id;
    const basePath = `users/${uid}/applications/${appId}`;

    await Promise.all([
      bucket.file(`${basePath}/resume.docx`).save(resumeDocx,      { metadata: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } }),
      bucket.file(`${basePath}/resume.pdf`).save(resumePdf,        { metadata: { contentType: 'application/pdf' } }),
      bucket.file(`${basePath}/cover-letter.docx`).save(coverLetterDocx, { metadata: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } }),
      bucket.file(`${basePath}/cover-letter.pdf`).save(coverLetterPdf,   { metadata: { contentType: 'application/pdf' } }),
    ]);

    // 9. Write application record
    await appRef.set({
      appId,
      uid,
      companyName,
      companySlug,
      roleTitle,
      jobDescription,
      status: 'Submitted',
      generatedAt:              admin.firestore.Timestamp.now(),
      resumeStoragePath:        `${basePath}/resume.docx`,
      resumePdfPath:            `${basePath}/resume.pdf`,
      coverLetterStoragePath:   `${basePath}/cover-letter.docx`,
      coverLetterPdfPath:       `${basePath}/cover-letter.pdf`,
      aiDetectionWarning,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    // 10. Return appId
    return { appId };
  });

// ─── Helpers ────────────────────────────────────────────────────────────────

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

  // Refresh cache
  const [companyResults, roleResults] = await Promise.all([
    searchCompany(name),
    searchRole(name, roleTitle),
  ]);

  const companyProfile = companyResults.map(r => r.snippet).join(' ');
  const roleInfo       = roleResults.map(r => r.snippet).join(' ');

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
