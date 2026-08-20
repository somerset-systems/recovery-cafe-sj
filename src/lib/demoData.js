// Staff preview data — the sample member a staff login sees.
//
// This is entirely invented. It exists so staff can walk the real app end to end
// (circle, chores, the celebration moment, badges, attendance) without any real
// member's information ever being fetched. A staff session reads from this file
// instead of Supabase, so the member-lookup RPCs are never called for them.
//
// The one thing NOT faked is the events calendar: those come from the live Google
// Calendar like they do for members, because event listings are public and staff
// actually benefit from seeing the real schedule.
//
// Kept separate from fakeData.js on purpose. fakeData.js is the local no-Supabase
// development fixture and changes freely; this is what staff see in production, so
// it is tuned to show the app at its best.

// full_name here is only a fallback. In a real staff session lib/supabase.js swaps in
// the signed-in staff member's own name, so the app greets them the way it greets a
// member. That means the NAME no longer signals the screen is fake — the preview banner,
// the Home notice, and the Profile line are the only things doing that. Keep all three.
export const DEMO_MEMBER = {
  id: 'staff-preview-member',
  client_id: 'DEMO',
  full_name: 'Alex Sample',
  phone: '0000000000',
  circle_label: 'Mon 11:30 (Delfina)',
  circle_day: 'Monday',
  circle_time: '11:30 AM',
  circle_leader: 'Delfina',
  // 8 chores: past the goal of 3, so the celebration fires and the green + teal rings
  // are closed with the blue ring visibly in progress. Staff see the reward moment
  // and the "there is more beyond the goal" idea in one screen.
  chores_done: 8,
  chores_goal: 3,
}

// A full year of chore history, so the Badges card is populated rather than empty.
// Several months clear the goal (green), a few push into the higher rings.
export const DEMO_CHORE_MONTHS = [
  { member_id: DEMO_MEMBER.id, month: '2025-09', chores_done: 3 },
  { member_id: DEMO_MEMBER.id, month: '2025-10', chores_done: 5 },
  { member_id: DEMO_MEMBER.id, month: '2025-11', chores_done: 0 },
  { member_id: DEMO_MEMBER.id, month: '2025-12', chores_done: 4 },
  { member_id: DEMO_MEMBER.id, month: '2026-01', chores_done: 7 },
  { member_id: DEMO_MEMBER.id, month: '2026-02', chores_done: 12 },
  { member_id: DEMO_MEMBER.id, month: '2026-03', chores_done: 6 },
  { member_id: DEMO_MEMBER.id, month: '2026-04', chores_done: 9 },
  { member_id: DEMO_MEMBER.id, month: '2026-05', chores_done: 3 },
  { member_id: DEMO_MEMBER.id, month: '2026-06', chores_done: 5 },
  { member_id: DEMO_MEMBER.id, month: '2026-07', chores_done: 4 },
]

/**
 * Attendance for the last `weeks` Sundays, most recent first.
 *
 * Generated relative to today rather than hard-coded, so the staff preview never drifts
 * into showing a stale month. The pattern is fixed (not random) so every staff member
 * sees the same screen and the demo looks the same each time it is opened.
 */
export function buildDemoAttendance(weeks = 10) {
  // 'attended' dominates, with a missed and an excused week so all three chip styles show.
  const pattern = ['attended', 'attended', 'excused', 'attended', 'attended',
                   'absent', 'attended', 'attended', 'attended', 'attended']

  const sunday = new Date()
  sunday.setHours(0, 0, 0, 0)
  sunday.setDate(sunday.getDate() - sunday.getDay()) // back up to this week's Sunday

  const rows = []
  for (let i = 0; i < weeks; i++) {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() - i * 7)
    rows.push({
      id: `demo-att-${i}`,
      member_id: DEMO_MEMBER.id,
      week_date: d.toISOString().slice(0, 10),
      status: pattern[i % pattern.length],
    })
  }
  return rows // already most-recent-first, which is the order the Circle tab wants
}
