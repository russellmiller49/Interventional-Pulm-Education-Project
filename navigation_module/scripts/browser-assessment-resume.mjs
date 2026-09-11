import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const output = 'artifacts/navigation-review',
  browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } }),
  errors = []
page.on('pageerror', (e) => errors.push(e.message))
const session = () =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('bronchoedu:session:v1:'))
    return key ? JSON.parse(localStorage.getItem(key)) : null
  })
try {
  await page.goto(process.env.NAVIGATION_REVIEW_URL ?? 'http://127.0.0.1:3132')
  await page.getByRole('button', { name: 'Surprise me', exact: true }).click({ timeout: 60000 })
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  for (
    let i = 0;
    i < 100 && !(await page.locator('.scope-choice-row .choice-button').count());
    i++
  ) {
    await page
      .getByRole('button', { name: 'Move scope forward', exact: true })
      .evaluateAll((buttons) => buttons[0]?.click())
    await page.waitForTimeout(100)
  }
  await page.locator('.scope-choice-row .choice-button').first().click()
  await page.waitForFunction(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('bronchoedu:session:v1:'))
    return key && JSON.parse(localStorage.getItem(key)).selectedEdgeId != null
  })
  const saved = await session()
  await page.reload()
  await page.getByRole('button', { name: 'Drive on', exact: true }).waitFor({ timeout: 60000 })
  assert.equal(
    await page.getByRole('button', { name: 'Drive on', exact: true }).isEnabled(),
    true,
    'Answered assessment stop must remain advanceable after reload',
  )
  const restored = await session()
  assert.deepEqual(restored.testAttemptResults, saved.testAttemptResults)
  assert.equal(restored.selectedEdgeId, saved.selectedEdgeId)
  assert.equal(await page.locator('.map-panel').count(), 0)
  assert.equal(await page.getByLabel('Centerline', { exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Drive on', exact: true }).click()
  await page.waitForFunction((previous) => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('bronchoedu:session:v1:'))
    return key && JSON.parse(localStorage.getItem(key)).currentDecisionIndex > previous
  }, saved.currentDecisionIndex)
  await mkdir(output, { recursive: true })
  await writeFile(
    `${output}/assessment-resume.json`,
    JSON.stringify(
      {
        answeredStopRestored: true,
        advanceEnabled: true,
        scorePreserved: true,
        assessmentOverlaysHidden: true,
        errors,
      },
      null,
      2,
    ),
  )
  assert.equal(errors.length, 0, errors.join('\n'))
  console.log('Assessment resume passed')
} finally {
  await browser.close()
}
