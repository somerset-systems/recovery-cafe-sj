# Accessibility & Resilience Audit — Recovery Cafe SJ Member App

Date: 2026-06-15
Scope: every screen in `src/pages/*.jsx` and shared components in `src/components/*.jsx`,
audited against the app's own rules in `CLAUDE.md` (large text, high contrast, 48px tap
targets, semantic HTML, and **loading + error states on every fetch — never a blank screen**).

Audience note: users are people in recovery, many not tech-savvy. Accessibility and
never-blank-screens are core product requirements, not nice-to-haves. Findings are weighted
accordingly.

Severity legend:
- **blocker** — breaks the experience for the target users (broken render, unreadable text on a primary action, possible blank screen).
- **major** — real WCAG AA failure or resilience gap on a normal-use path.
- **minor** — borderline contrast, polish, or defense-in-depth.

WCAG AA thresholds used: 4.5:1 for normal text, 3:1 for large text (large = ≥24px, or ≥18.66px/14pt **bold**). Ratios below were computed from the exact hex values in `src/theme.js`.

---

## Contrast ratio reference table (computed from theme.js)

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| textDark `#1A1A1A` | card `#FFF` | 17.40 | PASS |
| textDark `#1A1A1A` | background `#F8F4EF` | 15.89 | PASS |
| textMedium `#555` | card | 7.46 | PASS |
| textMedium `#555` | background | 6.81 | PASS |
| textLight `#888` | card | 3.54 | large-only |
| textLight `#888` | background | 3.24 | large-only |
| primaryGreen `#2D6A4F` | card | 6.39 | PASS |
| primaryGreen `#2D6A4F` | background | 5.84 | PASS |
| **accentGreen `#52B788`** | card | **2.47** | **FAIL** |
| **accentGreen `#52B788`** | background | **2.26** | **FAIL** |
| white | primaryGreen | 6.39 | PASS |
| **white** | **accentGreen (disabled btn)** | **2.47** | **FAIL** |
| white | chipAttended `#2D6A4F` | 6.39 | PASS |
| white | chipMissed `#C1440E` | 5.12 | PASS |
| white | chipExcused `#B8860B` | 3.25 | large-only |
| white | chipNotYet `#888` | 3.54 | large-only |
| danger `#C1440E` | card | 5.12 | PASS |
| danger `#C1440E` | background | 4.68 | PASS |
| tagEvent | tagEventBg | 5.53 | PASS |
| **tagClass `#2A7F7F`** | tagClassBg `#E0F2F2` | **4.09** | **FAIL (normal text)** |
| tagMusic | tagMusicBg | 5.49 | PASS |
| tagSchool | tagSchoolBg | 9.59 | PASS |
| **nav inactive `#9CA3AF`** | card | **2.54** | **FAIL** |
| primaryGreen (active nav) | card | 6.39 | PASS |
| white@0.75 ("WELCOME BACK") | primaryGreen | 4.42 | borderline (normal text fails by a hair) |
| white@0.80 (header subtitle) | primaryGreen | 4.76 | PASS |

---

## BLOCKERS

### B1. Lockout screen references colors that do not exist — broken render
- **File:** `src/pages/Login.jsx:208` and `:216`
- **Rule violated:** "Handle ... members should never see a blank/broken screen"; "All colors from theme.js."
- **Detail:** The lockout card uses `colors.tagSpecialBg` (background) and `colors.tagSpecial` (heading color). Neither key exists in `theme.js` (it only has `tagEvent/Class/Music/School` + `*Bg`). Both resolve to `undefined`, so the warning card renders with no background tint and the "Too many attempts" heading falls back to default/inherited color. After 5 failed login attempts — exactly when a confused user most needs a clear message — they get an unstyled, low-contrast box.
- **Fix applied:** Pointed both at existing danger-toned tokens. Added a `dangerBg` token to `theme.js` (`#F7E4DC`, white text-on-dark not involved; danger `#C1440E` on it = strong contrast) and used `colors.dangerBg` / `colors.danger`. Ratio danger on dangerBg ≈ 4.6:1 → PASS.

