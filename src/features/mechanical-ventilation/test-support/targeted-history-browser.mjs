/** Browser evidence lifecycle checks. Legacy/malformed fixtures are isolated from user storage. */
import { chromium, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
const base = process.env.MV_REVIEW_URL ?? 'http://127.0.0.1:3161'
const output = path.resolve('artifacts/mv-targeted')
const key = 'mechanical-ventilation-live-learning-v1'
const browser = await chromium.launch()
const results = []
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  reducedMotion: 'reduce',
})
async function state() {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key)
}
async function primary() {
  await page.locator('[data-now-primary]').click()
}
async function hold() {
  await page.locator('#mv-quick-hold-inspiratory').click()
  for (let i = 0; i < 2; i++)
    await page.getByRole('button', { name: 'Advance one breath', exact: true }).click()
}
try {
  await page.clock.install()
  await page.goto(`${base}/en/mechanical-ventilation/learn?activity=mechanics-load-and-pressure`)
  await primary()
  await page
    .locator('[data-prediction-choices]')
    .getByRole('radio', { name: 'A larger peak-to-plateau gap' })
    .check()
  await primary()
  await primary()
  await page.locator('[data-now-secondary]').click()
  await hold()
  await expect(page.locator('[data-hold-provenance]')).toContainText('Current captured hold')
  const control = page.locator('#mv-quick-resistanceScale')
  await control.focus()
  await control.press('Home')
  for (let i = 0; i < 35; i++) await control.press('ArrowRight')
  await expect(page.locator('[data-hold-provenance]')).toContainText('Historical hold')
  await expect(page.locator('[data-now-primary]')).toHaveCount(0)
  await page.screenshot({ path: path.join(output, 'stale-hold-no-credit-1280.png') })
  await hold()
  await expect(page.locator('[data-hold-provenance]')).toContainText('Current captured hold')
  await primary()
  await page.getByRole('combobox', { name: 'Simulation speed' }).selectOption('5')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await page.clock.runFor(5000)
  await primary()
  await page
    .locator('[data-observation-task]')
    .getByRole('radio', { name: 'Fell', exact: true })
    .check()
  await primary()
  await expect(page.locator('[data-observation-feedback]')).toContainText('Recheck')
  await page.getByRole('button', { name: 'Repeat from a clean baseline' }).click()
  let saved = (await state()).units['mechanics-load-and-pressure']
  expect(saved.evidence[0].prediction).toBe(0)
  expect(saved.evidence[0].observation).toBeUndefined()
  expect(saved.holds).toEqual([])
  expect(saved.history.at(-1).holds.length).toBe(2)
  await page.reload()
  await expect(control).toHaveValue('1')
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Restart section', exact: true }).click()
  await expect(page.locator('[data-foundation-teaching]')).toBeVisible()
  saved = (await state()).units['mechanics-load-and-pressure']
  expect(saved.evidence).toEqual([{}, {}])
  expect(saved.history.length).toBeGreaterThan(1)
  results.push({
    check: 'pre-change UI hold, fresh hold, wrong observation, clean repeat, refresh, restart',
    result: 'passed',
  })

  const completed = JSON.parse(
    await readFile(path.join(output, 'walkthrough-results.json'), 'utf8'),
  )[0].stored.units['breathing-with-support']
  const legacy = {
    ...completed,
    evidenceVersion: undefined,
    evidence: completed.evidence.map((e) => ({
      ...e,
      observation: undefined,
      inspection: undefined,
    })),
  }
  await page.evaluate(
    ({ key, legacy }) =>
      localStorage.setItem(
        key,
        JSON.stringify({ version: 1, units: { 'breathing-with-support': legacy } }),
      ),
    { key, legacy },
  )
  await page.goto(`${base}/en/mechanical-ventilation/learn?activity=breathing-with-support`)
  await expect(page.locator('[data-foundation-teaching]')).toBeVisible()
  await expect(page.locator('[data-historical-learning]')).toBeAttached()
  const migrated = (await state()).units['breathing-with-support']
  expect(migrated.evidence).toEqual([{}, {}])
  expect(migrated.history[0].completedAt).toBe(legacy.completedAt)
  await page.goto(`${base}/en/mechanical-ventilation/assess`)
  await expect(
    page.getByRole('heading', { name: 'Work through the fourteen sections first.' }),
  ).toBeVisible()
  results.push({
    check: 'legacy history preserved without revised evidence or final-check eligibility',
    result: 'passed',
  })

  await page.evaluate((k) => localStorage.setItem(k, '{malformed'), key)
  await page.goto(`${base}/en/mechanical-ventilation/learn?activity=breathing-with-support`)
  await expect(page.locator('[data-foundation-teaching]')).toBeVisible()
  results.push({ check: 'malformed storage starts safely', result: 'passed' })
  const unavailable = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  await unavailable.addInitScript(() => {
    for (const method of ['getItem', 'setItem']) {
      const original = Storage.prototype[method]
      Storage.prototype[method] = function (...args) {
        if (String(args[0]).includes('ventilation'))
          throw new DOMException('Unavailable', 'SecurityError')
        return original.apply(this, args)
      }
    }
  })
  await unavailable.goto(`${base}/en/mechanical-ventilation/learn?activity=breathing-with-support`)
  await expect(unavailable.locator('[data-now-card]')).toBeVisible()
  await expect(
    unavailable.getByText(
      'This browser is not saving your place. The section still works; a reload starts it again.',
    ),
  ).toBeVisible()
  await unavailable.locator('[data-now-primary]').click()
  await unavailable
    .locator('[data-prediction-choices]')
    .getByRole('radio', { name: 'Expiration', exact: true })
    .check()
  await unavailable.locator('[data-now-primary]').click()
  await unavailable.locator('[data-now-primary]').click()
  const cursor = unavailable.locator('[data-now-card]').getByRole('slider')
  await cursor.focus()
  await cursor.press('End')
  await cursor.press('ArrowLeft')
  await unavailable.getByRole('button', { name: 'Use this captured interval' }).press('Enter')
  await expect(unavailable.locator('[data-now-primary]')).toBeEnabled()
  results.push({
    check: 'unavailable MV storage continues in memory with keyboard capture',
    result: 'passed',
  })
  console.log(JSON.stringify(results, null, 2))
} finally {
  await writeFile(path.join(output, 'history-results.json'), JSON.stringify(results, null, 2))
  await browser.close()
}
