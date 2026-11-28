import { LuCalendar, LuChevronDown, LuTrendingDown, LuTrendingUp } from 'react-icons/lu';
import './components.css';

export function Card({ className = '', children, ...rest }) {
  return (
    <section className={`v2-card ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function Button({ variant = 'primary', size, className = '', children, ...rest }) {
  const classes = ['v2-btn', `v2-btn--${variant}`, size === 'sm' ? 'v2-btn--sm' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}

export function IconButton({ label, variant, size, className = '', children, ...rest }) {
  const classes = [
    'v2-icon-btn',
    variant ? `v2-icon-btn--${variant}` : '',
    size === 'sm' ? 'v2-icon-btn--sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classes} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

/** Pill-shaped native select with a calendar icon, as in "Monthly" / "Today". */
export function SelectPill({ value, options, onChange, label }) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <label className="v2-select">
      <LuCalendar aria-hidden="true" />
      <span>{current.label}</span>
      <LuChevronDown aria-hidden="true" />
      <select aria-label={label} value={value} onChange={(e) => onChange?.(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Change({ value }) {
  const up = value >= 0;
  const Icon = up ? LuTrendingUp : LuTrendingDown;
  return (
    <span className={`v2-change ${up ? 'v2-change--up' : 'v2-change--down'}`}>
      {up ? '+' : ''}
      {value}%
      <Icon aria-hidden="true" />
    </span>
  );
}

export function ProgressRing({ size = 92, stroke = 7, value = 0, trackColor, color, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%', style }) {
  return <div className="v2-skeleton" style={{ height, width, ...style }} aria-hidden="true" />;
}
