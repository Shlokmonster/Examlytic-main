/**
 * PDF exports for the admin v2 Student Profile, generated in the browser with jsPDF.
 * jsPDF is loaded lazily so it only downloads when someone exports.
 * Colors are the design-system palette (teal / grays / status colors).
 */
import { alertInfo } from './alerts';

const TEAL = [23, 78, 79];
const BLACK = [0, 0, 0];
const GRAY = [106, 114, 130];
const LIGHT = [243, 244, 246];
const BORDER = [229, 231, 235];
const SUCCESS = [0, 166, 62];
const DANGER = [231, 0, 11];

const REVIEW_LABEL = { none: 'Not reviewed', clean: 'Clean', suspicious: 'Suspicious', cheating: 'Cheating confirmed' };

const fmtDate = (iso) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
const fmtClock = (s) => {
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(Math.floor(s % 60)).padStart(2, '0');
  return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function newDoc() {
  const { jsPDF } = await import('jspdf');
  return new jsPDF({ unit: 'pt', format: 'a4' });
}

function header(doc, title, subtitle) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, w, 84, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, 40, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(subtitle, 40, 62);
  doc.text('Examlytic', w - 40, 42, { align: 'right' });
  doc.text(`Generated ${fmtDate(new Date().toISOString())}`, w - 40, 62, { align: 'right' });
  return 112;
}

function ensureSpace(doc, y, needed) {
  if (y + needed > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    return 48;
  }
  return y;
}

function factBoxes(doc, y, facts) {
  const w = doc.internal.pageSize.getWidth() - 80;
  const boxW = (w - (facts.length - 1) * 10) / facts.length;
  facts.forEach(([label, value, color], i) => {
    const x = 40 + i * (boxW + 10);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, y, boxW, 52, 6, 6, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(label, x + 12, y + 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...(color || BLACK));
    doc.text(String(value), x + 12, y + 40);
  });
  return y + 72;
}

function sectionTitle(doc, y, text) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BLACK);
  doc.text(text, 40, y);
  return y + 14;
}

function table(doc, y, columns, rows) {
  const w = doc.internal.pageSize.getWidth() - 80;
  const total = columns.reduce((s, c) => s + c.width, 0);
  const xs = [];
  let acc = 40;
  columns.forEach((c) => {
    xs.push(acc);
    acc += (c.width / total) * w;
  });

  doc.setFillColor(...LIGHT);
  doc.rect(40, y, w, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  columns.forEach((c, i) => doc.text(c.label, xs[i] + 6, y + 14));
  y += 22;

  doc.setFont('helvetica', 'normal');
  rows.forEach((row) => {
    y = ensureSpace(doc, y, 22);
    columns.forEach((c, i) => {
      const cell = row[c.key];
      const color = typeof cell === 'object' && cell ? cell.color : null;
      doc.setTextColor(...(color || BLACK));
      doc.text(String(typeof cell === 'object' && cell ? cell.text : cell ?? ''), xs[i] + 6, y + 14);
    });
    doc.setDrawColor(...BORDER);
    doc.line(40, y + 22, 40 + w, y + 22);
    y += 22;
  });
  return y + 16;
}

/** Answer sheet for one attempt. Mock answers until exam_attempts.answers is wired up. */
export async function downloadAnswerSheet(student, attempt) {
  const doc = await newDoc();
  let y = header(doc, `${attempt.exam_title} — Answer Sheet`, `${student.user_name} · ${student.class_name} · Roll ${student.roll_no}`);

  y = factBoxes(doc, y, [
    ['Score', `${attempt.score}%`, TEAL],
    ['Correct', attempt.answers.correct, SUCCESS],
    ['Wrong', attempt.answers.wrong, DANGER],
    ['Skipped', attempt.answers.skipped],
    ['Integrity', `${attempt.integrity_score}/100`],
  ]);

  y = sectionTitle(doc, y, 'Answers');
  const opts = ['A', 'B', 'C', 'D'];
  const rows = Array.from({ length: attempt.answers.total }, (_, i) => {
    const correct = opts[(i * 3 + 1) % 4];
    let given;
    let result;
    if (i >= attempt.answers.total - attempt.answers.skipped) {
      given = '—';
      result = { text: 'Skipped', color: GRAY };
    } else if (i % Math.max(2, Math.round(attempt.answers.total / Math.max(1, attempt.answers.wrong))) === 1 && attempt.answers.wrong) {
      given = opts[(i * 3 + 2) % 4];
      result = { text: 'Wrong', color: DANGER };
    } else {
      given = correct;
      result = { text: 'Correct', color: SUCCESS };
    }
    return { q: `Q${i + 1}`, given, correct, result };
  });
  table(
    doc,
    y,
    [
      { key: 'q', label: 'Question', width: 1 },
      { key: 'given', label: 'Student answer', width: 1.4 },
      { key: 'correct', label: 'Correct answer', width: 1.4 },
      { key: 'result', label: 'Result', width: 1.2 },
    ],
    rows,
  );

  doc.save(`${slug(student.user_name)}-${slug(attempt.exam_title)}-answers.pdf`);
}

/** One-file summary of a student across all exams. */
export async function downloadStudentReport(student, attempts, summary) {
  const doc = await newDoc();
  let y = header(doc, `${student.user_name} — Student Report`, `${student.class_name} · Roll ${student.roll_no} · ${student.email}`);

  y = factBoxes(doc, y, [
    ['Exams taken', attempts.length],
    ['Average score', `${summary.avgScore}%`, TEAL],
    ['Integrity', `${summary.integrity}/100`],
    ['Total flags', summary.totalFlags, summary.totalFlags ? DANGER : SUCCESS],
  ]);

  y = sectionTitle(doc, y, `Integrity: ${summary.verdict}`);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  const lines = doc.splitTextToSize(summary.sentence, doc.internal.pageSize.getWidth() - 80);
  doc.text(lines, 40, y + 4);
  y += lines.length * 13 + 20;

  y = sectionTitle(doc, y, 'Exam history');
  y = table(
    doc,
    y,
    [
      { key: 'exam', label: 'Exam', width: 2.2 },
      { key: 'date', label: 'Date', width: 1.3 },
      { key: 'score', label: 'Score', width: 0.9 },
      { key: 'integrity', label: 'Integrity', width: 1 },
      { key: 'flags', label: 'Flags', width: 0.8 },
      { key: 'review', label: 'Review', width: 1.6 },
    ],
    attempts.map((a) => ({
      exam: a.exam_title,
      date: fmtDate(a.started_at),
      score: `${a.score}%`,
      integrity: a.integrity_score,
      flags: { text: a.events.length, color: a.events.length ? DANGER : SUCCESS },
      review: REVIEW_LABEL[a.review.status],
    })),
  );

  const flagged = attempts.filter((a) => a.events.length);
  if (flagged.length) {
    y = ensureSpace(doc, y, 60);
    y = sectionTitle(doc, y, 'Flagged moments');
    const rows = flagged.flatMap((a) =>
      a.events.map((e) => ({
        exam: a.exam_title,
        at: fmtClock(e.offset_seconds),
        event: { text: alertInfo(e.type).label, color: alertInfo(e.type).severity === 'danger' ? DANGER : BLACK },
      })),
    );
    table(
      doc,
      y,
      [
        { key: 'exam', label: 'Exam', width: 2 },
        { key: 'at', label: 'Time in exam', width: 1 },
        { key: 'event', label: 'Event', width: 2 },
      ],
      rows,
    );
  }

  doc.save(`${slug(student.user_name)}-report.pdf`);
}
