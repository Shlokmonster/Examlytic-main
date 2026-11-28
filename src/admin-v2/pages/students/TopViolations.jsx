import { getTopViolations } from '../../data/students';
import { useData } from '../../data/useData';
import { Card, Skeleton } from '../../components/ui';

export default function TopViolations() {
  const { data } = useData(getTopViolations);
  const max = data ? Math.max(...data.map((v) => v.count)) : 1;

  return (
    <Card className="v2-violations">
      <div className="v2-card-head">
        <h2 className="v2-side-title">Top Violations</h2>
        <span className="v2-side-meta">Last 30 days</span>
      </div>
      {!data ? (
        <Skeleton height={200} style={{ marginTop: 16 }} />
      ) : (
        <ul className="v2-violations__list">
          {data.map((v) => (
            <li key={v.key}>
              <div className="v2-violations__row">
                <span>{v.label}</span>
                <strong>{v.count}</strong>
              </div>
              <span className="v2-violations__track">
                <span className="v2-violations__fill" style={{ transform: `scaleX(${v.count / max})` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
