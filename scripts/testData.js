#!/usr/bin/env node
// scripts/testData.js — Comprehensive Supabase data quality check
// Usage: node scripts/testData.js

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env
const dotenv = await import('dotenv')
dotenv.config({ path: join(__dirname, '..', '.env') })

const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || VITE_SUPABASE_ANON_KEY)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(digits) {
  if (!digits || digits.length !== 10) return digits || '(none)'
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

const VALID_STATUSES = new Set(['attended', 'absent', 'excused', 'not_enrolled'])

// Current month bounds (for attendance filtering, same logic the app uses)
function currentMonthBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { start, end }
}

function statusIcon(s) {
  return { attended: '✅', absent: '❌', excused: '⚠️', not_enrolled: '⬜' }[s] ?? '❓'
}

// ─── 1. Fetch all members ─────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(70))
console.log(' RECOVERY CAFE SJ — DATA QUALITY REPORT')
console.log('═'.repeat(70))
console.log(`Date: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`)

const { data: allMembers, error: membersErr } = await supabase
  .from('members')
  .select('*')
  .order('full_name')

if (membersErr) { console.error('Failed to fetch members:', membersErr.message); process.exit(1) }
console.log(`\nTotal members in database: ${allMembers.length}`)

// ─── 2. Pick 5 representative test members ───────────────────────────────────

function pickMember(list, label, predicate) {
  const match = list.find(predicate)
  if (!match) console.warn(`  ⚠️  Could not find a member for case: ${label}`)
  return match || null
}

// Sort by chores so ranges are easy to find
const byChores = [...allMembers].sort((a, b) => (a.chores_done ?? 0) - (b.chores_done ?? 0))

const caseZeroChores    = pickMember(byChores, '0 chores',     m => (m.chores_done ?? 0) === 0)
const caseLowChores     = pickMember(byChores, '1-2 chores',   m => (m.chores_done ?? 0) >= 1 && (m.chores_done ?? 0) <= 2)
const caseCelebration   = pickMember(byChores, '3+ chores',    m => (m.chores_done ?? 0) >= 3)

// For attendance cases we need to actually fetch records; pick candidates first then filter
const { start: monthStart, end: monthEnd } = currentMonthBounds()
console.log(`Current month window: ${monthStart} → ${monthEnd}`)

const { data: allAttendance, error: attErr } = await supabase
  .from('attendance')
  .select('*')
  .gte('week_date', monthStart)
  .lte('week_date', monthEnd)

if (attErr) { console.error('Failed to fetch attendance:', attErr.message); process.exit(1) }

// Group attendance by member_id
const attByMember = new Map()
for (const rec of allAttendance) {
  if (!attByMember.has(rec.member_id)) attByMember.set(rec.member_id, [])
  attByMember.get(rec.member_id).push(rec)
}

// Find member with all-attended month
const caseFullAttendance = allMembers.find(m => {
  const recs = attByMember.get(m.id) || []
  return recs.length >= 3 && recs.every(r => r.status === 'attended')
}) || null

// Find member with mixed attendance (at least one of each: attended, absent/excused)
const caseMixedAttendance = allMembers.find(m => {
  const recs = attByMember.get(m.id) || []
  const statuses = new Set(recs.map(r => r.status))
  return statuses.has('attended') && (statuses.has('absent') || statuses.has('excused'))
}) || null

if (!caseFullAttendance)  console.warn('  ⚠️  Could not find a member with all-attended month')
if (!caseMixedAttendance) console.warn('  ⚠️  Could not find a member with mixed attendance')

// De-duplicate the 5 picks (some cases may land on the same member)
const testMembersMap = new Map()
const casePairs = [
  ['0 chores',              caseZeroChores],
  ['1-2 chores',            caseLowChores],
  ['3+ chores (celebrate)', caseCelebration],
  ['full attendance',       caseFullAttendance],
  ['mixed attendance',      caseMixedAttendance],
]
for (const [label, m] of casePairs) {
  if (!m) continue
  if (!testMembersMap.has(m.id)) testMembersMap.set(m.id, { member: m, labels: [] })
  testMembersMap.get(m.id).labels.push(label)
}
const testEntries = [...testMembersMap.values()]

