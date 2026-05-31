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

    // Verify the phone exists in members table before sending anything
    const db = supabase()
    const { data: member, error: memberErr } = await db
      .from('members')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    if (memberErr) throw memberErr
    if (!member) {
      // Return same error shape as a valid number so callers can't enumerate members
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
