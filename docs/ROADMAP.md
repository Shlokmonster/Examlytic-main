# Examlytic roadmap

The single place to pick work back up. Last updated **2026-11-28**.
Branch: `ui-revamp`. Detailed checklists live in `docs/admin-v2/`.

---

## Where things stand

### Admin v2 UI: built (mock data), at `/v2/admin/*` (`src/admin-v2/`)
| Page | Route | User-approved? |
|---|---|---|
| Sidebar + Dashboard | `/v2/admin` | ✅ |
| Exams (cards/list, status, lock, duplicate, delete, copy code) | `/v2/admin/exams` | ✅ (page) · ⏳ (new actions) |
| Exam Builder (3-pane, AI generate, JSON import, from bank) | `/v2/admin/exams/new`, `/exams/:id/edit` | ⏳ |
| Results & Analytics | `/v2/admin/results` | ⏳ |
| Students | `/v2/admin/students` | ⏳ |
| Student Profile (recording player, attempt review, PDFs) | `/v2/admin/students/:id` | ⏳ |
| Live Monitor | `/v2/admin/live-monitor` | ⏳ |
| Question Bank | `/v2/admin/question-bank` | ⏳ |
| Settings | `/v2/admin/settings` | ⏳ |
| Review Queue | `/v2/admin/reviews` | ✅ |
| Help & Support | `/v2/admin/help` | ✅ |
| Notification bell, ⌘K search (global) | n/a | ⏳ |

✅ = user tested and approved · ⏳ = waiting for the user's manual test ("good / needs fixes" + improvements to note)

**Decided against:** Certificates and Survey pages (reasons in `docs/admin-v2/feature-gap.md` → "Decided against").

---

## Next goals, in order

### 0. Landing page ← current focus
- No landing page exists today. `/` redirects logged-out users to `/login`. `src/Pages/homepage.jsx` exists but no route uses it.
- To decide first:
  - a reference image, or layout proposals to choose from;
  - which sections it has;
  - whether it uses the admin v2 design system (Inter Tight and the 12 colors);
  - where the CTAs go (sign in, and enter exam code for students);
  - the route change in `src/App.jsx`: `/` shows the landing page for logged-out visitors, and logged-in users still redirect.

### 1. Commit and push the v2 work
Nothing in `src/admin-v2/`, `docs/` or `CLAUDE.md` has been committed yet.

### 2. Finish the reviews of built pages
For each ⏳ page above: get "good" or "fix" from the user, then save the improvements to `docs/admin-v2/improvements/<page>-improvements.md`. No notes file exists yet for:
- results
- students
- exam-builder
- question-bank
- settings

### 3. Small gaps from the old app (`feature-gap.md` A12–A16)
- [ ] Realtime connection badge (Live / Reconnecting / Offline) on the Dashboard and Live Monitor headers
- [ ] "Expired" tab in Live Monitor
- [ ] "Recent alerts" card on the Dashboard
- [ ] Timeline search and detected object names (e.g. "cell phone"). Consider the ReUI timeline (`docs/admin-v2/references-to-try.md`).
- [ ] "Download recording" button in Attempt Review (old `src/Components/StudentRecordings.jsx:244-277`)

### 4. Improvements pass
Do everything in `docs/admin-v2/improvements/*.md`. The biggest items:
- smooth Dashboard live-exam carousel;
- stop the cards below it from flickering;
- smooth chart hover and marker animation.

### 5. Backend phase
- **Replace the mock data with Supabase.** Each `src/admin-v2/data/*.js` header lists the tables and RPCs it needs, and the mock fields use the real column names. Reuse the old code listed in `feature-gap.md` §B:
  - `groqService`
  - `examConfig`
  - the PDF logic
  - `useRealtimeExamActivity`
  - `fetchLiveKitToken`
  - the interrupted/expired grouping
- **Security, before go-live:**
  - [ ] `rapid-task` edge function: issues LiveKit tokens without a proper auth check.
  - [ ] `VITE_GROQ_API_KEY` is exposed in the browser. Move AI generation into an edge function.
- **New DB columns and tables** (as migrations in `supabase/migrations/`):
  - exams: `status`, `start_at` / `end_at`, `code`;
  - question bank table;
  - `workspace_settings` and `admin_members`;
  - `attempt_reviews` (attempt_id, status, note, reviewer_id, decided_at);
  - `users.class_name` and `roll_no`;
  - notification read state.
- **Rules to keep:** RPC-first with fallbacks, and lifecycle writes only through RPCs (see `CLAUDE.md`).

### 6. Switchover
Point `/admin` to v2, delete the old admin files (`AdminDashboard.jsx`, `CreateExam.jsx` and the admin-only components), then merge `ui-revamp` → `main`.

---

## Working rules (agreed with the user)
- **Design system (locked):**
  - Inter Tight 400/500/600.
  - Type: H1 32/500, H2 24/500, H3 17/600, Body 16/400, 14/500, 12/500.
  - **Only 12 colors:** #174E4F primary; #FFFFFF, #F3F4F6, #E5E7EB, #D1D5DC, #99A1AF, #6A7282, #000000; #00A63E success, #FCC800 warning, #E7000B danger. Tints come only from their opacity.
  - Grid: 1440 width, 252px sidebar, 12 cols × 75px, 24px gutters. Light theme only.
- **Per page:**
  - ask for a reference image and copy it pixel for pixel; with no reference, offer layout proposals to pick from;
  - the user tests manually, so don't browser-test or screenshot;
  - after each page, give the localhost link and ask "good, or needs fixes?" plus which improvements to note.
- **Improvements are recorded per page** and implemented only after the whole UI is built.
- **Product feel:** professional SaaS. Few features, but each one impactful. Don't add pages just to fill the menu.
- **Commits:** only when the user says so.
