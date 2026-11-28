import { useState } from 'react';
import { LuTrendingUp } from 'react-icons/lu';
import { getAttemptGrowth } from '../../data/results';
import { useData } from '../../data/useData';
import { Card, Skeleton } from '../../components/ui';
import { useElementWidth } from '../../components/useElementWidth';

const H = 210;
const PAD = { top: 16, right: 6, bottom: 30, left: 34 };
const TICKS = [0, 20, 40, 60, 80, 100];

function smoothPath(pts) {
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`;
  }
  return d;
}

function Chart({ curve, attempts }) {
  const [ref, width] = useElementWidth();
  const [active, setActive] = useState(1);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (plotW * i) / (curve.length - 1);
  const y = (v) => PAD.top + plotH * (1 - v / 100);
  const pts = curve.map((v, i) => ({ x: x(i), y: y(v) }));

  const a = attempts[active];
  const ax = x(a.index);
  const ay = y(curve[a.index]);
  const bandW = Math.min(64, plotW / 4);
  // Keep the tooltip inside the chart at the edges.
  const tipX = Math.min(Math.max(ax, PAD.left + 44), width - 44);

  return (
    <div ref={ref} className="v2-growth__chart">
      {width > 0 && (
        <>
          <svg width={width} height={H} role="img" aria-label="Average score across attempts">
            <defs>
              <linearGradient id="v2-growth-band" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.14" />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {TICKS.filter((t) => t !== 20).map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-gray-100)" strokeDasharray="3 4" />
                <text x={0} y={y(t) + 4} className="v2-growth__axis">
                  {t}
                </text>
              </g>
            ))}

            {/* Highlight band + marker move as one group so hovering glides instead of jumping. */}
            <g className="v2-growth__focus" style={{ transform: `translate(${ax}px, 0px)` }}>
              <rect x={-bandW / 2} y={ay} width={bandW} height={Math.max(0, y(0) - ay)} fill="url(#v2-growth-band)" />
            </g>

            <path d={smoothPath(pts)} fill="none" stroke="var(--color-primary)" strokeWidth="2" />

            <g className="v2-growth__focus" style={{ transform: `translate(${ax}px, ${ay}px)` }}>
              <circle r="6" fill="var(--color-white)" stroke="var(--color-primary)" strokeWidth="2" />
              <circle r="3" fill="var(--color-primary)" />
            </g>

            {attempts.map((att, i) => (
              <text
                key={att.label}
                x={x(att.index)}
                y={H - 6}
                textAnchor={i === 0 ? 'start' : i === attempts.length - 1 ? 'end' : 'middle'}
                className={`v2-growth__xlabel ${i === active ? 'is-active' : ''}`}
              >
                {att.label}
              </text>
            ))}

            {attempts.map((att, i) => {
              const left = i === 0 ? PAD.left : (x(attempts[i - 1].index) + x(att.index)) / 2;
              const right = i === attempts.length - 1 ? width : (x(att.index) + x(attempts[i + 1].index)) / 2;
              return (
                <rect
                  key={`hit-${att.label}`}
                  x={left}
                  y={0}
                  width={Math.max(0, right - left)}
                  height={H}
                  fill="transparent"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                />
              );
            })}
          </svg>

          <div className="v2-growth__tip" style={{ transform: `translate(calc(${tipX}px - 50%), ${ay - 52}px)` }}>
            {a.growthPct == null ? 'Baseline' : `+${a.growthPct}%`}
            {a.growthPct != null && <LuTrendingUp aria-hidden="true" />}
          </div>
        </>
      )}
    </div>
  );
}

export default function AttemptGrowth() {
  const { data } = useData(getAttemptGrowth);

  return (
    <Card className="v2-growth">
      <h2 className="v2-growth__title">Performance Growth Over Multiple Attempts</h2>
      {data ? <Chart curve={data.curve} attempts={data.attempts} /> : <Skeleton height={H} style={{ marginTop: 16 }} />}
    </Card>
  );
}