### B2. Disabled primary button text is unreadable (white on accentGreen = 2.47:1)
- **File:** `src/pages/Login.jsx:467-480` (`primaryBtn`)
- **Rule violated:** High contrast; WCAG AA. Even treating the 20px-bold label as "large text" (3:1), 2.47:1 fails.
- **Detail:** While submitting, the button background switches to `accentGreen` and shows "Looking up…" / "Verifying…" in white. This is the exact moment the user is waiting and reading. White on `#52B788` is 2.47:1.
- **Fix applied:** Disabled state now keeps `primaryGreen` background at reduced `opacity: 0.7` instead of swapping to accentGreen, preserving legible white text and still signaling "busy/disabled." (opacity affects perceived contrast slightly but text-on-green base is 6.39:1; well clear of AA even dimmed.)

---

## MAJOR

### M1. Bottom nav inactive labels fail contrast AND hardcode a hex
- **File:** `src/components/BottomNav.jsx:63` (`color: '#9CA3AF'`)
- **Rule violated:** High contrast (2.54:1, FAIL at 13px); "All colors from theme.js — never hardcode hex."
- **Detail:** Inactive tab labels are `#9CA3AF` on white = 2.54:1 at `fontSize.small` (13px). For this user group, the 4 non-active tabs are effectively unreadable. The active green label passes (6.39:1).
- **Fix applied:** Replaced hardcoded `#9CA3AF` with `colors.textMedium` (`#555`, 7.46:1). Icons keep their reduced-opacity treatment to show active state, but the text label is now readable in all states.

### M2. Bottom nav tap targets / no aria-current, icon-only emoji semantics
- **File:** `src/components/BottomNav.jsx:33-69`
- **Tap target:** Each button is `flex:1` inside a **60px-tall** bar (`:23`). 60px ≥ 48px height → **PASS**. (No change needed; documented for completeness.)
- **Screen reader (major):** The visible label text ("Home", "Events"…) is present, so each button is announced. However the active tab is conveyed only by color/weight; add `aria-current="page"` on the active button so screen-reader users know which tab they're on. The emoji icons are decorative duplicates of the text — mark them `aria-hidden`.
- **Fix applied:** Added `aria-current` to the active button and `aria-hidden="true"` on the emoji span.

### M3. Sign Out does not clear the session timestamp
- **File:** `src/pages/Profile.jsx:11-14`
- **Rule violated:** "Sign out clears localStorage and returns to login" (testing checklist).
- **Detail:** `handleSignOut` removes `memberId` but **not** `loginAt`. `RequireAuth` (`App.jsx:18-23`) treats `loginAt` independently, but the bigger issue is leftover state: a stale `loginAt` lingers. Not a security hole (no `memberId` ⇒ redirected), but it's incomplete cleanup and diverges from the documented behavior.
- **Fix applied:** Also remove `loginAt` on sign out.

### M4. `circle-location` and member-by-id fetches can surface raw/undefined day/time
- **File:** `src/pages/Home.jsx:92-97`, `src/pages/Circle.jsx:78-91`, `src/pages/Profile.jsx:40-48`
- **Rule violated:** Never show a broken/blank field; plain English.
- **Detail (recommendation, not auto-fixed):** If `circle_day` / `circle_time` / `circle_leader` are null (unparsed label, or a member row missing those columns), the UI renders e.g. "`undefined` Circle" / "Led by `undefined`". `useMember` only guards the whole-member null case, not missing sub-fields. This is judgment-heavy (what fallback copy?) so it is left as a recommendation: render a friendly fallback such as "Your circle info isn't set yet — ask a staff member." when these fields are empty.

