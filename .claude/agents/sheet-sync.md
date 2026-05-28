# Agent: Google Sheets → Supabase Sync

## Purpose
This agent handles syncing data from the Recovery Cafe San Jose Google Sheet into the Supabase database. It runs as a standalone Node.js script, not inside the React app.

## When to invoke this agent
- When asked to "sync the sheet"
- When asked to update member data
- When setting up the sync script for the first time
- When the sheet structure changes and the parser needs updating

## What this agent knows

### Sheet structure
- Roster tab columns: row#, Recovery Circle, Full Name, Needs chores, Chores, Surveys, then weekly date columns (May 25th, May 18th, etc.)
- Circle roster tab columns: Circle Label, Client Name, Email, Number
- Attendance values: X = attended, A = absent, E = excused, - = not enrolled, blank = no data

### Circle label parsing
Two known formats exist in the sheet:
1. "Mon 11:30 (Delfina)" — day abbreviation, time, leader first name in parens
2. "Tue@1:30pm,Ferry, L" — day@time,LastName, First initial

Parser must handle both. Output should always be:
- circle_day: full day name ("Monday", "Tuesday", etc.)
- circle_time: 12-hour formatted ("11:30 AM", "1:30 PM")
- circle_leader: first name only ("Delfina", "Laura")

### Phone number normalization
Strip all non-digits. Store as 10-digit string. If number is 11 digits starting with 1, strip the leading 1.

### Upsert logic
Match existing members on phone number. If phone matches, update. If no match, insert. Never delete — staff may have members in Supabase not yet in the sheet.

### Attendance columns
Weekly columns are named like "May 25th", "May 18th", "Apr 27th" etc.
Parse each column header into a date. Store as ISO date string (YYYY-MM-DD) in Supabase.
Use the year from context — if month is Jan-May assume 2026, if Jun-Dec assume 2025 for historical data.

## Running the script

### Dev mode (fake data, no credentials needed)
```bash
node scripts/syncSheet.js --fake
```

### Real mode (requires .env with Google credentials)
```bash
node scripts/syncSheet.js
```

## Error handling
- Log each row that fails to parse with the row number and reason
- Continue processing remaining rows even if one fails
- At the end, print a summary: X inserted, X updated, X skipped, X errors
- Never crash silently

## Dependencies needed
- googleapis (Google Sheets API)
- @supabase/supabase-js
- dotenv
