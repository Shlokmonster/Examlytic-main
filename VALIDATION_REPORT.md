# EXAMLYTIC — RUNTIME AUDIT VALIDATION REPORT

**Validation Date:** 2026-11-23  
**Status:** All findings formally verified against source code and runtime traces

---

## 1. Findings Matrix

| Finding | Description | File & Lines | Severity | Classification | Validation Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-01** | Timer resets to full duration on refresh | `src/Pages/ExamAttempt.jsx#L960` | P0 | **CONFIRMED** | `setTimeLeft((examData.duration_minutes || 90) * 60)` executes unconditionally upon loading attempt. Database lacks `started_at`. |
| **F-02** | LocalStorage Quota Exhaustion | `src/Components/LiveMonitoring.jsx#L28-L57` | P0 | **CONFIRMED** | Video chunks converted to Base64 and saved to `localStorage` every 5 seconds. Quota exceeded error is guaranteed. |
| **F-03** | UUID Truncation in LiveKit Identity | `src/Components/LiveMonitoring.jsx#L362` | P0 | **CONFIRMED** | `participant.identity.split('-')[1]` splits on hyphens. A 36-char UUID `c83a1d9b-4e89-...` yields `c83a1d9b`, breaking student lookups. |
| **F-04** | Broken PeerJS Fallback URL | `src/Components/LiveMonitoring.jsx#L389`<br>`src/Pages/ExamAttempt.jsx#L631` | P0 | **CONFIRMED** | LiveKit client calls `room.connect(url || 'wss://0.peerjs.com', token)`. Connecting LiveKit SDK to PeerJS server causes immediate protocol failure. |
| **F-05** | Missing `exam_attempt_id` in logs | `src/Pages/ExamAttempt.jsx#L1095, L1126` | P1 | **CONFIRMED** | `logExamEvent` explicitly inserts `exam_attempt_id: null`. When admin selects an attempt to view logs, query returns 0 rows. |
| **F-06** | Dashboard 10-second 7-table polling | `src/Pages/AdminDashboard.jsx#L575-L736` | P1 | **CONFIRMED** | `setInterval(loadDashboardData, 10000)` fires 7 unindexed, unpaginated queries on every interval, stressing database. |
| **F-07** | Unthrottled 60 FPS Face Detection | `src/Pages/ExamAttempt.jsx#L304, L439` | P1 | **CONFIRMED** | MediaPipe FaceLandmarker runs in `requestAnimationFrame` loop without throttling, causing high CPU/GPU utilization and frame drops. |
| **F-08** | Synchronous Video Upload Submission | `src/Pages/ExamAttempt.jsx#L1528-L1549` | P1 | **CONFIRMED** | Submit button awaits Cloudinary upload of 200MB–600MB video blob before persisting answers. Network drops during upload risk answer loss. |
| **F-09** | Unconditional `signOut()` on Login Mount | `src/Pages/Login.jsx#L12` | P2 | **CONFIRMED** | `await supabase.auth.signOut()` executes on mount. Any unexpected navigation to `/login` destroys active session. |
| **F-10** | Non-existent `/exam/intro` Route | `src/Components/ExamStatusCheck.jsx#L67`<br>`src/Pages/ExamRedirect.jsx#L19` | P2 | **CONFIRMED** | Navigation to `/exam/intro` hits wildcard redirect loop because route does not exist in `App.jsx`. |

---

## 2. Execution Trace Summary

1. **Timer Persistence:** The client cannot compute remaining time without an authoritative `started_at` in `exam_attempts`. Adding `started_at` and deriving `timeLeft = max(0, duration_seconds - (now - started_at))` fully resolves F-01.
2. **LocalStorage Cleanup:** Removing `saveStreamToLocalStorage()` and the `localStorage.setItem('studentRecordings')` calls from `LiveMonitoring.jsx` completely eliminates F-02 with zero impact on the Cloudinary recording workflow.
3. **Identity Token Standard:** Changing the identity format in `supabase/functions/rapid-task/index.ts` and `ExamAttempt.jsx` to `student:::{attemptId}:::{studentId}` eliminates F-03.
4. **Logging Fix:** Setting `exam_attempt_id: examAttemptId` in `ExamAttempt.jsx` directly resolves F-05, populating the per-student logs view in the Admin Dashboard.

