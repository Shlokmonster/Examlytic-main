/**
 * Admin v2 Review queue data layer (mock for now).
 *
 * A "case" is one finished attempt whose proctoring events need a human
 * decision. Verdicts live in ./reviewStore (shared with Student Profile).
 *
 * Backend phase:
 *  - cases: exam_attempts (status completed/expired) joined with users + exams,
 *    where the attempt has any high-severity exam_flags row or 3+ events in
 *    exam_flags + exam_logs; ideally a view or RPC `list_review_cases_v1`
 *  - verdicts: the `attempt_reviews` table described in ./reviewStore
 */
import { useMemo, useSyncExternalStore } from 'react';
import { listStudents } from './students';
import { listStudentAttempts } from './studentProfile';
import { getReview, getReviewsVersion, seedReview, subscribeReviews } from './reviewStore';
import { useData } from './useData';
import { alertInfo } from '../utils/alerts';

const DAY = 24 * 60 * 60 * 1000;

export const PRIORITY = {
  high: { label: 'High', tone: 'danger', rank: 0 },
  medium: { label: 'Medium', tone: 'warning', rank: 1 },
  low: { label: 'Low', tone: 'neutral', rank: 2 },
};

/** High-severity events count 3x. Same severities as the Live Monitor alerts. */
function weigh(events) {
  return events.reduce((sum, e) => sum + (alertInfo(e.type).severity === 'danger' ? 3 : 1), 0);
}

const needsReview = (events) => events.length >= 3 || events.some((e) => alertInfo(e.type).severity === 'danger');

function priorityOf(events) {
  const w = weigh(events);
  if (w >= 12) return 'high';
  if (w >= 6) return 'medium';
  return 'low';
}

/** Flag types with counts, most frequent first. */
export function flagBreakdown(events) {
  const counts = {};
  events.forEach((e) => (counts[e.type] = (counts[e.type] || 0) + 1));
  return Object.entries(counts)
    .map(([type, count]) => ({ type, count, ...alertInfo(type) }))
    .sort((a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === 'danger' ? -1 : 1));
}

// A few decisions so the Clean / Suspicious / Cheating tabs aren't empty in the mock.
const SEEDS = [
  [2, { status: 'clean', note: 'Looked away to think, eyes back on screen within seconds. Normal behaviour.' }],
  [5, { status: 'suspicious', note: 'Tab switches line up with the hardest questions. Warned the student.' }],
  [8, { status: 'cheating', note: 'Phone visible on camera at 41:10. Score voided after talking to the student.' }],
];

let cache = null;

async function buildCases() {
  const students = (await listStudents()).filter((s) => s.flags_30d >= 2);
  const attempts = await Promise.all(students.map((s) => listStudentAttempts(s.id)));

  const cases = students
    .map((s, i) => {
      const candidates = attempts[i].filter((a) => needsReview(a.events));
      if (!candidates.length) return null;
      const n = Number(s.id.replace(/\D/g, '')) || 0;
      const attempt = candidates[n % candidates.length];
      return {
        id: attempt.id,
        student: { id: s.id, user_name: s.user_name, email: s.email, user_avatar: s.user_avatar, class_name: s.class_name, roll_no: s.roll_no },
        attempt,
        priority: priorityOf(attempt.events),
        flagged_at: attempt.submitted_at,
      };
    })
    .filter(Boolean);

  SEEDS.forEach(([index, review], k) => {
    if (cases[index]) seedReview(cases[index].id, { ...review, by: 'Priya Nair', at: new Date(Date.now() - (k + 1) * DAY).toISOString() });
  });

  return cases;
}

/** All cases, without verdicts (read those live with getReview). */
export function listReviewCases() {
  if (!cache) cache = buildCases();
  return cache;
}

/** Pending first by priority then newest; decided ones by decision time. */
export function sortCases(list) {
  return [...list].sort((a, b) => {
    if (!a.review && !b.review) {
      return PRIORITY[a.priority].rank - PRIORITY[b.priority].rank || new Date(b.flagged_at) - new Date(a.flagged_at);
    }
    return new Date(b.review?.at || 0) - new Date(a.review?.at || 0);
  });
}

/** Cases with their current verdict; re-renders whenever a verdict changes anywhere. */
export function useReviewCases() {
  const query = useData(listReviewCases);
  const version = useSyncExternalStore(subscribeReviews, getReviewsVersion);
  const cases = useMemo(
    () => (query.data || []).map((c) => ({ ...c, review: getReview(c.id) })),
    // version: re-read verdicts when the store changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, version],
  );
  return { cases, loading: query.loading };
}

/** Number of undecided cases (sidebar badge). */
export function usePendingReviewCount() {
  const { cases, loading } = useReviewCases();
  return loading ? 0 : cases.filter((c) => !c.review).length;
}
