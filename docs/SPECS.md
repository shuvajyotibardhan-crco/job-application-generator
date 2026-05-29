# Specs — Job Application Generator

## Data Models

### UserProfile
Stored at: `users/{uid}/private/profile`

```typescript
interface UserProfile {
  uid: string;                  // Firebase Auth UID
  fullName: string;             // Display name
  email: string;                // Contact email (may differ from auth email)
  phone: string;                // e.g. "+1 555 123 4567"
  city: string;                 // e.g. "San Francisco"
  state: string;                // e.g. "CA"
  baseResumeRef: string | null; // Firebase Storage path OR Google Docs export URL
  baseResumeType: 'pdf' | 'docx' | 'gdocs' | null;
  profileUrls: ProfileUrl[];    // Ordered list of optional URLs
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ProfileUrl {
  id: string;        // UUID, client-generated
  label: string;     // e.g. "LinkedIn", "GitHub", "Portfolio"
  url: string;       // Full https:// URL
}
```

### Application
Stored at: `users/{uid}/applications/{appId}`

```typescript
interface Application {
  appId: string;               // Firestore auto-ID
  uid: string;                 // Owning user UID
  companyName: string;         // As entered by user (post-disambiguation)
  companySlug: string;         // Normalised slug used for companyCache lookup
  roleTitle: string;
  jobDescription: string;      // Full JD text (pasted or extracted from upload)
  status: 'Submitted' | 'In Progress' | 'Completed';
  generatedAt: Timestamp;      // Date of generation — shown in cover letter header
  resumeStoragePath: string;   // Storage path for generated .docx
  resumePdfPath: string;       // Storage path for generated .pdf
  coverLetterStoragePath: string;
  coverLetterPdfPath: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### CompanyCache
Stored at: `companyCache/{slug}`

```typescript
interface CompanyCache {
  slug: string;              // Normalised company name slug (lowercase, hyphens)
  companyName: string;       // Canonical display name
  profile: string;           // Concatenated public company info (mission, products, culture)
  cachedAt: Timestamp;       // TTL anchor — stale after 7 days
}
```

---

## Storage Schema

All paths are under the owning user's UID — Storage rules deny access to any other UID.

```
users/
  {uid}/
    resume/
      base.pdf          # or base.docx — uploaded base resume (only one at a time)
    applications/
      {appId}/
        resume.docx
        resume.pdf
        cover-letter.docx
        cover-letter.pdf
```

---

## Firestore Schema

```
users/                              (collection)
  {uid}/                            (document — minimal, auth metadata only)
    private/                        (subcollection)
      profile                       (document — UserProfile)
    applications/                   (subcollection)
      {appId}                       (document — Application)

companyCache/                       (collection)
  {slug}                            (document — CompanyCache)
```

---

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // User private profile — owning user only
    match /users/{uid}/private/{doc} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Applications — owning user only; status forward-only
    match /users/{uid}/applications/{appId} {
      allow read, delete: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null && request.auth.uid == uid;
      allow update: if request.auth != null
                    && request.auth.uid == uid
                    && isValidStatusTransition(resource.data.status, request.resource.data.status);
    }

    // Company cache — any authenticated user may read; only Functions SA may write
    match /companyCache/{slug} {
      allow read: if request.auth != null;
      allow write: if false; // Functions service account bypasses rules
    }

    function isValidStatusTransition(from, to) {
      return (from == 'Submitted'  && to == 'In Progress')
          || (from == 'In Progress' && to == 'Completed')
          || from == to; // no-op updates (other fields) are allowed
    }
  }
}
```

---

## Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{uid}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

---

## Cloud Function API

All functions are Firebase Callable Functions (HTTPS callable). The client SDK passes the Firebase Auth ID token automatically; the function verifies it server-side.

### `resolveCompany`

Resolves a user-entered company name to a canonical result or a disambiguation list.

**Request:**
```typescript
{ companyName: string }
```

**Response:**
```typescript
// Unambiguous
{ resolved: true; company: { name: string; slug: string; summary: string } }

// Ambiguous
{ resolved: false; options: Array<{ name: string; slug: string; summary: string }> }
```

**Logic:**
1. Normalise `companyName` to a slug.
2. Check `companyCache/{slug}` — if found and < 7 days old, use cached data.
3. Otherwise query Google Custom Search: `"{companyName}" company official site OR about`.
4. Parse top 3–5 results; if names are distinct, return disambiguation list; if clearly one match, return resolved.
5. Write/update `companyCache/{slug}` with result and current timestamp.

---

### `generateApplication`

Runs the full generation pipeline for one job application.

