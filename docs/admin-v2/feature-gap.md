# Admin v2: feature gap vs the old admin

This compares the old admin (`src/Pages/AdminDashboard.jsx` = AD, `src/Pages/CreateExam.jsx` = CE, `src/Components/*`) with v2 (`src/admin-v2/`). Tick items as they're done.

- **Created:** 2026-11-28, from a full read of the old admin code.
- **Order of work:** see section D.

---

## A. Working old features that v2 doesn't have yet

> A1–A6: UI built in the v2 Exam Builder (`src/admin-v2/pages/ExamBuilder.jsx`) on mock data. Saving to `exams` happens in the backend phase.
> A7–A11: UI built on the Exams page (list view, status, lock toggle, ⋯ menu) on mock data (`src/admin-v2/data/exams.js` mock mutations).

- [x] **A1. Create exam:** title, subject, duration, contact email, instructions, save (CE:816-871, CE:655-698; AD:2149-2521). In v2: Create / Edit Exam page `/v2/admin/exams/new`, opened from "Add New Exam" and "Schedule an Exam".
- [x] **A2. Question builder:** multiple choice A–D with a correct answer; written with an expected answer; add, remove, switch type (CE:950-1056). In v2: Create / Edit Exam, later shared with Question Bank.
- [x] **A3. AI question generator:** Groq, 1–20 questions from a topic (`src/utils/groqService.js`). In v2: a "Generate with AI" panel.
- [x] **A4. JSON import** with sample and validation (CE:604-647). In v2: an "Import JSON" dialog.
- [x] **A5. Security settings:** webcam proctoring and strict tabs (`src/utils/examConfig.js`; enforced at `ExamAttempt.jsx:138-139`). In v2: a "Proctoring" section.
- [x] **A6. Edit an existing exam's questions** (AD:21-197). In v2: `/v2/admin/exams/:id/edit`.
- [x] **A7. Lock / unlock exam:** `exams.is_active`; students are blocked by `ExamStatusCheck.jsx:32-45` (AD:951-971). In v2: a toggle on each exam on the Exams page.
- [x] **A8. Delete exam** with confirmation (AD:993-1009). In v2: exam ⋯ menu.
- [x] **A9. Copy exam code** (AD:1022-1032). In v2: exam cards and list.
- [x] **A10. Full exam list:** question count, code, status (AD:1628-1661). In v2: a list view on the Exams page.
- [x] **A11. "Live stats":** open an exam's live monitor (AD:1667). In v2: exam ⋯ "Monitor live" opens Live Monitor with that exam preselected.
- [ ] **A12. Realtime connection badge:** Live / Reconnecting / Offline (AD:1226-1234). In v2: Dashboard and Live Monitor headers.
- [ ] **A13. "Expired" sessions group** (AD:632-726). In v2: an Expired tab on Live Monitor.
- [ ] **A14. Recent warnings feed** on the dashboard (AD:1464-1525). In v2: a "Recent alerts" card on the Dashboard.
- [ ] **A15. Timeline search and detected object names** (`StudentSessionTimeline.jsx:19-214`). In v2: the shared event timeline (see `references-to-try.md`).
- [ ] **A16. Recording download** (built in `StudentRecordings.jsx:244-277`, never shown). In v2: Attempt Review.

## B. Old code to reuse when wiring the backend

- [ ] `src/utils/groqService.js`: AI generation. Move the key server-side first; see C.
- [ ] `src/utils/examConfig.js`: the only correct way to read and write exam settings.
- [ ] `downloadCandidatePDF` (AD:423-570): real answers for `src/admin-v2/utils/pdf.js`.
- [ ] Log + flag merge with severity (`StudentSessionTimeline.jsx:32-89`).
- [ ] `src/hooks/useRealtimeExamActivity.js` and `ExamActivityProvider`: live alerts (add an exam filter).
- [ ] `fetchLiveKitToken` (`src/services/examService.js:314`) and identity parsing (`LiveMonitoring.jsx:58`): real video tiles.
- [ ] Interrupted / expired grouping (AD:632-726).
- [ ] Cloudinary fields `recording_url`, `cloudinary_public_id`, `recording_duration`: the Attempt Review player.

