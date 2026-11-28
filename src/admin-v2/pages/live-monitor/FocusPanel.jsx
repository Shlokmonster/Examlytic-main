import { useState } from 'react';
import { LuBan, LuChevronLeft, LuChevronRight, LuFlag, LuMessageSquare, LuTriangleAlert, LuX } from 'react-icons/lu';
import Avatar from '../../components/Avatar';
import { Button, IconButton } from '../../components/ui';
import { formatDuration } from '../../components/useNow';
import { CameraFeed, ScreenFeed } from './StudentTile';
import { alertInfo, clockTime, connectionOf } from './helpers';

const CONNECTION_LABEL = { live: 'Connected', reconnecting: 'Reconnecting', lost: 'Connection lost', submitted: 'Submitted' };

export default function FocusPanel({ session, alerts, secondsLeft, onClose, onPrev, onNextFlagged, hasNextFlagged }) {
  const [tab, setTab] = useState('timeline');
  const [confirmTerminate, setConfirmTerminate] = useState(false);
  const [note, setNote] = useState('');

  if (!session) return null;

  const conn = connectionOf(session);
  const own = alerts.filter((a) => a.attempt_id === session.id);
  const list = tab === 'flags' ? own.filter((a) => alertInfo(a.type).category === 'ai') : own;

  // Mock actions until the backend adds warn / message / terminate RPCs.
  const act = (message) => {
    setNote(message);
    setConfirmTerminate(false);
  };

  return (
    <div className="v2-focus">
      <header className="v2-focus__head">
        <div className="v2-person">
          <Avatar name={session.user_name} size={44} />
          <div className="v2-person__text">
            <span className="v2-focus__name">{session.user_name}</span>
            <span className="v2-person__email">
              {session.class_name} · Roll {session.roll_no}
            </span>
          </div>
        </div>
        <IconButton label="Close" variant="ghost" onClick={onClose}>
          <LuX />
        </IconButton>
      </header>

      <div className="v2-focus__body">
        <div className="v2-focus__feeds">
          <CameraFeed name={session.user_name} large />
          <ScreenFeed large />
        </div>

        <dl className="v2-focus__facts">
          <div>
            <dt>Time left</dt>
            <dd>{conn === 'submitted' ? '—' : formatDuration(secondsLeft)}</dd>
          </div>
          <div>
            <dt>Connection</dt>
            <dd>
              <span className={`v2-status v2-status--${conn === 'live' ? 'live' : conn === 'submitted' ? 'inactive' : 'active'}`}>
                <span className="v2-status__dot" aria-hidden="true" />
                {CONNECTION_LABEL[conn]}
              </span>
            </dd>
          </div>
          <div>
            <dt>Flags</dt>
            <dd>
              <span className={`v2-pill ${session.flags_count ? 'v2-pill--danger' : 'v2-pill--success'}`}>{session.flags_count}</span>
            </dd>
          </div>
        </dl>

        <div className="v2-focus__actions">
          <Button variant="outline" size="sm" onClick={() => act(`Warning sent to ${session.user_name} (mock).`)}>
            <LuTriangleAlert aria-hidden="true" /> Warn
          </Button>
          <Button variant="outline" size="sm" onClick={() => act(`Message box would open for ${session.user_name} (mock).`)}>
            <LuMessageSquare aria-hidden="true" /> Message
          </Button>
          <Button variant="outline" size="sm" onClick={() => act(`${session.user_name} flagged for review (mock).`)}>
            <LuFlag aria-hidden="true" /> Flag for review
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="v2-btn--danger-outline"
            onClick={() => setConfirmTerminate(true)}
            disabled={conn === 'submitted'}
          >
            <LuBan aria-hidden="true" /> Terminate
          </Button>
        </div>

        {confirmTerminate && (
          <div className="v2-focus__confirm" role="alertdialog" aria-label="Confirm terminate">
            <p>
              End the exam for <strong>{session.user_name}</strong>? Their answers will be submitted as they are.
            </p>
            <div>
              <Button variant="outline" size="sm" onClick={() => setConfirmTerminate(false)}>
                Cancel
              </Button>
              <Button size="sm" className="v2-btn--danger" onClick={() => act(`Exam terminated for ${session.user_name} (mock).`)}>
                Terminate exam
              </Button>
            </div>
          </div>
        )}

        {note && (
          <p className="v2-focus__note" role="status">
            {note}
          </p>
        )}

        <div className="v2-tabs v2-focus__tabs" role="tablist" aria-label="Activity">
          {[
            { value: 'timeline', label: `Timeline (${own.length})` },
            { value: 'flags', label: 'AI flags' },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={`v2-tab ${tab === t.value ? 'is-active' : ''}`}
              onClick={() => setTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <ol className="v2-timeline">
          {list.map((a) => {
            const info = alertInfo(a.type);
            return (
              <li key={a.id} className="v2-timeline__item">
                <span className={`v2-alert__dot v2-alert__dot--${info.severity}`} aria-hidden="true" />
                <span className="v2-timeline__label">{info.label}</span>
                <time className="v2-timeline__time" dateTime={a.created_at}>
                  {clockTime(a.created_at)}
                </time>
              </li>
            );
          })}
          {list.length === 0 && <li className="v2-timeline__empty">No activity recorded yet.</li>}
        </ol>
      </div>

      <footer className="v2-focus__foot">
        <Button variant="outline" size="sm" onClick={onPrev}>
          <LuChevronLeft aria-hidden="true" /> Previous
        </Button>
        <Button size="sm" onClick={onNextFlagged} disabled={!hasNextFlagged}>
          Next flagged <LuChevronRight aria-hidden="true" />
        </Button>
      </footer>
    </div>
  );
}
