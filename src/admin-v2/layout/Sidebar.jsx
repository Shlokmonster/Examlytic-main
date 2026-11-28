import { NavLink, useNavigate } from 'react-router-dom';
import { LuChevronDown, LuLogOut, LuSearch, LuX } from 'react-icons/lu';
import { useAuth } from '../../hooks/useAuth';
import Logo from '../components/Logo';
import { IconButton } from '../components/ui';
import { NAV_SECTIONS } from './navItems';
import { isMac, useCommandPalette } from '../components/command/commandContext';
import { usePendingReviewCount } from '../data/reviews';

/** Pending count next to "Review Queue". Hidden at zero. */
function ReviewCountBadge() {
  const count = usePendingReviewCount();
  if (!count) return null;
  return (
    <span className="v2-nav-item__badge" aria-label={`${count} pending`}>
      {count}
    </span>
  );
}

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export default function Sidebar({ open, onClose }) {
  const { user, profile, signOut } = useAuth();
  const { openPalette } = useCommandPalette();
  const navigate = useNavigate();

  const name = profile?.user_name || user?.user_metadata?.full_name || 'Admin';
  const email = profile?.email || user?.email || '';
  const avatar = profile?.user_avatar || user?.user_metadata?.avatar_url || null;

  const handleLogout = async () => {
    try {
      await signOut?.();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <aside className={`v2-sidebar ${open ? 'is-open' : ''}`} aria-label="Admin navigation">
      <div className="v2-sidebar__top">
        <Logo />
        <IconButton label="Close menu" variant="ghost" className="v2-sidebar__close" onClick={onClose}>
          <LuX />
        </IconButton>
      </div>

      <button
        type="button"
        className="v2-sidebar__search"
        onClick={() => {
          onClose();
          openPalette();
        }}
      >
        <LuSearch aria-hidden="true" />
        <span>Search…</span>
        <kbd className="v2-kbd">{isMac() ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <nav className="v2-sidebar__nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="v2-sidebar__section">
            <h2 className="v2-sidebar__heading">{section.title}</h2>
            <ul className="v2-sidebar__list">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) => `v2-nav-item ${isActive ? 'is-active' : ''}`}
                    >
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                      {item.badge === 'reviews' && <ReviewCountBadge />}
                    </NavLink>
                  </li>
                );
              })}
              {section.title === 'Setting & Others' && (
                <li>
                  <button type="button" className="v2-nav-item" onClick={handleLogout}>
                    <LuLogOut aria-hidden="true" />
                    <span>Log Out</span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        ))}
      </nav>

      <button type="button" className="v2-user-card">
        {avatar ? (
          <img className="v2-user-card__avatar" src={avatar} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="v2-user-card__avatar v2-user-card__avatar--initials">{initials(name)}</span>
        )}
        <span className="v2-user-card__text">
          <span className="v2-user-card__name">{name}</span>
          <span className="v2-user-card__email">{email}</span>
        </span>
        <LuChevronDown className="v2-user-card__chevron" aria-hidden="true" />
      </button>
    </aside>
  );
}
