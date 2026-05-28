#!/usr/bin/env node
// scripts/syncSheet.js — Google Sheets → Supabase sync
// Usage:
//   node scripts/syncSheet.js --fake   (dry run with fake data, no credentials needed)
//   node scripts/syncSheet.js          (real sync, requires .env with Google credentials)

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { createServer } from 'http'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isFake = process.argv.includes('--fake')
const isDiscover = process.argv.includes('--discover')

// --- Utilities ---

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
}

const DAY_MAP = {
  mon: 'Monday',  monday: 'Monday',
  tue: 'Tuesday', tues: 'Tuesday',  tuesday: 'Tuesday',
  wed: 'Wednesday', wednesday: 'Wednesday',
  thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', thursday: 'Thursday',
  fri: 'Friday',  friday: 'Friday',
  sat: 'Saturday', saturday: 'Saturday',
  sun: 'Sunday',  sunday: 'Sunday',
}

function formatTime(hour, minute, isPm) {
  let h = parseInt(hour, 10)
  const m = String(minute).padStart(2, '0')
  if (isPm && h < 12) h += 12
  if (!isPm && h === 12) h = 0
  const period = h >= 12 ? 'PM' : 'AM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:${m} ${period}`
}

function parseCircleLabel(label) {
  if (!label || typeof label !== 'string') return null
  const trimmed = label.trim()

  // Format 1: "Mon 11:30 (Delfina)" or "Tues 10:30 (Susan)"
  const fmt1 = trimmed.match(/^(\w{3,8})\s+(\d{1,2}):(\d{2})\s*\(([^)]+)\)/i)
  if (fmt1) {
    const [, dayAbbr, hour, minute, leader] = fmt1
    const day = DAY_MAP[dayAbbr.toLowerCase()]
    if (!day) return null
    const isPm = parseInt(hour, 10) >= 12 || trimmed.toLowerCase().includes('pm')
    return { day, time: formatTime(hour, minute, isPm), leader: leader.trim() }
  }

  // Format 2: "Tue@1:30pm,Ferry, L" or "Mon@1:30pm,Jacome, R"
  const fmt2 = trimmed.match(/^(\w{3,8})@(\d{1,2}):(\d{2})(am|pm),([^,]+),\s*(\w)/i)
  if (fmt2) {
    const [, dayAbbr, hour, minute, ampm, lastName, initial] = fmt2
    const day = DAY_MAP[dayAbbr.toLowerCase()]
    if (!day) return null
    const isPm = ampm.toLowerCase() === 'pm'
    return { day, time: formatTime(hour, minute, isPm), leader: `${initial.toUpperCase()}. ${lastName.trim()}` }
  }

  console.warn(`[syncSheet] Could not parse circle label: "${label}"`)
  return null
}

// --- Fake mode: dry run with fakeData.js ---

async function runFake() {
  const { fakeMembers, fakeAttendance } = await import('../src/lib/fakeData.js')

  console.log('\n=== FAKE MODE — dry run, no database writes ===\n')

  let inserted = 0, updated = 0, errors = 0

  for (const member of fakeMembers) {
    try {
      const phone = normalizePhone(member.phone)
      const parsed = parseCircleLabel(member.circle_label)
      if (!parsed) throw new Error(`Could not parse circle label: "${member.circle_label}"`)

      console.log(`[member] Would upsert: ${member.full_name} | phone: ${phone} | circle: ${parsed.day} ${parsed.time} (${parsed.leader})`)
      inserted++
    } catch (err) {
      console.error(`[member] Error for row ${member.client_id}: ${err.message}`)
      errors++
    }
  }

  for (const record of fakeAttendance) {
    try {
      console.log(`[attendance] Would upsert: member ${record.member_id} | week ${record.week_date} | status: ${record.status}`)
      updated++
    } catch (err) {
      console.error(`[attendance] Error: ${err.message}`)
      errors++
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`Members:    ${inserted} would insert/update`)
  console.log(`Attendance: ${updated} would insert/update`)
  console.log(`Errors:     ${errors}`)
}

// --- Real mode helpers ---

const OAUTH_PORT = 3737
const REDIRECT_URI = `http://localhost:${OAUTH_PORT}`

// Starts a local HTTP server that catches the OAuth redirect and resolves with the code.
function waitForOAuthCode() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${OAUTH_PORT}`)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body style="font-family:sans-serif;padding:40px"><h2>✅ Authorization successful!</h2><p>You can close this tab and return to the terminal.</p></body></html>')
        server.close()
        resolve(code)
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(`<html><body style="font-family:sans-serif;padding:40px"><h2>❌ Authorization failed</h2><p>${error}</p></body></html>`)
        server.close()
        reject(new Error(`OAuth error: ${error}`))
      }
    })

    server.listen(OAUTH_PORT, () => {})
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${OAUTH_PORT} is in use. Close whatever is running there and retry.`))
      } else {
        reject(err)
      }
    })
  })
}

