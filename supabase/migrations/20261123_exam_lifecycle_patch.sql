-- ==============================================================================
-- EXAMLYTIC LIFECYCLE & PROCTORING SCHEMA EXTENSION
-- Backward-compatible: Adds missing columns, indexes, and backfills legacy data.
-- ==============================================================================

-- 1. Extend exam_attempts with lifecycle and heartbeat attributes
ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS stream_status VARCHAR(32) DEFAULT 'not_started';

-- 2. Extend exam_flags with attempt foreign key
ALTER TABLE exam_flags
  ADD COLUMN IF NOT EXISTS exam_attempt_id UUID REFERENCES exam_attempts(id) ON DELETE CASCADE;

-- 3. Extend exam_logs with direct exam reference
ALTER TABLE exam_logs
  ADD COLUMN IF NOT EXISTS exam_id UUID REFERENCES exams(id) ON DELETE CASCADE;

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON exam_attempts(exam_id, status);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_heartbeat ON exam_attempts(last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_exam_logs_attempt_id ON exam_logs(exam_attempt_id);
CREATE INDEX IF NOT EXISTS idx_exam_flags_attempt_id ON exam_flags(exam_attempt_id);

-- 5. Backfill historical attempts safely without overwriting data
UPDATE exam_attempts
SET started_at = created_at
WHERE started_at IS NULL;

UPDATE exam_attempts
SET last_heartbeat_at = COALESCE(submitted_at, completed_at, created_at)
WHERE last_heartbeat_at IS NULL;

UPDATE exam_attempts
SET status = CASE 
  WHEN submitted_at IS NOT NULL OR completed_at IS NOT NULL THEN 'completed'
  WHEN created_at < NOW() - INTERVAL '1 day' THEN 'expired'
  ELSE 'in_progress'
END
WHERE status = 'in_progress' AND (submitted_at IS NOT NULL OR created_at < NOW() - INTERVAL '1 day');

-- 6. Backfill historical logs to match attempt IDs where deterministically known
UPDATE exam_logs l
SET exam_attempt_id = a.id,
    exam_id = a.exam_id
FROM exam_attempts a
WHERE l.exam_attempt_id IS NULL
  AND l.student_id = a.student_id
  AND l.event_details->>'exam_id' IS NOT NULL
  AND (l.event_details->>'exam_id')::uuid = a.exam_id
  AND l.created_at >= a.created_at - INTERVAL '10 minutes'
  AND l.created_at <= COALESCE(a.submitted_at, a.created_at + INTERVAL '1 day');

-- 7. Add atomic heartbeat RPC function
CREATE OR REPLACE FUNCTION record_student_heartbeat(
  p_attempt_id UUID,
  p_stream_status VARCHAR DEFAULT 'STREAM_CONNECTED'
)
RETURNS VOID AS $$
BEGIN
  UPDATE exam_attempts
  SET last_heartbeat_at = NOW(),
      stream_status = p_stream_status,
      status = CASE 
        WHEN status = 'interrupted' THEN 'in_progress'
        ELSE status
      END
  WHERE id = p_attempt_id 
    AND status IN ('in_progress', 'interrupted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