## C. Improvements: fix, don't copy

### Bugs and fakes in the old app
- [x] **Exam "code" is just the first 6 characters of the ID**, and the copy button copies the full ID → generate and store a real short code (e.g. `PHY-7K2Q`).
- [x] **Created questions have no IDs**, so the answer-sheet PDF may show "No response" (AD:522,536) → give every question a stable `id`.
- [x] **Randomize, calculator and total marks are saved but never used** → make them work, or remove them.
- [x] **AD and CE use different defaults** (strict tabs, randomize) → one shared default.
- [x] **"Invite by Email" sends nothing** (it only saves `support_email`) → rename it to "Support email"; real invites are a separate feature.
- [x] **"Save as Draft" is fake** → add a real status: Draft → Published (Scheduled / Live) → Closed.
- [ ] **The Groq API key is in the browser** (`VITE_GROQ_API_KEY`) → move generation into a Supabase Edge Function.
- [ ] **`rapid-task` gives LiveKit tokens without login** → fix before go-live (see `improvements/live-monitor-improvements.md`).
- [ ] **Report incident writes status `'flagged'`**, which isn't a defined status → use an incidents table or a review field. *(v2 UI done: Review Queue + shared verdicts in `data/reviewStore.js`; needs the `attempt_reviews` table in the backend phase.)*
- [x] **Analytics flag keys are wrong** (`FACE_NOT_FOUND` vs `NO_FACE_DETECTED`), so the bars are always 0 → use the shared `src/admin-v2/utils/alerts.js`.
- [x] **Don't copy these fakes:**
  - the Infrastructure Health panel;
  - dead pagination buttons;
  - the Import Wizard toast;
  - the unreachable share popup;
  - the hardcoded "AI insight" / "Eye tracking: Stable" text;
  - the fake Settings save.

### New, high-impact improvements

> All six have UI built on mock data (2026-11-28). The backend tables they need are listed in each data file's header comment (`src/admin-v2/data/*.js`).

- [x] **Exam scheduling:** start and end time window plus publish status. Needed for "Upcoming Exams" and "Schedule an Exam".
- [x] **Duplicate exam.**
- [x] **Question Bank:** reusable questions across exams.
- [x] **⌘K command search** across exams, students and alerts.
- [x] **Notification inbox** behind the bell: new flags, disconnects, exams starting.
- [x] **A real Settings page:** institution name and logo, default proctoring settings, alert cooldown, admin team.
- [x] **Review Queue** (`/v2/admin/reviews`): split inbox of flagged attempts with evidence (flag breakdown, recording with markers, events) and a Clean / Suspicious / Cheating confirmed decision. J/K and 1/2/3 shortcuts, undo, and a pending badge in the sidebar. Verdicts are shared with Student Profile.
- [x] **Help & Support page:** how students join (with a copyable join link), requirements, support email, shortcuts, FAQ.

### Decided against
- **Certificates:** there is no pass mark or pass/fail anywhere in the app, and students already get an answer-sheet PDF. If it's ever needed, add an optional pass mark to the exam plus a "Download certificate" button on passing attempts, not a separate page.
- **Survey:** a form builder is a separate product. If useful later, add an optional two-question post-exam check-in (rating + "technical issues?") as an exam setting, with answers shown in Results. This also needs a student-side change.

## D. Order of work
1. Create / Edit Exam page: A1–A6, plus question IDs, a real exam code, shared defaults and Draft/Published.
2. Exam actions on the Exams page: A7–A11, plus Duplicate.
3. Settings page.
4. Small gaps: A12–A16.
5. Question Bank, then ⌘K search and the notification inbox.
6. Backend phase: wire everything with section B; fix the security items in C.
