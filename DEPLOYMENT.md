# EXAMLYTIC — PRODUCTION DEPLOYMENT & ALIGNMENT RUNBOOK

This runbook provides complete, step-by-step instructions to deploy **Examlytic** across GitHub, Supabase (Database + Edge Functions), LiveKit, Cloudinary, and your frontend hosting provider (Vercel, Netlify, or similar).

Following this sequence guarantees that the frontend, backend RPCs, security triggers, and real-time streaming infrastructure remain completely aligned without breaking changes or downtime.

---

## ARCHITECTURAL OVERVIEW & DEPLOYMENT STACK

- **Frontend:** React 19 + Vite 7 + React Router 7 (SPA)
- **Database & Auth:** Supabase PostgreSQL + Supabase Auth + Supabase Realtime
- **Serverless Backend:** Supabase Edge Functions (Deno / TypeScript)
- **Live Video Streaming:** LiveKit Cloud (WebRTC)
- **Media & Recordings:** Cloudinary (Unsigned upload)
- **AI Question Generation:** Groq API

---

## PRE-FLIGHT VERIFICATION CHECKLIST

Before deploying, verify that your local environment is healthy and all automated tests pass:

```bash
# 1. Run all 49 automated unit, security, and concurrency tests
npm test

# 2. Check for code syntax and lint issues (must have 0 errors, 0 warnings)
npx eslint src/

# 3. Test production bundle build
npm run build
```

Expected result:
- **49/49 tests passing** across 10 test suites.
- **0 errors, 0 warnings** in ESLint.
- Vite build completes cleanly and generates output in `./dist/`.

---

## PHASE 1: GITHUB REPOSITORY PUSH & MERGE

Your remediation work is currently committed to branch `reliability-improvements`.

### Option A: Push Feature Branch to GitHub (Recommended for PR Review)

```bash
# 1. Ensure you are on the reliability-improvements branch
git checkout reliability-improvements

# 2. Verify git status is clean
git status

# 3. Push the branch to GitHub
git push -u origin reliability-improvements
```

