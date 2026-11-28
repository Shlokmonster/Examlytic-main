import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuDownload, LuFileText, LuShieldAlert, LuUserRound, LuX } from 'react-icons/lu';
import { listStudents } from '../../data/students';
import { useData } from '../../data/useData';
import { Button, Card, SelectPill, Skeleton } from '../../components/ui';
import Avatar from '../../components/Avatar';
import Checkbox from '../../components/Checkbox';
import Pagination from '../../components/Pagination';
import RowMenu from '../../components/RowMenu';
import { downloadCsv, STUDENT_CSV_COLUMNS } from '../../utils/csv';
import { ADMIN_V2_BASE } from '../../layout/navItems';

const PAGE_SIZE = 10;

const TABS = [
  { value: 'all', label: 'All', test: () => true },
  { value: 'live', label: 'Live', test: (s) => s.status === 'live' },
  { value: 'flagged', label: 'Flagged', test: (s) => s.flags_30d > 0 },
  { value: 'inactive', label: 'Inactive', test: (s) => s.status === 'inactive' },
];

const CLASS_OPTIONS = [
  { value: 'all', label: 'All classes' },
  ...['Class-08', 'Class-09', 'Class-10', 'Class-11', 'Class-12'].map((c) => ({ value: c, label: c })),
];

const SORTS = [
  { value: 'name', label: 'Name A–Z', compare: (a, b) => a.user_name.localeCompare(b.user_name) },
  { value: 'score', label: 'Top score', compare: (a, b) => b.avg_score - a.avg_score },
  { value: 'integrity', label: 'Lowest integrity', compare: (a, b) => a.integrity_score - b.integrity_score },
  { value: 'recent', label: 'Recently active', compare: (a, b) => new Date(b.last_active_at) - new Date(a.last_active_at) },
];

const STATUS_LABEL = { live: 'Live in exam', active: 'Active', inactive: 'Inactive' };

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
}

function integrityTone(score) {
  if (score >= 90) return 'success';
  if (score >= 70) return 'warning';
  return 'danger';
}

export default function StudentsTable({ search = '' }) {
  const navigate = useNavigate();
  const { data, loading } = useData(listStudents);
  const [tab, setTab] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());

  const students = useMemo(() => data || [], [data]);

  // Everything except the tab filter, so tab counts reflect search + class.
  const baseFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(
      (s) =>
        (classFilter === 'all' || s.class_name === classFilter) &&
        (!q || s.user_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.roll_no.includes(q)),
    );
  }, [students, search, classFilter]);

  const rows = useMemo(() => {
    const t = TABS.find((x) => x.value === tab);
    const s = SORTS.find((x) => x.value === sort);
    return baseFiltered.filter(t.test).sort(s.compare);
  }, [baseFiltered, tab, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const pageIds = pageRows.map((r) => r.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const allOnPage = pageIds.length > 0 && selectedOnPage === pageIds.length;

  const toggle = (id, on) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const togglePage = (on) =>
    setSelected((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const resetPage = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const openProfile = (id) => navigate(`${ADMIN_V2_BASE}/students/${id}`);

  const exportSelected = () =>
    downloadCsv(
      'students-selected.csv',
      STUDENT_CSV_COLUMNS,
      students.filter((s) => selected.has(s.id)),
    );

  return (
    <Card className="v2-students">
      <div className="v2-card-head">
        <h2 className="h2">All Students</h2>
        <div className="v2-students__filters">
          <SelectPill label="Filter by class" value={classFilter} options={CLASS_OPTIONS} onChange={resetPage(setClassFilter)} />
          <SelectPill label="Sort students" value={sort} options={SORTS} onChange={resetPage(setSort)} />
        </div>
      </div>

      <div className="v2-students__toolbar">
        <div className="v2-tabs" role="tablist" aria-label="Student status">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={`v2-tab ${tab === t.value ? 'is-active' : ''}`}
              onClick={() => resetPage(setTab)(t.value)}
            >
              {t.label}
              <span className="v2-tab__count">{baseFiltered.filter(t.test).length}</span>
            </button>
          ))}
        </div>

        <div className={`v2-bulkbar ${selected.size > 0 ? 'is-visible' : ''}`} aria-live="polite">
          <span className="v2-bulkbar__count">{selected.size} selected</span>
          <Button variant="outline" size="sm" onClick={exportSelected} tabIndex={selected.size ? 0 : -1}>
            <LuDownload aria-hidden="true" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set())} tabIndex={selected.size ? 0 : -1}>
            <LuX aria-hidden="true" /> Clear
          </Button>
        </div>
      </div>

      <div className="v2-table-wrap v2-students__wrap">
        {loading ? (
          <Skeleton height={420} />
        ) : (
          <table className="v2-dtable">
            <thead>
              <tr>
                <th className="v2-dtable__check">
                  <Checkbox
                    label="Select all students on this page"
                    checked={allOnPage}
                    indeterminate={selectedOnPage > 0 && !allOnPage}
                    onChange={togglePage}
                  />
                </th>
                <th>Student</th>
                <th>Class</th>
                <th>Roll No.</th>
                <th className="is-num">Exams</th>
                <th>Avg Score</th>
                <th>Integrity</th>
                <th>Last Active</th>
                <th>Status</th>
                <th className="v2-dtable__actions">
                  <span className="v2-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((s) => (
                <tr
                  key={s.id}
                  className={selected.has(s.id) ? 'is-selected' : ''}
                  tabIndex={0}
                  onClick={() => openProfile(s.id)}
                  onKeyDown={(e) => e.key === 'Enter' && openProfile(s.id)}
                  aria-label={`Open profile of ${s.user_name}`}
                >
                  <td className="v2-dtable__check">
                    <Checkbox label={`Select ${s.user_name}`} checked={selected.has(s.id)} onChange={(on) => toggle(s.id, on)} />
                  </td>
                  <td>
                    <div className="v2-person">
                      <Avatar name={s.user_name} src={s.user_avatar} />
                      <div className="v2-person__text">
                        <span className="v2-person__name">{s.user_name}</span>
                        <span className="v2-person__email">{s.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="v2-badge">{s.class_name}</span>
                  </td>
                  <td className="v2-dtable__muted">{s.roll_no}</td>
                  <td className="is-num">{s.exams_taken}</td>
                  <td>
                    <div className="v2-scorebar">
                      <span className="v2-scorebar__value">{s.avg_score}%</span>
                      <span className="v2-scorebar__track">
                        <span className="v2-scorebar__fill" style={{ transform: `scaleX(${s.avg_score / 100})` }} />
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`v2-pill v2-pill--${integrityTone(s.integrity_score)}`}>{s.integrity_score}</span>
                  </td>
                  <td className="v2-dtable__muted">{relativeTime(s.last_active_at)}</td>
                  <td>
                    <span className={`v2-status v2-status--${s.status}`}>
                      <span className="v2-status__dot" aria-hidden="true" />
                      {STATUS_LABEL[s.status]}
                    </span>
                  </td>
                  <td className="v2-dtable__actions">
                    <RowMenu
                      label={`Actions for ${s.user_name}`}
                      items={[
                        { label: 'View profile', icon: LuUserRound, onSelect: () => openProfile(s.id) },
                        { label: 'Download answer sheet', icon: LuFileText },
                        { label: 'Report incident', icon: LuShieldAlert, tone: 'danger' },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr className="v2-dtable__empty-row">
                  <td colSpan={10} className="v2-dtable__empty">
                    No students match your search or filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {!loading && rows.length > 0 && <Pagination page={current} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />}
    </Card>
  );
}
