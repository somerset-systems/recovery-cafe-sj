// Fake seed data — used when VITE_SUPABASE_URL is not set.
// All phone numbers stored as 10-digit strings.

export const fakeMembers = [
  {
    id: 'member-uuid-1',
    client_id: '101',
    full_name: 'Maria Lopez',
    phone: '4085550001',
    circle_label: 'Mon 11:30 (Delfina)',
    circle_day: 'Monday',
    circle_time: '11:30 AM',
    circle_leader: 'Delfina',
    chores_done: 0,
    chores_goal: 3,
  },
  {
    id: 'member-uuid-2',
    client_id: '102',
    full_name: 'James Carter',
    phone: '4085550002',
    circle_label: 'Mon 11:30 (Delfina)',
    circle_day: 'Monday',
    circle_time: '11:30 AM',
    circle_leader: 'Delfina',
    chores_done: 1,
    chores_goal: 3,
  },
  {
    id: 'member-uuid-3',
    client_id: '103',
    full_name: 'Rosa Nguyen',
    phone: '4085550003',
    circle_label: 'Mon 11:30 (Delfina)',
    circle_day: 'Monday',
    circle_time: '11:30 AM',
    circle_leader: 'Delfina',
    chores_done: 2,
    chores_goal: 3,
  },
  {
    id: 'member-uuid-4',
    client_id: '104',
    full_name: 'David Kim',
    phone: '4085550004',
    circle_label: 'Mon 11:30 (Delfina)',
    circle_day: 'Monday',
    circle_time: '11:30 AM',
    circle_leader: 'Delfina',
    chores_done: 3,
    chores_goal: 3,
  },
  {
    id: 'member-uuid-5',
    client_id: '105',
    full_name: 'Ana Reyes',
    phone: '4085550005',
    // Format 2: "Tue@1:30pm,Ferry, L" — tests the second parser format
    circle_label: 'Tue@1:30pm,Ferry, L',
    circle_day: 'Tuesday',
    circle_time: '1:30 PM',
    circle_leader: 'L. Ferry',
    chores_done: 1,
    chores_goal: 3,
  },
]

// Attendance: week_date is the Sunday that starts the week, ISO format.
// status: "attended" | "absent" | "excused" | "not_enrolled"
// Covering May 2026 — weeks starting May 4, 11, 18, 25.
export const fakeAttendance = [
  // Maria Lopez — member-uuid-1
  { id: 'att-1', member_id: 'member-uuid-1', week_date: '2026-05-04', status: 'attended' },
  { id: 'att-2', member_id: 'member-uuid-1', week_date: '2026-05-11', status: 'attended' },
  { id: 'att-3', member_id: 'member-uuid-1', week_date: '2026-05-18', status: 'absent' },
  { id: 'att-4', member_id: 'member-uuid-1', week_date: '2026-05-25', status: 'attended' },

  // James Carter — member-uuid-2
  { id: 'att-5', member_id: 'member-uuid-2', week_date: '2026-05-04', status: 'absent' },
  { id: 'att-6', member_id: 'member-uuid-2', week_date: '2026-05-11', status: 'excused' },
  { id: 'att-7', member_id: 'member-uuid-2', week_date: '2026-05-18', status: 'attended' },
  { id: 'att-8', member_id: 'member-uuid-2', week_date: '2026-05-25', status: 'attended' },

  // Rosa Nguyen — member-uuid-3
  { id: 'att-9',  member_id: 'member-uuid-3', week_date: '2026-05-04', status: 'attended' },
  { id: 'att-10', member_id: 'member-uuid-3', week_date: '2026-05-11', status: 'attended' },
  { id: 'att-11', member_id: 'member-uuid-3', week_date: '2026-05-18', status: 'attended' },
  { id: 'att-12', member_id: 'member-uuid-3', week_date: '2026-05-25', status: 'excused' },

  // David Kim — member-uuid-4
  { id: 'att-13', member_id: 'member-uuid-4', week_date: '2026-05-04', status: 'attended' },
  { id: 'att-14', member_id: 'member-uuid-4', week_date: '2026-05-11', status: 'absent' },
  { id: 'att-15', member_id: 'member-uuid-4', week_date: '2026-05-18', status: 'attended' },
  { id: 'att-16', member_id: 'member-uuid-4', week_date: '2026-05-25', status: 'attended' },

  // Ana Reyes — member-uuid-5 (Tuesday circle)
  { id: 'att-17', member_id: 'member-uuid-5', week_date: '2026-05-04', status: 'attended' },
  { id: 'att-18', member_id: 'member-uuid-5', week_date: '2026-05-11', status: 'attended' },
  { id: 'att-19', member_id: 'member-uuid-5', week_date: '2026-05-18', status: 'excused' },
  { id: 'att-20', member_id: 'member-uuid-5', week_date: '2026-05-25', status: 'absent' },
]

// 7 events. Dates are anchored to 2026-05-27 (Wednesday).
// Each date matches the actual day of week for that recurring event.
// tag: "Class" | "Workshop" | "Music" | "Special"
export const fakeEvents = [
  {
    id: 'event-1',
    title: 'Friday Jam',
    event_date: '2026-05-29',  // Friday
    event_time: '2:00 PM',
    location: 'Cafe Floor',
    tag: 'Music',
  },
  {
    id: 'event-2',
    title: 'Barista Training',
    event_date: '2026-06-01',  // Monday
    event_time: '1:00 PM',
    location: 'Kitchen',
    tag: 'Class',
  },
  {
    id: 'event-3',
    title: 'Art Workshop',
    event_date: '2026-06-02',  // Tuesday
    event_time: '10:00 AM',
    location: 'Main Hall',
    tag: 'Workshop',
  },
  {
    id: 'event-4',
    title: 'Cooking Skills',
    event_date: '2026-06-02',  // Tuesday
    event_time: '1:00 PM',
    location: 'Kitchen',
    tag: 'Class',
  },
  {
    id: 'event-5',
    title: 'Mindfulness & Meditation',
    event_date: '2026-06-03',  // Wednesday
    event_time: '10:00 AM',
    location: 'Room B',
    tag: 'Class',
  },
  {
    id: 'event-6',
    title: 'Job Readiness Skills',
    event_date: '2026-06-04',  // Thursday
    event_time: '10:00 AM',
    location: 'Room A',
    tag: 'Class',
  },
  {
    id: 'event-7',
    title: 'Community Celebration',
    event_date: '2026-06-26',  // last Friday of June
    event_time: '4:00 PM',
    location: 'Cafe Floor',
    tag: 'Special',
  },
]
