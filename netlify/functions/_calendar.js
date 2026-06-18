// netlify/functions/_calendar.js — shared Google Calendar helper (CommonJS).
// Prefixed with _ so Netlify does not expose it as a function endpoint.
//
// Credential loading order:
//   1. Env vars  GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET + GOOGLE_TOKEN_JSON  (Netlify prod)
//   2. Files     google-credentials.json + .google-token.json                              (local dev)

const { google } = require('googleapis')
const { readFileSync, existsSync } = require('fs')
const { join } = require('path')

const ROOT = process.cwd()

// ── Credential / token loading ────────────────────────────────────────────────

function getClientSecrets() {
  if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return { clientId: process.env.GOOGLE_OAUTH_CLIENT_ID, clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET }
  }
  for (const name of ['google-credentials.json', 'google-credentials.json.json']) {
    const p = join(ROOT, name)
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, 'utf-8'))
      const creds = raw.installed || raw.web
      if (creds) return { clientId: creds.client_id, clientSecret: creds.client_secret }
    }
  }
  throw new Error(
    'Google credentials not found. Set GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET env vars, ' +
    'or place google-credentials.json in the project root.'
  )
}

function getToken() {
  if (process.env.GOOGLE_TOKEN_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_TOKEN_JSON)
    } catch (e) {
      throw new Error(`GOOGLE_TOKEN_JSON is set but not valid JSON: ${e.message}`)
    }
  }
  const p = join(ROOT, '.google-token.json')
  if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8'))
  throw new Error(
    'Google token not found. Set GOOGLE_TOKEN_JSON env var in the Netlify dashboard, ' +
    'or place .google-token.json in the project root for local dev.'
  )
}

// Checks CALENDAR_* first, then VITE_CALENDAR_* (Netlify exposes all dashboard vars to functions).
function calendarId(name) {
  return process.env[`CALENDAR_${name}`] || process.env[`VITE_CALENDAR_${name}`] || null
}

// ── Client factory ────────────────────────────────────────────────────────────

// Preferred auth: a Google service account, whose key never expires. Source A is the
// GOOGLE_SERVICE_ACCOUNT_KEY env var (Netlify); source B is a google-credentials.json
// file holding a service-account key (local). The calendars must be shared (read) with
// the service account's client_email. Returns parsed creds or null if none configured.
function getServiceAccountCreds() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
    } catch (e) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is set but not valid JSON: ' + e.message)
    }
  }
  const p = join(ROOT, 'google-credentials.json')
  if (existsSync(p)) {
    const raw = JSON.parse(readFileSync(p, 'utf-8'))
    if (raw.type === 'service_account') return raw
  }
  return null
}

function createClient() {
  // Service account first (never expires). Falls back to the legacy personal-OAuth
  // token only if no service account is configured, so existing setups keep working.
  const sa = getServiceAccountCreds()
  if (sa) {
    const auth = new google.auth.GoogleAuth({
      credentials: sa,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    })
    return google.calendar({ version: 'v3', auth })
  }

  const { clientId, clientSecret } = getClientSecrets()
  const token = getToken()
  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials(token)
  return google.calendar({ version: 'v3', auth })
}

// ── Tag inference ─────────────────────────────────────────────────────────────

function inferTag(summary) {
  const s = (summary || '').toLowerCase()
  if (/\b(music|jam|concert|guitar|band)\b/.test(s)) return 'Music'
  return 'Event'
}

// ── Item parser ───────────────────────────────────────────────────────────────

// The cafe is in San Jose — always render dates/times in Pacific time, regardless
// of the server's timezone. Netlify functions run in UTC, so without an explicit
// timeZone every time came out 7-8 hours off.
const TZ = 'America/Los_Angeles'

function formatTime(dateTimeStr) {
  return new Date(dateTimeStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
}

// "10:30 – 11:30 AM" (full length). When start and end share AM/PM we drop the
// first one for compactness; a missing end falls back to just the start time.
function formatTimeRange(startStr, endStr) {
  const start = formatTime(startStr)
  if (!endStr) return start
  const end = formatTime(endStr)
  const sameMeridiem = start.slice(-2) === end.slice(-2)
  const startLabel = sameMeridiem ? start.replace(/\s*[AP]M$/, '') : start
  return `${startLabel} – ${end}`
}

// Calendar date (YYYY-MM-DD) in Pacific time. en-CA formats as YYYY-MM-DD.
function dateInTZ(dateTimeStr) {
  return new Date(dateTimeStr).toLocaleDateString('en-CA', { timeZone: TZ })
}

function parseItem(item, tag) {
  // Timed events have start.dateTime; all-day events have start.date (a plain
  // YYYY-MM-DD with no time/zone, which must NOT be timezone-shifted).
  const hasTime  = !!(item.start && item.start.dateTime)
  const startRaw = item.start && (item.start.dateTime || item.start.date)
  const endRaw   = item.end && (item.end.dateTime || item.end.date)
  const d = new Date(startRaw)
  return {
    id:         item.id,
    title:      item.summary || 'Event',
    event_date: hasTime ? dateInTZ(item.start.dateTime) : startRaw.slice(0, 10),
    event_time: hasTime ? formatTimeRange(item.start.dateTime, endRaw) : null,
    _ms:        d.getTime(),
    location:   item.location || null,
    tag,
  }
}

// ── Public helpers ────────────────────────────────────────────────────────────

async function fetchCalendarEvents(calId, tag, options) {
  const daysAhead  = (options && options.daysAhead)  || 30
  const maxResults = (options && options.maxResults) || 100
  const cal = createClient()
  const now = new Date()
  const max = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)
  const res = await cal.events.list({
    calendarId:   calId,
    timeMin:      now.toISOString(),
    timeMax:      max.toISOString(),
    singleEvents: true,
    orderBy:      'startTime',
    maxResults:   String(maxResults),
  })
  return (res.data.items || []).map(function(item) {
    return parseItem(item, tag === 'auto' ? inferTag(item.summary) : tag)
  })
}

async function findCircleLocation(leaderName) {
  const calId = calendarId('CIRCLES')
  if (!calId) return null
  const cal = createClient()
  const now = new Date()
  const max = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)
  const res = await cal.events.list({
    calendarId:   calId,
    timeMin:      now.toISOString(),
    timeMax:      max.toISOString(),
    singleEvents: true,
    orderBy:      'startTime',
    maxResults:   50,
  })
  const keyword = leaderName
    .replace(/\./g, '')
    .split(/\s+/)
    .filter(function(w) { return w.length >= 3 })
    .sort(function(a, b) { return b.length - a.length })[0]
  if (!keyword) return null
  const kw = keyword.toLowerCase()
  const match = (res.data.items || []).find(function(item) {
    const haystack = ((item.summary || '') + ' ' + (item.description || '')).toLowerCase()
    return haystack.includes(kw)
  })
  return (match && match.location) || null
}

module.exports = { fetchCalendarEvents, findCircleLocation, calendarId }
