# Requirements — Job Application Generator

## Overview
A web application that enables job seekers to generate tailored, ATS-optimised, fully formatted resumes and cover letters for individual job applications. Users maintain a single base resume and private personal profile. Per application, they supply a job description and company/role details; the system researches the company and role publicly, generates documents via AI, checks them against AI-detection signals, and stores them against the application record. Applications are managed in a personal dashboard.

## Scope

### In Scope
- Google OAuth and Email/Password authentication (no guest access)
- User profile: base resume upload (PDF/DOCX/Google Docs URL), personal details, optional URLs
- New job application flow: JD input, company + role input, company disambiguation
- AI-generated tailored resume and cover letter (max 2 pages, second page ≥ half full)
- Fully formatted document output; cover letter header includes generation date
- AI-detection sub-agent check with rewrite loop
- Application storage (company, role, date, status, generated files)
- Dashboard: application list with status; detail view; download
- Status lifecycle: Submitted → In Progress → Completed (forward-only, no rollback)
- Delete application (removes all associated files)

### Out of Scope
- Guest / anonymous access
- Multi-user collaboration or sharing
- Admin portal or admin reads of personal details
- Native mobile app
- Paid tier / billing

---

## Feature 1 — Authentication

### User Story
As a job seeker, I want to sign in with Google or create an account with email and password so that my data is securely tied to my identity.

### Acceptance Criteria
1. The app **must** require authentication before any protected screen is accessible.
2. The sign-in screen **shall** offer a "Sign in with Google" button and an email/password form.
3. The email/password form **shall** support both "Sign In" and "Create Account" modes.
4. On "Create Account", the app **shall** validate that the email is properly formatted and the password meets a minimum of 8 characters.
5. Failed sign-in **shall** display a clear, user-facing error message.
6. There **must** be no guest or anonymous access path.
7. Signing out **shall** redirect the user to the sign-in screen and clear all local session state.

### Test Plan
| Step | Expected Result |
|------|----------------|
| Visit app unauthenticated | Redirected to sign-in screen |
| Click "Sign in with Google" | Google OAuth popup opens; on success, user lands on dashboard |
| Submit email/password sign-in with valid credentials | User lands on dashboard |
| Submit email/password sign-in with wrong password | Error message displayed; no navigation |
| Click "Create Account" with a weak password (< 8 chars) | Validation error shown; account not created |
| Click "Create Account" with valid inputs | Account created; user lands on profile setup |
| Click sign-out | Redirected to sign-in; session cleared |
| Attempt to navigate to /dashboard while signed out | Redirected to sign-in |

---

## Feature 2 — User Profile & Base Resume

### User Story
As a job seeker, I want to store my base resume and personal details in my profile so that the app can use them as the foundation for every application I generate.

### Acceptance Criteria
1. On first login, the app **shall** direct the user to a profile setup screen before any other action.
2. The profile **must** accept a base resume in PDF, DOCX, or Google Docs URL format.
3. The user **shall** be able to replace the base resume at any time; the new upload replaces the previous one.
4. The profile **shall** capture: full name, email address, phone number, city and state.
5. The profile **shall** allow the user to add one or more optional URLs (LinkedIn, GitHub, portfolio, etc.) with a label per URL.
6. The user **shall** be able to add and remove individual URLs without affecting other profile fields.
7. All personal details (name, email, phone, city/state, URLs) **must** be stored such that no other user and no admin role can read them — enforced at the Firestore security rules level.
8. The profile screen **shall** be accessible from every authenticated screen via a persistent nav element.
9. Saving the profile **shall** show a confirmation message.
10. The profile **must** require at minimum: a base resume upload, full name, email, phone, and city/state before the user can start a new application.

### Test Plan
| Step | Expected Result |
|------|----------------|
| First login (new account) | Profile setup screen shown before dashboard |
| Upload a PDF resume | File accepted; confirmation shown |
| Upload a DOCX resume | File accepted; confirmation shown |
| Paste a Google Docs URL | URL accepted and stored |
| Upload a new resume to replace existing | Old file removed; new file stored |
| Add a LinkedIn URL with label "LinkedIn" | URL appears in the list |
| Add a GitHub URL with label "GitHub" | URL appears alongside LinkedIn |
| Remove one URL | That URL removed; others unchanged |
| Save profile with all required fields | Confirmation message shown; dashboard accessible |
| Attempt to start new application with incomplete profile | Blocked with message listing missing fields |
| Sign in as a different user | Cannot read first user's profile data |

---

## Feature 3 — New Job Application Input

### User Story
As a job seeker, I want to provide a job description, company name, and role title so that the app can research the opportunity and generate targeted documents.

