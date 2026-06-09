# Recovery Cafe San Jose — Member App
## Claude Code Development Guide

---

## What This App Is

A simple browser-based app for members of Recovery Cafe San Jose. Members are people recovering from addiction, homelessness, and mental health challenges. Many are not tech-savvy. The app must be extremely simple, large text, high contrast, and forgiving of mistakes.

The app shows each member:
- Their recovery circle (who, when, where)
- Their chore progress this month (number toward a goal of 3)
- Upcoming events at the cafe
- Their attendance record for their circle this month

Members cannot input anything except their phone number to log in. Everything else is read-only. Staff control all data via a Google Sheet.

---

## Absolute Design Rules

- **Large text everywhere.** Minimum 15px body, 20px+ for important info.
- **High contrast.** Dark text on light backgrounds only.
- **One thing per screen.** No clutter, no nested menus, no modals stacked on modals.
- **No jargon.** Plain English only. "Your Circle" not "Recovery Circle Assignment."
- **Green and cream color scheme.** Primary green: #2D6A4F. Accent green: #52B788. Background: #F8F4EF. Cards: white.
- **Big tap targets.** All buttons minimum 48px height. Nothing small to tap.
- **No passwords.** Ever. Login is phone number only.
- **Read-only for members.** Members never submit, edit, or delete anything.
- **Celebratory moment when chores hit 3.** Animate the progress ring green, show a congratulations message. This is important and meaningful for this population.

---

## Tech Stack

- **Frontend:** React (Vite)
- **Styling:** Inline styles + CSS variables. No Tailwind. No component libraries.
- **Backend/DB:** Supabase (auth + database)
- **Data source:** Google Sheets API (OAuth, personal Google account for dev)
- **SMS:** Twilio — NOT YET. Skip for now. Login is phone number lookup only, no verification code.
- **Hosting:** Local only for now (Vite dev server). Vercel later.
- **Language:** JavaScript/JSX throughout. No TypeScript yet.

---

## Folder Structure

```
recovery-cafe-sj/
├── CLAUDE.md                   ← you are here
├── .env.example                ← env var template, never commit .env
├── .gitignore
├── package.json
├── vite.config.js
├── index.html
├── public/
│   └── rcsj-logo.png          ← placeholder, swap with real logo
├── src/
│   ├── main.jsx               ← app entry point
│   ├── App.jsx                ← router + auth gate
│   ├── theme.js               ← all colors and font sizes as constants
│   ├── components/
│   │   ├── BottomNav.jsx      ← 5-tab bottom navigation
│   │   ├── Header.jsx         ← green header with member name
│   │   ├── Card.jsx           ← reusable white card wrapper
│   │   └── ProgressRing.jsx   ← SVG ring for chores progress
│   ├── pages/
│   │   ├── Login.jsx          ← phone number entry, no SMS yet
│   │   ├── Home.jsx           ← dashboard: circle summary + chores + next event
│   │   ├── Events.jsx         ← full events list from Google Calendar
│   │   ├── Circle.jsx         ← circle details + this month's attendance
│   │   ├── Chores.jsx         ← chores progress ring + count
│   │   └── Profile.jsx        ← member name, circle, sign out
│   ├── hooks/
│   │   └── useMember.js       ← loads member data from Supabase by phone number
│   └── lib/
│       ├── supabase.js        ← supabase client init
│       └── fakeData.js        ← all fake seed data for development
├── scripts/
│   └── syncSheet.js           ← Google Sheets → Supabase sync script (runs manually or on cron)
└── .claude/
    └── agents/
        └── sheet-sync.md      ← agent instructions for the sync script
```

---

## Database Schema (Supabase)

### Table: `members`
| column | type | notes |
|---|---|---|
| id | uuid | primary key |
| client_id | text | from Agency / Google Sheet row number |
| full_name | text | |
| phone | text | used for login lookup, format: 10 digits no dashes |
| circle_label | text | raw value e.g. "Mon 11:30 (Delfina)" |
| circle_day | text | parsed from circle_label e.g. "Monday" |
| circle_time | text | parsed from circle_label e.g. "11:30 AM" |
| circle_leader | text | parsed from circle_label e.g. "Delfina" |
| chores_done | integer | number of chores completed this month, from sheet |
| chores_goal | integer | always 3 |
| created_at | timestamp | |
| updated_at | timestamp | |

### Table: `attendance`
| column | type | notes |
|---|---|---|
| id | uuid | primary key |
| member_id | uuid | foreign key → members.id |
| week_date | date | the date of the Sunday starting that week |
| status | text | "attended", "absent", "excused", or "not_enrolled" |

### Table: `events`
| column | type | notes |
|---|---|---|
| id | uuid | primary key |
| title | text | |
| event_date | date | |
| event_time | text | display string e.g. "2:00 PM" |
| location | text | e.g. "Room B", "Main Hall" |
| tag | text | "Class", "Workshop", "Special", "Music" |

---

## Data Flow

```
Google Sheet (staff updates daily)
        ↓
scripts/syncSheet.js (run manually for now, cron job later)
        ↓
Supabase (members + attendance tables)
        ↓
React app reads via supabase-js client
```

Events are hardcoded fake data in `fakeData.js` until Google Calendar API access is granted.

---

## Google Sheet Structure

The roster sheet has these columns:
- `row #` — used as client_id
- `Recovery Circle` — raw label e.g. "Mon 11:30 (Delfina)" — must be parsed
- `Full Name`
- `Needs chores` — staff helper flag, ignore in app
- `Chores` — integer, chores completed this month
- `Surveys` — ignore for now
- Then weekly date columns: `May 25th`, `May 18th`, etc. with values X / A / E / - / blank

