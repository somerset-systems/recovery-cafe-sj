import { getRings } from './choreRings.js'

/**
 * Badges — celebratory milestones a member earns. Everything here is *additive*
 * and *durable*: a badge is earned the first time its goal is ever met and stays
 * earned forever — it never resets at the start of a month and is never taken
 * away. Missing a week never produces a negative badge. This matters for our
 * members.
 *
 * Durability comes from history, not from the single live `chores_done` value:
 *   - Chore-ring badges derive from a per-month chore snapshot (`chore_months`,
 *     written by the sync script). A ring badge is earned once any month reached
 *     its threshold, and it tracks HOW MANY months closed that ring — so a
 *     member who has closed their teal ring five different months sees "×5".
 *   - Attendance badges derive from the attendance history, which already spans
 *     every week the program has tracked.
 *
 * evaluateBadges() is a pure function so it's easy to test and could run
 * server-side later if we ever want to store earned badges.
 */

// Cumulative chore counts at which each ring closes (see theme.js choreRings).
// 'times' badges count how many separate months reached the threshold.
const RING_BADGES = [
  { key: 'first-sprout', emoji: '🌱', name: 'First Sprout', threshold: 1, countable: false,
    requirement: 'Do your first chore', color: '#52B788' },
  { key: 'goal-keeper', emoji: '🌿', name: 'Goal Keeper', threshold: 3, countable: true,
    requirement: 'Close your green ring — 3 chores in a month', color: '#2D6A4F' },
  { key: 'teal-bloom', emoji: '🌊', name: 'Teal Bloom', threshold: 7, countable: true,
    requirement: 'Close your teal ring — 7 chores in a month', color: '#2A8C8C' },
  { key: 'blue-bloom', emoji: '💧', name: 'Blue Bloom', threshold: 12, countable: true,
    requirement: 'Close your blue ring — 12 chores in a month', color: '#3E6CA6' },
  { key: 'purple-bloom', emoji: '🔮', name: 'Purple Bloom', threshold: 19, countable: true,
    requirement: 'Close your purple ring — 19 chores in a month', color: '#6B5BB0' },
  { key: 'plum-bloom', emoji: '🍇', name: 'Plum Bloom', threshold: 30, countable: true,
    requirement: 'Close your plum ring — 30 chores in a month', color: '#9E4E88' },
  { key: 'rose-bloom', emoji: '🌹', name: 'Rose Bloom', threshold: 50, countable: true,
    requirement: 'Close your rose ring — 50 chores in a month', color: '#C75C6B' },
  { key: 'full-bloom', emoji: '🌻', name: 'Full Bloom', threshold: 80, countable: true,
    requirement: 'Close every ring — 80 chores in a month', color: '#C9982E' },
]

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

// Collapse the chore snapshot into one peak count per month, then fold in the
// member's *current* live chores so the badge updates the moment they cross a
// threshold today — before the next nightly sync has snapshotted the month.
function monthlyChoreCounts(member, choreMonths = []) {
  const byMonth = new Map()
  for (const r of choreMonths) {
    if (!r || !r.month) continue
    const v = Math.max(0, parseInt(r.chores_done, 10) || 0)
    byMonth.set(r.month, Math.max(byMonth.get(r.month) || 0, v))
  }
  const cur = monthKey(new Date())
  const liveDone = Math.max(0, member?.chores_done ?? 0)
  byMonth.set(cur, Math.max(byMonth.get(cur) || 0, liveDone))
  return [...byMonth.values()]
}

// Walk attendance once. Forgiving by design: only an 'absent' breaks a streak;
// 'excused' and blank weeks are neutral (they neither earn nor punish).
function summarizeAttendance(records = []) {
  const chrono = [...records].sort((a, b) => a.week_date.localeCompare(b.week_date))

  let attended = 0
  let streak = 0
  let longestStreak = 0
  let sawAbsence = false
  let comeback = false
  const months = {} // 'YYYY-MM' -> { attended, absent }

  for (const r of chrono) {
    const month = r.week_date.slice(0, 7)
    months[month] = months[month] || { attended: 0, absent: 0 }

    if (r.status === 'attended') {
      attended++
      streak++
      if (streak > longestStreak) longestStreak = streak
      if (sawAbsence) comeback = true
      months[month].attended++
    } else if (r.status === 'absent') {
      streak = 0
      sawAbsence = true
      months[month].absent++
    }
    // 'excused' / 'not_enrolled' / blank: neutral — leave streak untouched.
  }

  // A "perfect month" is a calendar month with at least 3 circles attended and
  // no absences (excused is fine — life happens).
  const perfectMonths = Object.values(months).filter(
    (m) => m.attended >= 3 && m.absent === 0
  ).length

  return { attended, longestStreak, comeback, perfectMonths }
}

/**
 * evaluateBadges(member, { attendance, choreMonths }) -> ordered badge list:
 *   { key, emoji, name, requirement, color, category, earned, count, countable }
 * `count` is how many times the milestone was reached (for countable badges).
 */
export function evaluateBadges(member, { attendance = [], choreMonths = [] } = {}) {
  const counts = monthlyChoreCounts(member, choreMonths)

  const choreBadges = RING_BADGES.map((b) => {
    const count = counts.filter((c) => c >= b.threshold).length
    return { ...b, category: 'chores', earned: count > 0, count }
  })

  const att = summarizeAttendance(attendance)
  const attendanceBadges = [
    { key: 'welcome', emoji: '🤝', name: 'Welcome to the Circle', color: '#2D6A4F',
      requirement: 'Attend your first circle', earned: att.attended >= 1, count: 0 },
    { key: 'finding-feet', emoji: '👣', name: 'Finding Your Feet', color: '#52B788',
      requirement: 'Attend 3 circles', earned: att.attended >= 3, count: 0 },
    { key: 'on-a-roll', emoji: '🔥', name: 'On a Roll', color: '#C1440E',
      requirement: 'Attend 5 circles in a row', earned: att.longestStreak >= 5, count: 0 },
    { key: 'comeback', emoji: '💚', name: 'Comeback', color: '#2A8C8C',
      requirement: 'Come back to circle after missing one', earned: att.comeback, count: 0 },
    { key: 'perfect-month', emoji: '⭐', name: 'Perfect Month', color: '#C9982E', countable: true,
      requirement: 'Attend every circle in one month', earned: att.perfectMonths >= 1, count: att.perfectMonths },
    { key: 'ten-circles', emoji: '🌳', name: 'Ten Circles', color: '#3E6CA6',
      requirement: 'Attend 10 circles', earned: att.attended >= 10, count: 0 },
    { key: 'twentyfive-circles', emoji: '🏅', name: 'Twenty-Five Circles', color: '#6B5BB0',
      requirement: 'Attend 25 circles', earned: att.attended >= 25, count: 0 },
    { key: 'fifty-circles', emoji: '🏆', name: 'Fifty Circles', color: '#9E4E88',
      requirement: 'Attend 50 circles', earned: att.attended >= 50, count: 0 },
    { key: 'hundred-circles', emoji: '👑', name: 'One Hundred Circles', color: '#C9982E',
      requirement: 'Attend 100 circles', earned: att.attended >= 100, count: 0 },
  ].map((b) => ({ ...b, category: 'circle' }))

  return [...choreBadges, ...attendanceBadges]
}
