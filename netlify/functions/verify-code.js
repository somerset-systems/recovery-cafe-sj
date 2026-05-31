// netlify/functions/verify-code.js
// POST /api/verify-code  { phone: "4085550001", code: "123456" }
// Returns { ok: true } on match, { ok: false, error: "..." } on failure.

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
    const body  = JSON.parse(event.body || '{}')
    const phone = (body.phone || '').replace(/\D/g, '')
    const code  = (body.code  || '').replace(/\D/g, '')

    if (phone.length !== 10 || code.length !== 6) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid phone or code' }) }
    }

    const db  = supabase()
    const now = new Date().toISOString()

    const { data, error } = await db
      .from('verification_codes')
      .select('id')
      .eq('phone', phone)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', now)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      console.log(`[verify-code] invalid/expired attempt for ...${phone.slice(-4)}`)
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({ ok: false, error: 'Invalid or expired code.' }),
      }
    }

    // Mark used so the code can't be replayed
    await db
      .from('verification_codes')
      .update({ used: true })
      .eq('id', data.id)

    console.log(`[verify-code] verified ...${phone.slice(-4)}`)
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) }

  } catch (err) {
    console.error('[verify-code] error:', err.message)
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) }
  }
}
