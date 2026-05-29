# Job Application Generator

AI-powered webapp that generates tailored resumes and cover letters for job applications.

## Setup

1. Clone the repo
2. Run `npm install`
3. Copy `.env.example` to `.env` and fill in all values
4. Run `npm run dev`

## Tech Stack

- Vite + React + TypeScript
- Firebase Auth, Firestore, Storage
- Claude API (resume/cover letter generation + AI-detection check)
- Google Custom Search API (company research)
- GitHub Actions (CI/CD → Firebase Hosting)
