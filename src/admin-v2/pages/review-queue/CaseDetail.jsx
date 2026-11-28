import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuArrowRight, LuRotateCcw } from 'react-icons/lu';
import Avatar from '../../components/Avatar';
import { formatDuration } from '../../components/useNow';
import { ADMIN_V2_BASE } from '../../layout/navItems';
import { PRIORITY, flagBreakdown } from '../../data/reviews';
import { alertInfo } from '../../utils/alerts';
import { relativeTime } from '../../utils/time';
import RecordingPlayer from '../student-profile/RecordingPlayer';
import { REVIEW_LABEL, REVIEW_OPTIONS, integrityTone } from '../student-profile/summary';

const fmtDate = (iso) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

/** Right pane of the Review queue: evidence + decision for one attempt. Keyed by case id. */
export default function CaseDetail({ item, onDecide, onReopen, position }) {
  const { student, attempt, review } = item;
  const [note, setNote] = useState(review?.note || '');
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);

  const onTime = useCallback((t) => setTime(t), []);
  const onPlaying = useCallback((p) => setPlaying(p), []);

  const events = [...attempt.events].sort((a, b) => a.offset_seconds - b.offset_seconds);
  const breakdown = flagBreakdown(events);
  const activeId = [...events].reverse().find((e) => e.offset_seconds <= time)?.id;
  const hasRecording = Boolean(attempt.recording_duration);
  const priority = PRIORITY[item.priority];
  const decided = review && REVIEW_OPTIONS.find((o) => o.value === review.status);

  return (
    <article className="v2-case" aria-label={`Case: ${student.user_name}`}>
      <header className="v2-case__head">
        <div className="v2-person">
          <Avatar name={student.user_name} src={student.user_avatar} size={44} />
          <div className="v2-person__text">
            <h2 className="h3 v2-case__name">{student.user_name}</h2>
            <span className="v2-person__email">
              {student.class_name} · Roll {student.roll_no} · {student.email}
            </span>
          </div>
        </div>
        <div className="v2-case__head-right">
          <span className="v2-case__pos">{position}</span>
          <Link to={`${ADMIN_V2_BASE}/students/${student.id}`} className="v2-btn v2-btn--outline v2-btn--sm">
            View profile <LuArrowRight aria-hidden="true" />
          </Link>
        </div>
      </header>

      <p className="v2-case__exam">
        <strong>{attempt.exam_title}</strong>
        <span>{fmtDate(attempt.started_at)}</span>
        <span>{attempt.duration_minutes} min</span>
        <span>
          Score <strong>{attempt.score}%</strong>
        </span>
        <span>
          Integrity <span className={`v2-pill v2-pill--${integrityTone(attempt.integrity_score)}`}>{attempt.integrity_score}</span>
        </span>
        <span>
          Priority <span className={`v2-pill v2-pill--${priority.tone}`}>{priority.label}</span>
        </span>
      </p>

      <section className="v2-case__why">
        <h3 className="v2-side-title">Why it was flagged</h3>
        <ul className="v2-case__chips">
          {breakdown.map((b) => (
            <li key={b.type} className="v2-case__chip">
              <span className={`v2-alert__dot v2-alert__dot--${b.severity}`} aria-hidden="true" />
              {b.label}
              <span className="v2-case__chip-count">×{b.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="v2-case__evidence">
        <RecordingPlayer
          duration={attempt.recording_duration}
          events={events}
          time={time}
          playing={playing}
          speed={speed}
          onTime={onTime}
          onPlaying={onPlaying}
          onSpeed={setSpeed}
        />

        <div className="v2-case__events">
          <h3 className="v2-side-title">Events ({events.length})</h3>
          <ol className="v2-review__list">
            {events.map((e) => {
              const info = alertInfo(e.type);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    className={`v2-review__event ${e.id === activeId ? 'is-active' : ''}`}
                    onClick={() => setTime(Math.max(0, e.offset_seconds - 3))}
                    disabled={!hasRecording}
                    title={hasRecording ? 'Jump to this moment' : undefined}
                  >
                    <span className={`v2-alert__dot v2-alert__dot--${info.severity}`} aria-hidden="true" />
                    <span className="v2-review__event-label">{info.label}</span>
                    <span className="v2-review__event-time">{formatDuration(e.offset_seconds)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <footer className="v2-case__decide">
        {decided && (
          <div className="v2-case__decided">
            <span className={`v2-pill v2-pill--${decided.tone}`}>{REVIEW_LABEL[review.status]}</span>
            <span className="v2-case__decided-by">
              by {review.by} · {relativeTime(review.at)}
            </span>
            <button type="button" className="v2-linkbtn v2-case__reopen" onClick={() => onReopen(item)}>
              <LuRotateCcw aria-hidden="true" /> Reopen
            </button>
          </div>
        )}

        <label className="v2-sr-only" htmlFor="v2-case-note">
          Decision note
        </label>
        <textarea
          id="v2-case-note"
          className="v2-textarea v2-case__note"
          rows={2}
          placeholder="Add a note for this decision (optional)…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="v2-case__actions">
          {REVIEW_OPTIONS.map((o, i) => {
            const current = review?.status === o.value;
            return (
              <button
                key={o.value}
                type="button"
                className={`v2-case__btn v2-case__btn--${o.tone} ${current ? 'is-current' : ''}`}
                onClick={() => onDecide(item, o.value, note.trim())}
                disabled={current && note.trim() === (review.note || '')}
              >
                {current ? `Marked ${o.label.toLowerCase()}` : o.label}
                <kbd className="v2-kbd" aria-hidden="true">
                  {i + 1}
                </kbd>
              </button>
            );
          })}
        </div>
      </footer>
    </article>
  );
}
