-- Run this in the Supabase SQL editor to create the chore_months table.
--
-- chore_months is the durable monthly chore history that powers the Badges
-- feature. The members.chores_done column only holds the *current* month (it
-- resets with the staff sheet), so without this snapshot badges would disappear
-- every month. The sync script (scripts/syncSheet.js) upserts one row per member
-- per calendar month on each run.

create table if not exists chore_months (
  id          uuid    primary key default gen_random_uuid(),
  member_id   uuid    not null references members (id) on delete cascade,
  month       text    not null,             -- 'YYYY-MM', e.g. '2026-06'
  chores_done integer not null default 0,
  updated_at  timestamptz not null default now(),
  -- One snapshot per member per month. The sync upserts on this key, so re-runs
  -- overwrite the current month's count rather than inserting duplicates.
  unique (member_id, month)
);

-- Badges read every month for a member, ordered by month.
create index if not exists chore_months_member_idx
  on chore_months (member_id, month);

-- The browser reads this table with the anon key (read-only badge display),
-- mirroring how members/attendance are read. The sync writes with the service
-- role key, which bypasses RLS.
alter table chore_months enable row level security;

-- Public read-only access for the app. (No insert/update/delete policy — writes
-- only happen via the service role key in the sync script.)
drop policy if exists "chore_months public read" on chore_months;
create policy "chore_months public read"
  on chore_months for select
  using (true);
