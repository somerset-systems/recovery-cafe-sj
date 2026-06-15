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
    const h = parseInt(hour, 10)
    const labelLower = trimmed.toLowerCase()
    // If label has explicit am/pm use it; otherwise hours 1-6 → PM, 7-11 → AM, 12 → PM
    const isPm = labelLower.includes('pm') || (!labelLower.includes('am') && ((h >= 1 && h <= 6) || h === 12))
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

// Returns true if a service-account key is available (inline env var or local file).
function hasServiceAccountKey() {
  return !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
         existsSync(join(__dirname, '..', 'google-credentials.json'))
}

async function getGoogleAuth() {
  const { google } = await import('googleapis')

  // --- Preferred: service account (unattended — never needs a browser) ---
  // Source A: GOOGLE_SERVICE_ACCOUNT_KEY env var holding the full JSON key (used by CI / GitHub Actions).
  // Source B: a google-credentials.json file in the project root (used for local unattended runs).
  // To use this, share the Google Sheet (read-only) with the service account's client_email.
  let serviceAccountCreds = null
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      serviceAccountCreds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
    } catch (e) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is set but is not valid JSON: ' + e.message)
    }
  } else {
    const keyFilePath = join(__dirname, '..', 'google-credentials.json')
    if (existsSync(keyFilePath)) {
      serviceAccountCreds = JSON.parse(readFileSync(keyFilePath, 'utf-8'))
    }
  }

  if (serviceAccountCreds) {
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountCreds,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/calendar.readonly',
      ],
    })
    console.log(`Using Google service account: ${serviceAccountCreds.client_email}`)
    return { google, auth }
  }

  // --- Fallback: interactive personal OAuth (local dev only) ---
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
    scope: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
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
// Converts "Last, First" → "First Last", lowercased, whitespace collapsed.
function normalizeName(name) {
  const trimmed = name.trim()
  if (trimmed.includes(',')) {
    const [last, ...firstParts] = trimmed.split(',').map(s => s.trim())
    return `${firstParts.join(' ')} ${last}`.toLowerCase().replace(/\s+/g, ' ').trim()
  }
  return trimmed.toLowerCase().replace(/\s+/g, ' ')
}

// --- Fuzzy name matching ---

// Common nickname groups. Any token in a group matches any other token in the same group.
const NICKNAME_GROUPS = [
  ['timothy', 'tim', 'timmy'],
  ['robert', 'bob', 'rob', 'robby', 'bobby'],
  ['michael', 'mike', 'mick', 'mickey', 'mikey'],
  ['william', 'bill', 'will', 'billy', 'willy', 'liam'],
  ['james', 'jim', 'jimmy', 'jamie'],
  ['joseph', 'joe', 'joey'],
  ['thomas', 'tom', 'tommy'],
  ['richard', 'rick', 'rich', 'dick', 'ricky'],
  ['charles', 'chuck', 'charlie', 'chas'],
  ['christopher', 'chris'],
  ['anthony', 'tony'],
  ['andrew', 'andy', 'drew'],
  ['daniel', 'dan', 'danny'],
  ['david', 'dave', 'davy'],
  ['edward', 'ed', 'eddie', 'ned', 'ted'],
  ['john', 'johnny', 'jack'],
  ['jonathan', 'jon', 'jonny'],
  ['kenneth', 'ken', 'kenny'],
  ['lawrence', 'larry', 'lars'],
  ['matthew', 'matt', 'matty'],
  ['nicholas', 'nick', 'nicky', 'nicolas'],
  ['patrick', 'pat', 'patty'],
  ['peter', 'pete'],
  ['philip', 'phil', 'phillip'],
  ['raymond', 'ray'],
  ['ronald', 'ron', 'ronny'],
  ['samuel', 'sam', 'sammy'],
  ['stephen', 'steve', 'stevie'],
  ['steven', 'steve', 'stevie'],
  ['walter', 'walt', 'wally'],
  ['albert', 'al'],
  ['alexander', 'alex', 'al', 'alec'],
  ['alfred', 'al', 'fred'],
  ['benjamin', 'ben', 'benny'],
  ['donald', 'don', 'donny'],
  ['douglas', 'doug'],
  ['eugene', 'gene'],
  ['franklin', 'frank'],
  ['frederick', 'fred', 'freddie'],
  ['gerald', 'jerry', 'gerry'],
  ['gregory', 'greg'],
  ['harold', 'hal', 'harry'],
  ['leonard', 'len', 'lenny'],
  ['martin', 'marty'],
  ['nathan', 'nate'],
  ['randall', 'randy'],
  ['vincent', 'vince', 'vinnie'],
  // Women
  ['barbara', 'barb', 'barbie'],
  ['catherine', 'cathy', 'cat', 'kate', 'katie', 'kat'],
  ['katherine', 'kathy', 'kate', 'katie', 'kat'],
  ['deborah', 'deb', 'debbie', 'debra'],
  ['dorothy', 'dot', 'dottie'],
  ['elizabeth', 'liz', 'beth', 'betty', 'ellie', 'lisa'],
  ['jennifer', 'jen', 'jenny'],
  ['jessica', 'jess', 'jessie'],
  ['judith', 'judy'],
  ['kathleen', 'kathy', 'kate', 'katie'],
  ['margaret', 'maggie', 'meg', 'peggy', 'marge'],
  ['patricia', 'pat', 'patty', 'tricia'],
  ['stephanie', 'steph'],
  ['susan', 'sue', 'suzy', 'susie'],
  ['theresa', 'terri', 'teresa', 'tess'],
  ['victoria', 'vicky', 'tori'],
  ['manuel', 'manny'],
  ['jacquelyn', 'jackie', 'jacky', 'jacklyn'],
  ['nicole', 'nikki'],
]

