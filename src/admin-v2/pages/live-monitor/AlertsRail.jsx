import { useState } from 'react';
import { LuArrowUp, LuBellOff } from 'react-icons/lu';
import { Card } from '../../components/ui';
import { alertInfo, clockTime } from './helpers';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'ai', label: 'AI' },
  { value: 'browser', label: 'Browser' },
];

export default function AlertsRail({ alerts, queued, paused, onShowQueued, onOpen }) {
  const [filter, setFilter] = useState('all');
  const visible = alerts.filter((a) => filter === 'all' || alertInfo(a.type).category === filter);

  return (
    <Card className="v2-alerts">
      <div className="v2-card-head">
        <h2 className="v2-side-title">
          Live Alerts
          {!paused && <span className="v2-alerts__live" aria-hidden="true" />}
        </h2>
        <span className="v2-side-meta">{alerts.length} total</span>
      </div>

      <div className="v2-tabs v2-alerts__filters" role="tablist" aria-label="Alert type">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            className={`v2-tab ${filter === f.value ? 'is-active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {paused && (
        <div className="v2-alerts__paused">
          <LuBellOff aria-hidden="true" />
          <span>Alerts paused</span>
          {queued > 0 && (
            <button type="button" className="v2-alerts__queued" onClick={onShowQueued}>
              <LuArrowUp aria-hidden="true" /> {queued} new
            </button>
          )}
        </div>
      )}

      <ul className="v2-alerts__list" aria-live={paused ? 'off' : 'polite'}>
        {visible.map((a) => {
          const info = alertInfo(a.type);
          return (
            <li key={a.id} className={a.isNew ? 'is-new' : ''}>
              <button type="button" className="v2-alert" onClick={() => onOpen(a.attempt_id)}>
                <span className={`v2-alert__dot v2-alert__dot--${info.severity}`} aria-hidden="true" />
                <span className="v2-alert__body">
                  <span className="v2-alert__title">{info.label}</span>
                  <span className="v2-alert__meta">{a.user_name}</span>
                </span>
                <time className="v2-alert__time" dateTime={a.created_at}>
                  {clockTime(a.created_at)}
                </time>
              </button>
            </li>
          );
        })}
        {visible.length === 0 && <li className="v2-alerts__empty">No alerts yet.</li>}
      </ul>
    </Card>
  );
}