Then visit [GitHub](https://github.com/Shlokmonster/Examlytic-main) to open a Pull Request into `main`.

### Option B: Merge Directly into `main` and Push

If you prefer to deploy straight to production:

```bash
# 1. Switch to main
git checkout main

# 2. Pull latest upstream changes
git pull origin main

# 3. Merge the reliability improvements
git merge reliability-improvements -m "feat(release): merge comprehensive reliability and security hardening"

# 4. Push to GitHub main branch
git push origin main

# 5. Return to feature branch (optional)
git checkout reliability-improvements
```

---

## PHASE 2: SUPABASE DATABASE MIGRATION

> [!IMPORTANT]
> The database migration is backward-compatible and non-destructive. It does not drop existing examination records, answers, or logs.

### Step 1: Pre-Migration Diagnostics (Optional Verification)
In your [Supabase Dashboard](https://supabase.com/dashboard) > **SQL Editor**, run:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'exam_attempts' 
ORDER BY ordinal_position;

SELECT proname, prorettype::regtype, prosecdef 
FROM pg_proc 
WHERE proname IN ('record_student_heartbeat', 'get_student_exam_questions_v1', 'submit_student_exam_attempt_v1');
```

### Step 2: Apply the Hardening Migration
1. Open the migration file: [`supabase/migrations/20261123_exam_security_reliability_hardening.sql`](file:///Users/shlokkadam/Developer/Examlytic-main/supabase/migrations/20261123_exam_security_reliability_hardening.sql).
2. Copy its entire content.
3. In the Supabase Dashboard, open **SQL Editor** > **New query**.
4. Paste the SQL script and click **Run**.
5. Confirm output displays: `Success. No rows returned`.

### What This Migration Activates:
- `record_student_heartbeat` (v1): Preserves `RETURNS VOID`, locks row, validates student ownership, prevents reviving terminal sessions, restores interrupted sessions.
- `record_student_heartbeat_v2`: Returns rich `JSONB` with remaining time calculation.
- `get_student_exam_questions_v1`: Requires an active, in-progress attempt for students; strips all answer keys and explanations before JSON delivery.
- `save_student_answers_v1`: Atomic, safe RPC for autosaving answers.
- `submit_student_exam_attempt_v1`: Atomic server-side grading, deadline enforcement, row locking (`FOR UPDATE`), and duplicate submission protection.
- Triggers:
  - `trg_protect_exam_attempts`: Blocks direct manipulation of `score`, `status`, `started_at`, `submitted_at`, and `last_heartbeat_at`.
  - `trg_protect_user_role` & `trg_enforce_user_default_role`: Blocks privilege self-elevation to `admin` on both `INSERT` and `UPDATE`.
  - `trg_validate_exam_flag_audit` & `trg_validate_exam_log_audit`: Validates attempt ownership and makes audit records immutable.
- Permissions: Revokes `PUBLIC` and `anon` execution rights on all SECURITY DEFINER functions.

---

## PHASE 3: SUPABASE EDGE FUNCTION DEPLOYMENT

The Edge Function at `supabase/functions/rapid-task/index.ts` generates LiveKit tokens with caller JWT verification and publisher room isolation.

### Step 1: Set Required Secrets in Supabase
In Supabase Dashboard, go to **Project Settings** > **Edge Functions** > **Secrets** (or via CLI) and ensure these secrets are set:

| Secret Name | Purpose | Example / Format |
|---|---|---|
| `LIVEKIT_API_KEY` | LiveKit Cloud API Key | `APIn7x...` |
| `LIVEKIT_API_SECRET` | LiveKit Cloud API Secret | `sec_98x...` |
| `LIVEKIT_URL` | LiveKit WebSocket URL | `wss://<project>.livekit.cloud` |
| `SUPABASE_URL` | Supabase Project URL | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase Anon Public Key | `eyJhb...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | `eyJhb...` (used strictly inside function to check admin role) |

### Step 2: Deploy Edge Function via Supabase CLI
```bash
# 1. Authenticate Supabase CLI (if not already logged in)
supabase login

# 2. Deploy rapid-task function
supabase functions deploy rapid-task --project-ref <your-supabase-project-id>
```

Verify in Supabase Dashboard under **Edge Functions** that `rapid-task` is listed with status **Active**.

---

## PHASE 4: CLIENT-SIDE DEPLOYMENT ON NETLIFY

Examlytic is fully pre-configured for Netlify with [`netlify.toml`](file:///Users/shlokkadam/Developer/Examlytic-main/netlify.toml) and [`public/_redirects`](file:///Users/shlokkadam/Developer/Examlytic-main/public/_redirects).

### Step 1: Configure Environment Variables in Netlify
In your [Netlify Dashboard](https://app.netlify.com/):
1. Navigate to your site > **Site configuration** > **Environment variables**.
2. Add the following variables (choose **All scopes / Production**):

| Key | Description | Source |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase Project URL | Supabase Dashboard > Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anon public key | Supabase Dashboard > Settings > API |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Cloudinary Dashboard |
| `VITE_CLOUDINARY_UPLOUD_PRESET` | Cloudinary unsigned preset | Cloudinary Settings > Upload > Upload Presets |
| `VITE_GROQ_API_KEY` | Groq AI API Key | Groq Console |

### Step 2: Build & Deployment Settings
Netlify will automatically detect [`netlify.toml`](file:///Users/shlokkadam/Developer/Examlytic-main/netlify.toml). Verify under **Build & deploy**:
- **Base directory:** (leave empty / root)
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Node version:** `20` (set automatically in `netlify.toml`)

### Step 3: Trigger the Netlify Deployment
- **Via GitHub (Auto-Deploy):**
  Once you push your code to the connected GitHub branch (e.g. `main` or `reliability-improvements`), Netlify automatically starts building and publishes the site.
- **Via Netlify CLI (Manual Terminal Deploy):**
  ```bash
  # 1. Login to Netlify
  npx netlify login

  # 2. Build and deploy to production
  npm run build
  npx netlify deploy --prod --dir=dist
  ```

### Step 4: Verify Single Page App (SPA) Routing & Permissions
The repository includes automated redirect rules so that:
- Refreshing URLs like `/exam/:id` or navigating to `/admin` serves `index.html` without returning `404 Not Found`.
- Camera, microphone, and display capture permissions are explicitly allowed by Netlify headers (`Permissions-Policy`) for seamless webcam proctoring.

---

## PHASE 5: POST-DEPLOYMENT SMOKE TEST & VERIFICATION

After deployment, perform these 5 quick verification checks in your live environment:

### 1. Student Examination Flow
1. Log in as a student user.
2. Join an active exam using its exam code or URL.
3. Open Developer Tools > **Network tab**:
   - Inspect the `get_student_exam_questions_v1` response: Verify that `correct_answer` is **NOT present** in the questions JSON.
4. Select options across questions:
   - Check that `autoSaveAnswers` successfully updates without errors.
5. Submit the exam:
   - Confirm server-side scoring calculates and saves your score.
   - Confirm attempt status transitions to `completed`.
   - Confirm redirect to `/exam/:id/done` displays the final score and answer summary.

### 2. Proctoring & Live Video Stream
1. In the student exam view:
   - Verify webcam preview displays.
   - Verify LiveKit token request succeeds with `200 OK`.
2. In the Admin Dashboard:
   - Open **Live Monitoring**.
   - Verify student's video stream connects and renders.
   - Verify participant name displays properly without UUID truncation.

### 3. Session Interruption & Refresh Test
1. While taking an exam as a student, refresh the browser tab.
2. Verify:
   - The remaining timer is preserved accurately based on wall-clock time (does not reset).
   - Saved answers are automatically reloaded.
   - Attempt status returns to `in_progress`.

### 4. Admin Dashboard Real-Time Tracking
1. Log in as an administrator.
2. Open the **Admin Dashboard** (`/admin`).
3. Verify:
   - Active, Interrupted, and Completed attempts appear in their correct tabs.
   - Real-time updates occur when students start or submit exams.
   - Individual student timeline drawer displays flags and timestamps properly.

---

## ROLLBACK PROCEDURES

If an unexpected issue arises in production, use these rollback procedures:

### A. Frontend Rollback
- **Vercel / Netlify:** Navigate to **Deployments** > click on the previously working deployment > click **Instant Rollback**.
- **Git Rollback:**
  ```bash
  git checkout main
  git revert HEAD -m "revert: rollback to previous production build"
  git push origin main
  ```

### B. Database Rollback
The hardening migration is additive (it adds triggers, RPC functions, and validation checks without dropping tables or columns). To temporarily disable the triggers if needed:
```sql
-- Disable triggers temporarily
DROP TRIGGER IF EXISTS trg_protect_exam_attempts ON public.exam_attempts;
DROP TRIGGER IF EXISTS trg_protect_user_role ON public.users;
DROP TRIGGER IF EXISTS trg_enforce_user_default_role ON public.users;
DROP TRIGGER IF EXISTS trg_validate_exam_flag_audit ON public.exam_flags;
DROP TRIGGER IF EXISTS trg_validate_exam_log_audit ON public.exam_logs;
```

---

## QUICK REFERENCE COMMANDS

| Action | Command |
|---|---|
| Run Test Suite | `npm test` |
| Check Code Style | `npx eslint src/` |
| Build Production App | `npm run build` |
| Push Branch to GitHub | `git push -u origin reliability-improvements` |
| Deploy Edge Function | `supabase functions deploy rapid-task --project-ref <project-id>` |