async function getGoogleAuth() {
  const { google } = await import('googleapis')
  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET } = process.env

  const auth = new google.auth.OAuth2(
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    REDIRECT_URI,
  )

  const tokenPath = join(__dirname, '..', '.google-token.json')

  if (existsSync(tokenPath)) {
    try {
      const tokenData = JSON.parse(readFileSync(tokenPath, 'utf-8'))
      auth.setCredentials(tokenData)
      await auth.getAccessToken() // will auto-refresh if expired
      console.log('Using saved Google token.')
      return { google, auth }
    } catch {
      console.log('Saved token invalid or expired — re-authorizing...')
    }
  }

  const authUrl = auth.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    prompt: 'consent', // force refresh_token to be returned
  })

  console.log('\nOpening browser for Google authorization...')
  console.log('If the browser does not open automatically, visit this URL:\n')
  console.log('  ' + authUrl + '\n')
  console.log(`Waiting for authorization (callback on port ${OAUTH_PORT})...`)

  // Open browser on Windows
  const { exec } = await import('child_process')
  exec(`start "" "${authUrl}"`)

  const code = await waitForOAuthCode()
  const { tokens } = await auth.getToken(code)
  auth.setCredentials(tokens)

  writeFileSync(tokenPath, JSON.stringify(tokens, null, 2))
  console.log('Token saved to .google-token.json\n')

  return { google, auth }
}

// Parse date column headers like "May 25th", "May 18th" → ISO date string or null.
// The sheet has a year of columns ordered newest→oldest. Dates more than 3 months in
// the future are almost certainly prior-year columns, so we subtract a year there.
function parseAttendanceDateHeader(header) {
  const match = header.match(/^([A-Za-z]+)\s+(\d{1,2})/i)
  if (!match) return null

  const MONTHS = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  }
  const monthKey = match[1].slice(0, 3).toLowerCase()
  const day = parseInt(match[2], 10)
  const month = MONTHS[monthKey]
  if (month === undefined || isNaN(day)) return null

  const today = new Date()
  const threeMonthsOut = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate())
  let d = new Date(today.getFullYear(), month, day)
  if (d > threeMonthsOut) d = new Date(today.getFullYear() - 1, month, day)

  return d.toISOString().slice(0, 10)
}

const ATTENDANCE_MAP = {
  x: 'attended', X: 'attended',
  a: 'absent', A: 'absent',
  e: 'excused', E: 'excused',
  '-': 'not_enrolled', '': 'not_enrolled',
}

// Read a sheet tab and return header + rows as objects
async function readTab(sheets, spreadsheetId, tabName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tabName,
  })
  const [headers, ...rawRows] = res.data.values || [[]]
  if (!headers) return { headers: [], rows: [] }

  const rows = rawRows.map(row => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (row[i] ?? '').toString().trim() })
    return obj
  })
  return { headers, rows }
}

// Collapse newlines and extra whitespace in a header string for comparison
function normalizeHeader(h) {
  return h.replace(/\s+/g, ' ').trim().toLowerCase()
}

// Case-insensitive column name lookup; handles headers with embedded newlines
function findCol(headers, ...candidates) {
  for (const candidate of candidates) {
    const norm = normalizeHeader(candidate)
    const found = headers.find(h => normalizeHeader(h) === norm)
    if (found) return found
  }
  // Partial match fallback
  for (const candidate of candidates) {
    const norm = normalizeHeader(candidate)
    const found = headers.find(h => normalizeHeader(h).includes(norm))
    if (found) return found
  }
  return null
}

