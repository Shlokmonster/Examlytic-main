import { LuFileDown, LuPlay, LuVideoOff } from 'react-icons/lu';
import { Button, Card, IconButton } from '../../components/ui';
import { formatDuration } from '../../components/useNow';
import { REVIEW_LABEL, REVIEW_TONE, integrityTone } from './summary';

const fmtDate = (iso) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

export default function ExamHistory({ attempts, onReview, onDownload, downloadingId }) {
  return (
    <Card className="v2-history">
      <div className="v2-card-head">
        <h2 className="h2">Exam History</h2>
        <span className="v2-side-meta">
          {attempts.filter((a) => a.review.status === 'none').length} not reviewed
        </span>
      </div>

      <div className="v2-table-wrap v2-history__wrap">
        <table className="v2-dtable">
          <thead>
            <tr>
              <th>Exam</th>
              <th>Date</th>
              <th>Duration</th>
              <th>Score</th>
              <th>Integrity</th>
              <th className="is-num">Flags</th>
              <th>Recording</th>
              <th>Review</th>
              <th className="v2-dtable__actions">
                <span className="v2-sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {[...attempts].reverse().map((a) => (
              <tr key={a.id} tabIndex={0} onClick={() => onReview(a.id)} onKeyDown={(e) => e.key === 'Enter' && onReview(a.id)}>
                <td>
                  <div className="v2-person__text">
                    <span className="v2-person__name">{a.exam_title}</span>
                    <span className="v2-person__email">{a.subject}</span>
                  </div>
                </td>
                <td className="v2-dtable__muted">{fmtDate(a.started_at)}</td>
                <td className="v2-dtable__muted">{a.duration_minutes} min</td>
                <td>
                  <div className="v2-scorebar">
                    <span className="v2-scorebar__value">{a.score}%</span>
                    <span className="v2-scorebar__track">
                      <span className="v2-scorebar__fill" style={{ transform: `scaleX(${a.score / 100})` }} />
                    </span>
                  </div>
                </td>
                <td>
                  <span className={`v2-pill v2-pill--${integrityTone(a.integrity_score)}`}>{a.integrity_score}</span>
                </td>
                <td className="is-num">
                  <span className={a.events.length ? 'v2-history__flags' : 'v2-dtable__muted'}>{a.events.length}</span>
                </td>
                <td>
                  {a.recording_duration ? (
                    <span className="v2-history__rec">
                      <LuPlay aria-hidden="true" /> {formatDuration(a.recording_duration)}
                    </span>
                  ) : (
                    <span className="v2-history__rec is-missing">
                      <LuVideoOff aria-hidden="true" /> No recording
                    </span>
                  )}
                </td>
                <td>
                  <span className={`v2-pill v2-pill--${REVIEW_TONE[a.review.status]}`}>{REVIEW_LABEL[a.review.status]}</span>
                </td>
                <td className="v2-dtable__actions">
                  <div className="v2-history__actions" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => onReview(a.id)}>
                      Review
                    </Button>
                    <IconButton
                      label={`Download ${a.exam_title} answer sheet (PDF)`}
                      variant="ghost"
                      size="sm"
                      onClick={() => onDownload(a)}
                      disabled={downloadingId === a.id}
                    >
                      <LuFileDown />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
