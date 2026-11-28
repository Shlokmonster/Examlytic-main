import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuEllipsis } from 'react-icons/lu';

const MENU_W = 210;
const ITEM_H = 36;

/**
 * "⋯" actions menu. Rendered in a portal (inside the .admin-v2 shell so styles
 * still apply) with fixed positioning, so it is never clipped by scrolling
 * tables or carousels. Closes on outside click, Escape, scroll or resize.
 * items: [{ label, icon, onSelect, tone?: 'danger' }]
 */
export default function RowMenu({ label = 'Actions', items }) {
  const [pos, setPos] = useState(null); // null = closed
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const open = Boolean(pos);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setPos(null);
    const onDown = (e) => {
      if (!btnRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        close();
        btnRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    menuRef.current?.querySelector('button')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setPos(null);
      return;
    }
    const r = btnRef.current.getBoundingClientRect();
    const height = items.length * ITEM_H + 10;
    const up = r.bottom + height + 8 > window.innerHeight;
    setPos({
      top: up ? Math.max(8, r.top - height - 4) : r.bottom + 4,
      left: Math.min(Math.max(8, r.right - MENU_W), window.innerWidth - MENU_W - 8),
      up,
    });
  };

  const host = typeof document !== 'undefined' ? document.querySelector('.admin-v2') : null;

  return (
    <div className="v2-rowmenu" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        className="v2-icon-btn v2-icon-btn--ghost v2-icon-btn--sm"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <LuEllipsis />
      </button>
      {open &&
        host &&
        createPortal(
          <div
            ref={menuRef}
            className={`v2-rowmenu__list is-open is-floating ${pos.up ? 'is-up' : ''}`}
            role="menu"
            style={{ top: pos.top, left: pos.left, width: MENU_W }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={`v2-rowmenu__item ${item.tone === 'danger' ? 'is-danger' : ''}`}
                  onClick={() => {
                    setPos(null);
                    item.onSelect?.();
                  }}
                >
                  {Icon && <Icon aria-hidden="true" />}
                  {item.label}
                </button>
              );
            })}
          </div>,
          host,
        )}
    </div>
  );
}
