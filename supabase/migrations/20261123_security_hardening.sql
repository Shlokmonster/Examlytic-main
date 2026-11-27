-- ==============================================================================
-- EXAMLYTIC — PRODUCTION SECURITY HARDENING & AUDIT PRESERVATION MIGRATION
-- (Pending Admin Approval - DO NOT AUTO-DEPLOY TO PRODUCTION)
-- ==============================================================================

-- 1. Hardened Heartbeat RPC with Authorization, Explicit Search Path & Deadline Checks
CREATE OR REPLACE FUNCTION public.record_student_heartbeat(
  p_attempt_id UUID,
  p_stream_status VARCHAR DEFAULT 'STREAM_CONNECTED'
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_attempt RECORD;
  v_duration_min INT;
  v_deadline TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Validate caller authentication
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit heartbeats.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validate stream status enum
  IF p_stream_status NOT IN ('STREAM_NOT_STARTED', 'STREAM_CONNECTED', 'STREAM_RECONNECTING', 'STREAM_DISCONNECTED') THEN
    p_stream_status := 'STREAM_CONNECTED';
  END IF;

  -- 3. Lookup attempt with caller ownership check
  SELECT a.id, a.student_id, a.exam_id, a.started_at, a.status, e.duration_minutes
  INTO v_attempt
  FROM public.exam_attempts a
  JOIN public.exams e ON e.id = a.exam_id
  WHERE a.id = p_attempt_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam attempt not found' USING ERRCODE = 'P0002';
  END IF;

  -- 4. Cross-student authorization check: only attempt owner or admin can heartbeat
  IF v_attempt.student_id <> v_caller_id THEN
    -- Check if caller is an admin
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_caller_id AND role = 'admin') THEN
      RAISE EXCEPTION 'Unauthorized: You cannot heartbeat another student''s examination attempt.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 5. Terminal state check: completed, expired, or terminated sessions cannot be reopened
  IF v_attempt.status IN ('completed', 'expired', 'terminated') THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', v_attempt.status,
      'message', 'Session is in a terminal state and cannot be reactivated.'
    );
  END IF;

  -- 6. Server-authoritative deadline check
  v_duration_min := COALESCE(v_attempt.duration_minutes, 90);
  v_deadline := v_attempt.started_at + (v_duration_min * INTERVAL '1 minute');

  IF v_now > v_deadline THEN
    -- Mark attempt as expired automatically
    UPDATE public.exam_attempts
    SET status = 'expired',
        last_heartbeat_at = v_now,
        stream_status = 'STREAM_DISCONNECTED'
    WHERE id = p_attempt_id;

    RETURN jsonb_build_object(
      'success', false,
      'status', 'expired',
      'message', 'Exam duration has elapsed. Attempt marked expired.'
    );
  END IF;

  -- 7. Update heartbeat and reactivate interrupted attempts
  UPDATE public.exam_attempts
  SET last_heartbeat_at = v_now,
      stream_status = p_stream_status,
      status = CASE 
        WHEN status = 'interrupted' THEN 'in_progress'
        ELSE status
      END
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'in_progress',
    'last_heartbeat_at', v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Restrict direct execution of record_student_heartbeat to authenticated users
REVOKE ALL ON FUNCTION public.record_student_heartbeat(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_student_heartbeat(UUID, VARCHAR) TO authenticated;

-- 3. Prevent Privilege Escalation: Protect users.role from self-elevation
CREATE OR REPLACE FUNCTION public.protect_user_role_elevation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Only allow role modification if caller is authenticated admin or service_role
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

-- 4. Audit Trail Protection: Prevent modifications to completed/expired attempts
CREATE OR REPLACE FUNCTION public.protect_terminal_exam_attempts()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow recording uploads (recording_url, cloudinary_public_id) after completion
  IF OLD.status IN ('completed', 'expired', 'terminated') THEN
    IF (NEW.answers IS DISTINCT FROM OLD.answers) OR (NEW.score IS DISTINCT FROM OLD.score) THEN
      RAISE EXCEPTION 'Unauthorized: Cannot modify answers or score on a % exam attempt.', OLD.status USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_terminal_attempts ON public.exam_attempts;
CREATE TRIGGER trg_protect_terminal_attempts
  BEFORE UPDATE ON public.exam_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_terminal_exam_attempts();
