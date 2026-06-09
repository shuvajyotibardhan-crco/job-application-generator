# Design — Job Application Generator

## High-Level Overview
The system is a single-page React application backed entirely by Firebase. All sensitive operations (AI generation, company research, AI-detection checks) run inside Firebase Cloud Functions so that no API keys are ever exposed to the browser. The frontend communicates with Firestore for structured data and Firebase Storage for file blobs; auth is enforced at both the client and Firestore/Storage security-rules level. The generation pipeline is a three-step Cloud Function: (1) research the company and role publicly, (2) generate resume and cover letter via Claude, (3) run an AI-detection sub-agent check and rewrite any flagged sections before storing.

---

## Architecture Diagram

![Architecture Diagram](architecture.drawio)

---

## Module Design

### `src/firebase.ts`
Initialises the Firebase app from `VITE_*` environment variables and exports the four SDK handles used across the frontend (`auth`, `db`, `storage`, `functions`). App Check has been removed — the reCAPTCHA token fetch was being throttled (400 errors), stalling callable function invocations. App Check enforcement was never enabled on the Cloud Functions, so removing it has no security impact.

### `src/App.tsx`
Top-level router and auth state manager. Listens to Firebase `onAuthStateChanged` and either shows `<SignIn>` or the authenticated `<Layout>` shell. Exports a `ProfileGuard` component used on `/dashboard` and `/new-application` routes: on each render it fetches the user's profile from Firestore and redirects to `/profile` if `isProfileComplete()` returns false, ensuring first-time users fill in their details before creating applications.

### `src/pages/SignIn.tsx`
Renders the authentication screen. Handles Google OAuth popup and email/password sign-in/create-account flows via Firebase Auth SDK. No business logic — delegates to `src/services/auth.ts`.

### `src/pages/Profile.tsx`
First-time setup and ongoing profile management. Handles base resume file upload (PDF, DOCX, PNG, JPG) and Google Docs URL input, personal details form, and URL list management. PNG/JPG uploads are sent to Claude Vision (Haiku) server-side for text extraction. Calls `src/services/profile.ts` for Firestore writes and `src/services/storage.ts` for file uploads.

### `src/pages/Dashboard.tsx`
Default authenticated landing page. Reads the user's application list from Firestore (reverse-chron), renders each as a row with status badge, and provides the "New Application" entry point. Empty-state handled inline.

### `src/pages/NewApplication.tsx`
Multi-step form: (1) JD input (paste or file upload — .txt/.pdf/.docx extracted client-side; .png/.jpg sent to the `extractImageText` Cloud Function for Claude Vision OCR) + company name + role title, (2) optional company disambiguation step, (3) live progress screen while the Cloud Function runs — subscribes to `users/{uid}/private/generationProgress` via `onSnapshot` and displays each pipeline stage message as the function writes it. On submit, calls the `generateApplication` Cloud Function.

### `src/pages/ApplicationDetail.tsx`
Shows all stored fields for one application. Renders status control (forward-only), download buttons for resume and cover letter, and the Delete Application action with confirmation dialog.

### `src/services/auth.ts`
Thin wrapper around Firebase Auth: `signInWithGoogle()`, `signInWithEmail()`, `createAccount()`, `signOut()`, `onAuthStateChange()`.

### `src/services/profile.ts`
Firestore read/write for the user's private profile document (`users/{uid}/private/profile`). Handles URL list CRUD operations.

### `src/services/storage.ts`
Firebase Storage helpers: upload base resume to `users/{uid}/resume/base.*`, download generated files from `users/{uid}/applications/{appId}/`.

### `src/services/applications.ts`
Firestore CRUD for application records (`users/{uid}/applications/{appId}`). Handles list queries (ordered by date desc), status updates, and delete (calls delete Cloud Function).

### `functions/src/generateApplication.ts` (Cloud Function — callable)
Main generation pipeline:
1. Calls Google Custom Search API for company public profile and public role info.
2. Caches search results in Firestore (`companyCache/{slug}`) to avoid duplicate API calls.
3. Calls Claude `claude-sonnet-4-6` with base resume + JD + research results to generate resume and cover letter.
4. Enforces 2-page constraint and second-page minimum in the generation prompt.
5. Calls AI-detection sub-agent (Claude `claude-haiku-4-5`) to check 8 criteria — banned words, transitional signposts, hedging phrases, passive voice, uniform long-sentence rhythm, repetitive bullet openings, sentence rephrasing, and vague abstractions — then rewrites any flagged sections (up to 3 iterations).
6. Renders final documents as formatted DOCX (using `docx` npm package). PDF generation removed — only DOCX is stored and offered for download.
7. Uploads both formats to Firebase Storage; writes application record to Firestore.

