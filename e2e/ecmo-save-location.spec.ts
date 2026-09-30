import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const storageKey = 'cardiohelp-ecmo-progress-v1'
const disclosure =
  'Only your location is saved. Reopening starts a fresh teaching or case state; answers, snapshots and simulator actions are not restored.'
const legacy = {
  version: 2,
  lastStation: 'orientation',
  completedLabs: [],
  scenarioAttempts: { 'historical-demo': 2 },
  bestScores: { 'historical-demo': 80 },
  criticalErrorStatus: {},
  mastery: false,
  completedLearnLessonIds: [],
  lastLessonScenarioIdByMode: {},
  lastCaseScenarioIdByMode: {},
  syntheticLegacyField: 'preserve this owner-independent fixture',
}

test.beforeEach(async ({ context }) => {
  if (process.env.ECMO_E2E_TOKEN_FILE) {
    const token = readFileSync(process.env.ECMO_E2E_TOKEN_FILE, 'utf8').trim()
    await context.request
      .get(`/api/local-dev-auth?token=${encodeURIComponent(token)}&next=/en/cardiohelp-ecmo`)
      .catch((error: unknown) => {
        throw new Error(String(error).replaceAll(token, '[LOCAL_DEV_TOKEN_REDACTED]'))
      })
  }
  await context.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value))
    },
    { key: storageKey, value: legacy },
  )
})

for (const condition of [
  { width: 1440, height: 900, rootText: 100 },
  { width: 390, height: 844, rootText: 100 },
  { width: 390, height: 844, rootText: 200 },
]) {
  test(`Learn exit describes fresh reopening at ${condition.width}/${condition.rootText}% root text`, async ({
    page,
  }) => {
    await page.setViewportSize(condition)
    const entry = '/en/cardiohelp-ecmo/learn?lesson=vv-series-physiology&track=vv'
    await page.goto(entry)
    await expect(page.locator('[data-ecmo-shell="learn"]')).toBeVisible()
    if (condition.rootText === 200) {
      await page.evaluate(() => (document.documentElement.style.fontSize = '200%'))
    }
    const save = page.getByRole('button', { name: 'Save & exit', exact: true })
    await expect(save).toHaveAccessibleDescription(disclosure)
    const note = page.locator('[data-ecmo-save-location-note]')
    await expect(note).toHaveText(disclosure)
    await note.scrollIntoViewIfNeeded()
    await expect(note).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath('save-location-notice.png') })
    const shell = page.locator('[data-ecmo-shell="learn"]')
    const openingStep = await shell.getAttribute('data-stage')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(shell).not.toHaveAttribute('data-stage', openingStep!)
    await page.screenshot({ path: test.info().outputPath('before-exit.png') })
    await save.focus()
    await page.keyboard.press('Enter')
    await page.waitForURL('**/en/cardiohelp-ecmo')
    await page.goto(entry)
    await expect(shell).toHaveAttribute('data-stage', openingStep!)
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)
    for (const [key, value] of Object.entries(legacy)) expect(stored[key]).toEqual(value)
    expect(stored.selfPaced).not.toHaveProperty('answers')
    expect(stored.selfPaced).not.toHaveProperty('simulation')
    await page.screenshot({ path: test.info().outputPath('fresh-reopening.png') })
  })
}

test('saved Practice link names the location and preserves its existing destination', async ({
  page,
}) => {
  const entry = '/en/cardiohelp-ecmo/practice?case=clinical-vv-gas-disconnection&track=vv'
  await page.goto(entry)
  const save = page.getByRole('button', { name: 'Save & exit', exact: true })
  await expect(save).toHaveAccessibleDescription(disclosure)
  await save.click()
  await page.waitForURL('**/en/cardiohelp-ecmo')
  const resume = page.getByRole('link', { name: /^Return to your saved location:/ })
  await expect(resume).toHaveAttribute('href', entry)
  await resume.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Save & exit', exact: true })).toBeVisible()
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)
  for (const [key, value] of Object.entries(legacy)) expect(stored[key]).toEqual(value)
  await page.screenshot({ path: test.info().outputPath('case-reopened.png') })
})
