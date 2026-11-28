import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuCircleCheckBig, LuSearchX } from 'react-icons/lu';
import './student-profile/StudentProfile.css';
import './live-monitor/LiveMonitor.css';
import './review-queue/ReviewQueue.css';
import PageHeader from '../components/PageHeader';
import NotificationBell from '../components/notifications/NotificationBell';
import Avatar from '../components/Avatar';
import { Card, Skeleton } from '../components/ui';
import { useToast } from '../components/toast/toastContext';
import { PRIORITY, sortCases, useReviewCases } from '../data/reviews';
import { getReview, setReview } from '../data/reviewStore';
import { relativeTime } from '../utils/time';
import { REVIEW_LABEL, REVIEW_OPTIONS } from './student-profile/summary';
import CaseDetail from './review-queue/CaseDetail';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'clean', label: 'Clean' },
  { value: 'suspicious', label: 'Suspicious' },
  { value: 'cheating', label: 'Cheating' },
];

const TOAST_TONE = { clean: 'success', suspicious: 'neutral', cheating: 'danger' };

const inTab = (c, tab) => (tab === 'pending' ? !c.review : c.review?.status === tab);

const isTypingTarget = (el) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.closest('.v2-player'));

export default function ReviewQueue() {
  const { cases, loading } = useReviewCases();
  const toast = useToast();
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.value, cases.filter((c) => inTab(c, t.value)).length])), [cases]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortCases(
      cases.filter(
        (c) =>
          inTab(c, tab) &&
          (!q || c.student.user_name.toLowerCase().includes(q) || c.attempt.exam_title.toLowerCase().includes(q) || c.student.roll_no.includes(q)),
      ),
    );
  }, [cases, tab, search]);

  const selected = list.find((c) => c.id === selectedId) || list[0] || null;
  const index = selected ? list.indexOf(selected) : -1;

  const move = useCallback(
    (step) => {
      if (!list.length) return;
      const next = list[Math.min(list.length - 1, Math.max(0, index + step))];
      setSelectedId(next.id);
      document.getElementById(`v2-case-${next.id}`)?.scrollIntoView({ block: 'nearest' });
    },
    [list, index],
  );

  const decide = useCallback(
    (c, status, note) => {
      const previous = getReview(c.id);
      // Leaving the current tab: keep the reviewer moving to the next case.
      if (!inTab({ review: { status } }, tab)) {
        const next = list[index + 1] || list[index - 1] || null;
        setSelectedId(next?.id ?? null);
      }
      setReview(c.id, { status, note });
      toast({
        message: `${c.student.user_name} marked ${REVIEW_LABEL[status].toLowerCase()}`,
        tone: TOAST_TONE[status],
        action: {
          label: 'Undo',
          onClick: () => {
            setReview(c.id, previous || { status: 'none' });
            setSelectedId(c.id);
          },
        },
      });
    },
    [tab, list, index, toast],
  );

  const reopen = useCallback(
    (c) => {
      const previous = getReview(c.id);
      const next = list[index + 1] || list[index - 1] || null;
      setSelectedId(next?.id ?? null);
      setReview(c.id, { status: 'none' });
      toast({
        message: `${c.student.user_name} moved back to Pending`,
        tone: 'neutral',
        action: { label: 'Undo', onClick: () => setReview(c.id, previous) },
      });
    },
    [list, index, toast],
  );

  // J / K to move, 1 / 2 / 3 to decide. Ignored while typing or inside the player.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector('.v2-cmdk.is-open, .v2-modal.is-open')) return;
      const key = e.key.toLowerCase();
      if (key === 'j') {
        e.preventDefault();
        move(1);
      } else if (key === 'k') {
        e.preventDefault();
        move(-1);
      } else if (selected && ['1', '2', '3'].includes(key)) {
        const option = REVIEW_OPTIONS[Number(key) - 1];
        if (selected.review?.status === option.value) return;
        e.preventDefault();
        const draft = document.getElementById('v2-case-note')?.value ?? '';
        decide(selected, option.value, draft.trim());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, decide, selected]);

  return (
    <div className="v2-reviews-page">
      <PageHeader title="Review Queue" search={search} onSearch={setSearch} searchPlaceholder="Search student, exam or roll no...">
        <NotificationBell />
      </PageHeader>

      <Card className="v2-reviews">
        <div className="v2-reviews__bar">
          <div className="v2-tabs" role="tablist" aria-label="Review status">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={tab === t.value}
                className={`v2-tab ${tab === t.value ? 'is-active' : ''}`}
                onClick={() => {
                  setTab(t.value);
                  setSelectedId(null);
                }}
              >
                {t.label}
                <span className="v2-tab__count">{loading ? '–' : counts[t.value]}</span>
              </button>
            ))}
          </div>
          <p className="v2-reviews__keys" aria-hidden="true">
            <kbd className="v2-kbd">J</kbd>
            <kbd className="v2-kbd">K</kbd> move
            <span className="v2-reviews__keys-sep" />
            <kbd className="v2-kbd">1</kbd>
            <kbd className="v2-kbd">2</kbd>
            <kbd className="v2-kbd">3</kbd> decide
          </p>
        </div>

        <div className="v2-reviews__split">
          <ul className="v2-reviews__list" aria-label="Cases">
            {loading &&
              [0, 1, 2, 3, 4].map((i) => (
                <li key={i} className="v2-case-item v2-case-item--skeleton">
                  <Skeleton height={56} />
                </li>
              ))}

            {!loading &&
              list.map((c) => {
                const p = PRIORITY[c.priority];
                const active = selected?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      id={`v2-case-${c.id}`}
                      type="button"
                      className={`v2-case-item ${active ? 'is-active' : ''}`}
                      aria-current={active ? 'true' : undefined}
                      onClick={() => setSelectedId(c.id)}
                    >
                      <Avatar name={c.student.user_name} src={c.student.user_avatar} size={36} />
                      <span className="v2-case-item__text">
                        <span className="v2-case-item__row">
                          <span className="v2-case-item__name">{c.student.user_name}</span>
                          <span className="v2-case-item__time">{relativeTime(c.review?.at || c.flagged_at)}</span>
                        </span>
                        <span className="v2-case-item__exam">{c.attempt.exam_title}</span>
                        <span className="v2-case-item__row">
                          <span className="v2-case-item__flags">
                            {c.attempt.events.length} flags · {c.student.class_name}
                          </span>
                          {c.review ? (
                            <span className={`v2-pill v2-pill--${REVIEW_OPTIONS.find((o) => o.value === c.review.status).tone}`}>
                              {REVIEW_LABEL[c.review.status]}
                            </span>
                          ) : (
                            <span className={`v2-pill v2-pill--${p.tone}`}>{p.label}</span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}

            {!loading && list.length === 0 && (
              <li className="v2-reviews__empty">
                {search ? <LuSearchX aria-hidden="true" /> : <LuCircleCheckBig aria-hidden="true" />}
                <strong>{search ? 'No matching cases' : tab === 'pending' ? 'All caught up' : `No ${TABS.find((t) => t.value === tab).label.toLowerCase()} cases yet`}</strong>
                <span>{search ? 'Try another name or exam.' : tab === 'pending' ? 'Every flagged attempt has a decision.' : 'Decisions you make show up here.'}</span>
              </li>
            )}
          </ul>

          <div className="v2-reviews__detail">
            {loading && <Skeleton height="100%" style={{ minHeight: 420, borderRadius: 12 }} />}
            {!loading && selected && (
              <CaseDetail key={selected.id} item={selected} onDecide={decide} onReopen={reopen} position={`${index + 1} of ${list.length}`} />
            )}
            {!loading && !selected && (
              <div className="v2-reviews__placeholder">
                <LuCircleCheckBig aria-hidden="true" />
                <p>Nothing to review here.</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
