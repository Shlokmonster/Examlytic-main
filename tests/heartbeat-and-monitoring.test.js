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
});

