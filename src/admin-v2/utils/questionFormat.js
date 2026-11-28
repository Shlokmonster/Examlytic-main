/**
 * Question format helpers.
 *
 * Stored format (exams.questions, old CreateExam, JSON import, Groq output):
 *   { id?, question, type: 'mcq' | 'answerable', optionA..optionD, correct_answer, marks? }
 * Builder format (v2 editor):
 *   { id, type: 'mcq' | 'written', text, options: [4], correct: 0-3, expected: '', marks }
 *
 * Fix vs the old app: every question gets a stable `id` (the old answer-sheet
 * PDF looked answers up by id, but created questions had none).
 */

export const LETTERS = ['A', 'B', 'C', 'D'];

let seq = 0;
export const newId = () => `q_${Date.now().toString(36)}_${(seq += 1).toString(36)}`;

export function newQuestion(type = 'mcq') {
  return { id: newId(), type, text: '', options: ['', '', '', ''], correct: 0, expected: '', marks: type === 'mcq' ? 1 : 5 };
}

/** Copy of a question for use in an exam: only editor fields, with a fresh id. */
export function copyForExam(q) {
  return { id: newId(), type: q.type, text: q.text, options: [...q.options], correct: q.correct, expected: q.expected, marks: q.marks };
}

export function fromStored(q) {
  const isMcq = q.type === 'mcq';
  return {
    id: q.id || newId(),
    type: isMcq ? 'mcq' : 'written',
    text: q.question || '',
    options: isMcq ? [q.optionA, q.optionB, q.optionC, q.optionD].map((o) => o || '') : ['', '', '', ''],
    correct: isMcq ? Math.max(0, LETTERS.indexOf(q.correct_answer)) : 0,
    expected: isMcq ? '' : q.correct_answer || '',
    marks: Number(q.marks) || (isMcq ? 1 : 5),
  };
}

export function toStored(q) {
  if (q.type === 'mcq') {
    return {
      id: q.id,
      question: q.text.trim(),
      type: 'mcq',
      optionA: q.options[0].trim(),
      optionB: q.options[1].trim(),
      optionC: q.options[2].trim(),
      optionD: q.options[3].trim(),
      correct_answer: LETTERS[q.correct],
      marks: q.marks,
    };
  }
  return { id: q.id, question: q.text.trim(), type: 'answerable', correct_answer: q.expected.trim(), marks: q.marks };
}

/** Problems that block publishing. Empty array = complete. */
export function questionIssues(q) {
  const issues = [];
  if (!q.text.trim()) issues.push('Question text is empty');
  if (q.type === 'mcq' && q.options.some((o) => !o.trim())) issues.push('All 4 options are required');
  if (!(q.marks > 0)) issues.push('Marks must be more than 0');
  return issues;
}

/**
 * Validate an imported JSON array in the stored format.
 * Same rules as the old CreateExam importer (src/Pages/CreateExam.jsx ~604).
 * Returns { questions } or { error }.
 */
export function parseImportedJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { error: `Invalid JSON: ${e.message}` };
  }
  const list = Array.isArray(data) ? data : Array.isArray(data?.questions) ? data.questions : null;
  if (!list) return { error: 'Expected an array of questions (or an object with a "questions" array).' };
  if (!list.length) return { error: 'The array is empty.' };

  for (let i = 0; i < list.length; i += 1) {
    const q = list[i];
    const n = i + 1;
    if (!q || typeof q !== 'object') return { error: `Question ${n} is not an object.` };
    if (!q.question) return { error: `Question ${n} is missing "question".` };
    if (!['mcq', 'answerable'].includes(q.type)) return { error: `Question ${n} has type "${q.type}". Use "mcq" or "answerable".` };
    if (q.type === 'mcq') {
      if (!q.optionA || !q.optionB || !q.optionC || !q.optionD) return { error: `Question ${n} (mcq) needs optionA–optionD.` };
      if (!LETTERS.includes(q.correct_answer)) return { error: `Question ${n} (mcq) needs correct_answer A, B, C or D.` };
    }
  }
  return { questions: list.map(fromStored) };
}

export const SAMPLE_JSON = JSON.stringify(
  [
    {
      question: 'What is the SI unit of energy?',
      type: 'mcq',
      optionA: 'Newton',
      optionB: 'Joule',
      optionC: 'Watt',
      optionD: 'Pascal',
      correct_answer: 'B',
    },
    {
      question: "Explain Newton's second law of motion with an example.",
      type: 'answerable',
      correct_answer: 'Force equals mass times acceleration (F = ma). Example: pushing a heavier cart needs more force for the same acceleration.',
    },
  ],
  null,
  2,
);
