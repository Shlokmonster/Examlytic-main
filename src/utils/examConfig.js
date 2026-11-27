/**
 * Issue #4 (Phase 2) — exam configuration embedded in `exams.instructions`.
 *
 * Both exam-creation flows (AdminDashboard and CreateExam) append the
 * machine-readable configuration to the human-readable instructions behind a
 * marker:
 *
 *     <instructions>
 *
 *     ---CONFIG---
 *     {"webcam_proctoring":true,"strict_tabs":true,...}
 *
 * The `exams` table has no dedicated `strict_tabs` / `webcam_proctoring`
 * columns, so the student exam flow must read the configuration back out of
 * this payload. This module is the single source of truth for the format, so
 * the reader and the writers can never drift apart.
 *
 * Backwards compatible by design:
 *   - instructions without a marker      -> null  (legacy exams)
 *   - marker present but JSON is invalid -> null  (never throws)
 *   - a real column, if one is ever added, still takes precedence at the call
 *     site, so this parser is purely additive.
 */

export const CONFIG_MARKER = '---CONFIG---';

/**
 * Append the config payload to free-text instructions.
 * Produces exactly the same string as the previous inline template literals
 * (`${instructions}\n\n---CONFIG---\n${JSON.stringify(config)}`).
 */
export function serializeExamConfig(instructions = '', config = {}) {
  return `${instructions}\n\n${CONFIG_MARKER}\n${JSON.stringify(config)}`;
}

/**
 * Extract the config object from an instructions string.
 * Returns a plain object, or `null` when there is nothing usable.
 * Never throws.
 */
export function parseExamConfig(instructions) {
  if (typeof instructions !== 'string' || !instructions) return null;

  // lastIndexOf: the marker is appended last, and free-text instructions could
  // theoretically contain the literal string earlier on.
  const markerIndex = instructions.lastIndexOf(CONFIG_MARKER);
  if (markerIndex === -1) return null;

  const json = instructions.slice(markerIndex + CONFIG_MARKER.length).trim();
  if (!json) return null;

  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    console.warn('[examConfig] Ignoring malformed ---CONFIG--- payload:', err?.message || err);
    return null;
  }
}

/**
 * Return only the human-readable part of an exam's `instructions`.
 *
 * `instructions` may carry the machine-readable config appended behind the
 * `---CONFIG---` marker (see `serializeExamConfig`). That payload must never be
 * shown to candidates, so consumers that render instructions for humans should
 * call this instead of using the raw column.
 *
 *   - no marker                    -> the original string, byte-for-byte
 *                                     (legacy exams keep their exact rendering)
 *   - marker with a valid payload  -> everything before the marker, right-trimmed
 *   - marker without valid JSON    -> the original string (prose that merely
 *                                     mentions the marker is preserved)
 *   - non-string / empty           -> ''
 */
export function getDisplayInstructions(instructions) {
  if (typeof instructions !== 'string' || !instructions) return '';
  const markerIndex = instructions.lastIndexOf(CONFIG_MARKER);
  if (markerIndex === -1) return instructions;
  // Only strip when the trailing payload really is a config object, so prose
  // that happens to contain the marker text is not silently truncated.
  if (!parseExamConfig(instructions)) return instructions;
  return instructions.slice(0, markerIndex).trimEnd();
}

/**
 * Resolve a boolean monitoring flag for an exam.
 *
 * Precedence:
 *   1. a real column on the exam row (future-proof; currently always absent)
 *   2. the embedded `---CONFIG---` payload
 *   3. `fallback` (defaults to enabled = legacy behaviour)
 *
 * Only an explicit `false` disables the flag.
 */
export function resolveExamConfigFlag(exam, key, fallback = true) {
  const embedded = parseExamConfig(exam?.instructions);
  const value = exam?.[key] ?? embedded?.[key];
  return value === undefined || value === null ? fallback : value !== false;
}
