import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, normalizePhone } from '../lib/supabase.js'
import { colors, fontSize } from '../theme.js'

const LOGO_URL = 'https://recoverycafesj.org/wp-content/uploads/2024/05/rcsj_logo.png'

// ── Rate limiting ─────────────────────────────────────────────────────────────
const RATE_KEY     = 'loginAttempts'
const LOCKOUT_KEY  = 'loginLockoutUntil'
const MAX_ATTEMPTS = 5
const LOCKOUT_MS   = 10 * 60 * 1000 // 10 minutes

function lockoutRemaining() {
  return Math.max(0, parseInt(localStorage.getItem(LOCKOUT_KEY) || '0', 10) - Date.now())
}

function recordFailedAttempt() {
  const n = parseInt(localStorage.getItem(RATE_KEY) || '0', 10) + 1
  localStorage.setItem(RATE_KEY, String(n))
  if (n >= MAX_ATTEMPTS) {
    localStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS))
    localStorage.removeItem(RATE_KEY)
  }
}

function clearAttempts() {
  localStorage.removeItem(RATE_KEY)
  localStorage.removeItem(LOCKOUT_KEY)
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function displayPhone(digits) {
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Login() {
  const [phase, setPhase]                = useState('phone') // 'phone' | 'code'
  const [phone, setPhone]                = useState('')
  const [code, setCode]                  = useState(['', '', '', '', '', ''])
  const [pendingMember, setPendingMember] = useState(null)
  const [loading, setLoading]            = useState(false)
  const [errorMsg, setErrorMsg]          = useState('')
  const [logoVisible, setLogoVisible]    = useState(true)
  const [lockedOut, setLockedOut]        = useState(() => lockoutRemaining() > 0)
  const navigate = useNavigate()
  const codeRef  = useRef([])

  // Lift lockout when the 10-minute window expires naturally
  useEffect(() => {
    if (!lockedOut) return
    const remaining = lockoutRemaining()
    if (remaining <= 0) { setLockedOut(false); return }
    const t = setTimeout(() => setLockedOut(false), remaining)
    return () => clearTimeout(t)
  }, [lockedOut])

  // Auto-fill code with "123456" when entering code phase (Twilio placeholder)
  useEffect(() => {
    if (phase !== 'code') return
    setCode(['1', '2', '3', '4', '5', '6'])
  }, [phase])

  // ── Phone screen handlers ──────────────────────────────────────────────────

  function handlePhoneChange(e) {
    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
    setErrorMsg('')
  }

  async function handlePhoneSubmit(e) {
    e.preventDefault()
    if (lockedOut) return

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
      recordFailedAttempt()
      if (lockoutRemaining() > 0) setLockedOut(true)
      setErrorMsg("We couldn't find your number. Ask a staff member for help.")
      return
    }

    clearAttempts()
    setPendingMember(member)
    setPhase('code')
  }

  // ── Code screen handlers ───────────────────────────────────────────────────

  function handleCodeChange(i, value) {
    const char = value.replace(/\D/g, '').slice(-1)
    const next = [...code]
    next[i] = char
    setCode(next)
    setErrorMsg('')
    if (char && i < 5) codeRef.current[i + 1]?.focus()
  }

  function handleCodeKeyDown(i, e) {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      codeRef.current[i - 1]?.focus()
    }
  }

  function handleCodePaste(e) {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!digits) return
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < digits.length; i++) next[i] = digits[i]
    setCode(next)
    codeRef.current[Math.min(digits.length, 5)]?.focus()
  }

  async function handleCodeSubmit(e) {
    e.preventDefault()
    const entered = code.join('')

    if (entered.length < 6) {
      setErrorMsg('Please enter the full 6-digit code.')
      return
    }

    // Twilio not yet connected — placeholder accepts "123456"
    if (entered !== '123456') {
      setErrorMsg('Incorrect code. Please try again.')
      return
    }

    localStorage.setItem('memberId', pendingMember.id)
    localStorage.setItem('loginAt', String(Date.now()))
    window.dispatchEvent(new Event('memberLogin'))
    navigate('/')
  }

  function backToPhone() {
    setPhase('phone')
    setCode(['', '', '', '', '', ''])
    setErrorMsg('')
  }

  // ── Lockout screen ─────────────────────────────────────────────────────────

  if (lockedOut) {
    return (
      <Wrap>
        <Logo visible={logoVisible} onError={() => setLogoVisible(false)} />
        <div
          style={{
            background: colors.tagSpecialBg,
            borderRadius: 14,
            padding: '24px 28px',
            maxWidth: 340,
            width: '100%',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: '0 0 10px 0', fontSize: fontSize.medium, fontWeight: 700, color: colors.tagSpecial }}>
            Too many attempts
          </p>
          <p style={{ margin: 0, fontSize: fontSize.body, color: colors.textMedium, lineHeight: 1.5 }}>
            Please try again in a few minutes or ask a staff member for help.
          </p>
        </div>
      </Wrap>
    )
  }

  // ── Code entry screen ──────────────────────────────────────────────────────

  if (phase === 'code') {
    return (
      <Wrap>
        <Logo visible={logoVisible} onError={() => setLogoVisible(false)} />

        <h1 style={styles.heading}>Enter your code</h1>
        <p style={{ ...styles.sub, marginBottom: 12 }}>
          We sent a 6-digit code to {displayPhone(phone)}.
        </p>

        {/* Remove this banner when Twilio is connected */}
        <div
          style={{
            background: '#EFF8F2',
            border: `1px solid ${colors.accentGreen}`,
            borderRadius: 10,
            padding: '10px 16px',
            maxWidth: 340,
            width: '100%',
            marginBottom: 24,
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: fontSize.small, color: colors.primaryGreen, fontWeight: 600 }}>
            SMS verification coming soon — code is auto-filled for now
          </p>
        </div>

        <form
          onSubmit={handleCodeSubmit}
          style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {/* Six large digit boxes */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={el => { codeRef.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleCodeChange(i, e.target.value)}
                onKeyDown={e => handleCodeKeyDown(i, e)}
                onPaste={i === 0 ? handleCodePaste : undefined}
                style={{
                  width: 46,
                  height: 60,
                  borderRadius: 10,
                  border: `2px solid ${digit ? colors.primaryGreen : colors.border}`,
                  fontSize: fontSize.xlarge,
                  fontWeight: 700,
                  color: colors.textDark,
                  background: colors.white,
                  textAlign: 'center',
                  outline: 'none',
                  flexShrink: 0,
                  transition: 'border-color 0.15s',
                }}
              />
            ))}
          </div>

          {errorMsg && <p style={styles.error}>{errorMsg}</p>}

          <button type="submit" disabled={loading} style={primaryBtn(loading)}>
            {loading ? 'Verifying…' : 'Verify Code'}
          </button>

          <button type="button" onClick={backToPhone} style={styles.ghostBtn}>
            ← Use a different number
          </button>
        </form>
      </Wrap>
    )
  }

  // ── Phone entry screen ─────────────────────────────────────────────────────

  return (
    <Wrap>
      <Logo visible={logoVisible} onError={() => setLogoVisible(false)} />

      <h1 style={styles.heading}>
        Welcome to<br />Recovery Cafe San Jose
      </h1>
      <p style={styles.sub}>Enter your phone number to sign in.</p>

      <form
        onSubmit={handlePhoneSubmit}
        style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <input
          type="tel"
          inputMode="numeric"
          placeholder="(408) 555-0000"
          value={displayPhone(phone)}
          onChange={handlePhoneChange}
          autoFocus
          style={styles.phoneInput}
        />

        {errorMsg && <p style={styles.error}>{errorMsg}</p>}

        <button type="submit" disabled={loading} style={primaryBtn(loading)}>
          {loading ? 'Looking up…' : 'Continue'}
        </button>
      </form>
    </Wrap>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

function Wrap({ children }) {
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
      {children}
    </div>
  )
}

