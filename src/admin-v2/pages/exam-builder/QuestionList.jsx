import { useState } from 'react';
import { LuFileJson, LuGripVertical, LuLibrary, LuListChecks, LuPenLine, LuPlus, LuSparkles } from 'react-icons/lu';
import { questionIssues } from '../../utils/questionFormat';

export default function QuestionList({ questions, selectedId, onSelect, onAdd, onReorder, onOpenAi, onOpenJson, onOpenBank, showIssues }) {
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const totalMarks = questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);

  return (
    <nav className="v2-qlist" aria-label="Questions">
      <div className="v2-qlist__head">
        <span className="v2-side-title">Questions</span>
        <span className="v2-side-meta">
          {questions.length} · {totalMarks} marks
        </span>
      </div>

      <ol className="v2-qlist__items">
        {questions.map((q, i) => {
          const incomplete = questionIssues(q).length > 0;
          const Icon = q.type === 'mcq' ? LuListChecks : LuPenLine;
          return (
            <li
              key={q.id}
              draggable
              onDragStart={(e) => {
                setDragId(q.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (overId !== q.id) setOverId(q.id);
              }}
              onDragLeave={() => setOverId((o) => (o === q.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dragId !== q.id) onReorder(dragId, q.id);
                setDragId(null);
                setOverId(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              className={[dragId === q.id ? 'is-dragging' : '', overId === q.id && dragId !== q.id ? 'is-over' : ''].join(' ')}
            >
              <button
                type="button"
                className={`v2-qlist__item ${q.id === selectedId ? 'is-active' : ''} ${showIssues && incomplete ? 'has-issue' : ''}`}
                onClick={() => onSelect(q.id)}
                aria-current={q.id === selectedId ? 'true' : undefined}
              >
                <LuGripVertical className="v2-qlist__grip" aria-hidden="true" />
                <span className="v2-qlist__num">{i + 1}</span>
                <span className="v2-qlist__text">{q.text.trim() || <em>Untitled question</em>}</span>
                <span className="v2-qlist__meta">
                  <Icon aria-label={q.type === 'mcq' ? 'Multiple choice' : 'Written'} />
                  {incomplete ? <span className="v2-qlist__dot" aria-label="Incomplete" /> : null}
                </span>
              </button>
            </li>
          );
        })}
        {questions.length === 0 && <li className="v2-qlist__empty">No questions yet.</li>}
      </ol>

      <div className="v2-qlist__actions">
        <div className="v2-qlist__add">
          <button type="button" className="v2-qlist__addbtn" onClick={() => onAdd('mcq')}>
            <LuPlus aria-hidden="true" /> Multiple choice
          </button>
          <button type="button" className="v2-qlist__addbtn" onClick={() => onAdd('written')}>
            <LuPlus aria-hidden="true" /> Written
          </button>
        </div>
        <button type="button" className="v2-qlist__tool v2-qlist__tool--ai" onClick={onOpenAi}>
          <LuSparkles aria-hidden="true" /> Generate with AI
        </button>
        <div className="v2-qlist__add">
          <button type="button" className="v2-qlist__tool" onClick={onOpenBank}>
            <LuLibrary aria-hidden="true" /> From bank
          </button>
          <button type="button" className="v2-qlist__tool" onClick={onOpenJson}>
            <LuFileJson aria-hidden="true" /> Import JSON
          </button>
        </div>
      </div>
    </nav>
  );
}
