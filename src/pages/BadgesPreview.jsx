import BadgesCard from '../components/BadgesCard.jsx'
import { colors, fontSize } from '../theme.js'

// A no-login preview of the Badges feature for staff/design review.
// Open /badges-preview in the browser. Two states are shown:
//   1. "How a member sees it" — a realistic member with partial progress, so you
//      see earned badges, greyed locked badges, and the "Next Up" descriptions
//      exactly as a real member would. This is the production component.
//   2. "All badges" — every badge lit up so the full icon set is reviewable.

// Weekly Sundays from a start date with the given statuses.
function weeks(statuses, startSunday) {
  const start = new Date(startSunday + 'T00:00:00')
  return statuses.map((status, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i * 7)
    return { id: `${startSunday}-${i}`, member_id: 'preview', week_date: d.toISOString().slice(0, 10), status }
  })
}

// --- 1. Realistic member: a few rings closed, a few circle badges, more to go ---
const memberRealistic = { id: 'preview-real', full_name: 'Preview', chores_done: 3 }
const choreMonthsRealistic = [
  { month: '2025-01', chores_done: 7 },  // green, teal
  { month: '2025-02', chores_done: 12 }, // + blue
  { month: '2025-03', chores_done: 8 },  // green, teal
  { month: '2025-04', chores_done: 7 },  // green, teal
]
// 7 circles with one miss-then-return → Welcome, Finding Your Feet, Comeback earned;
// On a Roll / Perfect Month / milestones still locked, so "Next Up" has content.
const attendanceRealistic = weeks(
  ['attended', 'attended', 'attended', 'attended', 'absent', 'attended', 'attended', 'attended'],
  '2025-02-02',
)

// --- 2. All earned: every badge lit up for icon review ---
const memberAll = { id: 'preview-all', full_name: 'Preview', chores_done: 80 }
const choreMonthsAll = [
  { month: '2025-01', chores_done: 80 }, { month: '2025-02', chores_done: 50 },
  { month: '2025-03', chores_done: 30 }, { month: '2025-04', chores_done: 19 },
  { month: '2025-05', chores_done: 12 }, { month: '2025-06', chores_done: 8 },
  { month: '2025-07', chores_done: 7 },  { month: '2025-08', chores_done: 3 },
]
const attendanceAll = (() => {
  const start = new Date('2024-01-07T00:00:00')
  const out = []
  for (let i = 0; i < 104; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i * 7)
    out.push({ id: `all-${i}`, member_id: 'preview-all', week_date: d.toISOString().slice(0, 10), status: i === 5 || i === 9 ? 'absent' : 'attended' })
  }
  return out
})()

function Note({ children }) {
  return <p style={{ margin: '0 0 16px', fontSize: fontSize.body, color: colors.textMedium }}>{children}</p>
}

export default function BadgesPreview() {
  return (
    <div style={{ padding: '20px 16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <p style={{ margin: '0 0 4px', fontSize: fontSize.large, fontWeight: 800, color: colors.textDark }}>
          1 · How a member sees it
        </p>
        <Note>
          A real member with some progress. Earned badges are in colour; not-yet-earned
          badges are greyed. <strong>Tap any badge</strong> to see what it means.
        </Note>
        <BadgesCard member={memberRealistic} attendance={attendanceRealistic} choreMonths={choreMonthsRealistic} loading={false} />
      </div>

      <div>
        <p style={{ margin: '0 0 4px', fontSize: fontSize.large, fontWeight: 800, color: colors.textDark }}>
          2 · All badges (design reference)
        </p>
        <Note>Every badge lit up so you can review the full icon set and the “×N” repeat counts.</Note>
        <BadgesCard member={memberAll} attendance={attendanceAll} choreMonths={choreMonthsAll} loading={false} />
      </div>
    </div>
  )
}
