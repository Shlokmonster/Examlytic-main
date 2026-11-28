import { useState } from 'react';
import { getAccelerationPlan } from '../../data/results';
import { useData } from '../../data/useData';
import { Card, SelectPill, Skeleton } from '../../components/ui';

const RANGES = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'term', label: 'This term' },
];

const PRIORITY_TONE = { Urgent: 'danger', High: 'warning', Medium: 'primary', Low: 'success' };

export default function AccelerationTable() {
  const [range, setRange] = useState('week');
  const { data, loading } = useData(getAccelerationPlan, range);

  return (
    <Card className="v2-accel">
      <div className="v2-card-head">
        <h2 className="h2">Rapid Performance Acceleration</h2>
        <SelectPill label="Date range" value={range} options={RANGES} onChange={setRange} />
      </div>

      <div className="v2-table-wrap v2-accel__wrap">
        {loading || !data ? (
          <Skeleton height={260} />
        ) : (
          <table className="v2-accel__table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Focus Area</th>
                <th>Current Status</th>
                <th>Action Required</th>
                <th>Impact Potential</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id}>
                  <td className={`v2-priority v2-priority--${PRIORITY_TONE[row.priority]}`}>{row.priority}</td>
                  <td>{row.focus}</td>
                  <td>{row.status}</td>
                  <td>
                    <ul className="v2-accel__actions">
                      {row.actions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </td>
                  <td>{row.impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
