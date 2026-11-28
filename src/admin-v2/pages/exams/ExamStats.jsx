import { LuClipboardCheck, LuPenTool, LuUserPlus, LuUsers } from 'react-icons/lu';
import { getExamStats } from '../../data/exams';
import { useData } from '../../data/useData';
import { Change } from '../../components/ui';
import StatCard, { StatCardSkeleton } from '../../components/StatCard';

export default function ExamStats() {
  const { data, loading } = useData(getExamStats);

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
      <StatCard label="Total Exams" icon={LuPenTool} tone="success">
        <span className="v2-stat__num">{data.totalExams.value}</span>
        <Change value={data.totalExams.changePct} />
      </StatCard>

      <StatCard label="Total Students" icon={LuUserPlus} tone="warning">
        <span className="v2-stat__num">{data.totalStudents.value}</span>
        <span className="v2-stat__unit">Certified</span>
        <Change value={data.totalStudents.changePct} />
      </StatCard>

      <StatCard label="Upcoming Exam" icon={LuClipboardCheck} tone="danger">
        <span className="v2-stat__num">{data.upcomingExams}</span>
        <span className="v2-stat__unit">Exams</span>
      </StatCard>

      <StatCard label="Exam Reviews" icon={LuUsers} tone="primary">
        <span className="v2-stat__num">{data.reviewsPct}%</span>
        <span className="v2-stat__unit">Needs review</span>
      </StatCard>
    </div>
  );
}
