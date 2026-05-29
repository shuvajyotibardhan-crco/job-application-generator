import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const downloadFile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }

  const { storagePath } = data as { storagePath: string };
  if (!storagePath) {
    throw new functions.https.HttpsError('invalid-argument', 'storagePath is required');
  }

  // Enforce ownership — path must be under the requesting user's UID
  if (!storagePath.startsWith(`users/${context.auth.uid}/`)) {
    throw new functions.https.HttpsError('permission-denied', 'Access denied');
  }

  const [buffer] = await admin.storage().bucket().file(storagePath).download();
  return { data: buffer.toString('base64') };
});
