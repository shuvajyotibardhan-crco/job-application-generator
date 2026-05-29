# Tasks — Job Application Generator

All tasks are in dependency order. Each task maps to one atomic commit. No code is written before PLAN, REQUIREMENTS, DESIGN, SPECS, and TASKS are all approved.

---

## Phase 1 — Foundation

### T01 — Firebase project + GitHub repo setup
- [ ] Create Firebase project (Blaze plan)
- [ ] Enable Firebase Auth, Firestore, Storage, Hosting, Cloud Functions
- [ ] Enable GCP APIs: cloudfunctions, cloudbuild, run, eventarc, cloudbilling
- [ ] Add IAM roles to service account: Service Usage Consumer, Service Account User, Cloud Functions Developer, Cloud Run Admin
- [ ] Create GitHub repo `job-application-generator`
- [ ] Git init, add remote, push scaffold commit (root files + docs)
- [ ] Add all GitHub Actions Secrets: FIREBASE_SERVICE_ACCOUNT, ANTHROPIC_API_KEY, GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_ENGINE_ID, and all VITE_FIREBASE_* vars

### T02 — GitHub Actions CI/CD pipeline
- [ ] Create `.github/workflows/deploy.yml`
  - Triggers on push to `main`
  - Installs deps (frontend + functions)
  - Builds frontend with VITE_* env vars from Secrets
  - Writes `functions/.env` from Secrets
  - Deploys Hosting via `FirebaseExtended/action-hosting-deploy@v0`
  - Deploys Functions via `firebase-tools`
  - Deploys Firestore rules
  - Deploys Storage rules
- [ ] Push and verify GitHub Actions run passes

### T03 — Vite + React + TypeScript + Tailwind scaffold
- [ ] `npm create vite@latest . -- --template react-ts`
- [ ] Install Tailwind CSS and configure
- [ ] Install Firebase SDK, React Router
- [ ] Create `src/firebase.ts` — initialises Firebase app from VITE_* env vars
- [ ] Create `src/App.tsx` — router with auth guard (unauthenticated → /signin)
- [ ] Create `src/components/Layout.tsx` — shell with nav and copyright footer (`© {year} divel.me — All rights reserved`)
- [ ] Stub all page components (SignIn, Profile, Dashboard, NewApplication, ApplicationDetail)

### T04 — Firebase Functions scaffold
- [ ] `firebase init functions` (Node.js 20, TypeScript)
- [ ] Install: `anthropic`, `axios`, `docx`, `firebase-admin`, `firebase-functions`
- [ ] Create `functions/src/index.ts` — exports stub functions
- [ ] Create `functions/src/lib/claudeClient.ts` — Anthropic SDK wrapper (prompt caching enabled)
- [ ] Create `functions/src/lib/searchClient.ts` — Google Custom Search wrapper
- [ ] Add `functions/.env` to `.gitignore`; commit `functions/.env.example`

### T05 — Authentication screens
- [ ] Implement `src/services/auth.ts` (signInWithGoogle, signInWithEmail, createAccount, signOut, onAuthStateChange)
- [ ] Implement `src/pages/SignIn.tsx` — Google OAuth button + email/password form (sign-in and create-account modes)
- [ ] Add email format and password length (≥ 8 chars) validation
- [ ] Wire auth guard in `src/App.tsx` — redirect unauthenticated users to /signin
- [ ] Add sign-out to nav in Layout

### T06 — Firestore + Storage security rules
- [ ] Write `firestore.rules` — private profile, applications (with status transition function), companyCache
- [ ] Write `storage.rules` — UID-scoped paths
- [ ] Deploy rules via GitHub Actions; verify in Firebase Console

---

## Phase 2 — User Profile

### T07 — User profile service + Firestore writes
- [ ] Implement `src/services/profile.ts` — read/write `users/{uid}/private/profile`
- [ ] Implement `src/services/storage.ts` — upload base resume to `users/{uid}/resume/base.*`

### T08 — Profile setup screen
- [ ] Implement `src/pages/Profile.tsx`
  - Full name, email, phone, city, state fields
  - Base resume upload (PDF/DOCX accepted) with file type validation
  - Google Docs URL input mode (toggle)
  - Replace resume — overwrites existing Storage file
  - ProfileUrlList component (add/remove URLs with label)
  - Save with confirmation message
- [ ] First-login redirect: if `users/{uid}/private/profile` has no `baseResumeRef`, redirect to /profile before /dashboard
- [ ] Gate "New Application" button — show inline message if required fields missing

---

## Phase 3 — Application Generation

### T09 — Company resolution Cloud Function
- [ ] Implement `functions/src/resolveCompany.ts`
  - Slug normalisation
  - CompanyCache TTL check (7 days)
  - Google Custom Search query
  - Return resolved result or disambiguation list
- [ ] Implement `src/services/applications.ts` — `resolveCompany()` callable wrapper
- [ ] Implement company disambiguation step in `src/pages/NewApplication.tsx`

### T10 — New application form
- [ ] Implement `src/pages/NewApplication.tsx` (full)
  - Step 1: JD input (paste textarea + file upload for PDF/DOCX)
  - Step 2: company name + role title entry
  - Step 3: disambiguation selector (shown only if resolveCompany returns `resolved: false`)
  - Validation: all three inputs required before proceeding
  - Progress indicator during generation

