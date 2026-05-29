import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { normaliseSlug, isCacheStale } from './lib/utils';

// Full implementation in T09
export const resolveCompany = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }
  const { companyName } = data as { companyName: string };
  if (!companyName?.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'companyName is required');
  }

  const slug = normaliseSlug(companyName);
  const db = admin.firestore();
  const cacheDoc = await db.collection('companyCache').doc(slug).get();

  if (cacheDoc.exists && !isCacheStale(cacheDoc.data()!.cachedAt)) {
    return { resolved: true, company: cacheDoc.data() };
  }

  // TODO T09: call searchClient, parse results, handle disambiguation
  return {
    resolved: true,
    company: { name: companyName, slug, summary: '', cachedAt: admin.firestore.Timestamp.now() },
  };
});