// Normalize a person's name for matching across sheets.
// Handles both "First Last" (Current Roster) and "Last, First" (Roster Data).
function normalizeName(name) {
  const trimmed = name.trim()
  if (trimmed.includes(',')) {
    const [last, first] = trimmed.split(',').map(s => s.trim())
    return `${first} ${last}`.toLowerCase().replace(/\s+/g, ' ')
  }
  return trimmed.toLowerCase().replace(/\s+/g, ' ')
}

// --- Discover mode: print tab names + first 3 rows of each, no writes ---

async function runDiscover() {
  const dotenv = await import('dotenv')
  dotenv.config({ path: join(__dirname, '..', '.env') })

  const { GOOGLE_SHEET_ID } = process.env
  if (!GOOGLE_SHEET_ID || !process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    console.error('Missing GOOGLE_SHEET_ID / GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET in .env')
    process.exit(1)
  }

  console.log('\n=== DISCOVER MODE — read-only, no database writes ===\n')

  const { google, auth } = await getGoogleAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const meta = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID })
  const tabs = meta.data.sheets.map(s => s.properties.title)

  console.log(`Found ${tabs.length} tab(s):\n`)
  tabs.forEach((t, i) => console.log(`  ${i + 1}. "${t}"`))

  for (const tab of tabs) {
    const { headers, rows } = await readTab(sheets, GOOGLE_SHEET_ID, tab)
    const preview = rows.slice(0, 3)

    console.log(`\n${'─'.repeat(60)}`)
    console.log(`TAB: "${tab}"  (${rows.length} data rows)`)
    console.log(`${'─'.repeat(60)}`)
    console.log(`Headers (${headers.length}): ${headers.join(' | ')}`)
    console.log(`\nFirst 3 rows:`)
    preview.forEach((row, i) => {
      const vals = headers.map(h => `${h}: "${row[h] ?? ''}"`)
      console.log(`  Row ${i + 1}: ${vals.join('  |  ')}`)
    })
    if (rows.length === 0) console.log('  (no data rows)')
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log('Discovery complete. No data was written.')
}

// --- Real sync ---

