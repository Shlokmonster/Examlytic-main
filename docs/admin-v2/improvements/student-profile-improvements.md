# Student Profile: improvements backlog

These are changes to make to the admin v2 Student Profile page **after the whole admin UI is built**.

- **Page:** `/v2/admin/students/:id` (`src/admin-v2/pages/StudentProfile.jsx`, sections in `src/admin-v2/pages/student-profile/`)
- **Status:**
  - UI built with mock data (`src/admin-v2/data/studentProfile.js`).
  - The recording player uses a simulated clock.
  - PDFs are generated for real (jsPDF) from mock answers.

## UI improvements

_None requested yet._

## Animation improvements

_None requested yet._

## Backend work needed (found while building, 2026-11-28)

- [ ] **Reviewer verdicts need storage.** Add an `attempt_reviews` table (or columns on `exam_attempts`): `status` (clean / suspicious / cheating), `note`, `reviewed_by`, `reviewed_at`. Add an admin-only RPC to save it. Verdicts currently live only in page state.
- [ ] **Real recordings:** swap the simulated player for `<video src={recording_url}>`, keeping the same controls and markers. Prefer signed or expiring Cloudinary URLs over public ones.
- [ ] **Marker times:** `offset_seconds = event.created_at − attempt.started_at` for `exam_flags` and `exam_logs`. Clamp to the recording length, since the recording may start a few seconds late.
- [ ] **Answer sheet PDF:** build rows from `exam_attempts.answers` and the exam's questions and answer key (admin-only, server-side). Currently it uses mock answers.
- [ ] **Integrity score:** compute per attempt with one shared formula (old dashboard: `max(60, 100 − 1.5 × events)`), ideally in SQL, so the Students list, Profile and PDFs always agree.
- [ ] **Only real students:** the profile must 404 for non-student users (`role = 'student'`).
- [ ] **Report incident:** currently a mock button. Needs a table or RPC and should appear in the student's history.

## Done

_None yet._
