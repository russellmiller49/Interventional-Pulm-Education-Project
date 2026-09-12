import { chromium, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
const base = process.env.BRONCH_REVIEW_URL ?? 'http://localhost:3110'
const out = path.resolve('artifacts/therapeutic-bronchoscopy/browser')
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  deviceScaleFactor: 1,
})
if (process.env.BRONCH_REVIEW_AUTH_ENV) {
  const env = await readFile(process.env.BRONCH_REVIEW_AUTH_ENV, 'utf8')
  const token = env
    .match(/^LOCAL_DEV_AUTH_TOKEN\s*=\s*(.*)$/m)?.[1]
    ?.trim()
    .replace(/^(['"])(.*)\1$/, '$2')
  if (!token) throw Error('Local development authentication unavailable')
  await context.addCookies([{ name: 'ip_local_dev_auth', value: token, url: base }])
}
const page = await context.newPage(),
  errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('worker', (w) => console.log('Worker:', w.url()))
await page.route('**/api/analytics', (r) => r.fulfill({ status: 204 }))

async function act(id) {
  await expect(page.getByRole('button', { name: 'Advance tool 1 mm', exact: true })).toBeEnabled({
    timeout: 60000,
  })
  await page.getByLabel('Instrument extension', { exact: true }).fill('36')
  if (id === 'cryoprobe') {
    await page.getByRole('button', { name: 'Freeze at contact', exact: true }).click()
    await expect(page.getByRole('progressbar', { name: 'Visible adhesion' })).toHaveAttribute(
      'value',
      '1',
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: 'Detach adhered tissue', exact: true }).click()
  } else {
    await page.getByRole('button', { name: 'Open loop', exact: true }).click()
    await page.getByRole('button', { name: 'Tighten loop', exact: true }).click()
    await page.getByLabel('Return electrode circuit confirmed', { exact: true }).check()
    await page.getByRole('button', { name: 'Activate snare resection', exact: true }).click()
  }
  await expect(
    page.getByRole('button', { name: 'Withdraw scope + tool en bloc', exact: true }),
  ).toBeVisible({ timeout: 30000 })
  const box = await page.getByTestId('bronchoscope-viewport').boundingBox()
  expect(box.y).toBeGreaterThan(150)
  expect(box.y + box.height).toBeLessThan(1000)
  await page.screenshot({ path: path.join(out, `learn-${id}-retained.png`), fullPage: true })
  await page.getByRole('button', { name: 'Withdraw scope + tool en bloc', exact: true }).click()
  await page.getByRole('button', { name: 'Transfer specimen', exact: true }).click()
  await page.getByRole('button', { name: 'Re-enter airway', exact: true }).click()
  await expect(page.getByTestId('specimen-count')).toHaveText('1')
}
try {
  for (const [id, answer] of [
    ['cryoprobe', 1],
    ['snare', 2],
  ]) {
    await page.goto(`${base}/en/admin/therapeutic-bronchoscopy?mode=learn&lesson=${id}`)
    await expect(page.getByRole('button', { name: 'Compare normal', exact: true })).toBeEnabled({
      timeout: 60000,
    })
    await page.getByRole('button', { name: 'Compare normal', exact: true }).click()
    await page.getByRole('button', { name: 'Return to lesion', exact: true }).click()
    await page.getByRole('button', { name: 'Continue after comparison', exact: true }).click()
    await page.getByRole('radio').nth(answer).check()
    await page.getByRole('button', { name: 'Submit prediction', exact: true }).click()
    await expect(page.locator('[data-lesson-shell]')).toHaveAttribute('data-stage', `${id}-1`)
    await page.getByRole('button', { name: 'Continue to tissue handling', exact: true }).click()
    await page.getByRole('button', { name: 'Review previous step', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Advance tool 1 mm', exact: true }),
    ).toBeDisabled()
    await page.getByRole('button', { name: 'Return to current step', exact: true }).click()
    await act(id)
    await page.getByRole('button', { name: 'Review the tissue response', exact: true }).click()
    await page.getByRole('button', { name: 'Explain the result', exact: true }).click()
    await page.getByRole('button', { name: 'Begin the transfer case', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Complete this instrument lesson', exact: true }),
    ).toBeDisabled()
    await act(id)
    await page.getByRole('button', { name: 'Complete this instrument lesson', exact: true }).click()
    await expect(
      page.getByText('1 of 3 instrument lessons completed', { exact: false }),
    ).toBeVisible()
    console.log(id, 'guided lesson and transfer passed')
  }
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto(`${base}/en/admin/therapeutic-bronchoscopy?mode=learn&lesson=snare`)
  await expect(page.getByRole('button', { name: 'Compare normal', exact: true })).toBeEnabled({
    timeout: 60000,
  })
  await page.screenshot({ path: path.join(out, 'lesson-1024.png'), fullPage: true })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)
  await writeFile(path.join(out, 'lesson-errors.json'), JSON.stringify(errors, null, 2))
  if (errors.length) throw Error(errors.join('\n'))
} finally {
  await browser.close()
}