The circle roster sheet has:
- `Circle Label` — same format as above
- `Client Name`
- `Email`
- `Number` — phone number, used for login

### Parsing Circle Label
Input: `"Mon 11:30 (Delfina)"` or `"Tue@1:30pm,Ferry, L"`
Parse into:
- Day: full day name e.g. "Monday", "Tuesday"
- Time: formatted e.g. "11:30 AM"
- Leader: first name only e.g. "Delfina", "Laura"

Write a robust parser that handles both formats. Log warnings for any label that doesn't parse cleanly.

---

## Login Flow (No Twilio Version)

1. Member opens app, sees login screen with RCSJ logo and phone number field
2. They enter their 10-digit phone number
3. App queries Supabase `members` table for a matching phone
4. If match found: store member id in localStorage, redirect to Home
5. If no match: show friendly message — "We couldn't find your number. Ask a staff member for help."
6. No passwords, no codes, no email. Phone number is the only key.

When Twilio is added later, step 3 becomes: send SMS code → member enters code → verify → log in. The login page should be built so this step can be inserted cleanly.

---

## Attendance Display Rules

For the Circle tab, show this month's attendance only (not full year).
- X → green chip "Attended"
- A → red chip "Missed"  
- E → yellow chip "Excused"
- `-` or blank → gray chip "Not yet"

Show weeks in reverse chronological order (most recent first).
Do not show a streak counter. Do not show yearly totals.
Label the section "Your Circle This Month" in plain language.

---

## Chores Display Rules

Every member's goal is 3 chores per month.
Show a large progress ring with the number done in the center.
Below the ring: "[N] of 3 chores this month"

**Celebration state:** When chores_done >= 3:
- Ring fills solid green
- Center shows ✓ instead of a number
- Show message: "Amazing! You hit your goal this month! 🎉"
- Animate the ring filling on page load (CSS transition, 0.8s ease)

If chores_done is 0: show "Sign up for chores at the front desk"
If chores_done is 1 or 2: show "Keep going — you're almost there!"

---

## Events Display Rules

Show events in chronological order, soonest first.
Each event card shows: date block (day + month), event name, time, location, tag badge.
Tags and colors:
- Class → green (#2D6A4F)
- Workshop → brown (#7F4F24)  
- Music → purple (#6B4F8C)
- Special → orange (#C1440E)

For the demo, use these fake events spread across the current week and next two weeks:
- Art Workshop, Tuesdays 10:00 AM, Main Hall, Workshop
- Friday Jam (Music), Fridays 2:00 PM, Cafe Floor, Music
- Barista Training, Mondays 1:00 PM, Kitchen, Class
- Mindfulness & Meditation, Wednesdays 10:00 AM, Room B, Class
- Community Celebration, last Friday of month 4:00 PM, Cafe Floor, Special
- Job Readiness Skills, Thursdays 10:00 AM, Room A, Class
- Cooking Skills, Tuesdays 1:00 PM, Kitchen, Class

---

## Sync Script (scripts/syncSheet.js)

This script runs outside the React app. It:
1. Authenticates with Google Sheets API using OAuth (personal account for dev)
2. Reads the roster sheet
3. For each row, upserts into `members` table (match on phone number)
4. Parses all weekly attendance columns and upserts into `attendance` table
5. Logs how many records were created vs updated vs skipped
6. Logs any rows it couldn't parse cleanly

For dev, the script should also accept a `--fake` flag that loads from `src/lib/fakeData.js` instead of hitting Google Sheets. This means the app can be fully developed without real credentials.

---

## Environment Variables

```
# .env (never commit this)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
GOOGLE_SHEET_ID=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
```

All VITE_ prefixed vars are available in the React app.
Non-prefixed vars are for the sync script only (Node.js).

---

## What NOT to Build (Yet)

- No Twilio SMS verification
- No staff admin portal
- No Google Calendar integration (use fake events)
- No push notifications
- No member photo upload
- No in-app messaging
- No TypeScript
- No deployment/CI pipeline

Keep scope tight. Build what's listed. Nothing else.

---

## Code Style

- Functional React components only
- All colors from `src/theme.js` — never hardcode hex values in components
- All styles as inline style objects — no CSS files except a single global reset
- Comments on anything non-obvious
- No console.log left in production paths — use a `debug()` helper that checks NODE_ENV
- Handle loading and error states on every data fetch — members should never see a blank white screen

---

## Testing Checklist Before Showing to Anyone

- [ ] Login with a fake phone number that exists in seed data — works
- [ ] Login with a phone number not in seed data — shows friendly error
- [ ] Home screen loads all three cards without errors
- [ ] Chores at 0, 1, 2, and 3 all display correctly
- [ ] Chores celebration animation fires when at 3
- [ ] Circle tab shows correct day/time/leader parsed from label
- [ ] Events show in correct date order
- [ ] All 5 tabs navigate correctly
- [ ] Sign out clears localStorage and returns to login
- [ ] App looks correct on a mobile screen (390px wide)
- [ ] No member can access any other member's data

---

## Design Context

Register: **product** (app UI — design serves the product, not the other way around).
Full strategic context: `PRODUCT.md` at the project root.
Visual system: `DESIGN.md` at the project root (generate with `/impeccable document` if missing).
Live mode config: `.impeccable/live/config.json`.
