import { useState } from 'react';
import { LuMonitor, LuVideo, LuWifiOff } from 'react-icons/lu';
import Avatar from '../../components/Avatar';
import { formatDuration } from '../../components/useNow';
import { connectionOf } from './helpers';

/** Mock camera feed: dark teal frame with the student's initials. */
export function CameraFeed({ name, large = false }) {
  return (
    <div className={`v2-feed v2-feed--camera ${large ? 'v2-feed--large' : ''}`}>
      <Avatar name={name} size={large ? 88 : 56} />
      <span className="v2-feed__label">
        <LuVideo aria-hidden="true" /> Camera
      </span>
    </div>
  );
}

/** Mock screen-share feed: a light "document" with placeholder lines. */
export function ScreenFeed({ large = false }) {
  return (
    <div className={`v2-feed v2-feed--screen ${large ? 'v2-feed--large' : ''}`}>
      <span className="v2-feed__doc" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="v2-feed__label">
        <LuMonitor aria-hidden="true" /> Screen
      </span>
    </div>
  );
}

const CONNECTION_LABEL = { live: 'Live', reconnecting: 'Reconnecting', lost: 'Connection lost', submitted: 'Submitted' };

export default function StudentTile({ session, secondsLeft, pulse, onOpen }) {
  const [swapped, setSwapped] = useState(false);
  const conn = connectionOf(session);
  const flagged = session.flags_count > 0 && conn !== 'submitted';

  return (
    <article
      className={`v2-tile v2-tile--${conn} ${flagged ? 'is-flagged' : ''}`}
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      aria-label={`${session.user_name}, ${CONNECTION_LABEL[conn]}${flagged ? `, ${session.flags_count} flags` : ''}. Open details.`}
    >
      <div className="v2-tile__video">
        {swapped ? <ScreenFeed /> : <CameraFeed name={session.user_name} />}

        <span className={`v2-tile__chip v2-tile__chip--${conn}`}>
          <span className="v2-tile__chip-dot" aria-hidden="true" />
          {CONNECTION_LABEL[conn]}
        </span>

        {conn !== 'submitted' && (
          <button
            type="button"
            className="v2-tile__pip"
            aria-label={swapped ? 'Show camera as main view' : 'Show screen as main view'}
            onClick={(e) => {
              e.stopPropagation();
              setSwapped((s) => !s);
            }}
          >
            {swapped ? <CameraFeed name={session.user_name} /> : <ScreenFeed />}
          </button>
        )}

        {conn === 'reconnecting' && (
          <span className="v2-tile__overlay">
            <LuWifiOff aria-hidden="true" /> Reconnecting…
          </span>
        )}
        {conn === 'submitted' && <span className="v2-tile__overlay">Submitted</span>}

        {pulse > 0 && <span key={pulse} className="v2-tile__pulse" aria-hidden="true" />}
      </div>

      <div className="v2-tile__footer">
        <span className="v2-tile__name">{session.user_name}</span>
        <span className="v2-tile__meta">
          {conn !== 'submitted' && <span className="v2-tile__time">{formatDuration(secondsLeft)}</span>}
          {flagged && <span className="v2-pill v2-pill--danger v2-tile__flags">{session.flags_count}</span>}
        </span>
      </div>
    </article>
  );
}
