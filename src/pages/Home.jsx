import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMember } from '../hooks/useMember.js'
import { db } from '../lib/supabase.js'
import Card from '../components/Card.jsx'
import SectionLabel from '../components/SectionLabel.jsx'
import ProgressRing from '../components/ProgressRing.jsx'
import { colors, fontSize } from '../theme.js'

const TAG_STYLES = {
  Class:    { bg: colors.tagClassBg,    text: colors.tagClass },
  Workshop: { bg: colors.tagWorkshopBg, text: colors.tagWorkshop },
  Music:    { bg: colors.tagMusicBg,    text: colors.tagMusic },
  Special:  { bg: colors.tagSpecialBg,  text: colors.tagSpecial },
}

function formatEventDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function Home() {
  const { member, loading: memberLoading, error: memberError } = useMember()
  const [nextEvent, setNextEvent] = useState(null)
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    db.getUpcomingEvents().then(({ data, error }) => {
      if (error) setEventsError(error.message || 'Could not load events.')
      else setNextEvent(data?.[0] || null)
      setEventsLoading(false)
    })
  }, [])

  if (memberLoading) return <LoadingScreen />
  if (memberError) return <ErrorScreen message={memberError} />
  if (!member) return <ErrorScreen message="Could not load your profile." />

  const celebrating = member.chores_done >= member.chores_goal
  const tagStyle = TAG_STYLES[nextEvent?.tag] || { bg: colors.border, text: colors.textMedium }

  return (
    <div
      style={{
        background: colors.background,
        minHeight: '100dvh',
        padding: '20px 16px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
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

      {/* Next Event Card */}
      <Card>
        <SectionLabel label="Next Event" />
        {eventsLoading && (
          <p style={{ margin: 0, color: colors.textMedium, fontSize: fontSize.body }}>Loading…</p>
        )}
        {eventsError && (
          <p style={{ margin: 0, color: colors.danger, fontSize: fontSize.body }}>{eventsError}</p>
        )}
        {!eventsLoading && !eventsError && !nextEvent && (
          <p style={{ margin: 0, color: colors.textMedium, fontSize: fontSize.body }}>No upcoming events.</p>
        )}
        {nextEvent && (
          <>
            <p style={{ margin: '0 0 2px 0', fontSize: fontSize.large, fontWeight: 700, color: colors.textDark }}>
              {nextEvent.title}
            </p>
            <p style={{ margin: '0 0 8px 0', fontSize: fontSize.body, color: colors.textMedium }}>
              {formatEventDate(nextEvent.event_date)} · {nextEvent.event_time}
            </p>
            <p style={{ margin: '0 0 10px 0', fontSize: fontSize.body, color: colors.textMedium }}>
              {nextEvent.location}
            </p>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: 20,
                background: tagStyle.bg,
                color: tagStyle.text,
                fontSize: fontSize.small,
                fontWeight: 700,
              }}
            >
              {nextEvent.tag}
            </span>
          </>
        )}
      </Card>
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
