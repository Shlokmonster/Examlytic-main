import { LuArrowUpRight } from 'react-icons/lu';
import { getInsights } from '../../data/dashboard';
import { useData } from '../../data/useData';
import { Card, IconButton, Skeleton } from '../../components/ui';

function InsightCard({ title, children }) {
  return (
    <Card className="v2-insight">
      <div className="v2-insight__head">
        <h3 className="v2-insight__title">{title}</h3>
        <IconButton label={`Open ${title}`} size="sm">
          <LuArrowUpRight />
        </IconButton>
      </div>
      <div className="v2-insight__body">{children}</div>
    </Card>
  );
}

export default function InsightCards() {
  const { data, loading } = useData(getInsights);

  if (loading || !data) {
    return (
      <div className="v2-insights">
        <Skeleton height={160} style={{ borderRadius: 16 }} />
        <Skeleton height={160} style={{ borderRadius: 16 }} />
      </div>
    );
  }

  const { questions, proctoring } = data;

  return (
    <div className="v2-insights">
      <InsightCard title="Questions Performance">
        <p className="v2-insight__line">
          Most Skipped Questions :{' '}
          <span className="v2-insight__num">{String(questions.mostSkipped).padStart(2, '0')}</span>{' '}
          <span className="v2-insight__small">{questions.mostSkippedSubject}</span>
        </p>
        <p className="v2-insight__line">
          <span className="v2-insight__small">Skip Rate</span>{' '}
          <span className="v2-insight__num">{questions.skipRate}%</span>
          <span className="v2-insight__up">+{questions.skipRateChange}%</span>
        </p>
      </InsightCard>

      <InsightCard title="Advanced AI Proctoring Enabled">
        <p className="v2-insight__line">Students Flagged for Cheating</p>
        <p className="v2-insight__line v2-insight__danger">
          <span className="v2-insight__small">Cheating Detected :</span>{' '}
          <span className="v2-insight__num">{proctoring.cheatingDetected}</span>
        </p>
      </InsightCard>
    </div>
  );
}
