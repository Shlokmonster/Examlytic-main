/** Examlytic mark: a T inside an open ring, drawn in the primary color. */
export default function Logo({ size = 34 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        <path
          d="M11 33.5 A16 16 0 1 1 29 33.5"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="5"
          strokeLinecap="butt"
        />
        <rect x="6" y="14" width="28" height="5" fill="var(--color-primary)" />
        <rect x="17.5" y="14" width="5" height="22" fill="var(--color-primary)" />
      </svg>
      <span
        style={{
          fontSize: 'var(--fs-h2)',
          fontWeight: 'var(--fw-semibold)',
          letterSpacing: 'var(--ls-heading)',
          color: 'var(--color-black)',
          lineHeight: 1,
        }}
      >
        Examlytic
      </span>
    </span>
  );
}
