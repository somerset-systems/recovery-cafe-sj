import { colors } from '../theme.js'

export default function Card({ children, style }) {
  return (
    <div
      style={{
        background: colors.card,
        borderRadius: 18,
        padding: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
