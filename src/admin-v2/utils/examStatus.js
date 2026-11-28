/**
 * Display status for an exam (derived, so it is always right "now"):
 *   draft     – not published yet
 *   scheduled – published, opens in the future
 *   open      – published and accepting attempts (no window, or inside it)
 *   closed    – closed manually or its window has ended
 * Locking (is_active = false) is separate: a locked exam keeps its status
 * but students can't enter it.
 */
export const STATUS_META = {
  draft: { label: 'Draft', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'warning' },
  open: { label: 'Open', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
};

export function examStatus(exam, now = Date.now()) {
  if (exam.status === 'draft') return 'draft';
  if (exam.status === 'closed') return 'closed';
  if (exam.end_at && now > new Date(exam.end_at).getTime()) return 'closed';
  if (exam.start_at && now < new Date(exam.start_at).getTime()) return 'scheduled';
  return 'open';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Aug, 9.00 am" */
export function formatWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const h = d.getHours();
  const h12 = ((h + 11) % 12) + 1;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${h12}.${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}
