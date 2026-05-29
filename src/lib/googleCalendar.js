// src/lib/googleCalendar.js
// Fetches calendar data from the /api proxy (Vercel serverless functions).
// No credentials or API keys are needed in the frontend.

export async function fetchProgramEvents() {
  return fetchEvents()
}

export async function fetchSchoolEvents() {
  // School events are included in the /api/events response — no separate call needed.
  return []
}

// Both Programs and School events are returned together from /api/events.
// Call this once and use the result directly.
export async function fetchAllEvents() {
  const res = await fetch('/api/events')
  if (!res.ok) throw new Error(`Events API returned ${res.status}`)
  const body = await res.json()
  if (body.warnings?.length) {
    for (const w of body.warnings) console.warn('[calendar]', w)
  }
  return body.events || []
}

// fetchProgramEvents / fetchSchoolEvents are kept for compatibility.
// Events.jsx calls fetchAllEvents directly instead.
async function fetchEvents() {
  return []
}

// Fetch location for a member's circle leader via the proxy.
// Fails silently — returns null if unavailable.
export async function fetchCircleLocation(leaderName) {
  if (!leaderName) return null
  try {
    const res = await fetch(`/api/circle-location?leader=${encodeURIComponent(leaderName)}`)
    if (!res.ok) return null
    const body = await res.json()
    return body.location || null
  } catch {
    return null
  }
}
