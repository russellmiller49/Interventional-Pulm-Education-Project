import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'bronchoscopy-foundations.spec.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/bronchoscopy-foundations',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    contextOptions: { reducedMotion: 'reduce' },
    baseURL: process.env.BRONCH_FOUNDATIONS_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
