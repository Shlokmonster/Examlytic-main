import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuCheck, LuCopyPlus, LuFileJson, LuLibrary, LuListChecks, LuPencil, LuPenLine, LuPlus, LuTrash2, LuX } from 'react-icons/lu';
import './question-bank/QuestionBank.css';
import PageHeader from '../components/PageHeader';
import NotificationBell from '../components/notifications/NotificationBell';
import { Button, Card, SelectPill, Skeleton } from '../components/ui';
import Checkbox from '../components/Checkbox';
import Pagination from '../components/Pagination';
import RowMenu from '../components/RowMenu';
import Modal from '../components/Modal';
import { useToast } from '../components/toast/toastContext';
import { useData } from '../data/useData';
import { DIFFICULTIES, SUBJECTS, deleteBankQuestions, listBankQuestions, saveBankQuestion } from '../data/questionBank';
import { listExams } from '../data/exams';
import { LETTERS, copyForExam, newId, newQuestion } from '../utils/questionFormat';
import { relativeTime } from '../utils/time';
import { ADMIN_V2_BASE } from '../layout/navItems';
import JsonImportModal from './exam-builder/JsonImportModal';
import BankEditorDrawer from './question-bank/BankEditorDrawer';

const PAGE_SIZE = 10;
const DIFF = Object.fromEntries(DIFFICULTIES.map((d) => [d.value, d]));
const SORTS = [
  { value: 'recent', label: 'Recently updated' },
  { value: 'used', label: 'Most used' },
  { value: 'az', label: 'A–Z' },
];

