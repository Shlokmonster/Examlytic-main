import { LuChartColumn, LuShieldAlert, LuTv, LuUsers } from 'react-icons/lu';
import { getStudentStats } from '../../data/students';
import { useData } from '../../data/useData';
import { Change } from '../../components/ui';
import StatCard, { StatCardSkeleton } from '../../components/StatCard';

export default function StudentStats() {
  const { data, loading } = useData(getStudentStats);

  if (loading || !data) {
    return (
      <div className="v2-stats v2-stats--4">
        {[0, 1, 2, 3].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="v2-stats v2-stats--4">
      <StatCard label="Total Students" icon={LuUsers} tone="primary">
        <span className="v2-stat__num">{data.total.value}</span>
        <span className="v2-stat__unit">Enrolled</span>
        <Change value={data.total.changePct} />
      </StatCard>

      <StatCard label="Active Now" icon={LuTv} tone="success">
        <span className="v2-stat__num">{data.liveNow}</span>
        <span className="v2-stat__live">
          <span className="v2-dot" /> Live in exam
        </span>
      </StatCard>

      <StatCard label="Average Score" icon={LuChartColumn} tone="warning">
        <span className="v2-stat__num">{data.averageScore.pct}%</span>
        <span className="v2-stat__unit">Marks</span>
        <Change value={data.averageScore.changePct} />
      </StatCard>

      <StatCard label="Flagged Students (30d)" icon={LuShieldAlert} tone="danger">
        <span className="v2-stat__num">{data.flagged.value}</span>
        <span className="v2-stat__unit">Students</span>
        <Change value={data.flagged.changePct} />
      </StatCard>
    </div>
  );
}
