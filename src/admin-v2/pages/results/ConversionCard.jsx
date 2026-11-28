import { getConversion } from '../../data/results';
import { useData } from '../../data/useData';
import { Card, Change, Skeleton } from '../../components/ui';

export default function ConversionCard() {
  const { data } = useData(getConversion);

  return (
    <Card className="v2-mini v2-conversion">
      <h2 className="v2-mini__title">Upgrade Conversion at a Glance</h2>
      {!data ? (
        <Skeleton height={80} style={{ marginTop: 16 }} />
      ) : (
        <>
          <div className="v2-conversion__total">
            <p>
              Total Sign Up <span className="v2-conversion__num">{data.totalSignUps}</span>
            </p>
            <Change value={data.changePct} />
          </div>

          {/* Bar widths are fixed proportions from the reference so the small premium share stays visible. */}
          <div className="v2-conversion__bar" role="img" aria-label={`${data.enrolled} enrolled to exam, ${data.premium} premium users out of ${data.totalSignUps} sign ups`}>
            <span className="v2-conversion__seg v2-conversion__seg--rest" />
            <span className="v2-conversion__seg v2-conversion__seg--enrolled" />
            <span className="v2-conversion__seg v2-conversion__seg--premium" />
          </div>

          <ul className="v2-conversion__legend">
            <li>
              <span className="v2-legend-dot v2-legend-dot--primary" /> Enroll to Exam <strong>{data.enrolled}</strong>
            </li>
            <li>
              <span className="v2-legend-dot v2-legend-dot--success" /> Premium users <strong>{data.premium}</strong>
            </li>
          </ul>
        </>
      )}
    </Card>
  );
}
