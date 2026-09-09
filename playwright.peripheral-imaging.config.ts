import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  testMatch: 'peripheral-imaging.spec.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/peripheral-imaging',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1050 },
    baseURL: process.env.PERIPHERAL_IMAGING_BASE_URL,
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
})