### `functions/src/downloadFile.ts` (Cloud Function — callable)
Returns the raw bytes of a generated application file as a base64 string. The client calls this instead of fetching the Firebase Storage download URL directly, because direct browser `fetch()` calls to Storage are blocked by CORS (the bucket has no CORS configuration). The function verifies the requesting user owns the path (`storagePath` must start with `users/{uid}/`) before streaming the file.

### `functions/src/deleteApplication.ts` (Cloud Function — callable)
Deletes the Firestore application record and both Storage files (resume + cover letter) for the owning user. Logs Storage errors but always deletes the Firestore record.

### `functions/src/resolveCompany.ts` (Cloud Function — callable)
Accepts a company name string. Uses Google Custom Search to identify candidate companies. Returns a single resolved result or a disambiguation list if multiple distinct companies are found.

### `firestore.rules`
Security rules:
- `users/{uid}/private/**` — read/write only if `request.auth.uid == uid`
- `users/{uid}/applications/**` — read/write only if `request.auth.uid == uid`; status field write validated to allow only forward transitions
- `companyCache/**` — read by any authenticated user; write only by Cloud Functions service account
- All other paths denied

### `storage.rules`
- `users/{uid}/**` — read/write only if `request.auth.uid == uid`
- All other paths denied

---

## Design Considerations

### Why Cloud Functions for all AI/search calls?
Keeps Anthropic and Google Search API keys entirely server-side. The browser never sees them. This is a hard requirement — client-side AI calls would expose keys.

### Why Claude Haiku for AI-detection check?
The detection sub-agent does a simpler analytical task than the full generation. Haiku is ~10× cheaper than Sonnet per token and sufficient for pattern detection and phrase rewriting. Sonnet is reserved for the generation step where quality is paramount.

### Why cache company search results in Firestore?
Multiple users applying to the same company would otherwise trigger duplicate Google Custom Search API calls. A `companyCache` collection keyed by a normalised company slug avoids re-querying, saving both Google API quota and latency.

### Why DOCX as the only download format?
DOCX is the only format generated, stored, and offered for download so users can open and edit the document before submitting. PDF generation was removed — it caused Cloud Function timeout errors and isn't needed since DOCX opens in Word, Google Docs, and most email clients.

### Why Firestore security rules for privacy (not just app logic)?
App-level checks can be bypassed. Firestore rules are enforced at the database layer — no code path, API call, or admin console access can read a user's private data unless the authenticated UID matches. This is the only way to guarantee the privacy requirement.

### Why forward-only status in both UI and Firestore rules?
Status validation in the UI alone can be bypassed by direct API calls. The Firestore rule validates that a status write only moves the value forward in the defined sequence, making rollback impossible at the data layer.

---

## Chargeable Components & Cost Estimates

### Summary Table

| Service | What triggers a charge | Free tier | Cost above free tier | Est. cost per application |
|---------|----------------------|-----------|---------------------|--------------------------|
| **Anthropic Claude API** | Token usage (generation + detection check) | None | Sonnet: $3/M input, $15/M output. Haiku: $0.25/M input, $1.25/M output | ~$0.05–0.08 |
| **Google Custom Search API** | Search queries (company research) | 100 queries/day | $5 per 1,000 queries ($0.005/query) | $0.01 (2 queries; free if < 50 apps/day) |
| **Firebase Cloud Functions** | Function invocations + compute time | 2M invocations/month + 400K GB-seconds/month | $0.40/M invocations; $0.0000025/GB-second | Negligible at personal scale |
| **Firebase Firestore** | Document reads/writes | 50K reads + 20K writes/day | $0.06/100K reads; $0.18/100K writes | Negligible at personal scale |
| **Firebase Storage** | Storage volume + downloads | 5 GB storage; 1 GB/day download | $0.026/GB storage; $0.12/GB download | Negligible at personal scale |
| **Firebase Hosting** | Bandwidth | 360 MB/day transfer | $0.15/GB transfer | Negligible |
| **GitHub Actions** | CI/CD minutes | 2,000 min/month (private repo) | $0.008/minute | Negligible (deploy ~3 min) |

> **Firebase requires the Blaze (pay-as-you-go) plan** to use Cloud Functions. All Firebase free-tier quotas still apply on Blaze — you only pay for what exceeds them.

### Dominant Cost: Claude API

The Anthropic API has no free tier and is the only mandatory per-application cost.

**Per-application token estimate:**