function Logo({ visible, onError }) {
  if (visible) {
    return (
      <img
        src={LOGO_URL}
        alt="Recovery Cafe San Jose"
        onError={onError}
        style={{ width: 160, height: 'auto', objectFit: 'contain', marginBottom: 24, flexShrink: 0 }}
      />
    )
  }
  return (
    <div
      style={{
        width: 80, height: 80, borderRadius: '50%', background: colors.primaryGreen,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 28, flexShrink: 0,
      }}
    >
      <span style={{ color: colors.white, fontSize: fontSize.medium, fontWeight: 700, letterSpacing: 1 }}>RCSJ</span>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  heading: {
    fontSize: fontSize.xlarge,
    color: colors.textDark,
    fontWeight: 700,
    textAlign: 'center',
    margin: '0 0 8px 0',
    lineHeight: 1.3,
  },
  sub: {
    fontSize: fontSize.body,
    color: colors.textMedium,
    textAlign: 'center',
    margin: '0 0 32px 0',
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.body,
    margin: 0,
    textAlign: 'center',
  },
  phoneInput: {
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
  },
  ghostBtn: {
    background: 'none',
    border: 'none',
    color: colors.textMedium,
    fontSize: fontSize.body,
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
    textAlign: 'center',
  },
}

function primaryBtn(disabled) {
  return {
    height: 52,
    borderRadius: 10,
    border: 'none',
    background: disabled ? colors.accentGreen : colors.primaryGreen,
    color: colors.white,
    fontSize: fontSize.large,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    width: '100%',
    transition: 'background 0.2s',
  }
}
