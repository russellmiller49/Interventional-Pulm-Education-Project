import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  testMatch: 'socrates-study.spec.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/socrates',
  timeout: 120000,
  expect: { timeout: 20000 },
  use: {
    // The isolated Auth adapter is localhost, outside the production Supabase CSP.
    // Server authorization and both image-origin allowlists remain unchanged.
    bypassCSP: true,
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:3119',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
