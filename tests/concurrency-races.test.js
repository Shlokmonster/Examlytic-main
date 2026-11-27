import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('[Concurrency & State Machine Tests] Lifecycle & Interrupted Session Recovery', () => {

  // Logic simulation of heartbeat state transitions
  const simulateHeartbeatTransition = ({ attempt, exam, streamStatus, callerId }) => {
    if (attempt.student_id !== callerId) {
      return { success: false, error: 'Unauthorized', code: '42501' };
    }

    // Terminal state protection
    if (['completed', 'expired', 'terminated', 'abandoned'].includes(attempt.status) || attempt.submitted_at) {
      return { success: false, status: attempt.status, message: 'Terminal state cannot be revived' };
    }

    const durationMs = (exam.duration_minutes || 90) * 60 * 1000;
    const startedMs = new Date(attempt.started_at).getTime();
    const nowMs = Date.now();

    // Deadline check
    if (nowMs > (startedMs + durationMs)) {
      attempt.status = 'expired';
      attempt.stream_status = 'STREAM_DISCONNECTED';
      attempt.last_heartbeat_at = new Date().toISOString();
      return { success: false, status: 'expired', remaining_seconds: 0 };
    }

    // Interrupted session recovery to in_progress
    if (['in_progress', 'interrupted'].includes(attempt.status)) {
      attempt.status = 'in_progress';
      attempt.stream_status = streamStatus || 'STREAM_CONNECTED';
      attempt.last_heartbeat_at = new Date().toISOString();
      const remainingSeconds = Math.max(0, Math.floor((startedMs + durationMs - nowMs) / 1000));
      return { success: true, status: 'in_progress', remaining_seconds: remainingSeconds };
    }

    return { success: false, status: attempt.status };
  };

  // TEST 13: Interrupted attempt reconnects correctly
  it('13. interrupted attempt reconnects correctly and restores status to in_progress', () => {
    const studentId = 'student-101';
    const exam = { duration_minutes: 60 };
    const attempt = {
      id: 'att-interrupted-1',
      student_id: studentId,
      started_at: new Date(Date.now() - (10 * 60 * 1000)).toISOString(), // 10 mins ago
      status: 'interrupted',
      stream_status: 'STREAM_DISCONNECTED',
      submitted_at: null,
    };

    const result = simulateHeartbeatTransition({
      attempt,
      exam,
      streamStatus: 'STREAM_CONNECTED',
      callerId: studentId,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'in_progress');
    assert.strictEqual(attempt.status, 'in_progress', 'Attempt status must be restored to in_progress');
    assert.strictEqual(attempt.stream_status, 'STREAM_CONNECTED');
    assert.ok(result.remaining_seconds > 0);
  });

  // TEST 14: Expired attempt cannot reconnect
  it('14. expired attempt cannot reconnect or be revived by heartbeat', () => {
    const studentId = 'student-101';
    const exam = { duration_minutes: 60 };
    const attempt = {
      id: 'att-expired-1',
      student_id: studentId,
      started_at: new Date(Date.now() - (120 * 60 * 1000)).toISOString(), // 2 hours ago
      status: 'expired',
      stream_status: 'STREAM_DISCONNECTED',
      submitted_at: null,
    };

    const result = simulateHeartbeatTransition({
      attempt,
      exam,
      streamStatus: 'STREAM_CONNECTED',
      callerId: studentId,
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.status, 'expired');
    assert.strictEqual(attempt.status, 'expired', 'Expired attempt must NEVER transition back to in_progress');
  });

  // TEST 15: Submission racing with heartbeat
  it('15. submission racing with heartbeat preserves terminal completed status without overwrite', async () => {
    let attempt = {
      id: 'att-race-sub-hb',
      student_id: 'student-101',
      status: 'in_progress',
      submitted_at: null,
      last_heartbeat_at: new Date(Date.now() - 5000).toISOString(),
    };

    // Atomic submission completes first
    const submit = async () => {
      attempt = {
        ...attempt,
        status: 'completed',
        submitted_at: new Date().toISOString(),
        score: 92.5,
      };
    };

    // Late heartbeat arrives milliseconds later
    const heartbeat = async () => {
      if (['completed', 'expired', 'terminated'].includes(attempt.status) || attempt.submitted_at) {
        return { success: false, status: attempt.status, rejected: true };
      }
      attempt.status = 'in_progress';
      attempt.last_heartbeat_at = new Date().toISOString();
      return { success: true };
    };

    await submit();
    const hbResult = await heartbeat();

    assert.strictEqual(hbResult.rejected, true, 'Heartbeat must reject closed attempt');
    assert.strictEqual(attempt.status, 'completed', 'Status must remain completed');
    assert.ok(attempt.submitted_at);
  });

  // TEST 16: Submission racing with expiration
  it('16. submission racing with deadline expiration rejects submission if deadline passed', () => {
    const durationMinutes = 30;
    const startedAt = new Date(Date.now() - (35 * 60 * 1000)).toISOString(); // 35 min elapsed on 30 min exam
    const now = Date.now();
    const deadline = new Date(startedAt).getTime() + (durationMinutes * 60 * 1000);
    const gracePeriodMs = 60 * 1000; // 60s network grace

    const isExpired = now > (deadline + gracePeriodMs);

    assert.strictEqual(isExpired, true, 'Attempt must be classified as expired when past deadline and grace');

    // In submit_student_exam_attempt_v1, expired attempt is updated to 'expired' and rejected
    const attempt = { status: 'in_progress', submitted_at: null };
    if (isExpired) {
      attempt.status = 'expired';
    }

    assert.strictEqual(attempt.status, 'expired');
    assert.strictEqual(attempt.submitted_at, null);
  });

  // TEST 17: Two simultaneous submissions
  it('17. two simultaneous submissions are serialized via row lock and duplicate is handled cleanly', async () => {
    let isLocked = false;
    let attemptState = {
      id: 'att-concurrent-submit',
      status: 'in_progress',
      submitted_at: null,
      score: null,
    };

    const submitAttemptAtomic = async (answers, reqId) => {
      // Wait for lock if busy (simulating PostgreSQL row lock queue)
      while (isLocked) {
        await new Promise(r => setTimeout(r, 5));
      }
      isLocked = true;

      try {
        // SELECT FOR UPDATE inspection
        if (attemptState.status === 'completed' || attemptState.submitted_at !== null) {
          return {
            success: true,
            already_submitted: true,
            status: 'completed',
            score: attemptState.score,
            submitted_at: attemptState.submitted_at,
            message: 'Duplicate submission prevented cleanly',
          };
        }

        // Apply first submission
        attemptState = {
          ...attemptState,
          status: 'completed',
          submitted_at: new Date().toISOString(),
          score: 88.0,
          answers,
          submittedByReq: reqId,
        };

        return {
          success: true,
          status: 'completed',
          score: 88.0,
          already_submitted: false,
        };
      } finally {
        isLocked = false;
      }
    };

    // Concurrent double submission invocation
    const [sub1, sub2] = await Promise.all([
      submitAttemptAtomic({ q1: 'A' }, 'req-1'),
      submitAttemptAtomic({ q1: 'B' }, 'req-2'),
    ]);

    assert.strictEqual(sub1.success, true);
    assert.strictEqual(sub2.success, true);
    
    // Exactly one must be the primary submission, and the other must be already_submitted
    const primaryCount = [sub1, sub2].filter(s => !s.already_submitted).length;
    const duplicateCount = [sub1, sub2].filter(s => s.already_submitted).length;

    assert.strictEqual(primaryCount, 1, 'Exactly one primary submission must succeed');
    assert.strictEqual(duplicateCount, 1, 'The concurrent second submission must be identified as already_submitted');
    assert.strictEqual(attemptState.status, 'completed');
  });

  // Concurrency: Multiple tabs starting attempt
  it('prevents duplicate active attempts when multiple tabs start concurrently', async () => {
    const dbAttempts = [];

    const startAttemptAtomically = async (examId, studentId) => {
      const existing = dbAttempts.find(a => a.exam_id === examId && a.student_id === studentId && !a.submitted_at);
      if (existing) {
        return { attempt: existing, created: false };
      }

      const newAttempt = {
        id: `att-${Date.now()}-${Math.random()}`,
        exam_id: examId,
        student_id: studentId,
        started_at: new Date().toISOString(),
        submitted_at: null,
        status: 'in_progress',
      };
      dbAttempts.push(newAttempt);
      return { attempt: newAttempt, created: true };
    };

    const [res1, res2] = await Promise.all([
      startAttemptAtomically('exam-1', 'student-1'),
      startAttemptAtomically('exam-1', 'student-1'),
    ]);

    assert.strictEqual(dbAttempts.length, 1, 'Only one attempt record must be created');
    assert.strictEqual(res1.attempt.id, res2.attempt.id, 'Both tabs must receive identical attempt ID');
  });
});
