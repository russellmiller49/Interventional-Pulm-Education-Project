import { defineConfig, devices } from '@playwright/test'

/**
 * The site with the browser's storage refused (`e2e/site-storage-refused.spec.ts`). Its own dev
 * server on its own port, so it never meets another checkout's. Only routes that open without an
 * account are visited; authentication is not changed for the test.
 */
const port = Number(process.env.SITE_STORAGE_PORT ?? 3141)

export default defineConfig({
  testDir: './e2e',
  testMatch: /site-storage-refused\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    command: `node scripts/dev-with-training-apps.mjs --port ${port}`,
    url: `http://127.0.0.1:${port}/en/login`,
    reuseExistingServer: true,
    timeout: 600_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key-placeholder',
    },
  },
})
