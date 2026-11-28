import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LuArrowDownUp,
  LuAtom,
  LuAudioLines,
  LuBookOpen,
  LuCalculator,
  LuCalendar,
  LuChevronLeft,
  LuChevronRight,
  LuClock,
  LuCopy,
  LuCopyPlus,
  LuDna,
  LuFileText,
  LuFlaskConical,
  LuLandmark,
  LuLayoutGrid,
  LuList,
  LuLock,
  LuLockOpen,
  LuPencil,
  LuPenLine,
  LuPenTool,
  LuTrash2,
  LuTv,
  LuUserPlus,
} from 'react-icons/lu';
import { deleteExam, duplicateExam, listExams, setExamLocked } from '../../data/exams';
import { useData } from '../../data/useData';
import { Button, Card, IconButton, SelectPill, Skeleton } from '../../components/ui';
import Modal from '../../components/Modal';
import RowMenu from '../../components/RowMenu';
import { useElementWidth } from '../../components/useElementWidth';
import { useToast } from '../../components/toast/toastContext';
import { ADMIN_V2_BASE } from '../../layout/navItems';
import { STATUS_META, examStatus, formatWhen } from '../../utils/examStatus';
import ExamsTable from './ExamsTable';

const TYPES = [
  { value: 'mcq', label: 'MCQ', icon: LuFileText },
  { value: 'written', label: 'Written', icon: LuPenLine },
  { value: 'viva', label: 'Viva', icon: LuAudioLines },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'draft', label: 'Draft' },
  { value: 'closed', label: 'Closed' },
];

const SORTS = [
  { value: 'date-asc', label: 'Date (soonest first)' },
  { value: 'date-desc', label: 'Date (latest first)' },
  { value: 'title', label: 'Name (A–Z)' },
];

const SUBJECT_ICONS = {
  chemistry: LuFlaskConical,
  physics: LuAtom,
  math: LuCalculator,
  biology: LuDna,
  english: LuBookOpen,
  history: LuLandmark,
};

const CARD_W = 300;
const GAP = 16;

function ExamCover({ exam, status }) {
  const meta = STATUS_META[status];
  const Icon = SUBJECT_ICONS[exam.subject] || LuPenTool;
  return (
    <div className="v2-exam-card__coverwrap">
      {exam.coverUrl ? (
        <img className="v2-exam-card__cover" src={exam.coverUrl} alt="" />
      ) : (
        <div className={`v2-exam-card__cover v2-exam-card__cover--${exam.subject}`} aria-hidden="true">
          <Icon className="v2-exam-card__cover-bg" />
          <Icon className="v2-exam-card__cover-icon" />
        </div>
      )}
      <span className={`v2-exam-card__status v2-exam-card__status--${meta.tone}`}>
        {status === 'open' && exam.live_count > 0 ? `● Live · ${exam.live_count}` : meta.label}
      </span>
      {!exam.is_active && (
        <span className="v2-exam-card__lock" title="Locked: students can't enter">
          <LuLock aria-hidden="true" /> Locked
        </span>
      )}
    </div>
  );
}

function ExamCard({ exam, highlighted, onOpen, menuItems }) {
  const status = examStatus(exam);
  return (
    <article className="v2-exam-card" style={{ width: CARD_W }}>
      <ExamCover exam={exam} status={status} />
      <ul className="v2-exam-card__meta">
        <li>
          <LuCalendar aria-hidden="true" /> {exam.start_at ? formatWhen(exam.start_at) : status === 'draft' ? 'Not scheduled' : 'Anytime'}
        </li>
        <li>
          <LuClock aria-hidden="true" /> {exam.durationHours} {exam.durationHours === 1 ? 'hour' : 'hours'}
        </li>
        <li>{exam.questionCount} Qs</li>
      </ul>
      <div className="v2-exam-card__title-row">
        <h3 className="v2-exam-card__title">{exam.title}</h3>
        <span className="v2-badge">{exam.className}</span>
        <RowMenu label={`Actions for ${exam.title}`} items={menuItems} />
      </div>
      <button type="button" className={`v2-exam-card__cta ${highlighted ? 'is-filled' : ''}`} onClick={onOpen}>
        View More
      </button>
    </article>
  );
}

