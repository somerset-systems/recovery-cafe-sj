import { useState } from 'react'
import { colors, fontSize } from '../theme.js'

const LOGO_URL = 'https://recoverycafesj.org/wp-content/uploads/2024/05/rcsj_logo.png'

const SUBTITLES = [
  "We're glad you're here today.",
  'You belong here.',
  'Keep showing up. It matters.',
  'Today is a good day to be here.',
  'This community loves you.',
]

// topOffset makes room for the staff preview banner, which is fixed above the header.
export default function Header({ memberName, topOffset = 0 }) {
  const firstName = memberName ? memberName.split(' ')[0] : ''
  const [logoVisible, setLogoVisible] = useState(true)
  const [subtitle] = useState(() => SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)])

  return (
    <div
      style={{
        position: 'fixed',
        top: topOffset,
        left: 0,
        right: 0,
        background: colors.primaryGreen,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 14,
        paddingBottom: 14,
        zIndex: 100,
        minHeight: 104,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            color: 'rgba(255,255,255,0.75)',
            fontSize: fontSize.small,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          Welcome Back
        </span>
        <span
          style={{
            color: colors.white,
            fontSize: fontSize.xxlarge,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -0.5,
          }}
        >
          {firstName || 'Friend'}
        </span>
        <span
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: fontSize.body,
            fontWeight: 400,
            lineHeight: 1.3,
            marginTop: 2,
          }}
        >
          {subtitle}
        </span>
      </div>

      {logoVisible && (
        <div
          style={{
            background: colors.white,
            borderRadius: 8,
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <img
            src={LOGO_URL}
            alt="Recovery Cafe SJ"
            onError={() => setLogoVisible(false)}
            style={{
              width: 96,
              height: 'auto',
              display: 'block',
              objectFit: 'contain',
            }}
          />
        </div>
      )}
    </div>
  )
}
