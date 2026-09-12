import { chromium, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const base = process.env.BRONCH_REVIEW_URL ?? 'http://localhost:3110'
const output = path.resolve('artifacts/airway-abnormalities/browser')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
})
const page = await context.newPage()
const errors = []
let simulatedFailure = false
let expectedNetworkFailures = 0
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') {
    if (simulatedFailure && message.text().includes('500')) expectedNetworkFailures++
    else errors.push(message.text())
  }
})
await page.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
if (process.env.BRONCH_REVIEW_AUTH_ENV) {
  const env = await readFile(process.env.BRONCH_REVIEW_AUTH_ENV, 'utf8')
  const token = env
    .match(/^LOCAL_DEV_AUTH_TOKEN\s*=\s*(.*)$/m)?.[1]
    ?.trim()
    .replace(/^(['"])(.*)\1$/, '$2')
  if (!token) throw new Error('Existing local development auth token not found')
  await context.addCookies([{ name: 'ip_local_dev_auth', value: token, url: base }])
}
try {
  await page.goto(`${base}/en/learn/anatomy/airway`, { timeout: 120000 })
  await page
    .getByRole('button', { name: 'Abnormalities', exact: true })
    .waitFor({ timeout: 120000 })
  await expect(page.getByRole('button', { name: 'Realistic navigation', exact: true })).toBeEnabled(
    { timeout: 60000 },
  )
  const optical = page.getByText('Virtual bronchoscopy', { exact: true }).locator('..')
  await optical.screenshot({ path: path.join(output, 'baseline.png') })
  await page.getByRole('button', { name: 'Abnormalities', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Approach selected site', exact: true }),
  ).toBeEnabled({ timeout: 60000 })
  console.log('Abnormalities workspace ready')
  for (const id of ['obstructing', 'polypoid', 'mucosal']) {
    await page.getByLabel('Finding', { exact: true }).selectOption(id)
    await expect(
      page.getByRole('button', { name: 'Approach selected site', exact: true }),
    ).toBeEnabled({ timeout: 30000 })
    await page.waitForTimeout(800)
    await optical.screenshot({ path: path.join(output, `${id}.png`) })
    console.log(`Captured ${id}`)
  }
  await page.getByLabel('Finding', { exact: true }).selectOption('obstructing')
  await page.getByLabel('Lesion size', { exact: true }).focus()
  await page.keyboard.press('End')
  await expect(page.getByLabel('Lesion size', { exact: true })).toHaveValue('1.2')
  await page.getByLabel('Position around airway wall', { exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByLabel('Position around airway wall', { exact: true })).toHaveValue('30')
  await page.keyboard.press('Home')
  for (let i = 0; i < 6; i++)
    await page
      .getByRole('button', { name: 'Advance toward abnormality', exact: true })
      .press('Enter')
  await expect(
    page.getByText('Scope contact with airway wall or lesion — withdraw or redirect the tip.', {
      exact: true,
    }),
  ).toBeVisible({ timeout: 20000 })
  await optical.screenshot({ path: path.join(output, 'contact.png') })
  await page.getByRole('button', { name: 'Withdraw from abnormality', exact: true }).press('Enter')
  await expect(
    page.getByText('Scope contact with airway wall or lesion — withdraw or redirect the tip.', {
      exact: true,
    }),
  ).toHaveCount(0, { timeout: 10000 })
  await page.getByRole('button', { name: 'Approach selected site', exact: true }).click()
  const comparisonPosition = await optical.getAttribute('data-scope-position')
  await expect(page.getByRole('button', { name: 'Compare with normal', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Compare with normal', exact: true }).click()
  await expect(
    page.getByText('Normal comparison · insertion depth held.', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Advance toward abnormality', exact: true }),
  ).toBeDisabled()
  await page.locator('#airway-simulator').press('w')
  await page.waitForTimeout(500)
  await expect(optical).toHaveAttribute('data-scope-position', comparisonPosition)
  await optical.screenshot({ path: path.join(output, 'normal-comparison.png') })
  await page.getByRole('button', { name: 'Restore abnormalities', exact: true }).click()
  await expect(
    page.getByText('Restore abnormalities to resume insertion.', { exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Brisk', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Pause bleeding animation', exact: true }),
  ).toBeEnabled({ timeout: 30000 })
  await expect
    .poll(async () => Number(await optical.getAttribute('data-blood-amount')), { timeout: 120000 })
    .toBeGreaterThan(0.65)
  await page.getByRole('button', { name: 'Pause bleeding animation', exact: true }).click()
  await page.waitForTimeout(500)
  const pausedAmount = await optical.getAttribute('data-blood-amount')
  await page.waitForTimeout(700)
  await expect(optical).toHaveAttribute('data-blood-amount', pausedAmount)
  console.log('Bleeding state', pausedAmount, await optical.getAttribute('data-source-visibility'))
  await optical.screenshot({ path: path.join(output, 'bleeding.png') })
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true })
  console.log('Captured bleeding and comparison')
  await page.getByRole('button', { name: 'Resume bleeding animation', exact: true }).click()
  await expect
    .poll(async () => Number(await optical.getAttribute('data-blood-amount')), { timeout: 60000 })
    .toBeGreaterThan(Number(pausedAmount))
  await page.getByRole('button', { name: 'Restart bleeding animation', exact: true }).click()
  await expect
    .poll(async () => Number(await optical.getAttribute('data-blood-amount')))
    .toBeLessThan(0.2)
  await page.getByRole('button', { name: 'Off', exact: true }).click()
  await page.getByLabel('Finding', { exact: true }).selectOption('none')
  await page.getByRole('button', { name: 'Oozing', exact: true }).click()
  await expect
    .poll(async () => Number(await optical.getAttribute('data-blood-amount')), { timeout: 60000 })
    .toBeGreaterThan(0.12)
  await optical.screenshot({ path: path.join(output, 'bleeding-only.png') })
  await page.getByRole('button', { name: 'Off', exact: true }).click()
  await page.getByLabel('Finding', { exact: true }).selectOption('obstructing')
  for (const site of ['trachea', 'left-mainstem', 'intermedius']) {
    await page.getByLabel('Location', { exact: true }).selectOption(site)
    await expect(
      page.getByRole('button', { name: 'Approach selected site', exact: true }),
    ).toBeEnabled()
    await page.waitForTimeout(500)
    await optical.screenshot({ path: path.join(output, `site-${site}.png`) })
    console.log(`Captured ${site}`)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true })
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  if (overflow) errors.push('Horizontal document overflow at 390px')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await page.getByRole('button', { name: 'Explore', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Airway abnormalities', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Challenge', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Challenge', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.goto(`${base}/en/learn/anatomy/airway?airwayMode=abnormalities#airway-simulator`)
  await expect(page.getByLabel('Finding', { exact: true })).toHaveValue('none', { timeout: 60000 })
  await expect(page.getByRole('button', { name: 'Off', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  simulatedFailure = true
  await page.route('**/bronchoscopy-abnormalities/polypoid.glb', (route) =>
    route.fulfill({ status: 500, body: 'Simulated model load failure' }),
  )
  await page.getByLabel('Finding', { exact: true }).selectOption('polypoid')
  await expect(
    page.getByText('The abnormality model could not load. Retry to continue.', { exact: false }),
  ).toBeVisible({ timeout: 20000 })
  await expect(
    page.getByRole('button', { name: 'Advance toward abnormality', exact: true }),
  ).toBeDisabled()
  await page.unroute('**/bronchoscopy-abnormalities/polypoid.glb')
  await page.getByRole('button', { name: 'Retry model', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Advance toward abnormality', exact: true }),
  ).toBeEnabled({ timeout: 30000 })
  simulatedFailure = false
  await page.screenshot({ path: path.join(output, 'recovered.png'), fullPage: true })
  console.log(
    'Verified contact, withdrawal, comparison, pause/restart, bleeding-only, modes, reload and asset retry',
  )
  await writeFile(
    path.join(output, 'review.json'),
    JSON.stringify(
      { errors, expectedNetworkFailures, viewport: '1440x1000 / 390x844', output },
      null,
      2,
    ),
  )
  console.log(JSON.stringify({ errors, output }))
  if (errors.length) process.exitCode = 1
} finally {
  await browser.close()
}
