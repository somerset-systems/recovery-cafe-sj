import { fakeMembers, fakeAttendance, fakeEvents, fakeChoreMonths } from './fakeData.js'

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

if (!isFakeMode) {
  const { createClient } = await import('@supabase/supabase-js')
  const client = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  )

  realDb = {
    async getMemberByPhone(phone) {
      const normalized = normalizePhone(phone)
      const { data, error } = await client
        .from('members')
        .select('*')
        .eq('phone', normalized)
        .single()
      return { data: data || null, error }
    },

    async getMemberById(id) {
      const { data, error } = await client
        .from('members')
        .select('*')
        .eq('id', id)
        .single()
      return { data: data || null, error }
    },

    async getAttendanceForMember(memberId) {
      const { data, error } = await client
        .from('attendance')
        .select('*')
        .eq('member_id', memberId)
        .order('week_date', { ascending: false })
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
      const { data, error } = await client
        .from('chore_months')
        .select('*')
        .eq('member_id', memberId)
        .order('month', { ascending: true })
      return { data: data || [], error }
    },
  }
}

export const db = isFakeMode ? fakeDb : realDb
export { normalizePhone }
