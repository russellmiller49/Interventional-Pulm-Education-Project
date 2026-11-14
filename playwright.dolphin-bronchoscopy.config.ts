import { defineConfig, devices } from '@playwright/test'

/**
 * The Dolphin Bronchoscopy smoke run against a running server:
 *   DOLPHIN_BRONCH_BASE_URL=http://localhost:3120 npx playwright test -c playwright.dolphin-bronchoscopy.config.ts
 * The module is public by direct link, so no sign-in is needed (never send a dev token to it).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'dolphin-bronchoscopy.spec.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: process.env.DOLPHIN_BRONCH_OUTPUT_DIR ?? 'test-results/dolphin-bronchoscopy',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    baseURL: process.env.DOLPHIN_BRONCH_BASE_URL,
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
})
