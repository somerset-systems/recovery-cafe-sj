// netlify/functions/events.js
// GET /api/events  (redirected via netlify.toml)

const { fetchCalendarEvents, calendarId } = require('./_calendar.js')

const STAFF_KEYWORDS = ['staff', 'meeting', 'board', 'admin', 'volunteer training']

function isStaffEvent(title) {
  const t = (title || '').toLowerCase()
  return STAFF_KEYWORDS.some(function(kw) { return t.includes(kw) })
}

// Recurring weekly schedule — shown as fallback when Google Calendar is unavailable.
// Day: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
var RECURRING = [
  { day: 1, time: '1:00 PM',  title: 'Barista Training',          location: 'Kitchen',   tag: 'Class' },
  { day: 2, time: '10:00 AM', title: 'Art Workshop',               location: 'Main Hall', tag: 'Event' },
  { day: 2, time: '1:00 PM',  title: 'Cooking Skills',             location: 'Kitchen',   tag: 'Class' },
  { day: 3, time: '10:00 AM', title: 'Mindfulness & Meditation',   location: 'Room B',    tag: 'Class' },
  { day: 4, time: '10:00 AM', title: 'Job Readiness Skills',       location: 'Room A',    tag: 'Class' },
  { day: 5, time: '2:00 PM',  title: 'Friday Jam',                 location: 'Cafe Floor',tag: 'Music' },
]

function generateFallbackEvents() {
  var today = new Date()
  var cutoff = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  var events = []
  var id = 1
  var d = new Date(today)
  d.setHours(0, 0, 0, 0)

  while (d <= cutoff) {
    var dow = d.getDay()
    for (var i = 0; i < RECURRING.length; i++) {
      var r = RECURRING[i]
      if (dow === r.day) {
        events.push({
          id:         'fallback-' + id++,
          title:      r.title,
          event_date: d.toISOString().slice(0, 10),
          event_time: r.time,
          location:   r.location,
          tag:        r.tag,
        })
      }
    }
    d.setDate(d.getDate() + 1)
  }
  return events
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
      console.warn('[events] No calendar IDs configured — returning fallback schedule')
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({ events: generateFallbackEvents(), warnings: ['Using fallback schedule — calendar not configured'] }),
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

    // If both calendars returned nothing (e.g. token works but no events) use the fallback
    const finalEvents = filtered.length > 0 ? filtered : generateFallbackEvents()
    if (filtered.length === 0 && warnings.length === 0) {
      warnings.push('No calendar events found — showing fallback schedule')
    }

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ events: finalEvents, warnings }),
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