export default function ManageExams({ search = '' }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading } = useData(listExams);
  const [local, setLocal] = useState(null); // local edits on top of loaded data
  const [view, setView] = useState('cards');
  const [type, setType] = useState('mcq');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('date-asc');
  const [index, setIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewportRef, viewportW] = useElementWidth();

  const all = useMemo(() => local ?? data ?? [], [local, data]);
  const update = (fn) => setLocal((prev) => fn(prev ?? data ?? []));

  const exams = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = all.filter(
      (e) =>
        (view === 'list' || e.type === type) &&
        (statusFilter === 'all' || examStatus(e) === statusFilter) &&
        (!q || e.title.toLowerCase().includes(q) || e.className.toLowerCase().includes(q) || (e.code || '').toLowerCase().includes(q)),
    );
    return list.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      const diff = new Date(a.start_at || a.date) - new Date(b.start_at || b.date);
      return sort === 'date-desc' ? -diff : diff;
    });
  }, [all, view, type, statusFilter, sort, search]);

  // How many cards fit fully; the arrows stop when the last card is in view.
  const visible = Math.max(1, Math.floor((viewportW + GAP) / (CARD_W + GAP)));
  const maxIndex = Math.max(0, exams.length - visible);
  const current = Math.min(index, maxIndex);

  const resetAnd = (setter) => (v) => {
    setter(v);
    setIndex(0);
  };

  /* ---- Actions ---- */
  const openEditor = (e) => navigate(`${ADMIN_V2_BASE}/exams/${e.id}/edit`);

  const copyCode = async (e) => {
    try {
      await navigator.clipboard.writeText(e.code);
      toast({ message: `Code ${e.code} copied` });
    } catch {
      toast({ message: `Couldn't copy. The code is ${e.code}`, tone: 'neutral' });
    }
  };

  const toggleLock = async (e, locked) => {
    update((list) => list.map((x) => (x.id === e.id ? { ...x, is_active: !locked } : x)));
    await setExamLocked(e.id, locked);
    toast({
      message: locked ? `${e.title} locked. Students can't enter.` : `${e.title} unlocked.`,
      tone: locked ? 'neutral' : 'success',
    });
  };

  const duplicate = async (e) => {
    const copy = await duplicateExam(e.id);
    if (!copy) return;
    update((list) => {
      const i = list.findIndex((x) => x.id === e.id);
      return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
    });
    toast({ message: `Created “${copy.title}” as a draft`, action: { label: 'Open', onClick: () => openEditor(copy) } });
  };

  const doDelete = async () => {
    const e = confirmDelete;
    setConfirmDelete(null);
    update((list) => list.filter((x) => x.id !== e.id));
    await deleteExam(e.id);
    toast({ message: `${e.title} deleted`, tone: 'neutral' });
  };

  const menuItemsFor = (e) => {
    const status = examStatus(e);
    return [
      { label: 'Edit exam', icon: LuPencil, onSelect: () => openEditor(e) },
      ...(status === 'open' && e.live_count > 0
        ? [{ label: 'Monitor live', icon: LuTv, onSelect: () => navigate(`${ADMIN_V2_BASE}/live-monitor?exam=${e.id}`) }]
        : []),
      ...(e.code ? [{ label: 'Copy join code', icon: LuCopy, onSelect: () => copyCode(e) }] : []),
      { label: 'Duplicate', icon: LuCopyPlus, onSelect: () => duplicate(e) },
      e.is_active
        ? { label: 'Lock exam', icon: LuLock, onSelect: () => toggleLock(e, true) }
        : { label: 'Unlock exam', icon: LuLockOpen, onSelect: () => toggleLock(e, false) },
      { label: 'Delete', icon: LuTrash2, tone: 'danger', onSelect: () => setConfirmDelete(e) },
    ];
  };

  return (
    <Card className="v2-manage">
      <div className="v2-card-head">
        <div className="v2-manage__title">
          <span className="v2-manage__title-icon" aria-hidden="true">
            <LuPenTool />
          </span>
          <h2 className="h2">Manage All Exams in One Place</h2>
        </div>
        <Button>
          Invite Students <LuUserPlus aria-hidden="true" />
        </Button>
      </div>

      <div className="v2-manage__toolbar">
        <div className="v2-manage__filters">
          <span className="v2-manage__sort-label">Sort</span>
          <label className="v2-icon-select" title="Sort exams">
            <LuArrowDownUp aria-hidden="true" />
            <select aria-label="Sort exams" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {view === 'cards' && (
            <div className="v2-manage__types" role="tablist" aria-label="Exam type">
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
                    onClick={() => resetAnd(setType)(t.value)}
                  >
                    <Icon aria-hidden="true" /> {t.label}
                  </Button>
                );
              })}
            </div>
          )}
          <SelectPill label="Filter by status" value={statusFilter} options={STATUS_FILTERS} onChange={resetAnd(setStatusFilter)} />
        </div>

        <div className="v2-manage__nav">
          <div className="v2-tabs" role="radiogroup" aria-label="View">
            <button
              type="button"
              role="radio"
              aria-checked={view === 'cards'}
              aria-label="Card view"
              className={`v2-tab v2-tab--icon ${view === 'cards' ? 'is-active' : ''}`}
              onClick={() => setView('cards')}
            >
              <LuLayoutGrid aria-hidden="true" />
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={view === 'list'}
              aria-label="List view"
              className={`v2-tab v2-tab--icon ${view === 'list' ? 'is-active' : ''}`}
              onClick={() => setView('list')}
            >
              <LuList aria-hidden="true" />
            </button>
          </div>
          {view === 'cards' && (
            <>
              <IconButton
                label="Previous exams"
                className="v2-manage__nav-btn"
                disabled={current === 0}
                onClick={() => setIndex(Math.max(0, current - 1))}
              >
                <LuChevronLeft />
              </IconButton>
              <IconButton
                label="Next exams"
                variant="primary"
                className="v2-manage__nav-btn"
                disabled={current >= maxIndex}
                onClick={() => setIndex(Math.min(maxIndex, current + 1))}
              >
                <LuChevronRight />
              </IconButton>
            </>
          )}
        </div>
      </div>

      {view === 'list' ? (
        loading ? (
          <Skeleton height={320} style={{ marginTop: 16, marginRight: 24 }} />
        ) : exams.length === 0 ? (
          <p className="v2-manage__empty">No exams match your filters.</p>
        ) : (
          <ExamsTable exams={exams} menuItemsFor={menuItemsFor} onOpen={openEditor} onCopyCode={copyCode} onToggleLock={toggleLock} />
        )
      ) : (
        <div className="v2-manage__viewport" ref={viewportRef}>
          {loading ? (
            <div className="v2-manage__track" style={{ gap: GAP }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} width={CARD_W} height={330} style={{ borderRadius: 16, flex: 'none' }} />
              ))}
            </div>
          ) : exams.length === 0 ? (
            <p className="v2-manage__empty">No exams match your filters.</p>
          ) : (
            <div className="v2-manage__track" style={{ gap: GAP, transform: `translateX(-${current * (CARD_W + GAP)}px)` }}>
              {exams.map((exam, i) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  highlighted={i === current}
                  onOpen={() => openEditor(exam)}
                  menuItems={menuItemsFor(exam)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        width={440}
        title={`Delete ${confirmDelete?.title ?? 'exam'}?`}
        description="This removes the exam and its questions. Past attempts and recordings stay in student reports."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button size="sm" className="v2-btn--danger" onClick={doDelete}>
              <LuTrash2 aria-hidden="true" /> Delete exam
            </Button>
          </>
        }
      >
        {confirmDelete?.live_count > 0 && (
          <p className="v2-field__error">{confirmDelete.live_count} students are taking this exam right now.</p>
        )}
      </Modal>
    </Card>
  );
}
