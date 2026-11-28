import { LuChartColumn, LuClipboardCheck, LuShieldAlert, LuShieldCheck } from 'react-icons/lu';
import StatCard from '../../components/StatCard';
import { Change } from '../../components/ui';

export default function ProfileStats({ attempts, summary }) {
  const top = summary.byType[0];
  return (
    <div className="v2-stats v2-stats--4">
      <StatCard label="Exams taken" icon={LuClipboardCheck} tone="primary">
        <span className="v2-stat__num">{attempts.length}</span>
        <span className="v2-stat__unit">Exams</span>
      </StatCard>

      <StatCard label="Average score" icon={LuChartColumn} tone="warning">
        <span className="v2-stat__num">{summary.avgScore}%</span>
        <span className="v2-stat__unit">Marks</span>
        <Change value={summary.scoreChange} />
      </StatCard>

      <StatCard label="Integrity score" icon={LuShieldCheck} tone={summary.tone}>
        <span className="v2-stat__num">{summary.integrity}</span>
        <span className="v2-stat__unit">/ 100</span>
        <span className={`v2-pill v2-pill--${summary.tone} v2-stat__pill`}>{summary.verdict}</span>
      </StatCard>

      <StatCard label="Total flags" icon={LuShieldAlert} tone="danger">
        <span className="v2-stat__num">{summary.totalFlags}</span>
        <span className="v2-stat__unit v2-stat__unit--sm">{top ? `Most: ${top.label}` : 'None'}</span>
      </StatCard>
    </div>
  );
}
