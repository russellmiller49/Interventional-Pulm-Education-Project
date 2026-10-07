import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.ACCOUNT_STORAGE_PORT ?? 3158)

export default defineConfig({
  testDir: './e2e',
  testMatch: /account-storage-refused\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node node_modules/next/dist/bin/next dev --webpack -p ${port}`,
    url: `http://127.0.0.1:${port}/en/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key-placeholder',
    },
  },
})
