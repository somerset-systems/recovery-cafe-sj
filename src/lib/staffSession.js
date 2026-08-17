// Staff preview session.
//
// A staff login stores a flag alongside the normal session keys. Everything that reads
// member data checks this flag first and serves the bundled sample member instead of
// calling Supabase (see lib/supabase.js). Members are unaffected — without the flag the
// app behaves exactly as before.
//
// This is a display mode, not a permission boundary. It does not need to be tamper-proof:
// flipping the flag by hand in devtools only swaps in the fake sample member, which grants
// no access to anything. The real boundary is still the one in lockdown_member_reads.sql —
// a member's data can only be fetched by knowing their id or phone.

const STAFF_KEY = 'staffPreview'
const STAFF_NAME_KEY = 'staffName'

export function startStaffSession(staff) {
  localStorage.setItem(STAFF_KEY, 'true')
  if (staff?.full_name) localStorage.setItem(STAFF_NAME_KEY, staff.full_name)
}

export function isStaffPreview() {
  return localStorage.getItem(STAFF_KEY) === 'true'
}

export function staffName() {
  return localStorage.getItem(STAFF_NAME_KEY) || ''
}

export function clearStaffSession() {
  localStorage.removeItem(STAFF_KEY)
  localStorage.removeItem(STAFF_NAME_KEY)
}
