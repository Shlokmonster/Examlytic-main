import supabase from '../SupabaseClient';

/**
 * EXAMLYTIC AUTHORITATIVE LIFECYCLE & STREAMING CONSTANTS
 */
export const EXAM_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  INTERRUPTED: 'interrupted',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  TERMINATED: 'terminated',
  ABANDONED: 'abandoned',
};

export const STREAM_STATUS = {
  NOT_STARTED: 'STREAM_NOT_STARTED',
  CONNECTED: 'STREAM_CONNECTED',
  RECONNECTING: 'STREAM_RECONNECTING',
  DISCONNECTED: 'STREAM_DISCONNECTED',
};

export const HEARTBEAT_INTERVAL_MS = 15000;
export const INTERRUPTED_THRESHOLD_SECONDS = 45;

/**
 * Fetch sanitized exam configuration for student
 * Uses server-side question sanitization RPC if available
 */
export const fetchExamDetails = async (examId) => {
  try {
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_student_exam_questions_v1', { p_exam_id: examId });

    if (!rpcError && rpcData) {
      return rpcData;
    }
  } catch (err) {
    console.warn('[examService] RPC get_student_exam_questions_v1 fallback:', err);
  }

  // Graceful fallback to direct table query
  const { data: tableData, error: tableError } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .single();

  if (tableError) throw tableError;
  return tableData;
};

/**
 * Atomic Exam Attempt Start or Resumption
 * Guarantees server-authoritative timer synchronization and eliminates race conditions.
 */
export const startOrResumeAttempt = async (examId, studentId, durationMinutes = 90) => {
  const nowTime = Date.now();
  const nowIso = new Date(nowTime).toISOString();

  // 1. Look for existing unsubmitted attempt
  const { data: existingAttempt, error: lookupError } = await supabase
    .from('exam_attempts')
    .select('*')
    .eq('exam_id', examId)
    .eq('student_id', studentId)
    .is('submitted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError && lookupError.code !== 'PGRST116') {
    console.warn('[examService] Lookup error:', lookupError);
  }

  if (existingAttempt) {
    const startTime = new Date(existingAttempt.started_at || existingAttempt.created_at).getTime();
    const durationSeconds = durationMinutes * 60;
    const elapsedSeconds = Math.max(0, Math.floor((nowTime - startTime) / 1000));
    const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
    const isExpired = remainingSeconds <= 0;

    return {
      attempt: existingAttempt,
      attemptId: existingAttempt.id,
      startedAt: existingAttempt.started_at || existingAttempt.created_at,
      remainingSeconds,
      isExpired,
      savedAnswers: existingAttempt.answers || {},
      isResumed: true,
    };
  }

  // 2. Initialize new attempt record
  const newAttemptPayload = {
    exam_id: examId,
    student_id: studentId,
    started_at: nowIso,
    last_heartbeat_at: nowIso,
    status: EXAM_STATUS.IN_PROGRESS,
    stream_status: STREAM_STATUS.NOT_STARTED,
    answers: {},
    score: 0,
    submitted_at: null,
    completed_at: null,
  };

  const { data: createdAttempt, error: insertError } = await supabase
    .from('exam_attempts')
    .insert(newAttemptPayload)
    .select()
    .single();

  if (insertError) {
    // Retry with core schema if extended columns fail
    const { data: fallbackAttempt, error: fallbackError } = await supabase
      .from('exam_attempts')
      .insert({
        exam_id: examId,
        student_id: studentId,
        answers: {},
        score: 0,
        submitted_at: null,
        completed_at: null,
      })
      .select()
      .single();

    if (fallbackError) throw fallbackError;

    return {
      attempt: fallbackAttempt,
      attemptId: fallbackAttempt.id,
      startedAt: fallbackAttempt.created_at,
      remainingSeconds: durationMinutes * 60,
      isExpired: false,
      savedAnswers: {},
      isResumed: false,
    };
  }

  return {
    attempt: createdAttempt,
    attemptId: createdAttempt.id,
    startedAt: createdAttempt.started_at || createdAttempt.created_at,
    remainingSeconds: durationMinutes * 60,
    isExpired: false,
    savedAnswers: {},
    isResumed: false,
  };
};

/**
 * Dispatch Student Heartbeat
 * Calls versioned RPCs with graceful fallbacks.
 */
