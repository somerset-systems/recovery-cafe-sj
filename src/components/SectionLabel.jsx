import { colors, fontSize } from '../theme.js'

export default function SectionLabel({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
      <div
        style={{
          width: 3,
          height: 13,
          borderRadius: 2,
          background: colors.accentGreen,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: fontSize.small,
          color: colors.textLight,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 1.2,
        }}
      >
        {label}
      </span>
    </div>
  )
}
