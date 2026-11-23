# EXAMLYTIC — PRODUCTION RELIABILITY IMPLEMENTATION CHECKLIST

**Implementation Branch:** `reliability-improvements`  
**Status:** Phase 0 Complete — Ready for Phase 1

---

## Phase 0: Baseline, Backup & Validation
- [x] Inspect Git status and commit history (`a18106fa`)
- [x] Create dedicated branch `reliability-improvements`
- [x] Verify live Supabase database schema and RLS policies
- [x] Validate and trace all P0 and P1 audit findings
- [x] Create `BASELINE.md`
- [x] Create `DATABASE_SCHEMA_AUDIT.md`
- [x] Create `VALIDATION_REPORT.md`
- [x] Create `IMPLEMENTATION_CHECKLIST.md`

---

## Phase 1: Critical Bug Fixes (P0)
- [ ] **1.1 LiveKit localStorage Quota Crash:** Remove Base64 video storage in `LiveMonitoring.jsx`
- [ ] **1.2 LiveKit Participant Identity:** Implement `student:::{attemptId}:::{studentId}` in Edge Function and frontend
- [ ] **1.3 Invalid Fallback URL:** Remove `wss://0.peerjs.com` and validate `LIVEKIT_URL`
- [ ] **1.4 Event Logging:** Ensure `exam_attempt_id` is populated in all `exam_logs` inserts
- [ ] **1.5 Authentication & Routing:** Remove unconditional `signOut()` on login mount and fix broken redirects

---

## Phase 2: Examination Session Management (P0/P1)
- [ ] **2.1 Explicit States:** Support `in_progress`, `interrupted`, `completed`, `expired`, `terminated`
- [ ] **2.2 Session Initialization:** Establish authoritative `started_at` and `expires_at` on attempt creation
- [ ] **2.3 Server-Authoritative Timer:** Restore true elapsed time on refresh/reconnection
- [ ] **2.4 Expiration Handling:** Mark expired attempts and lock further answer modifications

---

## Phase 3: Heartbeat & Connection Reliability (P1)
- [ ] **3.1 Heartbeat Hook:** Implement 15-second heartbeat ping updating `last_heartbeat_at`
- [ ] **3.2 Disconnection Threshold:** Mark sessions `interrupted` after 45s without pings (no premature misconduct penalty)
- [ ] **3.3 Reconnection Flow:** Seamlessly resume active session and restore answers upon reconnection

---

## Phase 4: LiveKit Reliability & Track State (P1)
- [ ] **4.1 Separate Stream State:** Track `STREAM_NOT_STARTED`, `STREAM_CONNECTED`, `STREAM_RECONNECTING`, `STREAM_DISCONNECTED`
- [ ] **4.2 Publisher Isolation:** Grant student publisher `canSubscribe: false` to prevent cross-student track pulling
- [ ] **4.3 Controlled Reconnection:** Prevent infinite loop screen share permission prompts

---

## Phase 5: Individual Student Logs & Audit History (P1)
- [ ] **5.1 Data Association:** Link all events to `exam_attempt_id`, `exam_id`, and `student_id`
- [ ] **5.2 Chronological Timeline:** Build reusable timeline component rendering verified proctoring events
- [ ] **5.3 Historical Log Migration Script:** Prepare non-destructive SQL backfill for existing records

---

## Phase 6: Database Hardening & Migrations (P1)
- [ ] **6.1 Migration Script:** Versioned SQL adding `started_at`, `status`, `last_heartbeat_at`, `stream_status`
- [ ] **6.2 Indexes:** Add indexes on `(exam_id, status)` and `(exam_attempt_id)`
- [ ] **6.3 Heartbeat RPC:** Add atomic `record_student_heartbeat` stored procedure

---

## Phase 7: Submission & Recording Reliability (P1)
- [ ] **7.1 Non-Blocking Submission:** Commit answers to Supabase first before initiating video upload
- [ ] **7.2 Background Video Upload:** Handle Cloudinary upload with retry states (`pending`, `uploading`, `uploaded`, `failed`)

---

## Phase 8: Performance Optimization (P2)
- [ ] **8.1 Throttle MediaPipe:** Reduce face detection loop from 60 FPS to 2–3 Hz
- [ ] **8.2 Admin Query Optimization:** Replace 10-second polling storm with Realtime subscriptions and targeted queries

---

## Phase 9: Admin Dashboard Redesign (P2/P3)
- [ ] **9.1 Reorganized Tabs:** Overview, Active, Interrupted, Completed, Expired, Student Logs
- [ ] **9.2 Active Examination Monitoring Cards:** Real-time WebRTC streams, timers, heartbeats, and status badges
- [ ] **9.3 Student Detail Inspector:** Comprehensive per-student timeline and proctoring log drawer

---

## Phase 10: End-to-End Verification (P0/P1)
- [ ] Verify Scenario 1 through Scenario 12
- [ ] Verify zero regressions in existing workflows

---

## Phase 11: Final Acceptance & Documentation (P0)
- [ ] Generate comprehensive implementation and rollback reports
