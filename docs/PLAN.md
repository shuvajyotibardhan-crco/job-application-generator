# Project Plan — Job Application Generator

## What We Are Building
An AI-powered web application that helps job seekers generate tailored, ATS-optimised resumes and cover letters. Users maintain a single base resume and personal profile; per application they supply a job description and company/role details, and the system produces a unique, human-sounding resume and cover letter scoped to that role. All applications are tracked in a personal dashboard.

---

## Feature Set

| # | Feature | Description |
|---|---------|-------------|
| 1 | Authentication | Google OAuth + Email/Password sign-in. No guest access. |
| 2 | User Profile & Base Resume | Upload base resume (PDF/DOCX/Google Docs link), personal details (name, email, phone, city/state), optional URLs (LinkedIn, GitHub, portfolio, etc.). All personal details private. |
| 3 | New Job Application | Input: job description (paste or upload), company name, role title. System resolves company if ambiguous. |
| 4 | AI Generation | Claude generates tailored resume + cover letter using base resume, JD, company profile, and public role info. Max 2 pages each; second page must be at least half full. |
| 5 | AI-Detection Check | Sub-agent pass verifies generated content will not be flagged by AI detectors; rewrites flagged sections. |
| 6 | Application Storage | Generated resume + cover letter stored against company, role, and date. |
| 7 | Dashboard | List of all applications with company, role, date, and status. Click for detail view. |
| 8 | Detail View & Download | View application details; download resume and cover letter. |
| 9 | Status Management | Three statuses: Submitted (auto) → In Progress → Completed. Forward-only; no rollback. Manual change for In Progress and Completed. |
| 10 | Delete Application | Delete an application and all associated files (resume, cover letter). |

---

## Delivery Strategy

### Phase 1 — Foundation
- Firebase project setup (Auth, Firestore, Storage, Functions)
- GitHub Actions CI/CD pipeline
- Authentication screens (Google + Email/Password)
- User profile + base resume upload

### Phase 2 — Application Generation
- New application flow (JD input, company/role inputs, company disambiguation)
- Company research via Google Custom Search
- Claude AI generation (resume + cover letter, 2-page constraint)
- AI-detection sub-agent check + rewrite loop

### Phase 3 — Dashboard & Lifecycle
- Dashboard (application list, status chips)
- Detail view + download
- Status management (forward-only)
- Delete application + file cleanup

### Phase 4 — Polish & Deploy
- Responsive design
- Error handling + loading states
- Firestore security rules
- Docs (REQUIREMENTS, DESIGN, SPECS committed)
- Production deploy via GitHub Actions

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Vite + React + TypeScript | Fast DX, type safety, broad ecosystem |
| Styling | Tailwind CSS | Utility-first, rapid UI iteration |
| Auth | Firebase Authentication | Supports Google OAuth + email/password out of the box |
| Database | Firebase Firestore | Real-time, document-oriented, pairs well with Firebase Auth security rules |
| File Storage | Firebase Storage | Integrated with Firebase Auth for scoped access rules |
| AI Generation | Claude API (claude-sonnet-4-6) | Best-in-class instruction following for long-form document generation |
| Company Research | Google Custom Search API | Public web search scoped to company + role |
| Backend | Firebase Cloud Functions (Node.js) | Keeps all API keys server-side; scales automatically |
| CI/CD | GitHub Actions + FirebaseExtended/action-hosting-deploy | No local CLI dependency |

---

## Key Constraints
- **No guest access** — authentication is mandatory before any feature is accessible
- **Personal details privacy** — Firestore security rules must deny all reads except the owning user; no admin backdoor
- **2-page document limit** — enforced in generation prompt; second page must be at least half full
- **Fully formatted output** — resume and cover letter are rendered as properly formatted documents (not plain text); cover letter must include the date of generation as part of its header
- **AI-detection safe** — sub-agent checks output before storing; loop rewrites until clean
- **Status is forward-only** — no UI path to move Submitted → back, or Completed → back
- **Company disambiguation** — if multiple companies match input name, present options before generation
- **No local firebase deploy** — CI/CD only via GitHub Actions
- **Docs = code** — REQUIREMENTS, DESIGN, SPECS, TASKS committed alongside every change

---

## Approval-Gate Workflow

Each document below requires explicit user approval before the next begins:

1. **PLAN.md** ← you are here
2. **REQUIREMENTS.md** — user stories, ACs, test plans per feature
3. **DESIGN.md** — architecture, module design, tech decisions
4. **SPECS.md** — data models, Firestore schema, API signatures, algorithms
5. **TASKS.md** — numbered implementation tasks, one task = one commit
6. **architecture.drawio + .png** — draw.io diagram embedded in DESIGN.md

No code is written until all six are approved.

---

## Immediate Next Actions

All phases complete. App is deployed to production via GitHub Actions.

- [x] Phases 1–5 implemented (T01–T20)
- [ ] T21: Smoke-test on live URL (sign-in → profile → generate → dashboard → download → status → delete)
- [ ] T22: Update OAuth consent screen support email to `app_admin@divel.me` once Google Workspace is ready
- [ ] App Check manual step: Add `VITE_FIREBASE_APP_CHECK_KEY` GitHub secret + enable enforcement in Firebase Console (MANUAL_STEPS.md Step 7)
