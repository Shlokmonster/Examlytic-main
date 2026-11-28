/**
 * Shared reviewer verdicts (mock, in-memory), keyed by attempt id.
 * Used by the Review queue and the Student Profile attempt review, so a
 * decision made in one shows up in the other.
 *
 * Backend phase: an `attempt_reviews` table
 *   (attempt_id PK, status: clean | suspicious | cheating, note, reviewer_id, decided_at).
 * This replaces the old app's "Report incident", which wrote an undefined
 * exam_attempts.status = 'flagged'.
 */
const REVIEWS = new Map();
const listeners = new Set();
let version = 0;

export const getReview = (attemptId) => REVIEWS.get(attemptId) || null;
export const getReviewsVersion = () => version;

/** review = { status, note, by?, at? }; status 'none' removes the decision (reopen). */
export function setReview(attemptId, review) {
  if (!review || review.status === 'none') REVIEWS.delete(attemptId);
  else REVIEWS.set(attemptId, { by: 'You', at: new Date().toISOString(), ...review });
  version += 1;
  listeners.forEach((fn) => fn());
}

/** Seed without notifying (used once by the mock queue). */
export function seedReview(attemptId, review) {
  if (!REVIEWS.has(attemptId)) REVIEWS.set(attemptId, review);
}

export function subscribeReviews(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
