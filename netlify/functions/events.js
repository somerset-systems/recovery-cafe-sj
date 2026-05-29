// netlify/functions/events.js
// GET /api/events  (redirected via netlify.toml)

import { fetchCalendarEvents, calendarId } from './_calendar.js'

const STAFF_KEYWORDS = ['staff', 'meeting', 'board', 'admin', 'volunteer training']

function isStaffEvent(title) {
  const t = (title || '').toLowerCase()
  return STAFF_KEYWORDS.some(kw => t.includes(kw))
}

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

export const handler = async () => {
  // ── Env diagnostics (safe — never logs actual secret values) ─────────────
  console.log('[events] env check:', {
    GOOGLE_OAUTH_CLIENT_ID:     !!process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_TOKEN_JSON:          !!process.env.GOOGLE_TOKEN_JSON,
    GOOGLE_TOKEN_preview: process.env.GOOGLE_TOKEN_JSON
      ? process.env.GOOGLE_TOKEN_JSON.slice(0, 20)
      : '(not set)',
    CALENDAR_PROGRAMS:    process.env.CALENDAR_PROGRAMS || process.env.VITE_CALENDAR_PROGRAMS || '(not set)',
    CALENDAR_SCHOOL:      process.env.CALENDAR_SCHOOL   || process.env.VITE_CALENDAR_SCHOOL   || '(not set)',
    CALENDAR_CIRCLES:     process.env.CALENDAR_CIRCLES  || process.env.VITE_CALENDAR_CIRCLES  || '(not set)',
  })

  try {
    const programsId = calendarId('PROGRAMS')
    const schoolId   = calendarId('SCHOOL')

    if (!programsId && !schoolId) {
      return {
        statusCode: 500,
        headers: HEADERS,
        body: JSON.stringify({ error: 'No calendar IDs configured. Set CALENDAR_PROGRAMS and CALENDAR_SCHOOL env vars.' }),
      }
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
        console.error(`[events] ${name} calendar error:`, result.reason)
      }
    }

    const filtered = events.filter(e => !isStaffEvent(e.title))
    filtered.sort((a, b) => a._ms - b._ms)

    for (const e of filtered) {
      const mins = Math.round((e._ms % 86400000) / 60000)
      console.log(`[sort] ${e.event_date} ${String(e.event_time).padEnd(10)} (${mins} min) — ${e.title}`)
    }

    for (const e of filtered) delete e._ms

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ events: filtered, warnings }),
    }
  } catch (err) {
    console.error('[events] unhandled error:', err)
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: err.message, stack: err.stack }),
    }
  }
}