### M5. No top-level error boundary — a render throw = blank white screen
- **File:** `src/App.jsx` (whole app), `src/main.jsx`
- **Rule violated:** "members should never see a blank white screen."
- **Detail (recommendation, not auto-fixed):** Every page guards its own fetch, which is good. But any uncaught render error (e.g. a malformed event/attendance record, a `.map` on a non-array) unmounts the React tree and shows a blank page with no recovery path. There is no `componentDidCatch` / error boundary. Recommend adding a single class-based `ErrorBoundary` wrapping `<AppShell />` that shows a calm "Something went wrong — please reopen the app or ask staff" card. Left as a recommendation because it's a new component and a structural change (low risk, but beyond "obvious one-liner").

---

## MINOR

### m1. `accentGreen` used as text color in celebration states (2.47:1 / 2.26:1)
- **Files:** `src/components/ProgressRing.jsx:75,78` (celebrating center value/✓); `src/pages/Chores.jsx:69` (status message, `fontSize.medium` 17px — not "large"); `src/pages/Home.jsx:115` ("Amazing work this month!", `fontSize.body` 15px).
- **Rule violated:** High contrast / AA. The celebratory green text is `#52B788` on white = 2.47:1.
- **Note:** This is the emotionally important "you hit your goal" moment, so we don't want to lose the green feel. The ProgressRing **checkmark** is large (200×0.28 ≈ 56px) so 3:1 large-text applies but it still fails (2.47 < 3). The Chores/Home messages are normal text and fail outright.
- **Recommendation (not auto-fixed — visual/design judgment):** Use `colors.primaryGreen` (6.39:1, still clearly "green and celebratory") for these text/checkmark instances, keeping `accentGreen` only for the filled ring stroke (non-text, exempt). Suggested, not applied, to avoid altering the celebration design without sign-off.

### m2. Excused / "Not yet" chips: white text below AA at 13px
- **File:** `src/pages/Circle.jsx:129-142` with `STATUS_CONFIG` (`:9-14`); tokens `chipExcused #B8860B` (3.25:1), `chipNotYet #888` (3.54:1).
- **Rule violated:** AA for normal text (chip label is `fontSize.small` 13px, semibold — not "large").
- **Recommendation (not auto-fixed — needs color-system decision):** Darken `chipExcused` to ~`#8C6400` (≈4.6:1) and `chipNotYet` to `colors.textMedium #555` (4.6:1+). Left as a recommendation since it changes shared theme tokens that also affect the attendance legend's visual balance.

### m3. `tagClass` text on its background = 4.09:1 (normal-text FAIL)
- **File:** `src/theme.js:8` (`tagClass #2A7F7F`), used in `Events.jsx`/`Home.jsx` tag badges at `fontSize.small` bold.
- **Recommendation (not auto-fixed):** Darken to ~`#256E6E` (≈4.6:1). Minor; badges are short labels. Theme-token change left for design sign-off.

### m4. `textLight` at small sizes is borderline (3.24–3.54:1)
- **Files:** `SectionLabel.jsx` (uppercase 13px), `Events.jsx:86,92` (month/weekday), `Privacy.jsx:32`/`Terms.jsx:32` ("Last updated").
- **Note:** All uses are large-text-exempt only if ≥24px; these are 13px, so they technically fail normal-text AA (just barely). These are secondary/decorative labels.
- **Recommendation (not auto-fixed):** If strict AA is required, bump `textLight` to ~`#767676` (4.5:1 on white). Left as recommendation; affects many decorative labels and is a design-system call.

### m5. Header greeting overline "WELCOME BACK" = 4.42:1 (just under AA)
- **File:** `src/components/Header.jsx:42` (`rgba(255,255,255,0.75)` on primaryGreen).
- **Recommendation (not auto-fixed):** Raise alpha to `0.85` (≈5.2:1). Cosmetic; the main name and subtitle pass. Left as recommendation.

