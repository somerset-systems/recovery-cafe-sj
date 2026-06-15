import { defineConfig, devices } from '@playwright/test'

// Port matches scripts/screenshot.mjs so local tooling is consistent.
const PORT = 5299
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  // The app runs in fake-data mode whenever VITE_SUPABASE_URL is unset (see
  // src/lib/supabase.js), which is exactly what these tests rely on.
  use: {
    baseURL: BASE_URL,
    // Members use the app on a phone; test at the documented 390px width.
    viewport: { width: 390, height: 844 },
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  ],
  // Playwright starts (and, if needed, reuses) the Vite dev server itself, so
  // `npm run test:e2e` works without a separately-running server.
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    // Force fake-data mode even when a local .env with real Supabase creds
    // exists. Vite gives actual env vars priority over .env files, so blanking
    // these keeps the suite on src/lib/fakeData.js (fake uuids like
    // "member-uuid-1" are invalid against a real Supabase and fail otherwise).
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
})
