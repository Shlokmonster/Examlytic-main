import { LuArrowDown, LuArrowUp, LuCheck, LuCopy, LuFileJson, LuLibrary, LuListChecks, LuPenLine, LuPlus, LuSparkles, LuTrash2 } from 'react-icons/lu';
import { IconButton } from '../../components/ui';
import { LETTERS, questionIssues } from '../../utils/questionFormat';

function EmptyState({ onAdd, onOpenAi, onOpenJson, onOpenBank }) {
  const options = [
    { icon: LuPlus, title: 'Add a question', text: 'Write multiple choice or written questions by hand.', onClick: () => onAdd('mcq') },
    { icon: LuSparkles, title: 'Generate with AI', text: 'Describe a topic and get a ready-made set of questions.', onClick: onOpenAi },
    { icon: LuLibrary, title: 'From Question Bank', text: 'Reuse questions you saved before.', onClick: onOpenBank },
    { icon: LuFileJson, title: 'Import JSON', text: 'Paste or upload questions you already have.', onClick: onOpenJson },
  ];
  return (
    <div className="v2-qedit-empty">
      <h2 className="h2">Start building your exam</h2>
      <p className="body-2 text-secondary">Choose how you want to add questions. You can mix them.</p>
      <div className="v2-qedit-empty__grid">
        {options.map((o) => {
          const Icon = o.icon;
          return (
            <button key={o.title} type="button" className="v2-qedit-empty__card" onClick={o.onClick}>
              <span className="v2-qedit-empty__icon">
                <Icon aria-hidden="true" />
              </span>
              <span className="v2-qedit-empty__title">{o.title}</span>
              <span className="v2-qedit-empty__text">{o.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function QuestionEditor({ question, index, total, onChange, onMove, onDuplicate, onDelete, showIssues, emptyProps, hideTools = false }) {
  if (!question) return <EmptyState {...emptyProps} />;

  const set = (patch) => onChange(question.id, patch);
  const issues = questionIssues(question);

  return (
    <div className="v2-qedit" key={question.id}>
      <div className="v2-qedit__head">
        {!hideTools && (
          <span className="v2-qedit__count">
            Question {index + 1} <span className="text-secondary">of {total}</span>
          </span>
        )}

        <div className="v2-tabs" role="radiogroup" aria-label="Question type">
          {[
            { value: 'mcq', label: 'Multiple choice', icon: LuListChecks },
            { value: 'written', label: 'Written', icon: LuPenLine },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={question.type === t.value}
                className={`v2-tab ${question.type === t.value ? 'is-active' : ''}`}
                onClick={() => set({ type: t.value })}
              >
                <Icon aria-hidden="true" /> {t.label}
              </button>
            );
          })}
        </div>

        {!hideTools && <div className="v2-qedit__tools">
          <IconButton label="Move up" variant="ghost" size="sm" onClick={() => onMove(question.id, -1)} disabled={index === 0}>
            <LuArrowUp />
          </IconButton>
          <IconButton label="Move down" variant="ghost" size="sm" onClick={() => onMove(question.id, 1)} disabled={index === total - 1}>
            <LuArrowDown />
          </IconButton>
          <IconButton label="Duplicate question" variant="ghost" size="sm" onClick={() => onDuplicate(question.id)}>
            <LuCopy />
          </IconButton>
          <IconButton label="Delete question" variant="ghost" size="sm" className="v2-qedit__delete" onClick={() => onDelete(question.id)}>
            <LuTrash2 />
          </IconButton>
        </div>}
      </div>

      <label className="v2-field">
        <span className="v2-field__label">Question</span>
        <textarea
          className="v2-input v2-qedit__question"
          rows={3}
          placeholder="Type the question students will see…"
          value={question.text}
          onChange={(e) => set({ text: e.target.value })}
        />
      </label>

      {question.type === 'mcq' ? (
        <fieldset className="v2-qedit__options">
          <legend className="v2-field__label">
            Options <span className="v2-field__hint">Click a letter to mark the correct answer</span>
          </legend>
          {question.options.map((opt, i) => {
            const correct = question.correct === i;
            return (
              <div key={LETTERS[i]} className={`v2-option ${correct ? 'is-correct' : ''}`}>
                <button
                  type="button"
                  className="v2-option__letter"
                  aria-pressed={correct}
                  aria-label={`Mark option ${LETTERS[i]} as correct`}
                  onClick={() => set({ correct: i })}
                >
                  {correct ? <LuCheck aria-hidden="true" /> : LETTERS[i]}
                </button>
                <input
                  className="v2-input v2-option__input"
                  placeholder={`Option ${LETTERS[i]}`}
                  value={opt}
                  onChange={(e) => {
                    const options = [...question.options];
                    options[i] = e.target.value;
                    set({ options });
                  }}
                  aria-label={`Option ${LETTERS[i]}`}
                />
                {correct && <span className="v2-option__tag">Correct</span>}
              </div>
            );
          })}
        </fieldset>
      ) : (
        <label className="v2-field">
          <span className="v2-field__label">
            Model answer <span className="v2-field__hint">Used as a guide when grading. Students never see it.</span>
          </span>
          <textarea
            className="v2-input"
            rows={5}
            placeholder="What a complete answer should include…"
            value={question.expected}
            onChange={(e) => set({ expected: e.target.value })}
          />
        </label>
      )}

      <label className="v2-field v2-field--inline">
        <span className="v2-field__label">Marks</span>
        <input
          className="v2-input v2-qedit__marks"
          type="number"
          min={1}
          max={100}
          value={question.marks}
          onChange={(e) => set({ marks: Math.max(0, Number(e.target.value) || 0) })}
        />
      </label>

      {showIssues && issues.length > 0 && (
        <ul className="v2-qedit__issues" role="alert">
          {issues.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
