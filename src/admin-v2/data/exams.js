/**
 * Admin v2 Exams page data layer (mock for now).
 * Later these functions get replaced with Supabase queries; the components
 * stay the same.
 */

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getExamStats() {
  await delay();
  return {
    totalExams: { value: 37, changePct: 3.2 },
    totalStudents: { value: 814, changePct: 1.2 },
    upcomingExams: 10,
    reviewsPct: 3,
  };
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const at = (days, hour = 9, min = 0) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};
const span = (startIso, hours) => ({ start_at: startIso, end_at: new Date(new Date(startIso).getTime() + hours * HOUR).toISOString() });

/**
 * Mock exams. Backend phase: `exams` table + NEW columns status ('draft' |
 * 'published' | 'closed'), code, class_name, start_at, end_at. `is_active`
 * already exists (lock/unlock; ExamStatusCheck.jsx blocks locked exams).
 * `live_count` = attempts in progress (from exam_attempts).
 */
let EXAMS = null;
function seed() {
  const now = new Date().toISOString();
  return [
    { id: 'live-physics', type: 'mcq', title: 'Physics Final', subject: 'physics', className: 'Class-10', date: new Date(Date.now() - 0.8 * HOUR).toISOString(), durationHours: 2, marks: 100, status: 'published', ...span(new Date(Date.now() - HOUR).toISOString(), 3), code: 'PHY-7K2Q', is_active: true, questionCount: 40, live_count: 42 },
    { id: 'live-chem', type: 'mcq', title: 'Chemistry Unit Test', subject: 'chemistry', className: 'Class-09', date: new Date(Date.now() - 0.3 * HOUR).toISOString(), durationHours: 1.5, marks: 60, status: 'published', ...span(new Date(Date.now() - 0.5 * HOUR).toISOString(), 2), code: 'CHE-M4XP', is_active: true, questionCount: 30, live_count: 34 },
    { id: 'live-math', type: 'mcq', title: 'Math Midterm', subject: 'math', className: 'Class-08', date: new Date(Date.now() - 1.6 * HOUR).toISOString(), durationHours: 2, marks: 100, status: 'published', ...span(new Date(Date.now() - 2 * HOUR).toISOString(), 3), code: 'MAT-9RTD', is_active: true, questionCount: 40, live_count: 39 },
    { id: 'e1', type: 'mcq', title: 'Chemistry Final Exam', subject: 'chemistry', className: 'Class-09', date: at(1, 9), durationHours: 3, marks: 100, status: 'published', ...span(at(1, 9), 4), code: 'CHE-2WQA', is_active: true, questionCount: 45, live_count: 0 },
    { id: 'e2', type: 'mcq', title: 'Physics II', subject: 'physics', className: 'Class-12', date: at(2, 11), durationHours: 3, marks: 100, status: 'published', ...span(at(2, 11), 4), code: 'PHY-H8ZN', is_active: true, questionCount: 40, live_count: 0 },
    { id: 'e3', type: 'mcq', title: 'Mathematics', subject: 'math', className: 'Class-10', date: at(3, 11), durationHours: 2, marks: 100, status: 'draft', start_at: null, end_at: null, code: null, is_active: true, questionCount: 18, live_count: 0 },
    { id: 'e4', type: 'mcq', title: 'Biology Unit Test', subject: 'biology', className: 'Class-11', date: at(5, 10), durationHours: 2, marks: 50, status: 'published', start_at: null, end_at: null, code: 'BIO-K3VE', is_active: true, questionCount: 25, live_count: 0 },
    { id: 'e5', type: 'mcq', title: 'English Grammar', subject: 'english', className: 'Class-08', date: at(-6, 9, 30), durationHours: 1, marks: 50, status: 'closed', ...span(at(-6, 9, 30), 2), code: 'ENG-P7LC', is_active: false, questionCount: 25, live_count: 0 },
    { id: 'e6', type: 'written', title: 'History Midterm', subject: 'history', className: 'Class-10', date: at(4, 10), durationHours: 3, marks: 100, status: 'published', ...span(at(4, 10), 4), code: 'HIS-6FBM', is_active: true, questionCount: 8, live_count: 0 },
    { id: 'e7', type: 'written', title: 'Physics Theory', subject: 'physics', className: 'Class-12', date: at(6, 9), durationHours: 3, marks: 100, status: 'draft', start_at: null, end_at: null, code: null, is_active: true, questionCount: 6, live_count: 0 },
    { id: 'e8', type: 'written', title: 'Essay Writing', subject: 'english', className: 'Class-09', date: at(-12, 11), durationHours: 2, marks: 60, status: 'closed', ...span(at(-12, 11), 3), code: 'ENG-Y2RS', is_active: false, questionCount: 3, live_count: 0 },
    { id: 'e9', type: 'viva', title: 'Chemistry Practical Viva', subject: 'chemistry', className: 'Class-12', date: at(8, 14), durationHours: 1, marks: 25, status: 'published', ...span(at(8, 14), 3), code: 'CHE-VV4D', is_active: true, questionCount: 10, live_count: 0 },
    { id: 'e10', type: 'viva', title: 'English Oral', subject: 'english', className: 'Class-10', date: at(9, 13), durationHours: 1, marks: 20, status: 'draft', start_at: null, end_at: null, code: null, is_active: true, questionCount: 5, live_count: 0 },
  ].map((e) => ({ ...e, coverUrl: null, updated_at: now }));
}

export async function listExams() {
  await delay();
  if (!EXAMS) EXAMS = seed();
  return EXAMS.map((e) => ({ ...e }));
}

/* ---- Mock mutations (backend phase: Supabase update/insert/delete on `exams`) ---- */

export async function setExamLocked(id, locked) {
  await delay(150);
  EXAMS = EXAMS.map((e) => (e.id === id ? { ...e, is_active: !locked } : e));
}

export async function deleteExam(id) {
  await delay(200);
  EXAMS = EXAMS.filter((e) => e.id !== id);
}

/** Copy of an exam as a new Draft (no schedule, no code until published). */
export async function duplicateExam(id) {
  await delay(250);
  const src = EXAMS.find((e) => e.id === id);
  if (!src) return null;
  const copy = {
    ...src,
    id: `${src.id}-copy-${Date.now().toString(36)}`,
    title: `Copy of ${src.title}`,
    status: 'draft',
    code: null,
    start_at: null,
    end_at: null,
    is_active: true,
    live_count: 0,
    updated_at: new Date().toISOString(),
  };
  const i = EXAMS.findIndex((e) => e.id === id);
  EXAMS = [...EXAMS.slice(0, i + 1), copy, ...EXAMS.slice(i + 1)];
  return { ...copy };
}

export async function getSubjectInterest() {
  await delay();
  return {
    totalEnroll: 249,
    subjects: [
      { label: 'Chemistry', pct: 45 },
      { label: 'Physics', pct: 25 },
      { label: 'Biology', pct: 20 },
      { label: 'Mathematics', pct: 10 },
    ],
  };
}

export async function getQuestionPattern() {
  await delay();
  return [
    { label: 'MCQ', pct: 51 },
    { label: 'Written', pct: 32 },
    { label: 'Viva', pct: 17 },
  ];
}

export async function getSubjectScores() {
  await delay();
  return [
    { label: 'Bangla', score: 85 },
    { label: 'English', score: 72 },
    { label: 'Sports', score: 82 },
    { label: 'Biology', score: 74 },
    { label: 'Math', score: 46 },
    { label: 'Physics', score: 62 },
    { label: 'Arts', score: 64 },
    { label: 'ICT', score: 66 },
    { label: 'Chemistry', score: 58 },
  ];
}
