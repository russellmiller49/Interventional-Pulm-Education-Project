import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Use the full Chromium headless browser, also used for actual tab-zoom verification.
test.use({ channel: 'chromium' })
// Replaces the retired seven-station, three-resizable-pane UI. Clinical progression is
// exercised in icu-hemodynamics-flow; this suite checks its active layout contract.
test.beforeEach(async ({ context }) => {
  if (process.env.ICU_E2E_TOKEN_FILE) {
    const token = readFileSync(process.env.ICU_E2E_TOKEN_FILE, 'utf8').trim()
    await context.request
      .get(`/api/local-dev-auth?token=${encodeURIComponent(token)}&next=/en/icu-hemodynamics`, {
        timeout: 30_000,
      })
      .catch((error: unknown) => {
        throw new Error(String(error).replaceAll(token, '[LOCAL_DEV_TOKEN_REDACTED]'))
      })
  }
})
test('pairs anatomy and pressure and preserves the patient across resizing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/en/icu-hemodynamics/learn?activity=catheter-advancement')
  const flow = page.locator('[data-lesson-shell][data-stage]')
  await expect(flow).toHaveAttribute('data-presentation', 'catheter-procedure')
  const trace = page.locator('[data-focused-monitor="pac"]')
  const heart = page.locator('[data-surface="heart-3d"]')
  await expect(trace).toBeVisible()
  await expect(heart).toBeVisible()
  const t = (await trace.boundingBox())!
  const h = (await heart.boundingBox())!
  expect(Math.abs(t.y - h.y)).toBeLessThan(2)
  expect(h.x).toBeGreaterThan(t.x + t.width - 1)
  const taskId = await flow.getAttribute('data-stage')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(flow).toHaveAttribute('data-stage', taskId!)
  await expect(page.getByRole('tablist', { name: 'Workspace panel views' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
  await page.screenshot({
    path: test.info().outputPath('paired-procedure-compact.png'),
    fullPage: true,
  })
})
test('pathway drawer opens the acquisition introduction without a device wall', async ({
  page,
}) => {
  await page.goto('/en/icu-hemodynamics/learn?activity=catheter-advancement')
  await page.getByText('Sections', { exact: true }).click()
  await page.getByRole('button', { name: /How much is flowing/ }).click()
  await expect(page).toHaveURL(/activity=thermodilution-series/, { timeout: 30000 })
  await expect(page.getByRole('heading', { name: 'What thermodilution acquires' })).toBeVisible()
  await expect(page.locator('[data-dock="thermodilution"]')).toHaveCount(0)
})
