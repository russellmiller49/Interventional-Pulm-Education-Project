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
    await expect(page.getByText('Debrief opened · no run performed', { exact: true })).toBeVisible()
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
  await expect(page.getByText(/^Debrief opened · \d+ recorded events? in this run$/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What you did in this run' })).toBeVisible()
  // The debrief describes the page, never the safety of the care.
  await expect(page.getByText('Run reviewed', { exact: true })).toHaveCount(0)
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
  await expect(page.getByText(/^Debrief opened · \d+ recorded events? in this run$/)).toBeVisible()
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

test('the real practice route keeps one case identity and never restarts a run for the role lens', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  const picker = page.getByRole('combobox', { name: 'Station-grouped core case' })
  const caseTitle = page.getByRole('heading', { level: 2, name: /Set CRRT priorities/ })
  // The case picker still lives inside the collapsed "Current task" drawer
  // (F-09, owned by batch 03). Open it to read the current selection.
  const openTaskDrawer = async () => {
    const drawer = page.getByRole('group').filter({ hasText: 'Current task' }).first()
    if (!(await picker.isVisible().catch(() => false))) {
      await page.getByText('Current task', { exact: true }).first().click()
    }
    await expect(picker).toBeVisible()
    return drawer
  }

  await page.goto('/en/baxter-crrt/practice?case=CRRT-01')
  await expect(caseTitle).toBeVisible()
  await openTaskDrawer()
  await expect(picker).toHaveValue('CRRT-01')

  // "Next recommended" changes the actual case, not only the address bar.
  await page.getByRole('link', { name: /^Next recommended · / }).click()
  await expect(page).toHaveURL(/\?case=CRRT-02$/)
  await expect(
    page.getByRole('heading', { level: 2, name: /Prioritize hyperkalemia and acidemia/ }),
  ).toBeVisible()
  await expect(caseTitle).toHaveCount(0)
  await openTaskDrawer()
  await expect(picker).toHaveValue('CRRT-02')
  // The recommendation moves on instead of repeating the case just opened.
  await expect(page.getByRole('link', { name: /^Next recommended · / })).not.toHaveText(
    /Prioritize hyperkalemia and acidemia/,
  )

  await page.goBack()
  await expect(page).toHaveURL(/\?case=CRRT-01$/)
  await expect(caseTitle).toBeVisible()
  await openTaskDrawer()
  await expect(picker).toHaveValue('CRRT-01')

  await page.goForward()
  await expect(page).toHaveURL(/\?case=CRRT-02$/)
  await openTaskDrawer()
  await expect(picker).toHaveValue('CRRT-02')

  await page.reload()
  await openTaskDrawer()
  await expect(picker).toHaveValue('CRRT-02')

  // An unavailable case ID falls back explicitly rather than mixing case data.
  await page.goto('/en/baxter-crrt/practice?case=CRRT-NOPE')
  await openTaskDrawer()
  await expect(
    page.getByRole('status', { name: 'Requested practice case unavailable' }),
  ).toBeVisible()
  await expect(picker).toHaveValue('CRRT-01')
  await expect(caseTitle).toBeVisible()

  // Selecting an additional case updates the shareable URL with it.
  await page.goto('/en/baxter-crrt/practice?case=CRRT-11')
  await page.getByRole('group', { name: 'Advance simulated time' }).waitFor()
  await openTaskDrawer()
  await page.getByText(/Additional cases \(\d+\)/).click()
  const optional = page.getByRole('button', { name: /Station \d · / }).first()
  const optionalName = (await optional.textContent()) ?? ''
  await optional.click()
  await expect(page).toHaveURL(/\?case=CRRT-\d\d$/)
  await expect(page.getByRole('option', { name: /^Optional · / })).toHaveCount(1)
  expect(optionalName.length).toBeGreaterThan(0)

  // A role change is presentational and must not discard the run.
  await page.goto('/en/baxter-crrt/practice?case=CRRT-11')
  const clock = page.getByRole('group', { name: 'Advance simulated time' })
  await page
    .getByRole('article')
    .filter({ has: page.getByText('Complete the initial clinical assessment', { exact: true }) })
    .getByRole('button')
    .click()
  await page.getByRole('button', { name: '+1 hr', exact: true }).click()
  await expect(clock).toContainText('60 min')
  const completedBefore = await page.getByRole('button', { name: 'Completed', exact: true }).count()

  await page.getByRole('button', { name: 'Operator', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Operator', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(clock).toContainText('60 min')
  await expect(page.getByRole('button', { name: 'Completed', exact: true })).toHaveCount(
    completedBefore,
  )

  await page.getByRole('button', { name: 'Prescriber', exact: true }).click()
  await expect(clock).toContainText('60 min')
  await expect(page.getByRole('button', { name: 'Completed', exact: true })).toHaveCount(
    completedBefore,
  )
  const reassessment = page.getByRole('group', {
    name: 'Select every reassessment you actually completed',
  })
  await reassessment.getByRole('checkbox').first().check()
  await page.getByRole('button', { name: 'Commit reassessment', exact: true }).click()
  const progressBeforeQuery = await assertUngraded(page)
  await page.evaluate(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('review', 'unrelated-query')
    window.history.pushState(null, '', url)
  })
  await expect(page).toHaveURL(/case=CRRT-11&review=unrelated-query/)
  await expect(clock).toContainText('60 min')
  await expect(page.getByRole('button', { name: 'Completed', exact: true })).toHaveCount(
    completedBefore,
  )
  await expect(page.getByText('Reassessment recorded for this run.', { exact: true })).toBeVisible()
  expect((await assertUngraded(page)).selfPaced.visitedCaseIds).toEqual(
    progressBeforeQuery.selfPaced.visitedCaseIds,
  )
  await page.getByRole('button', { name: 'Integrated', exact: true }).click()
  await expect(clock).toContainText('60 min')
  await expect(page.getByText('Reassessment recorded for this run.', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('case-identity-role-desktop.png'), fullPage: true })

  await assertUngraded(page)
  expect(errors).toEqual([])
})

test('the debrief separates the worked example, the actual run and what is not modeled', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/en/baxter-crrt/practice?case=CRRT-13')
  for (const label of [
    'Assess the patient and treatment',
    'Advance to the worsening pattern',
    'Increase BFR through unresolved access resistance',
    'Acknowledge the generic training alert',
    'Declare resolution after acknowledgement alone',
  ]) {
    await page
      .getByRole('article')
      .filter({ has: page.getByText(label, { exact: true }) })
      .getByRole('button')
      .first()
      .click()
  }
  await page.getByRole('button', { name: '+1 hr', exact: true }).click()
  await page.getByRole('tab', { name: 'Debrief', exact: true }).click()
  await page.getByRole('button', { name: 'End run and review debrief', exact: true }).click()

  await expect(page.getByText(/^Debrief opened · \d+ recorded events? in this run$/)).toBeVisible()
  await expect(page.getByText('Run reviewed', { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Supplied teaching path · worked example' }),
  ).toBeVisible()

  const actual = page.getByRole('heading', { name: 'What you did in this run' }).locator('..')
  await expect(actual).toContainText('Blood flow: set to 180 mL/min')
  await expect(actual).toContainText('Not recorded.')
  await expect(actual).not.toContainText('SET_PRESCRIPTION_VALUE')

  const safety = page.getByRole('heading', { name: 'Safety review of this run' }).locator('..')
  await expect(safety).toContainText('Increase BFR through unresolved access resistance')
  await expect(safety).toContainText('Access-line obstruction')
  await expect(safety).toContainText('does not correct its cause')

  const labs = page.getByRole('heading', { name: 'Laboratory values in this case' }).locator('..')
  await expect(labs).toContainText('Supplied case values at case start')
  await expect(labs).toContainText('Not modeled in this exercise')

  // The sampled-evidence table carries no solute row.
  const table = page.getByRole('region', { name: /Session sampled trends/ })
  await expect(table).toContainText('Delivered dose')
  for (const solute of ['sodium', 'bicarbonate', 'potassium', 'urea marker']) {
    await expect(table.getByRole('rowheader', { name: solute, exact: true })).toHaveCount(0)
  }

  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('debrief-actual-run-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  // The shell clips document overflow, so scrollWidth alone misses an
  // oversized debrief that hides the laboratory boundary and actual history.
  for (const section of [actual, labs]) {
    const bounds = await section.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  }
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('debrief-actual-run-mobile.png'), fullPage: true })
  await page.setViewportSize({ width: 1440, height: 900 })

  await assertUngraded(page)
  expect(errors).toEqual([])
})
