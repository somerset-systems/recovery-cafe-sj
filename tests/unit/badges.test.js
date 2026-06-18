import { describe, it, expect } from 'vitest'
import { evaluateBadges } from '../../src/lib/badges.js'

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests for src/lib/badges.js
//
// Badges must be DURABLE (earned once, never reset, never taken away) and the
// chore-ring badges must COUNT how many separate months a ring was closed.
// These tests pin that behavior so a future change can't silently break it.
//
// Note: evaluateBadges folds in the member's *current* live chores under the real
// current month. Tests therefore use clearly-past months ('2025-xx') for history
// and set member.chores_done explicitly so the current-month fold-in is controlled.
// ─────────────────────────────────────────────────────────────────────────────

const byKey = (badges) => Object.fromEntries(badges.map((b) => [b.key, b]))

// Build sequential weekly attendance records starting from a given Sunday.
function weeks(statuses, startSunday = '2025-01-05') {
  const start = new Date(startSunday + 'T00:00:00')
  return statuses.map((status, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i * 7)
    return { id: `w${i}`, member_id: 'm', week_date: d.toISOString().slice(0, 10), status }
  })
}

describe('chore-ring badges — durability & counts', () => {
  it('earns nothing from chores when there is no history and no current chores', () => {
    const b = byKey(evaluateBadges({ chores_done: 0 }, {}))
    expect(b['first-sprout'].earned).toBe(false)
    expect(b['goal-keeper'].earned).toBe(false)
    expect(b['teal-bloom'].earned).toBe(false)
  })

  it('earns First Sprout from a single chore in any month', () => {
    const b = byKey(evaluateBadges({ chores_done: 0 }, {
      choreMonths: [{ month: '2025-02', chores_done: 1 }],
    }))
    expect(b['first-sprout'].earned).toBe(true)
    expect(b['goal-keeper'].earned).toBe(false)
  })

  it('counts how many separate months each ring was closed', () => {
    const choreMonths = [
      { month: '2025-01', chores_done: 7 },  // green, teal
      { month: '2025-02', chores_done: 12 }, // + blue
      { month: '2025-03', chores_done: 8 },  // green, teal
      { month: '2025-04', chores_done: 19 }, // + blue, purple
      { month: '2025-05', chores_done: 7 },  // green, teal
    ]
    const b = byKey(evaluateBadges({ chores_done: 0 }, { choreMonths }))
    expect(b['goal-keeper'].count).toBe(5)  // every month hit 3+
    expect(b['teal-bloom'].count).toBe(5)   // every month hit 7+
    expect(b['blue-bloom'].count).toBe(2)   // Feb, Apr
    expect(b['purple-bloom'].count).toBe(1) // Apr only
    expect(b['plum-bloom'].earned).toBe(false)
    expect(b['teal-bloom'].earned).toBe(true)
    expect(b['blue-bloom'].earned).toBe(true)
  })

  it('keeps a ring badge earned even after the live month drops back to 0 (durability)', () => {
    // The whole point: a closed ring in a past month must NOT disappear just
    // because this month's sheet reset chores_done to 0.
    const b = byKey(evaluateBadges({ chores_done: 0 }, {
      choreMonths: [{ month: '2025-04', chores_done: 50 }],
    }))
    expect(b['rose-bloom'].earned).toBe(true)
    expect(b['teal-bloom'].earned).toBe(true)
    expect(b['goal-keeper'].earned).toBe(true)
  })

  it('folds in the live current month so a badge lights up before the next sync', () => {
    // No snapshot yet this month, but the member just did their 7th chore today.
    const b = byKey(evaluateBadges({ chores_done: 7 }, { choreMonths: [] }))
    expect(b['teal-bloom'].earned).toBe(true)
    expect(b['teal-bloom'].count).toBe(1)
  })

  it('does not double-count when the snapshot and live month agree', () => {
    const cur = new Date()
    const month = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
    const b = byKey(evaluateBadges({ chores_done: 7 }, {
      choreMonths: [{ month, chores_done: 7 }],
    }))
    expect(b['teal-bloom'].count).toBe(1) // one month, not two
  })

  it('takes the peak when a month appears more than once in the snapshot', () => {
    const b = byKey(evaluateBadges({ chores_done: 0 }, {
      choreMonths: [
        { month: '2025-03', chores_done: 2 },
        { month: '2025-03', chores_done: 8 }, // peak wins
      ],
    }))
    expect(b['teal-bloom'].earned).toBe(true)
    expect(b['goal-keeper'].count).toBe(1)
  })
})

