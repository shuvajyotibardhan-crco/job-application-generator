import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { normaliseSlug, isCacheStale } from './lib/utils';
import { searchCompany } from './lib/searchClient';

interface CompanyOption {
  name: string;
  slug: string;
  summary: string;
}

export const resolveCompany = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }

  const { companyName } = data as { companyName: string };
  if (!companyName?.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'companyName is required');
  }

  const inputSlug = normaliseSlug(companyName);
  const db = admin.firestore();

  // Check cache first
  const cacheDoc = await db.collection('companyCache').doc(inputSlug).get();
  if (cacheDoc.exists && !isCacheStale(cacheDoc.data()!.cachedAt)) {
    const d = cacheDoc.data()!;
    return { resolved: true, company: { name: d.companyName, slug: d.slug, summary: d.profile } };
  }

  // Fetch search results
  const results = await searchCompany(companyName);
  if (results.length === 0) {
    // No results — return the input as-is
    const fallback: CompanyOption = { name: companyName.trim(), slug: inputSlug, summary: '' };
    await writeCache(db, fallback);
    return { resolved: true, company: fallback };
  }

  // Extract candidate company names from result titles
  const candidates = extractCandidates(results, inputSlug);

  if (candidates.length <= 1) {
    // Single clear match
    const company: CompanyOption = {
      name: candidates[0]?.name ?? companyName.trim(),
      slug: candidates[0]?.slug ?? inputSlug,
      summary: candidates[0]?.summary ?? results.map(r => r.snippet).join(' '),
    };
    await writeCache(db, company);
    return { resolved: true, company };
  }

  // Multiple distinct companies — return options (do not cache, user must pick)
  return { resolved: false, options: candidates };
});

function extractCandidates(
  results: Array<{ title: string; snippet: string; link: string }>,
  inputSlug: string,
): CompanyOption[] {
  // Extract the company name portion from each title (text before first separator)
  const seen = new Map<string, CompanyOption>();

  for (const r of results) {
    const rawName = r.title.split(/\s*[-–|:]\s*/)[0].trim();
    if (!rawName) continue;
    const slug = normaliseSlug(rawName);
    if (!slug) continue;

    // If this slug is close to the input slug, treat as same company
    const effectiveSlug = slugsAreClose(slug, inputSlug) ? inputSlug : slug;
    const effectiveName = slugsAreClose(slug, inputSlug) ? rawName : rawName;

    if (!seen.has(effectiveSlug)) {
      seen.set(effectiveSlug, { name: effectiveName, slug: effectiveSlug, summary: r.snippet });
    } else {
      // Append snippet for richer summary
      const existing = seen.get(effectiveSlug)!;
      seen.set(effectiveSlug, { ...existing, summary: existing.summary + ' ' + r.snippet });
    }
  }

  return Array.from(seen.values()).slice(0, 4);
}

function slugsAreClose(a: string, b: string): boolean {
  if (a === b) return true;
  // One contains the other (handles "openai" vs "openai-inc")
  return a.startsWith(b) || b.startsWith(a);
}

async function writeCache(db: admin.firestore.Firestore, company: CompanyOption): Promise<void> {
  await db.collection('companyCache').doc(company.slug).set({
    slug: company.slug,
    companyName: company.name,
    profile: company.summary,
    cachedAt: admin.firestore.Timestamp.now(),
  });
}
