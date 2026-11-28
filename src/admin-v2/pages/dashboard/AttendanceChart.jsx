import { useState } from 'react';
import { getAttendanceVsPass } from '../../data/dashboard';
import { useData } from '../../data/useData';
import { Card, SelectPill, Skeleton } from '../../components/ui';
import { useElementWidth } from '../../components/useElementWidth';

const PERIODS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'yearly', label: 'Yearly' },
];

const CHART_H = 300;
const PAD = { top: 12, right: 8, bottom: 34, left: 40 };
const Y_MAX = 500;
const Y_TICKS = [0, 100, 200, 300, 400, 500];
const BAR_W = 11;

/** Smooth curve through points (Catmull-Rom converted to cubic Bézier). */
function smoothPath(pts) {
  if (!pts.length) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function Chart({ months }) {
  const [ref, width] = useElementWidth();
  const [active, setActive] = useState(Math.min(7, months.length - 1));

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const step = months.length ? plotW / months.length : 0;
  const x = (i) => PAD.left + step * i + step / 2;
  const y = (v) => PAD.top + plotH * (1 - Math.min(v, Y_MAX) / Y_MAX);
  const points = months.map((m, i) => ({ x: x(i), y: y(m.passed) }));
  const current = months[active];

  const tooltipW = 148;
  const flip = current && x(active) + tooltipW > width;

  return (
    <div ref={ref} className="v2-chart">
      {width > 0 && (
        <svg width={width} height={CHART_H} role="img" aria-label="Monthly attendance and passed students">
          <defs>
            <linearGradient id="v2-bar-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {Y_TICKS.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--color-gray-100)"
                strokeDasharray="3 4"
              />
              <text x={0} y={y(t) + 4} className="v2-chart__axis">
                {t}
              </text>
            </g>
          ))}

          {months.map((m, i) => (
            <rect
              key={m.label}
              x={x(i) - BAR_W / 2}
              y={y(m.attended)}
              width={BAR_W}
              height={Math.max(0, y(0) - y(m.attended))}
              rx={BAR_W / 2}
              fill={i === active ? 'var(--color-primary)' : 'url(#v2-bar-grad)'}
            />
          ))}

          <path d={smoothPath(points)} fill="none" stroke="var(--color-primary)" strokeWidth="2" />

          {points.map((p, i) => (
            <circle
              key={months[i].label}
              cx={p.x}
              cy={p.y}
              r={i === active ? 5 : 4}
              fill="var(--color-white)"
              stroke="var(--color-primary)"
              strokeWidth={i === active ? 3 : 2}
            />
          ))}

          {months.map((m, i) => (
            <g key={`x-${m.label}`}>
              <text
                x={x(i)}
                y={CHART_H - 12}
                textAnchor="middle"
                className={`v2-chart__month ${i === active ? 'is-active' : ''}`}
              >
                {m.label}
              </text>
              {i === active && (
                <line x1={x(i) - 12} x2={x(i) + 12} y1={CHART_H - 4} y2={CHART_H - 4} stroke="var(--color-primary)" strokeWidth="1.5" />
              )}
            </g>
          ))}

          {/* Hover targets */}
          {months.map((m, i) => (
            <rect
              key={`hit-${m.label}`}
              x={PAD.left + step * i}
              y={0}
              width={step}
              height={CHART_H}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive(i)}
            />
          ))}
        </svg>
      )}

      {current && width > 0 && (
        <div
          className="v2-chart__tooltip"
          style={{
            left: flip ? x(active) - tooltipW : x(active),
            top: Math.max(0, y(current.attended) - 72),
            width: tooltipW,
          }}
        >
          <div>
            <span>Attend:</span> <strong>{current.attended}</strong>
          </div>
          <div>
            <span>Passed:</span> <strong>{current.passed}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttendanceChart() {
  const [period, setPeriod] = useState('monthly');
  const { data, loading } = useData(getAttendanceVsPass, period);

  return (
    <Card className="v2-attendance">
      <div className="v2-card-head">
        <h2 className="h2">Total Attendance vs Total Pass</h2>
        <SelectPill label="Chart period" value={period} options={PERIODS} onChange={setPeriod} />
      </div>

      <div className="v2-attendance__meta">
        <p className="v2-attendance__avg">
          AVG Passing Rate <span className="v2-attendance__avg-num">{data ? `${data.avgPassingRate}%` : '—'}</span>
        </p>
        <div className="v2-legend">
          <span className="v2-legend__item">
            <span className="v2-legend__swatch v2-legend__swatch--fill" /> Total Attendance
          </span>
          <span className="v2-legend__item">
            <span className="v2-legend__swatch v2-legend__swatch--ring" /> Passed
          </span>
        </div>
      </div>

      {loading || !data ? <Skeleton height={CHART_H} /> : <Chart months={data.months} />}
    </Card>
  );
}
