import { useState } from 'react';
import {
  LuArrowUpRight,
  LuAtom,
  LuCalculator,
  LuChevronLeft,
  LuChevronRight,
  LuClock,
  LuFlaskConical,
  LuUserRound,
} from 'react-icons/lu';
import { getLiveExams } from '../../data/dashboard';
import { useData } from '../../data/useData';
import { Card, IconButton, ProgressRing, Skeleton } from '../../components/ui';
import { useElementWidth } from '../../components/useElementWidth';

const SUBJECT_ICONS = { physics: LuAtom, chemistry: LuFlaskConical, math: LuCalculator };
const MIN_CARD_W = 292;
const MAX_CARD_W = 360;
const GAP = 16;

function LiveExamCard({ exam, active, onSelect, width }) {
  const Icon = SUBJECT_ICONS[exam.subject] || LuAtom;
  return (
    <article
      className={`v2-live-card ${active ? 'is-active' : ''}`}
      style={{ width }}
      onClick={onSelect}
    >
      <div className="v2-live-card__top">
        <span className="v2-live-card__icon">
          <Icon aria-hidden="true" />
        </span>
        <IconButton label={`Open ${exam.title}`} variant={active ? 'white' : undefined}>
          <LuArrowUpRight />
        </IconButton>
      </div>

      <h3 className="v2-live-card__title">{exam.title}</h3>
      <p className="v2-live-card__status">
        <span className="v2-dot" /> Live Now
      </p>

      <div className="v2-live-card__bottom">
        <ul className="v2-live-card__meta">
          <li>
            <LuClock aria-hidden="true" /> {exam.startTime} - {exam.endTime}
          </li>
          <li>
            <LuUserRound aria-hidden="true" /> {exam.students} Students
          </li>
        </ul>
        <ProgressRing
          size={width >= 330 ? 104 : 96}
          stroke={7}
          value={exam.minutesLeft / exam.totalMinutes}
          trackColor={active ? 'var(--color-white)' : 'var(--color-primary)'}
          color="var(--color-success)"
        >
          <span className="v2-live-card__ring-num">
            {exam.minutesLeft} <small>min</small>
          </span>
          <span className="v2-live-card__ring-label">Left</span>
        </ProgressRing>
      </div>
    </article>
  );
}

export default function LiveExams() {
  const { data, loading } = useData(getLiveExams);
  const [index, setIndex] = useState(0);
  const count = data?.length ?? 0;
  const [viewportRef, viewportW] = useElementWidth();
  // The active card takes about 60% of the row so the next card peeks in.
  const cardW = Math.round(Math.min(MAX_CARD_W, Math.max(MIN_CARD_W, viewportW * 0.6)));

  return (
    <Card className="v2-live">
      <div className="v2-card-head">
        <h2 className="h2">Live Exams Monitoring</h2>
        <div className="v2-live__nav">
          <IconButton
            label="Previous exam"
            variant="ghost"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <LuChevronLeft />
          </IconButton>
          <IconButton
            label="Next exam"
            variant="primary"
            disabled={index >= count - 1}
            onClick={() => setIndex((i) => Math.min(count - 1, i + 1))}
          >
            <LuChevronRight />
          </IconButton>
        </div>
      </div>

      <div className="v2-live__viewport" ref={viewportRef}>
        {loading || !data ? (
          <Skeleton height={257} width={MIN_CARD_W} style={{ borderRadius: 20 }} />
        ) : (
          <div className="v2-live__track" style={{ gap: GAP, transform: `translateX(-${index * (cardW + GAP)}px)` }}>
            {data.map((exam, i) => (
              <LiveExamCard key={exam.id} exam={exam} active={i === index} onSelect={() => setIndex(i)} width={cardW} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
