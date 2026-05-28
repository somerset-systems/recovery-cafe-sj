import { useNavigate, useLocation } from 'react-router-dom'
import { colors, fontSize } from '../theme.js'

const TABS = [
  { path: '/',        label: 'Home',   icon: '🏠' },
  { path: '/events',  label: 'Events', icon: '📅' },
  { path: '/circle',  label: 'Circle', icon: '👥' },
  { path: '/chores',  label: 'Chores', icon: '✅' },
  { path: '/profile', label: 'Profile', icon: '👤' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        background: colors.card,
        borderTop: `2px solid ${colors.border}`,
        display: 'flex',
        zIndex: 100,
      }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.path
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <span
              style={{
                fontSize: 22,
                lineHeight: 1,
                filter: 'grayscale(1)',
                opacity: active ? 1 : 0.45,
              }}
            >
              {tab.icon}
            </span>
            <span
              style={{
                fontSize: fontSize.small,
                fontWeight: active ? 700 : 400,
                color: active ? colors.primaryGreen : '#9CA3AF',
              }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
