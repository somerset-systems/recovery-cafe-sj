/*
 * parseCircleLabel — turns a raw circle label string into { day, time, leader }.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SUPPORTED FORMATS (all parsed case-insensitively, tolerant of extra spaces)
 * ───────────────────────────────────────────────────────────────────────────
 *   "Mon 11:30 (Delfina)"        → { day:'Monday',  time:'11:30 AM', leader:'Delfina' }
 *   "Tue@1:30pm,Ferry, L"        → { day:'Tuesday', time:'1:30 PM',  leader:'L. Ferry' }
 *
 * Plus many real-world variants of those two shapes, e.g.:
 *   "Monday 11:30 (Delfina)"     full day name
 *   "monday 11:30 am (delfina)"  lowercase + explicit am/pm
 *   "Wed  1pm  (Sam)"            no minutes, irregular spacing
 *   "Fri noon (Laura)"           the word "noon" (also "midnight")
 *   "Thu 10:00"                  no leader at all          → leader:null
 *   "Mon (Delfina)"              no time                   → time:null
 *   "11:30 (Delfina)"            no day                    → day:null
 *   "Tue@1pm,Ferry"             format-2 with no leader initial
 *
 * ───────────────────────────────────────────────────────────────────────────
 * RETURN CONTRACT  (changed: now degrades gracefully)
 * ───────────────────────────────────────────────────────────────────────────
 * Returns an object { day, time, leader } where EACH FIELD is either a
 * non-empty string or `null`. We extract whatever we can and leave the rest
 * null rather than failing the whole parse — a partial result still lets the
 * Circle tab render (a null field just renders as empty/blank in the UI).
 *
 * Returns `null` ONLY when the input is unusable (empty / non-string) OR when
 * not a single field could be recovered. Callers that previously relied on a
 * truthy return for "parsed" still work; callers reading `.day`/`.time`/
 * `.leader` must treat each as possibly-null (the Supabase columns are
 * nullable, and the React UI already tolerates blank values).
 *
 * Every label that does not parse 100% cleanly is logged via debug(), noting
 * exactly which fields were recovered, so staff can spot bad sheet data.
 */

