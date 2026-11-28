import { getRecommendation } from '../../data/results';
import { useData } from '../../data/useData';
import { Card, Skeleton } from '../../components/ui';

export default function RecommendationsCard() {
  const { data } = useData(getRecommendation);

  return (
    <Card className="v2-mini v2-reco">
      <h2 className="v2-mini__title">Recommendations Growth for {data?.subject ?? '…'}</h2>
      {!data ? (
        <Skeleton height={100} style={{ marginTop: 16 }} />
      ) : (
        <div className="v2-reco__rows">
          <div className="v2-reco__row">
            <span className="v2-reco__tag v2-reco__tag--danger">Crisis</span>
            <div className="v2-reco__box v2-reco__box--split">
              <span>
                Avg Score
                <br />
                {data.crisis.avgScore}%
              </span>
              <span className="v2-reco__sep" aria-hidden="true" />
              <span>
                {data.crisis.studentsBelow50Pct}% Students
                <br />
                scored &lt;50%
              </span>
            </div>
          </div>
          <div className="v2-reco__row">
            <span className="v2-reco__tag v2-reco__tag--success">Action</span>
            <div className="v2-reco__box">{data.action}</div>
          </div>
        </div>
      )}
    </Card>
  );
}
