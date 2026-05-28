import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, normalizePhone } from '../lib/supabase.js'
import { colors, fontSize } from '../theme.js'

const LOGO_URL = 'https://recoverycafesj.org/wp-content/uploads/2024/05/rcsj_logo.png'

export default function Login() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [logoVisible, setLogoVisible] = useState(true)
  const navigate = useNavigate()

  function handlePhoneChange(e) {
    // Allow digits only, max 10
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhone(digits)
    setErrorMsg('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const normalized = normalizePhone(phone)
    if (normalized.length !== 10) {
      setErrorMsg('Please enter a 10-digit phone number.')
      return
    }

    setLoading(true)
    setErrorMsg('')

    const { data: member, error } = await db.getMemberByPhone(normalized)

    setLoading(false)

    if (error || !member) {
      setErrorMsg("We couldn't find your number. Ask a staff member for help.")
      return
    }

    localStorage.setItem('memberId', member.id)
    navigate('/')
  }

  // Display phone with simple formatting: (408) 555-0001
  function displayPhone(digits) {
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: colors.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        boxSizing: 'border-box',
      }}
    >
      {/* Logo */}
      {logoVisible ? (
        <img
          src={LOGO_URL}
          alt="Recovery Cafe San Jose"
          onError={() => setLogoVisible(false)}
          style={{
            width: 100,
            height: 100,
            objectFit: 'contain',
            marginBottom: 20,
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: colors.primaryGreen,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 28,
            flexShrink: 0,
          }}
        >
          <span style={{ color: colors.white, fontSize: fontSize.medium, fontWeight: 700, letterSpacing: 1 }}>
            RCSJ
          </span>
        </div>
      )}

      {/* Headline */}
      <h1
        style={{
          fontSize: fontSize.xlarge,
          color: colors.textDark,
          fontWeight: 700,
          textAlign: 'center',
          margin: '0 0 8px 0',
          lineHeight: 1.3,
        }}
      >
        Welcome to Recovery Cafe San Jose
      </h1>

      <p
        style={{
          fontSize: fontSize.body,
          color: colors.textMedium,
          textAlign: 'center',
          margin: '0 0 36px 0',
        }}
      >
        Enter your phone number to sign in.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <input
          type="tel"
          inputMode="numeric"
          placeholder="(408) 555-0000"
          value={displayPhone(phone)}
          onChange={handlePhoneChange}
          autoFocus
          style={{
            height: 52,
            borderRadius: 10,
            border: `1.5px solid ${colors.border}`,
            padding: '0 16px',
            fontSize: fontSize.large,
            color: colors.textDark,
            background: colors.white,
            outline: 'none',
            boxSizing: 'border-box',
            width: '100%',
            textAlign: 'center',
            letterSpacing: 1,
          }}
        />

        {errorMsg && (
          <p
            style={{
              color: colors.danger,
              fontSize: fontSize.body,
              margin: 0,
              textAlign: 'center',
            }}
          >
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            height: 52,
            borderRadius: 10,
            border: 'none',
            background: loading ? colors.accentGreen : colors.primaryGreen,
            color: colors.white,
            fontSize: fontSize.large,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            width: '100%',
            transition: 'background 0.2s',
          }}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
