# Enabling Twilio SMS Login Verification

SMS verification is **paused** until A2P/10DLC compliance is approved. The code seam
is already built and gated behind a single feature flag. This doc is the checklist to
turn it on in one sitting.

## How it works today (flag OFF — the default)

`VITE_SMS_VERIFICATION_ENABLED` is unset / not `"true"`, so:

- The login screen is just the phone field + a **Continue** button.
- No SMS consent checkbox is shown.
- Submitting a known number logs the member in immediately (pure Supabase phone
  lookup). No code screen is ever reached.
- `api/send-code.js` and `api/verify-code.js` are stubs that return HTTP 503
  `{ code: "sms_disabled" }` and never touch Twilio. The frontend never calls them
  while the flag is off.

This is byte-for-byte the member experience from before any Twilio work.

## How it works when the flag is ON

`VITE_SMS_VERIFICATION_ENABLED=true`:

1. Phone screen also shows the SMS consent checkbox (required, not pre-checked).
2. On submit: Supabase phone lookup → `POST /api/send-code { phone }`.
3. Member is taken to the 6-digit code-entry screen.
4. On submit: `POST /api/verify-code { phone, code }`.
5. `{ ok: true }` → login completes (same localStorage keys + redirect as the OFF
   path, via the shared `completeLogin` helper). Anything else counts as a failed
   attempt toward the existing 5-try / 10-minute lockout.

## What flipping it on requires

### 1. Compliance (the actual blocker)
- A2P 10DLC brand + campaign registered and **approved** with Twilio.
- A Twilio **Verify** service created (gives you a Verify Service SID).

### 2. Add the Twilio SDK
```
npm install twilio
```
(It is intentionally **not** a dependency yet.)

### 3. Implement the two stubs
Replace the 503 responses in `api/send-code.js` and `api/verify-code.js` with the
real Twilio Verify calls. The intended contract is documented inline in each file.
Use Twilio **Verify** (`client.verify.v2.services(SID).verifications` /
`.verificationChecks`) — do not roll your own code storage.

Keep these contracts the frontend already depends on:
- `send-code` → `200 { ok: true }` on success, non-2xx / `{ error }` on failure.
- `verify-code` → `200 { ok: true }` only when the code is approved; any other
  body or status is treated as a wrong code.

### 4. Set env vars (server side — never commit)
In Vercel/Netlify project settings (and local `.env` for testing):
```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
```
These are listed (commented out) in `.env.example`.

### 5. Flip the flag
Set the frontend build env var and redeploy:
```
VITE_SMS_VERIFICATION_ENABLED=true
```

### 6. Verify before release
- Known number → receives a real SMS, correct code logs in.
- Wrong code → "Incorrect code", counts toward lockout; 5 wrong → lockout screen.
- Consent box unchecked → blocks submit with the consent message.
- Then set the flag back to your intended production value.

## Files in the seam
- `src/pages/Login.jsx` — reads the flag (`SMS_ENABLED`), branches the flow,
  shares `completeLogin` between both paths.
- `api/send-code.js`, `api/verify-code.js` — stubs documenting the contract.
- `api/_dev.js` — routes `/api/send-code` and `/api/verify-code` for local dev.
- `.env.example` — flag + Twilio var names.
