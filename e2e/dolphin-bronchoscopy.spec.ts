import { resolve } from 'node:path'

import { expect, test } from '@playwright/test'

const AXE_SCRIPT_PATH = resolve(process.cwd(), 'node_modules/axe-core/axe.min.js')

/**
 * Dolphin Bronchoscopy smoke: public by direct link, the scope drives in a section, drills keep
 * their labels off, the integrated-case debrief waits for the last frame, and the device stores
 * places only.
 */
test.describe.configure({ mode: 'serial' })

test('the hub answers without an account and stays out of the index', async ({ request }) => {
  const response = await request.get('/en/dolphin-bronchoscopy', { maxRedirects: 0 })
  expect(response.status()).toBe(200)
  expect(response.headers()['x-robots-tag']).toContain('noindex')
})

test('a scope section opens on its first step and the tip drives down the nasal passage', async ({
  page,
}) => {
  test.setTimeout(150000)
  await page.goto('/en/dolphin-bronchoscopy/learn?section=from-blowhole-to-spout')
  await expect(page.locator('[data-now-card] h2').first()).toHaveText('Read the question')
  const scope = page.locator('[data-airway-location]')
  await expect(scope).not.toHaveAttribute('data-airway-location', '--', { timeout: 60000 })
  await expect(scope).toHaveAttribute('data-airway-location', 'LNP')
  // "4 / 111 mm into branch": the panel's depth readout.
  const depth = page.getByText(/\d+ \/ \d+ mm into branch/)
  const millimetres = async () =>
    Number(/(\d+) \//.exec((await depth.textContent()) ?? '')?.[1] ?? 0)
  const before = await millimetres()
  await scope.focus()
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Shift+W')
    await page.waitForTimeout(100)
  }
  await expect.poll(millimetres, { timeout: 20000 }).toBeGreaterThan(before + 30)
})

test('the branch drill keeps every label and the location off the view', async ({ page }) => {
  test.setTimeout(150000)
  await page.goto('/en/dolphin-bronchoscopy/practice?branches=near-branches')
  const view = page.locator('[data-airway-optical-view]')
  await expect(view).toBeVisible({ timeout: 60000 })
  await page.waitForTimeout(2000)
  await expect(view).not.toContainText(/\b[RL]B\d+\b/)
  await expect(view).not.toContainText(/main bronchus/i)
})

test('an integrated case holds its debrief until the last frame', async ({ page }) => {
  await page.goto('/en/dolphin-bronchoscopy/assess')
  await page.locator('[data-kind="integrated-case"]').first().click()
  const article = page.locator('[data-integrated-case]')
  await expect(article).toBeVisible()
  while (!(await page.locator('[data-debrief]').count())) {
    await expect(page.locator('[data-debrief]')).toHaveCount(0)
    await page.locator('[data-integrated-case] input[type="radio"]').first().check()
    const next = page.locator('[data-next-frame]')
    if (await next.count()) await next.click()
    else await page.locator('[data-open-debrief]').click()
  }
  await expect(page.locator('[data-replay-strip]')).toBeVisible()
})

test('the device keeps places, never answers', async ({ page }) => {
  await page.goto('/en/dolphin-bronchoscopy/learn?section=why-scope-a-dolphin')
  await page.locator('[data-now-card] [data-now-primary]').first().click()
  await page.locator('[data-now-card] input[type="radio"]').first().check()
  await page.getByRole('button', { name: 'Check my answer' }).click()
  const stored = await page.evaluate(() =>
    window.localStorage.getItem('ip-dolphin-bronchoscopy-self-paced-v1'),
  )
  expect(stored).toContain('why-scope-a-dolphin')
  expect(stored).not.toMatch(/choice|correct|attempt|answer|arrived/i)
})

test('the hub, Learn landing and Practice landing have no serious accessibility violations', async ({
  page,
}) => {
  for (const path of [
    '/en/dolphin-bronchoscopy',
    '/en/dolphin-bronchoscopy/learn',
    '/en/dolphin-bronchoscopy/practice',
  ]) {
    await page.goto(path)
    await page.addScriptTag({ path: AXE_SCRIPT_PATH })
    const serious = await page.evaluate(async () => {
      const axe = (
        window as typeof window & {
          axe: {
            run: (
              context: unknown,
            ) => Promise<{ violations: { id: string; impact: string; help: string }[] }>
          }
        }
      ).axe
      const results = await axe.run({ include: ['main'] })
      return results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id}: ${v.help}`)
    })
    expect(serious).toEqual([])
  }
})
