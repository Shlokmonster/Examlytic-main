import { useRef, useState } from 'react';
import { LuFileJson, LuUpload } from 'react-icons/lu';
import Modal from '../../components/Modal';
import { Button } from '../../components/ui';
import { SAMPLE_JSON, parseImportedJson } from '../../utils/questionFormat';

export default function JsonImportModal({ open, onClose, onImported, hasQuestions }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('append');
  const fileRef = useRef(null);

  const preview = text.trim() ? parseImportedJson(text) : null;

  const doImport = () => {
    const result = parseImportedJson(text);
    if (result.error) {
      setError(result.error);
      return;
    }
    onImported(result.questions, hasQuestions ? mode : 'append');
    setText('');
    setError('');
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setText(await file.text());
    setError('');
    e.target.value = '';
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={640}
      title="Import questions from JSON"
      description='Paste an array of questions. Same format as the old importer: "mcq" with optionA–D + correct_answer, or "answerable" with correct_answer.'
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={doImport} disabled={!preview?.questions}>
            <LuFileJson aria-hidden="true" /> {preview?.questions ? `Import ${preview.questions.length} questions` : 'Import'}
          </Button>
        </>
      }
    >
      <div className="v2-json__tools">
        <button type="button" className="v2-linkbtn" onClick={() => setText(SAMPLE_JSON)}>
          Load sample
        </button>
        <button type="button" className="v2-linkbtn" onClick={() => fileRef.current?.click()}>
          <LuUpload aria-hidden="true" /> Upload .json file
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      </div>

      <textarea
        className="v2-input v2-json__input"
        rows={12}
        spellCheck={false}
        value={text}
        placeholder="[ { &quot;question&quot;: &quot;…&quot;, &quot;type&quot;: &quot;mcq&quot;, … } ]"
        onChange={(e) => {
          setText(e.target.value);
          setError('');
        }}
        aria-label="Questions JSON"
      />

      {preview?.questions && !error && <p className="v2-json__ok">Looks good: {preview.questions.length} questions ready to import.</p>}
      {(error || preview?.error) && (
        <p className="v2-field__error" role="alert">
          {error || preview.error}
        </p>
      )}

      {hasQuestions && (
        <div className="v2-field">
          <span className="v2-field__label">Existing questions</span>
          <div className="v2-tabs" role="radiogroup" aria-label="What to do with existing questions">
            {[
              { value: 'append', label: 'Add to the end' },
              { value: 'replace', label: 'Replace all' },
            ].map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mode === m.value}
                className={`v2-tab ${mode === m.value ? 'is-active' : ''}`}
                onClick={() => setMode(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
