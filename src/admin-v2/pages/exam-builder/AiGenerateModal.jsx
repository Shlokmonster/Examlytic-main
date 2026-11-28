import { useState } from 'react';
import { LuSparkles } from 'react-icons/lu';
import Modal from '../../components/Modal';
import { Button } from '../../components/ui';
import { generateQuestionsMock } from '../../data/examBuilder';

const MIXES = [
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'written', label: 'Written' },
  { value: 'mixed', label: 'Mixed' },
];

export default function AiGenerateModal({ open, onClose, onGenerated, hasQuestions, defaultTopic }) {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [mix, setMix] = useState('mcq');
  const [mode, setMode] = useState('append');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const effectiveTopic = topic || defaultTopic || '';

  const generate = async () => {
    if (!effectiveTopic.trim()) {
      setError('Describe a topic first, e.g. "Newton\'s laws of motion".');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const questions = await generateQuestionsMock({ topic: effectiveTopic, count, mix });
      onGenerated(questions, hasQuestions ? mode : 'append');
      setTopic('');
    } catch (e) {
      setError(e.message || 'Generation failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Generate questions with AI"
      description="Describe the topic and we'll draft questions you can edit before publishing."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={generate} disabled={busy}>
            <LuSparkles aria-hidden="true" /> {busy ? 'Generating…' : `Generate ${count} questions`}
          </Button>
        </>
      }
    >
      <label className="v2-field">
        <span className="v2-field__label">Topic</span>
        <textarea
          className="v2-input"
          rows={3}
          value={topic}
          placeholder={defaultTopic ? `e.g. ${defaultTopic}: Newton's laws, units and motion` : "e.g. Newton's laws of motion, Class 10 level"}
          onChange={(e) => setTopic(e.target.value)}
          disabled={busy}
        />
      </label>

      <div className="v2-field-row">
        <label className="v2-field">
          <span className="v2-field__label">Number of questions</span>
          <input
            className="v2-input"
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
            disabled={busy}
          />
        </label>
        <div className="v2-field">
          <span className="v2-field__label">Question type</span>
          <div className="v2-tabs" role="radiogroup" aria-label="Question type">
            {MIXES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mix === m.value}
                className={`v2-tab ${mix === m.value ? 'is-active' : ''}`}
                onClick={() => setMix(m.value)}
                disabled={busy}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

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
                disabled={busy}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {busy && (
        <div className="v2-ai-progress" role="status">
          <span className="v2-ai-progress__bar" />
          Drafting questions about “{effectiveTopic}”…
        </div>
      )}
      {error && (
        <p className="v2-field__error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