describe('attendance badges', () => {
  it('earns Welcome and Finding Your Feet at 1 and 3 circles', () => {
    const b1 = byKey(evaluateBadges({}, { attendance: weeks(['attended']) }))
    expect(b1['welcome'].earned).toBe(true)
    expect(b1['finding-feet'].earned).toBe(false)

    const b3 = byKey(evaluateBadges({}, { attendance: weeks(['attended', 'attended', 'attended']) }))
    expect(b3['finding-feet'].earned).toBe(true)
  })

  it('earns On a Roll only with 5 consecutive attended weeks', () => {
    const four = byKey(evaluateBadges({}, { attendance: weeks(['attended', 'attended', 'attended', 'attended']) }))
    expect(four['on-a-roll'].earned).toBe(false)

    const five = byKey(evaluateBadges({}, { attendance: weeks(Array(5).fill('attended')) }))
    expect(five['on-a-roll'].earned).toBe(true)
  })

  it('an absence breaks the streak but an excused week does not', () => {
    const broken = byKey(evaluateBadges({}, {
      attendance: weeks(['attended', 'attended', 'absent', 'attended', 'attended']),
    }))
    expect(broken['on-a-roll'].earned).toBe(false)

    // excused is neutral: 1,(skip),2,3,4,5 → longest run of 5
    const excusedOk = byKey(evaluateBadges({}, {
      attendance: weeks(['attended', 'excused', 'attended', 'attended', 'attended', 'attended']),
    }))
    expect(excusedOk['on-a-roll'].earned).toBe(true)
  })

  it('earns Comeback only after returning from a missed week', () => {
    const noMiss = byKey(evaluateBadges({}, { attendance: weeks(['attended', 'attended']) }))
    expect(noMiss['comeback'].earned).toBe(false)

    const cameBack = byKey(evaluateBadges({}, { attendance: weeks(['attended', 'absent', 'attended']) }))
    expect(cameBack['comeback'].earned).toBe(true)

    // Missed but never returned → not yet a comeback (and never punished).
    const stillOut = byKey(evaluateBadges({}, { attendance: weeks(['attended', 'absent']) }))
    expect(stillOut['comeback'].earned).toBe(false)
  })

  it('counts perfect months (3+ attended, no absence) and skips months with an absence', () => {
    const attendance = [
      // Jan 2025 — perfect (4 attended)
      ...weeks(Array(4).fill('attended'), '2025-01-05'),
      // Feb 2025 — spoiled by one absence
      ...weeks(['attended', 'attended', 'absent', 'attended'], '2025-02-02'),
      // Mar 2025 — perfect (3 attended, 1 excused is fine)
      ...weeks(['attended', 'attended', 'attended', 'excused'], '2025-03-02'),
    ]
    const b = byKey(evaluateBadges({}, { attendance }))
    expect(b['perfect-month'].earned).toBe(true)
    expect(b['perfect-month'].count).toBe(2) // Jan + Mar, not Feb
  })

  it('earns cumulative circle milestones at 10/25/50/100', () => {
    const b = byKey(evaluateBadges({}, { attendance: weeks(Array(26).fill('attended')) }))
    expect(b['ten-circles'].earned).toBe(true)
    expect(b['twentyfive-circles'].earned).toBe(true)
    expect(b['fifty-circles'].earned).toBe(false)
    expect(b['hundred-circles'].earned).toBe(false)
  })
})

describe('shape', () => {
  it('always returns the full catalog with stable keys and earned flags', () => {
    const badges = evaluateBadges({ chores_done: 0 }, {})
    expect(badges.length).toBe(17)
    for (const b of badges) {
      expect(typeof b.key).toBe('string')
      expect(typeof b.name).toBe('string')
      expect(typeof b.earned).toBe('boolean')
      expect(b.color).toMatch(/^#/)
    }
  })
})