### T11 — Document renderer
- [ ] Implement `functions/src/lib/docRenderer.ts`
  - `renderResume(sections, personalDetails, urls): Buffer` — DOCX with standard margins, 11pt font, section headings, bullets
  - `renderCoverLetter(header, body, personalDetails, urls, date): Buffer` — DOCX with formatted header (name, contact, 1–2 URLs, generation date)
  - URL selection logic (LinkedIn → GitHub → Portfolio, top 2)
  - Page count assertion (≤ 2 pages)

### T12 — PDF conversion
- [ ] Implement `functions/src/lib/pdfConverter.ts`
  - Convert DOCX Buffer → PDF Buffer
  - Use `libreoffice-file-converter` or `docx-pdf` compatible with Cloud Functions runtime
  - Test conversion output preserves formatting

### T13 — AI generation Cloud Function
- [ ] Implement `functions/src/generateApplication.ts` — full 10-step pipeline:
  1. Auth check
  2. Load UserProfile + base resume text extraction (PDF/DOCX parse)
  3. Load/refresh CompanyCache (7-day TTL)
  4. Generate resume + cover letter (claude-sonnet-4-6, prompt caching on system prompt)
  5. AI-detection check loop (claude-haiku-4-5, max 3 iterations)
  6. Render resume.docx + cover-letter.docx via docRenderer
  7. Convert to PDF via pdfConverter
  8. Upload 4 files to Firebase Storage
  9. Write Application record to Firestore (status = 'Submitted')
  10. Return `{ appId }`
- [ ] Wire `generateApplication` callable in `src/services/applications.ts`
- [ ] Connect to NewApplication form submit handler

---

## Phase 4 — Dashboard & Lifecycle

### T14 — Dashboard
- [ ] Implement `src/pages/Dashboard.tsx`
  - Firestore query: `users/{uid}/applications` ordered by `generatedAt` desc
  - Application list rows: company, role, date, StatusBadge
  - Empty state message
  - "New Application" button → /new-application
  - Row click → /application/{appId}
- [ ] Implement `src/components/StatusBadge.tsx` — distinct colour per status

### T15 — Application detail view
- [ ] Implement `src/pages/ApplicationDetail.tsx`
  - Load application record from Firestore
  - Display company, role, date, status
  - Download resume button (PDF) — Firebase Storage download URL
  - Download cover letter button (PDF) — Firebase Storage download URL
  - Back navigation to dashboard
  - StatusControl: shows current status; advance button to next status only; disabled when Completed

### T16 — Status update
- [ ] Implement status update in `src/services/applications.ts` — Firestore update (`status` field only)
- [ ] Firestore rule rejects backward transitions (already in T06 rules)
- [ ] Wire status control in ApplicationDetail

### T17 — Delete application
- [ ] Implement `functions/src/deleteApplication.ts` — delete 4 Storage files + Firestore record
- [ ] Implement `src/components/ConfirmDialog.tsx` — generic modal with confirm/cancel
- [ ] Wire delete button + ConfirmDialog in ApplicationDetail
- [ ] On confirmed delete, call deleteApplication function, redirect to dashboard

---

## Phase 5 — Polish & Deploy

### T18 — Error handling + loading states
- [ ] Loading spinners on: profile save, company resolution, generation, status update, delete
- [ ] Error banners on: auth failures, generation failures, AI-detection warning (3-iteration cap hit)
- [ ] Form validation messages inline (not alert dialogs)
- [ ] Graceful handling of Google Docs URL import failure

### T19 — Responsive design pass
- [ ] Test and fix layout on mobile (375px), tablet (768px), desktop (1280px)
- [ ] Ensure dashboard table is scrollable on small screens
- [ ] Ensure DOCX upload and generation flow is usable on touch devices

### T20 — Firebase App Check
- [ ] Enable App Check in Firebase Console (reCAPTCHA v3 provider)
- [ ] Add App Check initialisation to `src/firebase.ts`
- [ ] Verify callable functions reject requests without valid App Check token

### T21 — Final docs + production deploy
- [ ] Update SPECS.md file inventory if any files were added/renamed during implementation
- [ ] Update DESIGN.md architecture diagram embed (if diagram not yet generated)
- [ ] Verify all Firestore and Storage rules are deployed
- [ ] Push to `main` — watch GitHub Actions run to completion
- [ ] Smoke-test on live URL: sign-in, profile, generate application, dashboard, download, status change, delete

---

### T22 — Update OAuth consent screen support email
- [ ] Once `app_admin@divel.me` is set up as a Google Workspace account or alias:
  - Go to GCP Console → APIs & Services → OAuth consent screen
  - Update the **Support email** field to `app_admin@divel.me`
  - Save

---

## Manual Steps (not in CI/CD)

| Step | When | Where |
|------|------|-------|
| Enable Blaze plan | Before T01 | Firebase Console |
| Enable GCP APIs | T01 | GCP Console URLs (see `.claude_rules.md`) |
| Add IAM roles to service account | T01 | GCP Console → IAM |
| Add GitHub Actions Secrets | T01 | GitHub → Settings → Secrets → Actions |
| Enable App Check + reCAPTCHA | T20 | Firebase Console → App Check |
| Create Google Programmable Search Engine | Before T09 | programmablesearchengine.google.com |
