-- Run this in the Supabase SQL editor to lock down member data.
--
-- PROBLEM: members, attendance, and chore_months had public-read RLS
-- ("using (true)"). The anon key ships in the browser bundle, so anyone could
-- bulk-dump the entire roster (every member's name + phone number) with a single
-- request and no login. For this population that is a real privacy exposure.
--
-- FIX: stop letting the browser SELECT these tables directly. Instead expose a
-- few SECURITY DEFINER functions that each return exactly ONE member (by phone or
-- id) or that member's own attendance/chores. There is no function that returns
-- the whole roster, so the bulk dump is no longer possible. The functions run as
-- their owner (postgres, the table owner) so they read live data while RLS keeps
-- the anon role locked out of the raw tables.
--
-- STILL DYNAMIC: these functions query the live tables on every call. The morning
-- sync writes with the service-role key (bypasses RLS), so a member added at
-- 7am is returned by get_member_by_phone the moment the sync finishes — nothing
-- here caches or freezes the data.
--
-- ORDERING: run this whole file, then redeploy the site (or vice-versa) close
-- together at a low-traffic moment. Between the two, the old browser code that
-- does direct SELECTs will get empty results until the new RPC-based build is live.

-- ── 1. Lookup functions (one row / one member's own data each) ────────────────
-- search_path = '' + fully-qualified names hardens these SECURITY DEFINER funcs
-- against search-path injection. Each is read-only (stable).

create or replace function public.get_member_by_phone(p_phone text)
returns setof public.members
language sql stable security definer set search_path = ''
as $$
  select * from public.members where phone = p_phone limit 1;
$$;

create or replace function public.get_member_by_id(p_id uuid)
returns setof public.members
language sql stable security definer set search_path = ''
as $$
  select * from public.members where id = p_id limit 1;
$$;

create or replace function public.get_attendance_for_member(p_member_id uuid)
returns setof public.attendance
language sql stable security definer set search_path = ''
as $$
  select * from public.attendance where member_id = p_member_id order by week_date desc;
$$;

create or replace function public.get_chore_months_for_member(p_member_id uuid)
returns setof public.chore_months
language sql stable security definer set search_path = ''
as $$
  select * from public.chore_months where member_id = p_member_id order by month asc;
$$;

-- ── 2. Grant execute only to the app roles ───────────────────────────────────
-- Revoke the implicit PUBLIC grant, then hand EXECUTE to the roles the app uses.
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.get_member_by_phone(text)',
    'public.get_member_by_id(uuid)',
    'public.get_attendance_for_member(uuid)',
    'public.get_chore_months_for_member(uuid)'
  ] loop
    execute format('revoke all on function %s from public', fn);
    execute format('grant execute on function %s to anon, authenticated, service_role', fn);
  end loop;
end $$;

-- ── 3. Remove the public-read policies so the raw tables are no longer dumpable ─
-- Drop EVERY existing policy on these tables by name (names varied across the
-- original migrations), then make sure RLS stays ON. RLS enabled + no policy =
-- the anon role can read nothing directly; only the functions above can.
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('members', 'attendance', 'chore_months')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.members      enable row level security;
alter table public.attendance   enable row level security;
alter table public.chore_months enable row level security;

-- ── 4. Verify (optional) ──────────────────────────────────────────────────────
-- After running, this should return one row (proves the function path works):
--   select full_name, circle_day from public.get_member_by_phone('4085804922');
-- And this should return ZERO rows when run as the anon role (proves the dump is
-- closed). In the SQL editor you run as postgres, so to truly confirm, hit the
-- REST API with the anon key:  GET /rest/v1/members  -> should be [] / 401-ish.
