# Automated Roster Sync — Setup Guide

The app reads member data from Supabase. Supabase is filled from the live Google
Sheet by `scripts/syncSheet.js`. This guide sets that sync up to run **automatically
once a day** via GitHub Actions, with no manual steps once it's configured.

- **Schedule:** daily at 12:00 UTC (5:00 AM PDT / 4:00 AM PST) — see `.github/workflows/sync-roster.yml`
- **Auth:** a Google **service account** (a robot login that never expires), not your personal Google account
- **Manual run:** any time, from the repo's **Actions** tab → *Sync roster* → *Run workflow*

You only have to do the one-time setup below once.

---

## Step 1 — Create a Google service account

1. Go to <https://console.cloud.google.com/> and pick the project that already has the
   Sheets/Calendar API enabled (the same one your OAuth client lives in).
2. Make sure the **Google Sheets API** is enabled:
   *APIs & Services → Library → search "Google Sheets API" → Enable*.
3. Create the account: *APIs & Services → Credentials → Create credentials →
   Service account*. Name it e.g. `roster-sync`. Skip the optional role/grants steps → **Done**.
4. Open the new service account → **Keys** tab → *Add key → Create new key → JSON*.
   A `.json` file downloads. **Keep it secret** — it's a password.
5. Open that JSON file and copy the `client_email` value. It looks like
   `roster-sync@your-project.iam.gserviceaccount.com`.

## Step 2 — Share the roster Sheet with the service account

1. Open the live roster Google Sheet.
2. Click **Share**, paste the service account's `client_email`, set it to **Viewer**,
   untick "Notify people", and **Send**.

That's it — the robot can now read the sheet. (If you later use the Calendar sync too,
share the calendars with the same email.)

## Step 3 — Add the secrets to GitHub

In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**.
Add each of these:

| Secret name | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | The **entire contents** of the service-account JSON file (open it, copy all, paste) |
| `GOOGLE_SHEET_ID` | The sheet ID from its URL (`.../spreadsheets/d/`**`THIS_PART`**`/edit`) |
| `VITE_SUPABASE_URL` | Same as in your `.env` |
| `VITE_SUPABASE_ANON_KEY` | Same as in your `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (Supabase dashboard → Project Settings → API). Needed so the sync can write past row-level security. |

## Step 4 — Test it

1. Push this branch / merge to `main` so the workflow file is on GitHub.
2. Go to the **Actions** tab → **Sync roster** → **Run workflow** → run it on `main`.
3. Watch the run. The **Run roster sync** step logs every member upserted and a summary.
   If any members couldn't be matched, a **skip-report** artifact appears at the bottom
   of the run (downloadable, contains real names — don't forward it around).

Once that green check appears, you're done. It will run on its own every morning, and
you can re-run it by hand any time from the Actions tab.

---

## Local use (optional)

The script still works on your PC:

- `node scripts/syncSheet.js --fake` — dry run, no credentials.
- `node scripts/syncSheet.js` — real sync. It now uses, in order of preference:
  1. `GOOGLE_SERVICE_ACCOUNT_KEY` env var (full JSON), then
  2. a `google-credentials.json` file in the project root (already git-ignored), then
  3. the old interactive personal-OAuth browser flow.

To run unattended locally with the service account, just drop the downloaded key file in
the project root as `google-credentials.json`.

## When a member changes their phone number

The sync identifies members by their **Agency client_id**, not by phone. When someone
shows up in the sheet with a new number, the number is moved onto their existing row, so
their badges and attendance history follow them. The summary reports this as
`Phone changes: N — number moved onto their existing row, history preserved`.

Two cases the sync will not resolve on its own:

- **`PHONE CHANGE REFUSED`** — the new number is already listed against a *different*
  member. Moving it would hand one member another member's history, so the sync refuses.
  Fix the duplicate number in the staff sheet and the next run sorts itself out.
- **`SPLIT ROWS`** — a member who was already broken into two rows by the older
  phone-keyed sync, before this fix existed. Repair them with a one-time run:

  ```
  node scripts/syncSheet.js --heal-splits
  ```

  This merges the chore history onto the older row (keeping the higher count for any
  month that appears twice), then deletes the leftover row. It deletes data, so it is
  never part of the daily scheduled run — the daily sync only reports the split.

## Changing the schedule

Edit the `cron:` line in `.github/workflows/sync-roster.yml`. Remember it's **UTC** and
ignores daylight saving. Examples:

- Twice a day (≈5 AM + noon PT): two lines —
  `- cron: '0 12 * * *'` and `- cron: '0 19 * * *'`
- Every 3 hours, around the clock: `- cron: '0 */3 * * *'`
