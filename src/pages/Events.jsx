import { useState, useEffect } from 'react'
import { db } from '../lib/supabase.js'
import { colors, fontSize } from '../theme.js'

const TAG_STYLES = {
  Class:    { bg: colors.tagClassBg,    text: colors.tagClass },
  Workshop: { bg: colors.tagWorkshopBg, text: colors.tagWorkshop },
  Music:    { bg: colors.tagMusicBg,    text: colors.tagMusic },
  Special:  { bg: colors.tagSpecialBg,  text: colors.tagSpecial },
}

function parseDateParts(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    day: d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
  }
}

export default function Events() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    db.getUpcomingEvents().then(({ data, error: err }) => {
      if (err) setError(err.message || 'Could not load events.')
      else setEvents(data || [])
      setLoading(false)
    })
  }, [])

  return (
    <div
      style={{
        background: colors.background,
        minHeight: '100dvh',
        padding: '20px 16px',
        boxSizing: 'border-box',
      }}
    >
      <p style={{ margin: '0 0 16px 0', fontSize: fontSize.xlarge, fontWeight: 800, color: colors.textDark, letterSpacing: -0.3 }}>
        Upcoming Events
      </p>

      {loading && (
        <p style={{ color: colors.textMedium, fontSize: fontSize.body }}>Loading events…</p>
      )}

      {error && (
        <p style={{ color: colors.danger, fontSize: fontSize.body }}>{error}</p>
      )}

      {!loading && !error && events.length === 0 && (
        <p style={{ color: colors.textMedium, fontSize: fontSize.body }}>No upcoming events.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {events.map((event) => {
          const { day, month, weekday } = parseDateParts(event.event_date)
          const tagStyle = TAG_STYLES[event.tag] || { bg: colors.border, text: colors.textMedium }
          return (
            <div
              key={event.id}
              style={{
                background: colors.card,
                borderRadius: 18,
                padding: 20,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              {/* Date block */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: 44,
                  background: colors.background,
                  borderRadius: 8,
                  padding: '6px 8px',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: fontSize.small, color: colors.textLight, textTransform: 'uppercase', lineHeight: 1 }}>
                  {month}
                </span>
                <span style={{ fontSize: fontSize.xlarge, fontWeight: 700, color: colors.textDark, lineHeight: 1.1 }}>
                  {day}
                </span>
                <span style={{ fontSize: fontSize.small, color: colors.textLight }}>
                  {weekday}
                </span>
              </div>

              {/* Event info */}
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px 0', fontSize: fontSize.medium, fontWeight: 700, color: colors.textDark }}>
                  {event.title}
                </p>
                <p style={{ margin: '0 0 4px 0', fontSize: fontSize.body, color: colors.textMedium }}>
                  {event.event_time} · {event.location}
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
                  {event.tag}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
