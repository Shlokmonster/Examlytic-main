/** On/off switch built on a native checkbox (role="switch"). */
export default function Toggle({ checked, onChange, label, description, id, hideLabel = false }) {
  const inputId = id || `tg-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <label className={`v2-toggle ${hideLabel ? 'v2-toggle--bare' : ''}`} htmlFor={inputId}>
      <span className={hideLabel ? 'v2-sr-only' : 'v2-toggle__text'}>
        <span className="v2-toggle__label">{label}</span>
        {description && <span className="v2-toggle__desc">{description}</span>}
      </span>
      <input id={inputId} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="v2-toggle__track" aria-hidden="true">
        <span className="v2-toggle__thumb" />
      </span>
    </label>
  );
}
