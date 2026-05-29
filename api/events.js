// api/events.js — Vercel serverless function
// GET /api/events
// Returns merged events from Programs + School for Recovery calendars.
// One calendar failure does not suppress the other.

import { fetchCalendarEvents, calendarId } from './_calendar.js'

// Events whose title contains any of these words (case-insensitive) are hidden from members.
// Edit this list to add or remove staff-only event types.
const STAFF_KEYWORDS = ['staff', 'meeting', 'board', 'admin', 'volunteer training']

function isStaffEvent(title) {
  const t = (title || '').toLowerCase()
  return STAFF_KEYWORDS.some(kw => t.includes(kw))
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  const programsId = calendarId('PROGRAMS')
  const schoolId   = calendarId('SCHOOL')

  if (!programsId && !schoolId) {
    res.writeHead(500)
    res.end(JSON.stringify({ error: 'No calendar IDs configured. Set CALENDAR_PROGRAMS and CALENDAR_SCHOOL env vars.' }))
    return
  }

  const results = await Promise.allSettled([
    programsId ? fetchCalendarEvents(programsId, 'auto') : Promise.resolve([]),
    schoolId   ? fetchCalendarEvents(schoolId,   'School for Recovery') : Promise.resolve([]),
  ])

  const warnings = []
  const events   = []

  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      events.push(...result.value)
    } else {
      const name = i === 0 ? 'Programs' : 'School for Recovery'
      warnings.push(`${name} calendar failed: ${result.reason?.message || result.reason}`)
      console.error(`[api/events] ${name} calendar error:`, result.reason)
    }
  }

  const filtered = events.filter(e => !isStaffEvent(e.title))

  // Sort by epoch ms — avoids re-parsing localized time strings entirely.
  filtered.sort((a, b) => a._ms - b._ms)

  // Log each event so you can verify sort order in the API server terminal.
  for (const e of filtered) {
    const mins = Math.round((e._ms % 86400000) / 60000)
    console.log(`[sort] ${e.event_date} ${String(e.event_time).padEnd(10)} (${mins} min) — ${e.title}`)
  }

  // Strip internal sort key before sending to the frontend.
  for (const e of filtered) delete e._ms

  res.writeHead(200)
  res.end(JSON.stringify({ events: filtered, warnings }))
}
