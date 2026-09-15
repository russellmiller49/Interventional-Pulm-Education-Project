import { test, expect, type Page } from '@playwright/test'

const key = 'baxter-crrt-progress-v3'
async function assertUngraded(page: Page) {
  const saved = await page.evaluate(
    (storageKey) => JSON.parse(localStorage.getItem(storageKey) ?? '{}'),
    key,
  )
  expect(saved.attempts ?? {}).toEqual({})
  expect(saved.bestSafeScores ?? {}).toEqual({})
  expect(saved.criticalErrorAttempts ?? {}).toEqual({})
  expect(saved.hintUse ?? {}).toEqual({})
  expect(saved.learnTaskHistory).toBeUndefined()
  expect(saved.completedLessonIds ?? []).toEqual([])
  expect(saved.completedPracticeCaseIds ?? []).toEqual([])
  expect(saved.completedMasteryCapstoneIds ?? []).toEqual([])
  return saved
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
}

test('all 18 public cases support explanation, hints and debrief without invented work', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (let n = 1; n <= 18; n++) {
    const id = `CRRT-${String(n).padStart(2, '0')}`
    await page.goto(n === 16 ? '/en/baxter-crrt/assess' : `/en/baxter-crrt/practice?case=${id}`)
    const explain = page.getByRole('button', { name: 'Explain this case', exact: true })
    await expect(explain).toBeVisible()
    await expect(
      page.getByRole('combobox', { name: /Goal|Mechanism|Expected response/ }),
    ).toHaveCount(0)
    await explain.click()
    await expect(page.getByRole('region', { name: 'Worked example', exact: true })).toContainText(
      'no answer, intervention, or observation',
    )
    await page.getByRole('button', { name: 'Reveal hint 1', exact: true }).click()
    await page.getByRole('tab', { name: 'Debrief', exact: true }).click()
    await page.getByRole('button', { name: 'End run and review debrief', exact: true }).click()
    await expect(
      page.getByText('Example reviewed · no run performed', { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('definition').filter({ hasText: 'None' }).first()).toBeVisible()
    await assertUngraded(page)
    if (n === 16) {
      await noOverflow(page)
      await page.screenshot({ path: info.outputPath('assess-example-desktop.png'), fullPage: true })
    }
  }
  expect(errors).toEqual([])
})

test('real device actions retain prerequisites and generate observations without a prediction', async ({
  page,
}, info) => {
  await page.goto('/en/baxter-crrt/practice?case=CRRT-01')
  const actions = page
    .locator('section')
    .filter({
      has: page.getByRole('heading', { name: 'Choose and sequence clinical actions', exact: true }),
    })
    .last()
  const assessment = actions
    .getByRole('article')
    .filter({ has: page.getByText('Complete the initial clinical assessment', { exact: true }) })
  const adjustment = actions
    .getByRole('article')
    .filter({ hasText: 'Adjust machine fluid removal after assessment' })
  await expect(adjustment.getByRole('button')).toBeDisabled()
  await assessment.getByRole('button').click()
  await expect(adjustment.getByRole('button')).toBeEnabled()
  await adjustment.getByRole('button').click()
  await page.getByRole('button', { name: '+5 min', exact: true }).click()
  await page.getByRole('tab', { name: 'Debrief', exact: true }).click()
  await page.getByRole('button', { name: 'End run and review debrief' }).click()
  await expect(page.getByText('Run reviewed', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recorded action timeline' })).toBeVisible()
  await assertUngraded(page)
  await page.screenshot({ path: info.outputPath('actual-run-desktop.png'), fullPage: true })
})

test('Learn supports no answer, explanation, wrong answer, retry, skip, map jump, reload and keyboard', async ({
  page,
}, info) => {
  await page.goto('/en/baxter-crrt/learn?lesson=crrt-indications-modality')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue without this exercise' }).click()
  const explain = page.getByRole('button', { name: 'Show explanation', exact: true })
  await explain.focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByText('Worked explanation · no answer recorded.', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
  await page.getByRole('radio', { name: /Fluid removal alone/ }).check()
  await page.getByRole('button', { name: 'Check reasoning' }).click()
  await expect(page.getByRole('status')).toContainText('Reasoning feedback')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue without this exercise' }).click()
  await expect(
    page.getByRole('heading', { name: 'Apply again: a different fluid goal', exact: true }),
  ).toBeVisible()
  await assertUngraded(page)
  await page
    .getByRole('combobox', { name: 'CRRT lesson', exact: true })
    .selectOption('crrt-pressure-profile-integration')
  await page.getByText(/Lesson tasks ·/, { exact: false }).click()
  const map = page.locator('details').filter({ has: page.getByText(/Lesson tasks ·/) })
  await map.getByRole('button').last().click()
  await page.getByRole('button', { name: 'Show explanation', exact: true }).click()
  await expect(
    page.getByText('Worked explanation · no answer recorded.', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Review patient and treatment', exact: true }),
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('learn-mobile.png'), fullPage: true })
  await assertUngraded(page)
})

test('compact legacy Assess supports keyboard surface navigation and a worked example', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/en/baxter-crrt/assess')
  const tabs = page.getByRole('tablist', { name: 'CRRT case surfaces' })
  const caseTab = tabs.getByRole('tab', { name: 'Case', exact: true })
  await caseTab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: 'Machine + circuit' })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(caseTab).toBeFocused()
  await page.getByRole('button', { name: 'Explain this case' }).click()
  await expect(page.getByRole('region', { name: 'Worked example', exact: true })).toBeVisible()
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('assess-mobile.png'), fullPage: true })
  await assertUngraded(page)
})

