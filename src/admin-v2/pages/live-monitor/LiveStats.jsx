import { LuClock, LuShieldAlert, LuTv, LuWifiOff } from 'react-icons/lu';
import { Card } from '../../components/ui';
import StatCard, { StatCardSkeleton } from '../../components/StatCard';
import { formatDuration } from '../../components/useNow';
import { connectionOf } from './helpers';

export default function LiveStats({ exam, sessions, now }) {
  if (!exam || !sessions) {
    return (
      <div className="v2-stats v2-stats--4">
        {[0, 1, 2, 3].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const live = sessions.filter((s) => connectionOf(s) === 'live').length;
  const reconnecting = sessions.filter((s) => connectionOf(s) === 'reconnecting').length;
  const flagged = sessions.filter((s) => s.flags_count > 0 && s.status !== 'completed').length;

  const start = new Date(exam.started_at).getTime();
  const total = exam.duration_minutes * 60;
  const left = Math.max(0, total - (now - start) / 1000);
  const progress = 1 - left / total;

  return (
    <div className="v2-stats v2-stats--4">
      <StatCard label="Live now" icon={LuTv} tone="success">
        <span className="v2-stat__num">{live}</span>
        <span className="v2-stat__live">
          <span className="v2-dot" /> Students
        </span>
      </StatCard>

      <StatCard label="Reconnecting" icon={LuWifiOff} tone="warning">
        <span className="v2-stat__num">{reconnecting}</span>
        <span className="v2-stat__unit">Students</span>
      </StatCard>

      <StatCard label="Flagged" icon={LuShieldAlert} tone="danger">
        <span className="v2-stat__num">{flagged}</span>
        <span className="v2-stat__unit">Students</span>
      </StatCard>

      <Card className="v2-stat">
        <div className="v2-stat__top">
          <span className="v2-stat__label">Exam time left</span>
          <span className="v2-stat__icon v2-stat__icon--primary">
            <LuClock aria-hidden="true" />
          </span>
        </div>
        <div className="v2-live-timer">
          <span className="v2-stat__num v2-live-timer__value" aria-live="off">
            {formatDuration(left)}
          </span>
          <span className="v2-live-timer__track" aria-hidden="true">
            <span className="v2-live-timer__fill" style={{ transform: `scaleX(${progress})` }} />
          </span>
        </div>
      </Card>
    </div>
  );
}
