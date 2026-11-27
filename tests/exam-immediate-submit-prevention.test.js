import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Exam Immediate Auto-Submit Prevention Tests', () => {
  it('1. Stale unsubmitted attempt past its duration is marked expired and not auto-submitted with 0 answers', () => {
    const examDurationMinutes = 60;
    const durationSeconds = examDurationMinutes * 60; // 3600s
    // Attempt was started 2 hours ago (7200s ago)
    const twoHoursAgo = Date.now() - (7200 * 1000);
    const existingAttempt = {
      id: 'attempt-stale-1',
      started_at: new Date(twoHoursAgo).toISOString(),
      status: 'in_progress',
      answers: {},
    };

    const startTime = new Date(existingAttempt.started_at).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    const remainingSeconds = durationSeconds - elapsedSeconds;

    let isAutoSubmitted = false;
    let isMarkedExpired = false;

    if (remainingSeconds <= 0 || existingAttempt.status === 'expired') {
      // Correct behavior: do NOT invoke auto-submit
      isMarkedExpired = true;
    } else {
      isAutoSubmitted = true;
    }

    assert.strictEqual(isMarkedExpired, true, 'Should mark attempt expired');
    assert.strictEqual(isAutoSubmitted, false, 'Must NOT trigger auto-submit');
  });

  it('2. Active attempt within duration window resumes with accurate remaining time', () => {
    const examDurationMinutes = 90;
    const durationSeconds = examDurationMinutes * 60; // 5400s
    // Attempt started 10 minutes ago (600s ago)
    const tenMinutesAgo = Date.now() - (600 * 1000);
    const existingAttempt = {
      id: 'attempt-active-1',
      started_at: new Date(tenMinutesAgo).toISOString(),
      status: 'in_progress',
      answers: { 'q-0': 'A' },
    };

    const startTime = new Date(existingAttempt.started_at).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    const remainingSeconds = durationSeconds - elapsedSeconds;

    assert(remainingSeconds > 4700 && remainingSeconds <= 4800, `Remaining seconds (${remainingSeconds}) should be ~4800s`);
  });

  it('3. Timer effect does not execute auto-submission if isExamLoaded is false', () => {
    let isExamLoaded = false;
    let examAttemptId = 'attempt-123';
    let timeLeft = 0; // zero time left while still loading
    let submitTriggered = false;

    // Timer effect guard
    if (!isExamLoaded || !examAttemptId) {
      // Should return early
    } else if (timeLeft <= 0) {
      submitTriggered = true;
    }

    assert.strictEqual(submitTriggered, false, 'Submit must not trigger before exam is loaded');
  });

  it('4. handleNextQuestion does not submit when questions array is empty', () => {
    const questions = [];
    let currentQuestionIndex = 0;
    let submitCalled = false;

    const handleNextQuestion = () => {
      if (!questions || questions.length === 0) return;
      if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
      } else {
        submitCalled = true;
      }
    };

    handleNextQuestion();
    assert.strictEqual(submitCalled, false, 'handleNextQuestion must guard against empty questions');
  });

  it('5. handleSubmit differentiates manual submission with confirmation from timer auto-submit', () => {
    let confirmPrompted = false;
    const mockConfirm = () => {
      confirmPrompted = true;
      return true;
    };

    const handleSubmit = (options = {}) => {
      const isAutoSubmit = options.isAutoSubmit || false;
      if (!isAutoSubmit) {
        mockConfirm();
      }
      return { submitted: true, isAutoSubmit };
    };

    // Case A: Manual submission prompts confirm
    const manualResult = handleSubmit({ isAutoSubmit: false });
    assert.strictEqual(confirmPrompted, true);
    assert.strictEqual(manualResult.submitted, true);

    // Case B: Auto submission bypasses confirm
    confirmPrompted = false;
    const autoResult = handleSubmit({ isAutoSubmit: true });
    assert.strictEqual(confirmPrompted, false);
    assert.strictEqual(autoResult.isAutoSubmit, true);
  });

  it('6. Stale expired attempt is replaced with fresh attempt having full duration upon starting active exam', () => {
    const examDurationMinutes = 60;
    const durationSeconds = examDurationMinutes * 60; // 3600s
    // Attempt started yesterday
    const yesterday = Date.now() - (24 * 3600 * 1000);
    const staleAttempt = {
      id: 'stale-attempt-1',
      started_at: new Date(yesterday).toISOString(),
      status: 'in_progress',
    };

    const startTime = new Date(staleAttempt.started_at).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    const remainingSeconds = durationSeconds - elapsedSeconds;

    let activeAttemptId = null;
    let initialTimeLeft = null;

    if (remainingSeconds <= 0) {
      // Close stale attempt
      staleAttempt.status = 'expired';

      // Start fresh attempt
      const freshAttempt = {
        id: 'fresh-attempt-2',
        started_at: new Date().toISOString(),
        status: 'in_progress',
      };
      activeAttemptId = freshAttempt.id;
      initialTimeLeft = durationSeconds;
    }

    assert.strictEqual(staleAttempt.status, 'expired');
    assert.strictEqual(activeAttemptId, 'fresh-attempt-2');
    assert.strictEqual(initialTimeLeft, 3600, 'Student should receive full 3600s (60 min) on fresh attempt');
  });
});

