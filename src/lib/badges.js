import { getRings } from './choreRings.js'

/**
 * Badges — celebratory milestones a member earns. Everything here is *additive*
 * and *durable*: a badge is earned the first time its goal is ever met and stays
 * earned forever — it never resets at the start of a month and is never taken
 * away. Missing a week never produces a negative badge, and no badge rewards
 * missing circle. This matters for our members.
 *
 * Durability comes from history, not the single live `chores_done` value:
 *   - Chore badges derive from a per-month chore snapshot (`chore_months`,
 *     written by the sync). Ring badges count HOW MANY months a ring was closed;
 *     streak/consistency badges look at consecutive months; lifetime badges sum
 *     every month.
 *   - Attendance badges derive from the attendance history, which spans every
 *     week the program has tracked.
 *
 * evaluateBadges() is a pure function so it's easy to test and could run
 * server-side later if we ever want to store earned badges.
 */

// Cumulative chore counts at which each ring closes (see theme.js choreRings).
// 'countable' badges show how many separate months reached the threshold.
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
const monthNum = (m) => { const [y, mm] = m.split('-').map(Number); return y * 12 + (mm - 1) }

// Collapse the chore snapshot into one peak count per month, fold in the live
// current month, and return entries sorted oldest→newest: [{ month, count }].
function monthlyChoreEntries(member, choreMonths = []) {
  const byMonth = new Map()
  for (const r of choreMonths) {
    if (!r || !r.month) continue
    const v = Math.max(0, parseInt(r.chores_done, 10) || 0)
    byMonth.set(r.month, Math.max(byMonth.get(r.month) || 0, v))
  }
  const cur = monthKey(new Date())
  byMonth.set(cur, Math.max(byMonth.get(cur) || 0, Math.max(0, member?.chores_done ?? 0)))
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }))
}

// Longest run of calendar-consecutive months whose count satisfies `pred`.
// A missing month (a gap in the calendar) breaks the run.
function longestConsecutiveMonths(entries, pred) {
  let best = 0, run = 0, prevNum = null, prevOk = false
  for (const { month, count } of entries) {
    const num = monthNum(month)
    const ok = pred(count)
    if (ok) run = prevOk && prevNum !== null && num - prevNum === 1 ? run + 1 : 1
    else run = 0
    if (run > best) best = run
    prevNum = num
    prevOk = ok
  }
  return best
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

  // A "perfect month" is a calendar month with 3+ circles attended and no absence.
  const perfectMonthSet = new Set(
    Object.entries(months)
      .filter(([, m]) => m.attended >= 3 && m.absent === 0)
      .map(([k]) => k)
  )

  return { attended, longestStreak, comeback, perfectMonthSet }
}

/**
 * evaluateBadges(member, { attendance, choreMonths }) -> ordered badge list:
 *   { key, emoji, name, requirement, color, category, earned, count, countable }
 * `count` is how many times the milestone was reached (for countable badges).
 */
export function evaluateBadges(member, { attendance = [], choreMonths = [] } = {}) {
  // --- Chore-derived facts ---
  const entries = monthlyChoreEntries(member, choreMonths)
  const counts = entries.map((e) => e.count)
  const totalChores = counts.reduce((a, b) => a + b, 0)
  const goalStreak = longestConsecutiveMonths(entries, (c) => c >= 3)
  const steadyStreak = longestConsecutiveMonths(entries, (c) => c >= 1)
  const goalMonths = new Set(entries.filter((e) => e.count >= 3).map((e) => e.month))

  const ringBadges = RING_BADGES.map((b) => {
    const count = counts.filter((c) => c >= b.threshold).length
    return { ...b, category: 'chores', earned: count > 0, count }
  })

  const consistencyBadges = [
    { key: 'steady-hands', emoji: '🤲', name: 'Steady Hands', color: '#52B788',
      requirement: 'Do at least one chore every month for 3 months in a row',
      earned: steadyStreak >= 3 },
    { key: 'goal-streak', emoji: '📈', name: 'Goal Streak', color: '#2D6A4F',
      requirement: 'Hit your 3-chore goal 3 months in a row',
      earned: goalStreak >= 3 },
    { key: 'hundred-chores', emoji: '💯', name: 'Hundred Chores', color: '#C9982E',
      requirement: 'Do 100 chores all-time',
      earned: totalChores >= 100 },
  ].map((b) => ({ ...b, category: 'chores', count: 0 }))

  // --- Attendance-derived facts ---
  const att = summarizeAttendance(attendance)
  const bothHandsCount = [...goalMonths].filter((m) => att.perfectMonthSet.has(m)).length

  const attendanceBadges = [
    { key: 'welcome', emoji: '🤝', name: 'Welcome to the Circle', color: '#2D6A4F',
      requirement: 'Attend your first circle', earned: att.attended >= 1 },
    { key: 'finding-feet', emoji: '👣', name: 'Finding Your Feet', color: '#52B788',
      requirement: 'Attend 3 circles', earned: att.attended >= 3 },
    { key: 'on-a-roll', emoji: '🔥', name: 'On a Roll', color: '#C1440E',
      requirement: 'Attend 5 circles in a row', earned: att.longestStreak >= 5 },
    { key: 'unstoppable', emoji: '🚀', name: 'Unstoppable', color: '#D4631F',
      requirement: 'Attend 10 circles in a row', earned: att.longestStreak >= 10 },
    // hideFromNextUp: Comeback is a lovely reward for returning, but we never list
    // it as a goal to chase — that would amount to suggesting a member miss a circle.
    { key: 'comeback', emoji: '💚', name: 'Comeback', color: '#2A8C8C', hideFromNextUp: true,
      requirement: 'Come back to circle after missing one', earned: att.comeback },
    { key: 'perfect-month', emoji: '⭐', name: 'Perfect Month', color: '#C9982E', countable: true,
      requirement: 'Attend every circle in one month', earned: att.perfectMonthSet.size >= 1, count: att.perfectMonthSet.size },
    { key: 'three-perfect-months', emoji: '🌟', name: 'Three Perfect Months', color: '#B8860B',
      requirement: 'Have a perfect month three times', earned: att.perfectMonthSet.size >= 3 },
    { key: 'ten-circles', emoji: '🌳', name: 'Ten Circles', color: '#3E6CA6',
      requirement: 'Attend 10 circles', earned: att.attended >= 10 },
    { key: 'twentyfive-circles', emoji: '🏅', name: 'Twenty-Five Circles', color: '#6B5BB0',
      requirement: 'Attend 25 circles', earned: att.attended >= 25 },
    { key: 'fifty-circles', emoji: '🏆', name: 'Fifty Circles', color: '#9E4E88',
      requirement: 'Attend 50 circles', earned: att.attended >= 50 },
    { key: 'seventyfive-circles', emoji: '🎖️', name: 'Seventy-Five Circles', color: '#B5495B',
      requirement: 'Attend 75 circles', earned: att.attended >= 75 },
    { key: 'hundred-circles', emoji: '👑', name: 'One Hundred Circles', color: '#C9982E',
      requirement: 'Attend 100 circles', earned: att.attended >= 100 },
  ].map((b) => ({ ...b, category: 'circle', count: b.count ?? 0 }))

  // --- Combined ---
  const combinedBadges = [
    { key: 'both-hands-full', emoji: '🙌', name: 'Both Hands Full', color: '#7A4FA0', countable: true,
      requirement: 'Hit your chore goal and attend every circle in the same month',
      earned: bothHandsCount > 0, count: bothHandsCount, category: 'combined' },
  ]

  return [...ringBadges, ...consistencyBadges, ...attendanceBadges, ...combinedBadges]
}
