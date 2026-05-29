# Manual Setup Steps — Job Application Generator

Everything in this file must be done by hand (cannot be automated). Steps are listed in the order they are needed.

---

## STEP 1 — Firebase Project
**When:** Before T01 | **Where:** [console.firebase.google.com](https://console.firebase.google.com)

1. Click **Add project** → name it → Continue
2. **Upgrade to Blaze plan:** Project Settings → Usage and billing → Modify plan → Blaze → Purchase
3. Enable each product:
   - **Authentication:** Build → Authentication → Get started → Sign-in method → enable **Google** and **Email/Password**
   - **Firestore:** Build → Firestore Database → Create database → production mode → choose region (e.g. `us-central`)
   - **Storage:** Build → Storage → Get started → production mode
   - **Hosting:** Build → Hosting → Get started (click through; no deploy needed yet)
   - **Functions:** Build → Functions → Get started
4. **Get service account JSON:** Project Settings → Service accounts → **Generate new private key** → save the file securely (never commit it — it is gitignored as `*-firebase-adminsdk-*.json`)

---

## STEP 2 — GCP APIs
**When:** Immediately after Firebase project created | **Where:** GCP Console

Replace `<PROJECT_ID>` with your Firebase project ID (`job-application-generato-f6d20`). Enable all 5:

- `console.cloud.google.com/apis/library/cloudfunctions.googleapis.com?project=<PROJECT_ID>`
- `console.cloud.google.com/apis/library/cloudbuild.googleapis.com?project=<PROJECT_ID>`
- `console.cloud.google.com/apis/library/run.googleapis.com?project=<PROJECT_ID>`
- `console.cloud.google.com/apis/library/eventarc.googleapis.com?project=<PROJECT_ID>`
- `console.cloud.google.com/apis/library/cloudbilling.googleapis.com?project=<PROJECT_ID>`

---

## STEP 3 — GCP IAM Roles
**When:** Immediately after GCP APIs | **Where:** `console.cloud.google.com/iam-admin/iam?project=<PROJECT_ID>`

1. Find the service account ending in `@<PROJECT_ID>.iam.gserviceaccount.com`
2. Click the pencil (Edit) icon → **Add another role** — add all 4:
   - Service Usage Consumer
   - Service Account User
   - Cloud Functions Developer
   - **Cloud Run Admin** ← critical; missing this causes CORS errors on all callable functions
3. Save

---

## STEP 4 — Anthropic API Key
**When:** Before T01 | **Where:** [console.anthropic.com](https://console.anthropic.com)

1. Sign in → API Keys → **Create Key** → copy immediately (shown once)
2. Add billing/credits if not already set up (no free tier)

---

## STEP 5 — Google Programmable Search Engine
**When:** Before T09 | **Where:** [programmablesearchengine.google.com](https://programmablesearchengine.google.com)

1. Click **Add** → name it (e.g. `Job App Company Research`) → **Search the entire web** → Create
2. Copy the **Search engine ID**
3. Get API key: GCP Console → Credentials → Create Credentials → API Key → copy
4. Enable Custom Search API: `console.cloud.google.com/apis/library/customsearch.googleapis.com?project=<PROJECT_ID>` → Enable

---

## STEP 6 — GitHub Repo + Secrets
**When:** During T01 | **Where:** GitHub → Settings → Secrets and variables → Actions → New repository secret

Add each secret:

| Secret name | Where to get the value |
|-------------|----------------------|
| `FIREBASE_SERVICE_ACCOUNT` | Full contents of the service account JSON from Step 1 |
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → Your apps → Web app config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Same web app config |
| `VITE_FIREBASE_PROJECT_ID` | Same web app config |
| `VITE_FIREBASE_STORAGE_BUCKET` | Same web app config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Same web app config |
| `VITE_FIREBASE_APP_ID` | Same web app config |
| `ANTHROPIC_API_KEY` | From Step 4 |
| `GOOGLE_SEARCH_API_KEY` | From Step 5 |
| `GOOGLE_SEARCH_ENGINE_ID` | From Step 5 |

> To get Firebase web app config: Firebase Console → Project Settings → scroll to "Your apps" → click the web app (</> icon). If no web app exists yet, click **Add app** → Web → register it first.

---

## STEP 7 — Firebase App Check
**When:** During T20 (near end of project) | **Where:** Firebase Console → Build → App Check

1. Register your site for reCAPTCHA v3 at [google.com/recaptcha/admin](https://www.google.com/recaptcha/admin):
   - Choose **reCAPTCHA v3** → add your domain (e.g. `job-application-generato-f6d20.web.app`) → Submit
   - Copy the **Site key**
2. Firebase Console → Build → App Check → **Get started** → select your web app → Provider: **reCAPTCHA v3** → paste site key → Save
3. Click **Enforce** next to **Cloud Functions** (and optionally Firestore/Storage)
4. Add the site key as a GitHub Actions secret:
   - GitHub → Settings → Secrets and variables → Actions → **New repository secret**
   - Name: `VITE_FIREBASE_APP_CHECK_KEY` → paste the reCAPTCHA v3 site key
5. For local development: when you first run the app with `DEV=true`, the browser console will print a debug token. Add it in Firebase Console → App Check → **Manage debug tokens** → Add token.

---

## STEP 8 — Update OAuth Support Email (T22)
**When:** Once `app_admin@divel.me` is set up on Google Workspace | **Where:** GCP Console → APIs & Services → OAuth consent screen

- Update the **Support email** field to `app_admin@divel.me` → Save

---

## Firebase Project Reference

| Item | Value |
|------|-------|
| Project ID | `job-application-generato-f6d20` |
| Admin contact | `app_admin@divel.me` |
| Service account JSON | `job-application-generato-f6d20-firebase-adminsdk-fbsvc-*.json` (gitignored) |