const debug = (...args) => {
  // Browser (Vite) exposes import.meta.env.DEV; guard so this file is also
  // importable from plain Node (tests / sync script) without import.meta.env.
  const isDev =
    (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production')
  if (isDev) console.warn('[parseCircleLabel]', ...args)
}

// Accepts abbreviations and full names, any case.
const DAY_MAP = {
  mon: 'Monday', monday: 'Monday',
  tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
  wed: 'Wednesday', weds: 'Wednesday', wednesday: 'Wednesday',
  thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', thursday: 'Thursday',
  fri: 'Friday', friday: 'Friday',
  sat: 'Saturday', saturday: 'Saturday',
  sun: 'Sunday', sunday: 'Sunday',
}

// Format an hour/minute/period into a clean "h:mm AM/PM" display string.
// `isPm` may be true, false, or null (unknown → infer from a sensible default).
function formatTime(hour, minute, isPm) {
  let h = parseInt(hour, 10)
  if (Number.isNaN(h)) return null
  const m = String(minute ?? 0).padStart(2, '0')

  // When am/pm is unknown, guess based on cafe hours: 1–6 and 12 read as PM,
  // 7–11 read as AM. This matches the existing sync-script heuristic.
  if (isPm === null) {
    isPm = (h >= 1 && h <= 6) || h === 12
  }

  if (isPm && h < 12) h += 12
  if (!isPm && h === 12) h = 0
  const period = h >= 12 ? 'PM' : 'AM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:${m} ${period}`
}

// Pull a day name out of arbitrary text. Returns full day name or null.
function extractDay(text) {
  // Match the first word-ish token that maps to a known day.
  const tokens = text.toLowerCase().match(/[a-z]+/g) || []
  for (const tok of tokens) {
    if (DAY_MAP[tok]) return DAY_MAP[tok]
  }
  return null
}

// Pull a time out of arbitrary text. Handles "11:30", "1pm", "1:30 pm",
// "noon", "midnight". Returns a formatted display string or null.
function extractTime(text) {
  const lower = text.toLowerCase()

  if (/\bnoon\b/.test(lower)) return formatTime(12, 0, true)
  if (/\bmidnight\b/.test(lower)) return formatTime(12, 0, false)

  // hour, optional :minutes, optional am/pm (with or without a space)
  const m = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (!m) return null
  const [, hour, minute, ampm] = m
  const h = parseInt(hour, 10)
  // Sanity: ignore matches that are clearly not a clock time.
  if (h < 0 || h > 23) return null

  let isPm
  if (ampm) isPm = ampm === 'pm'
  else if (h === 0) isPm = false
  else isPm = null // unknown — let formatTime() apply the cafe-hours heuristic

  return formatTime(hour, minute ?? '00', isPm)
}

/**
 * Parse a circle label. See the header block for the full contract.
 * @param {string} label
 * @returns {{day: string|null, time: string|null, leader: string|null}|null}
 */
export function parseCircleLabel(label) {
  if (!label || typeof label !== 'string') {
    debug('empty or non-string label', label)
    return null
  }

  const trimmed = label.trim()

  // ── Fast path: the two canonical formats, parsed exactly as before so their
  // output is byte-for-byte identical to the original implementation. ──

  // Format 1: "Mon 11:30 (Delfina)" / "Monday 11:30 (Delfina)"
  const fmt1 = trimmed.match(/^([A-Za-z]{3,9})\s+(\d{1,2}):(\d{2})\s*\(([^)]+)\)/i)
  if (fmt1) {
    const [, dayAbbr, hour, minute, leader] = fmt1
    const day = DAY_MAP[dayAbbr.toLowerCase()]
    if (day) {
      const lower = trimmed.toLowerCase()
      // Explicit am/pm wins; otherwise apply the cafe-hours heuristic.
      const isPm = lower.includes('pm')
        ? true
        : lower.includes('am')
          ? false
          : null
      return { day, time: formatTime(hour, minute, isPm), leader: leader.trim() }
    }
    // Unknown day word — fall through to liberal extraction below.
  }

  // Format 2: "Tue@1:30pm,Ferry, L"
  const fmt2 = trimmed.match(/^([A-Za-z]{3,9})@(\d{1,2}):(\d{2})(am|pm),([^,]+),\s*([A-Za-z])/i)
  if (fmt2) {
    const [, dayAbbr, hour, minute, ampm, lastName, initial] = fmt2
    const day = DAY_MAP[dayAbbr.toLowerCase()]
    if (day) {
      const isPm = ampm.toLowerCase() === 'pm'
      const leader = `${initial.toUpperCase()}. ${lastName.trim()}`
      return { day, time: formatTime(hour, minute, isPm), leader }
    }
    // Unknown day word — fall through.
  }

  // ── Liberal path: extract whatever we can from anything else. ──
  const day = extractDay(trimmed)
  const time = extractTime(trimmed)
  const leader = extractLeader(trimmed)

  // If nothing at all came out, this label is unusable.
  if (!day && !time && !leader) {
    debug('could not parse label (no fields recovered)', label)
    return null
  }

  // Partial success — log which fields are missing so staff can fix the sheet.
  const missing = []
  if (!day) missing.push('day')
  if (!time) missing.push('time')
  if (!leader) missing.push('leader')
  if (missing.length > 0) {
    debug(
      `partial parse of "${label}" — recovered {` +
        `day:${day ? `"${day}"` : 'null'}, ` +
        `time:${time ? `"${time}"` : 'null'}, ` +
        `leader:${leader ? `"${leader}"` : 'null'}}; ` +
        `missing: ${missing.join(', ')}`
    )
  }

  return { day, time, leader }
}

// Pull a leader name out of arbitrary text. Handles:
//   "(Delfina)"            parenthesized first name
//   ",Ferry, L"           "lastname, initial" → "L. Ferry"
//   ", Laura"              trailing name after a comma
// Returns a display string or null.
function extractLeader(text) {
  // 1) Parenthesized name is the clearest signal: "... (Delfina)".
  const paren = text.match(/\(([^)]+)\)/)
  if (paren) {
    const inner = paren[1].trim()
    if (inner) return inner
  }

  // 2) Format-2 style "...,LastName, X" → "X. LastName".
  const lastFirstInitial = text.match(/,\s*([A-Za-z][A-Za-z'-]+)\s*,\s*([A-Za-z])\b/)
  if (lastFirstInitial) {
    const [, lastName, initial] = lastFirstInitial
    return `${initial.toUpperCase()}. ${lastName.trim()}`
  }

  // 3) A single trailing name after a comma: "Tue@1pm,Ferry".
  //    Skip if the segment is just a stray initial.
  const trailing = text.match(/,\s*([A-Za-z][A-Za-z'-]+)\s*$/)
  if (trailing) {
    const name = trailing[1].trim()
    if (name.length > 1) return name
  }

  return null
}
