import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.SYSTEMIC_UX_BASE_URL
if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname))
  throw new Error('Set SYSTEMIC_UX_BASE_URL to an already running local production build.')

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'systemic-ux.spec.ts',
    'peripheral-imaging.spec.ts',
    'bronchoscopy-foundations.spec.ts',
    'baxter-crrt-foundations.spec.ts',
    'baxter-crrt-self-paced.spec.ts',
    'branch-tracing.spec.ts',
    'ecmo-layout.spec.ts',
    'ecmo-focus.spec.ts',
    'icu-hemodynamics-flow.spec.ts',
    'mcs-unloading.spec.ts',
  ],
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: 'list',
  outputDir: process.env.SYSTEMIC_UX_OUTPUT_DIR ?? 'test-results/systemic-ux',
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chromium',
    baseURL,
    viewport: { width: 1440, height: 900 },
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
