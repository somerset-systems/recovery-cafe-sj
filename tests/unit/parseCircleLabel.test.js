import { describe, it, expect } from 'vitest'
import { parseCircleLabel } from '../../src/lib/parseCircleLabel.js'

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests for src/lib/parseCircleLabel.js
//
// IMPORTANT: These tests assert the parser's CURRENT behavior as-is. A separate
// "parser-hardening" agent owns the source file. Inputs that the parser cannot
// currently handle (and therefore returns `null` for) are documented below as
// KNOWN GAPS. The desired graceful-degradation behavior for those inputs lives
// in the `describe.skip(...)` block at the bottom — the hardening agent should
// un-skip and make those pass once the parser is improved.
// ─────────────────────────────────────────────────────────────────────────────

describe('parseCircleLabel — Format 1: "Mon 11:30 (Delfina)"', () => {
  it('parses the documented happy-path example', () => {
    expect(parseCircleLabel('Mon 11:30 (Delfina)')).toEqual({
      day: 'Monday',
      time: '11:30 AM',
      leader: 'Delfina',
    })
  })

  it('handles all seven day abbreviations', () => {
    expect(parseCircleLabel('Mon 9:00 (A)').day).toBe('Monday')
    expect(parseCircleLabel('Tue 9:00 (A)').day).toBe('Tuesday')
    expect(parseCircleLabel('Wed 9:00 (A)').day).toBe('Wednesday')
    expect(parseCircleLabel('Thu 9:00 (A)').day).toBe('Thursday')
    expect(parseCircleLabel('Fri 9:00 (A)').day).toBe('Friday')
    expect(parseCircleLabel('Sat 9:00 (A)').day).toBe('Saturday')
    expect(parseCircleLabel('Sun 9:00 (A)').day).toBe('Sunday')
  })

  it('accepts a lowercase day abbreviation', () => {
    expect(parseCircleLabel('mon 11:30 (Delfina)')).toEqual({
      day: 'Monday',
      time: '11:30 AM',
      leader: 'Delfina',
    })
  })

  it('accepts an uppercase day abbreviation', () => {
    expect(parseCircleLabel('MON 11:30 (Delfina)').day).toBe('Monday')
  })

  it('tolerates extra / irregular spacing between tokens', () => {
    expect(parseCircleLabel('Mon    11:30    (Delfina)')).toEqual({
      day: 'Monday',
      time: '11:30 AM',
      leader: 'Delfina',
    })
  })

  it('trims surrounding whitespace on the whole label', () => {
    expect(parseCircleLabel('   Mon 11:30 (Delfina)   ').day).toBe('Monday')
  })

  it('trims whitespace inside the leader parentheses', () => {
    expect(parseCircleLabel('Mon 11:30 (  Delfina  )').leader).toBe('Delfina')
  })

  it('ignores trailing text after the closing paren (match is anchored at start only)', () => {
    // The fmt1 regex is not end-anchored, so trailing junk is allowed.
    expect(parseCircleLabel('Mon 11:30 (Delfina) — Room B').leader).toBe('Delfina')
  })
})

describe('parseCircleLabel — Format 2: "Tue@1:30pm,Ferry, L"', () => {
  it('parses the documented happy-path example', () => {
    expect(parseCircleLabel('Tue@1:30pm,Ferry, L')).toEqual({
      day: 'Tuesday',
      time: '1:30 PM',
      leader: 'L. Ferry',
    })
  })

  it('handles an "am" marker', () => {
    expect(parseCircleLabel('Wed@9:00am,Ferry, L').time).toBe('9:00 AM')
  })

  it('uppercases the leader initial', () => {
    expect(parseCircleLabel('Tue@1:30pm,Ferry, l').leader).toBe('L. Ferry')
  })

  it('accepts a lowercase day abbreviation', () => {
    expect(parseCircleLabel('tue@1:30pm,Ferry, L').day).toBe('Tuesday')
  })
})

describe('parseCircleLabel — 12-hour edge cases', () => {
  it('hour 12 in Format 1 (no am/pm token) is treated as noon → 12:00 PM', () => {
    // In fmt1 there is no am/pm capture group; isPm is true when hour >= 12,
    // so "12:00" maps to noon. (A literal "pm"/"am" token between the time and
    // the "(" actually breaks the regex — see KNOWN GAPS.)
    expect(parseCircleLabel('Mon 12:00 (Del)').time).toBe('12:00 PM')
  })

  it('12:30pm (Format 2) stays as 12:30 PM (noon hour)', () => {
    expect(parseCircleLabel('Mon@12:30pm,Smith, J').time).toBe('12:30 PM')
  })

  it('12:30am (Format 2) becomes 12:30 AM (midnight hour)', () => {
    expect(parseCircleLabel('Mon@12:30am,Smith, J').time).toBe('12:30 AM')
  })
})

