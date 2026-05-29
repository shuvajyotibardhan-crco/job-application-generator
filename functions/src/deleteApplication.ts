import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Full implementation in T17
export const deleteApplication = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }
  const { appId } = data as { appId: string };
  if (!appId) throw new functions.https.HttpsError('invalid-argument', 'appId is required');

  const uid = context.auth.uid;
  const db = admin.firestore();
  const appRef = db.collection('users').doc(uid).collection('applications').doc(appId);
  const appSnap = await appRef.get();

  if (!appSnap.exists) throw new functions.https.HttpsError('not-found', 'Application not found');

  const { resumeStoragePath, resumePdfPath, coverLetterStoragePath, coverLetterPdfPath } =
    appSnap.data() as Record<string, string>;

  const bucket = admin.storage().bucket();
  for (const path of [resumeStoragePath, resumePdfPath, coverLetterStoragePath, coverLetterPdfPath]) {
    try { await bucket.file(path).delete(); } catch (e) { functions.logger.error('Storage delete failed', { path, e }); }
  }

  await appRef.delete();
  return { success: true };
});
