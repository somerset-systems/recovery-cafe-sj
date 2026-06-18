import { useEffect, useState } from 'react'
import { colors } from '../theme.js'
import { getRings } from '../lib/choreRings.js'

/**
 * Concentric chore rings. The green goal ring sits innermost; each chore tier
 * beyond it is an outer ring in a complementary colour, filled from the inside out.
 *
 *  - A member only sees the rings they've closed plus the ONE they're working on.
 *    The next ring opens the moment the current one closes.
 *  - The view scales to the rings on show, so a member with one ring sees a big bold
 *    ring (not a tiny one adrift in whitespace); it zooms out as rings are unlocked.
 *  - The active ring is partly filled and softly glows; closed rings are solid.
 *  - On load the arcs sweep in from empty, innermost-first. The centre shows the
 *    total chores done.
 */

const VB = 300
const C = VB / 2
const INNER_R = 54   // centre-line radius of the innermost (green) ring
const STEP = 13      // radius between concentric rings
const STROKE = 8.5

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function ChoreRing({ value = 0, goal = 3, size = 260 }) {
  const { rings, active, allClosed } = getRings(value)

  // Only closed rings + the active one are shown; the rest stay hidden until earned.
  const visibleCount = allClosed ? rings.length : active.index + 1
  const shownRings = rings.slice(0, visibleCount)

  // Scale the viewBox to the outermost visible ring so the rings fill the frame.
  const maxR = INNER_R + (visibleCount - 1) * STEP
  const half = maxR + STROKE / 2 + 9
  const viewBox = `${(C - half).toFixed(1)} ${(C - half).toFixed(1)} ${(2 * half).toFixed(1)} ${(2 * half).toFixed(1)}`

  // Sweep the arcs in after mount. Reduced-motion users start "shown" so they see
  // the finished progress immediately, never a blank frame.
  const [shown, setShown] = useState(prefersReducedMotion)
  useEffect(() => {
    setShown(false)
    const raf = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(raf)
  }, [value])

  const centreColor = allClosed ? colors.gold : value >= goal ? colors.primaryGreen : colors.textDark
  // Centre number scales with the frame so it stays nicely sized at any ring count.
  const numFont = Math.min(64, half * 0.78)

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      style={{ width: '100%', maxWidth: size, height: 'auto', display: 'block', margin: '0 auto', overflow: 'visible' }}
      role="img"
      aria-label={`${value} chores done`}
    >
      {shownRings.map((ring) => {
        const r = INNER_R + ring.index * STEP
        const circ = 2 * Math.PI * r
        const target = circ * (1 - ring.progress)
        const isActive = !ring.closed && ring.progress > 0
        return (
          <g key={ring.name} style={{ opacity: shown ? 1 : 0, transition: 'opacity 0.4s ease', transitionDelay: `${(ring.index * 0.08).toFixed(2)}s` }}>
            {/* faint track of the ring currently in play */}
            <circle cx={C} cy={C} r={r} fill="none" stroke={ring.color} strokeOpacity={0.15} strokeWidth={STROKE} />
            {/* vivid progress arc */}
            <circle
              cx={C}
              cy={C}
              r={r}
              fill="none"
              stroke={ring.color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={shown ? target : circ}
              transform={`rotate(-90 ${C} ${C})`}
              style={{
                transition: 'stroke-dashoffset 0.85s cubic-bezier(0.22,1,0.36,1)',
                transitionDelay: `${(ring.index * 0.09).toFixed(2)}s`,
                filter: isActive ? `drop-shadow(0 0 3px ${ring.color}aa)` : 'none',
              }}
            />
          </g>
        )
      })}

      <text
        x={C}
        y={C}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={numFont}
        fontWeight="800"
        fill={centreColor}
        style={{ fontFamily: 'inherit' }}
      >
        {value}
      </text>
    </svg>
  )
}