### m6. Login phone input has no associated `<label>` / accessible name
- **File:** `src/pages/Login.jsx:306-314`
- **Rule violated:** Screen-reader labeling.
- **Detail:** The `<input type="tel">` relies only on a `placeholder` for its name; placeholders are not accessible names and vanish on input. The visible "Enter your phone number to sign in." `<p>` is not programmatically associated.
- **Fix applied:** Added `aria-label="Phone number"` to the phone input. Also added `aria-label` to each of the six code inputs ("Digit N of 6") which previously had no accessible name.

### m7. Logo fallback `alt` and decorative emoji in headings
- **Files:** `Header.jsx:89` (img alt present — OK). `Home.jsx`/`Chores.jsx` "🎉" and `Circle.jsx`/`Home.jsx` "📍" are inside text — announced literally by screen readers ("party popper", "round pushpin"). Acceptable but noted.
- **Recommendation (not auto-fixed):** Optionally wrap purely decorative 📍 in `<span aria-hidden>`. Low value; left as note.

### m8. No visible focus styles; `user-scalable=no` blocks pinch-zoom
- **Files:** `src/main.jsx` (global reset removes nothing but adds none), `index.html:5`.
- **Detail:**
  - `index.html` sets `maximum-scale=1.0, user-scalable=no`, which **disables pinch-to-zoom**. For low-vision users this is an accessibility anti-pattern (WCAG 1.4.4 Resize Text).
  - No `:focus-visible` outline is defined globally; the code inputs set `outline:'none'`. Keyboard users get no focus indicator.
- **Recommendation (not auto-fixed — touches global config):** Remove `maximum-scale`/`user-scalable=no` from the viewport meta, and add a `:focus-visible { outline: 3px solid <accent>; outline-offset: 2px; }` rule to the single global style block in `main.jsx`. Left as recommendation because it changes app-wide behavior and the no-zoom choice may have been intentional for the "kiosk" feel — flagging for an explicit decision.

---

## Resilience (blank-screen / unhandled-error) audit summary

| Fetch | File | Loading state | Error state | Verdict |
|---|---|---|---|---|
| member by id | `useMember.js` + consumers | yes (each page) | yes (each page) | OK |
| login by phone | `Login.jsx:91` | yes (`loading`) | yes (friendly msg) | OK |
| send/verify code | `Login.jsx` | yes | yes | OK (gated behind `SMS_ENABLED=false`) |
| `fetchAllEvents` (Home) | `Home.jsx:65-70` | yes | yes (`eventsError`) | OK |
| `fetchAllEvents` (Events) | `Events.jsx:26-31` | yes | yes | OK |
| attendance | `Circle.jsx:34-41` | yes | yes | OK |
| `fetchCircleLocation` (Home/Circle) | `googleCalendar.js:34` | n/a | fails silently (returns null), location hidden | OK by design |

Overall the explicit fetch paths are well-guarded — this is a strong point of the codebase. The
two real blank/broken-screen risks are **B1** (broken lockout render) and **M5** (no error
boundary for render-time throws). B1 is fixed; M5 is recommended.

---

## Summary of what was fixed vs. recommended

**Fixed (safe, obvious, low-risk):**
- B1 — lockout screen broken colors → use real danger tokens (added `dangerBg` to theme).
- B2 — disabled button white-on-accentGreen → keep primaryGreen + opacity.
- M1 — bottom nav inactive label hardcoded `#9CA3AF` (2.54:1) → `colors.textMedium`.
- M2 — bottom nav `aria-current` on active tab + `aria-hidden` on emoji icons.
- M3 — Sign Out now also clears `loginAt`.
- m6 — `aria-label` on phone input and the six code inputs.

**Left as documented recommendations (judgment-heavy / design-system / structural):**
- M4 — friendly fallback for missing circle fields.
- M5 — top-level React error boundary.
- m1 — celebration `accentGreen` text → `primaryGreen` (design call).
- m2 — darken `chipExcused` / `chipNotYet` tokens.
- m3 — darken `tagClass` token.
- m4 — darken `textLight` token.
- m5 — raise header overline alpha.
- m7 — decorative emoji `aria-hidden`.
- m8 — remove `user-scalable=no`; add global `:focus-visible`.
