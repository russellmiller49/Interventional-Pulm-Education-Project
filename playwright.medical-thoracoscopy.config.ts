import { defineConfig, devices } from '@playwright/test'

/**
 * The Medical Thoracoscopy prototype's checks in a real browser, and its first measurements (plan,
 * section 7; slice 14). Against a local server only, never a deployed site:
 *
 *   MT_BASE_URL=http://localhost:3134 npx playwright test -c playwright.medical-thoracoscopy.config.ts
 *
 * The measurements are written to `test-results/medical-thoracoscopy/measurements.json`; they are
 * this machine's, with the browser, viewport and renderer recorded, and are not a measurement on the
 * hardware the performance table names.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'medical-thoracoscopy.spec.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/medical-thoracoscopy/output',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    baseURL: process.env.MT_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
