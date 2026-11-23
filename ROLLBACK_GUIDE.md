# EXAMLYTIC — PRODUCTION ROLLBACK & SAFE RESTORATION GUIDE

**Project:** Examlytic  
**Implementation Branch:** `reliability-improvements`  
**Base Commit:** `a18106fa`  

---

## Overview

All code modifications in this project branch were designed following non-destructive, backward-compatible principles:
- **No breaking database changes:** All client SQL queries support both the original schema and the enhanced schema (with fallback handling for missing columns or stored procedures).
- **No data deletions:** No examination attempts, answers, recordings, or user profiles were deleted or overwritten.
- **Dedicated Git branch:** All changes reside on the isolated branch `reliability-improvements`.

---

## 1. Quick Git Rollback (Frontend Code)

To immediately restore the frontend and Edge Functions to their exact state before this reliability patch:

```bash
# Ensure working directory is clean
git status

# Switch back to the base branch / commit
git checkout main
# OR to the exact base commit:
git checkout a18106fa
```

To discard all changes on the `reliability-improvements` branch:
```bash
git checkout main
git branch -D reliability-improvements
```

---

## 2. Database Rollback (If SQL Patch Was Executed)

If the user executed `supabase/migrations/20261123_exam_lifecycle_patch.sql` in the Supabase SQL Editor and wishes to revert the schema changes:

```sql
-- Step 1: Drop newly created stored procedures
DROP FUNCTION IF EXISTS public.record_student_heartbeat(UUID, TEXT);

-- Step 2: Drop newly created indexes
DROP INDEX IF EXISTS idx_exam_attempts_status;
DROP INDEX IF EXISTS idx_exam_attempts_exam_status;
DROP INDEX IF EXISTS idx_exam_attempts_student;
DROP INDEX IF EXISTS idx_exam_attempts_last_heartbeat;
DROP INDEX IF EXISTS idx_exam_logs_attempt_id;
DROP INDEX IF EXISTS idx_exam_flags_exam_user;

-- Step 3: Remove newly added columns from exam_attempts
ALTER TABLE public.exam_attempts 
  DROP COLUMN IF EXISTS started_at,
  DROP COLUMN IF EXISTS last_heartbeat_at,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS stream_status;
```

> [!NOTE]
> Reverting the SQL schema does not affect existing `answers`, `score`, `recording_url`, or `completed_at` values in `exam_attempts`.

---

## 3. Deployment Checklist Before Production Release

1. Verify environment variables in `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_LIVEKIT_URL`
   - `VITE_LIVEKIT_API_KEY`
   - `VITE_LIVEKIT_API_SECRET`
   - `VITE_CLOUDINARY_CLOUD_NAME`
   - `VITE_CLOUDINARY_UPLOAD_PRESET`
2. Apply `supabase/migrations/20261123_exam_lifecycle_patch.sql` via Supabase Dashboard SQL Editor when ready.
3. Deploy Edge Function:
   ```bash
   supabase functions deploy rapid-task
   ```
4. Build and deploy frontend:
   ```bash
   npm run build
   ```
