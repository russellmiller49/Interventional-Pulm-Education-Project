import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'branch-tracing.spec.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/branch-tracing',
  timeout: 60000,
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    baseURL: process.env.BRANCH_TRACING_BASE_URL ?? 'http://localhost:3110',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