// Build a map: token → Set of all equivalent tokens (including itself)
function buildNicknameMap() {
  const map = new Map()
  for (const group of NICKNAME_GROUPS) {
    const set = new Set(group)
    for (const name of group) {
      if (!map.has(name)) map.set(name, new Set(group))
      else group.forEach(n => map.get(name).add(n))
    }
  }
  return map
}

// Returns true if every token in `needles` appears in `haystack` (with nickname expansion).
function tokensAllPresent(needles, haystack, nicknameMap) {
  const haystackExpanded = new Set()
  for (const t of haystack) {
    haystackExpanded.add(t)
    const variants = nicknameMap.get(t)
    if (variants) variants.forEach(v => haystackExpanded.add(v))
  }
  return needles.every(t => {
    if (haystackExpanded.has(t)) return true
    const variants = nicknameMap.get(t)
    return variants ? [...variants].some(v => haystackExpanded.has(v)) : false
  })
}

// Remove "quoted"/[parenthesized]/aka nickname tokens for comparison
function stripNicknames(s) {
  return s
    .replace(/"[^"]*"/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\baka\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Find a phone number for a roster name using 7 strategies in priority order.
// Returns { phone, strategy, matchedKey, confidence } or null.
function findPhoneMatch(rosterName, phoneMap, nicknameMap) {
  const normalized = normalizeName(rosterName)

  // Strategy 1: exact normalized match (also handles "Last, First" → "First Last")
  if (phoneMap.has(normalized)) {
    return { phone: phoneMap.get(normalized), strategy: 'exact', matchedKey: normalized, confidence: 100 }
  }

  const tokensA = normalized.split(' ').filter(Boolean)
  if (tokensA.length === 0) return null

  const firstA = tokensA[0]
  const lastA  = tokensA[tokensA.length - 1]
  const strippedA    = stripNicknames(normalized)
  const tokensStrA   = strippedA.split(' ').filter(Boolean)

  let tokenMatch        = null
  let strippedExactMatch = null
  let nicknameMatch     = null
  let strippedTokenMatch = null
  let firstFuzzyMatch   = null
  let lastTypoMatch     = null

  for (const [key, phone] of phoneMap) {
    const tokensB = key.split(' ').filter(Boolean)
    const firstB  = tokensB[0]
    const lastB   = tokensB[tokensB.length - 1]

    // Strategy 2: all tokens of shorter name appear exactly in longer name
    // (handles middle names, Jr/Sr, reordering)
    if (!tokenMatch) {
      const [shorter, longer] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA]
      const longerSet = new Set(longer)
      if (shorter.every(t => longerSet.has(t))) {
        tokenMatch = { phone, strategy: 'token', matchedKey: key, confidence: 90 }
      }
    }

    // Strategy 3: stripped exact match — remove "quoted"/(parenthesized)/aka tokens,
    // then compare. Catches 'Jeffrey "JP" Echivaria' ↔ 'Echivaria, Jeffrey (JP)'.
    if (!strippedExactMatch && strippedA) {
      const strippedKey = stripNicknames(key)
      if (strippedKey && strippedA === strippedKey) {
        strippedExactMatch = { phone, strategy: 'stripped-exact', matchedKey: key, confidence: 88 }
      }
    }

    // Strategy 4: token match with nickname expansion (Tim ↔ Timothy, Manny ↔ Manuel, etc.)
    if (!nicknameMatch) {
      if (tokensAllPresent(tokensA, tokensB, nicknameMap) ||
          tokensAllPresent(tokensB, tokensA, nicknameMap)) {
        nicknameMatch = { phone, strategy: 'nickname', matchedKey: key, confidence: 85 }
      }
    }

    // Strategy 5: stripped token subset — after stripping nicknames, check if all tokens of
    // the shorter side appear in the longer side. Catches 'Quyen (Quinn) Hoang' ↔ 'Hoang, Quyen N'.
    if (!strippedTokenMatch && tokensStrA.length >= 2) {
      const strippedKey  = stripNicknames(key)
      const tokensStrB   = strippedKey.split(' ').filter(Boolean)
      if (tokensStrB.length >= 1) {
        const [shorter, longer] = tokensStrA.length <= tokensStrB.length ? [tokensStrA, tokensStrB] : [tokensStrB, tokensStrA]
        const longerSet = new Set(longer)
        if (shorter.every(t => longerSet.has(t))) {
          strippedTokenMatch = { phone, strategy: 'stripped-token', matchedKey: key, confidence: 80 }
        }
      }
    }

    // Strategy 6: first-name fuzzy — Levenshtein ≤ 2 on first name, exact last name.
    // Catches 'Jeffery' ↔ 'Jeffrey', 'Eric' ↔ 'Erik', 'Meserea' ↔ 'Mesere'.
    if (!firstFuzzyMatch && tokensA.length >= 2 && tokensB.length >= 2) {
      if (lastA === lastB) {
        const d = levenshtein(firstA, firstB)
        if (d >= 1 && d <= 2) {
          firstFuzzyMatch = { phone, strategy: 'first-fuzzy', matchedKey: key, confidence: d === 1 ? 82 : 74 }
        }
      }
    }

    // Strategy 7: last-name typo — exact first name, Levenshtein ≤ 1 on last name.
    // Catches 'Trujilo' ↔ 'Trujillo', 'Pickettt' ↔ 'Pickett', 'Fitzsimons' ↔ 'Fitzsimmons'.
    if (!lastTypoMatch && tokensA.length >= 2 && tokensB.length >= 2) {
      if (firstA === firstB && lastA !== lastB) {
        if (levenshtein(lastA, lastB) === 1) {
          lastTypoMatch = { phone, strategy: 'last-typo', matchedKey: key, confidence: 85 }
        }
      }
    }

    if (tokenMatch && strippedExactMatch && nicknameMatch && strippedTokenMatch && firstFuzzyMatch && lastTypoMatch) break
  }

  return tokenMatch || strippedExactMatch || nicknameMatch || strippedTokenMatch || firstFuzzyMatch || lastTypoMatch || null
}

