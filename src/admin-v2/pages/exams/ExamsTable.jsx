import { LuCopy } from 'react-icons/lu';
import Toggle from '../../components/Toggle';
import RowMenu from '../../components/RowMenu';
import { STATUS_META, examStatus, formatWhen } from '../../utils/examStatus';

const TYPE_LABEL = { mcq: 'MCQ', written: 'Written', viva: 'Viva' };

/** List view of exams with status, schedule, code, lock toggle and actions. */
export default function ExamsTable({ exams, menuItemsFor, onOpen, onCopyCode, onToggleLock }) {
  return (
    <div className="v2-table-wrap v2-exams-table__wrap">
      <table className="v2-dtable v2-exams-table">
        <thead>
          <tr>
            <th>Exam</th>
            <th>Class</th>
            <th>Status</th>
            <th>Opens</th>
            <th className="is-num">Questions</th>
            <th>Code</th>
            <th>Access</th>
            <th className="v2-dtable__actions">
              <span className="v2-sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {exams.map((e) => {
            const status = examStatus(e);
            const meta = STATUS_META[status];
            return (
              <tr key={e.id} tabIndex={0} onClick={() => onOpen(e)} onKeyDown={(ev) => ev.key === 'Enter' && onOpen(e)}>
                <td>
                  <div className="v2-person__text">
                    <span className="v2-person__name">{e.title}</span>
                    <span className="v2-person__email">
                      {TYPE_LABEL[e.type]} · {e.subject.charAt(0).toUpperCase() + e.subject.slice(1)}
                    </span>
                  </div>
                </td>
                <td>
                  <span className="v2-badge">{e.className}</span>
                </td>
                <td>
                  <div className="v2-exams-table__status">
                    <span className={`v2-pill v2-pill--${meta.tone}`}>{meta.label}</span>
                    {status === 'open' && e.live_count > 0 && (
                      <span className="v2-status v2-status--live">
                        <span className="v2-status__dot" aria-hidden="true" />
                        {e.live_count} taking now
                      </span>
                    )}
                  </div>
                </td>
                <td className="v2-dtable__muted">{e.start_at ? formatWhen(e.start_at) : status === 'draft' ? '—' : 'Anytime'}</td>
                <td className="is-num">{e.questionCount}</td>
                <td>
                  {e.code ? (
                    <button
                      type="button"
                      className="v2-codechip"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onCopyCode(e);
                      }}
                      aria-label={`Copy code ${e.code}`}
                    >
                      {e.code} <LuCopy aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="v2-dtable__muted">Not published</span>
                  )}
                </td>
                <td onClick={(ev) => ev.stopPropagation()}>
                  <Toggle
                    hideLabel
                    id={`lock-${e.id}`}
                    label={e.is_active ? `Lock ${e.title}` : `Unlock ${e.title}`}
                    checked={e.is_active}
                    onChange={(on) => onToggleLock(e, !on)}
                  />
                </td>
                <td className="v2-dtable__actions">
                  <RowMenu label={`Actions for ${e.title}`} items={menuItemsFor(e)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
