import { useCallback, useMemo, useRef, useState } from 'react';
import { LuCircleAlert, LuCircleCheck, LuInfo, LuX } from 'react-icons/lu';
import { ToastContext } from './toastContext';

const ICONS = { success: LuCircleCheck, danger: LuCircleAlert, neutral: LuInfo };
const DURATION = 4000;

/** Small bottom-right toasts for confirmations ("Copied", "Exam duplicated", …). */
export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    ({ message, tone = 'success', action }) => {
      seq.current += 1;
      const id = seq.current;
      setToasts((t) => [...t.slice(-2), { id, message, tone, action }]);
      setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="v2-toasts" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.tone] || LuInfo;
          return (
            <div key={t.id} className={`v2-toast v2-toast--${t.tone}`}>
              <Icon className="v2-toast__icon" aria-hidden="true" />
              <span className="v2-toast__msg">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="v2-toast__action"
                  onClick={() => {
                    t.action.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" className="v2-toast__close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                <LuX />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
