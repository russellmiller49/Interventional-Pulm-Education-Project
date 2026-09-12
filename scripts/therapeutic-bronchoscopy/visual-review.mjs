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
try {
  await page.goto(`${base}/en/admin/therapeutic-bronchoscopy?mode=practice`, { timeout: 120000 })
  await expect(page.getByRole('button', { name: 'Advance tool 1 mm', exact: true })).toBeEnabled({
    timeout: 120000,
  })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(out, 'workbench-initial.png'), fullPage: true })
  console.log('Workbench ready', await page.getByTestId('residual-tissue').innerText())
  await page.getByLabel('Instrument extension', { exact: true }).fill('36')
  await page.getByRole('button', { name: 'Open jaws', exact: true }).click()
  console.log('Contact', await page.getByRole('status').allTextContents())
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(out, 'forceps-contact.png'), fullPage: true })
  await page.getByRole('button', { name: 'Close jaws / biopsy', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Advance tool 1 mm', exact: true })).toBeEnabled({
    timeout: 30000,
  })
  console.log(
    'After bite',
    await page.getByTestId('residual-tissue').innerText(),
    await page.getByRole('status').allTextContents(),
  )
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(out, 'forceps-bite.png'), fullPage: true })
  await page.getByRole('button', { name: 'Retrieve instrument', exact: true }).click()
  console.log('Specimens', await page.getByTestId('specimen-count').innerText())
  await expect(page.getByTestId('specimen-count')).toHaveText('1')
  await page.getByRole('button', { name: 'Apply suction', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Release suction', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reset procedure', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cryoprobe', exact: true })).toBeEnabled({
    timeout: 30000,
  })
  await page.getByRole('button', { name: 'Cryoprobe', exact: true }).click()
  await page.getByRole('button', { name: 'Approach target', exact: true }).click()
  await page.getByLabel('Instrument extension', { exact: true }).fill('36')
  await page.getByRole('button', { name: 'Freeze at contact', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: 'Visible adhesion' })).toHaveAttribute(
    'value',
    '1',
    { timeout: 20000 },
  )
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(out, 'cryoadhesion.png'), fullPage: true })
  await page.getByRole('button', { name: 'Detach adhered tissue', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Withdraw scope + tool en bloc', exact: true }),
  ).toBeVisible({ timeout: 30000 })
  console.log('Cryo residual', await page.getByTestId('residual-tissue').innerText())
  await page.getByRole('button', { name: 'Withdraw scope + tool en bloc', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Re-enter airway', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Transfer specimen', exact: true }).click()
  await page.getByRole('button', { name: 'Re-enter airway', exact: true }).click()
  await expect(page.getByTestId('specimen-count')).toHaveText('1')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(out, 'cryo-defect.png'), fullPage: true })
  await page.getByLabel('Lesion', { exact: true }).selectOption('polypoid')
  await expect(
    page.getByRole('button', { name: 'Electrosurgical snare', exact: true }),
  ).toBeEnabled({ timeout: 30000 })
  await page.getByRole('button', { name: 'Electrosurgical snare', exact: true }).click()
  await page.getByRole('button', { name: 'Approach target', exact: true }).click()
  await page.getByLabel('Instrument extension', { exact: true }).fill('36')
  await page.getByRole('button', { name: 'Open loop', exact: true }).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(out, 'snare-loop.png'), fullPage: true })
  console.log(
    'Snare position',
    await page.getByLabel('Instrument extension', { exact: true }).inputValue(),
  )
  await page.getByRole('button', { name: 'Tighten loop', exact: true }).click()
  console.log('Snare capture', await page.getByRole('status').allTextContents())
  await page.getByLabel('Inspired oxygen', { exact: true }).fill('0.5')
  await page.getByLabel('Return electrode circuit confirmed', { exact: true }).check()
  await page.getByRole('button', { name: 'Activate snare resection', exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Thermal activation blocked' }),
  ).toContainText('oxygen')
  await page.getByLabel('Inspired oxygen', { exact: true }).fill('0.3')
  await page.getByRole('button', { name: 'Activate snare resection', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Withdraw scope + tool en bloc', exact: true }),
  ).toBeVisible({ timeout: 30000 })
  console.log('Snare residual', await page.getByTestId('residual-tissue').innerText())
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(out, 'snare-resection.png'), fullPage: true })
  await page.getByRole('button', { name: 'Withdraw scope + tool en bloc', exact: true }).click()
  await page.getByRole('button', { name: 'Transfer specimen', exact: true }).click()
  await page.getByRole('button', { name: 'Re-enter airway', exact: true }).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(out, 'snare-defect.png'), fullPage: true })

  await page.goto(`${base}/en/admin/therapeutic-bronchoscopy?mode=learn&lesson=forceps`)
  await expect(page.getByRole('button', { name: 'Compare normal', exact: true })).toBeEnabled({
    timeout: 60000,
  })
  await expect(
    page.getByRole('button', { name: 'Continue after comparison', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Compare normal', exact: true }).click()
  await page.getByRole('button', { name: 'Return to lesion', exact: true }).click()
  await page.getByRole('button', { name: 'Continue after comparison', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Worked example', exact: true })).toHaveCount(0)
  await page.getByRole('radio', { name: 'The whole tumor disappears', exact: true }).check()
  await page.getByRole('button', { name: 'Submit prediction', exact: true }).click()
  await expect(page.getByText('Reconsider the relationship', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Continue to tissue handling', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Review the tissue response', exact: true }),
  ).toBeDisabled()
  await page.screenshot({ path: path.join(out, 'learn-forceps-act.png'), fullPage: true })
  const takeForceps = async () => {
    await expect(page.getByRole('button', { name: 'Advance tool 1 mm', exact: true })).toBeEnabled({
      timeout: 60000,
    })
    await page.getByLabel('Instrument extension', { exact: true }).fill('36')
    await page.getByRole('button', { name: 'Open jaws', exact: true }).click()
    await page.getByRole('button', { name: 'Close jaws / biopsy', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Tissue held' })).toBeVisible({
      timeout: 30000,
    })
    await page.getByRole('button', { name: 'Retrieve instrument', exact: true }).click()
    await expect(page.getByTestId('specimen-count')).toHaveText('1')
  }
  await takeForceps()
  await page.getByRole('button', { name: 'Review the tissue response', exact: true }).click()
  await page.getByRole('button', { name: 'Explain the result', exact: true }).click()
  await page.getByRole('button', { name: 'Begin the transfer case', exact: true }).click()
  await expect(page.getByTestId('specimen-count')).toHaveText('0')
  await takeForceps()
  await page.screenshot({ path: path.join(out, 'learn-transfer.png'), fullPage: true })
  await page.getByRole('button', { name: 'Complete this instrument lesson', exact: true }).click()
  await expect(
    page.getByText('1 of 3 instrument lessons completed', { exact: false }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByText('0 of 3 instrument lessons completed', { exact: false }),
  ).toBeVisible()
  await page.goto(`${base}/en/admin/therapeutic-bronchoscopy?mode=assess`)
  await expect(page.getByText('Appropriate next action.', { exact: false })).toHaveCount(0)
  await page
    .getByRole('radio', { name: 'Take another bite at the previous position', exact: true })
    .check()
  await page
    .getByRole('radio', {
      name: 'Scope, probe and retained tissue are withdrawn together',
      exact: true,
    })
    .check()
  await page
    .getByRole('radio', {
      name: 'Activation is blocked and thermal conditions must be reassessed',
      exact: true,
    })
    .check()
  await page.getByRole('button', { name: 'Submit decisions', exact: true }).click()
  await expect(page.getByText('Review this decision.', { exact: false })).toBeVisible()
  await page.screenshot({ path: path.join(out, 'assessment-debrief.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/en/admin/therapeutic-bronchoscopy?mode=practice`)
  await expect(page.getByRole('button', { name: 'Advance tool 1 mm', exact: true })).toBeEnabled({
    timeout: 60000,
  })
  await page.screenshot({ path: path.join(out, 'practice-mobile.png'), fullPage: true })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)
  await page.goto(`${base}/en/admin/therapeutic-bronchoscopy?mode=learn&lesson=forceps`)
  await page.screenshot({ path: path.join(out, 'learn-mobile.png'), fullPage: true })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)
  console.log('Learn, transfer, reload, assessment and compact layouts passed')

  await page.setViewportSize({ width: 1440, height: 1080 })
  await page.goto(`${base}/en/mechanical-ventilation/learn?activity=breathing-with-support`)
  await page.locator('[data-lesson-shell]').waitFor({ timeout: 60000 })
  await page.screenshot({ path: path.join(out, 'reference-stage.png'), fullPage: true })
  await page.goto(`${base}/en/learn/anatomy/airway?airwayMode=abnormalities`)
  await expect(page.getByRole('button', { name: 'Abnormalities', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Realistic navigation', exact: true })).toBeVisible(
    { timeout: 60000 },
  )
  console.log('Original anatomy experience retained')
  await page.route('**/obstructing.glb', (r) =>
    r.fulfill({ status: 503, body: 'Expected test failure' }),
  )
  await page.goto(`${base}/en/admin/therapeutic-bronchoscopy?mode=practice`)
  await expect(page.getByRole('button', { name: 'Reload model', exact: true })).toBeVisible({
    timeout: 60000,
  })
  await expect(page.getByRole('button', { name: 'Advance tool 1 mm', exact: true })).toBeDisabled()
  await page.screenshot({ path: path.join(out, 'asset-failure.png'), fullPage: true })
  await page.unroute('**/obstructing.glb')
  await page.getByRole('button', { name: 'Reload model', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Advance tool 1 mm', exact: true })).toBeEnabled({
    timeout: 60000,
  })
  await page.getByLabel('Lesion', { exact: true }).selectOption('polypoid')
  await page.getByLabel('Lesion', { exact: true }).selectOption('mucosal')
  await expect(page.getByRole('button', { name: 'Advance tool 1 mm', exact: true })).toBeEnabled({
    timeout: 60000,
  })
  await expect(page.getByLabel('Lesion', { exact: true })).toHaveValue('mucosal')
  await page.getByRole('button', { name: 'Approach target', exact: true }).click()
  await takeForceps()
  console.log('Shallow mucosal biopsy and rapid scenario replacement passed')

  await page.route('**/*tissue_worker_ts.js', (r) => r.abort())
  await page.goto(`${base}/en/admin/therapeutic-bronchoscopy?mode=practice`)
  await expect(page.getByRole('button', { name: 'Reload model', exact: true })).toBeVisible({
    timeout: 60000,
  })
  await expect(page.getByRole('button', { name: 'Advance tool 1 mm', exact: true })).toBeDisabled()
  await page.screenshot({ path: path.join(out, 'worker-failure.png'), fullPage: true })
  await page.unroute('**/*tissue_worker_ts.js')
  await page.getByRole('button', { name: 'Reload model', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Advance tool 1 mm', exact: true })).toBeEnabled({
    timeout: 60000,
  })
  console.log('Worker failure and retry passed')
  await writeFile(path.join(out, 'errors.json'), JSON.stringify(errors, null, 2))
  if (errors.length) throw Error(errors.join('\n'))
} finally {
  await browser.close()
}
