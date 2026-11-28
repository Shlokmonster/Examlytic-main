import { LuArrowUpRight, LuTrendingUp } from 'react-icons/lu';
import { getResultOverview } from '../../data/dashboard';
import { useData } from '../../data/useData';
import { Card, IconButton, Skeleton } from '../../components/ui';

const TICKS = 64;
const SIZE = 196;

/** Ring of tick marks split into Top (primary), Average (warning) and Fail (danger). */
function TickGauge({ top, average, total }) {
  const cx = SIZE / 2;
  const rOuter = SIZE / 2 - 2;
  const rInner = rOuter - 18;
  const startDeg = -60; // starts at about 10 o'clock and runs clockwise
  const topEnd = top / 100;
  const avgEnd = topEnd + average / 100;

  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const t = i / TICKS;
    const a = ((startDeg + t * 360 - 90) * Math.PI) / 180;
    let stroke = 'var(--color-danger)';
    let opacity = 1;
    if (t < topEnd) stroke = 'var(--color-primary)';
    else if (t < avgEnd) {
      stroke = 'var(--color-warning)';
      opacity = 0.45;
    }
    return (
      <line
        key={i}
        x1={cx + rInner * Math.cos(a)}
        y1={cx + rInner * Math.sin(a)}
        x2={cx + rOuter * Math.cos(a)}
        y2={cx + rOuter * Math.sin(a)}
        stroke={stroke}
        strokeOpacity={opacity}
        strokeWidth="4"
        strokeLinecap="round"
      />
    );
  });

  return (
    <div className="v2-gauge" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} aria-hidden="true">
        {ticks}
      </svg>
      <div className="v2-gauge__center">
        <span className="v2-gauge__label">Total Students</span>
        <span className="v2-gauge__num">{total}</span>
      </div>
    </div>
  );
}

function LegendRow({ tone, label, pct, students }) {
  return (
    <li className={`v2-result-legend__row v2-result-legend__row--${tone}`}>
      <span className="v2-result-legend__label">{label}</span>
      <span className="v2-result-legend__stats">
        <span>{pct}%</span>
        <span className="v2-result-legend__sep" aria-hidden="true" />
        <span>{students} Students</span>
      </span>
    </li>
  );
}

export default function ResultOverview() {
  const { data, loading } = useData(getResultOverview);

  return (
    <Card className="v2-results">
      <div className="v2-card-head">
        <h2 className="h2">Result Overview</h2>
        <IconButton label="Open results">
          <LuArrowUpRight />
        </IconButton>
      </div>

      {loading || !data ? (
        <Skeleton height={220} />
      ) : (
        <>
          <p className="v2-results__cgpa">
            Average CGPA : <span className="v2-results__cgpa-num">{data.averageCgpa}</span>
            <span className="v2-results__change">
              +{data.cgpaChange}% <LuTrendingUp aria-hidden="true" />
            </span>
          </p>

          <div className="v2-results__body">
            <TickGauge top={data.top.pct} average={data.average.pct} total={data.totalStudents} />
            <ul className="v2-result-legend">
              <LegendRow tone="primary" label="Top Result" pct={data.top.pct} students={data.top.students} />
              <LegendRow tone="warning" label="Average Result" pct={data.average.pct} students={data.average.students} />
              <LegendRow tone="danger" label="Fail" pct={data.fail.pct} students={data.fail.students} />
            </ul>
          </div>
        </>
      )}
    </Card>
  );
}
