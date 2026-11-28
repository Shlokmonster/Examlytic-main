import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuArrowRight, LuBell, LuDownload, LuFileText, LuPlus, LuSearch, LuTv, LuUserRound } from 'react-icons/lu';
import { CommandContext, isMac } from './commandContext';
import { ADMIN_V2_BASE, NAV_SECTIONS } from '../../layout/navItems';
import { listExams } from '../../data/exams';
import { listStudents } from '../../data/students';
import { downloadCsv, STUDENT_CSV_COLUMNS } from '../../utils/csv';
import { STATUS_META, examStatus } from '../../utils/examStatus';
import Avatar from '../Avatar';

const LIMIT = { Pages: 6, Actions: 5, Exams: 6, Students: 6 };

/** Every word of the query must appear; items starting with the query rank first. */
function score(text, q) {
  const t = text.toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  if (!words.every((w) => t.includes(w))) return -1;
  return t.startsWith(q) ? 2 : t.split(/\s+/).some((w) => w.startsWith(words[0])) ? 1 : 0;
}

function Palette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [data, setData] = useState({ exams: [], students: [] });
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    let alive = true;
    Promise.all([listExams(), listStudents()]).then(([exams, students]) => alive && setData({ exams, students }));
    return () => {
      alive = false;
    };
  }, [open]);

  const go = useCallback(
    (to) => {
      onClose();
      navigate(to);
    },
    [navigate, onClose],
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages = NAV_SECTIONS.flatMap((s) => s.items).map((item) => ({
      id: `page-${item.to}`,
      icon: item.icon,
      label: item.label,
      hint: 'Page',
      run: () => go(item.to),
    }));
    const actions = [
      { id: 'act-new-exam', icon: LuPlus, label: 'Create a new exam', hint: 'Action', run: () => go(`${ADMIN_V2_BASE}/exams/new`) },
      { id: 'act-live', icon: LuTv, label: 'Open Live Monitor', hint: 'Action', run: () => go(`${ADMIN_V2_BASE}/live-monitor`) },
      {
        id: 'act-export',
        icon: LuDownload,
        label: 'Export students (CSV)',
        hint: 'Action',
        run: () => {
          onClose();
          downloadCsv('students.csv', STUDENT_CSV_COLUMNS, data.students);
        },
      },
      { id: 'act-notif', icon: LuBell, label: 'Notification settings', hint: 'Action', run: () => go(`${ADMIN_V2_BASE}/settings?section=alerts`) },
    ];
    const exams = data.exams.map((e) => ({
      id: `exam-${e.id}`,
      icon: LuFileText,
      label: e.title,
      sub: `${e.className}${e.code ? ` · ${e.code}` : ''}`,
      hint: STATUS_META[examStatus(e)].label,
      search: `${e.title} ${e.className} ${e.code || ''} ${e.subject}`,
      run: () => go(`${ADMIN_V2_BASE}/exams/${e.id}/edit`),
    }));
    const students = data.students.map((s) => ({
      id: `stu-${s.id}`,
      avatar: s,
      icon: LuUserRound,
      label: s.user_name,
      sub: `${s.class_name} · Roll ${s.roll_no}`,
      hint: 'Student',
      search: `${s.user_name} ${s.email} ${s.roll_no} ${s.class_name}`,
      run: () => go(`${ADMIN_V2_BASE}/students/${s.id}`),
    }));

    const filter = (title, list) => {
      const scored = q
        ? list
            .map((item) => ({ item, s: score(item.search || item.label, q) }))
            .filter((x) => x.s >= 0)
            .sort((a, b) => b.s - a.s)
            .map((x) => x.item)
        : list;
      return { title, items: scored.slice(0, LIMIT[title]) };
    };

    // Empty query: show navigation + actions only (exams/students appear when typing).
    const all = q
      ? [filter('Pages', pages), filter('Actions', actions), filter('Exams', exams), filter('Students', students)]
      : [filter('Actions', actions), filter('Pages', pages)];
    return all.filter((g) => g.items.length);
  }, [query, data, go, onClose]);

  const flat = groups.flatMap((g) => g.items);
  const current = Math.min(active, Math.max(0, flat.length - 1));

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [current, query]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((current + 1) % Math.max(1, flat.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((current - 1 + flat.length) % Math.max(1, flat.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flat[current]?.run();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  let index = -1;

  return (
    <div className={`v2-cmdk ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="v2-cmdk__scrim" onClick={onClose} />
      <div className="v2-cmdk__panel" role="dialog" aria-modal="true" aria-label="Search">
        <div className="v2-cmdk__search">
          <LuSearch aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search exams, students, pages…"
            aria-label="Search"
            aria-controls="v2-cmdk-list"
            aria-activedescendant={flat[current] ? `cmdk-${flat[current].id}` : undefined}
            role="combobox"
            aria-expanded="true"
          />
          <kbd className="v2-kbd">Esc</kbd>
        </div>

        <div className="v2-cmdk__list" id="v2-cmdk-list" role="listbox" ref={listRef}>
          {groups.map((g) => (
            <div key={g.title} className="v2-cmdk__group" role="group" aria-label={g.title}>
              <div className="v2-cmdk__group-title">{g.title}</div>
              {g.items.map((item) => {
                index += 1;
                const i = index;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    id={`cmdk-${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={i === current}
                    data-active={i === current}
                    className={`v2-cmdk__item ${i === current ? 'is-active' : ''}`}
                    onMouseMove={() => i !== current && setActive(i)}
                    onClick={() => item.run()}
                  >
                    {item.avatar ? (
                      <Avatar name={item.avatar.user_name} src={item.avatar.user_avatar} size={28} />
                    ) : (
                      <span className="v2-cmdk__icon">
                        <Icon aria-hidden="true" />
                      </span>
                    )}
                    <span className="v2-cmdk__text">
                      <span className="v2-cmdk__label">{item.label}</span>
                      {item.sub && <span className="v2-cmdk__sub">{item.sub}</span>}
                    </span>
                    <span className="v2-cmdk__hint">{item.hint}</span>
                    <LuArrowRight className="v2-cmdk__enter" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ))}
          {flat.length === 0 && <div className="v2-cmdk__empty">No results for “{query}”.</div>}
        </div>

        <div className="v2-cmdk__foot">
          <span>
            <kbd className="v2-kbd">↑</kbd>
            <kbd className="v2-kbd">↓</kbd> to navigate
          </span>
          <span>
            <kbd className="v2-kbd">↵</kbd> to open
          </span>
          <span className="v2-cmdk__foot-right">
            <kbd className="v2-kbd">{isMac() ? '⌘' : 'Ctrl'}</kbd>
            <kbd className="v2-kbd">K</kbd> anywhere
          </span>
        </div>
      </div>
    </div>
  );
}

/** Global ⌘K / Ctrl+K search. Wrap the admin layout with it. */
export default function CommandPaletteProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0); // remount the palette per open (fresh query)

  const openPalette = useCallback(() => {
    setSession((s) => s + 1);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => {
          if (!o) setSession((s) => s + 1);
          return !o;
        });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(() => ({ openPalette }), [openPalette]);

  return (
    <CommandContext.Provider value={value}>
      {children}
      <Palette key={session} open={open} onClose={close} />
    </CommandContext.Provider>
  );
}
