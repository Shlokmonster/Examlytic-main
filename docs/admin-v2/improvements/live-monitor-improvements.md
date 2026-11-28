# Live Monitor: improvements backlog

These are changes to make to the admin v2 Live Monitor page **after the whole admin UI is built**.

- **Page:** `/v2/admin/live-monitor` (`src/admin-v2/pages/LiveMonitor.jsx`, sections in `src/admin-v2/pages/live-monitor/`)
- **Status:** UI built with mock data. Video tiles are placeholders and alerts are simulated by `subscribeMockAlerts` in `src/admin-v2/data/liveMonitor.js`.

## UI improvements

_None requested yet._

## Animation improvements

_None requested yet._

## Backend work needed before this page is real (found while planning, 2026-11-28)

- [ ] **Security: `rapid-task` gives viewer tokens without login.** In `supabase/functions/rapid-task/index.ts` (~line 68), the admin check only runs when a logged-in user is found. A request with no login or only the anon key still gets a subscriber token for any exam room.
  - It also doesn't check that a *student* publishes only into their own exam room, under their own identity.
  - **Fix before go-live:** require a valid user JWT for every token, require `role = 'admin'` for subscriber tokens, and check attempt ownership for publisher tokens.
- [ ] **Admin actions don't exist on the server.** There is no RPC for Warn, Message, Flag for review or Terminate / force-submit, no messages table, and `ExamAttempt.jsx` doesn't listen for any of these.
  - Add audited RPCs, for example `admin_terminate_attempt_v1` and `admin_warn_student_v1`.
  - Add a channel or table the student page subscribes to, so warnings and termination show up for the student.
- [ ] **Session status isn't live.** `exam_attempts` isn't in the Supabase Realtime publication, so connection status (connected / reconnecting / submitted) only updates by polling. Add it to `supabase_realtime`, or derive status from heartbeats.
- [ ] **The realtime alerts channel isn't filtered by exam.** `useRealtimeExamActivity` subscribes to every `exam_logs` / `exam_flags` insert in the database. Filter by `exam_id` for this page.
- [ ] **Show both video tracks.** The old viewer (`src/Components/LiveMonitoring.jsx`) keys tiles by student, so the screen share overwrites the camera. Key by identity plus track name: show the webcam in the tile and the camera plus screen in the Focus panel.
- [ ] **Bandwidth:** subscribe to low-quality webcam for tiles, and to the screen-share track only while the Focus panel is open.
- [ ] **Student identity fallback:** `ExamAttempt.jsx` can publish as `student___attempt___unknown` before IDs load. Wait for real IDs before joining the room.

## Done

_None yet._