| Step | Model | Input tokens | Output tokens | Cost |
|------|-------|-------------|--------------|------|
| Resume + cover letter generation | claude-sonnet-4-6 | ~6,000 | ~2,000 | ~$0.048 |
| AI-detection check (up to 3 passes) | claude-haiku-4-5 | ~3,000 | ~1,000 | ~$0.002 |
| **Total per application** | | | | **~$0.05** |

**Monthly cost examples:**

| Applications/month | Claude API cost | All other services |
|-------------------|-----------------|--------------------|
| 10 | ~$0.50 | ~$0 (within free tiers) |
| 50 | ~$2.50 | ~$0 (within free tiers) |
| 200 | ~$10.00 | ~$2 (Google Search overage) |

### Cost Minimisation Measures (built into the design)

1. **Claude Haiku for detection sub-agent** — 10× cheaper than Sonnet; quality sufficient for the analytical task
2. **Company research cache** — `companyCache` Firestore collection stores search results by normalised company slug with a `cachedAt` timestamp; cache TTL is **7 days** — results older than 7 days are re-fetched, fresher results are served directly, saving Google API quota and latency
3. **Claude prompt caching** — system prompt and base resume sent as a cached prefix; Anthropic charges 90% less for cached input tokens ($0.30/M vs $3/M for Sonnet), saving ~$0.01 per application where the same system prompt is reused
4. **Single Cloud Function invocation** — the entire pipeline (research → generate → check → store) runs in one function call, minimising invocation count and cold-start overhead
5. **No polling** — client uses a Firebase callable function and waits for the response rather than polling, avoiding extra Firestore reads

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend framework | Vite + React + TypeScript | Fast build tooling, type safety, mature ecosystem |
| Styling | Tailwind CSS | Utility-first; no runtime CSS-in-JS cost |
| Authentication | Firebase Authentication | Native Google OAuth + email/password; zero custom auth server |
| Database | Firebase Firestore | Document model maps directly to application records; security rules enforce per-user privacy |
| File storage | Firebase Storage | UID-scoped access rules; integrates with Firebase Auth |
| AI generation | Claude claude-sonnet-4-6 (Anthropic) | Best instruction-following for long-form structured document generation |
| AI detection check | Claude claude-haiku-4-5 (Anthropic) | 10× cheaper; sufficient for pattern analysis and targeted rewriting |
| Company research | Google Custom Search API | Retrieves public company and role information reliably |
| Document formatting | `docx` npm package | Programmatic DOCX generation with precise layout control (fonts, spacing, page breaks) |
| PDF export | ~~`pdfmake`~~ removed | PDF generation removed — DOCX is the only output format |
| Backend | Firebase Cloud Functions (Node.js 20) | Keeps all API keys server-side; auto-scales |
| CI/CD | GitHub Actions + FirebaseExtended/action-hosting-deploy | No local Firebase CLI dependency |

---

## Deployment

- Firebase Hosting serves the compiled React SPA
- Firebase Cloud Functions (Node.js 20) handle all server-side logic
- Every push to `main` triggers GitHub Actions: install → build → deploy Hosting + Functions
- All secrets (API keys, Firebase service account) stored as GitHub Actions Secrets — never in the repo
- Firestore security rules deployed via the same GitHub Actions workflow

---

## UI — Footer

Every screen (authenticated and unauthenticated) **shall** display a footer containing:

> © [current year] divel.me — All rights reserved &nbsp;|&nbsp; Contact: app_admin@divel.me

The year is rendered dynamically from `new Date().getFullYear()` so it never needs a manual update. The admin contact email is a static constant (`APP_ADMIN_EMAIL`) defined in `src/constants.ts` so it can be updated in one place.

---

## Constraints & Known Limitations

| Constraint | Detail |
|-----------|--------|
| No free AI tier | Every generation costs ~$0.05 regardless of usage volume |
| 2-page enforcement is prompt-based | The AI is given explicit budgets: 600–700 words total, max 4 bullets per role, max 4 roles, cover letter 3 paragraphs ≤80 words each. In rare edge cases a very long base resume may still overflow. |
| Google Docs base resume | Google Docs URLs are fetched as exported DOCX via the Google Docs export endpoint; if the Doc is not publicly accessible or export-enabled, the import will fail with a user-facing error |
| Company disambiguation accuracy | Relies on Google Custom Search results; very obscure companies may not resolve cleanly |
| AI-detection rewrite cap | Max 3 iterations; if content still flags after 3 passes, the best available version is presented with a warning |
| Firebase Blaze required | Free Spark plan cannot run Cloud Functions; Blaze plan must be enabled before first deploy |
| Cold-start latency | First invocation of a Cloud Function after inactivity may add 1–3 seconds; acceptable for a generation flow that already takes several seconds |
