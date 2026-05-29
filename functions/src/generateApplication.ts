import * as functions from 'firebase-functions';

// Full implementation in T13
export const generateApplication = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }

  // TODO T13: 10-step pipeline
  // 1. Auth check
  // 2. Load UserProfile + base resume text
  // 3. Load/refresh CompanyCache
  // 4. Generate resume + cover letter (claude-sonnet-4-6)
  // 5. AI-detection check loop (claude-haiku-4-5, max 3 iterations)
  // 6. Render DOCX via docRenderer
  // 7. Convert to PDF via pdfConverter
  // 8. Upload 4 files to Firebase Storage
  // 9. Write Application record to Firestore
  // 10. Return { appId }

  throw new functions.https.HttpsError('unimplemented', 'generateApplication not yet implemented');
});
