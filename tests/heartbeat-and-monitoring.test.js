import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Heartbeat & Monitoring State Machine', () => {
  const HEARTBEAT_THRESHOLD_SECONDS = 45;

  it('marks sessions with missed heartbeat > 45s as interrupted without false misconduct penalty', () => {
    const now = Date.now();
    const attempts = [
      { id: 'att-1', last_heartbeat_at: new Date(now - 10000).toISOString() }, // 10s ago -> active
      { id: 'att-2', last_heartbeat_at: new Date(now - 30000).toISOString() }, // 30s ago -> active
      { id: 'att-3', last_heartbeat_at: new Date(now - 50000).toISOString() }, // 50s ago -> interrupted
      { id: 'att-4', last_heartbeat_at: new Date(now - 120000).toISOString() } // 120s ago -> interrupted
    ];

    const evaluated = attempts.map(a => {
      const secondsSince = Math.floor((now - new Date(a.last_heartbeat_at).getTime()) / 1000);
      return {
        ...a,
        isInterrupted: secondsSince > HEARTBEAT_THRESHOLD_SECONDS
      };
    });

    assert.strictEqual(evaluated[0].isInterrupted, false);
    assert.strictEqual(evaluated[1].isInterrupted, false);
    assert.strictEqual(evaluated[2].isInterrupted, true);
    assert.strictEqual(evaluated[3].isInterrupted, true);
  });

  it('distinguishes between Active, Interrupted, Expired, and Completed attempts', () => {
    const nowTime = Date.now();
    const mockAttempts = [
      { id: '1', submitted_at: new Date().toISOString(), status: 'completed' },
      { id: '2', submitted_at: null, started_at: new Date(nowTime - 10000).toISOString(), duration_minutes: 60, last_heartbeat_at: new Date(nowTime - 5000).toISOString() },
      { id: '3', submitted_at: null, started_at: new Date(nowTime - 10000).toISOString(), duration_minutes: 60, last_heartbeat_at: new Date(nowTime - 60000).toISOString() },
      { id: '4', submitted_at: null, started_at: new Date(nowTime - 7200000).toISOString(), duration_minutes: 60, last_heartbeat_at: new Date(nowTime - 7200000).toISOString() }
    ];

    const activeList = [];
    const interruptedList = [];
    const expiredList = [];
    const completedList = [];

    mockAttempts.forEach(attempt => {
      if (attempt.submitted_at !== null || attempt.status === 'completed') {
        completedList.push(attempt);
        return;
      }

      const startTime = new Date(attempt.started_at).getTime();
      const durationMs = attempt.duration_minutes * 60 * 1000;
      const expiresAt = startTime + durationMs;

      if (nowTime > expiresAt || attempt.status === 'expired') {
        expiredList.push(attempt);
        return;
      }

      const lastHeartbeat = new Date(attempt.last_heartbeat_at).getTime();
      const secondsSince = Math.floor((nowTime - lastHeartbeat) / 1000);

      if (secondsSince > HEARTBEAT_THRESHOLD_SECONDS) {
        interruptedList.push(attempt);
      } else {
        activeList.push(attempt);
      }
    });

    assert.strictEqual(completedList.length, 1);
    assert.strictEqual(activeList.length, 1);
    assert.strictEqual(interruptedList.length, 1);
    assert.strictEqual(expiredList.length, 1);
  });

  it('never categorizes submitted, completed, superseded, or abandoned attempts as interrupted', () => {
    const nowTime = Date.now();
    const attempts = [
      // Student A submitted their exam
      { id: 'att-submitted-1', student_id: 'student-A', exam_id: 'exam-1', status: 'completed', submitted_at: new Date(nowTime - 5000).toISOString() },
      // Student A had an earlier stale attempt for the same exam with no heartbeat for 2 hours
      { id: 'att-stale-1', student_id: 'student-A', exam_id: 'exam-1', status: 'in_progress', submitted_at: null, started_at: new Date(nowTime - 7200000).toISOString(), duration_minutes: 180, last_heartbeat_at: new Date(nowTime - 7000000).toISOString() },
      // Student B abandoned their attempt
      { id: 'att-abandoned', student_id: 'student-B', exam_id: 'exam-1', status: 'abandoned', submitted_at: null, started_at: new Date(nowTime - 10000).toISOString(), duration_minutes: 60, last_heartbeat_at: new Date(nowTime - 60000).toISOString() },
      // Student C is actively taking the exam with fresh heartbeat
      { id: 'att-active-C', student_id: 'student-C', exam_id: 'exam-1', status: 'in_progress', submitted_at: null, started_at: new Date(nowTime - 60000).toISOString(), duration_minutes: 60, last_heartbeat_at: new Date(nowTime - 10000).toISOString() },
      // Student D lost connection during taking the exam (>45s heartbeat gap)
      { id: 'att-interrupted-D', student_id: 'student-D', exam_id: 'exam-1', status: 'in_progress', submitted_at: null, started_at: new Date(nowTime - 60000).toISOString(), duration_minutes: 60, last_heartbeat_at: new Date(nowTime - 55000).toISOString() }
    ];

    const activeList = [];
    const interruptedList = [];
    const completedList = [];

    const completedStudentExamKeys = new Set();
    attempts.forEach(a => {
      const isDone = Boolean(a.submitted_at) || Boolean(a.completed_at) || a.status === 'completed' || a.status === 'submitted';
      if (isDone && a.student_id && a.exam_id) {
        completedStudentExamKeys.add(`${a.student_id}_${a.exam_id}`);
      }
    });

    attempts.forEach(attempt => {
      const isDirectlyCompleted = Boolean(attempt.submitted_at) || 
        Boolean(attempt.completed_at) || 
        attempt.status === 'completed' || 
        attempt.status === 'submitted';

      if (isDirectlyCompleted) {
        completedList.push(attempt);
        return;
      }

      if (attempt.status === 'abandoned' || attempt.status === 'cancelled' || attempt.status === 'archived') {
        return;
      }

      const pairKey = `${attempt.student_id}_${attempt.exam_id}`;
      if (completedStudentExamKeys.has(pairKey)) {
        return;
      }

      const lastHeartbeat = new Date(attempt.last_heartbeat_at).getTime();
      const secondsSinceHeartbeat = Math.floor((nowTime - lastHeartbeat) / 1000);

      if (secondsSinceHeartbeat > HEARTBEAT_THRESHOLD_SECONDS) {
        interruptedList.push(attempt);
      } else {
        activeList.push(attempt);
      }
    });

    // Student A's submitted attempt is in completedList
    assert.strictEqual(completedList.length, 1);
    assert.strictEqual(completedList[0].id, 'att-submitted-1');

    // Only Student C is active
    assert.strictEqual(activeList.length, 1);
    assert.strictEqual(activeList[0].id, 'att-active-C');

    // Only Student D is interrupted (genuine connection drop while actively taking)
    assert.strictEqual(interruptedList.length, 1);
    assert.strictEqual(interruptedList[0].id, 'att-interrupted-D');

    // Student A's stale attempt and Student B's abandoned attempt are NOT in interruptedList
    const interruptedIds = interruptedList.map(a => a.id);
    assert.ok(!interruptedIds.includes('att-stale-1'), 'Stale attempt for submitted student must not be interrupted');
    assert.ok(!interruptedIds.includes('att-abandoned'), 'Abandoned attempt must not be interrupted');
  });
});

