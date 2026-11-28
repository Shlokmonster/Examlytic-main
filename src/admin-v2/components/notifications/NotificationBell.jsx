import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuBell, LuBellOff, LuCheckCheck, LuCircleCheck, LuClipboardCheck, LuClock, LuSettings, LuShieldAlert, LuWifiOff } from 'react-icons/lu';
import { useNotifications } from './notificationsContext';
import { NOTIFICATION_KINDS } from '../../data/notifications';
import { isToday, relativeTime } from '../../utils/time';
import { ADMIN_V2_BASE } from '../../layout/navItems';

const ICONS = { flag: LuShieldAlert, disconnect: LuWifiOff, starting: LuClock, submitted: LuCircleCheck, review: LuClipboardCheck };

/** Bell button + dropdown inbox. Drop it into any page header. */
export default function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('all');
  const ref = useRef(null);

  // Wiggle the bell when a new unread notification arrives.
  const [ring, setRing] = useState(0);
  const prevUnread = useRef(unread);
  useEffect(() => {
    if (unread > prevUnread.current) setRing((r) => r + 1);
    prevUnread.current = unread;
  }, [unread]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const list = tab === 'unread' ? items.filter((n) => !n.read) : items;
  const groups = [
    { label: 'Today', items: list.filter((n) => isToday(n.created_at)) },
    { label: 'Earlier', items: list.filter((n) => !isToday(n.created_at)) },
  ].filter((g) => g.items.length);

  const openItem = (n) => {
    markRead(n.id);
    setOpen(false);
    navigate(n.link);
  };

  return (
    <div className="v2-notif" ref={ref}>
      <button
        type="button"
        className="v2-icon-btn v2-notif__bell"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <LuBell key={ring} className={ring ? 'is-ringing' : ''} />
        {unread > 0 && <span className="v2-notif__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="v2-notif__panel" role="dialog" aria-label="Notifications">
          <div className="v2-notif__head">
            <span className="v2-notif__title">Notifications</span>
            <button type="button" className="v2-linkbtn" onClick={markAllRead} disabled={!unread}>
              <LuCheckCheck aria-hidden="true" /> Mark all as read
            </button>
          </div>

          <div className="v2-tabs v2-notif__tabs" role="tablist" aria-label="Filter notifications">
            {[
              { value: 'all', label: 'All' },
              { value: 'unread', label: 'Unread', count: unread },
            ].map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={tab === t.value}
                className={`v2-tab ${tab === t.value ? 'is-active' : ''}`}
                onClick={() => setTab(t.value)}
              >
                {t.label}
                {t.count > 0 && <span className="v2-tab__count">{t.count}</span>}
              </button>
            ))}
          </div>

          <div className="v2-notif__list">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="v2-notif__group">{g.label}</div>
                {g.items.map((n) => {
                  const Icon = ICONS[n.kind];
                  const tone = NOTIFICATION_KINDS[n.kind]?.tone || 'neutral';
                  return (
                    <button key={n.id} type="button" className={`v2-notif__item ${n.read ? '' : 'is-unread'}`} onClick={() => openItem(n)}>
                      <span className={`v2-notif__icon v2-notif__icon--${tone}`} aria-hidden="true">
                        <Icon />
                      </span>
                      <span className="v2-notif__body">
                        <span className="v2-notif__item-title">{n.title}</span>
                        <span className="v2-notif__item-text">{n.body}</span>
                        <span className="v2-notif__time">{relativeTime(n.created_at)}</span>
                      </span>
                      {!n.read && <span className="v2-notif__dot" aria-label="Unread" />}
                    </button>
                  );
                })}
              </div>
            ))}
            {groups.length === 0 && (
              <div className="v2-notif__empty">
                <LuBellOff aria-hidden="true" />
                <span>{tab === 'unread' ? "You're all caught up." : 'No notifications yet.'}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="v2-notif__foot"
            onClick={() => {
              setOpen(false);
              navigate(`${ADMIN_V2_BASE}/settings?section=alerts`);
            }}
          >
            <LuSettings aria-hidden="true" /> Notification settings
          </button>
        </div>
      )}
    </div>
  );
}