### Acceptance Criteria
1. The dashboard **shall** include a prominently placed "New Application" button.
2. The new application form **shall** require: job description (paste or file upload), company name, and role title.
3. The job description **shall** be the primary source of data for generation.
4. The app **shall** use the company name and role title to research public company information and the public description of that role at that company as secondary sources.
5. If the company name matches multiple distinct companies, the app **shall** present a disambiguation list for the user to select the correct one before proceeding.
6. If the company name resolves unambiguously, the app **shall** proceed without interruption.
7. The user **must** not be able to proceed to generation until job description, company name, and role title are all provided.

### Test Plan
| Step | Expected Result |
|------|----------------|
| Click "New Application" from dashboard | New application form opens |
| Submit form with job description and company/role | Proceeds to generation (or disambiguation if needed) |
| Submit form with missing job description | Blocked; error highlights missing field |
| Enter a common company name (e.g. "Apple") | Disambiguation list shown with distinguishing details |
| Select a company from the disambiguation list | Correct company selected; generation proceeds |
| Enter a unique company name | No disambiguation; generation proceeds directly |

---

## Feature 4 — AI Document Generation

### User Story
As a job seeker, I want the app to generate a tailored, fully formatted resume and cover letter based on my profile, the job description, and public company/role information so that each application is specific and compelling.

### Acceptance Criteria
1. The app **shall** generate both a resume and a cover letter for every application.
2. The base resume, job description, company public profile, and public role information **shall** all be used as inputs to generation.
3. The generated resume **shall** be tailored to the job description — skills, experience framing, and language **shall** reflect the JD requirements.
4. The resume header **shall** include the user's name, email, phone, city/state, and 1–2 URLs selected from the user's profile URLs as appropriate to the role (e.g. GitHub for technical roles, LinkedIn otherwise).
5. The cover letter **shall** include a properly formatted header containing: user's name, contact details, 1–2 profile URLs, and the date the document was generated.
6. Both documents **must** be capped at 2 pages maximum.
7. If either document reaches a second page, the second page **must** be at least half full — generation **shall** expand content to meet this minimum if needed.
8. Both documents **shall** be output as fully formatted documents (not plain text), suitable for professional use and download.
9. The resume **must** not contain language commonly flagged by AI-detection tools (see Feature 5).
10. The cover letter **must** not contain language commonly flagged by AI-detection tools (see Feature 5).
11. The user **shall** see a progress indicator during generation.

### Test Plan
| Step | Expected Result |
|------|----------------|
| Complete new application form and submit | Generation starts; progress indicator shown |
| Generation completes | Resume and cover letter displayed or confirmed ready |
| Inspect resume header | Contains name, email, phone, city/state, 1–2 URLs |
| Inspect cover letter header | Contains name, contact details, 1–2 URLs, and today's date |
| Count pages on generated resume | 1 or 2 pages; if 2, second page is at least half full |
| Count pages on generated cover letter | 1 or 2 pages; if 2, second page is at least half full |
| Compare resume language to JD keywords | Key skills and role-specific language present |
| Check for AI-detection flags | Neither document flagged (see Feature 5) |

---

## Feature 5 — AI-Detection Check

### User Story
As a job seeker, I want the generated documents to read as naturally human-written so that they are not flagged by AI-detection tools used by employers or ATS systems.

### Acceptance Criteria
1. After generation, a dedicated sub-agent **shall** analyse both the resume and the cover letter for language patterns commonly flagged by AI-detection tools.
2. Any section flagged **shall** be rewritten by the sub-agent to use varied, natural, human-idiomatic language.
3. The check-and-rewrite loop **shall** repeat until neither document contains flagged language or a maximum of 3 iterations is reached.
4. If after 3 iterations a document still contains flagged content, the app **must** notify the user and present the best available version rather than blocking the flow.
5. Words and phrases commonly overused by AI systems (e.g. "leverage", "utilise", "spearhead", "deliverables", "synergy", "cutting-edge", "passionate about") **must** be avoided in the final output.
6. The check **must** run before documents are stored or presented to the user.

### Test Plan
| Step | Expected Result |
|------|----------------|
| Generate a document | AI-detection check runs automatically after generation |
| Sub-agent detects flagged language | Flagged sections rewritten; check re-runs |
| Document passes check | Stored and presented to user without warning |
| Document fails after 3 iterations | User notified; best available version presented |
| Inspect final output for overused AI phrases | None of the listed phrases present |

---

## Feature 6 — Application Storage

### User Story
As a job seeker, I want each application and its generated documents stored against the company, role, and date so that I can retrieve them later.

