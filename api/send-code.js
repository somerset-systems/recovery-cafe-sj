// api/send-code.js — Vercel serverless function  [STUB — NOT YET ACTIVE]
//
// POST /api/send-code   body: { phone: "4085550000" }  (10 digits, no formatting)
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS IS A STUB. It makes NO Twilio calls and sends NO SMS.
// Twilio SMS verification is paused until A2P/10DLC compliance is approved.
// While the frontend flag VITE_SMS_VERIFICATION_ENABLED is false (the default),
// the app never calls this endpoint. It exists only so the seam is ready.
//
// INTENDED CONTRACT (once implemented — see TWILIO_INTEGRATION.md):
//   - Validate `phone` is 10 digits.
//   - Confirm a member with that phone exists (reuse the Supabase service-role
//     lookup; do not leak whether a number exists to unauthenticated callers —
//     return the same shape either way).
//   - Ask Twilio Verify to send a code:
//       const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
//       await client.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
//         .verifications.create({ to: `+1${phone}`, channel: 'sms' })
//   - On success respond 200 { ok: true }.
//   - On failure respond 502 { error: "..." } (frontend shows a friendly retry).
//   - Rate-limit per phone/IP to prevent SMS-pumping abuse.
//
// Required env vars (set in Vercel/Netlify, NOT committed — see .env.example):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.writeHead(405)
    res.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }))
    return
  }

  // Feature is paused. Always report "not enabled" — never touch Twilio.
  res.writeHead(503)
  res.end(JSON.stringify({
    error: 'SMS verification is not enabled yet.',
    code: 'sms_disabled',
  }))
}
