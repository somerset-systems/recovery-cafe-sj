-- Run this in the Supabase SQL editor to let staff into the app in preview mode.
--
-- WHY A SEPARATE TABLE: staff are not members. Putting a staff phone number in the
-- members table would (a) make them indistinguishable from real members, (b) get their
-- row overwritten or reported as a skip by the nightly roster sync, which only knows
-- about people in the staff Google Sheet, and (c) hand a staff login the same data path
-- real members use. Keeping them in their own table means the roster sync never touches
-- them and the members table stays exactly what it says it is.
--
-- WHAT A STAFF LOGIN CAN SEE: nothing private. The app puts a staff session into a
-- preview mode that renders a hard-coded sample member bundled in the JavaScript — the
-- get_member_* RPCs are never called for a staff session, so there is no request a staff
-- login could make that returns a real member's name, phone, circle, or attendance. The
-- only live data on their screen is the events calendar, which is already public.

create table if not exists staff (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  phone      text not null unique,          -- 10 digits, no dashes (same format as members.phone)
  created_at timestamptz not null default now()
);

-- ── Lookup function ───────────────────────────────────────────────────────────
-- Mirrors get_member_by_phone: SECURITY DEFINER, returns at most ONE row, and there is
-- deliberately no function that lists the whole staff table. search_path = '' plus fully
-- qualified names hardens it against search-path injection.
--
-- Returns only the fields the app needs to greet them. It does NOT return the phone
-- column, so a staff login cannot be used to read back staff phone numbers either.
create or replace function public.get_staff_by_phone(p_phone text)
returns table (id uuid, full_name text)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.full_name from public.staff s where s.phone = p_phone limit 1;
$$;

revoke all on function public.get_staff_by_phone(text) from public;
grant execute on function public.get_staff_by_phone(text) to anon, authenticated, service_role;

-- ── Lock the raw table ────────────────────────────────────────────────────────
-- RLS on with no policy = the anon key cannot read the staff table directly. Only the
-- one-row function above can, exactly as with members.
alter table staff enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'staff'
  loop
    execute format('drop policy if exists %I on public.staff', r.policyname);
  end loop;
end $$;

-- ── Staff list ────────────────────────────────────────────────────────────────
-- Phone numbers are stored as 10 digits, no dashes, no +1 — same format as members.phone,
-- because login normalizes whatever is typed and looks it up as 10 digits.
-- (Frank's number was given as 610-357-7412; dashes stripped to match.)
--
-- Re-running this file is safe: on conflict the name is refreshed rather than duplicated.

insert into staff (full_name, phone) values
  ('Tommy Ankenbrandt', '3035494456'),
  ('Julie Anderson',   '7209854555'),
  ('Dell Qualls',      '4045181630'),
  ('Elena Ajluni',     '4087713606'),
  ('Emily Kent',       '4084383980'),
  ('Tanya Bautista',   '4086212916'),
  ('Chris Ferry',      '4088868058'),
  ('Frank San Miguel', '6103577412')
on conflict (phone) do update set full_name = excluded.full_name;

-- NOT YET ADDED — no phone number on file. Add a row for each once you have their
-- number, then re-run this file:
--   Chris Caruso
--   Emma Nguyen
--   Maggie Handyside

-- ── Verify ────────────────────────────────────────────────────────────────────
-- Should return one row per staff member you added:
--   select full_name from public.staff order by full_name;
-- Should return that person (proves the login path works):
--   select * from public.get_staff_by_phone('4085551234');
