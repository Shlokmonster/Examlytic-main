-- ============================================================================
-- Issue #4 — Enable Supabase Realtime for exam activity tables
-- ----------------------------------------------------------------------------
-- The admin dashboard subscribes to INSERT events on:
--   public.exam_logs   (student activity: TAB_SWITCH, WINDOW_BLUR, ...)
--   public.exam_flags  (AI/webcam proctoring flags)
--
-- Realtime only broadcasts changes for tables that are members of the
-- `supabase_realtime` publication. This migration adds them idempotently.
--
-- It does NOT touch RLS. Existing policies are reused: the admin already
-- SELECTs these rows through PostgREST, and Realtime delivers each row only
-- when the subscribing user's SELECT policy allows it. Do not weaken RLS.
-- ============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'exam_logs'
    ) then
      alter publication supabase_realtime add table public.exam_logs;
      raise notice 'Added public.exam_logs to supabase_realtime';
    else
      raise notice 'public.exam_logs already in supabase_realtime';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'exam_flags'
    ) then
      alter publication supabase_realtime add table public.exam_flags;
      raise notice 'Added public.exam_flags to supabase_realtime';
    else
      raise notice 'public.exam_flags already in supabase_realtime';
    end if;

  else
    raise notice 'supabase_realtime publication not found — enable Realtime in the Supabase dashboard instead.';
  end if;
end $$;

-- ============================================================================
-- RLS (verify only — apply manually if these policies do not already exist)
-- ----------------------------------------------------------------------------
-- Realtime honors RLS for the subscribing user, so the admin must be able to
-- SELECT the rows. Recommended ownership model:
--
--   exam_logs / exam_flags
--     - INSERT: authenticated student, own rows only (student_id = auth.uid()
--               for exam_logs; user_id = auth.uid() for exam_flags)
--     - SELECT: own rows only for students
--     - SELECT: all rows for admins, via users.role = 'admin'
--     - UPDATE / DELETE: denied
--
-- Example (adjust to match this project's existing helper functions/roles):
--
--   create policy "exam_logs_insert_own" on public.exam_logs
--     for insert to authenticated
--     with check (student_id = auth.uid());
--
--   create policy "exam_logs_select_own_or_admin" on public.exam_logs
--     for select to authenticated
--     using (
--       student_id = auth.uid()
--       or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
--     );
--
--   create policy "exam_flags_insert_own" on public.exam_flags
--     for insert to authenticated
--     with check (user_id = auth.uid());
--
--   create policy "exam_flags_select_own_or_admin" on public.exam_flags
--     for select to authenticated
--     using (
--       user_id = auth.uid()
--       or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
--     );
--
-- Do NOT use `using (true)` — that would expose every student's activity to
-- every authenticated user.
-- ============================================================================
