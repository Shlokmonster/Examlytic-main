import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ==============================================================================
 * SUITE A: [Unit / Logic Simulation] Security & Authorization Boundaries
 * Tests simulating PostgreSQL triggers, RLS policies, and RPC constraints.
 * ==============================================================================
 */
describe('[Unit / Logic Simulation] Security & Authorization Boundaries', () => {

  // Logic simulation of get_student_exam_questions_v1 RPC
  const simulateGetStudentQuestionsRPC = ({ caller, exam, attempts }) => {
    if (!caller || !caller.id) {
      return { success: false, error: 'Authentication required.', code: '42501' };
    }
    if (!exam) {
      return { success: false, error: 'Exam not found', code: 'P0002' };
    }
    const isAdmin = caller.role === 'admin';
    if (!isAdmin) {
      if (exam.is_active === false) {
        return { success: false, error: 'Exam is currently unavailable or inactive.', code: '42501' };
      }
      const activeAttempt = attempts.find(a => 
        a.exam_id === exam.id &&
        a.student_id === caller.id &&
        ['in_progress', 'interrupted'].includes(a.status) &&
        !a.submitted_at
      );
      if (!activeAttempt) {
        return { success: false, error: 'Access denied: You do not have an active in-progress attempt for this examination.', code: '42501' };
      }
    }

    if (isAdmin) {
      return { success: true, questions: exam.questions };
    }

    // Sanitize questions for student: strip all answers, keys, rubrics
    const sanitizedQuestions = exam.questions.map((q, idx) => {
      const safe = { ...q };
      delete safe.correct_answer;
      delete safe.correctAnswer;
      delete safe.answer;
      delete safe.expected_answer;
      delete safe.expectedAnswer;
      delete safe.answer_key;
      delete safe.answerKey;
      delete safe.explanation;
      delete safe.solution;
      delete safe.grading_rubric;
      delete safe.points_breakdown;
      if (!safe.id) safe.id = `q-${idx}`;
      return safe;
    });

    return { success: true, questions: sanitizedQuestions };
  };

  // Logic simulation of protect_exam_attempts_update trigger
  const simulateExamAttemptsTrigger = ({ caller, oldRow, newRow }) => {
    if (caller.role === 'service_role' || caller.role === 'admin') {
      return { allowed: true, row: newRow };
    }

    // Immutable relationship fields
    if (newRow.student_id !== oldRow.student_id) {
      return { allowed: false, field: 'student_id', error: 'Cannot reassign student_id on an exam attempt.', code: '42501' };
    }
    if (newRow.exam_id !== oldRow.exam_id) {
      return { allowed: false, field: 'exam_id', error: 'Cannot reassign exam_id on an exam attempt.', code: '42501' };
    }
    if (newRow.started_at !== oldRow.started_at) {
      return { allowed: false, field: 'started_at', error: 'Exam start timestamp is immutable.', code: '42501' };
    }

    // Server-controlled lifecycle and scoring fields
    if (newRow.score !== oldRow.score) {
      return { allowed: false, field: 'score', error: 'Students cannot directly alter examination scores.', code: '42501' };
    }
    if (newRow.status !== oldRow.status) {
      return { allowed: false, field: 'status', error: 'Students cannot directly alter lifecycle status.', code: '42501' };
    }
    if (newRow.submitted_at !== oldRow.submitted_at) {
      return { allowed: false, field: 'submitted_at', error: 'Direct modification of submitted_at is prohibited.', code: '42501' };
    }
    if (newRow.completed_at !== oldRow.completed_at) {
      return { allowed: false, field: 'completed_at', error: 'Direct modification of completed_at is prohibited.', code: '42501' };
    }
    if (newRow.last_heartbeat_at !== oldRow.last_heartbeat_at) {
      return { allowed: false, field: 'last_heartbeat_at', error: 'Direct modification of last_heartbeat_at is prohibited.', code: '42501' };
    }

    // Terminal attempt protection
    if (['completed', 'expired', 'terminated', 'abandoned'].includes(oldRow.status) || oldRow.submitted_at) {
      if (JSON.stringify(newRow.answers) !== JSON.stringify(oldRow.answers)) {
        return { allowed: false, field: 'answers', error: 'Cannot modify answers on a closed exam attempt.', code: '42501' };
      }
    }

    // Legitimate autosaving and media attachments are permitted
    return { allowed: true, row: newRow };
  };

  // Logic simulation of user role triggers (enforce_new_user_default_role & protect_user_role_elevation)
  const simulateUserRoleTrigger = ({ operation, caller, oldRow, newRow }) => {
    if (caller.role === 'service_role' || caller.role === 'admin') {
      return { allowed: true, row: newRow };
    }

    if (operation === 'INSERT') {
      // Non-admin insert: role is forced to 'student'
      return { allowed: true, row: { ...newRow, role: 'student' } };
    }

    if (operation === 'UPDATE') {
      if (newRow.role !== oldRow.role) {
        return { allowed: false, error: 'Unauthorized: Users cannot modify their security authorization role.', code: '42501' };
      }
      return { allowed: true, row: newRow };
    }

    return { allowed: false };
  };

  // Logic simulation of audit flags & logs triggers
  const simulateAuditTrigger = ({ table, operation, caller, oldRow, newRow, attempts }) => {
    const isAdmin = caller.role === 'service_role' || caller.role === 'admin';

    if (operation === 'DELETE') {
      if (!isAdmin) return { allowed: false, error: 'Audit records are immutable and cannot be deleted.', code: '42501' };
      return { allowed: true };
    }

    if (operation === 'UPDATE') {
      if (!isAdmin) return { allowed: false, error: 'Audit records are immutable and cannot be modified.', code: '42501' };
      return { allowed: true, row: newRow };
    }

    if (operation === 'INSERT') {
      if (!caller.id) return { allowed: false, error: 'Authentication required.', code: '42501' };

      const studentIdField = table === 'exam_flags' ? 'user_id' : 'student_id';
      if (!isAdmin) {
        if (newRow[studentIdField] && newRow[studentIdField] !== caller.id) {
          return { allowed: false, error: 'Cannot insert audit record on behalf of another user.', code: '42501' };
        }
        if (newRow.exam_attempt_id) {
          const attempt = attempts.find(a => a.id === newRow.exam_attempt_id);
          if (!attempt) return { allowed: false, error: 'Referenced examination attempt not found.', code: 'P0002' };
          if (attempt.student_id !== caller.id) {
            return { allowed: false, error: 'Cannot attach audit record to another student examination attempt.', code: '42501' };
          }
          if (newRow.exam_id && newRow.exam_id !== attempt.exam_id) {
            return { allowed: false, error: 'Exam ID does not match attempt exam ID.', code: '42501' };
          }
        }
      }
      return { allowed: true, row: { ...newRow, [studentIdField]: caller.id } };
    }

    return { allowed: false };
  };

  // TEST 1: Authenticated student requests another exam's questions (without attempt)
  it('1. rejects authenticated student requesting questions without an active attempt', () => {
    const student = { id: 'student-101', role: 'student' };
    const exam = { id: 'exam-math-1', is_active: true, questions: [{ id: 'q1', text: 'Solve x' }] };
    const attempts = []; // No attempt exists for student-101

    const result = simulateGetStudentQuestionsRPC({ caller: student, exam, attempts });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, '42501');
    assert.match(result.error, /do not have an active in-progress attempt/i);
  });

  // TEST 2: Student directly modifies submitted_at
  it('2. rejects student direct modification of submitted_at', () => {
    const student = { id: 'student-101', role: 'student' };
    const oldRow = { id: 'att-1', student_id: 'student-101', exam_id: 'ex-1', started_at: '2026-11-23T10:00:00Z', submitted_at: null, status: 'in_progress', score: 0 };
    const newRow = { ...oldRow, submitted_at: '2026-11-23T10:30:00Z' };

    const result = simulateExamAttemptsTrigger({ caller: student, oldRow, newRow });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.field, 'submitted_at');
  });

  // TEST 3: Student directly modifies completed_at
  it('3. rejects student direct modification of completed_at', () => {
    const student = { id: 'student-101', role: 'student' };
    const oldRow = { id: 'att-1', student_id: 'student-101', exam_id: 'ex-1', started_at: '2026-11-23T10:00:00Z', completed_at: null, status: 'in_progress', score: 0 };
    const newRow = { ...oldRow, completed_at: '2026-11-23T10:30:00Z' };

    const result = simulateExamAttemptsTrigger({ caller: student, oldRow, newRow });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.field, 'completed_at');
  });

  // TEST 4: Student directly modifies status
  it('4. rejects student direct modification of status (e.g. marking completed directly)', () => {
    const student = { id: 'student-101', role: 'student' };
    const oldRow = { id: 'att-1', student_id: 'student-101', exam_id: 'ex-1', started_at: '2026-11-23T10:00:00Z', status: 'in_progress', score: 0 };
    const newRow = { ...oldRow, status: 'completed' };

    const result = simulateExamAttemptsTrigger({ caller: student, oldRow, newRow });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.field, 'status');
  });

  // TEST 5: Student directly modifies last_heartbeat_at
  it('5. rejects student direct modification of last_heartbeat_at via table update', () => {
    const student = { id: 'student-101', role: 'student' };
    const oldRow = { id: 'att-1', student_id: 'student-101', exam_id: 'ex-1', started_at: '2026-11-23T10:00:00Z', last_heartbeat_at: '2026-11-23T10:00:00Z', status: 'in_progress' };
    const newRow = { ...oldRow, last_heartbeat_at: '2026-11-23T10:15:00Z' };

    const result = simulateExamAttemptsTrigger({ caller: student, oldRow, newRow });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.field, 'last_heartbeat_at');
  });

  // TEST 6: Student attempts to change score
  it('6. rejects student directly tampering with score column', () => {
    const student = { id: 'student-101', role: 'student' };
    const oldRow = { id: 'att-1', student_id: 'student-101', exam_id: 'ex-1', started_at: '2026-11-23T10:00:00Z', score: 30, status: 'in_progress' };
    const newRow = { ...oldRow, score: 100 };

    const result = simulateExamAttemptsTrigger({ caller: student, oldRow, newRow });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.field, 'score');
  });

  // Legitimate autosaving verification
  it('allows legitimate answer autosaving on active in_progress attempts', () => {
    const student = { id: 'student-101', role: 'student' };
    const oldRow = { id: 'att-1', student_id: 'student-101', exam_id: 'ex-1', started_at: '2026-11-23T10:00:00Z', answers: { q1: 'A' }, status: 'in_progress', score: 0 };
    const newRow = { ...oldRow, answers: { q1: 'A', q2: 'B' } };

    const result = simulateExamAttemptsTrigger({ caller: student, oldRow, newRow });
    assert.strictEqual(result.allowed, true);
    assert.deepStrictEqual(result.row.answers, { q1: 'A', q2: 'B' });
  });

  // TEST 7: Student attempts role elevation during profile insertion
  it('7. forces role to student when non-admin registers or inserts with admin role', () => {
    const studentCaller = { id: 'new-user-1', role: 'anon' };
    const maliciousInsert = { id: 'new-user-1', email: 'attacker@example.com', role: 'admin' };

    const result = simulateUserRoleTrigger({ operation: 'INSERT', caller: studentCaller, newRow: maliciousInsert });
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.row.role, 'student', 'Role MUST be forced to student on non-admin INSERT');
  });

  // TEST 8: Student attempts role elevation during profile update
  it('8. rejects role elevation update by non-admin student', () => {
    const studentCaller = { id: 'student-101', role: 'student' };
    const oldRow = { id: 'student-101', role: 'student', email: 'student@example.com' };
    const newRow = { id: 'student-101', role: 'admin', email: 'student@example.com' };

    const result = simulateUserRoleTrigger({ operation: 'UPDATE', caller: studentCaller, oldRow, newRow });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.code, '42501');
  });

  // TEST 9: Student inserts a flag for another student's attempt
  it('9. rejects student attaching a proctoring flag to another students attempt', () => {
    const studentA = { id: 'student-A', role: 'student' };
    const attempts = [{ id: 'att-B', student_id: 'student-B', exam_id: 'ex-1' }];
    const crossStudentFlag = { user_id: 'student-A', exam_attempt_id: 'att-B', exam_id: 'ex-1', flag_type: 'TAB_SWITCH' };

    const result = simulateAuditTrigger({ table: 'exam_flags', operation: 'INSERT', caller: studentA, newRow: crossStudentFlag, attempts });
    assert.strictEqual(result.allowed, false);
    assert.match(result.error, /another student/i);
  });

  // TEST 10: Student inserts a log for another student's attempt
  it('10. rejects student attaching an audit log to another students attempt', () => {
    const studentA = { id: 'student-A', role: 'student' };
    const attempts = [{ id: 'att-B', student_id: 'student-B', exam_id: 'ex-1' }];
    const crossStudentLog = { student_id: 'student-A', exam_attempt_id: 'att-B', exam_id: 'ex-1', event_type: 'WEBCAM_DISCONNECTED' };

    const result = simulateAuditTrigger({ table: 'exam_logs', operation: 'INSERT', caller: studentA, newRow: crossStudentLog, attempts });
    assert.strictEqual(result.allowed, false);
    assert.match(result.error, /another student/i);
  });

  // Immutability of audit evidence
  it('prevents students from updating or deleting historical audit flags and logs', () => {
    const studentA = { id: 'student-A', role: 'student' };
    const flagRow = { id: 'flg-1', user_id: 'student-A', flag_type: 'MULTIPLE_FACES' };

    const updateResult = simulateAuditTrigger({ table: 'exam_flags', operation: 'UPDATE', caller: studentA, oldRow: flagRow, newRow: { ...flagRow, flag_type: 'NORMAL' } });
    assert.strictEqual(updateResult.allowed, false);
    assert.match(updateResult.error, /immutable/i);

    const deleteResult = simulateAuditTrigger({ table: 'exam_flags', operation: 'DELETE', caller: studentA, oldRow: flagRow });
    assert.strictEqual(deleteResult.allowed, false);
    assert.match(deleteResult.error, /cannot be deleted/i);
  });

  // TEST 11: Unauthenticated user calls privileged RPCs
  it('11. rejects unauthenticated caller on privileged examination RPCs', () => {
    const unauthCaller = null;
    const exam = { id: 'ex-1', is_active: true, questions: [] };

    const result = simulateGetStudentQuestionsRPC({ caller: unauthCaller, exam, attempts: [] });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, '42501');
    assert.match(result.error, /authentication required/i);
  });
});

