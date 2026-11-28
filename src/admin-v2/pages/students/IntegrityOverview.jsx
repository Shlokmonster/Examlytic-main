import { getIntegrityOverview } from '../../data/students';
import { useData } from '../../data/useData';
import { Card, Skeleton } from '../../components/ui';

const TICKS = 60;
const SIZE = 168;

const BANDS = [
  { key: 'high', label: 'High', range: '90 – 100', color: 'var(--color-primary)' },
  { key: 'medium', label: 'Medium', range: '70 – 89', color: 'var(--color-warning)' },
  { key: 'low', label: 'Low', range: 'Below 70', color: 'var(--color-danger)' },
];

function TickRing({ counts, total }) {
  const c = SIZE / 2;
  const rOuter = c - 2;
  const rInner = rOuter - 16;
  const cuts = [];
  let acc = 0;
  BANDS.forEach((b) => {
    acc += counts[b.key] / total;
    cuts.push(acc);
  });

  return (
    <div className="v2-integrity__ring" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} aria-hidden="true">
        {Array.from({ length: TICKS }, (_, i) => {
          const t = i / TICKS;
          const band = BANDS[cuts.findIndex((cut) => t < cut)] || BANDS[BANDS.length - 1];
          const a = (t * 360 - 90) * (Math.PI / 180);
          return (
            <line
              key={i}
              x1={c + rInner * Math.cos(a)}
              y1={c + rInner * Math.sin(a)}
              x2={c + rOuter * Math.cos(a)}
              y2={c + rOuter * Math.sin(a)}
              stroke={band.color}
              strokeWidth="4"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="v2-integrity__center">
        <span className="v2-integrity__center-num">{total}</span>
        <span className="v2-integrity__center-label">Students</span>
      </div>
    </div>
  );
}

export default function IntegrityOverview() {
  const { data } = useData(getIntegrityOverview);

  return (
    <Card className="v2-integrity">
      <h2 className="v2-side-title">Integrity Overview</h2>
      {!data ? (
        <Skeleton height={180} style={{ marginTop: 16 }} />
      ) : (
        <div className="v2-integrity__body">
          <TickRing counts={data} total={data.total} />
          <ul className="v2-integrity__legend">
            {BANDS.map((b) => (
              <li key={b.key} style={{ '--band-color': b.color }}>
                <span className="v2-integrity__legend-label">{b.label}</span>
                <span className="v2-integrity__legend-stats">
                  <strong>{data[b.key]}</strong> · {b.range}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
