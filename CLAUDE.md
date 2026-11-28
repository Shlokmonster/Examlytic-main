# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Examlytic is an online exam proctoring SPA (React 19 + Vite 7 + React Router 7, plain JavaScript/JSX). There is no app server of its own: the backend is Supabase (Postgres + RLS, Auth with Google OAuth, Realtime, RPCs, one Deno Edge Function). Live video goes through LiveKit, recordings upload to Cloudinary, and AI question generation uses Groq. It deploys to Netlify (`netlify.toml`, SPA redirect, camera/mic/display-capture Permissions-Policy). There is also a `vercel.json` rewrite.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # production build -> dist/
npm run lint       # eslint . (DEPLOYMENT.md expects 0 errors/0 warnings on `npx eslint src/`)
npm test           # node --test tests/**/*.test.js  (Node built-in test runner, no Jest/Vitest)

node --test tests/session-lifecycle.test.js                      # one file
node --test --test-name-pattern="expired" tests/*.test.js        # tests matching a name

supabase functions deploy rapid-task --project-ref <ref>        # deploy the LiveKit token function
```

The tests mostly **re-implement the logic they check inline** (timer math, race/lock rules, identity formats) and do not import from `src/`. Changing app code does not break them on its own, so when you change behavior they encode, such as the timer, heartbeat thresholds, LiveKit identity or submission guards, update the matching test too. `tests/security-authorization.test.js` reads `supabase/migrations/20261123_exam_security_reliability_hardening.sql` from disk and checks its contents.

Env vars (`.env`, see `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOUD_PRESET` (misspelled this way in `.env.example` and `DEPLOYMENT.md`; `src/utils/cloudinary.js` accepts both spellings), `VITE_GROQ_API_KEY`. The edge function's secrets (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, …) live in Supabase, never in the client.

## Architecture

**Routing and auth** (`src/App.jsx`, `src/context/AuthProvider.jsx`): `AuthProvider` resolves the Supabase session, then looks up the user's row in `public.users` (by id, then by email, otherwise auto-creates a `student` row). `role` (`admin` | `student`) drives `ProtectedRoute`. Admin routes are `/admin`, `/admin/monitor/:examId`, `/monitor/:examId` and `/create-exam`. The student flow is `/examcode` → `/diagnostics/:examCode` → `/exam/:id` (an `ExamStatusCheck` wrapper with nested intro/`attempt`/`blocked` routes) → `/exam/:examId/done`. `ExamActivityProvider` is mounted only for admins.

**The pages are large and hold most of the logic.** `src/Pages/ExamAttempt.jsx` (~3.4k lines: proctoring, browser lock, recording, camera, scratchpad, submit) and `src/Pages/AdminDashboard.jsx` (~2.6k lines) are where most behavior lives. `src/Components/LiveMonitoring.jsx` is the admin's LiveKit viewer.

**Server-authoritative exam lifecycle** (`src/services/examService.js`):
- The attempt state lives in `exam_attempts`, using the statuses in `EXAM_STATUS` (`in_progress`, `interrupted`, `completed`, `expired`, …). The timer is always derived from `started_at` against the exam's duration, never from client state, so a refresh resumes the same attempt.
- Every operation calls a **versioned RPC first and falls back to older RPCs or direct table writes**. Examples: `get_student_exam_questions_v1` (strips answer keys), `record_student_heartbeat_v2` → `record_student_heartbeat` → direct update, `save_student_answers_v1`, and `submit_student_exam_attempt_v1` (server-side grading, deadline, `FOR UPDATE` lock). Keep the fallbacks unless the user asks to drop them, because deployed databases may not have every migration.
- Heartbeat runs every 15s (`HEARTBEAT_INTERVAL_MS`). An attempt counts as interrupted after 45s without one.
- The migrations in `supabase/migrations/` add triggers that **block clients from writing directly** to `score`, `status`, `started_at`, `submitted_at` and `last_heartbeat_at`, and from raising their own `users.role`. They also make `exam_logs`/`exam_flags` immutable. Lifecycle changes therefore have to go through RPCs. Migrations are applied by pasting them into the Supabase SQL editor or with `supabase db push`.

**Proctoring events**: Every student activity event (TAB_SWITCH, WINDOW_BLUR, FULLSCREEN_EXIT, …) must go through `logExamEvent` in `src/services/examActivity.js`. That function retries, queues events in localStorage if inserts keep failing, holds events in memory until the attempt id exists, and must never throw or block submission. AI/webcam detections (TensorFlow.js coco-ssd/pose plus MediaPipe, which run in the browser) go to `exam_flags`. Admins receive both tables live through one Realtime channel, `admin-exam-activity` (`src/hooks/useRealtimeExamActivity.js`; setup is in `supabase/README-issue4.md`).

**Live video**: The `rapid-task` edge function (`supabase/functions/rapid-task/index.ts`) checks the caller's JWT and admin role and issues a LiveKit token. Students may only publish to their own room, and admins subscribe. The client fetches the token from `${VITE_SUPABASE_URL}/functions/v1/rapid-task`.

**Exam config storage**: `exams` has no dedicated columns for proctoring flags such as `webcam_proctoring` and `strict_tabs`. They are stored as JSON appended to `exams.instructions` after a `---CONFIG---` marker. Always use `src/utils/examConfig.js` (`serializeExamConfig`, `parseExamConfig`, `resolveExamConfigFlag`, `getDisplayInstructions`) and never parse it inline. Show candidates `getDisplayInstructions(...)`, never the raw column.

**Admin v2 (in progress on `ui-revamp`)**: A redesigned admin UI is being built next to the old one in `src/admin-v2/`, mounted at `/v2/admin/*` (`AdminV2Routes.jsx`, admin-only via `ProtectedRoute` in `App.jsx`). The old `/admin` pages stay untouched until v2 replaces them. Its rules:
- Styles are plain CSS scoped under `.admin-v2` with `v2-` class names and the CSS variables in `theme/tokens.css`. Don't add Tailwind, because its global reset would break the old app. Use only the 12 palette colors defined there; tints come from opacity variables, not new hex values. The font is Inter Tight, with the type scale in `theme/typography.css`.
- Everything is **mock data for now**. Pages read through async functions in `data/*.js`, via `useData(fetcher, ...args)`, and never hold arrays inline. Mock records use the real Supabase field names. Each data file's header comment lists the tables and RPCs it will need, so wiring the backend means replacing the function bodies.
- Shared contexts and hooks (`useToast`, `useNotifications`, `useCommandPalette`) live in their own `.js` files, separate from their provider `.jsx`, to satisfy `react-refresh/only-export-components`. The `no-unused-vars` ignore pattern `^[A-Z_]` doesn't cover destructured arguments. So write `const Icon = item.icon`, not `({ icon: Icon })`.
- Animations use only transform, opacity and color, with `cubic-bezier(0.22,1,0.36,1)`, and honor `prefers-reduced-motion`.
- `docs/ROADMAP.md` is the resume point: each page's status, the next goals in order, and the working rules agreed with the user. `docs/admin-v2/feature-gap.md` is the checklist of old-app features still to port, plus the known bugs and security issues (the Groq key in the browser, `rapid-task` auth). `docs/admin-v2/improvements/*.md` collects per-page polish deferred until the whole UI is built.

**Build quirks**: `vite.config.js` adds Node polyfills, CommonJS interop, a `global`/`process` shim and a `@tensorflow/tfjs` alias so that TF.js, PeerJS and the recording libraries bundle. Be careful when editing it.

The root-level `*_REPORT.md`, `DEPLOYMENT.md`, `ROLLBACK_GUIDE.md` and similar files are deployment runbooks and audit history. `DEPLOYMENT.md` has the full deploy sequence and the post-deploy smoke tests.
