import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, normalizePhone } from '../lib/supabase.js'
import { colors, fontSize } from '../theme.js'

const LOGO_URL = 'https://recoverycafesj.org/wp-content/uploads/2024/05/rcsj_logo.png'

// ── SMS verification feature flag ───────────────────────────────────────────────
// Twilio SMS verification is intentionally PAUSED until A2P/10DLC compliance is
// approved. This flag is the single seam that turns it on. See TWILIO_INTEGRATION.md.
//
//   OFF (default): pure phone-number lookup. No consent box, no code screen.
//                  Submitting a known number logs the member straight in. This is
//                  exactly the behavior members see today; it must not change until
//                  the flag is deliberately flipped.
//   ON:            phone lookup → consent → /api/send-code → 6-digit code screen →
//                  /api/verify-code → login.
//
// Enable by setting VITE_SMS_VERIFICATION_ENABLED=true in the environment. Anything
// other than the exact string "true" (including unset) keeps it OFF.
const SMS_ENABLED = import.meta.env.VITE_SMS_VERIFICATION_ENABLED === 'true'

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
  const [consent, setConsent]            = useState(false) // SMS opt-in; must NOT be pre-checked
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

    // SMS consent is only required on the verification path. With the flag OFF the
    // app never sends a text, so there is nothing to consent to.
    if (SMS_ENABLED && !consent) {
      setErrorMsg('Please check the box to agree to receive text messages.')
      return
    }

    setLoading(true)
    setErrorMsg('')
    const { data: member, error } = await db.getMemberByPhone(normalized)

    if (error || !member) {
      setLoading(false)
      recordFailedAttempt()
      if (lockoutRemaining() > 0) setLockedOut(true)
      setErrorMsg("We couldn't find your number. Ask a staff member for help.")
      return
    }

    // ── Flag OFF: pure phone lookup. Log in immediately, no code screen. ────────
    if (!SMS_ENABLED) {
      setLoading(false)
      clearAttempts()
      completeLogin(member)
      return
    }

    // ── Flag ON: send the SMS code, then advance to the code-entry screen. ──────
    try {
      const res  = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Send failed')
    } catch (sendErr) {
      setLoading(false)
      setErrorMsg('Could not send verification code. Please try again.')
      return
    }

    setLoading(false)
    clearAttempts()
    setPendingMember(member)
    setPhase('code')
  }

  // Shared login finalizer — used by both the direct (flag OFF) and verified
  // (flag ON) paths so the localStorage keys and redirect stay identical.
  function completeLogin(member) {
    localStorage.setItem('memberId', member.id)
    localStorage.setItem('loginAt', String(Date.now()))
    window.dispatchEvent(new Event('memberLogin'))
    navigate('/')
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

    setLoading(true)
    setErrorMsg('')

    // The code screen is only reachable when SMS_ENABLED is true, so verification
    // always goes through the real endpoint. (No dev bypass code.)
    try {
      const normalized = normalizePhone(phone)
      const res  = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized, code: entered }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Verification failed')
    } catch {
      setLoading(false)
      recordFailedAttempt()
      if (lockoutRemaining() > 0) { setLockedOut(true); return }
      setErrorMsg('Incorrect code. Please try again.')
      return
    }

    completeLogin(pendingMember)
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
        <p style={{ ...styles.sub, marginBottom: 32 }}>
          Enter your 6-digit code for {displayPhone(phone)}.
        </p>

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
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
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

        {/* SMS consent opt-in — required for Twilio/A2P compliance. Not pre-checked.
            Only shown on the verification path; hidden entirely while the flag is OFF
            so the OFF login screen is just the phone field + button (today's UI). */}
        {SMS_ENABLED && (
          <label style={styles.consentRow}>
            <input
              type="checkbox"
              checked={consent}
              onChange={e => { setConsent(e.target.checked); setErrorMsg('') }}
              style={styles.consentBox}
            />
            <span style={styles.consentText}>
              By checking this box, I agree to receive text messages from Recovery Cafe
              San Jose — mainly one-time login codes and occasional account messages.
              Message frequency varies. Message and data rates may apply. Reply HELP for
              help or STOP to unsubscribe at any time. See our{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={styles.consentLink}>
                Terms of Service
              </a>{' '}and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={styles.consentLink}>
                Privacy Policy
              </a>.
            </span>
          </label>
        )}

        {errorMsg && <p style={styles.error}>{errorMsg}</p>}

        <button type="submit" disabled={loading} style={primaryBtn(loading)}>
          {loading ? 'Looking up…' : (SMS_ENABLED ? 'Yes, sign me up!' : 'Continue')}
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
  consentRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    cursor: 'pointer',
    textAlign: 'left',
  },
  consentBox: {
    width: 26,
    height: 26,
    marginTop: 2,
    flexShrink: 0,
    accentColor: colors.primaryGreen,
    cursor: 'pointer',
  },
  consentText: {
    fontSize: fontSize.small,
    color: colors.textMedium,
    lineHeight: 1.5,
  },
  consentLink: {
    color: colors.primaryGreen,
    fontWeight: 600,
    textDecoration: 'underline',
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
