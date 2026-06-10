import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMember } from '../hooks/useMember.js'
import { fetchAllEvents, fetchCircleLocation } from '../lib/googleCalendar.js'
import Card from '../components/Card.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import ProgressRing from '../components/ProgressRing.jsx'
import { colors, fontSize } from '../theme.js'

const TAG_STYLES = {
  Event:                  { bg: colors.tagEventBg, text: colors.tagEvent },
  Music:                  { bg: colors.tagMusicBg, text: colors.tagMusic },
  Class:                  { bg: colors.tagClassBg, text: colors.tagClass },
  'School for Recovery':  { bg: colors.tagSchoolBg, text: colors.tagSchool },
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MAX_SHOWN = 4

function parseTimeMinutes(timeStr) {
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return 0
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const pm = m[3].toLowerCase() === 'pm'
  if (pm && h < 12) h += 12
  if (!pm && h === 12) h = 0
  return h * 60 + min
}

// Returns { dayName, events[] } for the next date within 7 days that has events, or null.
function findNextDayEvents(events) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + 7)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const upcoming = events.filter(e => e.event_date >= todayStr && e.event_date <= cutoffStr)
  if (!upcoming.length) return null

  const nextDate = upcoming.reduce((min, e) => (e.event_date < min ? e.event_date : min), upcoming[0].event_date)
  const dayName = DAY_NAMES[new Date(nextDate + 'T00:00:00').getDay()]

  const dayEvents = upcoming
    .filter(e => e.event_date === nextDate)
    .sort((a, b) => parseTimeMinutes(a.event_time) - parseTimeMinutes(b.event_time))

  return { dayName, events: dayEvents }
}

export default function Home() {
  const { member, loading: memberLoading, error: memberError } = useMember()
  const [circleLocation, setCircleLocation] = useState(null)
  const [nextDayData, setNextDayData]       = useState(null)
  const [eventsLoading, setEventsLoading]   = useState(true)
  const [eventsError, setEventsError]       = useState(null)
  const navigate = useNavigate()

  // Same source as Circle tab
  useEffect(() => {
    if (!member?.circle_leader) return
    fetchCircleLocation(member.circle_leader).then(loc => { if (loc) setCircleLocation(loc) })
  }, [member?.circle_leader])

  useEffect(() => {
    fetchAllEvents()
      .then(events => setNextDayData(findNextDayEvents(events)))
      .catch(err => setEventsError(err.message || 'Could not load events.'))
      .finally(() => setEventsLoading(false))
  }, [])

  if (memberLoading) return <LoadingScreen />
  if (memberError)   return <ErrorScreen message={memberError} />
  if (!member)       return <ErrorScreen message="Could not load your profile." />

  const celebrating = member.chores_done >= member.chores_goal
  const upcomingLabel = nextDayData ? `Coming Up — ${nextDayData.dayName}` : 'Coming Up'

  return (
    <div
      style={{
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxSizing: 'border-box',
      }}
    >
      {/* Circle Card */}
      <Card>
        <SectionLabel label="Your Circle" />
        <p style={{ margin: '0 0 2px 0', fontSize: fontSize.large, fontWeight: 700, color: colors.textDark }}>
          {member.circle_day} Circle
        </p>
        <p style={{ margin: 0, fontSize: fontSize.body, color: colors.textMedium }}>
          {member.circle_time} · Led by {member.circle_leader}
        </p>
        {circleLocation && (
          <p style={{ margin: '4px 0 0 0', fontSize: fontSize.body, color: colors.textMedium }}>
            📍 {circleLocation}
          </p>
        )}
      </Card>

      {/* Chores Card */}
      <Card style={{ cursor: 'pointer' }} onClick={() => navigate('/chores')}>
        <SectionLabel label="Chores" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <ProgressRing value={member.chores_done} goal={member.chores_goal} size={88} celebrating={celebrating} />
          <div>
            <p style={{ margin: '0 0 4px 0', fontSize: fontSize.large, fontWeight: 700, color: colors.textDark }}>
              {celebrating ? 'Goal reached! 🎉' : `${member.chores_done} of ${member.chores_goal} done`}
            </p>
            <p style={{ margin: 0, fontSize: fontSize.body, color: colors.textMedium }}>
              {celebrating ? 'Amazing work this month!' : 'Tap to see details'}
            </p>
          </div>
        </div>
      </Card>

      {/* Coming Up Card */}
      <Card>
        <SectionLabel label={upcomingLabel} />

        {eventsLoading && (
          <p style={{ margin: 0, color: colors.textMedium, fontSize: fontSize.body }}>Loading…</p>
        )}
        {eventsError && (
          <p style={{ margin: 0, color: colors.danger, fontSize: fontSize.body }}>{eventsError}</p>
        )}
        {!eventsLoading && !eventsError && !nextDayData && (
          <p style={{ margin: 0, color: colors.textMedium, fontSize: fontSize.body }}>
            No upcoming events this week.
          </p>
        )}
        {nextDayData && (
          <DayEventList data={nextDayData} navigate={navigate} />
        )}
      </Card>
    </div>
  )
}

function DayEventList({ data, navigate }) {
  const shown    = data.events.slice(0, MAX_SHOWN)
  const overflow = data.events.length - MAX_SHOWN

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {shown.map((event, i) => {
        const tagStyle = TAG_STYLES[event.tag] || { bg: colors.border, text: colors.textMedium }
        return (
          <div key={event.id ?? i}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <p style={{ margin: '0 0 2px 0', fontSize: fontSize.medium, fontWeight: 700, color: colors.textDark, flex: 1 }}>
                {event.title}
              </p>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 20,
                  background: tagStyle.bg,
                  color: tagStyle.text,
                  fontSize: fontSize.small,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {event.tag}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: fontSize.body, color: colors.textMedium }}>
              {event.event_time}{event.location ? ` · ${event.location}` : ''}
            </p>
          </div>
        )
      })}

      {overflow > 0 && (
        <button
          onClick={() => navigate('/events')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: colors.primaryGreen,
            fontSize: fontSize.body,
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left',
            textDecoration: 'underline',
          }}
        >
          View all {data.events.length} events →
        </button>
      )}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ color: colors.textMedium, fontSize: fontSize.body }}>Loading…</p>
    </div>
  )
}

function ErrorScreen({ message }) {
  return (
    <div style={{ padding: 24 }}>
      <p style={{ color: colors.danger, fontSize: fontSize.body }}>{message}</p>
    </div>
  )
}
