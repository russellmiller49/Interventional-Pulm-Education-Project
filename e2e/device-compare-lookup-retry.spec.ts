import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

test.use({ channel: 'chromium' })

test.beforeEach(async ({ context }) => {
  if (process.env.DEVICE_E2E_TOKEN_FILE) {
    const token = readFileSync(process.env.DEVICE_E2E_TOKEN_FILE, 'utf8').trim()
    await context.request
      .get(`/api/local-dev-auth?token=${encodeURIComponent(token)}&next=/en/devices`, {
        timeout: 30_000,
      })
      .catch((error: unknown) => {
        throw new Error(String(error).replaceAll(token, '[LOCAL_DEV_TOKEN_REDACTED]'))
      })
  }
})

for (const condition of [
  { locale: 'en', width: 1440, height: 900, rootText: 100 },
  { locale: 'en', width: 390, height: 844, rootText: 100 },
  { locale: 'en', width: 390, height: 844, rootText: 200 },
  { locale: 'es', width: 390, height: 844, rootText: 100 },
  { locale: 'zh-CN', width: 390, height: 844, rootText: 100 },
]) {
  test(`lookup failure and keyboard retry at ${condition.locale}/${condition.width}/${condition.rootText}% root text`, async ({
    page,
  }) => {
    const labels = JSON.parse(
      readFileSync(join(__dirname, '..', 'messages', `${condition.locale}.json`), 'utf8'),
    ).deviceIntelligence.compareSelection
    let fail = true
    let attempts = 0
    await page.route('**/api/device-intelligence/saved?**', async (route) => {
      attempts += 1
      if (fail) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"error":"Test lookup failure"}',
        })
      } else await route.continue()
    })
    await page.setViewportSize(condition)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/${condition.locale}/devices?view=models`)
    if (condition.rootText === 200) {
      await page.evaluate(() => (document.documentElement.style.fontSize = '200%'))
    }
    const add = page.getByRole('button', { name: new RegExp(`^${labels.add}:`) })
    await add.first().click()
    await add.first().click()
    const tray = page.locator('[data-compare-tray]')
    await expect(tray.getByRole('alert')).toHaveText(labels.trayLookupFailed + labels.trayRetry)
    const selection = await page.evaluate(() =>
      localStorage.getItem('device-intelligence.compare-selection.v1'),
    )
    expect(JSON.parse(selection!).productIds).toHaveLength(2)
    expect(
      await page.evaluate(() => localStorage.getItem('device-intelligence.saved-devices.v1')),
    ).toBeNull()
    const retry = tray.getByRole('button', { name: labels.trayRetry, exact: true })
    await expect(retry).toBeInViewport()
    const geometry = await tray.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      spacer: document.querySelector('[data-compare-tray-spacer]')!.getBoundingClientRect().height,
      overflow: element.scrollWidth > element.clientWidth + 1,
    }))
    expect(geometry.overflow).toBe(false)
    expect(geometry.spacer).toBeGreaterThanOrEqual(geometry.height)
    // At enlarged text the tray may scroll. Its existing comparison link and retry both remain
    // reachable by keyboard without changing the device selection.
    await tray.getByRole('link', { name: `${labels.trayCompare} (2)`, exact: true }).focus()
    await expect(
      tray.getByRole('link', { name: `${labels.trayCompare} (2)`, exact: true }),
    ).toBeInViewport()
    await retry.focus()
    await expect(retry).toBeInViewport()
    await test.info().attach('failed-lookup-geometry', {
      body: JSON.stringify(geometry, null, 2),
      contentType: 'application/json',
    })
    await page.screenshot({ path: test.info().outputPath('lookup-failed.png') })
    fail = false
    const beforeRetry = attempts
    const response = page.waitForResponse(
      (response) =>
        response.url().includes('/api/device-intelligence/saved?') && response.status() === 200,
    )
    await retry.focus()
    await page.keyboard.press('Enter')
    expect((await response).ok()).toBe(true)
    await expect(tray.getByRole('alert')).toHaveCount(0)
    await expect.poll(() => attempts).toBeGreaterThan(beforeRetry)
    if (condition.width > 640) {
      await expect(tray.locator('li')).toHaveCount(2)
      await expect(tray.locator('li').first()).not.toContainText(/PRD-/)
    }
    expect(
      await page.evaluate(() => localStorage.getItem('device-intelligence.compare-selection.v1')),
    ).toBe(selection)
    expect(
      await page.evaluate(() => localStorage.getItem('device-intelligence.saved-devices.v1')),
    ).toBeNull()
    await page.screenshot({ path: test.info().outputPath('lookup-recovered.png') })
  })
}
