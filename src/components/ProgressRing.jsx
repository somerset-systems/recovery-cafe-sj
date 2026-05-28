import { useEffect, useState } from 'react'
import { colors } from '../theme.js'

/**
 * SVG progress ring for chores display.
 * Props:
 *   value      — chores done (0–goal)
 *   goal       — target count (default 3)
 *   size       — diameter in px (default 160)
 *   celebrating — if true, show solid green ring + checkmark
 */
export default function ProgressRing({ value = 0, goal = 3, size = 160, celebrating = false }) {
  const stroke = size * 0.085
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(value / goal, 1)

  // Animate from 0 on mount
  const [animatedOffset, setAnimatedOffset] = useState(circumference)

  useEffect(() => {
    const target = circumference * (1 - (celebrating ? 1 : progress))
    const raf = requestAnimationFrame(() => setAnimatedOffset(target))
    return () => cancelAnimationFrame(raf)
  }, [value, celebrating, circumference, progress])

  const ringColor = celebrating ? colors.accentGreen : colors.primaryGreen
  const trackColor = colors.border

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: size,
        height: size,
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>

      {/* Center label */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.28,
          fontWeight: 700,
          color: celebrating ? colors.accentGreen : colors.textDark,
        }}
      >
        {celebrating ? '✓' : value}
      </div>
    </div>
  )
}
