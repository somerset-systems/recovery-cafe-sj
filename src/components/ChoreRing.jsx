import { useEffect, useState } from 'react'
import { colors } from '../theme.js'

/**
 * Chore progress ring with a growing "crown" of stars for chores beyond the goal.
 *
 *  - 0..goal:  the green ring fills like a normal progress ring.
 *  - == goal:  solid ring + checkmark (goal reached).
 *  - >  goal:  each extra chore adds a star. Stars fill rings of growing size
 *              (3, then 5, then 8, 13, 21, 34), so the first new ring lands at
 *              just +3 chores and later rings get fuller and rarer. Each ring is
 *              a deeper warm metal. The crown geometry is capped so it stays tidy
 *              at any count; the exact number always shows in the label below.
 *
 * One scalable SVG (viewBox), so the ring and crown never drift out of alignment.
 */

const VB = 260
const C = VB / 2
const STROKE = 12
const RING_R = 80
const RING_CIRC = 2 * Math.PI * RING_R

// Stars per ring, growing outward (~Fibonacci). Cumulative: 3, 8, 16, 29, 50, 84.
const RING_CAPACITY = [3, 5, 8, 13, 21, 34]
const CROWN_MAX = RING_CAPACITY.reduce((a, b) => a + b, 0) // 84
const R_INNER = 94   // radius of the first star ring
const R_OUTER = 126  // radius cap for the outermost ring

// Star outer radius shrinks as more rings appear so everything keeps fitting.
const STAR_R_BY_RINGS = [0, 8, 7, 6, 5, 4.5, 4]

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

// Split `total` stars into rings, then place each ring's stars evenly around it.
function buildCrown(extra) {
  const total = Math.min(extra, CROWN_MAX)
  const counts = []
  let rem = total
  for (const cap of RING_CAPACITY) {
    if (rem <= 0) break
    counts.push(Math.min(rem, cap))
    rem -= cap
  }
  const rings = counts.length
  const starR = STAR_R_BY_RINGS[Math.min(rings, STAR_R_BY_RINGS.length - 1)]
  const step = rings <= 1 ? 0 : Math.min(11, (R_OUTER - R_INNER) / (rings - 1))

  const stars = []
  let idx = 0
  for (let k = 0; k < rings; k++) {
    const n = counts[k]
    const r = rings === 1 ? 102 : R_INNER + k * step
    const color = colors.crownTiers[Math.min(k, colors.crownTiers.length - 1)]
    for (let i = 0; i < n; i++) {
      const a = (-Math.PI / 2) + i * ((2 * Math.PI) / n)
      stars.push({
        cx: C + r * Math.cos(a),
        cy: C + r * Math.sin(a),
        r: starR,
        color,
        idx,
        newest: idx === total - 1,
      })
      idx++
    }
  }
  return { stars, total }
}

export default function ChoreRing({ value = 0, goal = 3, size = 240 }) {
  const celebrating = value >= goal
  const progress = celebrating ? 1 : Math.min(value / goal, 1)
  const extra = Math.max(0, value - goal)
  const { stars, total } = buildCrown(extra)

  // Keep the whole entrance under ~1.4s no matter how many stars there are.
  const delayStep = Math.min(0.05, 1.2 / Math.max(total, 1))

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
      <circle cx={C} cy={C} r={RING_R} fill="none" stroke={colors.border} strokeWidth={STROKE} />
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

      {stars.map((s) => (
        <path
          key={s.idx}
          d={starPath(s.cx, s.cy, s.newest ? s.r + 1.5 : s.r)}
          fill={s.color}
          className={s.newest ? 'crown-star crown-star-newest' : 'crown-star'}
          style={{
            transformBox: 'fill-box',
            transformOrigin: 'center',
            animationDelay: `${(0.55 + s.idx * delayStep).toFixed(2)}s, ${(1.55 + s.idx * delayStep).toFixed(2)}s`,
          }}
          aria-hidden="true"
        />
      ))}

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
