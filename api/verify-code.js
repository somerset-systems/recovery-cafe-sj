// api/verify-code.js — Vercel serverless function  [STUB — NOT YET ACTIVE]
//
// POST /api/verify-code   body: { phone: "4085550000", code: "123456" }
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS IS A STUB. It makes NO Twilio calls and verifies NOTHING.
// Twilio SMS verification is paused until A2P/10DLC compliance is approved.
// While the frontend flag VITE_SMS_VERIFICATION_ENABLED is false (the default),
// the app never calls this endpoint. It exists only so the seam is ready.
//
// INTENDED CONTRACT (once implemented — see TWILIO_INTEGRATION.md):
//   - Validate `phone` is 10 digits and `code` is 6 digits.
//   - Ask Twilio Verify to check the code:
//       const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
//       const check = await client.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)
//         .verificationChecks.create({ to: `+1${phone}`, code })
//   - If check.status === 'approved' respond 200 { ok: true }.
//   - Otherwise respond 200 { ok: false } (frontend shows "Incorrect code").
//     NOTE the frontend treats any non-{ok:true} body, or a non-2xx status, as a
//     failed attempt and counts it toward lockout — keep that contract.
//   - The frontend completes login itself after { ok: true }; it already knows the
//     member from the phone-lookup step, so this endpoint only judges the code.
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

  // Feature is paused. Always report "not enabled" — never approve a login.
  res.writeHead(503)
  res.end(JSON.stringify({
    ok: false,
    error: 'SMS verification is not enabled yet.',
    code: 'sms_disabled',
  }))
}
