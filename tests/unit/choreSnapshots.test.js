import { describe, it, expect } from 'vitest'
import { dedupeChoreSnapshots } from '../../scripts/lib/choreSnapshots.js'

// Regression cover for the July 2026 outage: two roster rows shared a phone, both
// resolved to the same member id, and the duplicate (member_id, month) pair made
// Postgres reject the ENTIRE chore_months batch every day for a week. The sync still
// exited 0, so it showed a green check while chore history silently stopped updating.

const snap = (member_id, chores_done, month = '2026-07') => ({ member_id, month, chores_done })

describe('dedupeChoreSnapshots', () => {
  it('leaves already-unique rows untouched', () => {
    const { rows, merged } = dedupeChoreSnapshots([snap('a', 3), snap('b', 5)])
    expect(merged).toBe(0)
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.chores_done)).toEqual([3, 5])
  })

  it('collapses two rows for the same member in the same month', () => {
    const { rows, merged } = dedupeChoreSnapshots([snap('a', 3), snap('a', 6)])
    expect(merged).toBe(1)
    expect(rows).toHaveLength(1)
    expect(rows[0].chores_done).toBe(6)
  })

  it('keeps the HIGHEST count regardless of order — badges never un-earn', () => {
    const high = dedupeChoreSnapshots([snap('a', 9), snap('a', 2)])
    const low  = dedupeChoreSnapshots([snap('a', 2), snap('a', 9)])
    expect(high.rows[0].chores_done).toBe(9)
    expect(low.rows[0].chores_done).toBe(9)
  })

  it('does not merge the same member across different months', () => {
    const { rows, merged } = dedupeChoreSnapshots([snap('a', 3, '2026-06'), snap('a', 1, '2026-07')])
    expect(merged).toBe(0)
    expect(rows).toHaveLength(2)
  })

  it('guarantees the batch has no repeated conflict target', () => {
    // This is the exact property Postgres requires of an ON CONFLICT batch.
    const messy = [snap('a', 1), snap('b', 2), snap('a', 4), snap('c', 0), snap('b', 2), snap('a', 3)]
    const { rows } = dedupeChoreSnapshots(messy)
    const keys = rows.map(r => `${r.member_id}|${r.month}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(rows.find(r => r.member_id === 'a').chores_done).toBe(4)
  })

  it('coerces junk counts to a safe integer instead of writing NaN', () => {
    const { rows } = dedupeChoreSnapshots([snap('a', undefined), snap('a', '7'), snap('b', -3)])
    expect(rows.find(r => r.member_id === 'a').chores_done).toBe(7)
    expect(rows.find(r => r.member_id === 'b').chores_done).toBe(0)
  })

  it('skips malformed entries and handles empty input', () => {
    expect(dedupeChoreSnapshots([]).rows).toEqual([])
    expect(dedupeChoreSnapshots().rows).toEqual([])
    expect(dedupeChoreSnapshots([null, {}, snap('a', 1)]).rows).toHaveLength(1)
  })
})
