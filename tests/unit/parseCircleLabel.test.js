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

  it('returns null for total garbage', () => {
    expect(parseCircleLabel('not a circle label')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Graceful degradation — the parser was hardened to recover whatever fields it
// can rather than failing the whole label. Each returned field is a non-empty
// string or null; the parser returns null only when nothing usable can be
// recovered. Assertions below were verified against src/lib/parseCircleLabel.js.
// (These cases were previously KNOWN GAPS / skipped TODOs before the hardening.)
// ─────────────────────────────────────────────────────────────────────────────

describe('parseCircleLabel — graceful degradation', () => {
  it('accepts full day names', () => {
    expect(parseCircleLabel('Monday 11:30 (Delfina)')).toEqual({
      day: 'Monday',
      time: '11:30 AM',
      leader: 'Delfina',
    })
  })

  it('recovers day + time when the leader is missing (Format 1)', () => {
    expect(parseCircleLabel('Mon 11:30')).toEqual({
      day: 'Monday',
      time: '11:30 AM',
      leader: null,
    })
  })

  it('treats empty parens as a missing leader, not a parse failure', () => {
    expect(parseCircleLabel('Mon 11:30 ()')).toEqual({
      day: 'Monday',
      time: '11:30 AM',
      leader: null,
    })
  })

  it('recovers time + leader when the day is unrecognized', () => {
    expect(parseCircleLabel('Xyz 11:30 (Delfina)')).toEqual({
      day: null,
      time: '11:30 AM',
      leader: 'Delfina',
    })
  })

  it('honors an explicit "am" marker for hour 12 (midnight)', () => {
    expect(parseCircleLabel('Mon 12:00am (Del)').time).toBe('12:00 AM')
  })

  it('recovers day + time for Format 2 without a trailing leader initial', () => {
    expect(parseCircleLabel('Tue@1:30pm,Ferry')).toEqual({
      day: 'Tuesday',
      time: '1:30 PM',
      leader: 'Ferry',
    })
  })

  it('honors an am/pm token placed between the time and the leader (Format 1)', () => {
    expect(parseCircleLabel('Mon 1:30 pm (Del)')).toEqual({
      day: 'Monday',
      time: '1:30 PM',
      leader: 'Del',
    })
  })

  it('drops a malformed single-digit minute rather than failing (":3" -> :00)', () => {
    // "11:3" is malformed. The hardened parser keeps the hour and zeroes the
    // minute (-> 11:00 AM). NOTE: an earlier proposal expected "11:03 AM"; that
    // was not adopted. Flagged for review if :03 is the preferred behavior.
    expect(parseCircleLabel('Mon 11:3 (Del)').time).toBe('11:00 AM')
  })

  it('still returns null when nothing usable can be recovered', () => {
    expect(parseCircleLabel('not a circle label')).toBeNull()
  })
})
