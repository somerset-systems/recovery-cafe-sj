import { useState, useEffect } from 'react'
import { useMember } from '../hooks/useMember.js'
import { db } from '../lib/supabase.js'
import { fetchCircleLocation } from '../lib/googleCalendar.js'
import Card from '../components/Card.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import { colors, fontSize } from '../theme.js'

const STATUS_CONFIG = {
  attended:    { label: 'Attended', bg: colors.chipAttended, text: colors.white },
  absent:      { label: 'Missed',   bg: colors.chipMissed,   text: colors.white },
  excused:     { label: 'Excused',  bg: colors.chipExcused,  text: colors.white },
  not_enrolled:{ label: 'Not yet',  bg: colors.chipNotYet,   text: colors.white },
  // A week that has already ended with nothing recorded. Quiet outline, not red:
  // a blank past week means staff didn't log it, not that the member missed.
  no_record:   { label: 'No record', bg: 'transparent', text: colors.textMedium, outline: true },
}

// Sunday (YYYY-MM-DD, local) of the week containing today. A week whose Sunday is
// before this is fully concluded; at/after it the week is current or upcoming.
function currentWeekSunday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// Current attendance streak: consecutive circles attended, counting back from the
// most recent week. An absence ends the streak; excused weeks and weeks with no
// record are neutral — they neither add to it nor break it. `historyDesc` is the
// attendance list newest-first, already trimmed to HISTORY_START → today.
function currentStreak(historyDesc) {
  let streak = 0
  for (const r of historyDesc) {
    if (r.status === 'attended') streak++
    else if (r.status === 'absent') break
    // excused / not_enrolled (no record / not yet): neutral — keep counting back
  }
  return streak
}

// Only show history from this date forward (no records before the program started tracking)
const HISTORY_START = '2025-12-01'
// Max weeks shown before "View more" is offered
const MAX_WEEKS = 12

function formatWeekDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Circle() {
  const { member, loading: memberLoading, error: memberError } = useMember()
  const [attendance, setAttendance] = useState([])
  const [attLoading, setAttLoading] = useState(true)
  const [attError, setAttError]     = useState(null)
  const [showAll, setShowAll]       = useState(false)
  const [location, setLocation]     = useState(null)

  useEffect(() => {
    if (!member) return
    db.getAttendanceForMember(member.id).then(({ data, error }) => {
      if (error) setAttError(error.message || 'Could not load attendance.')
      else setAttendance(data || [])
      setAttLoading(false)
    })
  }, [member])

  // Silently fetch circle location from Google Calendar — no error shown if unavailable
  useEffect(() => {
    if (!member?.circle_leader) return
    fetchCircleLocation(member.circle_leader).then(loc => {
      if (loc) setLocation(loc)
    })
  }, [member?.circle_leader])

  if (memberLoading) return <Loading />
  if (memberError) return <Err message={memberError} />
  if (!member) return <Err message="Could not load your profile." />

  const today = new Date().toISOString().slice(0, 10)
  const weekStart = currentWeekSunday()

  // Filter to Dec 1 2025 → today, most recent first
  const history = attendance
    .filter(r => r.week_date >= HISTORY_START && r.week_date <= today)
    .sort((a, b) => b.week_date.localeCompare(a.week_date))

  const hasMore = history.length > MAX_WEEKS
  const displayed = showAll ? history : history.slice(0, MAX_WEEKS)
  const streak = currentStreak(history)

  return (
    <div
      style={{
        padding: '20px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Circle info */}
      <Card>
        <SectionLabel label="Your Circle" />
        <p style={{ margin: '0 0 4px 0', fontSize: fontSize.xlarge, fontWeight: 700, color: colors.textDark }}>
          {member.circle_day} Circle
        </p>
        <p style={{ margin: '0 0 2px 0', fontSize: fontSize.medium, color: colors.textMedium }}>
          {member.circle_time}
        </p>
        {location && (
          <p style={{ margin: '0 0 2px 0', fontSize: fontSize.body, color: colors.textMedium }}>
            📍 {location}
          </p>
        )}
        <p style={{ margin: 0, fontSize: fontSize.body, color: colors.textMedium }}>
          Led by {member.circle_leader}
        </p>
      </Card>

      {/* Current streak — only shown once it's something to celebrate (2+). */}
      {streak >= 2 && (
        <Card style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 44, lineHeight: 1, flexShrink: 0 }}>🔥</div>
          <div>
            <p style={{ margin: 0, fontSize: fontSize.xxlarge, fontWeight: 800, color: colors.primaryGreen }}>
              {streak} in a row
            </p>
            <p style={{ margin: '2px 0 0', fontSize: fontSize.body, color: colors.textMedium, lineHeight: 1.4 }}>
              circles attended since your last miss — keep it going!
            </p>
          </div>
        </Card>
      )}

      {/* Attendance history */}
      <Card>
        <SectionLabel label="Your Attendance History" />

        {attLoading && (
          <p style={{ margin: 0, color: colors.textMedium, fontSize: fontSize.body }}>Loading…</p>
        )}

        {attError && (
          <p style={{ margin: 0, color: colors.danger, fontSize: fontSize.body }}>{attError}</p>
        )}

        {!attLoading && !attError && history.length === 0 && (
          <p style={{ margin: 0, color: colors.textMedium, fontSize: fontSize.body }}>
            No attendance records on file yet.
          </p>
        )}

        {!attLoading && !attError && history.length > 0 && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {displayed.map((record) => {
                // A blank/not-enrolled cell reads as "Not yet" for the current or an
                // upcoming week, but as "No record" once that week has fully passed.
                const unrecorded = record.status === 'not_enrolled'
                const cfg = unrecorded && record.week_date < weekStart
                  ? STATUS_CONFIG.no_record
                  : (STATUS_CONFIG[record.status] || STATUS_CONFIG.not_enrolled)
                return (
                  <div
                    key={record.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: fontSize.body, color: colors.textMedium }}>
                      Week of {formatWeekDate(record.week_date)}
                    </span>
                    <span
                      style={{
                        background: cfg.bg,
                        color: cfg.text,
                        border: `1.5px solid ${cfg.outline ? colors.border : 'transparent'}`,
                        borderRadius: 20,
                        padding: '5px 16px',
                        fontSize: fontSize.small,
                        fontWeight: 600,
                        minWidth: 78,
                        textAlign: 'center',
                      }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                )
              })}
            </div>

            {hasMore && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                style={{
                  marginTop: 16,
                  width: '100%',
                  height: 44,
                  borderRadius: 10,
                  border: `1.5px solid ${colors.border}`,
                  background: 'transparent',
                  color: colors.primaryGreen,
                  fontSize: fontSize.body,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                View more ({history.length - MAX_WEEKS} older weeks)
              </button>
            )}

            <p style={{ margin: '16px 0 0', fontSize: fontSize.small, color: colors.textLight, lineHeight: 1.4 }}>
              Attendance records begin December 1, 2025.
            </p>
          </>
        )}
      </Card>
    </div>
  )
}

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ color: colors.textMedium, fontSize: fontSize.body }}>Loading…</p>
    </div>
  )
}

function Err({ message }) {
  return <div style={{ padding: 24 }}><p style={{ color: colors.danger }}>{message}</p></div>
}