// ─── 3. Print test member details ────────────────────────────────────────────

console.log('\n' + '─'.repeat(70))
console.log(' TEST MEMBERS — log in with these phone numbers to verify')
console.log('─'.repeat(70))

for (const { member: m, labels } of testEntries) {
  const recs = attByMember.get(m.id) || []

  console.log(`\n▸ ${m.full_name}`)
  console.log(`  Cases:        ${labels.join(', ')}`)
  console.log(`  Phone:        ${formatPhone(m.phone)}   (enter: ${m.phone})`)
  console.log(`  Circle label: ${m.circle_label ?? '(null)'}`)
  console.log(`  Circle day:   ${m.circle_day   ?? '⚠️  NULL — parse failure'}`)
  console.log(`  Circle time:  ${m.circle_time  ?? '⚠️  NULL'}`)
  console.log(`  Circle leader:${m.circle_leader ?? '⚠️  NULL'}`)
  console.log(`  Chores done:  ${m.chores_done ?? '⚠️  NULL (treated as 0)'}  / goal: ${m.chores_goal ?? 3}`)

  if (m.chores_done >= 3) {
    console.log(`  Chores state: 🎉 CELEBRATION — ring should be solid green with ✓`)
  } else if ((m.chores_done ?? 0) === 0) {
    console.log(`  Chores state: "Sign up for chores at the front desk"`)
  } else {
    console.log(`  Chores state: "Keep going — you're almost there!"`)
  }

  if (recs.length === 0) {
    console.log(`  Attendance:   (no records this month)`)
  } else {
    const sorted = [...recs].sort((a, b) => b.week_date.localeCompare(a.week_date))
    console.log(`  Attendance (${recs.length} weeks this month):`)
    for (const r of sorted) {
      const badStatus = !VALID_STATUSES.has(r.status) ? ' ⚠️ UNEXPECTED STATUS' : ''
      console.log(`    ${r.week_date}  ${statusIcon(r.status)} ${r.status}${badStatus}`)
    }
  }

  // App-level checks
  const issues = []
  if (!m.phone || m.phone.length !== 10) issues.push('phone not 10 digits — login will fail')
  if (!m.circle_day)    issues.push('circle_day is null — Circle tab will show blank day')
  if (!m.circle_time)   issues.push('circle_time is null — Circle tab will show blank time')
  if (!m.circle_leader) issues.push('circle_leader is null — Circle tab will show blank leader')
  if (m.chores_done === null) issues.push('chores_done is null — app treats as 0')
  if (issues.length) {
    console.log(`  Issues:`)
    issues.forEach(i => console.log(`    ⚠️  ${i}`))
  } else {
    console.log(`  Issues:       none`)
  }
}

// ─── 4. Data quality sweep ────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(70))
console.log(' DATA QUALITY SUMMARY — all members')
console.log('─'.repeat(70))

// Circle parsing nulls
const nullDay     = allMembers.filter(m => !m.circle_day)
const nullTime    = allMembers.filter(m => !m.circle_time)
const nullLeader  = allMembers.filter(m => !m.circle_leader)
const nullLabel   = allMembers.filter(m => !m.circle_label)
const nullChores  = allMembers.filter(m => m.chores_done === null)
const zeroChores  = allMembers.filter(m => (m.chores_done ?? 0) === 0)
const badPhone    = allMembers.filter(m => !m.phone || m.phone.length !== 10)

console.log(`\nMembers: ${allMembers.length} total`)
console.log(`  Bad/missing phone (login broken): ${badPhone.length}`)
if (badPhone.length) badPhone.forEach(m => console.log(`    • ${m.full_name}: "${m.phone}"`))

