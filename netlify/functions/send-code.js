// netlify/functions/send-code.js
// POST /api/send-code  { phone: "4085550001" }
// Generates a 6-digit code, stores it in Supabase, sends it via Twilio SMS.

const { createClient } = require('@supabase/supabase-js')

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

function supabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const phone = (body.phone || '').replace(/\D/g, '')

    if (phone.length !== 10) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid phone number' }) }
    }

    // Verify the phone belongs to someone we know before sending anything.
    // Two sources: real members, and staff (who log in to the preview mode and are
    // deliberately absent from the members table — see supabase/staff_access.sql).
    const db = supabase()
    const { data: member, error: memberErr } = await db
      .from('members')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    if (memberErr) throw memberErr

    let recognized = !!member
    if (!recognized) {
      const { data: staff, error: staffErr } = await db
        .from('staff')
        .select('id')
        .eq('phone', phone)
        .maybeSingle()
      // A missing staff table (migration not run yet) must not break member logins.
      if (staffErr && staffErr.code !== '42P01') throw staffErr
      recognized = !!staff
    }

    if (!recognized) {
      // Return same error shape as a valid number so callers can't enumerate members
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) }
    }

    // Resend throttle. If a still-valid code was issued to this number very recently,
    // don't generate a new one or send a second SMS — just report success. This makes
    // double-taps and rapid retries cheap (one SMS, not many) and caps how fast any
    // single real member's number can run up Twilio charges during a busy sign-up rush.
    const RESEND_COOLDOWN_MS = 60 * 1000
    const cutoff = new Date(Date.now() - RESEND_COOLDOWN_MS).toISOString()
    const { data: recent } = await db
      .from('verification_codes')
      .select('id')
      .eq('phone', phone)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .gt('created_at', cutoff)
      .limit(1)
      .maybeSingle()

    if (recent) {
      console.log(`[send-code] throttled resend for ...${phone.slice(-4)} (code still valid)`)
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) }
    }

    // Generate code and expiry
    const code      = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Delete any existing unused codes for this phone first
    await db
      .from('verification_codes')
      .delete()
      .eq('phone', phone)
      .eq('used', false)

    // Store new code
    const { error: insertErr } = await db
      .from('verification_codes')
      .insert({ phone, code, expires_at: expiresAt, used: false })

    if (insertErr) throw insertErr

    // Send SMS via Twilio REST API
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken  = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)')
    }

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const twilioRes   = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To:   `+1${phone}`,
          From: fromNumber,
          Body: `Your Recovery Cafe SJ sign-in code is: ${code}. Expires in 10 minutes.`,
        }).toString(),
      }
    )

    if (!twilioRes.ok) {
      const errBody = await twilioRes.json().catch(() => ({}))
      throw new Error(`Twilio error ${twilioRes.status}: ${errBody.message || 'unknown'}`)
    }

    console.log(`[send-code] sent to ...${phone.slice(-4)}`)
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) }

  } catch (err) {
    console.error('[send-code] error:', err.message)
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) }
  }
}
