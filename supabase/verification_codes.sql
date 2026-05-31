-- Run this in the Supabase SQL editor to create the verification_codes table.

create table if not exists verification_codes (
  id         uuid        primary key default gen_random_uuid(),
  phone      text        not null,
  code       text        not null,
  expires_at timestamptz not null,
  used       boolean     not null default false,
  created_at timestamptz not null default now()
);

-- Fast lookup by phone + validity
create index if not exists verification_codes_phone_idx
  on verification_codes (phone, used, expires_at);

-- Functions access this table via the service role key which bypasses RLS.
-- Enable RLS so the anon key cannot read codes directly from the browser.
alter table verification_codes enable row level security;
-- No public policies — all access goes through the server-side functions.

-- Optional: auto-delete expired codes older than 1 hour to keep the table tidy.
-- (Run manually or set up a pg_cron job if available on your plan.)
-- delete from verification_codes where expires_at < now() - interval '1 hour';
