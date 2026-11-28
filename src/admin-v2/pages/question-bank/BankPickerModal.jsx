import { useMemo, useState } from 'react';
import { LuLibrary, LuSearch } from 'react-icons/lu';
import Modal from '../../components/Modal';
import './QuestionBank.css';
import Checkbox from '../../components/Checkbox';
import { Button, Skeleton } from '../../components/ui';
import { useData } from '../../data/useData';
import { DIFFICULTIES, SUBJECTS, listBankQuestions } from '../../data/questionBank';
import { copyForExam } from '../../utils/questionFormat';

const DIFF = Object.fromEntries(DIFFICULTIES.map((d) => [d.value, d]));

/** Pick questions from the bank to add to an exam (copies get new ids). */
export default function BankPickerModal({ open, onClose, onAdd, defaultSubject = '' }) {
  const { data, loading } = useData(listBankQuestions);
  const [query, setQuery] = useState('');
  const initialSubject = SUBJECTS.find((s) => s.toLowerCase() === defaultSubject.trim().toLowerCase()) || 'all';
  const [subject, setSubject] = useState(initialSubject);
  const [selected, setSelected] = useState(() => new Set());

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data || []).filter((x) => (subject === 'all' || x.subject === subject) && (!q || x.text.toLowerCase().includes(q)));
  }, [data, query, subject]);

  const toggle = (id, on) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const add = () => {
    const picked = (data || []).filter((q) => selected.has(q.id));
    onAdd(picked.map(copyForExam));
    setSelected(new Set());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={680}
      title="Add from Question Bank"
      description="Pick saved questions. They're copied into this exam, so editing them here won't change the bank."
      footer={
        <>
          <span className="v2-picker__count">{selected.size} selected</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={add} disabled={!selected.size}>
            <LuLibrary aria-hidden="true" /> Add {selected.size || ''} {selected.size === 1 ? 'question' : 'questions'}
          </Button>
        </>
      }
    >
      <div className="v2-picker__filters">
        <label className="v2-page-search v2-picker__search">
          <LuSearch aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions…" aria-label="Search questions" />
        </label>
        <select className="v2-input v2-picker__subject" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
          <option value="all">All subjects</option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="v2-picker__list">
        {loading ? (
          <Skeleton height={240} />
        ) : (
          list.map((q) => (
            <div
              key={q.id}
              className={`v2-picker__item ${selected.has(q.id) ? 'is-selected' : ''}`}
              onClick={() => toggle(q.id, !selected.has(q.id))}
            >
              <Checkbox label={`Select: ${q.text}`} checked={selected.has(q.id)} onChange={(on) => toggle(q.id, on)} />
              <span className="v2-picker__text">{q.text}</span>
              <span className="v2-picker__meta">
                <span className="v2-badge">{q.subject}</span>
                <span className={`v2-pill v2-pill--${DIFF[q.difficulty].tone}`}>{DIFF[q.difficulty].label}</span>
                <span className="v2-dtable__muted">{q.type === 'mcq' ? 'MCQ' : 'Written'}</span>
              </span>
            </div>
          ))
        )}
        {!loading && list.length === 0 && <p className="v2-manage__empty">No questions match.</p>}
      </div>
    </Modal>
  );
}
