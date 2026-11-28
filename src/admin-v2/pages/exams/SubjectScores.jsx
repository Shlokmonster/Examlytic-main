import { LuArrowUpRight } from 'react-icons/lu';
import { getSubjectScores } from '../../data/exams';
import { useData } from '../../data/useData';
import { Card, IconButton, Skeleton } from '../../components/ui';
import { useElementWidth } from '../../components/useElementWidth';

const LEVELS = 5;

function Radar({ scores, width }) {
  // Leave ~66px each side for the subject labels; cap the radius so it stays tidy on wide cards.
  const r = Math.max(60, Math.min(width / 2 - 66, 118));
  const height = 2 * r + 64;
  const cx = width / 2;
  const cy = height / 2;
  const n = scores.length;
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i, value) => [cx + r * value * Math.cos(angle(i)), cy + r * value * Math.sin(angle(i))];
  const poly = (fn) => scores.map((_, i) => fn(i).join(',')).join(' ');
  const c = cx;

  return (
    <svg width={width} height={height} role="img" aria-label="Average score per subject" className="v2-radar">
      {Array.from({ length: LEVELS }, (_, l) => (
        <polygon
          key={l}
          points={poly((i) => point(i, (l + 1) / LEVELS))}
          fill="none"
          stroke="var(--color-gray-100)"
          strokeWidth="1"
        />
      ))}
      {scores.map((s, i) => {
        const [x, y] = point(i, 1);
        return <line key={s.label} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-gray-100)" strokeWidth="1" />;
      })}

      <polygon
        points={poly((i) => point(i, scores[i].score / 100))}
        fill="var(--color-primary)"
        fillOpacity="0.55"
        stroke="var(--color-primary)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {scores.map((s, i) => {
        const [x, y] = point(i, s.score / 100);
        return <circle key={s.label} cx={x} cy={y} r="3" fill="var(--color-primary)" />;
      })}

      {scores.map((s, i) => {
        const [x, y] = point(i, 1.14);
        const cos = Math.cos(angle(i));
        const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
        return (
          <text key={s.label} x={x} y={y + 4} textAnchor={anchor} className="v2-radar__label">
            {s.label}
          </text>
        );
      })}
      <text x={c} y={cy - r + 14} textAnchor="middle" className="v2-radar__scale">
        100
      </text>
      <text x={c} y={cy + 4} textAnchor="middle" className="v2-radar__scale">
        0
      </text>
    </svg>
  );
}

export default function SubjectScores() {
  const { data } = useData(getSubjectScores);
  const [ref, width] = useElementWidth();

  return (
    <Card className="v2-scores">
      <div className="v2-card-head">
        <h2 className="v2-side-title">Subject Wise Average Score</h2>
        <IconButton label="Open subject scores">
          <LuArrowUpRight />
        </IconButton>
      </div>
      <div ref={ref} className="v2-scores__chart">
        {data && width > 0 ? <Radar scores={data} width={width} /> : <Skeleton height={260} />}
      </div>
    </Card>
  );
}
