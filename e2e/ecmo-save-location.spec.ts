import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const storageKey = 'cardiohelp-ecmo-progress-v1'
const disclosure =
  'Save & exit saves your location, not the current teaching or case state. Your existing progress history is retained. Reopening starts fresh; answers, snapshots, and simulator actions from this run are not restored.'
const legacy = {
  version: 2,
  lastStation: 'orientation',
  completedLabs: ['historical-demo'],
  scenarioAttempts: { 'historical-demo': 2 },
  bestScores: { 'historical-demo': 80 },
  criticalErrorStatus: { 'historical-demo': false },
  mastery: true,
  completedLearnLessonIds: ['historical-lesson'],
  completedFoundationSectionIds: ['historical-section'],
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
    const choices = page.locator('[data-prediction-choices] input[type="radio"]')
    await choices.first().check()
    await page.getByRole('button', { name: 'Commit this prediction', exact: true }).click()
    await expect(choices.first()).toBeChecked()
    await page.screenshot({ path: test.info().outputPath('before-exit.png') })
    await save.focus()
    await page.keyboard.press('Enter')
    await page.waitForURL('**/en/cardiohelp-ecmo')
    const resume = page.locator('[data-ecmo-continue="resolved"]')
    await expect(resume).toHaveAttribute('href', entry)
    await resume.click()
    await expect(shell).toHaveAttribute('data-stage', openingStep!)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.locator('[data-prediction-choices] input:checked')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Commit this prediction', exact: true }),
    ).toBeDisabled()
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)
    for (const [key, value] of Object.entries(legacy)) expect(stored[key]).toEqual(value)
    expect(stored.selfPaced.lastVisited).toEqual({
      section: 'learn',
      scenarioId: 'vv-series-physiology',
      supportMode: 'vv',
    })
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
  const note = page.locator('[data-ecmo-save-location-note]')
  await expect(note).toHaveText(disclosure)
  await note.scrollIntoViewIfNeeded()
  await expect(note).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const shell = page.locator('[data-ecmo-shell="practice"]')
  await expect(shell).toHaveAttribute('data-stage', 'brief')
  await page.getByRole('button', { name: 'Begin case', exact: true }).click()
  await page
    .getByRole('combobox', { name: /^Goal/ })
    .selectOption({ label: 'Improve acute hypercapnic acidemia' })
  await page
    .getByRole('combobox', { name: /^First priority/ })
    .selectOption({ label: 'Restore gas source' })
  await page
    .getByRole('combobox', { name: /^Expected immediate effect/ })
    .selectOption({ label: 'Restore source' })
  await page.getByRole('button', { name: 'Record prediction for the debrief', exact: true }).click()
  await expect(shell).toHaveAttribute('data-stage', 'manage')
  await page.getByRole('button', { name: /Inspect the complete gas pathway/ }).click()
  await page.getByRole('button', { name: 'Go to the control', exact: true }).click()
  const gas = page.locator('[data-sweep-delivery]')
  await expect(gas).toHaveAttribute('data-connected', 'false')
  await page.getByRole('button', { name: 'Restore verified gas source', exact: true }).click()
  await expect(gas).toHaveAttribute('data-connected', 'true')
  await page.screenshot({ path: test.info().outputPath('case-before-exit.png') })
  await save.click()
  await page.waitForURL('**/en/cardiohelp-ecmo')
  const resume = page.getByRole('link', { name: /^Return to your saved location:/ })
  await expect(resume).toHaveAttribute('href', entry)
  await resume.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Save & exit', exact: true })).toBeVisible()
  await expect(shell).toHaveAttribute('data-stage', 'brief')
  await page.getByRole('button', { name: 'Begin case', exact: true }).click()
  await expect(page.locator('#practice-plan')).toHaveAttribute('data-committed', 'false')
  await expect(page.getByRole('combobox', { name: /^Goal/ })).toHaveValue('')
  await page.getByRole('button', { name: 'Start guided activity', exact: true }).click()
  await page.getByRole('button', { name: 'Go to the control', exact: true }).click()
  await expect(gas).toHaveAttribute('data-connected', 'false')
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)
  for (const [key, value] of Object.entries(legacy)) expect(stored[key]).toEqual(value)
  expect(stored.selfPaced.lastVisited).toEqual({
    section: 'practice',
    scenarioId: 'clinical-vv-gas-disconnection',
    supportMode: 'vv',
  })
  expect(stored.selfPaced).not.toHaveProperty('simulation')
  expect(stored.selfPaced).not.toHaveProperty('answers')
  await page.screenshot({ path: test.info().outputPath('case-reopened.png') })
})

test('Learn reopening clears a captured snapshot and modeled-run actions', async ({ page }) => {
  const entry = '/en/cardiohelp-ecmo/learn?lesson=vv-normal-state&track=vv'
  await page.goto(entry)
  const shell = page.locator('[data-ecmo-shell="learn"]')
  await expect(shell).toHaveAttribute('data-stage', 'vv-normal-state-recognize')
  async function openAct() {
    await page.locator('[data-task-history] summary').click()
    await page.locator('[data-step-list] button').nth(2).click()
    await expect(shell).toHaveAttribute('data-stage', 'vv-normal-state-act')
  }
  await openAct()
  await page.locator('[data-guided-action="capture-reference-snapshot"]').click()
  await page.locator('[data-guided-action="run-twenty-modeled-seconds"]').click()
  await expect(page.locator('[data-interaction="capture-reference-snapshot"]')).toBeVisible()
  await expect(page.locator('[data-interaction="run-twenty-modeled-seconds"]')).toBeVisible()
  await expect(page.locator('[data-now-card]')).toContainText(
    'the snapshot captured in this session',
  )
  await page.screenshot({ path: test.info().outputPath('snapshot-before-exit.png') })
  await page.getByRole('button', { name: 'Save & exit', exact: true }).click()
  await page.waitForURL('**/en/cardiohelp-ecmo')
  const resume = page.locator('[data-ecmo-continue="resolved"]')
  await expect(resume).toHaveAttribute('href', entry)
  await resume.click()
  await expect(shell).toHaveAttribute('data-stage', 'vv-normal-state-recognize')
  await openAct()
  await expect(page.locator('[data-interaction-evidence]')).toHaveCount(0)
  await expect(page.locator('[data-now-card]')).not.toContainText(
    'the snapshot captured in this session',
  )
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)
  for (const [key, value] of Object.entries(legacy)) expect(stored[key]).toEqual(value)
  expect(Object.keys(stored.selfPaced).sort()).toEqual([
    'lastCaseScenarioIdByMode',
    'lastLessonScenarioIdByMode',
    'lastVisited',
    'visitedTopicIds',
  ])
  await page.screenshot({ path: test.info().outputPath('snapshot-fresh-reopening.png') })
})
