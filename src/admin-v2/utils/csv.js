/** Download rows as a CSV file. columns: [{ key, label }] */
export function downloadCsv(filename, columns, rows) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => escape(c.label)).join(','), ...rows.map((r) => columns.map((c) => escape(r[c.key])).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const STUDENT_CSV_COLUMNS = [
  { key: 'user_name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'class_name', label: 'Class' },
  { key: 'roll_no', label: 'Roll No' },
  { key: 'exams_taken', label: 'Exams Taken' },
  { key: 'avg_score', label: 'Avg Score (%)' },
  { key: 'integrity_score', label: 'Integrity Score' },
  { key: 'status', label: 'Status' },
  { key: 'last_active_at', label: 'Last Active' },
];
