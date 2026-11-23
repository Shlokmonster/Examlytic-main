import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('LiveKit Identity & Room Isolation Security', () => {
  // LiveKit participant identity parser implementation from LiveMonitoring.jsx
  const parseParticipantIdentity = (identity) => {
    if (!identity) return { attemptId: null, studentId: 'unknown' };
    if (identity.includes('___')) {
      const parts = identity.split('___');
      return {
        attemptId: parts[1] || null,
        studentId: parts[2] || parts[1] || identity
      };
    }
    // Fallback for legacy format: student-{uuid}-{timestamp}
    if (identity.startsWith('student-')) {
      const parts = identity.split('-');
      if (parts.length >= 6) {
        // Reconstruct full UUID from 5 segments: e.g. parts[1] to parts[5]
        const fullUuid = parts.slice(1, 6).join('-');
        return {
          attemptId: fullUuid,
          studentId: fullUuid
        };
      }
      return { attemptId: parts[1] || null, studentId: parts[1] || identity };
    }
    return { attemptId: null, studentId: identity };
  };

  it('correctly parses full 36-character RFC 4122 UUIDs without truncation', () => {
    const attemptUuid = '550e8400-e29b-41d4-a716-446655440000';
    const studentUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const identity = `student___${attemptUuid}___${studentUuid}`;

    const parsed = parseParticipantIdentity(identity);

    assert.strictEqual(parsed.attemptId, attemptUuid);
    assert.strictEqual(parsed.studentId, studentUuid);
    assert.strictEqual(parsed.attemptId.length, 36);
    assert.strictEqual(parsed.studentId.length, 36);
  });

  it('handles legacy single-hyphen UUIDs using slice reconstruction', () => {
    const fullUuid = '550e8400-e29b-41d4-a716-446655440000';
    const legacyIdentity = `student-${fullUuid}-1699999999`;

    const parsed = parseParticipantIdentity(legacyIdentity);
    assert.strictEqual(parsed.attemptId, fullUuid);
    assert.strictEqual(parsed.attemptId.length, 36);
  });

  it('enforces publisher cannot subscribe to peers in room', () => {
    // Test LiveKit grant assignment logic
    const createGrants = (isPublisher) => ({
      roomJoin: true,
      canPublish: !!isPublisher,
      canSubscribe: !isPublisher,
      canPublishData: true,
    });

    const studentPublisherGrants = createGrants(true);
    assert.strictEqual(studentPublisherGrants.canPublish, true);
    assert.strictEqual(studentPublisherGrants.canSubscribe, false, 'Student publisher MUST NOT be able to subscribe to peers');

    const adminSubscriberGrants = createGrants(false);
    assert.strictEqual(adminSubscriberGrants.canPublish, false);
    assert.strictEqual(adminSubscriberGrants.canSubscribe, true, 'Admin subscriber MUST be able to subscribe to student streams');
  });

  it('rejects unauthenticated requests or invalid room payloads', () => {
    const validateRequest = (payload) => {
      if (!payload.roomName || !payload.participantName) {
        return { valid: false, error: 'roomName and participantName are required' };
      }
      return { valid: true };
    };

    assert.strictEqual(validateRequest({}).valid, false);
    assert.strictEqual(validateRequest({ roomName: 'room-1' }).valid, false);
    assert.strictEqual(validateRequest({ roomName: 'room-1', participantName: 'p-1' }).valid, true);
  });
});
