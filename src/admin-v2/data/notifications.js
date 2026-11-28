/**
 * Admin v2 notifications (mock for now).
 *
 * Backend phase: build these from useRealtimeExamActivity (exam_flags /
 * exam_logs inserts), exam_attempts status changes (disconnects, submissions)
 * and exam schedules (starting soon). Read state needs a small table
 * (notification_reads: admin_id, notification_id) or a last-seen timestamp.
 */
import { ADMIN_V2_BASE } from '../layout/navItems';

const MIN = 60 * 1000;

/** kind -> look. Tones map to the palette (danger / warning / primary / success / neutral). */
export const NOTIFICATION_KINDS = {
  flag: { tone: 'danger' },
  disconnect: { tone: 'warning' },
  starting: { tone: 'primary' },
  submitted: { tone: 'success' },
  review: { tone: 'neutral' },
};

let seq = 0;
const make = (kind, title, body, link, minutesAgo, read = false) => {
  seq += 1;
  return { id: `n${seq}`, kind, title, body, link, created_at: new Date(Date.now() - minutesAgo * MIN).toISOString(), read };
};

export function seedNotifications() {
  return [
    make('flag', 'Multiple faces detected', 'Rahul Patel · Physics Final', `${ADMIN_V2_BASE}/live-monitor?exam=live-physics`, 2),
    make('disconnect', '3 students reconnecting', 'Chemistry Unit Test', `${ADMIN_V2_BASE}/live-monitor?exam=live-chem`, 6),
    make('flag', 'Phone detected', 'Emma Garcia · Math Midterm', `${ADMIN_V2_BASE}/live-monitor?exam=live-math`, 14),
    make('starting', 'Chemistry Final Exam starts tomorrow', 'Class-09 · 9.00 am · code CHE-2WQA', `${ADMIN_V2_BASE}/exams`, 45, true),
    make('submitted', 'English Grammar closed', '25 of 25 students submitted', `${ADMIN_V2_BASE}/results`, 60 * 5, true),
    make('review', 'Flagged attempts need review', 'Open the Review Queue to decide', `${ADMIN_V2_BASE}/reviews`, 60 * 26, true),
  ];
}

const LIVE_POOL = [
  ['flag', 'Looking away repeatedly', 'Sara Khan · Physics Final', `${ADMIN_V2_BASE}/live-monitor?exam=live-physics`],
  ['flag', 'Tab switched 3 times', 'Noah Muller · Chemistry Unit Test', `${ADMIN_V2_BASE}/live-monitor?exam=live-chem`],
  ['disconnect', 'Student disconnected', 'Liam Rossi · Math Midterm', `${ADMIN_V2_BASE}/live-monitor?exam=live-math`],
  ['submitted', 'Aarav Sharma submitted', 'Physics Final · 37 minutes early', `${ADMIN_V2_BASE}/students/stu-001`],
  ['flag', 'No face detected', 'Priya Das · Physics Final', `${ADMIN_V2_BASE}/live-monitor?exam=live-physics`],
];

/** Simulated realtime: a new notification every 35–55s. Returns unsubscribe. */
export function subscribeMockNotifications(onNotification) {
  let timer;
  let i = 0;
  const schedule = () => {
    timer = setTimeout(() => {
      const [kind, title, body, link] = LIVE_POOL[i % LIVE_POOL.length];
      i += 1;
      onNotification(make(kind, title, body, link, 0));
      schedule();
    }, 35000 + Math.random() * 20000);
  };
  schedule();
  return () => clearTimeout(timer);
}
