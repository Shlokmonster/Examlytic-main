/**
 * Issue #4 — Canonical student-side exam activity logging.
 *
 * Single source of truth for writing student proctoring activity into the
 * `exam_logs` table. Every exam event (TAB_SWITCH, WINDOW_BLUR,
 * FULLSCREEN_EXIT, SCREEN_SHARE_STOPPED, RIGHT_CLICK, COPY_CUT_PASTE,
 * KEYBOARD_SHORTCUT, EXAM_STARTED, EXAM_ENDED, ...) must go through
 * `logExamEvent`.
 *
 * Reliability model:
 *   1. insert
 *   2. short retry (2 attempts, small backoff) for transient failures
 *   3. persistent failure -> localStorage queue keyed to the attempt
 *   4. queue is flushed on `online`, on visibility returning, and before the
 *      next event insert.
 *
 * Logging must never block exam submission or throw into the UI.
 */
import supabase from "../SupabaseClient";

export const EXAM_LOGS_TABLE = "exam_logs";
export const QUEUE_STORAGE_KEY = "examlytic.pendingExamEvents.v1";

const MAX_QUEUE = 200;
const MAX_PENDING_ATTEMPT_EVENTS = 50;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 700;

/**
 * Events detected before the exam attempt row exists are held here (in memory,
 * per browser tab) and flushed with the real `exam_attempt_id` once it is
 * known. We never write a permanent `exam_attempt_id: null` row for normal
 * activity.
 */
let pendingAttemptEvents = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isNonRetryable = (error) => {
  if (!error) return false;
  // 23503 FK violation, 42501 insufficient privilege, 401/403 auth errors
  return ["23503", "42501", "401", "403"].includes(String(error.code));
};

function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((row) => row && row.event_type) : [];
  } catch (err) {
    console.warn("[examActivity] Could not read offline queue:", err);
    return [];
  }
}

function writeQueue(rows) {
  try {
    if (!rows.length) {
      localStorage.removeItem(QUEUE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(rows.slice(-MAX_QUEUE)));
  } catch (err) {
    console.warn("[examActivity] Could not persist offline queue:", err);
  }
}

export function getQueuedExamEventCount() {
  return readQueue().length;
}

function queueExamLog(row) {
  const queue = readQueue();
  queue.push({ ...row, queued_at: new Date().toISOString() });
  writeQueue(queue);
}

/**
 * Insert a single exam_logs row with a bounded retry.
 * Returns { ok, error } and never throws.
 */
export async function insertExamLog(row) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const { error } = await supabase.from(EXAM_LOGS_TABLE).insert([row]);
      if (!error) return { ok: true, error: null };
      lastError = error;
      if (isNonRetryable(error)) break;
    } catch (err) {
      lastError = err;
    }
    if (attempt < MAX_RETRIES) await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
  }

  console.error("[examActivity] Failed to insert exam event after retries:", {
    eventType: row?.event_type,
    error: lastError?.message || lastError,
  });
  return { ok: false, error: lastError };
}

function buildRow({ eventType, details, examId, attemptId, studentId }) {
  return {
    exam_attempt_id: attemptId,
    student_id: studentId,
    event_type: eventType,
    event_details: {
      ...(details || {}),
      exam_id: examId ?? details?.exam_id ?? null,
      client_timestamp: new Date().toISOString(),
    },
  };
}

/** Flush in-memory events that were detected before the attempt id existed. */
export async function flushPendingAttemptEvents(ctx = {}) {
  const { attemptId, studentId, examId } = ctx;
  if (!attemptId || !studentId || pendingAttemptEvents.length === 0) return 0;

  const pending = pendingAttemptEvents;
  pendingAttemptEvents = [];

  let flushed = 0;
  for (const ev of pending) {
    const row = buildRow({
      eventType: ev.eventType,
      details: ev.details,
      examId: ev.examId ?? examId,
      attemptId,
      studentId: ev.studentId ?? studentId,
    });
    // Sequential on purpose: the insert ordering matters for the timeline.
    const result = await insertExamLog(row);
    if (result.ok) flushed += 1;
    else queueExamLog(row);
  }
  if (flushed) console.log(`[examActivity] Flushed ${flushed} buffered event(s) with attempt ${attemptId}`);
  return flushed;
}

/**
 * Canonical logger.
 *
 * @param {string} eventType canonical UPPER_SNAKE_CASE event name
 * @param {object} details   event payload (stored in event_details)
 * @param {object} ctx       { attemptId, studentId, examId }
 */
export async function logExamEvent(eventType, details = {}, ctx = {}) {
  const { attemptId = null, studentId = null, examId = null } = ctx || {};

  if (!eventType) return { ok: false, error: new Error("eventType is required") };

  // Exam activity must never be written with a null/foreign attempt id, so we
  // hold events that are detected before the attempt row (and the authenticated
  // student id) are known and flush them once both are available.
  if (!attemptId || !studentId) {
    pendingAttemptEvents.push({ eventType, details, examId, studentId });
    if (pendingAttemptEvents.length > MAX_PENDING_ATTEMPT_EVENTS) pendingAttemptEvents.shift();
    console.log(`[examActivity] Buffered ${eventType} until attempt id + student id are available`);
    return { ok: false, buffered: true, error: null };
  }

  // Opportunistically flush anything buffered before this attempt existed.
  if (pendingAttemptEvents.length) {
    await flushPendingAttemptEvents({ attemptId, studentId, examId });
  }

  const row = buildRow({ eventType, details, examId, attemptId, studentId });
  const result = await insertExamLog(row);
  if (!result.ok) queueExamLog(row);
  return result;
}

/** Try to replay locally-queued events. Safe to call often. */
export async function flushQueuedExamEvents() {
  const queue = readQueue();
  if (queue.length === 0) return 0;

  const remaining = [];
  let flushed = 0;
  for (const row of queue) {
    // Sequential on purpose: preserve insert order.
    const result = await insertExamLog(row);
    if (result.ok) flushed += 1;
    else remaining.push(row);
  }
  writeQueue(remaining);
  if (flushed) console.log(`[examActivity] Flushed ${flushed} queued event(s) from localStorage`);
  return flushed;
}

/** Test/utility helper — clears the offline queue. */
export function clearQueuedExamEvents() {
  pendingAttemptEvents = [];
  writeQueue([]);
}
