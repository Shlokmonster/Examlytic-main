const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/** Today's date as "28th November, 2026" with a superscript ordinal. */
export default function DateLine({ className = '' }) {
  const now = new Date();
  const day = now.getDate();
  return (
    <p className={`v2-dateline body-1 ${className}`}>
      {day}
      <sup>{ordinal(day)}</sup> {MONTHS[now.getMonth()]}, {now.getFullYear()}
    </p>
  );
}
