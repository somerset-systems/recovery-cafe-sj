import { useState, useEffect } from 'react'
import { useMember } from '../hooks/useMember.js'
import { db } from '../lib/supabase.js'
import Card from '../components/Card.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import { colors, fontSize } from '../theme.js'

const STATUS_CONFIG = {
  attended:    { label: 'Attended', bg: colors.chipAttended, text: colors.white },
  absent:      { label: 'Missed',   bg: colors.chipMissed,   text: colors.white },
  excused:     { label: 'Excused',  bg: colors.chipExcused,  text: colors.white },
  not_enrolled:{ label: 'Not yet',  bg: colors.chipNotYet,   text: colors.white },
}

function formatWeekDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Circle() {
  const { member, loading: memberLoading, error: memberError } = useMember()
  const [attendance, setAttendance] = useState([])
  const [attLoading, setAttLoading] = useState(true)
  const [attError, setAttError] = useState(null)

  useEffect(() => {
    if (!member) return
    db.getAttendanceForMember(member.id).then(({ data, error }) => {
      if (error) setAttError(error.message || 'Could not load attendance.')
      else setAttendance(data || [])
      setAttLoading(false)
    })
  }, [member])

  if (memberLoading) return <Loading />
  if (memberError) return <Err message={memberError} />
  if (!member) return <Err message="Could not load your profile." />

  return (
    <div
      style={{
        background: colors.background,
        minHeight: '100dvh',
        padding: '20px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
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
        <p style={{ margin: 0, fontSize: fontSize.body, color: colors.textMedium }}>
          Led by {member.circle_leader}
        </p>
      </Card>

      {/* Attendance */}
      <Card>
        <SectionLabel label="This Month" />

        {attLoading && (
          <p style={{ margin: 0, color: colors.textMedium, fontSize: fontSize.body }}>Loading…</p>
        )}

        {attError && (
          <p style={{ margin: 0, color: colors.danger, fontSize: fontSize.body }}>{attError}</p>
        )}

        {!attLoading && !attError && attendance.length === 0 && (
          <p style={{ margin: 0, color: colors.textMedium, fontSize: fontSize.body }}>No attendance records yet this month.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {attendance.map((record) => {
            const cfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.not_enrolled
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
