/**
 * Admin v2 Students page data layer (mock for now).
 *
 * Field names follow the real `users` table (id, user_name, email, user_avatar,
 * created_at). `class_name` and `roll_no` are MOCK ONLY: they need new DB
 * columns before the backend can provide them.
 *
 * Backend notes for later:
 *  - list only rows with role = 'student' (the old dashboard showed admins too)
 *  - exams_taken / avg_score from exam_attempts (student_id)
 *  - integrity_score = max(60, 100 - 1.5 * suspicious events) like the old
 *    dashboard (src/Pages/AdminDashboard.jsx ~783), using exam_flags + exam_logs
 *  - status 'live' = attempt in_progress with a recent last_heartbeat_at
 */

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const FIRST = ['Aarav', 'Lukas', 'Sara', 'Rahul', 'Emma', 'Noah', 'Priya', 'Liam', 'Ayesha', 'Mateo', 'Zara', 'Ethan', 'Isha', 'Omar', 'Mia', 'Kabir'];
const LAST = ['Sharma', 'Shen', 'Khan', 'Patel', 'Garcia', 'Müller', 'Das', 'Rossi', 'Ahmed', 'Kim', 'Singh', 'Lopez'];
const CLASSES = ['Class-08', 'Class-09', 'Class-10', 'Class-11', 'Class-12'];

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

function buildStudents() {
  return Array.from({ length: 48 }, (_, i) => {
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 5) % LAST.length];
    const name = `${first} ${last}`;
    const flags = [0, 0, 1, 0, 3, 0, 0, 6, 0, 2, 0, 0, 9, 0, 1, 0][i % 16];
    const integrity = Math.max(60, Math.round(100 - flags * 4.5 - (i % 3)));
    const status = i % 11 === 3 ? 'live' : i % 7 === 5 ? 'inactive' : 'active';
    const lastActiveMs =
      status === 'live' ? NOW - 2 * 60 * 1000 : status === 'inactive' ? NOW - (35 + (i % 20)) * DAY : NOW - ((i * 37) % 600) * 60 * 1000 * 6;

    return {
      id: `stu-${String(i + 1).padStart(3, '0')}`,
      user_name: name,
      email: `${first}.${last}`.toLowerCase().replace('ü', 'u') + `${i + 1}@school.edu`,
      user_avatar: null,
      created_at: new Date(NOW - (120 + i * 3) * DAY).toISOString(),
      class_name: CLASSES[i % CLASSES.length],
      roll_no: String(1001 + i),
      exams_taken: 3 + ((i * 7) % 14),
      avg_score: 48 + ((i * 13) % 50),
      integrity_score: integrity,
      flags_30d: flags,
      last_active_at: new Date(lastActiveMs).toISOString(),
      status,
    };
  });
}

const STUDENTS = buildStudents();

export async function listStudents() {
  await delay();
  return STUDENTS;
}

export async function getStudentStats() {
  await delay();
  const live = STUDENTS.filter((s) => s.status === 'live').length;
  const flagged = STUDENTS.filter((s) => s.flags_30d > 0).length;
  const avg = Math.round(STUDENTS.reduce((sum, s) => sum + s.avg_score, 0) / STUDENTS.length);
  return {
    total: { value: STUDENTS.length, changePct: 6.4 },
    liveNow: live,
    averageScore: { pct: avg, changePct: 2.1 },
    flagged: { value: flagged, changePct: -3.5 },
  };
}

export async function getIntegrityOverview() {
  await delay();
  const high = STUDENTS.filter((s) => s.integrity_score >= 90).length;
  const medium = STUDENTS.filter((s) => s.integrity_score >= 70 && s.integrity_score < 90).length;
  const low = STUDENTS.length - high - medium;
  return { total: STUDENTS.length, high, medium, low };
}

export async function getTopViolations() {
  await delay();
  // Keys match real exam_flags.flag_type / exam_logs.event_type values.
  return [
    { key: 'TAB_SWITCH', label: 'Tab switch', count: 64 },
    { key: 'LOOKING_AWAY', label: 'Looking away', count: 41 },
    { key: 'NO_FACE_DETECTED', label: 'No face detected', count: 27 },
    { key: 'FULLSCREEN_EXIT', label: 'Fullscreen exit', count: 19 },
    { key: 'MULTIPLE_FACES_DETECTED', label: 'Multiple faces', count: 9 },
    { key: 'SUSPICIOUS_OBJECT_DETECTED', label: 'Suspicious object', count: 5 },
  ];
}

export async function getTopPerformers() {
  await delay();
  return [...STUDENTS].sort((a, b) => b.avg_score - a.avg_score).slice(0, 5);
}
