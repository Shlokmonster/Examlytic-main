/**
 * Admin v2 Live Monitor data layer (mock for now).
 *
 * Field names follow the real tables:
 *  - exam_attempts: status, stream_status, started_at, last_heartbeat_at
 *  - exam_flags.flag_type / exam_logs.event_type for alert keys
 * Backend phase: sessions from exam_attempts (+ users), live alerts from
 * useRealtimeExamActivity filtered by examId, video from LiveKit (rapid-task).
 */

import { ALERT_TYPES } from '../utils/alerts';

export { ALERT_TYPES };

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const MIN = 60 * 1000;
const NOW = Date.now();

const EXAMS = [
  { id: 'live-physics', title: 'Physics Final', class_name: 'Class-10', started_at: new Date(NOW - 48 * MIN).toISOString(), duration_minutes: 120 },
  { id: 'live-chem', title: 'Chemistry Unit Test', class_name: 'Class-09', started_at: new Date(NOW - 20 * MIN).toISOString(), duration_minutes: 90 },
  { id: 'live-math', title: 'Math Midterm', class_name: 'Class-08', started_at: new Date(NOW - 95 * MIN).toISOString(), duration_minutes: 120 },
];

const ALERT_KEYS = Object.keys(ALERT_TYPES);

const FIRST = ['Aarav', 'Lukas', 'Sara', 'Rahul', 'Emma', 'Noah', 'Priya', 'Liam', 'Ayesha', 'Mateo', 'Zara', 'Ethan', 'Isha', 'Omar', 'Mia', 'Kabir'];
const LAST = ['Sharma', 'Shen', 'Khan', 'Patel', 'Garcia', 'Muller', 'Das', 'Rossi', 'Ahmed', 'Kim', 'Singh', 'Lopez'];

function buildSessions(exam, count, seed) {
  const start = new Date(exam.started_at).getTime();
  return Array.from({ length: count }, (_, i) => {
    const n = i + seed;
    const completed = i % 9 === 8;
    const reconnecting = !completed && i % 13 === 5;
    return {
      id: `${exam.id}-att-${i + 1}`,
      exam_id: exam.id,
      student_id: `stu-${String(n + 1).padStart(3, '0')}`,
      user_name: `${FIRST[n % FIRST.length]} ${LAST[(n * 5) % LAST.length]}`,
      class_name: exam.class_name,
      roll_no: String(1001 + n),
      status: completed ? 'completed' : reconnecting ? 'interrupted' : 'in_progress',
      stream_status: reconnecting ? 'STREAM_RECONNECTING' : completed ? 'STREAM_DISCONNECTED' : 'STREAM_CONNECTED',
      started_at: new Date(start + ((i * 7) % 6) * MIN).toISOString(),
      last_heartbeat_at: new Date(NOW - (reconnecting ? 52 : 6) * 1000).toISOString(),
      flags_count: [0, 0, 2, 0, 0, 1, 0, 4, 0, 0, 3, 0, 0, 0, 1, 0][i % 16],
    };
  });
}

const SESSIONS = {
  'live-physics': buildSessions(EXAMS[0], 48, 0),
  'live-chem': buildSessions(EXAMS[1], 36, 7),
  'live-math': buildSessions(EXAMS[2], 42, 3),
};

export async function listLiveExams() {
  await delay();
  return EXAMS.map((e) => ({ ...e, students: SESSIONS[e.id].length }));
}

export async function listSessions(examId) {
  await delay();
  return SESSIONS[examId] || [];
}

let alertSeq = 0;
function makeAlert(session, type, at) {
  alertSeq += 1;
  return {
    id: `alert-${alertSeq}`,
    exam_id: session.exam_id,
    attempt_id: session.id,
    student_id: session.student_id,
    user_name: session.user_name,
    type,
    created_at: new Date(at).toISOString(),
  };
}

/** Seed history: one alert per existing flag, spread over the last 40 minutes. */
export async function listAlerts(examId) {
  await delay();
  const sessions = SESSIONS[examId] || [];
  const alerts = [];
  sessions.forEach((s, i) => {
    for (let k = 0; k < s.flags_count; k += 1) {
      const type = ALERT_KEYS[(i + k * 3) % ALERT_KEYS.length];
      alerts.push(makeAlert(s, type, NOW - ((i * 3 + k * 7) % 40) * MIN - k * 1000));
    }
  });
  return alerts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Simulated realtime feed: emits a random alert for an active session every 6–10s.
 * Returns an unsubscribe function (same shape a Supabase channel wrapper would have).
 */
export function subscribeMockAlerts(sessions, onAlert) {
  const active = sessions.filter((s) => s.status === 'in_progress');
  if (!active.length) return () => {};
  let timer;
  const schedule = () => {
    timer = setTimeout(() => {
      const s = active[Math.floor(Math.random() * active.length)];
      const type = ALERT_KEYS[Math.floor(Math.random() * ALERT_KEYS.length)];
      onAlert({ ...makeAlert(s, type, Date.now()), isNew: true });
      schedule();
    }, 6000 + Math.random() * 4000);
  };
  schedule();
  return () => clearTimeout(timer);
}
