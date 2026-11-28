import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuAudioLines, LuFileText, LuPlus, LuSearch, LuSquarePen, LuPenLine } from 'react-icons/lu';
import { getUpcomingExams } from '../../data/dashboard';
import { useData } from '../../data/useData';
import { Button, Card, IconButton, SelectPill, Skeleton } from '../../components/ui';
import { ADMIN_V2_BASE } from '../../layout/navItems';

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

const TYPES = [
  { value: 'mcq', label: 'MCQ', icon: LuFileText },
  { value: 'written', label: 'Written', icon: LuPenLine },
  { value: 'viva', label: 'Viva', icon: LuAudioLines },
];

function timeTone({ value, unit }) {
  if (unit === 'Hours' || value <= 1) return 'danger';
  if (value <= 3) return 'warning';
  return 'success';
}

export default function UpcomingExams() {
  const navigate = useNavigate();
  const [range, setRange] = useState('today');
  const [type, setType] = useState('mcq');
  const [search, setSearch] = useState('');
  const { data, loading } = useData(getUpcomingExams, range);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter(
      (r) =>
        r.type === type &&
        (!q || r.exam.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q) || r.className.includes(q)),
    );
  }, [data, type, search]);

  return (
    <Card className="v2-upcoming">
      <div className="v2-card-head v2-upcoming__head">
        <h2 className="h2">Upcoming Exams</h2>
        <div className="v2-upcoming__filters">
          <label className="v2-search">
            <LuSearch aria-hidden="true" />
            <input
              type="search"
              placeholder="Search exam"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search exam"
            />
          </label>
          <SelectPill label="Date range" value={range} options={RANGES} onChange={setRange} />
        </div>
      </div>

      <div className="v2-upcoming__toolbar">
        <div className="v2-upcoming__types" role="tablist" aria-label="Exam type">
          {TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <Button
                key={t.value}
                role="tab"
                aria-selected={type === t.value}
                variant="outline"
                size="sm"
                className={type === t.value ? 'is-active' : ''}
                onClick={() => setType(t.value)}
              >
                <Icon aria-hidden="true" /> {t.label}
              </Button>
            );
          })}
        </div>
        <Button size="sm" className="v2-upcoming__add" onClick={() => navigate(`${ADMIN_V2_BASE}/exams/new`)}>
          <LuPlus aria-hidden="true" /> Add Exam
        </Button>
      </div>

      <div className="v2-table-wrap">
        {loading ? (
          <Skeleton height={200} />
        ) : (
          <table className="v2-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Start Time</th>
                <th>Duration</th>
                <th>Candidates</th>
                <th>Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.exam}</td>
                  <td>{r.className}</td>
                  <td>{r.subject}</td>
                  <td>{r.startTime}</td>
                  <td>{r.duration} Min</td>
                  <td>{r.candidates}</td>
                  <td className={`v2-time v2-time--${timeTone(r.timeLeft)}`}>
                    {r.timeLeft.value} {r.timeLeft.unit} Left
                  </td>
                  <td>
                    <IconButton label={`Edit ${r.subject} ${r.exam}`} variant="ghost" size="sm">
                      <LuSquarePen />
                    </IconButton>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="v2-table__empty">
                    No upcoming exams match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
