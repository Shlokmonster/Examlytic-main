/**
 * Admin v2 Question Bank (mock, in-memory).
 *
 * Backend phase: a new `question_bank` table (id, subject, difficulty, type,
 * question, options, correct_answer, marks, created_by, updated_at) plus a
 * usage count from exams that include each question. Questions copied into an
 * exam keep `source_question_id` so "Used in N exams" can be computed.
 */
import { fromStored } from '../utils/questionFormat';

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const DAY = 24 * 60 * 60 * 1000;

export const SUBJECTS = ['Physics', 'Chemistry', 'Math', 'Biology', 'English'];
export const DIFFICULTIES = [
  { value: 'easy', label: 'Easy', tone: 'success' },
  { value: 'medium', label: 'Medium', tone: 'warning' },
  { value: 'hard', label: 'Hard', tone: 'danger' },
];

const RAW = [
  ['Physics', 'easy', { question: 'What is the SI unit of force?', type: 'mcq', optionA: 'Newton', optionB: 'Joule', optionC: 'Watt', optionD: 'Pascal', correct_answer: 'A' }],
  ['Physics', 'easy', { question: 'Which of these is a vector quantity?', type: 'mcq', optionA: 'Mass', optionB: 'Speed', optionC: 'Velocity', optionD: 'Time', correct_answer: 'C' }],
  ['Physics', 'medium', { question: 'A car accelerates from rest at 2 m/s² for 5 s. What is its final speed?', type: 'mcq', optionA: '5 m/s', optionB: '10 m/s', optionC: '2.5 m/s', optionD: '20 m/s', correct_answer: 'B' }],
  ['Physics', 'medium', { question: 'State Ohm’s law and write its formula.', type: 'answerable', correct_answer: 'Current through a conductor is proportional to the voltage across it at constant temperature: V = IR.' }],
  ['Physics', 'hard', { question: 'Explain why a satellite in orbit is said to be in free fall.', type: 'answerable', correct_answer: 'Gravity is the only force acting; it continuously falls toward Earth while its tangential velocity keeps it missing the surface.' }],
  ['Physics', 'hard', { question: 'Which law explains why a rocket moves forward?', type: 'mcq', optionA: 'Newton’s first law', optionB: 'Newton’s second law', optionC: 'Newton’s third law', optionD: 'Law of gravitation', correct_answer: 'C' }],
  ['Chemistry', 'easy', { question: 'What is the chemical symbol for sodium?', type: 'mcq', optionA: 'So', optionB: 'Na', optionC: 'Sd', optionD: 'S', correct_answer: 'B' }],
  ['Chemistry', 'easy', { question: 'The pH of pure water at 25 °C is…', type: 'mcq', optionA: '0', optionB: '5', optionC: '7', optionD: '14', correct_answer: 'C' }],
  ['Chemistry', 'medium', { question: 'Which gas is produced when zinc reacts with dilute hydrochloric acid?', type: 'mcq', optionA: 'Oxygen', optionB: 'Hydrogen', optionC: 'Chlorine', optionD: 'Carbon dioxide', correct_answer: 'B' }],
  ['Chemistry', 'medium', { question: 'Balance the equation: H₂ + O₂ → H₂O', type: 'answerable', correct_answer: '2H₂ + O₂ → 2H₂O' }],
  ['Chemistry', 'hard', { question: 'Explain the difference between an ionic and a covalent bond with one example each.', type: 'answerable', correct_answer: 'Ionic: transfer of electrons (NaCl). Covalent: sharing of electrons (H₂O).' }],
  ['Math', 'easy', { question: 'What is 15% of 200?', type: 'mcq', optionA: '15', optionB: '20', optionC: '30', optionD: '35', correct_answer: 'C' }],
  ['Math', 'easy', { question: 'Solve: 3x + 5 = 20', type: 'mcq', optionA: 'x = 3', optionB: 'x = 5', optionC: 'x = 15', optionD: 'x = 25', correct_answer: 'B' }],
  ['Math', 'medium', { question: 'The area of a circle with radius 7 cm (π ≈ 22/7) is…', type: 'mcq', optionA: '44 cm²', optionB: '154 cm²', optionC: '49 cm²', optionD: '308 cm²', correct_answer: 'B' }],
  ['Math', 'medium', { question: 'Prove that the sum of angles in a triangle is 180°.', type: 'answerable', correct_answer: 'Draw a line through one vertex parallel to the opposite side; alternate angles show the three angles form a straight line (180°).' }],
  ['Math', 'hard', { question: 'Find the roots of x² − 5x + 6 = 0.', type: 'mcq', optionA: '1 and 6', optionB: '2 and 3', optionC: '−2 and −3', optionD: '3 and 4', correct_answer: 'B' }],
  ['Math', 'hard', { question: 'Differentiate f(x) = 3x³ − 2x + 7.', type: 'answerable', correct_answer: 'f′(x) = 9x² − 2' }],
  ['Biology', 'easy', { question: 'Which organelle is known as the powerhouse of the cell?', type: 'mcq', optionA: 'Nucleus', optionB: 'Ribosome', optionC: 'Mitochondria', optionD: 'Golgi body', correct_answer: 'C' }],
  ['Biology', 'medium', { question: 'Photosynthesis mainly takes place in the…', type: 'mcq', optionA: 'Roots', optionB: 'Stem', optionC: 'Leaves', optionD: 'Flowers', correct_answer: 'C' }],
  ['Biology', 'medium', { question: 'Describe the function of red blood cells.', type: 'answerable', correct_answer: 'They carry oxygen from the lungs to body tissues using haemoglobin and return some carbon dioxide.' }],
  ['Biology', 'hard', { question: 'Explain how natural selection leads to evolution.', type: 'answerable', correct_answer: 'Variation exists; individuals with favourable traits survive and reproduce more, so those traits become more common over generations.' }],
  ['English', 'easy', { question: 'Choose the correct sentence.', type: 'mcq', optionA: 'She don’t like tea.', optionB: 'She doesn’t likes tea.', optionC: 'She doesn’t like tea.', optionD: 'She not like tea.', correct_answer: 'C' }],
  ['English', 'easy', { question: 'What is the plural of “child”?', type: 'mcq', optionA: 'Childs', optionB: 'Children', optionC: 'Childes', optionD: 'Childrens', correct_answer: 'B' }],
  ['English', 'medium', { question: 'Identify the figure of speech: “The wind whispered through the trees.”', type: 'mcq', optionA: 'Simile', optionB: 'Metaphor', optionC: 'Personification', optionD: 'Hyperbole', correct_answer: 'C' }],
  ['English', 'hard', { question: 'Write a short paragraph (80–100 words) on the importance of reading.', type: 'answerable', correct_answer: 'Clear topic sentence, 2–3 supporting points (vocabulary, imagination, knowledge), a conclusion; correct grammar.' }],
];

let BANK = RAW.map(([subject, difficulty, stored], i) => ({
  ...fromStored(stored),
  id: `bq-${i + 1}`,
  subject,
  difficulty,
  used_in: (i * 7) % 6,
  updated_at: new Date(Date.now() - ((i * 5) % 40) * DAY).toISOString(),
}));

export async function listBankQuestions() {
  await delay();
  return BANK.map((q) => ({ ...q, options: [...q.options] }));
}

export async function saveBankQuestion(q) {
  await delay(200);
  const saved = { ...q, updated_at: new Date().toISOString() };
  BANK = BANK.some((x) => x.id === q.id) ? BANK.map((x) => (x.id === q.id ? saved : x)) : [saved, ...BANK];
  return saved;
}

export async function deleteBankQuestions(ids) {
  await delay(200);
  BANK = BANK.filter((q) => !ids.includes(q.id));
}
