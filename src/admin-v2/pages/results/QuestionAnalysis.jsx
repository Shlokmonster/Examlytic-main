import { LuArrowUpRight } from 'react-icons/lu';
import { getQuestionLevels } from '../../data/results';
import { useData } from '../../data/useData';
import { Card, IconButton, Skeleton } from '../../components/ui';

export default function QuestionAnalysis() {
  const { data, loading } = useData(getQuestionLevels);

  return (
    <Card className="v2-qla">
      <div className="v2-card-head">
        <h2 className="h2">Question-Level Analysis</h2>
        <IconButton label="Open question analysis">
          <LuArrowUpRight />
        </IconButton>
      </div>

      {loading || !data ? (
        <Skeleton height={200} style={{ marginTop: 24 }} />
      ) : (
        <div
          className="v2-qla__levels"
          style={{ gridTemplateColumns: data.map((l) => `minmax(120px, ${l.pct}fr)`).join(' ') }}
        >
          {data.map((level) => (
            <div key={level.key} className={`v2-qla__level v2-qla__level--${level.key}`}>
              <div className="v2-qla__head">
                <span className="v2-qla__pct">{level.pct}%</span>
                <span className="v2-qla__label">{level.label}</span>
              </div>
              <div className="v2-qla__tickwrap">
                <span className="v2-qla__ticks" aria-hidden="true" />
              </div>
              <p className="v2-qla__foot">
                <span className="v2-qla__foot-num">{level.correctPct}%</span> students answered correctly
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
