-- ==============================================================================
-- EXAMLYTIC — PRODUCTION SECURITY, RELIABILITY & COMPATIBILITY HARDENING (REV 2)
-- Migration: 20261123_exam_security_reliability_hardening.sql
-- 
-- IMPORTANT:
-- This migration is incremental, non-destructive, and safe for production databases
-- where 20261123_exam_lifecycle_patch.sql has ALREADY been executed.
--
-- 1. Does NOT drop existing tables or delete existing examination data.
-- 2. Preserves record_student_heartbeat(UUID, VARCHAR) signature (RETURNS VOID)
--    to prevent PostgreSQL error 42P13 ("cannot change return type of existing function").
-- 3. Implements strict field-level update protection for exam_attempts, ensuring
--    students cannot alter score, status, submitted_at, completed_at, started_at,
--    or last_heartbeat_at, while allowing legitimate answer autosaving.
-- 4. Validates caller ownership and active attempt state in get_student_exam_questions_v1
--    and strips all sensitive fields (correct_answer, explanations, answer_keys).
-- 5. Implements server-side grading, deadline enforcement, and duplicate protection
--    in submit_student_exam_attempt_v1 with FOR UPDATE row locks.
-- 6. Enforces user role protection on both INSERT and UPDATE.
-- 7. Enforces exam_flags and exam_logs ownership and makes audit records immutable.
-- 8. Explicitly revokes PUBLIC and anon execution permissions from all SECURITY DEFINER functions.
-- ==============================================================================

-- ==============================================================================
-- DIAGNOSTIC & VERIFICATION QUERIES (READ-ONLY)
-- Run these before applying to verify current production schema state:
--
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'exam_attempts' 
-- ORDER BY ordinal_position;
--
-- SELECT proname, prorettype::regtype, prosecdef 
-- FROM pg_proc 
-- WHERE proname IN ('record_student_heartbeat', 'get_student_exam_questions_v1', 'submit_student_exam_attempt_v1');
-- ==============================================================================