### Acceptance Criteria
1. On successful generation, the app **shall** store the application record containing: company name, role title, date of generation, status ("Submitted"), and references to the generated resume and cover letter files.
2. The generated resume and cover letter **must** be stored in Firebase Storage under a path scoped to the user's UID so that no other user can access them.
3. The stored documents **shall** retain their full formatting.
4. Application records **must** only be readable and writable by the owning user — enforced at the Firestore security rules level.

### Test Plan
| Step | Expected Result |
|------|----------------|
| Complete generation | Application record created in Firestore with company, role, date, status = "Submitted" |
| Inspect storage path | Files stored under user's UID-scoped path |
| Sign in as different user | Cannot access first user's application records or files |

---

## Feature 7 — Dashboard

### User Story
As a job seeker, I want a dashboard showing all my job applications so that I can track my activity at a glance.

### Acceptance Criteria
1. The dashboard **shall** be the default landing screen after authentication.
2. The dashboard **shall** list all of the user's applications, each showing: company name, role title, date of generation, and current status.
3. Applications **shall** be listed in reverse chronological order (most recent first) by default.
4. Each application row **shall** be clickable and **shall** navigate to the detail view for that application.
5. Status **shall** be displayed as a visual chip or badge with distinct styling per status value.
6. The dashboard **shall** display an empty state message when no applications exist.

### Test Plan
| Step | Expected Result |
|------|----------------|
| Log in with existing applications | Dashboard shows list in reverse chronological order |
| Inspect each row | Company, role, date, status badge all visible |
| Log in with no applications | Empty state message shown |
| Click an application row | Navigates to detail view |

---

## Feature 8 — Detail View & Download

### User Story
As a job seeker, I want to view the details of a specific application and download the generated resume and cover letter so that I can submit them.

### Acceptance Criteria
1. The detail view **shall** display: company name, role title, date of generation, current status, and the generated resume and cover letter.
2. The detail view **shall** provide a download button for the resume and a separate download button for the cover letter.
3. Downloaded files **shall** be in a format that preserves formatting (PDF or DOCX).
4. The detail view **shall** include a back navigation to the dashboard.

### Test Plan
| Step | Expected Result |
|------|----------------|
| Open detail view | Company, role, date, status, and both documents visible |
| Click download resume | Resume file downloads with formatting intact |
| Click download cover letter | Cover letter file downloads with formatting intact |
| Click back | Returns to dashboard |

---

## Feature 9 — Status Management

### User Story
As a job seeker, I want to update the status of each application through a defined lifecycle so that I can track where I am in each process.

### Acceptance Criteria
1. Every new application **shall** be automatically set to "Submitted" status on creation.
2. The status lifecycle **must** be: Submitted → In Progress → Completed — forward-only with no ability to move backwards.
3. The detail view **shall** provide a status control that shows the current status and allows the user to advance to the next status only.
4. When status is "Completed", the status control **shall** be disabled — no further changes are possible.
5. Status changes **shall** be saved immediately on selection without requiring a separate save action.

### Test Plan
| Step | Expected Result |
|------|----------------|
| Create new application | Status shows "Submitted" |
| From detail view, advance status to "In Progress" | Status updates immediately to "In Progress" |
| From detail view, advance status to "Completed" | Status updates immediately to "Completed" |
| Inspect status control when "Completed" | Control is disabled; no further options available |
| Attempt to move backwards (e.g. via direct API call) | Firestore security rule or Cloud Function rejects the write |

---

## Feature 10 — Delete Application

### User Story
As a job seeker, I want to permanently delete a job application and all its associated files so that I can remove applications I no longer need.

### Acceptance Criteria
1. The detail view **shall** include a "Delete Application" button.
2. Before deletion, the app **shall** display a confirmation dialog asking the user to confirm the action.
3. On confirmation, the app **must** delete: the Firestore application record, the generated resume file, and the generated cover letter file from Firebase Storage.
4. After deletion, the app **shall** redirect the user to the dashboard.
5. Deletion **must** only be possible by the owning user — enforced at the security rules level.
6. If file deletion fails for any storage file, the app **must** log the error and still delete the Firestore record, ensuring no orphaned records remain.

### Test Plan
| Step | Expected Result |
|------|----------------|
| Click "Delete Application" | Confirmation dialog appears |
| Cancel deletion | Dialog closes; application unchanged |
| Confirm deletion | Application record and both files removed; redirected to dashboard |
| Check dashboard after deletion | Deleted application no longer listed |
| Check Firebase Storage after deletion | Resume and cover letter files gone |
| Attempt deletion as different user (direct API call) | Rejected by security rules |