function FilterGroup({ title, options, value, onChange }) {
  return (
    <div className="v2-bank-filter">
      <span className="v2-bank-filter__title">{title}</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`v2-bank-filter__opt ${value === o.value ? 'is-active' : ''}`}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          <span>{o.label}</span>
          {o.count != null && <span className="v2-bank-filter__count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export default function QuestionBank() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading } = useData(listBankQuestions);
  const exams = useData(listExams);
  const [local, setLocal] = useState(null);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('all');
  const [type, setType] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const [editing, setEditing] = useState(null); // { question, isNew }
  const [jsonOpen, setJsonOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [targetExam, setTargetExam] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // array of ids

  const all = useMemo(() => local ?? data ?? [], [local, data]);
  const update = (fn) => setLocal((prev) => fn(prev ?? data ?? []));

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((x) => !q || x.text.toLowerCase().includes(q) || x.subject.toLowerCase().includes(q));
  }, [all, search]);

  const rows = useMemo(() => {
    const list = searched.filter(
      (x) => (subject === 'all' || x.subject === subject) && (type === 'all' || x.type === type) && (difficulty === 'all' || x.difficulty === difficulty),
    );
    return list.sort((a, b) => {
      if (sort === 'used') return b.used_in - a.used_in;
      if (sort === 'az') return a.text.localeCompare(b.text);
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
  }, [searched, subject, type, difficulty, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const pageIds = pageRows.map((r) => r.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;

  const resetPage = (setter) => (v) => {
    setter(v);
    setPage(1);
  };

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

  /* ---- Actions ---- */
  const startNew = () =>
    setEditing({
      isNew: true,
      question: { ...newQuestion('mcq'), id: `bq-${newId()}`, subject: subject === 'all' ? SUBJECTS[0] : subject, difficulty: 'medium', used_in: 0, updated_at: new Date().toISOString() },
    });

  const saveQuestion = async (q) => {
    const saved = await saveBankQuestion(q);
    update((list) => (list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...list]));
    toast({ message: editing?.isNew ? 'Question added to the bank' : 'Question saved' });
    setEditing(null);
  };

  const duplicate = async (q) => {
    const copy = await saveBankQuestion({ ...q, id: `bq-${newId()}`, options: [...q.options], used_in: 0 });
    update((list) => [copy, ...list]);
    toast({ message: 'Question duplicated', action: { label: 'Edit', onClick: () => setEditing({ question: copy, isNew: false }) } });
  };

  const doDelete = async () => {
    const ids = confirmDelete;
    setConfirmDelete(null);
    await deleteBankQuestions(ids);
    update((list) => list.filter((x) => !ids.includes(x.id)));
    setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    toast({ message: `${ids.length} ${ids.length === 1 ? 'question' : 'questions'} deleted`, tone: 'neutral' });
  };

  const importJson = async (questions) => {
    const added = [];
    for (const q of questions) {
      added.push(await saveBankQuestion({ ...q, id: `bq-${newId()}`, subject: subject === 'all' ? SUBJECTS[0] : subject, difficulty: 'medium', used_in: 0 }));
    }
    update((list) => [...added, ...list]);
    setJsonOpen(false);
    toast({ message: `${added.length} questions imported` });
  };

  /** Copy the selected questions into an exam and open it in the builder. */
  const addToExam = () => {
    const exam = exams.data?.find((e) => e.id === targetExam);
    if (!exam) return;
    const picked = all
      .filter((q) => selected.has(q.id))
      .map(copyForExam);
    update((list) => list.map((q) => (selected.has(q.id) ? { ...q, used_in: q.used_in + 1 } : q)));
    setAddOpen(false);
    setSelected(new Set());
    navigate(`${ADMIN_V2_BASE}/exams/${exam.id}/edit`, { state: { addQuestions: picked } });
  };

  const count = (pred) => searched.filter(pred).length;

  return (
    <div className="v2-bank-page">
      <PageHeader title="Question Bank" search={search} onSearch={resetPage(setSearch)} searchPlaceholder="Search questions…">
        <NotificationBell />
        <Button variant="outline" onClick={() => setJsonOpen(true)}>
          <LuFileJson aria-hidden="true" /> Import JSON
        </Button>
        <Button onClick={startNew}>
          <LuPlus aria-hidden="true" /> New question
        </Button>
      </PageHeader>

      <div className="v2-bank-page__grid">
        <Card className="v2-bank-filters">
          <FilterGroup
            title="Subject"
            value={subject}
            onChange={resetPage(setSubject)}
            options={[{ value: 'all', label: 'All subjects', count: searched.length }, ...SUBJECTS.map((s) => ({ value: s, label: s, count: count((x) => x.subject === s) }))]}
          />
          <FilterGroup
            title="Type"
            value={type}
            onChange={resetPage(setType)}
            options={[
              { value: 'all', label: 'All types' },
              { value: 'mcq', label: 'Multiple choice', count: count((x) => x.type === 'mcq') },
              { value: 'written', label: 'Written', count: count((x) => x.type === 'written') },
            ]}
          />
          <FilterGroup
            title="Difficulty"
            value={difficulty}
            onChange={resetPage(setDifficulty)}
            options={[{ value: 'all', label: 'Any difficulty' }, ...DIFFICULTIES.map((d) => ({ value: d.value, label: d.label, count: count((x) => x.difficulty === d.value) }))]}
          />
        </Card>

        <Card className="v2-bank">
          <div className="v2-bank__toolbar">
            <div className="v2-bank__toolbar-left">
              <Checkbox
                label="Select all on this page"
                checked={pageIds.length > 0 && selectedOnPage === pageIds.length}
                indeterminate={selectedOnPage > 0 && selectedOnPage < pageIds.length}
                onChange={togglePage}
              />
              <span className="v2-bank__count">
                {rows.length} {rows.length === 1 ? 'question' : 'questions'}
              </span>
              <div className={`v2-bulkbar ${selected.size ? 'is-visible' : ''}`}>
                <span className="v2-bulkbar__count">{selected.size} selected</span>
                <Button size="sm" onClick={() => setAddOpen(true)} tabIndex={selected.size ? 0 : -1}>
                  <LuLibrary aria-hidden="true" /> Add to exam
                </Button>
                <Button variant="outline" size="sm" className="v2-btn--danger-outline" onClick={() => setConfirmDelete([...selected])} tabIndex={selected.size ? 0 : -1}>
                  <LuTrash2 aria-hidden="true" /> Delete
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set())} tabIndex={selected.size ? 0 : -1}>
                  <LuX aria-hidden="true" /> Clear
                </Button>
              </div>
            </div>
            <SelectPill label="Sort questions" value={sort} options={SORTS} onChange={setSort} />
          </div>

          {loading ? (
            <Skeleton height={420} style={{ marginTop: 16 }} />
          ) : (
            <ul className="v2-bank__list">
              {pageRows.map((q) => {
                const Icon = q.type === 'mcq' ? LuListChecks : LuPenLine;
                return (
                  <li
                    key={q.id}
                    className={`v2-bank__row ${selected.has(q.id) ? 'is-selected' : ''}`}
                    tabIndex={0}
                    onClick={() => setEditing({ question: q, isNew: false })}
                    onKeyDown={(e) => e.key === 'Enter' && setEditing({ question: q, isNew: false })}
                  >
                    <Checkbox label={`Select: ${q.text}`} checked={selected.has(q.id)} onChange={(on) => toggle(q.id, on)} />
                    <span className="v2-bank__type" title={q.type === 'mcq' ? 'Multiple choice' : 'Written'}>
                      <Icon aria-hidden="true" />
                    </span>
                    <div className="v2-bank__main">
                      <p className="v2-bank__text">{q.text}</p>
                      <div className="v2-bank__meta">
                        <span className="v2-badge">{q.subject}</span>
                        <span className={`v2-pill v2-pill--${DIFF[q.difficulty].tone}`}>{DIFF[q.difficulty].label}</span>
                        <span>{q.marks} {q.marks === 1 ? 'mark' : 'marks'}</span>
                        <span>· Used in {q.used_in} {q.used_in === 1 ? 'exam' : 'exams'}</span>
                        <span>· Updated {relativeTime(q.updated_at)}</span>
                      </div>
                      {q.type === 'mcq' && (
                        <span className="v2-bank__answer">
                          <LuCheck aria-hidden="true" /> {LETTERS[q.correct]}. {q.options[q.correct]}
                        </span>
                      )}
                    </div>
                    <RowMenu
                      label={`Actions for question`}
                      items={[
                        { label: 'Edit', icon: LuPencil, onSelect: () => setEditing({ question: q, isNew: false }) },
                        { label: 'Duplicate', icon: LuCopyPlus, onSelect: () => duplicate(q) },
                        { label: 'Delete', icon: LuTrash2, tone: 'danger', onSelect: () => setConfirmDelete([q.id]) },
                      ]}
                    />
                  </li>
                );
              })}
              {pageRows.length === 0 && (
                <li className="v2-bank__empty">
                  <p>No questions match your filters.</p>
                  <Button size="sm" onClick={startNew}>
                    <LuPlus aria-hidden="true" /> New question
                  </Button>
                </li>
              )}
            </ul>
          )}

          {!loading && rows.length > PAGE_SIZE && <Pagination page={current} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />}
        </Card>
      </div>

      <BankEditorDrawer question={editing?.question} isNew={editing?.isNew} onClose={() => setEditing(null)} onSave={saveQuestion} />

      <JsonImportModal open={jsonOpen} onClose={() => setJsonOpen(false)} hasQuestions={false} onImported={importJson} />

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        width={460}
        title={`Add ${selected.size} ${selected.size === 1 ? 'question' : 'questions'} to an exam`}
        description="They're copied into the exam and open in the builder so you can review before saving."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={addToExam} disabled={!targetExam}>
              <LuLibrary aria-hidden="true" /> Add and open exam
            </Button>
          </>
        }
      >
        <label className="v2-field">
          <span className="v2-field__label">Exam</span>
          <select className="v2-input" value={targetExam} onChange={(e) => setTargetExam(e.target.value)}>
            <option value="">Choose an exam…</option>
            {(exams.data || []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} · {e.className}
                {e.status === 'draft' ? ' (draft)' : ''}
              </option>
            ))}
          </select>
        </label>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        width={420}
        title={`Delete ${confirmDelete?.length ?? 0} ${confirmDelete?.length === 1 ? 'question' : 'questions'}?`}
        description="They're removed from the bank. Exams that already use them keep their own copies."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button size="sm" className="v2-btn--danger" onClick={doDelete}>
              <LuTrash2 aria-hidden="true" /> Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
