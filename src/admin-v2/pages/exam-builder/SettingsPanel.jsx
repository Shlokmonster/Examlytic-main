import { useState } from 'react';
import { LuCheck, LuCopy } from 'react-icons/lu';
import Toggle from '../../components/Toggle';

const CLASSES = ['Class-08', 'Class-09', 'Class-10', 'Class-11', 'Class-12'];

function Section({ title, children }) {
  return (
    <section className="v2-settings__section">
      <h2 className="v2-settings__title">{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPanel({ exam, onChange, showIssues }) {
  const [copied, setCopied] = useState(false);
  const set = (patch) => onChange(patch);
  const titleMissing = showIssues && !exam.title.trim();
  const windowInvalid =
    showIssues && exam.schedule.mode === 'window' && (!exam.schedule.start_at || !exam.schedule.end_at || exam.schedule.end_at <= exam.schedule.start_at);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(exam.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard can be blocked; the code is still visible */
    }
  };

  return (
    <aside className="v2-settings" aria-label="Exam settings">
      <Section title="Details">
        <label className={`v2-field ${titleMissing ? 'has-error' : ''}`}>
          <span className="v2-field__label">
            Title <span className="v2-field__req">*</span>
          </span>
          <input className="v2-input" value={exam.title} placeholder="e.g. Physics Final" onChange={(e) => set({ title: e.target.value })} />
          {titleMissing && <span className="v2-field__error">A title is required to publish.</span>}
        </label>

        <div className="v2-field-row">
          <label className="v2-field">
            <span className="v2-field__label">Subject</span>
            <input className="v2-input" value={exam.subject} placeholder="Physics" onChange={(e) => set({ subject: e.target.value })} />
          </label>
          <label className="v2-field">
            <span className="v2-field__label">Class</span>
            <select className="v2-input" value={exam.class_name} onChange={(e) => set({ class_name: e.target.value })}>
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="v2-field">
          <span className="v2-field__label">Duration</span>
          <span className="v2-input-suffix">
            <input
              className="v2-input"
              type="number"
              min={5}
              max={600}
              value={exam.duration_minutes}
              onChange={(e) => set({ duration_minutes: Math.max(0, Number(e.target.value) || 0) })}
            />
            <span>minutes</span>
          </span>
        </label>

        <label className="v2-field">
          <span className="v2-field__label">Instructions</span>
          <textarea
            className="v2-input"
            rows={4}
            value={exam.instructions}
            placeholder="Shown to students before they start…"
            onChange={(e) => set({ instructions: e.target.value })}
          />
        </label>

        <label className="v2-field">
          <span className="v2-field__label">
            Support email <span className="v2-field__hint">Students can contact this address for help.</span>
          </span>
          <input
            className="v2-input"
            type="email"
            value={exam.support_email}
            placeholder="exams@school.edu"
            onChange={(e) => set({ support_email: e.target.value })}
          />
        </label>
      </Section>

      <Section title="Proctoring">
        <Toggle
          label="AI webcam proctoring"
          description="Flags no face, multiple faces, looking away, and phones or books."
          checked={exam.settings.webcam_proctoring}
          onChange={(v) => set({ settings: { ...exam.settings, webcam_proctoring: v } })}
        />
        <Toggle
          label="Strict tab mode"
          description="Records tab switches and leaving fullscreen as violations."
          checked={exam.settings.strict_tabs}
          onChange={(v) => set({ settings: { ...exam.settings, strict_tabs: v } })}
        />
      </Section>

      <Section title="Schedule">
        <div className="v2-tabs v2-settings__mode" role="radiogroup" aria-label="Availability">
          {[
            { value: 'anytime', label: 'Open anytime' },
            { value: 'window', label: 'Time window' },
          ].map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={exam.schedule.mode === m.value}
              className={`v2-tab ${exam.schedule.mode === m.value ? 'is-active' : ''}`}
              onClick={() => set({ schedule: { ...exam.schedule, mode: m.value } })}
            >
              {m.label}
            </button>
          ))}
        </div>
        {exam.schedule.mode === 'window' ? (
          <div className={`v2-settings__window ${windowInvalid ? 'has-error' : ''}`}>
            <label className="v2-field">
              <span className="v2-field__label">Opens</span>
              <input
                className="v2-input"
                type="datetime-local"
                value={exam.schedule.start_at}
                onChange={(e) => set({ schedule: { ...exam.schedule, start_at: e.target.value } })}
              />
            </label>
            <label className="v2-field">
              <span className="v2-field__label">Closes</span>
              <input
                className="v2-input"
                type="datetime-local"
                value={exam.schedule.end_at}
                onChange={(e) => set({ schedule: { ...exam.schedule, end_at: e.target.value } })}
              />
            </label>
            {windowInvalid && <span className="v2-field__error">Pick an opening time and a later closing time.</span>}
          </div>
        ) : (
          <p className="v2-settings__note">Students can start whenever the exam is published and unlocked.</p>
        )}
      </Section>

      <Section title="Exam code">
        {exam.code ? (
          <div className="v2-code">
            <span className="v2-code__value">{exam.code}</span>
            <button type="button" className="v2-code__copy" onClick={copyCode} aria-label="Copy exam code">
              {copied ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        ) : (
          <p className="v2-settings__note">A short join code (like PHY-7K2Q) is created when you first save.</p>
        )}
      </Section>
    </aside>
  );
}
