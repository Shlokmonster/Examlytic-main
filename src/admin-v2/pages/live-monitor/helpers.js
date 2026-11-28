export { alertInfo } from '../../utils/alerts';

export function clockTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Seconds left for a session given its own start time and the exam duration. */
export function secondsLeft(session, exam, now) {
  if (!exam) return 0;
  const end = new Date(session.started_at).getTime() + exam.duration_minutes * 60 * 1000;
  return Math.max(0, (end - now) / 1000);
}

export function connectionOf(session) {
  if (session.status === 'completed') return 'submitted';
  if (session.status === 'interrupted' || session.stream_status === 'STREAM_RECONNECTING') return 'reconnecting';
  if (session.stream_status === 'STREAM_DISCONNECTED') return 'lost';
  return 'live';
}