**Request:**
```typescript
{
  companySlug: string;      // From resolveCompany result
  companyName: string;
  roleTitle: string;
  jobDescription: string;   // Full JD text
}
```

**Response:**
```typescript
{ appId: string }           // Firestore application document ID
```

**Logic (sequential steps):**

```
1. AUTH CHECK
   Verify request.auth.uid. Reject if unauthenticated.

2. LOAD USER PROFILE
   Read users/{uid}/private/profile from Firestore.
   Download base resume from Storage (or fetch Google Docs export).
   Extract plain text from PDF/DOCX.

3. LOAD COMPANY RESEARCH
   Read companyCache/{slug}.
   If missing or cachedAt > 7 days ago:
     → Call Google Custom Search for company profile + role info.
     → Write result to companyCache/{slug} with cachedAt = now.

4. GENERATE RESUME + COVER LETTER (Claude claude-sonnet-4-6)
   System prompt (cached prefix):
     - Role: expert resume writer and career coach
     - Rules: 2 pages max, second page ≥ half full, no AI-detector phrases,
              use varied human language, tailor to JD keywords
   User message:
     - Base resume text
     - JD text
     - Company profile summary
     - Public role info
     - User personal details (name, email, phone, city/state, selected URLs)
     - Generation date (ISO string)
   Output format: structured JSON
     {
       resume: { sections: ResumeSection[] },
       coverLetter: { header: CoverLetterHeader; body: string }
     }

5. AI-DETECTION CHECK (Claude claude-haiku-4-5, up to 3 iterations)
   Prompt: analyse resume and cover letter text for AI-detector patterns.
   If flagged sections found:
     → Rewrite flagged sections with human-idiomatic alternatives.
     → Increment iteration counter.
     → Repeat from step 5 until clean or counter == 3.
   If still flagged after 3 iterations:
     → Set flag: aiDetectionWarning = true (stored on application record).

6. RENDER DOCUMENTS (docx npm package)
   Build resume.docx and cover-letter.docx from structured JSON.
   Apply: standard margins, 11pt font, section headings, bullet points.
   Cover letter header includes: name, email, phone, city/state, 1–2 URLs, generation date.
   Enforce page layout: assert rendered page count ≤ 2.

7. CONVERT TO PDF
   Convert each DOCX to PDF (headless LibreOffice via Cloud Function layer, or docx-pdf).

8. UPLOAD TO STORAGE
   Upload resume.docx, resume.pdf, cover-letter.docx, cover-letter.pdf
   to users/{uid}/applications/{appId}/.

9. WRITE APPLICATION RECORD
   Create users/{uid}/applications/{appId} in Firestore with all fields.
   status = 'Submitted', generatedAt = now.

10. RETURN { appId }
```

---

### `deleteApplication`

Deletes an application record and all associated files.

**Request:**
```typescript
{ appId: string }
```

**Response:**
```typescript
{ success: true }
```

**Logic:**
```
1. Verify request.auth.uid.
2. Read application record — verify uid matches.
3. Delete Storage files (resume.docx, resume.pdf, cover-letter.docx, cover-letter.pdf).
   Log errors individually but do not abort.
4. Delete Firestore document users/{uid}/applications/{appId}.
5. Return { success: true }.
```

---

## Algorithms

### Company Slug Normalisation
```
slug = companyName
         .toLowerCase()
         .trim()
         .replace(/[^a-z0-9]+/g, '-')
         .replace(/^-|-$/g, '')
```
Example: `"OpenAI, Inc."` → `"openai-inc"`

### Company Cache TTL Check
```
isCacheStale(cachedAt: Timestamp): boolean {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  return (Date.now() - cachedAt.toMillis()) > SEVEN_DAYS_MS;
}
```

### URL Selection for Document Headers (1–2 URLs)
```
Priority order for resume header and cover letter header:
  1. LinkedIn (label contains "linkedin", case-insensitive)
  2. GitHub   (label contains "github", case-insensitive)
  3. Portfolio / personal site (any remaining URL, first by list order)

Select top 2 from the priority order above.
If only 1 URL exists, use 1. If none, omit URL line.
```

### Status Transition Validation
```
VALID_TRANSITIONS = {
  'Submitted':  'In Progress',
  'In Progress': 'Completed',
  'Completed':  null           // terminal — no further transitions
}

isValidTransition(from, to): boolean {
  return VALID_TRANSITIONS[from] === to;
}
```

---

## Configuration

All secrets stored in `.env` (gitignored). See `.env.example` for variable names.

