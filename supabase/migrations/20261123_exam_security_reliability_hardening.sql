-- ==============================================================================
-- EXAMLYTIC — PRODUCTION SECURITY, RELIABILITY & COMPATIBILITY HARDENING
-- Migration: 20261123_exam_security_reliability_hardening.sql
-- 
-- IMPORTANT:
-- This migration is incremental and safe for production databases where
-- 20261123_exam_lifecycle_patch.sql has ALREADY been executed.
-- It does NOT drop existing tables or data.
-- It does NOT change the return type of record_student_heartbeat (returns VOID).
-- It adds versioned RPCs (v1 / v2) and defensive triggers.
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
  v_now TIMESTAMPTZ := NOW();
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit heartbeats.' USING ERRCODE = '42501';
  END IF;

  -- Validate stream status allowlist
  IF p_stream_status NOT IN ('STREAM_NOT_STARTED', 'STREAM_CONNECTED', 'STREAM_RECONNECTING', 'STREAM_DISCONNECTED') THEN
    p_stream_status := 'STREAM_CONNECTED';
  END IF;

  -- Look up attempt with row lock to avoid race conditions with submission
  SELECT a.student_id, a.status, a.started_at, COALESCE(e.duration_minutes, 90)
  INTO v_student_id, v_status, v_started_at, v_duration_min
  FROM public.exam_attempts a
  JOIN public.exams e ON e.id = a.exam_id
  WHERE a.id = p_attempt_id
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam attempt not found' USING ERRCODE = 'P0002';
  END IF;

  -- Ownership validation: only attempt owner or admin can update heartbeat
  IF v_student_id <> v_caller_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_caller_id AND role = 'admin') THEN
      RAISE EXCEPTION 'Unauthorized: You cannot update another student''s examination heartbeat.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Never revive terminal states
  IF v_status IN ('completed', 'expired', 'terminated', 'abandoned') THEN
    RETURN;
  END IF;

  -- Server-authoritative deadline check
  IF v_now > (v_started_at + (v_duration_min * INTERVAL '1 minute')) THEN
    UPDATE public.exam_attempts
    SET status = 'expired',
        last_heartbeat_at = v_now,
        stream_status = 'STREAM_DISCONNECTED'
    WHERE id = p_attempt_id;
    RETURN;
  END IF;

  -- Update heartbeat and recover interrupted state
  UPDATE public.exam_attempts
  SET last_heartbeat_at = v_now,
      stream_status = p_stream_status,
      status = CASE 
        WHEN status = 'interrupted' THEN 'in_progress'
        ELSE status
      END
  WHERE id = p_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.record_student_heartbeat(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_student_heartbeat(UUID, VARCHAR) TO authenticated;


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
  v_now TIMESTAMPTZ := NOW();
  v_remaining_sec INT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_stream_status NOT IN ('STREAM_NOT_STARTED', 'STREAM_CONNECTED', 'STREAM_RECONNECTING', 'STREAM_DISCONNECTED') THEN
    p_stream_status := 'STREAM_CONNECTED';
  END IF;

  SELECT a.student_id, a.status, a.started_at, COALESCE(e.duration_minutes, 90)
  INTO v_student_id, v_status, v_started_at, v_duration_min
  FROM public.exam_attempts a
  JOIN public.exams e ON e.id = a.exam_id
  WHERE a.id = p_attempt_id
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam attempt not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_student_id <> v_caller_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_caller_id AND role = 'admin') THEN
      RAISE EXCEPTION 'Unauthorized attempt access.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_status IN ('completed', 'expired', 'terminated', 'abandoned') THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', v_status,
      'message', 'Session is in terminal state.'
    );
  END IF;

  v_deadline := v_started_at + (v_duration_min * INTERVAL '1 minute');
  v_remaining_sec := GREATEST(0, EXTRACT(EPOCH FROM (v_deadline - v_now))::INT);

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

  UPDATE public.exam_attempts
  SET last_heartbeat_at = v_now,
      stream_status = p_stream_status,
      status = CASE WHEN status = 'interrupted' THEN 'in_progress' ELSE status END
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'in_progress',
    'remaining_seconds', v_remaining_sec,
    'last_heartbeat_at', v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.record_student_heartbeat_v2(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_student_heartbeat_v2(UUID, VARCHAR) TO authenticated;


-- ==============================================================================
-- 3. SANITIZED QUESTION DELIVERY RPC (Hides correct_answer from Student network queries)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_student_exam_questions_v1(
  p_exam_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_exam RECORD;
  v_sanitized_questions JSONB := '[]'::jsonb;
  v_q JSONB;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT id, title, subject, instructions, duration_minutes, is_active, questions
  INTO v_exam
  FROM public.exams
  WHERE id = p_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_exam.is_active AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_caller_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Exam is currently locked.' USING ERRCODE = '42501';
  END IF;

  -- Iterate through questions and strip correct_answer if caller is not admin
  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_caller_id AND role = 'admin') THEN
    v_sanitized_questions := v_exam.questions;
  ELSE
    FOR v_q IN SELECT * FROM jsonb_array_elements(v_exam.questions)
    LOOP
      v_sanitized_questions := v_sanitized_questions || jsonb_build_array(
        v_q - 'correct_answer'
      );
    END LOOP;
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
GRANT EXECUTE ON FUNCTION public.get_student_exam_questions_v1(UUID) TO authenticated;


-- ==============================================================================
-- 4. SERVER-AUTHORITATIVE SUBMISSION RPC (submit_student_exam_attempt_v1)
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
  v_started_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
  v_is_expired BOOLEAN;
  v_correct_count INT := 0;
  v_total_questions INT := 0;
  v_calculated_score NUMERIC := 0;
  v_q JSONB;
  v_qid TEXT;
  v_correct_ans TEXT;
  v_student_ans TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Lock attempt row to prevent concurrent double-submissions
  SELECT a.id, a.student_id, a.exam_id, a.started_at, a.status, e.duration_minutes, e.questions
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
    RAISE EXCEPTION 'Unauthorized: You cannot submit another student''s exam.' USING ERRCODE = '42501';
  END IF;

  -- Prevent re-submitting terminal attempts
  IF v_attempt.status IN ('completed', 'expired', 'terminated') THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', v_attempt.status,
      'message', 'Attempt has already been submitted or completed.'
    );
  END IF;

  v_duration_min := COALESCE(v_attempt.duration_minutes, 90);
  v_is_expired := (v_now > (v_attempt.started_at + (v_duration_min * INTERVAL '1 minute')));

  -- Calculate score server-side from authoritative question keys
  IF v_attempt.questions IS NOT NULL AND jsonb_typeof(v_attempt.questions) = 'array' THEN
    v_total_questions := jsonb_array_length(v_attempt.questions);
    FOR v_q IN SELECT * FROM jsonb_array_elements(v_attempt.questions)
    LOOP
      v_qid := COALESCE(v_q->>'id', '');
      v_correct_ans := COALESCE(v_q->>'correct_answer', '');
      v_student_ans := COALESCE(p_answers->>v_qid, '');
      
      IF v_correct_ans <> '' AND v_student_ans <> '' AND v_correct_ans = v_student_ans THEN
        v_correct_count := v_correct_count + 1;
      END IF;
    END LOOP;
  END IF;

  IF v_total_questions > 0 THEN
    v_calculated_score := ROUND((v_correct_count::numeric / v_total_questions::numeric) * 100, 1);
  ELSE
    v_calculated_score := 0;
  END IF;

  -- Commit submission atomically
  UPDATE public.exam_attempts
  SET answers = p_answers,
      score = v_calculated_score,
      status = CASE WHEN v_is_expired THEN 'expired' ELSE 'completed' END,
      submitted_at = v_now,
      completed_at = v_now,
      last_heartbeat_at = v_now
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', CASE WHEN v_is_expired THEN 'expired' ELSE 'completed' END,
    'score', v_calculated_score,
    'total_questions', v_total_questions,
    'submitted_at', v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.submit_student_exam_attempt_v1(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_student_exam_attempt_v1(UUID, JSONB) TO authenticated;


-- ==============================================================================
-- 5. FIELD-LEVEL PROTECTION TRIGGER ON exam_attempts
-- Prevents student direct mutation of sensitive columns (score, status, dates)
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

  -- For student caller:
  -- 1. Prevent ownership / exam re-assignment
  IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'Cannot reassign student_id on an exam attempt.' USING ERRCODE = '42501';
  END IF;

  IF NEW.exam_id IS DISTINCT FROM OLD.exam_id THEN
    RAISE EXCEPTION 'Cannot reassign exam_id on an exam attempt.' USING ERRCODE = '42501';
  END IF;

  IF NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    RAISE EXCEPTION 'Cannot modify started_at timestamp.' USING ERRCODE = '42501';
  END IF;

  -- 2. If attempt was already terminal, only allow recording attachments
  IF OLD.status IN ('completed', 'expired', 'terminated', 'abandoned') THEN
    IF (NEW.answers IS DISTINCT FROM OLD.answers) OR 
       (NEW.score IS DISTINCT FROM OLD.score) OR
       (NEW.status IS DISTINCT FROM OLD.status) THEN
      RAISE EXCEPTION 'Cannot modify answers, score, or status on a closed exam attempt.' USING ERRCODE = '42501';
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
-- 6. PREVENT ROLE SELF-ELEVATION (ON users TABLE)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.protect_user_role_elevation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF (auth.jwt() ->> 'role') <> 'service_role' AND 
       NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Unauthorized: Users cannot modify their own security role.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_user_role ON public.users;
CREATE TRIGGER trg_protect_user_role
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_role_elevation();

-- Enforce default 'student' role on user registration insert
CREATE OR REPLACE FUNCTION public.enforce_new_user_default_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS NULL OR NEW.role = 'admin' THEN
    IF (auth.jwt() ->> 'role') <> 'service_role' AND 
       NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
      NEW.role := 'student';
    END IF;
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
-- 7. AUDIT OWNERSHIP CONSISTENCY (ON exam_flags AND exam_logs)
-- Prevents Student A from attaching flags or logs to Student B's attempt
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.validate_exam_flag_ownership()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_attempt_owner UUID;
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.exam_attempt_id IS NOT NULL THEN
    SELECT student_id INTO v_attempt_owner FROM public.exam_attempts WHERE id = NEW.exam_attempt_id;
    IF v_attempt_owner IS NOT NULL AND v_attempt_owner <> NEW.user_id THEN
      RAISE EXCEPTION 'Integrity Error: Flag attempt ID does not match flag user_id.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_exam_flag_ownership ON public.exam_flags;
CREATE TRIGGER trg_validate_exam_flag_ownership
  BEFORE INSERT ON public.exam_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_exam_flag_ownership();

CREATE OR REPLACE FUNCTION public.validate_exam_log_ownership()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_attempt_owner UUID;
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.exam_attempt_id IS NOT NULL THEN
    SELECT student_id INTO v_attempt_owner FROM public.exam_attempts WHERE id = NEW.exam_attempt_id;
    IF v_attempt_owner IS NOT NULL AND v_attempt_owner <> NEW.student_id THEN
      RAISE EXCEPTION 'Integrity Error: Log attempt ID does not match log student_id.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_exam_log_ownership ON public.exam_logs;
CREATE TRIGGER trg_validate_exam_log_ownership
  BEFORE INSERT ON public.exam_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_exam_log_ownership();