-- ==============================================================================
-- 1. HARDEN EXISTING record_student_heartbeat (RETURNS VOID - PRESERVES SIGNATURE)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_student_heartbeat(
  p_attempt_id UUID,
  p_stream_status VARCHAR DEFAULT 'STREAM_CONNECTED'
)
RETURNS VOID AS $$
DECLARE
  v_caller_id UUID;
  v_student_id UUID;
  v_status VARCHAR(32);
  v_started_at TIMESTAMPTZ;
  v_duration_min INT;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_deadline TIMESTAMPTZ;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit heartbeats.' USING ERRCODE = '42501';
  END IF;

  -- Validate stream status allowlist
  IF p_stream_status NOT IN ('STREAM_NOT_STARTED', 'STREAM_CONNECTED', 'STREAM_RECONNECTING', 'STREAM_DISCONNECTED') THEN
    p_stream_status := 'STREAM_CONNECTED';
  END IF;

  -- Lock attempt row to serialize with submissions and concurrent requests
  SELECT a.student_id, a.status, a.started_at, COALESCE(e.duration_minutes, 90)
  INTO v_student_id, v_status, v_started_at, v_duration_min
  FROM public.exam_attempts a
  JOIN public.exams e ON e.id = a.exam_id
  WHERE a.id = p_attempt_id
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam attempt not found' USING ERRCODE = 'P0002';
  END IF;

  -- Strict student ownership validation:
  -- Administrative monitoring does NOT mutate the student's heartbeat or lifecycle.
  IF v_student_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: Heartbeat can only be submitted by the student assigned to this attempt.' USING ERRCODE = '42501';
  END IF;

  -- Never revive terminal states
  IF v_status IN ('completed', 'expired', 'terminated', 'abandoned') THEN
    RETURN;
  END IF;

  -- Server-authoritative deadline check
  v_deadline := v_started_at + (v_duration_min * INTERVAL '1 minute');
  IF v_now > v_deadline THEN
    UPDATE public.exam_attempts
    SET status = 'expired',
        last_heartbeat_at = v_now,
        stream_status = 'STREAM_DISCONNECTED'
    WHERE id = p_attempt_id;
    RETURN;
  END IF;

  -- Update heartbeat and explicitly recover interrupted sessions to in_progress
  UPDATE public.exam_attempts
  SET last_heartbeat_at = v_now,
      stream_status = p_stream_status,
      status = 'in_progress'
  WHERE id = p_attempt_id
    AND status IN ('in_progress', 'interrupted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.record_student_heartbeat(UUID, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_student_heartbeat(UUID, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_student_heartbeat(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_student_heartbeat(UUID, VARCHAR) TO service_role;


-- ==============================================================================
-- 2. VERSIONED HEARTBEAT RPC (record_student_heartbeat_v2 - RETURNS JSONB)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_student_heartbeat_v2(
  p_attempt_id UUID,
  p_stream_status VARCHAR DEFAULT 'STREAM_CONNECTED'
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_student_id UUID;
  v_status VARCHAR(32);
  v_started_at TIMESTAMPTZ;
  v_duration_min INT;
  v_deadline TIMESTAMPTZ;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_remaining_sec INT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_stream_status NOT IN ('STREAM_NOT_STARTED', 'STREAM_CONNECTED', 'STREAM_RECONNECTING', 'STREAM_DISCONNECTED') THEN
    p_stream_status := 'STREAM_CONNECTED';
  END IF;

  -- Lock attempt row to serialize updates
  SELECT a.student_id, a.status, a.started_at, COALESCE(e.duration_minutes, 90)
  INTO v_student_id, v_status, v_started_at, v_duration_min
  FROM public.exam_attempts a
  JOIN public.exams e ON e.id = a.exam_id
  WHERE a.id = p_attempt_id
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam attempt not found' USING ERRCODE = 'P0002';
  END IF;

  -- Separate student heartbeat from admin monitoring
  IF v_student_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: Heartbeat can only be submitted by the student assigned to this attempt.' USING ERRCODE = '42501';
  END IF;

  -- Terminal state check
  IF v_status IN ('completed', 'expired', 'terminated', 'abandoned') THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', v_status,
      'message', 'Session is in terminal state.',
      'remaining_seconds', 0
    );
  END IF;

  v_deadline := v_started_at + (v_duration_min * INTERVAL '1 minute');
  v_remaining_sec := GREATEST(0, EXTRACT(EPOCH FROM (v_deadline - v_now))::INT);

  -- Authoritative deadline check
  IF v_now > v_deadline THEN
    UPDATE public.exam_attempts
    SET status = 'expired',
        last_heartbeat_at = v_now,
        stream_status = 'STREAM_DISCONNECTED'
    WHERE id = p_attempt_id;

    RETURN jsonb_build_object(
      'success', false,
      'status', 'expired',
      'remaining_seconds', 0,
      'message', 'Exam duration has elapsed.'
    );
  END IF;

  -- Recover interrupted state to in_progress
  UPDATE public.exam_attempts
  SET last_heartbeat_at = v_now,
      stream_status = p_stream_status,
      status = 'in_progress'
  WHERE id = p_attempt_id
    AND status IN ('in_progress', 'interrupted');

  RETURN jsonb_build_object(
    'success', true,
    'status', 'in_progress',
    'remaining_seconds', v_remaining_sec,
    'last_heartbeat_at', v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.record_student_heartbeat_v2(UUID, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_student_heartbeat_v2(UUID, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_student_heartbeat_v2(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_student_heartbeat_v2(UUID, VARCHAR) TO service_role;


-- ==============================================================================
-- 3. SANITIZED QUESTION DELIVERY RPC (get_student_exam_questions_v1)
-- Requires active attempt in allowed state; strips all answer/grading metadata.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_student_exam_questions_v1(
  p_exam_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_exam RECORD;
  v_sanitized_questions JSONB := '[]'::jsonb;
  v_q JSONB;
  v_idx INT := 0;
  v_has_active_attempt BOOLEAN := FALSE;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Check if caller is admin
  SELECT (role = 'admin') INTO v_is_admin FROM public.users WHERE id = v_caller_id;

  -- Verify exam exists and is available
  SELECT id, title, subject, instructions, duration_minutes, is_active, questions
  INTO v_exam
  FROM public.exams
  WHERE id = p_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_is_admin THEN
    -- Verify exam is active
    IF v_exam.is_active IS FALSE THEN
      RAISE EXCEPTION 'Exam is currently unavailable or inactive.' USING ERRCODE = '42501';
    END IF;

    -- Verify caller has an authorized attempt in an allowed active state
    SELECT EXISTS (
      SELECT 1 FROM public.exam_attempts
      WHERE exam_id = p_exam_id
        AND student_id = v_caller_id
        AND status IN ('in_progress', 'interrupted')
        AND submitted_at IS NULL
    ) INTO v_has_active_attempt;

    IF NOT v_has_active_attempt THEN
      RAISE EXCEPTION 'Access denied: You do not have an active in-progress attempt for this examination.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- If admin, return full questions with answer keys for management
  IF v_is_admin THEN
    v_sanitized_questions := v_exam.questions;
  ELSE
    -- For students, sanitize question objects: remove correct_answer, answer keys, explanations
    IF v_exam.questions IS NOT NULL AND jsonb_typeof(v_exam.questions) = 'array' THEN
      FOR v_q IN SELECT * FROM jsonb_array_elements(v_exam.questions)
      LOOP
        v_idx := v_idx + 1;
        -- Strip every sensitive answer, key, or grading explanation field
        v_q := v_q - 'correct_answer' 
                   - 'correctAnswer' 
                   - 'answer' 
                   - 'expected_answer' 
                   - 'expectedAnswer'
                   - 'answer_key' 
                   - 'answerKey' 
                   - 'explanation' 
                   - 'solution'
                   - 'grading_rubric' 
                   - 'points_breakdown';
        
        -- Ensure an id exists for frontend option tracking
        IF (v_q->>'id') IS NULL THEN
          v_q := jsonb_set(v_q, '{id}', to_jsonb('q-' || (v_idx - 1)::text));
        END IF;

        v_sanitized_questions := v_sanitized_questions || jsonb_build_array(v_q);
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_exam.id,
    'title', v_exam.title,
    'subject', v_exam.subject,
    'instructions', v_exam.instructions,
    'duration_minutes', v_exam.duration_minutes,
    'is_active', v_exam.is_active,
    'questions', v_sanitized_questions
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_student_exam_questions_v1(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_exam_questions_v1(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_student_exam_questions_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_exam_questions_v1(UUID) TO service_role;


-- ==============================================================================
-- 4. ATOMIC ANSWER AUTOSAVING RPC (save_student_answers_v1)
-- Safe, validated answer autosaving without direct lifecycle manipulation
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.save_student_answers_v1(
  p_attempt_id UUID,
  p_answers JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_attempt RECORD;
  v_duration_min INT;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_deadline TIMESTAMPTZ;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'Answers payload must be a valid JSON object.' USING ERRCODE = '22023';
  END IF;

  SELECT a.id, a.student_id, a.started_at, a.status, a.submitted_at, COALESCE(e.duration_minutes, 90) as duration_minutes
  INTO v_attempt
  FROM public.exam_attempts a
  JOIN public.exams e ON e.id = a.exam_id
  WHERE a.id = p_attempt_id
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_attempt.student_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only save answers for your own attempt.' USING ERRCODE = '42501';
  END IF;

  IF v_attempt.status IN ('completed', 'expired', 'terminated', 'abandoned') OR v_attempt.submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot update answers on a closed or submitted attempt.' USING ERRCODE = '42501';
  END IF;

  v_deadline := v_attempt.started_at + (v_attempt.duration_minutes * INTERVAL '1 minute');
  IF v_now > v_deadline THEN
    UPDATE public.exam_attempts
    SET status = 'expired',
        last_heartbeat_at = v_now,
        stream_status = 'STREAM_DISCONNECTED'
    WHERE id = p_attempt_id;

    RAISE EXCEPTION 'Exam deadline has expired. Answers cannot be saved.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.exam_attempts
  SET answers = p_answers,
      last_heartbeat_at = v_now
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'success', true,
    'saved_at', v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.save_student_answers_v1(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_student_answers_v1(UUID, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_student_answers_v1(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_student_answers_v1(UUID, JSONB) TO service_role;


-- ==============================================================================
-- 5. SERVER-AUTHORITATIVE SUBMISSION RPC (submit_student_exam_attempt_v1)
-- Enforces deadline, serializes submissions, validates question keys, calculates score.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.submit_student_exam_attempt_v1(
  p_attempt_id UUID,
  p_answers JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_attempt RECORD;
  v_duration_min INT;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_deadline TIMESTAMPTZ;
  v_correct_count INT := 0;
  v_total_questions INT := 0;
  v_calculated_score NUMERIC(5, 2) := 0.00;
  v_q JSONB;
  v_idx INT := 0;
  v_qid TEXT;
  v_correct_ans TEXT;
  v_student_ans TEXT;
  v_is_expired BOOLEAN := FALSE;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Lock attempt row to serialize concurrent submissions
  SELECT a.id, a.student_id, a.exam_id, a.started_at, a.status, a.submitted_at, a.score,
         COALESCE(e.duration_minutes, 90) as duration_minutes, e.questions
  INTO v_attempt
  FROM public.exam_attempts a
  JOIN public.exams e ON e.id = a.exam_id
  WHERE a.id = p_attempt_id
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam attempt not found' USING ERRCODE = 'P0002';
  END IF;

  -- Validate ownership
  IF v_attempt.student_id <> v_caller_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_caller_id AND role = 'admin') THEN
      RAISE EXCEPTION 'Unauthorized: You cannot submit another student''s exam.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Prevent duplicate submissions: return existing result cleanly
  IF v_attempt.submitted_at IS NOT NULL OR v_attempt.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_submitted', true,
      'status', 'completed',
      'score', v_attempt.score,
      'submitted_at', v_attempt.submitted_at,
      'message', 'Exam was already submitted.'
    );
  END IF;

  -- Reject already expired or terminated attempts
  IF v_attempt.status IN ('expired', 'terminated', 'abandoned') THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', v_attempt.status,
      'error', 'ATTEMPT_CLOSED',
      'message', 'Exam session is closed and cannot be submitted.'
    );
  END IF;

  -- Validate deadline from real started_at and duration_minutes (with 60-second network grace)
  v_duration_min := v_attempt.duration_minutes;
  v_deadline := v_attempt.started_at + (v_duration_min * INTERVAL '1 minute');

  IF v_now > (v_deadline + INTERVAL '1 minute') THEN
    -- Mark attempt as expired
    UPDATE public.exam_attempts
    SET status = 'expired',
        last_heartbeat_at = v_now,
        stream_status = 'STREAM_DISCONNECTED'
    WHERE id = p_attempt_id;

    RETURN jsonb_build_object(
      'success', false,
      'status', 'expired',
      'error', 'EXAM_EXPIRED',
      'message', 'The examination deadline has passed. Submission rejected.'
    );
  END IF;

  -- Validate answer payload structure
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    p_answers := '{}'::jsonb;
  END IF;

  -- Calculate score server-side from authoritative question keys
  IF v_attempt.questions IS NOT NULL AND jsonb_typeof(v_attempt.questions) = 'array' THEN
    v_total_questions := jsonb_array_length(v_attempt.questions);
    
    FOR v_q IN SELECT * FROM jsonb_array_elements(v_attempt.questions)
    LOOP
      v_idx := v_idx + 1;
      
      -- Support both explicit 'id' and index-based 'q-0' IDs from frontend
      v_qid := COALESCE(v_q->>'id', 'q-' || (v_idx - 1)::text);
      
      -- Extract authoritative correct answer
      v_correct_ans := UPPER(TRIM(COALESCE(
        v_q->>'correct_answer',
        v_q->>'correctAnswer',
        v_q->>'answer',
        v_q->>'expected_answer',
        ''
      )));
      
      -- Extract student answer using either exact ID or fallback index
      v_student_ans := UPPER(TRIM(COALESCE(
        p_answers->>v_qid,
        p_answers->>('q-' || (v_idx - 1)::text),
        p_answers->>(v_idx - 1)::text,
        ''
      )));

      -- Determine correctness:
      -- Handle multiple choice (options A, B, C, D) or direct value comparison
      IF v_correct_ans <> '' AND v_student_ans <> '' THEN
        IF v_student_ans = v_correct_ans THEN
          v_correct_count := v_correct_count + 1;
        ELSIF v_q->>'type' = 'mcq' THEN
          -- Check if student supplied full text matching the option
          IF (v_correct_ans = 'A' AND UPPER(TRIM(COALESCE(v_q->>'optionA', ''))) = v_student_ans) OR
             (v_correct_ans = 'B' AND UPPER(TRIM(COALESCE(v_q->>'optionB', ''))) = v_student_ans) OR
             (v_correct_ans = 'C' AND UPPER(TRIM(COALESCE(v_q->>'optionC', ''))) = v_student_ans) OR
             (v_correct_ans = 'D' AND UPPER(TRIM(COALESCE(v_q->>'optionD', ''))) = v_student_ans) THEN
            v_correct_count := v_correct_count + 1;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF v_total_questions > 0 THEN
    v_calculated_score := ROUND((v_correct_count::numeric / v_total_questions::numeric) * 100.0, 2);
  ELSE
    v_calculated_score := 0.00;
  END IF;

  -- Commit submission atomically
  UPDATE public.exam_attempts
  SET answers = p_answers,
      score = v_calculated_score,
      status = 'completed',
      submitted_at = v_now,
      completed_at = v_now,
      last_heartbeat_at = v_now,
      stream_status = 'STREAM_DISCONNECTED'
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'score', v_calculated_score,
    'correct_count', v_correct_count,
    'total_questions', v_total_questions,
    'submitted_at', v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.submit_student_exam_attempt_v1(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_student_exam_attempt_v1(UUID, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_student_exam_attempt_v1(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_student_exam_attempt_v1(UUID, JSONB) TO service_role;


-- ==============================================================================
-- 6. STRICT FIELD-LEVEL PROTECTION TRIGGER ON exam_attempts
-- Prevents student direct mutation of sensitive columns:
-- score, status, submitted_at, completed_at, started_at, last_heartbeat_at,
-- exam_id, student_id.
-- Allows legitimate answer autosaving and recording metadata attachments.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.protect_exam_attempts_update()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- Service role always bypasses
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Check if caller is admin
  IF v_caller_id IS NOT NULL THEN
    SELECT (role = 'admin') INTO v_is_admin FROM public.users WHERE id = v_caller_id;
  END IF;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- For non-admin student callers:
  -- 1. Immutable relationship fields
  IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'Permission denied: Cannot reassign student_id on an exam attempt.' USING ERRCODE = '42501';
  END IF;

  IF NEW.exam_id IS DISTINCT FROM OLD.exam_id THEN
    RAISE EXCEPTION 'Permission denied: Cannot reassign exam_id on an exam attempt.' USING ERRCODE = '42501';
  END IF;

  IF NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    RAISE EXCEPTION 'Permission denied: Exam start timestamp is immutable.' USING ERRCODE = '42501';
  END IF;

  -- 2. Server-controlled lifecycle and scoring fields
  IF NEW.score IS DISTINCT FROM OLD.score THEN
    RAISE EXCEPTION 'Permission denied: Students cannot directly alter examination scores. Must submit through server RPC.' USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Permission denied: Students cannot directly alter lifecycle status. Must use heartbeat or submission RPC.' USING ERRCODE = '42501';
  END IF;

  IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
    RAISE EXCEPTION 'Permission denied: Direct modification of submitted_at timestamp is prohibited.' USING ERRCODE = '42501';
  END IF;

  IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    RAISE EXCEPTION 'Permission denied: Direct modification of completed_at timestamp is prohibited.' USING ERRCODE = '42501';
  END IF;

  IF NEW.last_heartbeat_at IS DISTINCT FROM OLD.last_heartbeat_at THEN
    RAISE EXCEPTION 'Permission denied: Direct modification of last_heartbeat_at is prohibited. Use heartbeat RPC.' USING ERRCODE = '42501';
  END IF;

  -- 3. If attempt was already terminal, answers cannot be altered
  IF OLD.status IN ('completed', 'expired', 'terminated', 'abandoned') OR OLD.submitted_at IS NOT NULL THEN
    IF NEW.answers IS DISTINCT FROM OLD.answers THEN
      RAISE EXCEPTION 'Permission denied: Cannot modify answers on a closed or submitted exam attempt.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_exam_attempts ON public.exam_attempts;
CREATE TRIGGER trg_protect_exam_attempts
  BEFORE UPDATE ON public.exam_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_exam_attempts_update();


-- ==============================================================================
-- 7. USER ROLE PROTECTION (ON users TABLE FOR BOTH INSERT AND UPDATE)
-- ==============================================================================

-- A. Prevent role modification on UPDATE
CREATE OR REPLACE FUNCTION public.protect_user_role_elevation()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF v_caller_id IS NOT NULL THEN
    SELECT (role = 'admin') INTO v_is_admin FROM public.users WHERE id = v_caller_id;
  END IF;

  IF NOT v_is_admin AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Unauthorized: Users cannot modify their security authorization role.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_user_role ON public.users;
CREATE TRIGGER trg_protect_user_role
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_role_elevation();


-- B. Enforce default 'student' role on INSERT
CREATE OR REPLACE FUNCTION public.enforce_new_user_default_role()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF v_caller_id IS NOT NULL THEN
    SELECT (role = 'admin') INTO v_is_admin FROM public.users WHERE id = v_caller_id;
  END IF;

  -- If non-admin registers or inserts, always enforce 'student' role
  IF NOT v_is_admin THEN
    NEW.role := 'student';
  ELSIF NEW.role IS NULL THEN
    NEW.role := 'student';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_user_default_role ON public.users;
CREATE TRIGGER trg_enforce_user_default_role
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_new_user_default_role();


-- ==============================================================================
-- 8. AUDIT RECORD OWNERSHIP & IMMUTABILITY (ON exam_flags AND exam_logs)
-- Validates user_id / student_id, attempt ownership, and prevents mutation/deletion.
-- ==============================================================================

-- Flags trigger: validates ownership on INSERT, blocks UPDATE and DELETE for students
CREATE OR REPLACE FUNCTION public.validate_exam_flag_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
  v_attempt_student UUID;
  v_attempt_exam UUID;
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF v_caller_id IS NOT NULL THEN
    SELECT (role = 'admin') INTO v_is_admin FROM public.users WHERE id = v_caller_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Audit records are immutable and cannot be deleted.' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Audit records are immutable and cannot be modified.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- On INSERT:
  IF NOT v_is_admin THEN
    IF v_caller_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required to submit flags.' USING ERRCODE = '42501';
    END IF;
    
    -- Force or verify ownership
    IF NEW.user_id IS NOT NULL AND NEW.user_id <> v_caller_id THEN
      RAISE EXCEPTION 'Cannot insert flags on behalf of another user.' USING ERRCODE = '42501';
    END IF;
    NEW.user_id := v_caller_id;

    -- Validate referenced attempt ownership
    IF NEW.exam_attempt_id IS NOT NULL THEN
      SELECT student_id, exam_id INTO v_attempt_student, v_attempt_exam
      FROM public.exam_attempts
      WHERE id = NEW.exam_attempt_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced examination attempt not found.' USING ERRCODE = 'P0002';
      END IF;

      IF v_attempt_student <> v_caller_id THEN
        RAISE EXCEPTION 'Cannot attach flags to another student''s examination attempt.' USING ERRCODE = '42501';
      END IF;

      IF NEW.exam_id IS NOT NULL AND NEW.exam_id <> v_attempt_exam THEN
        RAISE EXCEPTION 'Exam ID does not match attempt exam ID.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_exam_flag_audit ON public.exam_flags;
CREATE TRIGGER trg_validate_exam_flag_audit
  BEFORE INSERT OR UPDATE OR DELETE ON public.exam_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_exam_flag_audit();


-- Logs trigger: validates ownership on INSERT, blocks UPDATE and DELETE for students
CREATE OR REPLACE FUNCTION public.validate_exam_log_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
  v_attempt_student UUID;
  v_attempt_exam UUID;
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF v_caller_id IS NOT NULL THEN
    SELECT (role = 'admin') INTO v_is_admin FROM public.users WHERE id = v_caller_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Audit logs are immutable and cannot be deleted.' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Audit logs are immutable and cannot be modified.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- On INSERT:
  IF NOT v_is_admin THEN
    IF v_caller_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required to submit logs.' USING ERRCODE = '42501';
    END IF;

    -- Force or verify ownership
    IF NEW.student_id IS NOT NULL AND NEW.student_id <> v_caller_id THEN
      RAISE EXCEPTION 'Cannot insert logs on behalf of another student.' USING ERRCODE = '42501';
    END IF;
    NEW.student_id := v_caller_id;

    -- Validate referenced attempt ownership
    IF NEW.exam_attempt_id IS NOT NULL THEN
      SELECT student_id, exam_id INTO v_attempt_student, v_attempt_exam
      FROM public.exam_attempts
      WHERE id = NEW.exam_attempt_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced examination attempt not found.' USING ERRCODE = 'P0002';
      END IF;

      IF v_attempt_student <> v_caller_id THEN
        RAISE EXCEPTION 'Cannot attach logs to another student''s examination attempt.' USING ERRCODE = '42501';
      END IF;

      IF NEW.exam_id IS NOT NULL AND NEW.exam_id <> v_attempt_exam THEN
        RAISE EXCEPTION 'Exam ID does not match attempt exam ID.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_exam_log_audit ON public.exam_logs;
CREATE TRIGGER trg_validate_exam_log_audit
  BEFORE INSERT OR UPDATE OR DELETE ON public.exam_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_exam_log_audit();
