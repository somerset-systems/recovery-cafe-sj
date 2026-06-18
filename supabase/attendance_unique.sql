-- Run this in the Supabase SQL editor BEFORE the next sync after upgrading
-- syncSheet.js to the non-destructive (upsert) attendance write.
--
-- Why: the sync now upserts attendance on (member_id, week_date) instead of
-- deleting and re-inserting. That makes Supabase the permanent record — weeks
-- that roll off the roster sheet next year are kept, so lifetime counters like
-- "100 Circles" keep accumulating. Upsert needs a unique key to conflict on.

-- 1. Safety: remove any accidental duplicate (member_id, week_date) rows first,
--    keeping one arbitrary row per pair. (ctid is Postgres's internal row id.)
delete from attendance a
using attendance b
where a.member_id = b.member_id
  and a.week_date = b.week_date
  and a.ctid < b.ctid;

-- 2. Add the unique constraint the upsert conflicts on. Drop-then-add makes this
--    script safely re-runnable; on a fresh table the drop is a no-op.
alter table attendance drop constraint if exists attendance_member_week_unique;
alter table attendance add constraint attendance_member_week_unique
  unique (member_id, week_date);
