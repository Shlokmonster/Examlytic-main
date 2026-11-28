import { useState } from 'react';
import { LuX } from 'react-icons/lu';
import Drawer from '../../components/Drawer';
import { Button, IconButton } from '../../components/ui';
import QuestionEditor from '../exam-builder/QuestionEditor';
import { DIFFICULTIES, SUBJECTS } from '../../data/questionBank';
import { questionIssues } from '../../utils/questionFormat';

function Form({ initial, isNew, onCancel, onSave }) {
  const [q, setQ] = useState(initial);
  const [showIssues, setShowIssues] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setShowIssues(true);
    if (questionIssues(q).length) return;
    setSaving(true);
    try {
      await onSave(q);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="v2-bank-editor">
      <header className="v2-focus__head">
        <span className="v2-focus__name">{isNew ? 'New question' : 'Edit question'}</span>
        <IconButton label="Close" variant="ghost" onClick={onCancel}>
          <LuX />
        </IconButton>
      </header>

      <div className="v2-focus__body">
        <div className="v2-field-row v2-bank-editor__meta">
          <label className="v2-field">
            <span className="v2-field__label">Subject</span>
            <select className="v2-input" value={q.subject} onChange={(e) => setQ({ ...q, subject: e.target.value })}>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="v2-field">
            <span className="v2-field__label">Difficulty</span>
            <div className="v2-tabs" role="radiogroup" aria-label="Difficulty">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  role="radio"
                  aria-checked={q.difficulty === d.value}
                  className={`v2-tab ${q.difficulty === d.value ? 'is-active' : ''}`}
                  onClick={() => setQ({ ...q, difficulty: d.value })}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <QuestionEditor
          question={q}
          index={0}
          total={1}
          hideTools
          showIssues={showIssues}
          onChange={(_id, patch) => setQ((prev) => ({ ...prev, ...patch }))}
        />
      </div>

      <footer className="v2-focus__foot v2-bank-editor__foot">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save question'}
        </Button>
      </footer>
    </div>
  );
}

/** Slide-over editor for one bank question (reuses the exam builder's QuestionEditor). */
export default function BankEditorDrawer({ question, isNew, onClose, onSave }) {
  return (
    <Drawer open={Boolean(question)} onClose={onClose} label={isNew ? 'New question' : 'Edit question'} width={720}>
      {question && <Form key={question.id} initial={question} isNew={isNew} onCancel={onClose} onSave={onSave} />}
    </Drawer>
  );
}
