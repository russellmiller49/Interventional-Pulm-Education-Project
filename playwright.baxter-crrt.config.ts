import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'baxter-crrt-foundations.spec.ts',
    'baxter-crrt-self-paced.spec.ts',
    'baxter-crrt-operations.spec.ts',
    'baxter-crrt-advanced.spec.ts',
    'baxter-crrt-sanity-review.spec.ts',
    'baxter-crrt-workbench-wayfinding.spec.ts',
    'baxter-crrt-batch03-sanity.spec.ts',
    'baxter-crrt-fellow04.spec.ts',
  ],
  workers: 1,
  retries: 0,
  timeout: 180000,
  use: {
    baseURL: 'http://127.0.0.1:3113',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: '/tmp/crrt-batch-c-playwright',
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --webpack -p 3113',
    url: 'http://127.0.0.1:3113/en/baxter-crrt',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://preview.invalid',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'preview-only',
    },
  },
})