console.log(`\nCircle parsing:`)
console.log(`  null circle_label:  ${nullLabel.length}`)
console.log(`  null circle_day:    ${nullDay.length}`)
console.log(`  null circle_time:   ${nullTime.length}`)
console.log(`  null circle_leader: ${nullLeader.length}`)

if (nullDay.length) {
  console.log(`\n  Members with null circle_day (label couldn't parse):`)
  nullDay.forEach(m => console.log(`    • ${m.full_name}: label="${m.circle_label ?? '(null)'}"`) )
}

console.log(`\nChores:`)
console.log(`  null chores_done (shows as 0): ${nullChores.length}`)
console.log(`  chores_done = 0:               ${zeroChores.length} (${nullChores.length} are null, rest are real zeros)`)

// Chores distribution
const choreDist = {}
for (const m of allMembers) {
  const c = m.chores_done ?? 0
  choreDist[c] = (choreDist[c] || 0) + 1
}
const keys = Object.keys(choreDist).map(Number).sort((a, b) => a - b)
console.log(`  Distribution:`)
for (const k of keys) {
  const bar = '█'.repeat(Math.min(choreDist[k], 40))
  const celebFlag = k >= 3 ? ' 🎉' : ''
  console.log(`    ${String(k).padStart(3)}: ${bar} ${choreDist[k]}${celebFlag}`)
}

// Attendance quality
console.log(`\nAttendance (this month: ${monthStart} → ${monthEnd}):`)
console.log(`  Total records: ${allAttendance.length}`)

const statusCounts = {}
const badStatuses = []
for (const r of allAttendance) {
  statusCounts[r.status] = (statusCounts[r.status] || 0) + 1
  if (!VALID_STATUSES.has(r.status)) badStatuses.push(r)
}
for (const [s, n] of Object.entries(statusCounts)) {
  const flag = VALID_STATUSES.has(s) ? '' : ' ⚠️ UNEXPECTED'
  console.log(`    ${s}: ${n}${flag}`)
}
if (badStatuses.length) {
  console.log(`\n  ⚠️  Unexpected status values:`)
  badStatuses.forEach(r => console.log(`    member_id=${r.member_id} week=${r.week_date} status="${r.status}"`))
}

// Members with no attendance this month
const noAttThisMonth = allMembers.filter(m => !(attByMember.has(m.id)))
console.log(`\n  Members with NO attendance records this month: ${noAttThisMonth.length}`)
if (noAttThisMonth.length && noAttThisMonth.length <= 20) {
  noAttThisMonth.forEach(m => console.log(`    • ${m.full_name}`))
} else if (noAttThisMonth.length > 20) {
  noAttThisMonth.slice(0, 20).forEach(m => console.log(`    • ${m.full_name}`))
  console.log(`    … and ${noAttThisMonth.length - 20} more`)
}

// Members with attendance this month vs not
const withAttThisMonth = allMembers.filter(m => attByMember.has(m.id))
console.log(`  Members WITH attendance records this month: ${withAttThisMonth.length}`)

// ─── 5. Final summary ─────────────────────────────────────────────────────────

const totalIssues =
  badPhone.length +
  nullDay.length +
  nullChores.length +
  badStatuses.length

console.log('\n' + '═'.repeat(70))
console.log(' FINAL SUMMARY')
console.log('═'.repeat(70))
console.log(`  Members in DB:             ${allMembers.length}`)
console.log(`  Login-broken (bad phone):  ${badPhone.length}`)
console.log(`  Circle parse failures:     ${nullDay.length}`)
console.log(`  Null chores_done:          ${nullChores.length}`)
console.log(`  Bad attendance statuses:   ${badStatuses.length}`)
console.log(`  Total issues found:        ${totalIssues}`)
if (totalIssues === 0) {
  console.log('\n  ✅ No data issues found — app should work for all members')
} else {
  console.log('\n  ⚠️  See details above to fix issues before testing with real users')
}
console.log('═'.repeat(70) + '\n')