/**
 * ==============================================================================
 * SUITE B: [Schema Contract & Static Inspection] Database Migration Permissions
 * Inspects supabase/migrations/20261123_exam_security_reliability_hardening.sql
 * directly to verify exact SQL declarations, search paths, and privilege revokes.
 * ==============================================================================
 */
describe('[Schema Contract & Static Inspection] Database Migration Permissions', () => {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261123_exam_security_reliability_hardening.sql');
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');

  // TEST 12: PUBLIC execution permissions are checked and revoked
  it('12. explicitly revokes ALL and anon privileges on all SECURITY DEFINER functions', () => {
    const targetFunctions = [
      'record_student_heartbeat(UUID, VARCHAR)',
      'record_student_heartbeat_v2(UUID, VARCHAR)',
      'get_student_exam_questions_v1(UUID)',
      'save_student_answers_v1(UUID, JSONB)',
      'submit_student_exam_attempt_v1(UUID, JSONB)',
    ];

    targetFunctions.forEach(fn => {
      // Must revoke from PUBLIC
      const revokePublicRegex = new RegExp(`REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${fn.replace('(', '\\(').replace(')', '\\)')}\\s+FROM\\s+PUBLIC;`, 'i');
      assert.ok(revokePublicRegex.test(sqlContent), `Migration MUST revoke PUBLIC permissions on ${fn}`);

      // Must revoke from anon
      const revokeAnonRegex = new RegExp(`REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${fn.replace('(', '\\(').replace(')', '\\)')}\\s+FROM\\s+anon;`, 'i');
      assert.ok(revokeAnonRegex.test(sqlContent), `Migration MUST revoke anon permissions on ${fn}`);

      // Must grant execute to authenticated
      const grantAuthRegex = new RegExp(`GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${fn.replace('(', '\\(').replace(')', '\\)')}\\s+TO\\s+authenticated;`, 'i');
      assert.ok(grantAuthRegex.test(sqlContent), `Migration MUST grant execute to authenticated on ${fn}`);
    });
  });

  it('verifies explicit search_path = public, pg_temp on all SECURITY DEFINER functions', () => {
    const secDefinerCount = (sqlContent.match(/LANGUAGE\s+plpgsql\s+SECURITY\s+DEFINER/gi) || []).length;
    const searchPathCount = (sqlContent.match(/SET\s+search_path\s*=\s*public,\s*pg_temp/gi) || []).length;

    assert.ok(secDefinerCount > 0, 'Must have SECURITY DEFINER functions');
    assert.strictEqual(
      searchPathCount,
      secDefinerCount,
      'Every SECURITY DEFINER function MUST specify explicit SET search_path = public, pg_temp'
    );
  });

  it('verifies no destructive table drops or resets are present in the migration', () => {
    assert.doesNotMatch(sqlContent, /DROP\s+TABLE/i, 'Migration MUST NOT contain DROP TABLE statements');
    assert.doesNotMatch(sqlContent, /TRUNCATE\s+TABLE/i, 'Migration MUST NOT contain TRUNCATE TABLE statements');
    assert.doesNotMatch(sqlContent, /DELETE\s+FROM\s+public\.exam/i, 'Migration MUST NOT delete historical records');
  });

  it('verifies presence of all 5 defensive triggers in migration', () => {
    const requiredTriggers = [
      'trg_protect_exam_attempts',
      'trg_protect_user_role',
      'trg_enforce_user_default_role',
      'trg_validate_exam_flag_audit',
      'trg_validate_exam_log_audit',
    ];

    requiredTriggers.forEach(trg => {
      assert.ok(sqlContent.includes(trg), `Migration MUST declare trigger: ${trg}`);
    });
  });
});
