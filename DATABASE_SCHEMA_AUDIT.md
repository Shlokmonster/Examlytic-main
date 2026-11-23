# EXAMLYTIC — DATABASE SCHEMA AUDIT

**Target Instance:** `kedwstnrcciqawkxsmsy.supabase.co`  
**Inspection Date:** 2026-11-23  
**Auditor:** Senior Full-Stack Engineer & Database Architect  
**Method:** PostgREST metadata probes + direct client verification

---

## 1. Verified Live Database Schema

```
========================================================================================
TABLE: users
========================================================================================
Existing Columns:
- id (uuid, primary key)
- created_at (timestamptz)
- email (text)
- role (text, e.g. 'student' or 'admin')
- user_name (text)
- user_avatar (text)
RLS Status: Enabled. Users can query/upsert their own profile; admins can query all.
Missing in DB: full_name (frontend used full_name fallback).

========================================================================================
TABLE: exams
========================================================================================
Existing Columns:
- id (uuid, primary key)
- created_at (timestamptz)
- title (text)
- subject (text)
- instructions (text)
- duration_minutes (integer)
- is_active (boolean)
- questions (jsonb)
- created_by (uuid, foreign key referencing users.id)
- support_email (text)
RLS Status: Enabled.
Missing in DB: instructor_name, description, duration, status, start_time, end_time.
Note: duration_minutes is the canonical column used for exam length.

========================================================================================
TABLE: exam_attempts
========================================================================================
Existing Columns:
- id (uuid, primary key)
- created_at (timestamptz)
- exam_id (uuid, foreign key referencing exams.id)
- student_id (uuid, foreign key referencing users.id)
- answers (jsonb)
- score (numeric)
- submitted_at (timestamptz, NULL for active/unsubmitted)
- completed_at (timestamptz)
- recording_url (text, Cloudinary secure URL)
- cloudinary_public_id (text)
- recording_duration (numeric)
RLS Status: Enabled.
CRITICAL DEFICIENCIES IDENTIFIED:
- started_at: MISSING. (Caused timer to reset on page refresh).
- status: MISSING. (Forced admin dashboard to evaluate submitted_at === null).
- last_heartbeat_at: MISSING. (Prevented detection of interrupted or stalled sessions).
- stream_status: MISSING. (Prevented tracking of LiveKit WebRTC track connectivity).

========================================================================================
TABLE: exam_logs
========================================================================================
Existing Columns:
- id (uuid, primary key)
- created_at (timestamptz)
- exam_attempt_id (uuid, nullable)
- student_id (uuid, foreign key referencing users.id)
- event_type (text)
- event_details (jsonb)
RLS Status: Enabled (Unauthenticated inserts rejected with 42501).
CRITICAL DEFICIENCIES IDENTIFIED:
- exam_attempt_id is NULL for almost all historical rows because ExamAttempt.jsx
  explicitly passed null.
- exam_id is MISSING as a direct column; frontend stuffed exam_id into event_details.

========================================================================================
TABLE: exam_flags
========================================================================================
Existing Columns:
- id (uuid, primary key)
- created_at (timestamptz)
- exam_id (uuid, foreign key referencing exams.id)
- user_id (uuid, foreign key referencing users.id)
- flag_type (text)
- timestamp (timestamptz)
- metadata (jsonb)
RLS Status: Enabled.
CRITICAL DEFICIENCIES IDENTIFIED:
- User column is named user_id (inconsistent with student_id on exam_attempts and exam_logs).
- exam_attempt_id is MISSING.
========================================================================================
```

---

## 2. Backward-Compatible Patch Plan

To guarantee zero data loss and prevent migration crashes:
1. `started_at`, `status`, `last_heartbeat_at`, and `stream_status` must be added with `DEFAULT` values.
2. Backfill existing rows:
   * `started_at = created_at`
   * `status = CASE WHEN submitted_at IS NOT NULL THEN 'completed' WHEN created_at < NOW() - INTERVAL '1 day' THEN 'expired' ELSE 'in_progress' END`
   * `last_heartbeat_at = COALESCE(submitted_at, created_at)`
3. Backfill legacy `exam_logs.exam_attempt_id` using deterministic matching: `l.student_id = a.student_id AND (l.event_details->>'exam_id')::uuid = a.exam_id`.
