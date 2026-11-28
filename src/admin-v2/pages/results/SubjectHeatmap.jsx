import { useState } from 'react';
import { getSubjectHeatmap } from '../../data/results';
import { useData } from '../../data/useData';
import { Card, SelectPill, Skeleton } from '../../components/ui';

const PERIODS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'yearly', label: 'Yearly' },
];

// Primary color at 4 strengths for the 4 score bands.
const BANDS = [
  { max: 40, label: '0 – 40', opacity: 0.15 },
  { max: 60, label: '40 – 60', opacity: 0.35 },
  { max: 80, label: '60 – 80', opacity: 0.65 },
  { max: 101, label: '80 – 100', opacity: 1 },
];

const bandFor = (score) => BANDS.find((b) => score < b.max) || BANDS[BANDS.length - 1];

export default function SubjectHeatmap() {
  const [period, setPeriod] = useState('monthly');
  const { data, loading } = useData(getSubjectHeatmap, period);

  return (
    <Card className="v2-heatmap">
      <div className="v2-card-head">
        <h2 className="h2">Performance Analytics by Subject</h2>
        <SelectPill label="Heatmap period" value={period} options={PERIODS} onChange={setPeriod} />
      </div>

      <div className="v2-heatmap__body">
        {loading || !data ? (
          <Skeleton height={300} />
        ) : (
          <table className="v2-heatmap__grid">
            <caption className="v2-sr-only">Average score per subject by {period} period</caption>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.subject}>
                  <th scope="row">{row.subject}</th>
                  {row.scores.map((score, i) => {
                    const band = bandFor(score);
                    return (
                      <td key={data.columns[i]}>
                        <span
                          className="v2-heatmap__cell"
                          style={{ '--cell-opacity': band.opacity }}
                          title={`${row.subject} · ${data.columns[i]}: ${score}%`}
                        >
                          <span className="v2-sr-only">
                            {data.columns[i]}: {score}%
                          </span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <ul className="v2-heatmap__legend">
          {BANDS.map((b) => (
            <li key={b.label}>
              <span className="v2-heatmap__legend-bar" style={{ '--cell-opacity': b.opacity }} />
              {b.label}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
