import { defineConfig, devices } from '@playwright/test'

/**
 * The ICU Hemodynamics specs against this worktree's own dev server.
 *
 * `playwright.config.ts` serves 127.0.0.1:3001, which is the primary checkout's port: running the
 * hemodynamics specs from a feature worktree would either start a second server there or point the
 * run at another session's. This config keeps the same specs and browser, on this worktree's port.
 * Start the server first (`.claude/launch.json` → `claude-hemodynamics`, or
 * `npx next dev --port 3125 --webpack`); the run reuses it.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /icu-hemodynamics-.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3125',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: {
    command: 'npx next dev --port 3125 --webpack',
    url: 'http://127.0.0.1:3125/en/icu-hemodynamics',
    reuseExistingServer: true,
    timeout: 240_000,
  },
})
