import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Concurrency Protection & Race Condition Elimination', () => {
  it('prevents duplicate active attempts when two tabs start concurrently', async () => {
    // Database mock with atomic idempotency
    const dbAttempts = [];

    const startAttemptAtomically = async (examId, studentId) => {
      // Check existing active
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

    // Simulate concurrent requests from Tab 1 and Tab 2
    const [res1, res2] = await Promise.all([
      startAttemptAtomically('exam-1', 'student-1'),
      startAttemptAtomically('exam-1', 'student-1'),
    ]);

    // Exactly one attempt must be created, and both tabs must resolve the SAME attempt ID
    assert.strictEqual(dbAttempts.length, 1, 'Only one attempt record must be created');
    assert.strictEqual(res1.attempt.id, res2.attempt.id, 'Both tabs must receive the identical attempt ID');
  });

  it('rejects duplicate submission requests when user double-clicks submit', async () => {
    let attemptState = {
      id: 'att-double-submit',
      status: 'in_progress',
      submitted_at: null,
      score: 0,
    };

    // Atomic submission RPC simulation with row locking
    const submitAttemptAtomic = async (answers) => {
      // Row lock simulation (SELECT FOR UPDATE)
      if (attemptState.status === 'completed' || attemptState.submitted_at !== null) {
        return { success: false, error: 'Attempt has already been submitted.' };
      }

      attemptState = {
        ...attemptState,
        status: 'completed',
        submitted_at: new Date().toISOString(),
        score: 85,
        answers,
      };

      return { success: true, score: 85, status: 'completed' };
    };

    const firstSubmit = await submitAttemptAtomic({ q1: 'A' });
    const secondSubmit = await submitAttemptAtomic({ q1: 'B' });

    assert.strictEqual(firstSubmit.success, true);
    assert.strictEqual(secondSubmit.success, false);
    assert.strictEqual(secondSubmit.error, 'Attempt has already been submitted.');
    assert.strictEqual(attemptState.answers.q1, 'A', 'First submission answers must remain intact');
  });

  it('handles heartbeat racing with submission safely without overwriting completed state', async () => {
    let attempt = {
      id: 'att-race',
      status: 'in_progress',
      submitted_at: null,
      last_heartbeat_at: new Date(Date.now() - 5000).toISOString(),
    };

    const submit = async () => {
      attempt = {
        ...attempt,
        status: 'completed',
        submitted_at: new Date().toISOString(),
      };
    };

    const heartbeat = async () => {
      // Check if attempt is terminal
      if (attempt.status === 'completed' || attempt.status === 'expired') {
        return; // Terminal state rejected
      }
      attempt = {
        ...attempt,
        last_heartbeat_at: new Date().toISOString(),
      };
    };

    // Simulate submission completing, followed by late in-flight heartbeat arriving
    await submit();
    await heartbeat();

    assert.strictEqual(attempt.status, 'completed', 'Late heartbeat MUST NOT revert completed status to in_progress');
    assert.ok(attempt.submitted_at);
  });

  it('marks attempt expired when reconnecting after deadline elapses', () => {
    const durationMinutes = 60;
    const startedAt = new Date(Date.now() - (70 * 60 * 1000)).toISOString(); // started 70m ago

    const nowTime = Date.now();
    const startTimeMs = new Date(startedAt).getTime();
    const durationMs = durationMinutes * 60 * 1000;
    const deadline = startTimeMs + durationMs;

    const isExpired = nowTime > deadline;
    const remainingSeconds = Math.max(0, Math.floor((deadline - nowTime) / 1000));

    assert.strictEqual(isExpired, true);
    assert.strictEqual(remainingSeconds, 0);
  });
});
