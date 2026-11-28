/**
 * Admin v2 Student Profile data layer (mock for now).
 *
 * Backend phase:
 *  - profile: users row (role = 'student') + aggregates
 *  - attempts: exam_attempts (score, status, started_at, submitted_at, answers,
 *    recording_url, recording_duration) joined with exams
 *  - events: exam_flags (AI) + exam_logs (browser) for each attempt, offset =
 *    event time - attempt.started_at
 *  - review: shared with the Review queue via ./reviewStore (attempt_reviews table later)
 */
import { listStudents } from './students';
import { getReview } from './reviewStore';

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const DAY = 24 * 60 * 60 * 1000;

const EXAMS = [
  { title: 'Physics Final', subject: 'Physics', minutes: 120, questions: 40 },
  { title: 'Chemistry Unit Test', subject: 'Chemistry', minutes: 90, questions: 30 },
  { title: 'Math Midterm', subject: 'Math', minutes: 120, questions: 40 },
  { title: 'English Grammar', subject: 'English', minutes: 60, questions: 25 },
  { title: 'Biology Unit Test', subject: 'Biology', minutes: 90, questions: 30 },
];

// Events per attempt, chosen so one exam stands out (useful for the chart + verdicts).
const EVENT_PLANS = [
  ['LOOKING_AWAY'],
  [],
  ['TAB_SWITCH', 'LOOKING_AWAY', 'LOOKING_AWAY', 'NO_FACE_DETECTED', 'TAB_SWITCH', 'COPY_CUT_PASTE', 'LOOKING_AWAY', 'MULTIPLE_FACES_DETECTED', 'FULLSCREEN_EXIT', 'LOOKING_AWAY', 'TAB_SWITCH', 'SUSPICIOUS_OBJECT_DETECTED', 'LOOKING_AWAY', 'TAB_SWITCH'],
  ['FULLSCREEN_EXIT', 'TAB_SWITCH', 'LOOKING_AWAY'],
  ['TAB_SWITCH', 'LOOKING_AWAY', 'NO_FACE_DETECTED', 'COPY_CUT_PASTE', 'TAB_SWITCH', 'LOOKING_AWAY'],
];
const SCORES = [74, 81, 92, 68, 77];

/** Same rule as the old dashboard (src/Pages/AdminDashboard.jsx ~783). */
export const integrityFrom = (eventCount) => Math.max(60, Math.round(100 - eventCount * 1.5));

export async function getStudentProfile(id) {
  const students = await listStudents();
  return students.find((s) => s.id === id) || null;
}

export async function listStudentAttempts(id) {
  await delay();
  const n = Number(String(id).replace(/\D/g, '')) || 1;
  const count = 4 + (n % 2);

  return Array.from({ length: count }, (_, i) => {
    const exam = EXAMS[(i + n) % EXAMS.length];
    const plan = EVENT_PLANS[(i + n) % EVENT_PLANS.length];
    const started = Date.now() - (12 + (count - i) * 9) * DAY + 9 * 60 * 60 * 1000;
    const recordingSeconds = exam.minutes * 60 - 300 - ((i * 37) % 600);
    const score = SCORES[(i + n) % SCORES.length];
    const correct = Math.round((score / 100) * exam.questions);
    const skipped = (i + n) % 3;
    const hasRecording = (i + n) % 5 !== 1;

    const events = plan.map((type, k) => {
      const offset = Math.round(((k + 1) / (plan.length + 1)) * recordingSeconds + ((k * 97) % 180) - 90);
      return {
        id: `${id}-a${i}-e${k}`,
        type,
        offset_seconds: Math.max(5, offset),
        created_at: new Date(started + Math.max(5, offset) * 1000).toISOString(),
      };
    });

    return {
      id: `${id}-attempt-${i + 1}`,
      exam_title: exam.title,
      subject: exam.subject,
      status: 'completed',
      started_at: new Date(started).toISOString(),
      submitted_at: new Date(started + recordingSeconds * 1000).toISOString(),
      duration_minutes: exam.minutes,
      recording_url: null, // mock: real attempts store a Cloudinary URL here
      recording_duration: hasRecording ? recordingSeconds : null,
      score,
      answers: {
        total: exam.questions,
        correct: Math.min(correct, exam.questions - skipped),
        wrong: Math.max(0, exam.questions - Math.min(correct, exam.questions - skipped) - skipped),
        skipped,
      },
      integrity_score: integrityFrom(events.length),
      events,
      review: getReview(`${id}-attempt-${i + 1}`) || { status: 'none', note: '' },
    };
  });
}
