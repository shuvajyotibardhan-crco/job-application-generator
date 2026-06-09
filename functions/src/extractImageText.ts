import * as functions from 'firebase-functions';
import { extractTextFromImage } from './lib/claudeClient';

interface RequestData {
  imageBase64: string;
  mediaType: 'image/png' | 'image/jpeg';
}

export const extractImageText = functions
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }

    const { imageBase64, mediaType } = data as RequestData;
    if (!imageBase64 || !mediaType) {
      throw new functions.https.HttpsError('invalid-argument', 'imageBase64 and mediaType are required');
    }

    try {
      const buffer = Buffer.from(imageBase64, 'base64');
      const text = await extractTextFromImage(buffer, mediaType);
      return { text };
    } catch (e) {
      throw new functions.https.HttpsError('internal', `Image text extraction failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
