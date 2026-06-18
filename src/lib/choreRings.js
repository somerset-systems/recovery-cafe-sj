import { colors } from '../theme.js'

/**
 * Chore rings — concentric goals a member fills by doing chores.
 *
 * The green ring (the 3-chore goal) is the innermost; each tier beyond it is an
 * outer ring in a complementary colour. Chores fill the rings from the inside out:
 * a ring closes, then the next one starts. `colors.choreRings` defines the tiers
 * and their caps (which sum to the season's top, ~80).
 *
 * getRings(done) returns everything the UI needs:
 *   rings:      [{ name, color, cap, startAt, progress(0..1), closed }]
 *   active:     the ring currently being filled (or null when all are closed)
 *   remaining:  chores left to close the active ring
 *   justClosed: a ring that closed exactly on this count (for a celebration), or null
 *   allClosed:  true once every ring is full
 *   total:      sum of all caps (the max)
 */
export function getRings(done = 0) {
  const tiers = colors.choreRings
  let startAt = 0
  const rings = tiers.map((t, i) => {
    const filled = Math.max(0, Math.min(t.cap, done - startAt))
    const progress = t.cap > 0 ? filled / t.cap : 1
    const ring = { ...t, index: i, startAt, progress, closed: progress >= 1 }
    startAt += t.cap
    return ring
  })
  const total = startAt
  const active = rings.find((r) => !r.closed) || null
  const justClosed = [...rings].reverse().find((r) => r.closed && r.startAt + r.cap === done) || null

  return {
    rings,
    active,
    allClosed: !active,
    remaining: active ? active.startAt + active.cap - done : 0,
    activeName: active ? active.name : null,
    activeColor: active ? active.color : null,
    justClosed,
    total,
  }
}

// Plain-language progress line, shared by the Chores tab and the Home summary card
// so the two never drift. Below the goal it nudges; at and beyond it, it names
// exactly how many chores close the ring the member is working on. `ring` is a
// getRings() result.
export function choreStatusMessage(done, goal, ring) {
  if (done === 0) return 'Sign up for chores at the front desk'
  if (done < goal) return "Keep going, you're almost there!"
  if (ring.allClosed) return 'You closed every ring this month — incredible! 🎉'
  if (ring.justClosed) return `You closed your ${ring.justClosed.name} ring! 🎉`
  const n = ring.remaining
  return `${n} more ${n === 1 ? 'chore' : 'chores'} to close your ${ring.activeName} ring!`
}
