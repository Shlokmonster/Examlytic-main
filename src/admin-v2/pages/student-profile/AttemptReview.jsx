import { useCallback, useState } from 'react';
import { LuCheck, LuFileDown, LuX } from 'react-icons/lu';
import { Button, IconButton } from '../../components/ui';
import { formatDuration } from '../../components/useNow';
import { alertInfo } from '../../utils/alerts';
import RecordingPlayer from './RecordingPlayer';
import { REVIEW_LABEL, REVIEW_OPTIONS, integrityTone } from './summary';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'ai', label: 'AI' },
  { value: 'browser', label: 'Browser' },
];

const fmtDate = (iso) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

export default function AttemptReview({ attempt, onClose, onSaveReview, onDownload, downloading }) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [filter, setFilter] = useState('all');
  const [verdict, setVerdict] = useState(attempt?.review.status === 'none' ? '' : attempt?.review.status || '');
  const [note, setNote] = useState(attempt?.review.note || '');
  const [saved, setSaved] = useState(false);

  const onTime = useCallback((t) => setTime(t), []);
  const onPlaying = useCallback((p) => setPlaying(p), []);

  if (!attempt) return null;

  const events = [...attempt.events].sort((a, b) => a.offset_seconds - b.offset_seconds);
  const visible = events.filter((e) => filter === 'all' || alertInfo(e.type).category === filter);
  const activeId = [...events].reverse().find((e) => e.offset_seconds <= time)?.id;
  const hasRecording = Boolean(attempt.recording_duration);

  const save = () => {
    onSaveReview(attempt.id, { status: verdict, note: note.trim() });
    setSaved(true);
  };

  return (
    <div className="v2-review">
      <header className="v2-review__head">
        <div>
          <h2 className="v2-review__title">{attempt.exam_title}</h2>
          <p className="v2-review__meta">
            {fmtDate(attempt.started_at)} · {attempt.duration_minutes} min · Score <strong>{attempt.score}%</strong> · Integrity{' '}
            <span className={`v2-pill v2-pill--${integrityTone(attempt.integrity_score)}`}>{attempt.integrity_score}</span>
          </p>
        </div>
        <IconButton label="Close review" variant="ghost" onClick={onClose}>
          <LuX />
        </IconButton>
      </header>

      <div className="v2-review__body">
        <section className="v2-review__main">
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

          <div className="v2-review__answers">
            <div className="v2-review__answer-stats">
              <span>
                <strong className="is-success">{attempt.answers.correct}</strong> correct
              </span>
              <span>
                <strong className="is-danger">{attempt.answers.wrong}</strong> wrong
              </span>
              <span>
                <strong>{attempt.answers.skipped}</strong> skipped
              </span>
              <span className="v2-dtable__muted">of {attempt.answers.total} questions</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => onDownload(attempt)} disabled={downloading}>
              <LuFileDown aria-hidden="true" /> {downloading ? 'Preparing…' : 'Answer sheet PDF'}
            </Button>
          </div>

          <div className="v2-review__verdict">
            <h3 className="v2-side-title">Reviewer verdict</h3>
            <div className="v2-verdict" role="radiogroup" aria-label="Verdict">
              {REVIEW_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={verdict === o.value}
                  className={`v2-verdict__opt v2-verdict__opt--${o.tone} ${verdict === o.value ? 'is-active' : ''}`}
                  onClick={() => {
                    setVerdict(o.value);
                    setSaved(false);
                  }}
                >
                  {verdict === o.value && <LuCheck aria-hidden="true" />}
                  {o.label}
                </button>
              ))}
            </div>
            <textarea
              className="v2-textarea"
              rows={3}
              placeholder="Add a note for this decision (optional)…"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setSaved(false);
              }}
              aria-label="Reviewer note"
            />
            <div className="v2-review__save">
              {saved && (
                <span className="v2-review__saved" role="status">
                  <LuCheck aria-hidden="true" /> Saved as {REVIEW_LABEL[verdict]}
                </span>
              )}
              <Button size="sm" onClick={save} disabled={!verdict}>
                Save verdict
              </Button>
            </div>
          </div>
        </section>

        <aside className="v2-review__events">
          <div className="v2-card-head">
            <h3 className="v2-side-title">Events ({events.length})</h3>
          </div>
          <div className="v2-tabs v2-review__filters" role="tablist" aria-label="Event type">
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
          <ol className="v2-review__list">
            {visible.map((e) => {
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
            {visible.length === 0 && <li className="v2-timeline__empty">No events — a clean attempt.</li>}
          </ol>
        </aside>
      </div>
    </div>
  );
}
