import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'module-beta-owner.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 120000,
  use: {
    baseURL: 'http://127.0.0.1:3110',
    actionTimeout: 15000,
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  outputDir: 'artifacts/module-beta-owner-tests',
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --webpack -p 3110',
    url: 'http://127.0.0.1:3110/en/development-beta',
    timeout: 180000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_MODULE_FEEDBACK_MODE: 'owner-local',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      LOCAL_DEV_AUTH_ENABLED: '0',
      LOCAL_DEV_AUTH_TOKEN: '',
      NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3110',
    },
  },
})
