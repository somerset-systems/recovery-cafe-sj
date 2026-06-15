import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// End-to-end tests covering the CLAUDE.md "Testing Checklist".
//
// The app runs in fake-data mode (VITE_SUPABASE_URL unset), so all data comes
// from src/lib/fakeData.js:
//   Maria Lopez  phone 4085550001  id member-uuid-1  chores 0
//   David Kim    phone 4085550004  id member-uuid-4  chores 3 (celebration)
//
// Login is a two-phase flow (phone + SMS-consent → 6-digit code). With SMS
// disabled, the accepted code is the literal "123456" (see src/pages/Login.jsx).
// ─────────────────────────────────────────────────────────────────────────────

const VERIFY_CODE = '123456'

// Walks the real login UI: phone screen → consent → code screen → Home.
async function loginViaUi(page, phone) {
  await page.goto('/login')
  await page.getByPlaceholder('(408) 555-0000').fill(phone)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /sign me up/i }).click()

  // Code screen: fill the six digit boxes.
  const boxes = page.locator('input[inputmode="numeric"]')
  await expect(boxes).toHaveCount(6)
  for (let i = 0; i < VERIFY_CODE.length; i++) {
    await boxes.nth(i).fill(VERIFY_CODE[i])
  }
  await page.getByRole('button', { name: /verify code/i }).click()
}

// Fast path for tests that aren't about login itself: seed an authenticated
// session directly (mirrors what Login.jsx writes on success).
async function seedSession(page, memberId) {
  await page.goto('/login')
  await page.evaluate((id) => {
    localStorage.setItem('memberId', id)
    localStorage.setItem('loginAt', String(Date.now()))
  }, memberId)
}

test('login with a phone in the seed data reaches Home', async ({ page }) => {
  await loginViaUi(page, '4085550001') // Maria Lopez

  await expect(page).toHaveURL(/\/$/)
  // Home shows the member's circle day, proving Home loaded with their data.
  await expect(page.getByText('Monday Circle')).toBeVisible()
})

test('login with a number not in the seed data shows the friendly error', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('(408) 555-0000').fill('4080000000') // not in fakeData
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /sign me up/i }).click()

  await expect(
    page.getByText("We couldn't find your number. Ask a staff member for help.")
  ).toBeVisible()
  // Should NOT advance to the code screen.
  await expect(page.getByRole('button', { name: /verify code/i })).toHaveCount(0)
})

test('Home renders all three cards', async ({ page }) => {
  await seedSession(page, 'member-uuid-1') // Maria
  await page.goto('/')

  // Card 1: Your Circle — identified by the member's circle day.
  await expect(page.getByText('Monday Circle')).toBeVisible()
  // Card 2: Chores — Maria has 0 done.
  await expect(page.getByText('0 of 3 done')).toBeVisible()
  // Card 3: Coming Up (label is "Coming Up" or "Coming Up — <Day>").
  await expect(page.getByText(/Coming Up/)).toBeVisible()
})

test('all five bottom-nav tabs navigate', async ({ page }) => {
  await seedSession(page, 'member-uuid-1')
  await page.goto('/')

  // Nav button accessible names include the emoji icon (e.g. "📅Events"),
  // so match by substring via regex.
  await page.getByRole('button', { name: /Events/ }).click()
  await expect(page).toHaveURL(/\/events$/)

  await page.getByRole('button', { name: /Circle/ }).click()
  await expect(page).toHaveURL(/\/circle$/)
  await expect(page.getByText('Your Attendance History')).toBeVisible()

  await page.getByRole('button', { name: /Chores/ }).click()
  await expect(page).toHaveURL(/\/chores$/)
  await expect(page.getByText('Your Chores This Month')).toBeVisible()

  await page.getByRole('button', { name: /Profile/ }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()

  await page.getByRole('button', { name: /Home/ }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('Circle tab shows parsed day / time / leader', async ({ page }) => {
  await seedSession(page, 'member-uuid-1') // Maria — "Mon 11:30 (Delfina)"
  await page.goto('/circle')

  await expect(page.getByText('Monday Circle')).toBeVisible()
  await expect(page.getByText('11:30 AM')).toBeVisible()
  await expect(page.getByText(/Led by Delfina/)).toBeVisible()
})

test('chores celebration appears when chores_done is 3', async ({ page }) => {
  await seedSession(page, 'member-uuid-4') // David Kim — chores 3
  await page.goto('/chores')

  await expect(page.getByText('3 of 3 chores')).toBeVisible()
  await expect(page.getByText('Amazing! You hit your goal this month! 🎉')).toBeVisible()
  // Ring center shows a checkmark instead of a number in the celebration state.
  await expect(page.getByText('✓')).toBeVisible()
})

test('non-celebration chores state shows the encouraging message', async ({ page }) => {
  await seedSession(page, 'member-uuid-1') // Maria — chores 0
  await page.goto('/chores')

  await expect(page.getByText('0 of 3 chores')).toBeVisible()
  await expect(page.getByText('Sign up for chores at the front desk')).toBeVisible()
})

test('sign out clears localStorage and returns to login', async ({ page }) => {
  await seedSession(page, 'member-uuid-1')
  await page.goto('/profile')

  await page.getByRole('button', { name: /sign out/i }).click()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByPlaceholder('(408) 555-0000')).toBeVisible()
  const memberId = await page.evaluate(() => localStorage.getItem('memberId'))
  expect(memberId).toBeNull()
})

test('an unauthenticated visit to a protected route redirects to login', async ({ page }) => {
  // Guards against one member's session leaking into another's view: no session
  // means no member data is reachable.
  await page.context().clearCookies()
  await page.goto('/login')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
})
