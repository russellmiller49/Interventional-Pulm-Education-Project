import { defineConfig, devices } from '@playwright/test'

/**
 * The mechanical ventilation Learn specs against this worktree's own dev server.
 *
 * Mirrors `playwright.icu-hemodynamics.config.ts`: the default config serves the primary
 * checkout's port, so a feature worktree runs these specs on its own. Start the server first
 * (`.claude/launch.json` → `claude-mv`, or `npx next dev --port 3123 --webpack`); the run reuses
 * it. `MV_E2E_BASE_URL` points the run at another server already serving this tree.
 */
const baseURL = process.env.MV_E2E_BASE_URL ?? 'http://127.0.0.1:3123'

export default defineConfig({
  testDir: './e2e',
  testMatch: /mechanical-ventilation-.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
  ],
  webServer: process.env.MV_E2E_BASE_URL
    ? undefined
    : {
        command: 'npx next dev --port 3123 --webpack',
        url: `${baseURL}/en/mechanical-ventilation`,
        reuseExistingServer: true,
        timeout: 240_000,
      },
})
