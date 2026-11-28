import { useEffect, useRef } from 'react';
import { LuX } from 'react-icons/lu';
import './components.css';

/**
 * Centered dialog with a scrim. Closes on Escape / scrim click.
 * Always mounted so it can animate with opacity + transform only.
 */
export default function Modal({ open, onClose, title, description, width = 560, footer, children }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open]);

  return (
    <div className={`v2-modal ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="v2-modal__scrim" onClick={onClose} />
      <div
        ref={panelRef}
        className="v2-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      >
        <header className="v2-modal__head">
          <div>
            <h2 className="v2-modal__title">{title}</h2>
            {description && <p className="v2-modal__desc">{description}</p>}
          </div>
          <button type="button" className="v2-icon-btn v2-icon-btn--ghost v2-icon-btn--sm" aria-label="Close" onClick={onClose}>
            <LuX />
          </button>
        </header>
        <div className="v2-modal__body">{children}</div>
        {footer && <footer className="v2-modal__foot">{footer}</footer>}
      </div>
    </div>
  );
}
