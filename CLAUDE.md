# Job Application Generator — Project Context

## What This Is
An AI-powered webapp that generates tailored, ATS-optimised resumes and cover letters for job applications. Users log in, upload their base resume and personal details, then provide a job description + company/role info to generate a custom resume and cover letter. Applications are tracked in a dashboard with status management.

## Tech Stack
- **Frontend:** Vite + React + TypeScript
- **Auth:** Firebase Authentication (Google OAuth + Email/Password — no guest)
- **Database:** Firebase Firestore (user profiles, applications, generated docs)
- **Storage:** Firebase Storage (uploaded base resumes, generated resume/cover letter files)
- **AI Generation:** Claude API via Firebase Cloud Functions (resume + cover letter generation, AI-detection check sub-agent)
- **Company Research:** Google Custom Search API (public company + role information)
- **Hosting:** Firebase Hosting via GitHub Actions

## GitHub Repo
_TODO: add after repo creation_

## Architecture Decisions
- All AI calls go through Firebase Cloud Functions — never expose API keys to the browser
- Personal details (phone, email, city/state) are stored in a private Firestore subcollection with security rules that deny access to all other users and admin reads
- Generated docs stored in Firebase Storage under a path scoped to the user's UID
- Resume and cover letter capped at 2 pages; a sub-agent pass checks for AI-detector flags before finalising
- No backward status transitions: Submitted → In Progress → Completed only
- Company resolution: if multiple companies match the input name, surface disambiguation options before generation proceeds

## Key Rules & Gotchas
- See `/Users/shuvajyotibardhan/Projects/.claude_rules.md` for all global rules
- All Acceptance Criteria must use "shall" (expected behaviour) or "must" (mandatory constraint) only — no other modal verbs
- Never expose real API keys — all secrets in `.env` (gitignored); `.env.example` has placeholders
- Deploy via GitHub Actions only — do NOT use `firebase deploy` from local CLI
- Never ask the user to run git commands manually — always run them yourself

## Global Rules Reference
Rules file: `/Users/shuvajyotibardhan/Projects/.claude_rules.md`
- **Kickoff Folder Structure** — scaffold all root files and docs/ stubs with approval gates before any code
- **Token Savings** — diffs only, no full-file rewrites, check progress.md first, no exploratory terminal commands
- **Documentation** — update REQUIREMENTS, DESIGN, SPECS, TASKS in the same commit as every code change
- **AC Language** — "shall" or "must" only in every Acceptance Criterion
- **progress.md template** — track current task, completed actions, logic context, next step

## Firebase / API Config
See `.env.example` for all required environment variable names.
Firebase project: _TODO: add project ID after creation_
