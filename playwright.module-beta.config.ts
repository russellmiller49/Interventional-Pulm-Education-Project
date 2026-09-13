import { randomUUID } from 'node:crypto'
import { defineConfig, devices } from '@playwright/test'

// Ephemeral, localhost-only preview credentials; no shared environment files are read.
const token = process.env.MODULE_BETA_TEST_TOKEN || randomUUID()
process.env.MODULE_BETA_TEST_TOKEN = token
export default defineConfig({
  testDir: './e2e',
  testMatch: 'module-beta.spec.ts',
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:3110',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  outputDir: 'artifacts/module-beta-tests',
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --webpack -p 3110',
    url: 'http://127.0.0.1:3110/en/login',
    timeout: 180000,
    reuseExistingServer: false,
    env: {
      LOCAL_DEV_AUTH_ENABLED: '1',
      LOCAL_DEV_AUTH_TOKEN: token,
      NEXT_PUBLIC_SUPABASE_URL: 'https://preview.invalid',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'preview-only',
      NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3110',
    },
  },
})
