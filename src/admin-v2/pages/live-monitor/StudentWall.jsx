import { Card, SelectPill, Skeleton } from '../../components/ui';
import Pagination from '../../components/Pagination';
import StudentTile from './StudentTile';
import { secondsLeft } from './helpers';

const WALL_TABS = [
  { value: 'all', label: 'All' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'reconnecting', label: 'Reconnecting' },
  { value: 'submitted', label: 'Submitted' },
];

const WALL_SORTS = [
  { value: 'flags', label: 'Most flags' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'time', label: 'Least time left' },
];

const PAGE_SIZE = 12;
const GRID_SIZES = [2, 3, 4];

export default function StudentWall({
  exam,
  sessions,
  counts,
  tab,
  onTab,
  sort,
  onSort,
  cols,
  onCols,
  page,
  onPage,
  now,
  pulses,
  onOpen,
  loading,
}) {
  const pages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageRows = sessions.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <Card className="v2-wall">
      <div className="v2-wall__toolbar">
        <div className="v2-tabs" role="tablist" aria-label="Filter students">
          {WALL_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={`v2-tab ${tab === t.value ? 'is-active' : ''}`}
              onClick={() => onTab(t.value)}
            >
              {t.label}
              <span className="v2-tab__count">{counts[t.value] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="v2-wall__controls">
          <SelectPill label="Sort students" value={sort} options={WALL_SORTS} onChange={onSort} />
          <div className="v2-tabs" role="group" aria-label="Grid size">
            {GRID_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={cols === n}
                aria-label={`${n} columns`}
                className={`v2-tab v2-tab--icon ${cols === n ? 'is-active' : ''}`}
                onClick={() => onCols(n)}
              >
                <span className={`v2-gridicon v2-gridicon--${n}`} aria-hidden="true">
                  {Array.from({ length: n }, (_, i) => (
                    <span key={i} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="v2-wall__grid" style={{ '--wall-cols': cols }}>
          {Array.from({ length: cols * 2 }, (_, i) => (
            <Skeleton key={i} height={200} style={{ borderRadius: 16 }} />
          ))}
        </div>
      ) : pageRows.length === 0 ? (
        <p className="v2-wall__empty">No students in this view.</p>
      ) : (
        <div className="v2-wall__grid" style={{ '--wall-cols': cols }}>
          {pageRows.map((s) => (
            <StudentTile
              key={s.id}
              session={s}
              secondsLeft={secondsLeft(s, exam, now)}
              pulse={pulses[s.id] || 0}
              onOpen={() => onOpen(s.id)}
            />
          ))}
        </div>
      )}

      {!loading && sessions.length > PAGE_SIZE && (
        <Pagination page={current} pageSize={PAGE_SIZE} total={sessions.length} onChange={onPage} />
      )}
    </Card>
  );
}
