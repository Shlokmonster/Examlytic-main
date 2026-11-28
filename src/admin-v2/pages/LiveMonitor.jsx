import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LuPause, LuPlay } from 'react-icons/lu';
import './live-monitor/LiveMonitor.css';
import PageHeader from '../components/PageHeader';
import Drawer from '../components/Drawer';
import { Button, SelectPill } from '../components/ui';
import { useNow } from '../components/useNow';
import { useData } from '../data/useData';
import { listAlerts, listLiveExams, listSessions, subscribeMockAlerts } from '../data/liveMonitor';
import LiveStats from './live-monitor/LiveStats';
import StudentWall from './live-monitor/StudentWall';
import AlertsRail from './live-monitor/AlertsRail';
import FocusPanel from './live-monitor/FocusPanel';
import { connectionOf, secondsLeft } from './live-monitor/helpers';
import NotificationBell from '../components/notifications/NotificationBell';

const TAB_TESTS = {
  all: () => true,
  flagged: (s) => s.flags_count > 0 && s.status !== 'completed',
  reconnecting: (s) => connectionOf(s) === 'reconnecting',
  submitted: (s) => s.status === 'completed',
};

const isFlagged = (s) => TAB_TESTS.flagged(s);

function LiveMonitorPage() {
  const now = useNow(1000);
  const exams = useData(listLiveExams);

  // "Monitor live" from the Exams page links here with ?exam=<id>
  // The URL is the single source of truth, so notification links work even when already on this page.
  const [searchParams, setSearchParams] = useSearchParams();
  const examId = searchParams.get('exam');
  const defaultExamId = useMemo(
    () => [...(exams.data || [])].sort((a, b) => b.students - a.students)[0]?.id ?? null,
    [exams.data],
  );
  const activeExamId = exams.data?.some((e) => e.id === examId) ? examId : defaultExamId;
  const exam = exams.data?.find((e) => e.id === activeExamId);

  const sessionsQ = useData(listSessions, activeExamId);
  const alertsQ = useData(listAlerts, activeExamId);

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState('flags');
  const [cols, setCols] = useState(3);
  const [page, setPage] = useState(1);
  const [focusId, setFocusId] = useState(null);

  // Live (simulated realtime) state layered on top of the loaded data.
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [queued, setQueued] = useState([]);
  const [extraFlags, setExtraFlags] = useState({});
  const [pulses, setPulses] = useState({});
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!sessionsQ.data) return undefined;
    return subscribeMockAlerts(sessionsQ.data, (alert) => {
      setExtraFlags((f) => ({ ...f, [alert.attempt_id]: (f[alert.attempt_id] || 0) + 1 }));
      if (pausedRef.current) {
        setQueued((q) => [alert, ...q]);
      } else {
        setLiveAlerts((l) => [alert, ...l]);
        setPulses((p) => ({ ...p, [alert.attempt_id]: (p[alert.attempt_id] || 0) + 1 }));
      }
    });
  }, [sessionsQ.data]);

  const releaseQueued = () => {
    setLiveAlerts((l) => [...queued, ...l]);
    setQueued([]);
  };

  const togglePause = () => {
    if (paused) releaseQueued();
    setPaused((p) => !p);
  };

  const changeExam = (id) => {
    setSearchParams({ exam: id }, { replace: true });
    setLiveAlerts([]);
    setQueued([]);
    setExtraFlags({});
    setPulses({});
    setFocusId(null);
    setPage(1);
  };

  const sessions = useMemo(
    () => (sessionsQ.data || []).map((s) => ({ ...s, flags_count: s.flags_count + (extraFlags[s.id] || 0) })),
    [sessionsQ.data, extraFlags],
  );
  const alerts = useMemo(() => [...liveAlerts, ...(alertsQ.data || [])], [liveAlerts, alertsQ.data]);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? sessions.filter((s) => s.user_name.toLowerCase().includes(q) || s.roll_no.includes(q)) : sessions;
  }, [sessions, search]);

  const counts = useMemo(
    () => Object.fromEntries(Object.entries(TAB_TESTS).map(([k, test]) => [k, searched.filter(test).length])),
    [searched],
  );

  const wall = useMemo(() => {
    const list = searched.filter(TAB_TESTS[tab]);
    const left = (s) => secondsLeft(s, exam, Date.now());
    return list.sort((a, b) => {
      if (sort === 'name') return a.user_name.localeCompare(b.user_name);
      if (sort === 'time') return left(a) - left(b);
      return b.flags_count - a.flags_count || a.user_name.localeCompare(b.user_name);
    });
  }, [searched, tab, sort, exam]);

  // Focus panel navigation follows the wall's current order.
  const focusSession = sessions.find((s) => s.id === focusId) || null;
  const focusIndex = wall.findIndex((s) => s.id === focusId);
  const nextFlagged = useMemo(() => {
    if (!wall.length) return null;
    for (let step = 1; step <= wall.length; step += 1) {
      const s = wall[(Math.max(focusIndex, -1) + step) % wall.length];
      if (s.id !== focusId && isFlagged(s)) return s;
    }
    return null;
  }, [wall, focusIndex, focusId]);

  const goPrev = () => {
    if (!wall.length) return;
    const i = focusIndex <= 0 ? wall.length - 1 : focusIndex - 1;
    setFocusId(wall[i].id);
  };

  const resetPage = (setter) => (v) => {
    setter(v);
    setPage(1);
  };

  return (
    <div className="v2-live-page">
      <PageHeader title="Live Monitor" search={search} onSearch={resetPage(setSearch)} searchPlaceholder="Search student or roll no...">
        {exams.data && activeExamId && (
          <SelectPill
            label="Live exam"
            value={activeExamId}
            options={exams.data.map((e) => ({ value: e.id, label: `${e.title} · ${e.class_name}` }))}
            onChange={changeExam}
          />
        )}
        <NotificationBell />
        <Button variant="outline" onClick={togglePause} aria-pressed={paused}>
          {paused ? <LuPlay aria-hidden="true" /> : <LuPause aria-hidden="true" />}
          {paused ? 'Resume alerts' : 'Pause alerts'}
        </Button>
      </PageHeader>

      <LiveStats exam={exam} sessions={sessionsQ.data ? sessions : null} now={now} />

      <div className="v2-live-page__grid">
        <StudentWall
          exam={exam}
          sessions={wall}
          counts={counts}
          tab={tab}
          onTab={resetPage(setTab)}
          sort={sort}
          onSort={setSort}
          cols={cols}
          onCols={setCols}
          page={page}
          onPage={setPage}
          now={now}
          pulses={pulses}
          onOpen={setFocusId}
          loading={sessionsQ.loading}
        />
        <AlertsRail
          alerts={alerts}
          queued={queued.length}
          paused={paused}
          onShowQueued={releaseQueued}
          onOpen={setFocusId}
        />
      </div>

      <Drawer open={Boolean(focusSession)} onClose={() => setFocusId(null)} label="Student details">
        <FocusPanel
          key={focusId}
          session={focusSession}
          alerts={alerts}
          secondsLeft={focusSession ? secondsLeft(focusSession, exam, now) : 0}
          onClose={() => setFocusId(null)}
          onPrev={goPrev}
          onNextFlagged={() => nextFlagged && setFocusId(nextFlagged.id)}
          hasNextFlagged={Boolean(nextFlagged)}
        />
      </Drawer>
    </div>
  );
}

/** Remount per exam so live alerts / flag counts never leak between exams. */
export default function LiveMonitor() {
  const [searchParams] = useSearchParams();
  const exam = searchParams.get('exam') || 'default';
  return <LiveMonitorPage key={exam} />;
}
