/** "Just now", "5 min ago", "3 hr ago", "Yesterday", "4 days ago" */
export function relativeTime(iso, now = Date.now()) {
  const diff = now - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
}

export const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