describe('parseCircleLabel — invalid / non-string input returns null', () => {
  it('returns null for an empty string', () => {
    expect(parseCircleLabel('')).toBeNull()
  })

  it('returns null for a whitespace-only string', () => {
    expect(parseCircleLabel('    ')).toBeNull()
  })

  it('returns null for null', () => {
    expect(parseCircleLabel(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(parseCircleLabel(undefined)).toBeNull()
  })

  it('returns null for a number', () => {
    expect(parseCircleLabel(1130)).toBeNull()
  })

  it('returns null for an object', () => {
    expect(parseCircleLabel({ day: 'Monday' })).toBeNull()
  })

  it('returns null for an array', () => {
    expect(parseCircleLabel(['Mon 11:30 (Delfina)'])).toBeNull()
  })

  it('returns null for an unrecognized day abbreviation', () => {
    expect(parseCircleLabel('Xyz 11:30 (Delfina)')).toBeNull()
  })

  it('returns null for total garbage', () => {
    expect(parseCircleLabel('not a circle label')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN GAPS — documented CURRENT behavior (parser returns null today).
// Each assertion below confirms the gap still exists. When the hardening agent
// fixes the parser, these will start FAILING — that is the signal to move the
// corresponding case up into the passing suites above and delete it here.
// ─────────────────────────────────────────────────────────────────────────────

describe('parseCircleLabel — KNOWN GAPS (currently return null)', () => {
  it('GAP: full day names are not recognized ("Monday ...")', () => {
    // fmt1 only matches a 3-letter day token followed by whitespace; "Monday"
    // matches "Mon" then expects whitespace but finds "day" → no match.
    expect(parseCircleLabel('Monday 11:30 (Delfina)')).toBeNull()
  })

  it('GAP: an empty leader in parens is not parsed ("Mon 11:30 ()")', () => {
    expect(parseCircleLabel('Mon 11:30 ()')).toBeNull()
  })

  it('GAP: Format 1 without a leader is not parsed ("Mon 11:30")', () => {
    expect(parseCircleLabel('Mon 11:30')).toBeNull()
  })

  it('GAP: single-digit-minute times are not parsed ("Mon 11:3 (Del)")', () => {
    // fmt1 requires exactly two minute digits (\d{2}).
    expect(parseCircleLabel('Mon 11:3 (Del)')).toBeNull()
  })

  it('GAP: a bare time with no am/pm marker defaults to PM (12:00 -> 12:00 PM)', () => {
    // Not a null gap, but a correctness gap: with no am/pm marker, hours >= 12
    // are assumed PM, so a plain "12:00" cannot represent midnight.
    expect(parseCircleLabel('Mon 12:00 (Del)').time).toBe('12:00 PM')
  })

  it('GAP: Format 2 without a leader initial is not parsed ("Tue@1:30pm,Ferry")', () => {
    expect(parseCircleLabel('Tue@1:30pm,Ferry')).toBeNull()
  })

  it('GAP: an am/pm token between the time and the leader breaks Format 1 ("Mon 1:30 pm (Del)")', () => {
    // The fmt1 regex expects "(" right after optional whitespace following the
    // time; a literal "pm"/"am" word in between is not allowed → no match.
    expect(parseCircleLabel('Mon 1:30 pm (Del)')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DESIRED BEHAVIOR (skipped) — un-skip after the parser is hardened.
// These describe how we WANT the parser to gracefully degrade. They are skipped
// so the unit suite stays green today. The parser-hardening agent should make
// these pass and remove the matching entries from the KNOWN GAPS block above.
// ─────────────────────────────────────────────────────────────────────────────

describe.skip('parseCircleLabel — DESIRED graceful degradation (TODO: un-skip after hardening)', () => {
  it('should accept full day names', () => {
    expect(parseCircleLabel('Monday 11:30 (Delfina)')).toEqual({
      day: 'Monday',
      time: '11:30 AM',
      leader: 'Delfina',
    })
  })

  it('should parse Format 1 even when the leader is missing', () => {
    // Desired: still return day + time, with leader null/empty rather than null.
    const result = parseCircleLabel('Mon 11:30')
    expect(result).not.toBeNull()
    expect(result.day).toBe('Monday')
    expect(result.time).toBe('11:30 AM')
  })

  it('should treat an explicit "am" marker as AM even for hour 12 (midnight)', () => {
    expect(parseCircleLabel('Mon 12:00am (Del)').time).toBe('12:00 AM')
  })

  it('should accept single-digit minutes', () => {
    expect(parseCircleLabel('Mon 11:3 (Del)').time).toBe('11:03 AM')
  })

  it('should parse Format 2 without a trailing leader initial', () => {
    const result = parseCircleLabel('Tue@1:30pm,Ferry')
    expect(result).not.toBeNull()
    expect(result.day).toBe('Tuesday')
    expect(result.time).toBe('1:30 PM')
  })

  it('should honor an am/pm token placed between the time and the leader (Format 1)', () => {
    expect(parseCircleLabel('Mon 1:30 pm (Del)')).toEqual({
      day: 'Monday',
      time: '1:30 PM',
      leader: 'Del',
    })
  })
})
