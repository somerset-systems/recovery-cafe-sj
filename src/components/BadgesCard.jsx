import { useState, useEffect, Fragment } from 'react'
import Card from './Card.jsx'
import SectionLabel from './SectionLabel.jsx'
import { evaluateBadges } from '../lib/badges.js'
import { colors, fontSize } from '../theme.js'

const LOCKED_BG = '#ECE7DF' // muted cream for badges not yet earned

// Lighten a hex colour toward white by `amt` (0..1) — used for the soft gradient
// behind a celebrated badge so it glows without a CSS file.
function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * amt)
  const g = Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * amt)
  const b = Math.round((n & 255) + (255 - (n & 255)) * amt)
  return `rgb(${r}, ${g}, ${b})`
}

// One badge in the wall: a tappable coloured emoji disc + its name. Earned badges
// glow in their own colour; locked ones are quietly greyed so the wall reads as
// progress, never as failure. Tapping reveals the badge's meaning below the wall.
function BadgeTile({ badge, selected, onSelect }) {
  const { earned, color, emoji, name, count, countable } = badge
  const showCount = earned && countable && count > 1
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7,
        padding: '6px 2px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        borderRadius: 12,
        outline: selected ? `2.5px solid ${earned ? color : colors.textLight}` : 'none',
        outlineOffset: 2,
      }}
    >
      <div style={{ position: 'relative' }}>
        <div
          style={{
            width: 62,
            height: 62,
            borderRadius: '50%',
            background: earned ? color : LOCKED_BG,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 29,
            filter: earned ? 'none' : 'grayscale(1)',
            opacity: earned ? 1 : 0.5,
            boxShadow: earned ? `0 3px 10px ${color}40` : 'none',
            transition: 'all 0.3s ease',
          }}
        >
          {emoji}
        </div>
        {showCount && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -6,
              minWidth: 22,
              height: 22,
              padding: '0 5px',
              boxSizing: 'border-box',
              borderRadius: 11,
              background: colors.white,
              border: `2px solid ${color}`,
              color,
              fontSize: 12,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }}
          >
            ×{count}
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: fontSize.small,
          fontWeight: 600,
          color: earned ? colors.textDark : colors.textMedium,
          textAlign: 'center',
          lineHeight: 1.2,
          opacity: earned ? 1 : 0.75,
        }}
      >
        {name}
      </span>
    </button>
  )
}

// The big, readable panel shown when a member taps a badge — its meaning in plain
// language, in large text, one badge at a time (fits the design rules).
function BadgeDetail({ badge }) {
  const { earned, color, emoji, name, requirement, count, countable } = badge
  let status, statusColor
  if (!earned) {
    status = 'Not earned yet — keep going!'
    statusColor = colors.textLight
  } else if (countable && count > 1) {
    status = `✓ You've earned this ${count} times! 🎉`
    statusColor = color
  } else {
    status = '✓ Earned!'
    statusColor = color
  }

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: earned ? lighten(color, 0.88) : colors.background,
        border: `1.5px solid ${earned ? lighten(color, 0.55) : colors.border}`,
        display: 'flex',
        gap: 14,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          flexShrink: 0,
          borderRadius: '50%',
          background: earned ? color : LOCKED_BG,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 27,
          filter: earned ? 'none' : 'grayscale(1)',
          opacity: earned ? 1 : 0.6,
        }}
      >
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: fontSize.large, fontWeight: 800, color: colors.textDark }}>
          {name}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: fontSize.body, color: colors.textMedium, lineHeight: 1.4 }}>
          {requirement}.
        </p>
        <p style={{ margin: '8px 0 0', fontSize: fontSize.body, fontWeight: 700, color: statusColor }}>
          {status}
        </p>
      </div>
    </div>
  )
}

