/**
 * Admin v2 Create / Edit Exam data layer (mock for now).
 *
 * Backend phase:
 *  - load/save `exams` (title, subject, duration, instructions, support_email,
 *    questions[] in the stored format, created_by, is_active)
 *  - settings go through src/utils/examConfig.js (serializeExamConfig) — the
 *    only format the student exam page reads
 *  - NEW columns needed: status (draft/published/closed), code, class_name,
 *    start_at, end_at
 *  - AI generation should move to a Supabase Edge Function (the old app calls
 *    Groq from the browser with VITE_GROQ_API_KEY exposed)
 */
import { listExams } from './exams';
import { fromStored, newQuestion } from '../utils/questionFormat';
import { currentExamDefaults, currentSupportEmail } from './settings';

/** ISO -> value for <input type="datetime-local"> in the viewer's timezone. */
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

/** Shared defaults so every new exam starts the same (the old app had two different sets). */
export const EXAM_DEFAULTS = {
  title: '',
  subject: '',
  class_name: 'Class-10',
  duration_minutes: 60,
  instructions: '',
  support_email: '',
  status: 'draft',
  code: null,
  settings: { webcam_proctoring: true, strict_tabs: true },
  schedule: { mode: 'anytime', start_at: '', end_at: '' },
};

const SUBJECT_PREFIX = { physics: 'PHY', chemistry: 'CHE', math: 'MAT', mathematics: 'MAT', biology: 'BIO', english: 'ENG', history: 'HIS' };

/** Short human-friendly join code, e.g. PHY-7K2Q (no 0/O/1/I to avoid confusion). */
export function generateExamCode(subject = '') {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const prefix = SUBJECT_PREFIX[subject.trim().toLowerCase()] || (subject.trim().slice(0, 3).toUpperCase() || 'EXM');
  let tail = '';
  for (let i = 0; i < 4; i += 1) tail += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix.replace(/[^A-Z]/g, 'X').padEnd(3, 'X')}-${tail}`;
}

const MOCK_QUESTIONS = [
  { question: 'What is the SI unit of force?', type: 'mcq', optionA: 'Newton', optionB: 'Joule', optionC: 'Watt', optionD: 'Pascal', correct_answer: 'A' },
  { question: 'Which quantity is a vector?', type: 'mcq', optionA: 'Mass', optionB: 'Speed', optionC: 'Velocity', optionD: 'Energy', correct_answer: 'C' },
  { question: 'The acceleration due to gravity on Earth is about…', type: 'mcq', optionA: '9.8 m/s²', optionB: '1.6 m/s²', optionC: '3.0 m/s²', optionD: '98 m/s²', correct_answer: 'A' },
  { question: 'Explain the difference between distance and displacement.', type: 'answerable', correct_answer: 'Distance is the total path length (scalar); displacement is the straight-line change in position with direction (vector).' },
];

export async function getExamForEdit(id) {
  await delay(300);
  const exam = (await listExams()).find((e) => e.id === id);
  if (!exam) return null;
  return {
    ...EXAM_DEFAULTS,
    id: exam.id,
    title: exam.title,
    subject: exam.subject.charAt(0).toUpperCase() + exam.subject.slice(1),
    class_name: exam.className,
    duration_minutes: Math.round(exam.durationHours * 60),
    status: exam.status === 'draft' ? 'draft' : 'published',
    code: exam.code,
    schedule: exam.start_at
      ? { mode: 'window', start_at: toLocalInput(exam.start_at), end_at: toLocalInput(exam.end_at) }
      : { mode: 'anytime', start_at: '', end_at: '' },
    questions: MOCK_QUESTIONS.map(fromStored),
  };
}

/** New exam using the workspace defaults from Settings → Exam defaults. */
export function newExam() {
  const d = currentExamDefaults();
  return {
    ...EXAM_DEFAULTS,
    duration_minutes: d.duration_minutes,
    support_email: currentSupportEmail(),
    settings: { webcam_proctoring: d.webcam_proctoring, strict_tabs: d.strict_tabs },
    schedule: { ...EXAM_DEFAULTS.schedule, mode: d.availability },
    questions: [],
  };
}

/** Mock save. Returns the saved exam (with id + code). */
export async function saveExam(exam) {
  await delay();
  return { ...exam, id: exam.id || `exam_${Date.now().toString(36)}`, code: exam.code || generateExamCode(exam.subject) };
}

/**
 * Mock AI generation (same output format as src/utils/groqService.js).
 * Backend phase: call an Edge Function that wraps generateExamQuestions().
 */
export async function generateQuestionsMock({ topic, count, mix }) {
  await delay(1200);
  const t = topic.trim();
  return Array.from({ length: count }, (_, i) => {
    const written = mix === 'written' || (mix === 'mixed' && i % 4 === 3);
    if (written) {
      return fromStored({ question: `Explain one key idea of ${t} in your own words (${i + 1}).`, type: 'answerable', correct_answer: `A clear explanation of a core concept in ${t}, with an example.` });
    }
    const letter = 'ABCD'[i % 4];
    return fromStored({
      question: `Which statement about ${t} is correct? (${i + 1})`,
      type: 'mcq',
      optionA: `${t}: statement A`,
      optionB: `${t}: statement B`,
      optionC: `${t}: statement C`,
      optionD: `${t}: statement D`,
      correct_answer: letter,
    });
  });
}

export { newQuestion };
