import { useState } from 'react';
import { Card } from '../../components/ui';
import { useElementWidth } from '../../components/useElementWidth';

const H = 260;
const PAD = { top: 20, right: 40, bottom: 34, left: 36 };

function smoothPath(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0].x},${pts[0].y}` : '';
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

/** Score line (left axis, %) over flag bars (right axis, count) per exam. */
export default function ScoreIntegrityChart({ attempts }) {
  const [ref, width] = useElementWidth();
  const [active, setActive] = useState(() => {
    // Start on the exam with the most flags: the one a reviewer should look at.
    let best = 0;
    attempts.forEach((a, i) => {
      if (a.events.length > attempts[best].events.length) best = i;
    });
    return best;
  });

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const step = attempts.length ? plotW / attempts.length : 0;
  const maxFlags = Math.max(4, ...attempts.map((a) => a.events.length));
  const x = (i) => PAD.left + step * i + step / 2;
  const yScore = (v) => PAD.top + plotH * (1 - v / 100);
  const yFlags = (v) => PAD.top + plotH * (1 - v / maxFlags);
  const pts = attempts.map((a, i) => ({ x: x(i), y: yScore(a.score) }));
  const barW = Math.min(36, step * 0.4);
  const a = attempts[active];

  return (
    <Card className="v2-score-chart">
      <div className="v2-card-head">
        <h2 className="h2">Score vs Integrity by Exam</h2>
        <div className="v2-legend">
          <span className="v2-legend__item">
            <span className="v2-legend__swatch v2-legend__swatch--ring" /> Score
          </span>
          <span className="v2-legend__item">
            <span className="v2-score-chart__flag-swatch" /> Flags
          </span>
        </div>
      </div>

      <div ref={ref} className="v2-score-chart__plot">
        {width > 0 && (
          <>
            <svg width={width} height={H} role="img" aria-label="Score and number of flags for each exam">
              {[0, 25, 50, 75, 100].map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={yScore(t)} y2={yScore(t)} stroke="var(--color-gray-100)" strokeDasharray="3 4" />
                  <text x={0} y={yScore(t) + 4} className="v2-chart__axis">
                    {t}%
                  </text>
                </g>
              ))}
              {[0, Math.round(maxFlags / 2), maxFlags].map((t) => (
                <text key={`f${t}`} x={width} y={yFlags(t) + 4} textAnchor="end" className="v2-chart__axis v2-score-chart__flag-axis">
                  {t}
                </text>
              ))}

              {attempts.map((att, i) => (
                <rect
                  key={att.id}
                  className="v2-score-chart__bar"
                  x={x(i) - barW / 2}
                  y={yFlags(att.events.length)}
                  width={barW}
                  height={Math.max(0, yFlags(0) - yFlags(att.events.length))}
                  rx="6"
                  style={{ fillOpacity: i === active ? 0.9 : 0.25 }}
                />
              ))}

              <path d={smoothPath(pts)} fill="none" stroke="var(--color-primary)" strokeWidth="2" />
              {pts.map((p, i) => (
                <circle key={attempts[i].id} cx={p.x} cy={p.y} r="4" fill="var(--color-white)" stroke="var(--color-primary)" strokeWidth="2" />
              ))}

              {/* One marker that glides between exams instead of jumping */}
              <g className="v2-score-chart__focus" style={{ transform: `translate(${x(active)}px, ${yScore(a.score)}px)` }}>
                <circle r="7" fill="var(--color-white)" stroke="var(--color-primary)" strokeWidth="3" />
              </g>

              {attempts.map((att, i) => (
                <text
                  key={`x-${att.id}`}
                  x={x(i)}
                  y={H - 10}
                  textAnchor="middle"
                  className={`v2-chart__month ${i === active ? 'is-active' : ''}`}
                >
                  {att.subject}
                </text>
              ))}

              {attempts.map((att, i) => (
                <rect
                  key={`hit-${att.id}`}
                  x={PAD.left + step * i}
                  y={0}
                  width={step}
                  height={H}
                  fill="transparent"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                />
              ))}
            </svg>

            <div
              className="v2-score-chart__tip"
              style={{ transform: `translate(calc(${Math.min(Math.max(x(active), 90), width - 90)}px - 50%), ${Math.max(0, yScore(a.score) - 86)}px)` }}
            >
              <strong>{a.exam_title}</strong>
              <span>
                Score {a.score}% · {a.events.length} flags · Integrity {a.integrity_score}
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
