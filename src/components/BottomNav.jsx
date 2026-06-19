import { useNavigate, useLocation } from 'react-router-dom'
import { colors, fontSize } from '../theme.js'

// Custom duotone nav icons: a soft tinted fill + solid colored linework, each
// tab in its own brand-palette hue. Inlined as SVG so we add no icon-library
// dependency and keep full control of color + stroke. They replace the old
// emoji glyphs (which rendered inconsistently across phones).
//
// Every hue below is drawn from the chore-ring palette in theme.js, tuned to sit
// on cream together, and dark enough to clear 3:1 as a graphic on white. The
// small text labels stay high-contrast ink/gray — color rides on the icons, not
// the type, so legibility (the app's first rule) is never traded for character.
function Icon({ name, color }) {
  const tint = color + '26' // ~15% fill behind the linework for friendly depth
  const svg = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
  }
  const fill = { fill: tint, stroke: 'none' }
  const solid = { fill: color, stroke: 'none' }

  switch (name) {
    case 'home':
      return (
        <svg {...svg}>
          <path d="M4 10.9 12 4.2l8 6.7V19a1.7 1.7 0 0 1-1.7 1.7H5.7A1.7 1.7 0 0 1 4 19Z" {...fill} />
          <path d="M3.3 11.3 12 4l8.7 7.3" />
          <path d="M5.3 10.6V19a1.5 1.5 0 0 0 1.5 1.5h10.4a1.5 1.5 0 0 0 1.5-1.5v-8.4" />
          <path d="M9.8 20.5v-4.3a2.2 2.2 0 0 1 4.4 0v4.3" />
        </svg>
      )
    case 'events':
      // Calendar with a little grid of date dots; the next event glows full color.
      return (
        <svg {...svg}>
          <rect x="4" y="5.2" width="16" height="15" rx="2.4" {...fill} />
          <rect x="4" y="5.2" width="16" height="15" rx="2.4" />
          <path d="M4 9.5h16" />
          <path d="M8.2 3.4v3.4M15.8 3.4v3.4" />
          <circle cx="8.4" cy="13" r="1.15" {...solid} />
          <circle cx="12" cy="13" r="1.15" {...solid} />
          <circle cx="15.6" cy="13" r="1.5" {...solid} />
          <circle cx="8.4" cy="16.6" r="1.15" {...solid} />
          <circle cx="12" cy="16.6" r="1.15" {...solid} />
        </svg>
      )
    case 'circle':
      // The recovery circle: people gathered round, holding the ring together.
      return (
        <svg {...svg}>
          <circle cx="12" cy="12" r="7" {...fill} />
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="5" r="1.9" {...solid} />
          <circle cx="18.1" cy="9.5" r="1.9" {...solid} />
          <circle cx="15.8" cy="17.3" r="1.9" {...solid} />
          <circle cx="8.2" cy="17.3" r="1.9" {...solid} />
          <circle cx="5.9" cy="9.5" r="1.9" {...solid} />
        </svg>
      )
    case 'chores':
      // A check-seal — the chore goal is the app's one celebratory moment.
      return (
        <svg {...svg}>
          <circle cx="12" cy="12" r="7.2" {...fill} />
          <circle cx="12" cy="12" r="7.2" />
          <path d="m8.4 12.2 2.4 2.4 4.7-5.1" strokeWidth="2.1" />
        </svg>
      )
    case 'profile':
      return (
        <svg {...svg}>
          <path d="M5.4 19.6a6.6 6.6 0 0 1 13.2 0Z" {...fill} />
          <circle cx="12" cy="8.4" r="3.1" {...fill} />
          <circle cx="12" cy="8.4" r="3.1" />
          <path d="M5.4 19.6a6.6 6.6 0 0 1 13.2 0" />
        </svg>
      )
    default:
      return null
  }
}

const TABS = [
  { path: '/',        label: 'Home',    icon: 'home',    color: '#2D6A4F' }, // recovery green
  { path: '/events',  label: 'Events',  icon: 'events',  color: '#2A8C8C' }, // teal
  { path: '/circle',  label: 'Circle',  icon: 'circle',  color: '#6B5BB0' }, // purple
  { path: '/chores',  label: 'Chores',  icon: 'chores',  color: '#A6791A' }, // amber/gold
  { path: '/profile', label: 'Profile', icon: 'profile', color: '#C75C6B' }, // rose
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
        // Only the current tab wears its color; the rest go muted gray.
        const iconColor = active ? tab.color : colors.textLight
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            aria-current={active ? 'page' : undefined}
            aria-label={tab.label}
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // A soft pill in the tab's own hue marks the active screen by
                // shape as well as color, so color is never the sole signal.
                padding: '2px 14px',
                borderRadius: 14,
                background: active ? tab.color + '22' : 'transparent',
                transition: 'background 0.18s ease',
              }}
            >
              <Icon name={tab.icon} color={iconColor} />
            </span>
            <span
              style={{
                fontSize: fontSize.small,
                fontWeight: active ? 700 : 500,
                // High-contrast ink/gray on both states — color stays on the icon.
                color: active ? colors.textDark : colors.textMedium,
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
