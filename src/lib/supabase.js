import { fakeMembers, fakeAttendance, fakeEvents, fakeChoreMonths } from './fakeData.js'
import { DEMO_MEMBER, DEMO_CHORE_MONTHS, buildDemoAttendance } from './demoData.js'
import { isStaffPreview } from './staffSession.js'

const isFakeMode = !import.meta.env.VITE_SUPABASE_URL

// --- Fake data API (no Supabase account needed) ---

function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
}

const fakeDb = {
  getMemberByPhone(phone) {
    const normalized = normalizePhone(phone)
    const member = fakeMembers.find((m) => m.phone === normalized) || null
    return Promise.resolve({ data: member, error: null })
  },

  getMemberById(id) {
    const member = fakeMembers.find((m) => m.id === id) || null
    return Promise.resolve({ data: member, error: null })
  },

  getAttendanceForMember(memberId) {
    const records = fakeAttendance
      .filter((a) => a.member_id === memberId)
      .sort((a, b) => b.week_date.localeCompare(a.week_date))
    return Promise.resolve({ data: records, error: null })
  },

  getUpcomingEvents() {
    const today = new Date().toISOString().slice(0, 10)
    const events = fakeEvents
      .filter((e) => e.event_date >= today)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
    return Promise.resolve({ data: events, error: null })
  },

  getChoreMonthsForMember(memberId) {
    const records = fakeChoreMonths
      .filter((c) => c.member_id === memberId)
      .sort((a, b) => a.month.localeCompare(b.month))
    return Promise.resolve({ data: records, error: null })
  },
}

// --- Real Supabase API ---

let realDb = null
let realClient = null   // module-scoped so the staff lookup below can reuse it

if (!isFakeMode) {
  const { createClient } = await import('@supabase/supabase-js')
  const client = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )
  realClient = client

  // Reads go through SECURITY DEFINER RPCs (see supabase/lockdown_member_reads.sql),
  // not direct table selects. The members/attendance/chore_months tables are no
  // longer readable with the anon key, so the browser can only ever fetch one
  // member (by phone or id) and that member's own data — never the whole roster.
  // RPCs query live tables, so the morning sync's new members appear immediately.
  realDb = {
    async getMemberByPhone(phone) {
      const normalized = normalizePhone(phone)
      const { data, error } = await client.rpc('get_member_by_phone', { p_phone: normalized })
      return { data: (data && data[0]) || null, error }
    },

    async getMemberById(id) {
      const { data, error } = await client.rpc('get_member_by_id', { p_id: id })
      return { data: (data && data[0]) || null, error }
    },

    async getAttendanceForMember(memberId) {
      const { data, error } = await client.rpc('get_attendance_for_member', { p_member_id: memberId })
      return { data: data || [], error }
    },

    async getUpcomingEvents() {
      const today = new Date().toISOString().slice(0, 10)
      const { data, error } = await client
        .from('events')
        .select('*')
        .gte('event_date', today)
        .order('event_date', { ascending: true })
      return { data: data || [], error }
    },

    async getChoreMonthsForMember(memberId) {
      const { data, error } = await client.rpc('get_chore_months_for_member', { p_member_id: memberId })
      return { data: data || [], error }
    },
  }
}

// --- Staff preview API (bundled sample member, never touches Supabase) ---
//
// Events are deliberately absent here: they come from the live Google Calendar via
// lib/googleCalendar.js, not through `db`, so staff see the real schedule automatically.

const demoDb = {
  getMemberByPhone() { return Promise.resolve({ data: DEMO_MEMBER, error: null }) },
  getMemberById()    { return Promise.resolve({ data: DEMO_MEMBER, error: null }) },
  getAttendanceForMember() { return Promise.resolve({ data: buildDemoAttendance(), error: null }) },
  getChoreMonthsForMember() {
    // Ascending by month, matching what the real RPC returns.
    const rows = [...DEMO_CHORE_MONTHS].sort((a, b) => a.month.localeCompare(b.month))
    return Promise.resolve({ data: rows, error: null })
  },
  getUpcomingEvents() {
    const today = new Date().toISOString().slice(0, 10)
    const events = fakeEvents.filter((e) => e.event_date >= today)
    return Promise.resolve({ data: events, error: null })
  },
}

const liveDb = isFakeMode ? fakeDb : realDb

// Every member-data read goes through here, so the staff check lives in exactly one
// place. The flag is read at CALL time, not at import time — a staff member logs in
// after this module has already loaded, and their very next read has to be redirected.
//
// The security property this gives us: for a staff session the get_member_* RPCs are
// never invoked at all, so there is no code path by which a staff login could surface a
// real member's name, phone, circle, or attendance.
export const db = {
  getMemberByPhone(phone)      { return (isStaffPreview() ? demoDb : liveDb).getMemberByPhone(phone) },
  getMemberById(id)            { return (isStaffPreview() ? demoDb : liveDb).getMemberById(id) },
  getAttendanceForMember(id)   { return (isStaffPreview() ? demoDb : liveDb).getAttendanceForMember(id) },
  getChoreMonthsForMember(id)  { return (isStaffPreview() ? demoDb : liveDb).getChoreMonthsForMember(id) },
  getUpcomingEvents()          { return (isStaffPreview() ? demoDb : liveDb).getUpcomingEvents() },
}

// Staff lookup for the login screen. Separate from `db` because it is not member data:
// it asks "is this number a staff phone?" before the member lookup runs.
export async function getStaffByPhone(phone) {
  if (isFakeMode) return { data: null, error: null } // no staff table in local fake mode
  const normalized = normalizePhone(phone)
  const { data, error } = await realClient.rpc('get_staff_by_phone', { p_phone: normalized })
  return { data: (data && data[0]) || null, error }
}

export { normalizePhone }
