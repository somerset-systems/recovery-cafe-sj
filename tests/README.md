# Tests

Two test layers:

- **Unit tests** (Vitest) — `tests/unit/` — pure-function tests, no browser.
- **End-to-end tests** (Playwright) — `tests/e2e/` — drive the real app in a headless mobile-sized browser.

Both run against the app's **fake-data mode**, which is active whenever
`VITE_SUPABASE_URL` is unset (see `src/lib/supabase.js`). Seed data lives in
`src/lib/fakeData.js`. No Supabase, Google, or Twilio credentials are needed.

## Unit tests

```bash
npm test          # run once
npm run test:watch  # watch mode
```

Coverage today is `src/lib/parseCircleLabel.js`. The spec asserts the parser's
**current** behavior and documents known gaps. A `describe.skip(...)` block at
the bottom of `tests/unit/parseCircleLabel.test.js` describes the desired
graceful-degradation behavior; the parser-hardening agent should un-skip those
and remove the matching entries from the "KNOWN GAPS" block as it fixes them.

## End-to-end tests

```bash
npm run test:e2e
```

Playwright **starts the Vite dev server itself** (on port 5299, matching
`scripts/screenshot.mjs`) via the `webServer` block in `playwright.config.js`,
so you do **not** need a server running first. If you already have a dev server
on 5299, Playwright reuses it.

First-time setup (one download of the browser binary):

```bash
npx playwright install chromium
```

Useful variations:

```bash
npx playwright test --reporter=line   # concise output
npx playwright test --headed          # watch it run in a real window
npx playwright test --ui              # interactive runner
```

### Note on `/api` proxy errors during E2E

The console will show `http proxy error: /api/events (ECONNREFUSED)`. This is
expected: the events/calendar API (`npm run dev:api`) is intentionally not
running. The app degrades gracefully — pages still render — so the tests pass.

## What E2E covers (from the CLAUDE.md Testing Checklist)

- Login with a seeded phone number reaches Home (full two-phase UI flow:
  phone + SMS-consent checkbox -> 6-digit code `123456`).
- Login with an unknown number shows the friendly error and does not advance.
- Home renders all three cards (Circle, Chores, Coming Up).
- All five bottom-nav tabs navigate to the right routes.
- Circle tab shows the parsed day / time / leader.
- Chores celebration appears at 3 of 3; non-celebration message at 0.
- Sign out clears `localStorage` and returns to login.
- Visiting a protected route without a session redirects to login.

## Not automated (and why)

- **Chores celebration *animation*** — Playwright asserts the celebration
  *state* (✓ + "Amazing! ..." message) but not the 0.8s ring-fill CSS
  transition; verifying motion timing is brittle and low-value.
- **Pixel-level visual / 390px layout correctness** — best confirmed with
  `scripts/screenshot.mjs`; the E2E viewport is set to 390px but no visual
  snapshots are taken.
- **Events in correct date order** — Events depend on the live `/api/events`
  calendar feed, which is not running in fake mode (the fake `events` table in
  `fakeData.js` is not wired into `fetchAllEvents`), so order can't be asserted
  deterministically here.
- **Real Supabase / SMS paths** — out of scope; the app runs in fake mode and
  Twilio is disabled (`SMS_ENABLED = false`).
