# Issue #4 — Supabase Realtime setup

The admin live activity pipeline uses **one** Realtime channel
(`admin-exam-activity`) subscribing to INSERT on:

| Table        | Purpose                                        |
| ------------ | ---------------------------------------------- |
| `exam_logs`  | student activity (`TAB_SWITCH`, `WINDOW_BLUR`, …) |
| `exam_flags` | AI / webcam proctoring flags                   |

## 1. Apply the migration

Run:

```bash
supabase db push          # if you use the Supabase CLI with linked project
# or paste the SQL from migrations/20260922000000_issue4_realtime_exam_activity.sql
# into the Supabase SQL editor
```

Or enable Realtime manually in the dashboard:
**Database → Replication → supabase_realtime → add `exam_logs` and `exam_flags`.**

Verify:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('exam_logs', 'exam_flags');
```

Both rows must be present.

## 2. RLS

Realtime respects RLS. The tables must already have:

* students → `INSERT` own rows (`student_id = auth.uid()` / `user_id = auth.uid()`)
* students → `SELECT` own rows
* admins → `SELECT` all rows (via `users.role = 'admin'`)
* no `UPDATE` / `DELETE` for students

If those policies already exist (the admin dashboard and student exam flow
already read/write these tables), **no RLS change is required**. Do not
disable RLS and do not use `using (true)`.

## 3. Client

No new environment variables are needed — the app reuses
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` via `src/SupabaseClient.js`.
Realtime works over the existing authenticated session; the service-role key
is never used in the browser.
