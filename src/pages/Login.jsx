import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, normalizePhone } from '../lib/supabase.js'
import { colors, fontSize } from '../theme.js'

const LOGO_URL = 'https://recoverycafesj.org/wp-content/uploads/2024/05/rcsj_logo.png'

// Flip to "true" (via env) once Twilio compliance is approved and credentials are
// in Netlify. See TWILIO_INTEGRATION.md for the one-sitting enable checklist.
// When OFF, login uses the dev code 123456 — but ONLY in a local `vite dev` run
// (import.meta.env.DEV). In any deployed build the dev code never works, so it
// can't become a master key if this flag is ever misconfigured to off in prod.
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

// The code is entered left-to-right: focus belongs on the first empty box. If every
// box is full we keep the last one focusable so a member can still correct a digit.
function firstEmptyIndex(arr) {
  const i = arr.findIndex(c => c === '')
  return i === -1 ? arr.length - 1 : i
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
  // Timestamp of the last return to the phone screen. Used to swallow the mobile
  // "tap-through": the synthesized click after tapping "Use a different number"
  // can land on this screen's submit button and instantly re-submit.
  const returnedToPhoneAt = useRef(0)
  // True while we're programmatically advancing focus after a keystroke, so the
  // onFocus redirect below doesn't fight the auto-advance (its `code` is stale
  // mid-keystroke and would otherwise bounce focus back to the box just typed).
  const autoAdvancing = useRef(false)

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

    // Swallow the phantom submit from a "Use a different number" tap-through (the
    // synthesized click that lands here right after the code screen unmounts).
    if (Date.now() - returnedToPhoneAt.current < 700) return

    const normalized = normalizePhone(phone)
    if (normalized.length !== 10) {
      setErrorMsg('Please enter a 10-digit phone number.')
      return
    }

    if (!consent) {
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

    // Send SMS verification code (skipped while SMS_ENABLED = false)
    if (SMS_ENABLED) {
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
    }

    setLoading(false)
    clearAttempts()
    setPendingMember(member)
    setPhase('code')
  }

  // ── Code screen handlers ───────────────────────────────────────────────────

  function handleCodeChange(i, value) {
    const char = value.replace(/\D/g, '').slice(-1)
    setErrorMsg('')

    if (char) {
      // Always fill the first empty box, regardless of which box the member tapped.
      // A focus() redirect from onFocus isn't honored reliably on mobile, so we
      // enforce left-to-right fill order in the data here instead.
      const target = firstEmptyIndex(code)
      const next = [...code]
      next[target] = char
      setCode(next)
      if (target < 5) {
        // Guard the redirect: the onFocus handler still sees the pre-keystroke
        // `code` and would otherwise pull focus back to `target`.
        autoAdvancing.current = true
        codeRef.current[target + 1]?.focus()
        autoAdvancing.current = false
      }
      return
    }

    // Empty value = the member cleared the digit in the box they're editing.
    if (code[i]) {
      const next = [...code]
      next[i] = ''
      setCode(next)
    }
  }

  function handleCodeKeyDown(i, e) {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      codeRef.current[i - 1]?.focus()
    }
  }

  // Tapping ahead to a still-empty box jumps focus back to the first gap, so the
  // code always fills in order. Editing an already-filled earlier box stays allowed.
  function handleCodeFocus(i) {
    if (autoAdvancing.current) return
    const target = firstEmptyIndex(code)
    if (i > target) codeRef.current[target]?.focus()
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

    if (SMS_ENABLED) {
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
    } else if (!(import.meta.env.DEV && entered === '123456')) {
      // SMS off: accept the dev code 123456 only in a local dev server, never
      // in a deployed build (see SMS_ENABLED note above).
      setLoading(false)
      recordFailedAttempt()
      if (lockoutRemaining() > 0) { setLockedOut(true); return }
      setErrorMsg('Incorrect code. Please try again.')
      return
    }

    localStorage.setItem('memberId', pendingMember.id)
    localStorage.setItem('loginAt', String(Date.now()))
    window.dispatchEvent(new Event('memberLogin'))
    navigate('/')
  }

  function backToPhone() {
    returnedToPhoneAt.current = Date.now()
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
            background: colors.dangerBg,
            borderRadius: 14,
            padding: '24px 28px',
            maxWidth: 340,
            width: '100%',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: '0 0 10px 0', fontSize: fontSize.medium, fontWeight: 700, color: colors.danger }}>
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
                aria-label={`Digit ${i + 1} of 6`}
                maxLength={1}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus={i === 0}
                value={digit}
                onChange={e => handleCodeChange(i, e.target.value)}
                onKeyDown={e => handleCodeKeyDown(i, e)}
                onFocus={() => handleCodeFocus(i)}
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
          aria-label="Phone number"
          placeholder="(408) 555-0000"
          value={displayPhone(phone)}
          onChange={handlePhoneChange}
          autoFocus
          style={styles.phoneInput}
        />

        {/* SMS consent opt-in — required for Twilio/A2P compliance. Not pre-checked. */}
        <label style={styles.consentRow}>
          <input
            type="checkbox"
            checked={consent}
            onChange={e => { setConsent(e.target.checked); setErrorMsg('') }}
            style={styles.consentBox}
          />
          <span style={styles.consentText}>
            By checking this box, I agree to receive one-time login codes by text from
            Recovery Cafe San Jose when I sign in, and nothing else. Message and data
            rates may apply. See our{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={styles.consentLink}>
              Terms of Service
            </a>{' '}and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={styles.consentLink}>
              Privacy Policy
            </a>.
          </span>
        </label>

        {errorMsg && <p style={styles.error}>{errorMsg}</p>}

        <button type="submit" disabled={loading} style={primaryBtn(loading)}>
          {loading ? 'Sending…' : 'Send my code'}
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
    // Keep the green background when disabled so white text stays legible (white on
    // accentGreen is only 2.47:1 and fails WCAG AA). Dim with opacity to signal "busy".
    background: colors.primaryGreen,
    opacity: disabled ? 0.7 : 1,
    color: colors.white,
    fontSize: fontSize.large,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    width: '100%',
    transition: 'opacity 0.2s',
  }
}
