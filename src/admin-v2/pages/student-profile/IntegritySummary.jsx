import { Card } from '../../components/ui';

const TICKS = 56;
const SIZE = 156;
const TONE_COLOR = { success: 'var(--color-success)', warning: 'var(--color-warning)', danger: 'var(--color-danger)' };

/** Tick ring filled up to the score (0–100). */
function ScoreRing({ score, tone }) {
  const c = SIZE / 2;
  const rOuter = c - 2;
  const rInner = rOuter - 14;
  return (
    <div className="v2-integrity__ring" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} aria-hidden="true">
        {Array.from({ length: TICKS }, (_, i) => {
          const t = i / TICKS;
          const a = (t * 360 - 90) * (Math.PI / 180);
          return (
            <line
              key={i}
              x1={c + rInner * Math.cos(a)}
              y1={c + rInner * Math.sin(a)}
              x2={c + rOuter * Math.cos(a)}
              y2={c + rOuter * Math.sin(a)}
              stroke={t < score / 100 ? TONE_COLOR[tone] : 'var(--color-gray-100)'}
              strokeWidth="4"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="v2-integrity__center">
        <span className="v2-integrity__center-num">{score}</span>
        <span className="v2-integrity__center-label">out of 100</span>
      </div>
    </div>
  );
}

export default function IntegritySummary({ summary }) {
  const max = Math.max(1, ...summary.byType.map((t) => t.count));

  return (
    <Card className="v2-integrity-summary">
      <div className="v2-card-head">
        <h2 className="h2">Integrity Summary</h2>
        <span className={`v2-pill v2-pill--${summary.tone}`}>{summary.verdict}</span>
      </div>

      <div className="v2-integrity-summary__top">
        <ScoreRing score={summary.integrity} tone={summary.tone} />
        <p className="v2-integrity-summary__sentence">{summary.sentence}</p>
      </div>

      {summary.byType.length > 0 ? (
        <ul className="v2-violations__list">
          {summary.byType.slice(0, 5).map((t) => (
            <li key={t.type}>
              <div className="v2-violations__row">
                <span>{t.label}</span>
                <strong>{t.count}</strong>
              </div>
              <span className="v2-violations__track">
                <span className="v2-violations__fill" style={{ transform: `scaleX(${t.count / max})` }} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="v2-profile-empty">No proctoring flags recorded for this student.</p>
      )}
    </Card>
  );
}