test('worked CRRT cases teach through explanation, an optional check and an actual run', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/en/baxter-crrt/practice?case=CRRT-05')
  await expect(
    page.getByRole('heading', { name: 'Understand this case', exact: true }),
  ).toBeVisible()
  const check = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Try predicting · optional' }) })
    .last()
  await check.getByRole('button', { name: 'Show explanation', exact: true }).click()
  await expect(
    check.getByText('Worked explanation · no answer recorded.', { exact: true }),
  ).toBeVisible()
  await expect(check.getByRole('radio', { checked: true })).toHaveCount(0)
  await check.getByRole('button', { name: 'Show hint', exact: true }).click()
  await check.getByRole('radio', { name: 'It falls, because the blood is diluted' }).check()
  await check.getByRole('button', { name: 'Check reasoning', exact: true }).click()
  await expect(check.getByRole('status')).toContainText('Reasoning feedback')
  await check.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(check.getByRole('radio', { checked: true })).toHaveCount(0)
  await assertUngraded(page)

  const actions = page
    .locator('section')
    .filter({
      has: page.getByRole('heading', { name: 'Choose and sequence clinical actions', exact: true }),
    })
    .last()
  await expect(actions.getByText('Declare one split universally superior')).toHaveCount(0)
  await actions
    .getByRole('article')
    .filter({ has: page.getByText('Complete the initial clinical assessment', { exact: true }) })
    .getByRole('button')
    .click()
  await actions
    .getByRole('article')
    .filter({ hasText: 'Change the pre/post replacement split' })
    .getByRole('button')
    .click()
  await page.getByRole('button', { name: '+1 hr', exact: true }).click()
  await page.getByRole('button', { name: 'Explain this case', exact: true }).click()
  const worked = page.getByRole('region', { name: 'Worked example', exact: true })
  await expect(worked).toContainText('Modeled comparison')
  await expect(worked).toContainText('Your run is at 1 hr. You performed the comparison actions.')
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('worked-crrt05-desktop.png'), fullPage: true })
  await page.getByRole('tab', { name: 'Debrief', exact: true }).click()
  await page.getByRole('button', { name: 'End run and review debrief', exact: true }).click()
  await expect(page.getByText('Run reviewed', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Expected and observed in this case', exact: true }),
  ).toBeVisible()
  await assertUngraded(page)

  await page.goto('/en/baxter-crrt/practice?case=CRRT-15')
  await page.getByRole('radio', { name: 'Return line', exact: true }).check()
  await page.getByRole('button', { name: 'Check reasoning', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Reasoning feedback' })).toContainText(
    'Here return pressure did not change.',
  )
  await page.getByRole('button', { name: 'Explain this case', exact: true }).click()
  await expect(
    page.getByRole('region', { name: 'Pressure location comparison; horizontally scrollable' }),
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('worked-crrt15-mobile.png'), fullPage: true })
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto('/en/baxter-crrt/assess')
  await page.getByRole('button', { name: 'Explain this case', exact: true }).click()
  await expect(
    page.getByRole('region', { name: 'Filter-loss domains; horizontally scrollable' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Try predicting · optional' })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('worked-crrt16-desktop.png'), fullPage: true })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Explain this case', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Worked example', exact: true })).toHaveCount(0)
  await assertUngraded(page)
  expect(errors).toEqual([])
})