// The "🎉 you just earned this" moment — the meaningful celebration. Shows once
// per newly-earned badge (tracked in localStorage), then quietly goes away.
function CelebrationBanner({ badge, onDone }) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 16,
        padding: '16px 18px',
        marginBottom: 16,
        background: `linear-gradient(135deg, ${badge.color}, ${lighten(badge.color, 0.28)})`,
        boxShadow: `0 4px 16px ${badge.color}55`,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        color: colors.white,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          flexShrink: 0,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
        }}
      >
        {badge.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: fontSize.small, fontWeight: 700, letterSpacing: 0.6, opacity: 0.92 }}>
          🎉 NEW BADGE EARNED
        </p>
        <p style={{ margin: '2px 0 0', fontSize: fontSize.large, fontWeight: 800 }}>
          {badge.name}
        </p>
      </div>
      <button
        onClick={onDone}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.22)',
          color: colors.white,
          fontSize: 18,
          fontWeight: 700,
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}

export default function BadgesCard({ member, attendance = [], choreMonths = [], loading = false }) {
  const [celebrate, setCelebrate] = useState([])
  const [selectedKey, setSelectedKey] = useState(null)

  // Compute badges every render (cheap, pure). Guard against a missing member.
  const badges = member ? evaluateBadges(member, { attendance, choreMonths }) : []
  const earnedKeys = badges.filter((b) => b.earned).map((b) => b.key)

  // Detect badges earned since the member last looked, and celebrate each once.
  // First-ever view initialises silently so we don't fire 10 banners at launch.
  useEffect(() => {
    if (loading || !member) return
    const storeKey = `badgesSeen:${member.id}`
    let seen = null
    try { seen = JSON.parse(localStorage.getItem(storeKey) || 'null') } catch { seen = null }
    if (Array.isArray(seen)) {
      const fresh = badges.filter((b) => b.earned && !seen.includes(b.key))
      if (fresh.length) setCelebrate(fresh)
    }
    localStorage.setItem(storeKey, JSON.stringify(earnedKeys))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, member?.id, earnedKeys.join(',')])

  if (loading) {
    return (
      <Card>
        <SectionLabel label="Your Badges" />
        <p style={{ margin: 0, color: colors.textMedium, fontSize: fontSize.body }}>Loading…</p>
      </Card>
    )
  }

  const earnedCount = badges.filter((b) => b.earned).length
  const selected = badges.find((b) => b.key === selectedKey) || null
  const nextUp = badges.filter((b) => !b.earned).slice(0, 3)

  // Chunk the badges into rows of 3 so the detail panel can be inserted under the
  // tapped badge's row (matches the 3-column grid below).
  const rows = []
  for (let i = 0; i < badges.length; i += 3) rows.push(badges.slice(i, i + 3))

  return (
    <Card>
      {celebrate.map((b) => (
        <CelebrationBanner
          key={b.key}
          badge={b}
          onDone={() => setCelebrate((cur) => cur.filter((x) => x.key !== b.key))}
        />
      ))}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionLabel label="Your Badges" />
        <span style={{ fontSize: fontSize.body, fontWeight: 700, color: colors.accentGreen }}>
          {earnedCount} of {badges.length}
        </span>
      </div>

      <p style={{ margin: '0 0 4px', fontSize: fontSize.small, color: colors.textLight }}>
        Tap a badge to see what it means.
      </p>

      {/* Render the wall row-by-row so the tapped badge's description can appear
          directly beneath ITS row — right where the member is looking — instead
          of at the bottom of the whole grid. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
        {rows.map((row, ri) => (
          <Fragment key={ri}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 4px' }}>
              {row.map((b) => (
                <BadgeTile
                  key={b.key}
                  badge={b}
                  selected={b.key === selectedKey}
                  onSelect={() => setSelectedKey((cur) => (cur === b.key ? null : b.key))}
                />
              ))}
            </div>
            {selected && row.some((b) => b.key === selectedKey) && (
              <BadgeDetail badge={selected} />
            )}
          </Fragment>
        ))}
      </div>

      {/* With nothing selected, guide the member with the next goals to aim for. */}
      {!selected && nextUp.length > 0 && (
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1.5px solid ${colors.border}` }}>
          <p style={{ margin: '0 0 10px', fontSize: fontSize.small, fontWeight: 700, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 1.2 }}>
            Next Up
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {nextUp.map((b) => (
              <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22, filter: 'grayscale(1)', opacity: 0.7 }}>{b.emoji}</span>
                <span style={{ fontSize: fontSize.body, color: colors.textDark }}>
                  <strong style={{ fontWeight: 700 }}>{b.name}</strong> — {b.requirement}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