// --- Skip report helpers ---

// Standard Levenshtein edit distance
function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i])
  for (let j = 1; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// 0-100 similarity between two normalized name strings (token Dice + edit distance)
function nameSimilarity(a, b, nicknameMap) {
  if (a === b) return 100
  const tokensA = a.split(' ').filter(Boolean)
  const tokensB = b.split(' ').filter(Boolean)
  if (!tokensA.length || !tokensB.length) return 0

  // Token Dice coefficient with nickname expansion on both sides
  const expandedB = new Set(tokensB)
  tokensB.forEach(t => { const v = nicknameMap.get(t); if (v) v.forEach(x => expandedB.add(x)) })
  const matchingTokens = tokensA.filter(t => {
    if (expandedB.has(t)) return true
    const v = nicknameMap.get(t)
    return v ? [...v].some(x => expandedB.has(x)) : false
  }).length
  const dice = (2 * matchingTokens) / (tokensA.length + tokensB.length)

  // Edit distance on full string (given slightly less weight)
  const maxLen = Math.max(a.length, b.length)
  const editSim = 1 - levenshtein(a, b) / maxLen

  return Math.round(Math.max(dice, editSim * 0.85) * 100)
}

// Scan all source entries and return the closest one with its confidence score
function findClosestInSource(rosterName, allSourceEntries, nicknameMap) {
  const normalized = normalizeName(rosterName)
  let best = null
  let bestScore = -1
  for (const entry of allSourceEntries) {
    const score = nameSimilarity(normalized, entry.normalized, nicknameMap)
    if (score > bestScore) { bestScore = score; best = entry }
  }
  return best
    ? { ...best, confidence: bestScore }
    : { raw: 'NOT FOUND', normalized: '', hasPhone: false, confidence: 0 }
}

function determineLikelyIssue(rosterName, closest, noPhoneSet, nicknameMap) {
  const normalized = normalizeName(rosterName)

  // Name IS in source but has no phone number
  if (noPhoneSet.has(normalized)) return 'NO_PHONE'
  if (closest.confidence >= 88 && !closest.hasPhone) return 'NO_PHONE'

  if (closest.confidence < 40) return 'NOT_IN_ROSTER'

  const tokensA = normalized.split(' ').filter(Boolean)
  const tokensB = closest.normalized.split(' ').filter(Boolean)

  // Nickname expansion explains the match
  if (tokensAllPresent(tokensA, tokensB, nicknameMap) || tokensAllPresent(tokensB, tokensA, nicknameMap)) {
    return 'NICKNAME'
  }

  // Typo: a mismatched token pair has small edit distance
  const setA = new Set(tokensA), setB = new Set(tokensB)
  const unmatchedA = tokensA.filter(t => !setB.has(t))
  const unmatchedB = tokensB.filter(t => !setA.has(t))
  if (unmatchedA.length > 0 && unmatchedB.length > 0) {
    const minEdit = Math.min(...unmatchedA.flatMap(a => unmatchedB.map(b => levenshtein(a, b))))
    if (minEdit <= 3) return 'TYPO'
  }

  if (closest.confidence >= 60) return 'NAME_FORMAT'
  return 'NOT_IN_ROSTER'
}

function generateSuggestedFix(issue, rosterName, closest) {
  const { raw, confidence, hasPhone } = closest
  const noPhone = raw !== 'NOT FOUND' && !hasPhone ? ' (note: that Roster Data entry also has no phone)' : ''

  switch (issue) {
    case 'NO_PHONE':
      return raw !== 'NOT FOUND'
        ? `Found in Roster Data as "${raw}" but no phone number on file — staff need to add their phone number`
        : `No phone number anywhere in the sheet — staff need to add this member to Roster Data with a phone number`
    case 'TYPO':
      return `Likely spelling error — roster has "${rosterName}", Roster Data has "${raw}"${noPhone} — fix the spelling in whichever sheet has the error`
    case 'NICKNAME':
      return `Nickname mismatch — roster has "${rosterName}", Roster Data has "${raw}"${noPhone} — standardize to one form in both sheets`
    case 'NAME_FORMAT':
      return `Name format differs — roster has "${rosterName}", closest in Roster Data is "${raw}" (${confidence}% match)${noPhone} — verify they are the same person and align the names`
    case 'NOT_IN_ROSTER':
      return raw !== 'NOT FOUND'
        ? `Not found in Roster Data (best guess "${raw}" at only ${confidence}%) — staff need to add this member with their phone number`
        : `Not found anywhere in Roster Data — staff need to add this member with their phone number`
    default:
      return 'Unknown issue — manual review needed'
  }
}

// Write rows as a properly quoted CSV string
function toCsv(rows) {
  return rows.map(row =>
    row.map(f => `"${String(f ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n')
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

  // Google auth can come from a service account (preferred for unattended runs) OR
  // the interactive OAuth flow. Only require the OAuth client creds when there's no service account.
  const usingServiceAccount = hasServiceAccountKey()

  const missing = []
  if (!GOOGLE_SHEET_ID) missing.push('GOOGLE_SHEET_ID')
  if (!usingServiceAccount) {
    if (!GOOGLE_OAUTH_CLIENT_ID) missing.push('GOOGLE_OAUTH_CLIENT_ID (or set GOOGLE_SERVICE_ACCOUNT_KEY)')
    if (!GOOGLE_OAUTH_CLIENT_SECRET) missing.push('GOOGLE_OAUTH_CLIENT_SECRET (or set GOOGLE_SERVICE_ACCOUNT_KEY)')
  }
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
  const phoneMap = new Map()          // normalizedName → phone (10-digit string)
  const circleLabelByName = new Map() // normalizedName → circle label
  const allSourceEntries = []         // { raw, normalized, hasPhone } — for skip report
  const noPhoneSet = new Set()        // normalized names that exist but have no valid phone

  const { headers: phoneHeaders, rows: phoneRows } = await readTab(sheets, GOOGLE_SHEET_ID, phoneSourceTab)
  console.log(`\nPhone source headers: ${phoneHeaders.join(' | ')}`)

  const phoneNameCol = findCol(phoneHeaders, 'Client Name', 'Full Name', 'Name')
  const phoneNumCol  = findCol(phoneHeaders, 'Number', 'Phone', 'Cell')
  const phoneCircCol = findCol(phoneHeaders, 'Circle Label', 'Recovery Circle', 'Circle')

  console.log(`  → name col: "${phoneNameCol}"  phone col: "${phoneNumCol}"  circle col: "${phoneCircCol}"`)

  let phoneMissing = 0
  for (const row of phoneRows) {
    const name   = row[phoneNameCol] || ''
    const phone  = normalizePhone(row[phoneNumCol] || '')
    const circle = row[phoneCircCol] || ''
    if (!name) continue

    const key = normalizeName(name)
    const hasPhone = phone.length === 10 && phone !== '0000000000'

    allSourceEntries.push({ raw: name, normalized: key, hasPhone })

    if (!hasPhone) { phoneMissing++; noPhoneSet.add(key); continue }
    phoneMap.set(key, phone)
    if (circle) circleLabelByName.set(key, circle)
  }
  console.log(`Loaded ${phoneMap.size} phone records (${phoneMissing} rows had no valid number).`)

  // --- Load Agency Data tab for real client IDs + phone fallback ---
  // findPhoneMatch works on any Map<normalizedName, string> — here we reuse it for non-phone values.
  const agencyClientIdMap = new Map()  // normalizedName → agency client_id string
  const agencyPhoneMap    = new Map()  // normalizedName → phone (10-digit), used when Roster Data has no number

  const agencyTabName = tabs.find(t => t === 'Agency Data') ?? null
  if (agencyTabName) {
    const { headers: agHeaders, rows: agRows } = await readTab(sheets, GOOGLE_SHEET_ID, agencyTabName)
    console.log(`\nAgency Data tab: "${agencyTabName}"`)
    console.log(`  headers: ${agHeaders.join(' | ')}`)

    const agIdCol    = findCol(agHeaders, 'Client ID', 'ClientID', 'Agency ID', 'ID')
    const agNameCol  = findCol(agHeaders, 'Client Name', 'Full Name', 'Name')
    const agPhoneCol = findCol(agHeaders, 'Client Number', 'Number', 'Phone', 'Cell')
    console.log(`  → id: "${agIdCol}"  name: "${agNameCol}"  phone: "${agPhoneCol}"`)

    for (const row of agRows) {
      const name = agNameCol ? (row[agNameCol] || '') : ''
      if (!name) continue
      const clientId = agIdCol    ? (row[agIdCol]    || '') : ''
      const phone    = normalizePhone(agPhoneCol ? (row[agPhoneCol] || '') : '')
      const key      = normalizeName(name)
      if (clientId) agencyClientIdMap.set(key, clientId)
      if (phone.length === 10 && phone !== '0000000000') agencyPhoneMap.set(key, phone)
    }
    console.log(`  Loaded ${agencyClientIdMap.size} client IDs, ${agencyPhoneMap.size} phones from Agency Data`)
  } else {
    console.warn('Agency Data tab not found — client_ids will fall back to row numbers')
  }

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
  let clientIdsFound = 0, phonesFromAgency = 0
  const memberIdByName = new Map()  // raw roster name → supabase member id
  const skippedMembers = []         // raw roster names that had no phone match (for skip report)
  const nicknameMap = buildNicknameMap()

  console.log('\n--- Upserting members ---')

  for (const row of mainRows) {
    const name = row[nameCol] || ''
    if (!name || /^\d+$/.test(name)) continue  // skip blank and pure-number rows

    // Phone: Roster Data first, Agency Data as fallback
    let phone = null
    const rosterMatch = findPhoneMatch(name, phoneMap, nicknameMap)
    if (rosterMatch) {
      phone = rosterMatch.phone
      if (rosterMatch.strategy !== 'exact') {
        console.log(`[match] "${name}" → "${rosterMatch.matchedKey}" via ${rosterMatch.strategy} (${rosterMatch.confidence}%)`)
      }
    } else if (agencyPhoneMap.size > 0) {
      const agPhoneMatch = findPhoneMatch(name, agencyPhoneMap, nicknameMap)
      if (agPhoneMatch) {
        phone = agPhoneMatch.phone
        phonesFromAgency++
        console.log(`[agency-phone] "${name}" → phone from Agency Data (${agPhoneMatch.strategy}, ${agPhoneMatch.confidence}%)`)
      }
    }

    if (!phone) {
      console.warn(`[member] no phone for "${name}" — skipping`)
      skippedMembers.push(name)
      membersSkipped++
      continue
    }

    // Client ID: prefer real Agency Data ID over row number
    let clientId = rowCol !== null ? (row[rowCol] || '') : ''
    if (agencyClientIdMap.size > 0) {
      const agIdMatch = findPhoneMatch(name, agencyClientIdMap, nicknameMap)
      if (agIdMatch) {
        clientId = agIdMatch.phone  // findPhoneMatch returns map value in .phone field
        clientIdsFound++
      }
    }
    const circleLabel = (circleCol ? row[circleCol] : '') || circleLabelByName.get(rosterMatch?.matchedKey) || ''
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
      memberIdByName.set(name, data.id)
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
    const memberId = memberIdByName.get(name)
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
  console.log(`Members:             ${membersUpserted} upserted, ${membersSkipped} skipped (no phone match)`)
  console.log(`Attendance:          ${attendanceUpserted} upserted, ${attendanceErrors} errors`)
  console.log(`Client IDs updated:  ${clientIdsFound} from Agency Data${clientIdsFound < membersUpserted ? ` (${membersUpserted - clientIdsFound} fell back to row number)` : ''}`)
  console.log(`Phones from Agency:  ${phonesFromAgency} members got phone from Agency Data (not in Roster Data)`)

  // --- Generate skip report CSV ---
  if (skippedMembers.length > 0) {
    console.log(`\nGenerating skip report for ${skippedMembers.length} unmatched members...`)

    const csvRows = [
      ['name_in_roster', 'closest_match_found', 'match_confidence', 'likely_issue', 'suggested_fix'],
    ]

    for (const name of skippedMembers) {
      const closest = findClosestInSource(name, allSourceEntries, nicknameMap)
      const issue   = determineLikelyIssue(name, closest, noPhoneSet, nicknameMap)
      const fix     = generateSuggestedFix(issue, name, closest)

      csvRows.push([
        name,
        closest.raw,
        `${closest.confidence}%`,
        issue,
        fix,
      ])
    }

    let reportPath = join(__dirname, '..', 'skip-report.csv')
    try {
      writeFileSync(reportPath, toCsv(csvRows), 'utf-8')
    } catch (e) {
      if (e.code === 'EBUSY') {
        reportPath = join(__dirname, '..', `skip-report-${Date.now()}.csv`)
        writeFileSync(reportPath, toCsv(csvRows), 'utf-8')
        console.log('(skip-report.csv was locked — wrote to alternate file)')
      } else throw e
    }
    console.log(`Skip report saved to: ${reportPath}`)
  }
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
