// netlify/functions/_calendar.js — shared Google Calendar helper for Netlify functions.
// Prefixed with _ so Netlify does not expose it as a function endpoint.
//
// This is a copy of api/_calendar.js with one change: import.meta.url (ESM-only) is
// replaced with process.cwd() because Netlify's esbuild bundles functions to CJS format,
// which makes import.meta.url undefined at runtime.
//
// Credential loading order:
//   1. Env vars  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET + GOOGLE_TOKEN_JSON  (Netlify prod)
//   2. Files     google-credentials.json + .google-token.json                   (local dev)

import { google } from 'googleapis'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// process.cwd() is the project root in both `netlify dev` and production Lambda context.
const ROOT = process.cwd()

// ── Credential / token loading ────────────────────────────────────────────────

function getClientSecrets() {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
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
    'Google credentials not found. Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET env vars, ' +
    'or place google-credentials.json in the project root.'
  )
}

function getToken() {
  if (process.env.GOOGLE_TOKEN_JSON) {
    return JSON.parse(process.env.GOOGLE_TOKEN_JSON)
  }
  const p = join(ROOT, '.google-token.json')
  if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8'))
  throw new Error(
    'Google token not found. Set GOOGLE_TOKEN_JSON env var in the Netlify dashboard, ' +
    'or place .google-token.json in the project root for local dev.'
  )
}

function calendarId(name) {
  return process.env[`CALENDAR_${name}`] || process.env[`VITE_CALENDAR_${name}`] || null
}

// ── Client factory ────────────────────────────────────────────────────────────

function createClient() {
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

function formatTime(dateTimeStr) {
  return new Date(dateTimeStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function parseItem(item, tag) {
  const startRaw = item.start?.dateTime || item.start?.date
  const d = new Date(startRaw)
  return {
    id:         item.id,
    title:      item.summary || 'Event',
    event_date: d.toISOString().slice(0, 10),
    event_time: item.start?.dateTime ? formatTime(item.start.dateTime) : null,
    _ms:        d.getTime(),
    location:   item.location || null,
    tag,
  }
}

// ── Public helpers ────────────────────────────────────────────────────────────

export async function fetchCalendarEvents(calId, tag, { daysAhead = 30, maxResults = 100 } = {}) {
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
  return (res.data.items || []).map(item => parseItem(item, tag === 'auto' ? inferTag(item.summary) : tag))
}

export async function findCircleLocation(leaderName) {
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
    .filter(w => w.length >= 3)
    .sort((a, b) => b.length - a.length)[0]
    ?.toLowerCase()
  if (!keyword) return null
  const match = (res.data.items || []).find(item => {
    const haystack = `${item.summary || ''} ${item.description || ''}`.toLowerCase()
    return haystack.includes(keyword)
  })
  return match?.location || null
}

export { calendarId }
