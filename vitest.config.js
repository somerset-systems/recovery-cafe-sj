import { defineConfig } from 'vitest/config'

// Minimal Vitest config for unit tests.
// E2E (Playwright) lives in tests/e2e and is run separately via `npm run test:e2e`.
export default defineConfig({
  test: {
    // Pure-function unit tests only — no DOM needed.
    environment: 'node',
    include: ['tests/unit/**/*.test.{js,jsx}'],
  },
})
