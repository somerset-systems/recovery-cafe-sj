# Twilio SMS Login — Go-Live Checklist

The full SMS login flow is **implemented and live** in the Netlify functions. It is
gated behind one feature flag. This doc is the checklist to turn it on safely.

## How it actually works (the real, deployed path)

Deployment is **Netlify** (`netlify.toml`). The browser calls `/api/send-code` and
`/api/verify-code`, which `netlify.toml` redirects to the functions in
`netlify/functions/`. Those functions:

1. `send-code.js` — confirms the phone exists in `members`, generates a 6-digit code,
   stores it in the Supabase `verification_codes` table (10-min expiry), and texts it
   via the **Twilio Messages API** from `TWILIO_PHONE_NUMBER`. A 60-second per-number
   resend throttle keeps double-taps and rushes from sending duplicate texts.
2. `verify-code.js` — checks the code against the table, marks it used (no replay),
   returns `{ ok: true }` on success.

> Note: the `api/` folder + `vercel.json` are an **unused legacy Vercel path** (stubs
> that return 503). They are not part of the Netlify deployment. Ignore them; do not
> wire credentials into them.

When the flag is **OFF**, the login screen still asks for the consent checkbox and a
code, but accepts the dev code `123456` (no SMS sent). When **ON**, a real SMS is sent
and only the texted code works.

## Flag: `VITE_SMS_VERIFICATION_ENABLED`

Only the exact string `"true"` turns it on. It is a **build-time** Vite var, so it must
be set in the Netlify build environment and the site must be **rebuilt/redeployed** for
a change to take effect (changing it in the Netlify UI alone does nothing until redeploy).

## Go-live checklist

### 1. Supabase — create the codes table (once)
In the Supabase SQL editor, run `supabase/verification_codes.sql`. It creates the
`verification_codes` table with RLS on (only the service-role key can read/write it).

### 2. Netlify — set environment variables
Site → **Site configuration → Environment variables**. Add:

| Variable | Value |
|---|---|
| `VITE_SMS_VERIFICATION_ENABLED` | `true` |
| `TWILIO_ACCOUNT_SID` | from Twilio console |
| `TWILIO_AUTH_TOKEN` | from Twilio console |
| `TWILIO_PHONE_NUMBER` | the approved number, E.164, e.g. `+18055494434` |
| `VITE_SUPABASE_URL` | same as `.env` |
| `VITE_SUPABASE_ANON_KEY` | same as `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (server-only) |

### 3. Twilio — confirm the number is messaging-ready
- The number is purchased and **SMS-enabled**.
- It is attached to an **approved A2P 10DLC campaign** (you said this is approved ✅).
- Messaging Service / number can send to US mobiles.

### 4. Redeploy
Trigger a Netlify deploy so the new build picks up `VITE_SMS_VERIFICATION_ENABLED=true`.

### 5. Smoke test on the live URL
- Known member number + consent checked → receives a real SMS, correct code logs in.
- Wrong code → "Incorrect code", counts toward the 5-try / 10-minute lockout.
- Consent box unchecked → submit is blocked.
- Unknown number → friendly "couldn't find your number" (and never sends an SMS).

## Files in the seam
- `src/pages/Login.jsx` — reads `VITE_SMS_VERIFICATION_ENABLED`, runs phone → code → verify.
- `netlify/functions/send-code.js` / `verify-code.js` — the live Twilio + Supabase logic.
- `netlify.toml` — redirects `/api/*` to the functions.
- `supabase/verification_codes.sql` — the table the codes live in.
- `.env` / `.env.example` — local config + the variable list to mirror into Netlify.