async function runReal() {
  const dotenv = await import('dotenv')
  dotenv.config({ path: join(__dirname, '..', '.env') })

  const {
    GOOGLE_SHEET_ID,
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env

  const missing = []
  if (!GOOGLE_SHEET_ID) missing.push('GOOGLE_SHEET_ID')
  if (!GOOGLE_OAUTH_CLIENT_ID) missing.push('GOOGLE_OAUTH_CLIENT_ID')
  if (!GOOGLE_OAUTH_CLIENT_SECRET) missing.push('GOOGLE_OAUTH_CLIENT_SECRET')
  if (!VITE_SUPABASE_URL) missing.push('VITE_SUPABASE_URL')
  if (!VITE_SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY')
  if (missing.length > 0) {
    console.error('Missing required env vars:', missing.join(', '))
    process.exit(1)
  }

  console.log('\n=== REAL SYNC MODE ===\n')

  // Supabase client — prefer service role key for write access (bypasses RLS)
  const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || VITE_SUPABASE_ANON_KEY
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(VITE_SUPABASE_URL, supabaseKey)
  if (SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Supabase: using service role key.')
  } else {
    console.log('Supabase: using anon key. If upserts fail with 403, add SUPABASE_SERVICE_ROLE_KEY to .env.')
  }

  // Google auth
  const { google, auth } = await getGoogleAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  // Discover sheet tabs
  const meta = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID })
  const tabs = meta.data.sheets.map(s => s.properties.title)
  console.log(`\nFound ${tabs.length} tab(s): ${tabs.map(t => `"${t}"`).join(', ')}`)

  // Prefer exact known tab names from the real sheet; fall back to heuristic detection.
  // Use our preferred order — not tab order — so Roster Data wins over Circle Roster.
  const MAIN_ROSTER_NAMES = ['Current Roster']
  const PHONE_SOURCE_NAMES = ['Roster Data', 'Agency Data', 'Circle Roster']

  let mainRosterTab = MAIN_ROSTER_NAMES.find(n => tabs.includes(n)) ?? null
  let phoneSourceTab = PHONE_SOURCE_NAMES.find(n => tabs.includes(n)) ?? null

  // Heuristic fallback if names don't match
  if (!mainRosterTab || !phoneSourceTab) {
    for (const tab of tabs) {
      const { headers } = await readTab(sheets, GOOGLE_SHEET_ID, tab)
      const norms = headers.map(normalizeHeader)
      const hasPhone = norms.some(h => h === 'number' || h === 'phone')
      const hasChores = norms.some(h => h === 'chores')
      const hasAttendance = headers.some(h => parseAttendanceDateHeader(h) !== null)
      if (!mainRosterTab && hasChores && hasAttendance) mainRosterTab = tab
      else if (!phoneSourceTab && hasPhone) phoneSourceTab = tab
    }
  }

  if (!mainRosterTab) { console.error('Could not find main roster tab.'); process.exit(1) }
  if (!phoneSourceTab) { console.error('Could not find phone number tab.'); process.exit(1) }
  console.log(`Main roster tab:  "${mainRosterTab}"`)
  console.log(`Phone source tab: "${phoneSourceTab}"`)

  // --- Build phone map from phone source tab ---
  // Names in Roster Data are "Last, First"; Current Roster uses "First Last".
  // normalizeName() converts both to "first last" for matching.
  const phoneMap = new Map()    // normalizedName → phone (10-digit string)
  const circleLabelByName = new Map() // normalizedName → circle label

  const { headers: phoneHeaders, rows: phoneRows } = await readTab(sheets, GOOGLE_SHEET_ID, phoneSourceTab)
  console.log(`\nPhone source headers: ${phoneHeaders.join(' | ')}`)

  const phoneNameCol = findCol(phoneHeaders, 'Client Name', 'Full Name', 'Name')
  const phoneNumCol  = findCol(phoneHeaders, 'Number', 'Phone', 'Cell')
  const phoneCircCol = findCol(phoneHeaders, 'Circle Label', 'Recovery Circle', 'Circle')

  console.log(`  → name col: "${phoneNameCol}"  phone col: "${phoneNumCol}"  circle col: "${phoneCircCol}"`)

  let phoneMissing = 0
  for (const row of phoneRows) {
    const name  = row[phoneNameCol] || ''
    const phone = normalizePhone(row[phoneNumCol] || '')
    const circle = row[phoneCircCol] || ''
    if (!name) continue
    if (!phone || phone === '0000000000') { phoneMissing++; continue }
    const key = normalizeName(name)
    phoneMap.set(key, phone)
    if (circle) circleLabelByName.set(key, circle)
  }
  console.log(`Loaded ${phoneMap.size} phone records (${phoneMissing} rows had no valid number).`)

  // --- Read main roster ---
  const { headers: mainHeaders, rows: mainRows } = await readTab(sheets, GOOGLE_SHEET_ID, mainRosterTab)
  console.log(`\nMain roster headers: ${mainHeaders.join(' | ')}`)

  const nameCol   = findCol(mainHeaders, 'Member Name', 'Full Name', 'Client Name', 'Name')
  const circleCol = findCol(mainHeaders, 'Recovery Circle', 'Circle Label', 'Circle')
  const choresCol = findCol(mainHeaders, 'Chores')
  // Row number: first non-empty header that has numeric values in the first few rows
  const rowCol = mainHeaders.find(h => h === '' || h === '#') ?? null

  console.log(`  → name: "${nameCol}"  circle: "${circleCol}"  chores: "${choresCol}"  row#: "${rowCol}"`)

  if (!nameCol) { console.error('Cannot find name column in main roster.'); process.exit(1) }

  // Attendance columns: any header that parses as a date and is not a known fixed column
  const FIXED_NORMS = ['recovery circle', 'circle label', 'member name', 'full name', 'client name',
                       'needs chores', 'chores', 'survey', 'surveys', '#', '']
  const attendanceHeaders = mainHeaders.filter(h => {
    if (FIXED_NORMS.includes(normalizeHeader(h))) return false
    return parseAttendanceDateHeader(h) !== null
  })
  console.log(`Attendance columns (${attendanceHeaders.length}): ${attendanceHeaders.slice(0, 5).join(', ')}${attendanceHeaders.length > 5 ? ' …' : ''}`)

  // --- Upsert members ---
  let membersUpserted = 0, membersSkipped = 0, attendanceUpserted = 0, attendanceErrors = 0
  const memberIdByKey = new Map()

  console.log('\n--- Upserting members ---')

  for (const row of mainRows) {
    const name = row[nameCol] || ''
    if (!name) continue

    const nameKey = normalizeName(name)
    const phone   = phoneMap.get(nameKey) || ''

    if (!phone) {
      console.warn(`[member] no phone for "${name}" (looked up as "${nameKey}") — skipping`)
      membersSkipped++
      continue
    }

    const clientId    = rowCol !== null ? (row[rowCol] || '') : ''
    const circleLabel = (circleCol ? row[circleCol] : '') || circleLabelByName.get(nameKey) || ''
    const choresDone  = Math.max(0, parseInt(choresCol ? row[choresCol] || '0' : '0', 10) || 0)
    const parsed      = parseCircleLabel(circleLabel)

    if (circleLabel && !parsed) {
      console.warn(`[member] could not parse circle label "${circleLabel}" for "${name}"`)
    }

    const memberRow = {
      client_id:     clientId || null,
      full_name:     name,
      phone,
      circle_label:  circleLabel || null,
      circle_day:    parsed?.day    ?? null,
      circle_time:   parsed?.time   ?? null,
      circle_leader: parsed?.leader ?? null,
      chores_done:   choresDone,
      chores_goal:   3,
      updated_at:    new Date().toISOString(),
    }

    try {
      const { data, error } = await supabase
        .from('members')
        .upsert(memberRow, { onConflict: 'phone' })
        .select('id')
        .single()

      if (error) throw error
      memberIdByKey.set(nameKey, data.id)
      membersUpserted++
      console.log(`[member] ✓ ${name} | ${phone} | chores: ${choresDone}`)
    } catch (err) {
      console.error(`[member] ✗ "${name}": ${err.message}`)
      membersSkipped++
    }
  }

  // --- Upsert attendance ---
  // Uses delete+bulk-insert per member instead of onConflict upsert, so no unique
  // constraint is required on the attendance table (though you can add one later).
  console.log('\n--- Upserting attendance ---')

  // Build all attendance records in memory first
  const attendanceByMember = new Map() // memberId → [{member_id, week_date, status}]
  for (const row of mainRows) {
    const name = row[nameCol] || ''
    if (!name) continue
    const memberId = memberIdByKey.get(normalizeName(name))
    if (!memberId) continue

    const records = []
    for (const header of attendanceHeaders) {
      const weekDate = parseAttendanceDateHeader(header)
      if (!weekDate) continue
      const raw    = (row[header] || '').trim()
      const status = ATTENDANCE_MAP[raw] ?? 'not_enrolled'
      records.push({ member_id: memberId, week_date: weekDate, status })
    }
    if (records.length > 0) attendanceByMember.set(memberId, records)
  }

  // Delete then bulk-insert per member
  for (const [memberId, records] of attendanceByMember) {
    try {
      const { error: delErr } = await supabase.from('attendance').delete().eq('member_id', memberId)
      if (delErr) throw delErr
      const { error: insErr } = await supabase.from('attendance').insert(records)
      if (insErr) throw insErr
      attendanceUpserted += records.length
    } catch (err) {
      console.error(`[attendance] ✗ member ${memberId}: ${err.message}`)
      attendanceErrors++
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Members:    ${membersUpserted} upserted, ${membersSkipped} skipped (no phone match)`)
  console.log(`Attendance: ${attendanceUpserted} upserted, ${attendanceErrors} errors`)
}

// --- Entry point ---

if (isFake) {
  runFake().catch((err) => {
    console.error('Fatal error in fake mode:', err)
    process.exit(1)
  })
} else if (isDiscover) {
  runDiscover().catch((err) => {
    console.error('Fatal error in discover mode:', err)
    process.exit(1)
  })
} else {
  runReal().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}
