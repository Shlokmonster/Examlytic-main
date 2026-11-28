import { LuClipboardList, LuClock, LuTrophy, LuUserPlus, LuWallet } from 'react-icons/lu';
import { getResultStats } from '../../data/results';
import { useData } from '../../data/useData';
import { Change } from '../../components/ui';
import StatCard, { StatCardSkeleton } from '../../components/StatCard';

export default function ResultStats() {
  const { data, loading } = useData(getResultStats);

  if (loading || !data) {
    return (
      <div className="v2-stats v2-stats--5">
        {[0, 1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const { averageScore, highestScore, examsAnalyzed, averageTime, topPerformer } = data;

  return (
    <div className="v2-stats v2-stats--5">
      <StatCard label="Average Score" icon={LuClipboardList} tone="warning">
        <span className="v2-stat__num">{averageScore.pct}%</span>
        <span className="v2-stat__unit v2-stat__unit--sm">Marks</span>
        <Change value={averageScore.changePct} />
      </StatCard>

      <StatCard label="Highest Score Achieved" icon={LuWallet} tone="success">
        <span className="v2-stat__num">{highestScore.pct}%</span>
        <span className="v2-stat__unit v2-stat__unit--sm">Marks</span>
        <Change value={highestScore.changePct} />
      </StatCard>

      <StatCard label="Total Exams Analyzed" icon={LuUserPlus} tone="warning">
        <span className="v2-stat__num">{examsAnalyzed.value}</span>
        <Change value={examsAnalyzed.changePct} />
      </StatCard>

      <StatCard label="Average Time per Exam" icon={LuClock} tone="primary">
        <span className="v2-stat__num">{averageTime.hours}</span>
        <span className="v2-stat__unit">hr</span>
        <span className="v2-stat__num">{averageTime.minutes}</span>
        <span className="v2-stat__unit">min</span>
        <Change value={averageTime.changePct} />
      </StatCard>

      <StatCard label="Top Performer" icon={LuTrophy} tone="primary">
        <span className="v2-stat__num">
          {topPerformer.score}/{topPerformer.outOf}
        </span>
        <span className="v2-stat__unit">Marks</span>
        <span className="v2-stat__name">{topPerformer.name}</span>
      </StatCard>
    </div>
  );
}
