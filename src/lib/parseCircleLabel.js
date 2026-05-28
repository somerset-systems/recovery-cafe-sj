const debug = (...args) => {
  if (import.meta.env?.DEV) console.warn('[parseCircleLabel]', ...args)
}

const DAY_MAP = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
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

/**
 * Parses a circle label string into structured parts.
 *
 * Supported formats:
 *   "Mon 11:30 (Delfina)"       → Format 1
 *   "Tue@1:30pm,Ferry, L"       → Format 2
 *
 * Returns { day, time, leader } or null if parsing fails.
 */
export function parseCircleLabel(label) {
  if (!label || typeof label !== 'string') {
    debug('empty or non-string label', label)
    return null
  }

  const trimmed = label.trim()

  // Format 1: "Mon 11:30 (Delfina)"
  const fmt1 = trimmed.match(/^(\w{3})\s+(\d{1,2}):(\d{2})\s*\(([^)]+)\)/i)
  if (fmt1) {
    const [, dayAbbr, hour, minute, leader] = fmt1
    const day = DAY_MAP[dayAbbr.toLowerCase()]
    if (!day) {
      debug('unknown day abbreviation in format 1', dayAbbr, label)
      return null
    }
    const isPm = parseInt(hour, 10) >= 12 || trimmed.toLowerCase().includes('pm')
    return { day, time: formatTime(hour, minute, isPm), leader: leader.trim() }
  }

  // Format 2: "Tue@1:30pm,Ferry, L"
  const fmt2 = trimmed.match(/^(\w{3})@(\d{1,2}):(\d{2})(am|pm),([^,]+),\s*(\w)/i)
  if (fmt2) {
    const [, dayAbbr, hour, minute, ampm, lastName, initial] = fmt2
    const day = DAY_MAP[dayAbbr.toLowerCase()]
    if (!day) {
      debug('unknown day abbreviation in format 2', dayAbbr, label)
      return null
    }
    const isPm = ampm.toLowerCase() === 'pm'
    const leader = `${initial.toUpperCase()}. ${lastName.trim()}`
    return { day, time: formatTime(hour, minute, isPm), leader }
  }

  debug('could not parse label', label)
  return null
}