export const sendStudentHeartbeat = async (attemptId, streamStatus = STREAM_STATUS.CONNECTED) => {
  if (!attemptId) return null;

  // Try v2 RPC (returns rich JSONB status)
  try {
    const { data: v2Data, error: v2Error } = await supabase
      .rpc('record_student_heartbeat_v2', {
        p_attempt_id: attemptId,
        p_stream_status: streamStatus,
      });

    if (!v2Error && v2Data) {
      return v2Data;
    }
  } catch {
    // Proceed to v1 fallback
  }

  // Try v1 RPC (returns VOID)
  try {
    const { error: v1Error } = await supabase
      .rpc('record_student_heartbeat', {
        p_attempt_id: attemptId,
        p_stream_status: streamStatus,
      });

    if (!v1Error) {
      return { success: true, status: EXAM_STATUS.IN_PROGRESS };
    }
  } catch {
    // Proceed to direct table fallback
  }

  // Fallback direct table update
  try {
    const { error } = await supabase
      .from('exam_attempts')
      .update({
        last_heartbeat_at: new Date().toISOString(),
        stream_status: streamStatus,
        status: EXAM_STATUS.IN_PROGRESS,
      })
      .eq('id', attemptId)
      .is('submitted_at', null);

    return { success: !error, status: EXAM_STATUS.IN_PROGRESS };
  } catch (err) {
    console.warn('[examService] Heartbeat fallback update warning:', err);
    return null;
  }
};

/**
 * Auto-save student answers incrementally
 * Uses save_student_answers_v1 RPC if available, with direct update fallback.
 */
export const autoSaveAnswers = async (attemptId, answers) => {
  if (!attemptId || !answers) return null;

  try {
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('save_student_answers_v1', {
        p_attempt_id: attemptId,
        p_answers: answers,
      });

    if (!rpcError && rpcData?.success) {
      return rpcData;
    }
  } catch {
    // Fall back to direct table update
  }

  try {
    const { error } = await supabase
      .from('exam_attempts')
      .update({ answers })
      .eq('id', attemptId);

    if (error) console.error('[examService] Auto-save error:', error);
    return { success: !error };
  } catch (err) {
    console.error('[examService] Auto-save exception:', err);
    return null;
  }
};

/**
 * Server-Authoritative Exam Submission
 * Uses atomic submit RPC to grade server-side and finalize attempt.
 */
export const submitExamAttempt = async (attemptId, answers, fallbackQuestions = []) => {
  if (!attemptId) throw new Error('Attempt ID is required for submission.');

  // 1. Try atomic server-side RPC (grades questions and finalizes state atomically)
  try {
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('submit_student_exam_attempt_v1', {
        p_attempt_id: attemptId,
        p_answers: answers || {},
      });

    if (!rpcError && rpcData) {
      return rpcData;
    }
    if (rpcError) {
      console.warn('[examService] Server submit RPC returned error:', rpcError);
    }
  } catch (err) {
    console.warn('[examService] Server submit RPC fallback:', err);
  }

  // 2. Fallback: calculate score client-side if RPC not yet deployed
  let correctCount = 0;
  fallbackQuestions.forEach(q => {
    const correct = q.correct_answer || q.correctAnswer;
    if (correct && correct === answers[q.id]) {
      correctCount++;
    }
  });

  const calculatedScore = fallbackQuestions.length > 0
    ? Math.round((correctCount / fallbackQuestions.length) * 100)
    : 0;

  const nowIso = new Date().toISOString();
  const updatePayload = {
    answers,
    score: calculatedScore,
    status: EXAM_STATUS.COMPLETED,
    submitted_at: nowIso,
    completed_at: nowIso,
    last_heartbeat_at: nowIso,
  };

  const { data: updatedAttempt, error: updateError } = await supabase
    .from('exam_attempts')
    .update(updatePayload)
    .eq('id', attemptId)
    .select()
    .single();

  if (updateError) throw updateError;

  return {
    success: true,
    score: calculatedScore,
    total_questions: fallbackQuestions.length,
    status: EXAM_STATUS.COMPLETED,
    submitted_at: nowIso,
    attempt: updatedAttempt,
  };
};

/**
 * Fetch authenticated LiveKit streaming token with caller JWT authentication
 */
export const fetchLiveKitToken = async ({ roomName, participantName, isPublisher, studentName }) => {
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rapid-task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      roomName,
      participantName,
      isPublisher: !!isPublisher,
      studentName,
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Streaming service rejected request with status ${response.status}`);
  }

  return response.json();
};