| Variable / Constant | Used by | Notes |
|---------------------|---------|-------|
| `APP_ADMIN_EMAIL` | Frontend (`src/constants.ts`) | Static constant: `app_admin@divel.me` — displayed in footer and on error/contact screens |
| `VITE_FIREBASE_API_KEY` | Frontend | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Frontend | e.g. `project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Frontend | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Frontend | e.g. `project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Frontend | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Frontend | Firebase app ID |
| `ANTHROPIC_API_KEY` | Cloud Functions | Anthropic API key — never in frontend |
| `GOOGLE_SEARCH_API_KEY` | Cloud Functions | Google Custom Search API key |
| `GOOGLE_SEARCH_ENGINE_ID` | Cloud Functions | Programmable Search Engine ID |

---

## File Inventory

```
/
├── CLAUDE.md                         # Project context and rules reference
├── README.md                         # Setup and overview
├── progress.md                       # Session state tracker
├── .gitignore                        # Excludes: node_modules/, dist/, .env, .DS_Store, functions/.env, functions/lib/, *-firebase-adminsdk-*.json, firebase-debug.log, .firebase/
├── .env.example                      # Secret variable names (no values)
├── package.json                      # Frontend dependencies
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── index.html
│
├── src/
│   ├── main.tsx                      # React entry point
│   ├── App.tsx                       # Router, auth guard, and ProfileGuard (redirects to /profile if profile incomplete)
│   ├── components/
│   │   ├── Layout.tsx                # Shell with nav and copyright footer
│   │   ├── StatusBadge.tsx           # Status chip (Submitted / In Progress / Completed)
│   │   ├── ProfileUrlList.tsx        # Add/remove URL list component
│   │   └── ConfirmDialog.tsx         # Generic confirmation modal
│   ├── vite-env.d.ts                     # Vite client type reference (import.meta.env types)
│   ├── constants.ts                      # APP_ADMIN_EMAIL and other app-wide constants
│   ├── pages/
│   │   ├── SignIn.tsx
│   │   ├── Profile.tsx
│   │   ├── Dashboard.tsx
│   │   ├── NewApplication.tsx
│   │   └── ApplicationDetail.tsx
│   └── services/
│       ├── auth.ts
│       ├── profile.ts
│       ├── storage.ts
│       └── applications.ts
│
├── functions/
│   ├── package.json                  # Functions dependencies (docx, pdf, anthropic, google-search)
│   ├── .env.example                  # Functions secret variable names
│   └── src/
│       ├── index.ts                  # Exports all callable functions
│       ├── generateApplication.ts
│       ├── resolveCompany.ts
│       ├── deleteApplication.ts
│       └── lib/
│           ├── claudeClient.ts       # Anthropic SDK wrapper with prompt caching
│           ├── searchClient.ts       # Google Custom Search wrapper
│           ├── docRenderer.ts        # DOCX generation via docx package
│           ├── pdfConverter.ts       # DOCX → PDF conversion
│           └── utils.ts              # normaliseSlug, isCacheStale, selectUrls helpers
│
├── firestore.rules
├── storage.rules
├── firebase.json
├── .firebaserc
│
├── docs/
│   ├── PLAN.md
│   ├── REQUIREMENTS.md
│   ├── DESIGN.md
│   ├── SPECS.md                      # this file
│   ├── TASKS.md
│   ├── MANUAL_STEPS.md           # Step-by-step guide for every manual console action
│   ├── architecture.drawio
│   └── architecture.png
│
└── .github/
    └── workflows/
        └── deploy.yml
```

---

## Browser Compatibility

| Feature | Minimum requirement |
|---------|-------------------|
| Firebase Auth (Google OAuth popup) | Chrome 80+, Firefox 75+, Safari 13.1+, Edge 80+ |
| File upload (PDF/DOCX) | All modern browsers |
| File download (PDF/DOCX) | All modern browsers |
| CSS (Tailwind) | Chrome 80+, Firefox 75+, Safari 13.1+, Edge 80+ |

---

## Security Notes

- API keys for Anthropic and Google Search are **only** in Cloud Functions environment — never in frontend bundles or client-side code
- Personal details are stored exclusively in `users/{uid}/private/profile` — Firestore rules deny all access except the matching UID; there is no admin read path
- Generated files are stored under `users/{uid}/applications/` — Storage rules deny cross-UID access
- Status backward transitions are rejected at the Firestore rules layer — UI enforcement alone is insufficient
- Google Docs base resume import uses the public export URL (`/export?format=docx`) — if the document is not publicly accessible the import fails gracefully with a user-facing error; no OAuth scope for the user's Google Drive is requested or stored
- All Cloud Function inputs are validated against expected types before any downstream API call
- Firebase App Check should be enabled in production to prevent abuse of callable functions from non-app clients
