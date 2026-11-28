import { LuPenTool, LuUserCheck, LuUserPlus } from 'react-icons/lu';
import { getDashboardStats } from '../../data/dashboard';
import { useData } from '../../data/useData';
import { Change } from '../../components/ui';
import StatCard, { StatCardSkeleton } from '../../components/StatCard';

export default function StatCards() {
  const { data, loading } = useData(getDashboardStats);

  if (loading || !data) {
    return (
      <div className="v2-stats">
        {[0, 1, 2].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="v2-stats">
      <StatCard label="Ongoing Exam" icon={LuPenTool} tone="success">
        <span className="v2-stat__num">{data.ongoingExams}</span>
        <span className="v2-stat__live">
          <span className="v2-dot" /> Live Exam
        </span>
      </StatCard>

      <StatCard label="Overall Enroll" icon={LuUserPlus} tone="warning">
        <span className="v2-stat__num">{data.overallEnroll.candidates}</span>
        <span className="v2-stat__unit">Candidates</span>
        <Change value={data.overallEnroll.changePct} />
      </StatCard>

      <StatCard
        label={
          <>
            Overall
            <br />
            Pass Rate
          </>
        }
        icon={LuUserCheck}
        tone="primary"
      >
        <span className="v2-stat__num">{data.overallPassRate.passedPct}%</span>
        <span className="v2-stat__unit">Passed</span>
        <Change value={data.overallPassRate.changePct} />
      </StatCard>
    </div>
  );
}
