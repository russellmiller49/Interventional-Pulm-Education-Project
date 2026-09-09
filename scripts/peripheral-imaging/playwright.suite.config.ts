import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  testMatch: 'suite-scene.spec.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '../../test-results/peripheral-imaging/suite',
  use: {
    baseURL: 'http://127.0.0.1:5117',
    viewport: { width: 1440, height: 1100 },
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
})
