import { getQuestionPattern, getSubjectInterest } from '../../data/exams';
import { useData } from '../../data/useData';
import { Card, Skeleton } from '../../components/ui';

// Segment colors in palette order: primary, warning, gray-400, gray-100.
const SEGMENT_COLORS = ['var(--color-primary)', 'var(--color-warning)', 'var(--color-gray-400)', 'var(--color-gray-100)'];
const PATTERN_COLORS = ['var(--color-primary)', 'var(--color-warning)', 'var(--color-gray-100)'];

// Arc geometry (SVG coords, degrees measured counter-clockwise from +x).
const VB_W = 260;
const VB_H = 170;
const CX = 130;
const CY = 140;
const R_OUT = 118;
const R_IN = 78;
const START = 195;
const END = -15;
const GAP_DEG = 5;

const pt = (r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
};

function sectorPath(fromDeg, toDeg) {
  const large = Math.abs(fromDeg - toDeg) > 180 ? 1 : 0;
  const [x1, y1] = pt(R_OUT, fromDeg);
  const [x2, y2] = pt(R_OUT, toDeg);
  const [x3, y3] = pt(R_IN, toDeg);
  const [x4, y4] = pt(R_IN, fromDeg);
  return `M${x1},${y1} A${R_OUT},${R_OUT} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${R_IN},${R_IN} 0 ${large} 0 ${x4},${y4} Z`;
}

function InterestGauge({ subjects, total }) {
  const span = START - END - GAP_DEG * (subjects.length - 1);
  let cursor = START;
  const segments = subjects.map((s, i) => {
    const sweep = (s.pct / 100) * span;
    const from = cursor;
    const to = cursor - sweep;
    cursor = to - GAP_DEG;
    return (
      <path
        key={s.label}
        d={sectorPath(from, to)}
        fill={SEGMENT_COLORS[i]}
        stroke={SEGMENT_COLORS[i]}
        strokeWidth="8"
        strokeLinejoin="round"
      />
    );
  });

  return (
    <div className="v2-interest__gauge">
      <svg viewBox={`-6 -6 ${VB_W + 12} ${VB_H + 12}`} role="img" aria-label="Most interested subjects">
        {segments}
      </svg>
      <div className="v2-interest__center">
        <span className="v2-interest__center-label">Total Enroll</span>
        <span className="v2-interest__center-num">{total}</span>
      </div>
    </div>
  );
}

function QuestionPattern({ pattern }) {
  return (
    <div className="v2-pattern">
      {pattern.map((p, i) => (
        <div key={p.label} className="v2-pattern__col" style={{ flexBasis: `${p.pct}%` }}>
          <span className="v2-pattern__pct">{p.pct}%</span>
          <span className="v2-pattern__ticks" style={{ '--tick-color': PATTERN_COLORS[i] }} />
          <span className="v2-pattern__legend">
            <span className="v2-swatch" style={{ background: PATTERN_COLORS[i] }} /> {p.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SubjectInsights() {
  const interest = useData(getSubjectInterest);
  const pattern = useData(getQuestionPattern);

  return (
    <Card className="v2-interest">
      <h2 className="v2-side-title">Most Interested Subjects</h2>
      {interest.data ? (
        <>
          <InterestGauge subjects={interest.data.subjects} total={interest.data.totalEnroll} />
          <ul className="v2-interest__legend">
            {interest.data.subjects.map((s, i) => (
              <li key={s.label}>
                <span className="v2-swatch" style={{ background: SEGMENT_COLORS[i] }} />
                <span className="v2-interest__legend-label">{s.label}</span>
                <span className="v2-interest__legend-value">— {s.pct}%</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Skeleton height={230} style={{ marginTop: 16 }} />
      )}

      <hr className="v2-divider" />

      <h2 className="v2-side-title">Comfortable Question Pattern</h2>
      {pattern.data ? <QuestionPattern pattern={pattern.data} /> : <Skeleton height={100} style={{ marginTop: 16 }} />}
    </Card>
  );
}
