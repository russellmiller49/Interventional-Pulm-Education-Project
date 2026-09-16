import { defineConfig } from '@playwright/test'

const baseURL = process.env.ECMO_LAYOUT_BASE_URL ?? 'http://127.0.0.1:3147'
export default defineConfig({
  testDir: './e2e',
  testMatch: ['ecmo-layout.spec.ts', 'ecmo-focus.spec.ts'],
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL,
    browserName: 'chromium',
    contextOptions: { reducedMotion: 'reduce' },
    screenshot: 'only-on-failure',
  },
  webServer: process.env.ECMO_LAYOUT_BASE_URL
    ? undefined
    : {
        command:
          'node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3147',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
