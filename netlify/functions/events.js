// netlify/functions/events.js
// GET /api/events  (redirected via netlify.toml)

const { fetchCalendarEvents, calendarId } = require('./_calendar.js')

const STAFF_KEYWORDS = ['staff', 'meeting', 'board', 'admin', 'volunteer training']

function isStaffEvent(title) {
  const t = (title || '').toLowerCase()
  return STAFF_KEYWORDS.some(function(kw) { return t.includes(kw) })
}

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

exports.handler = async function() {
  console.log('[events] env check:', {
    GOOGLE_OAUTH_CLIENT_ID:     !!process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_TOKEN_JSON:          !!process.env.GOOGLE_TOKEN_JSON,
    GOOGLE_TOKEN_preview: process.env.GOOGLE_TOKEN_JSON
      ? process.env.GOOGLE_TOKEN_JSON.slice(0, 20)
      : '(not set)',
    CALENDAR_PROGRAMS: process.env.CALENDAR_PROGRAMS || process.env.VITE_CALENDAR_PROGRAMS || '(not set)',
    CALENDAR_SCHOOL:   process.env.CALENDAR_SCHOOL   || process.env.VITE_CALENDAR_SCHOOL   || '(not set)',
    CALENDAR_CIRCLES:  process.env.CALENDAR_CIRCLES  || process.env.VITE_CALENDAR_CIRCLES  || '(not set)',
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
        warnings.push(name + ' calendar failed: ' + (result.reason && result.reason.message || result.reason))
        console.error('[events] ' + name + ' calendar error:', result.reason)
      }
    }

    const filtered = events.filter(function(e) { return !isStaffEvent(e.title) })
    filtered.sort(function(a, b) { return a._ms - b._ms })
    filtered.forEach(function(e) { delete e._ms })

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
