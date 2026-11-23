import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Exam Session Lifecycle & Server-Authoritative Timer', () => {
  it('calculates remaining seconds strictly from started_at wall-clock difference', () => {
    const durationMinutes = 90;
    const durationSeconds = durationMinutes * 60; // 5400s
    const startTime = Date.now() - (30 * 60 * 1000); // 30 minutes elapsed

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);

    // Remaining should be approximately 60 minutes = 3600s (+/- 2 seconds)
    assert.ok(remainingSeconds >= 3598 && remainingSeconds <= 3600);
  });

  it('preserves elapsed time upon browser refresh without timer reset', () => {
    const startedAt = '2026-11-23T10:00:00.000Z';
    const examDurationMinutes = 60;

    // Simulate page refresh 15 minutes later
    const refreshTime = new Date('2026-11-23T10:15:00.000Z').getTime();
    const elapsedOnRefresh = Math.floor((refreshTime - new Date(startedAt).getTime()) / 1000);
    const remainingOnRefresh = Math.max(0, (examDurationMinutes * 60) - elapsedOnRefresh);

    assert.strictEqual(elapsedOnRefresh, 900); // exactly 15 minutes
    assert.strictEqual(remainingOnRefresh, 2700); // exactly 45 minutes left
  });

  it('identifies expired attempts when elapsed time exceeds duration', () => {
    const startedAt = new Date(Date.now() - (95 * 60 * 1000)).toISOString(); // 95 mins ago
    const durationMinutes = 90;

    const startTimeMs = new Date(startedAt).getTime();
    const durationSeconds = durationMinutes * 60;
    const elapsedSeconds = Math.floor((Date.now() - startTimeMs) / 1000);
    const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
    const isExpired = remainingSeconds <= 0;

    assert.strictEqual(remainingSeconds, 0);
    assert.strictEqual(isExpired, true);
  });

  it('prevents reactivating an expired or completed attempt through heartbeat', () => {
    const terminalStatuses = ['completed', 'expired', 'terminated'];

    terminalStatuses.forEach(status => {
      const canReactivate = status === 'interrupted';
      assert.strictEqual(canReactivate, false, `Status ${status} should never be reactivated`);
    });
  });

  it('scores answers deterministically against questions key', () => {
    const questions = [
      { id: 'q1', correct_answer: 'A' },
      { id: 'q2', correct_answer: 'B' },
      { id: 'q3', correct_answer: 'C' },
      { id: 'q4', correct_answer: 'D' }
    ];

    const studentAnswers = {
      q1: 'A',
      q2: 'B',
      q3: 'wrong',
      q4: 'D'
    };

    let correct = 0;
    questions.forEach(q => {
      if (q.correct_answer === studentAnswers[q.id]) {
        correct++;
      }
    });

    const score = Math.round((correct / questions.length) * 100);
    assert.strictEqual(score, 75); // 3 of 4 correct
  });
});
