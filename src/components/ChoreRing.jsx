import { useEffect, useState } from 'react'
import { colors } from '../theme.js'

/**
 * Chore progress ring with a growing "crown" of stars for chores beyond the goal.
 *
 *  - 0..goal:   the green ring fills like a normal progress ring.
 *  - == goal:   solid ring + checkmark (goal reached).
 *  - >  goal:   every extra chore adds one gold star around the ring. A full lap
 *               (12 stars) starts a new outer layer in a deeper gold, so someone
 *               with 54 chores sees a visibly fuller, richer crown than someone
 *               with 53. The exact count always lives in the label below the ring.
 *
 * Everything is drawn in one SVG with a viewBox, so it scales cleanly to any
 * width without the ring and crown ever drifting out of alignment.
 */

const VB = 260                 // viewBox square
const C = VB / 2               // center
const STROKE = 12
const RING_R = 84              // core ring radius
const RING_CIRC = 2 * Math.PI * RING_R

const STARS_PER_LAYER = 12
const MAX_LAYERS = 3           // beyond this the count keeps climbing in the label
const LAYER_RADII = [99, 110, 121]
const STAR_R = 8
const NEWEST_R = 9.5
const LAYER_GOLDS = [colors.crownGold1, colors.crownGold2, colors.crownGold3]

// Five-point star path, outer radius r, pointing up, centered at (cx, cy).
function starPath(cx, cy, r) {
  const inner = r * 0.42
  let d = ''
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? r : inner
    d += `${i === 0 ? 'M' : 'L'}${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`
  }
  return d + 'Z'
}

// Build the list of crown stars for `extra` chores beyond goal.
function buildStars(extra) {
  const stars = []
  const shownLayers = Math.min(Math.ceil(extra / STARS_PER_LAYER), MAX_LAYERS)
  for (let layer = 0; layer < shownLayers; layer++) {
    const isFull = layer < Math.floor(extra / STARS_PER_LAYER)
    const count = isFull ? STARS_PER_LAYER : extra % STARS_PER_LAYER
    const r = LAYER_RADII[layer]
    for (let i = 0; i < count; i++) {
      const a = (Math.PI / 6) * i - Math.PI / 2 // 30° steps, first star at top
      const idx = layer * STARS_PER_LAYER + i
      stars.push({
        cx: C + r * Math.cos(a),
        cy: C + r * Math.sin(a),
        color: LAYER_GOLDS[Math.min(layer, LAYER_GOLDS.length - 1)],
        idx,
        newest: idx === extra - 1, // the chore they just earned
      })
    }
  }
  return stars
}

export default function ChoreRing({ value = 0, goal = 3, size = 240 }) {
  const celebrating = value >= goal
  const progress = celebrating ? 1 : Math.min(value / goal, 1)
  const extra = Math.max(0, value - goal)
  const stars = buildStars(extra)

  // Animate the ring fill from empty on mount (matches the small ProgressRing).
  const [offset, setOffset] = useState(RING_CIRC)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOffset(RING_CIRC * (1 - progress)))
    return () => cancelAnimationFrame(raf)
  }, [progress])

  const ringColor = celebrating ? colors.accentGreen : colors.primaryGreen

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VB} ${VB}`}
      style={{ width: '100%', maxWidth: size, height: 'auto', display: 'block', margin: '0 auto' }}
      role="img"
      aria-label={
        extra > 0
          ? `${value} chores done, ${extra} past your goal of ${goal}`
          : `${value} of ${goal} chores done`
      }
    >
      {/* Track */}
      <circle cx={C} cy={C} r={RING_R} fill="none" stroke={colors.border} strokeWidth={STROKE} />
      {/* Progress arc */}
      <circle
        cx={C}
        cy={C}
        r={RING_R}
        fill="none"
        stroke={ringColor}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={RING_CIRC}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${C} ${C})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />

      {/* Crown */}
      {stars.map((s) => (
        <path
          key={s.idx}
          d={starPath(s.cx, s.cy, s.newest ? NEWEST_R : STAR_R)}
          fill={s.color}
          className={s.newest ? 'crown-star crown-star-newest' : 'crown-star'}
          style={{
            transformBox: 'fill-box',
            transformOrigin: 'center',
            // Two delays: entrance pop (staggered, newest lands last), then the
            // idle twinkle starts ~1s after this star has popped in.
            animationDelay: `${(0.55 + s.idx * 0.05).toFixed(2)}s, ${(1.55 + s.idx * 0.05).toFixed(2)}s`,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Center mark: checkmark once the goal is met, otherwise the running count. */}
      <text
        x={C}
        y={C}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={celebrating ? 66 : 60}
        fontWeight="700"
        fill={celebrating ? colors.accentGreen : colors.textDark}
        style={{ fontFamily: 'inherit' }}
      >
        {celebrating ? '✓' : value}
      </text>
    </svg>
  )
}
