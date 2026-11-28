import { alertInfo } from '../../utils/alerts';

export const REVIEW_OPTIONS = [
  { value: 'clean', label: 'Clean', tone: 'success' },
  { value: 'suspicious', label: 'Suspicious', tone: 'warning' },
  { value: 'cheating', label: 'Cheating confirmed', tone: 'danger' },
];

export const REVIEW_LABEL = { none: 'Not reviewed', clean: 'Clean', suspicious: 'Suspicious', cheating: 'Cheating confirmed' };
export const REVIEW_TONE = { none: 'neutral', clean: 'success', suspicious: 'warning', cheating: 'danger' };

export function integrityVerdict(score) {
  if (score >= 90) return { label: 'Trustworthy', tone: 'success' };
  if (score >= 70) return { label: 'Needs review', tone: 'warning' };
  return { label: 'High risk', tone: 'danger' };
}

export const integrityTone = (score) => integrityVerdict(score).tone;

/**
 * Everything the profile shows at the top, derived from the attempts.
 * The sentence is rule-based (no AI) so it is always accurate to the data.
 */
export function summarize(attempts) {
  if (!attempts.length) {
    return { avgScore: 0, integrity: 100, totalFlags: 0, byType: [], verdict: 'Trustworthy', tone: 'success', sentence: 'No exams taken yet.', scoreChange: 0 };
  }

  const avgScore = Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length);
  const integrity = Math.round(attempts.reduce((s, a) => s + a.integrity_score, 0) / attempts.length);
  const totalFlags = attempts.reduce((s, a) => s + a.events.length, 0);
  const clean = attempts.filter((a) => a.events.length === 0).length;

  const counts = {};
  attempts.forEach((a) => a.events.forEach((e) => (counts[e.type] = (counts[e.type] || 0) + 1)));
  const byType = Object.entries(counts)
    .map(([type, count]) => ({ type, label: alertInfo(type).label, count }))
    .sort((a, b) => b.count - a.count);

  const worst = [...attempts].sort((a, b) => b.events.length - a.events.length)[0];
  const { label: verdict, tone } = integrityVerdict(integrity);

  const parts = [];
  parts.push(
    clean === attempts.length
      ? `No proctoring flags in any of ${attempts.length} exams.`
      : `Clean in ${clean} of ${attempts.length} exams.`,
  );
  if (byType[0]) parts.push(`Most common flag: ${byType[0].label.toLowerCase()} (${byType[0].count}).`);
  if (worst && worst.events.length >= 3) parts.push(`${worst.exam_title} needs the closest look with ${worst.events.length} flags.`);

  const last = attempts[attempts.length - 1].score;
  const prevAvg = attempts.length > 1 ? attempts.slice(0, -1).reduce((s, a) => s + a.score, 0) / (attempts.length - 1) : last;
  const scoreChange = Math.round(((last - prevAvg) / prevAvg) * 1000) / 10;

  return { avgScore, integrity, totalFlags, byType, verdict, tone, sentence: parts.join(' '), scoreChange };
}
