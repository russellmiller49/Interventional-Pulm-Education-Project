import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'mechanical-ventilation-learn-layout.spec.ts',
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: 'http://localhost:3110',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: {
    command: 'npm run dev:codex',
    url: 'http://localhost:3110/en/mechanical-ventilation',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
})
