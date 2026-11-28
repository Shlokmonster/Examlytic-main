import { useEffect, useRef } from 'react';
import './components.css';

/**
 * Slide-over panel from the right with a scrim.
 * Closes on Escape or scrim click; moves focus in on open and back on close.
 * Always mounted so open/close animate with transform only.
 */
export default function Drawer({ open, onClose, label, width = 720, children }) {
  const panelRef = useRef(null);
  const returnFocus = useRef(null);
  // Keep the latest onClose without re-running the open effect on every parent render.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    returnFocus.current = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      returnFocus.current?.focus?.();
    };
  }, [open]);

  return (
    <div className={`v2-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="v2-drawer__scrim" onClick={onClose} />
      <aside
        ref={panelRef}
        className="v2-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={{ width: `min(${width}px, 100vw)` }}
      >
        {children}
      </aside>
    </div>
  );
}
