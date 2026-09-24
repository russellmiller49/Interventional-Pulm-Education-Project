import { test, expect, type Page, type TestInfo } from '@playwright/test'

/**
 * CRRT-FELLOW-04 journeys: optional tries that teach, truthful labels, the glossary, visited
 * markers, per-signal pressure comparison, simulated alerts and the single debrief — by keyboard
 * where a learner would use one, and across the batch's viewport and 200% text matrix.
 */

const key = 'baxter-crrt-progress-v3'

async function saved(page: Page) {
  return page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey) ?? '{}'), key)
}
async function assertNothingJudged(page: Page) {
  const record = await saved(page)
  expect(record.attempts ?? {}).toEqual({})
  expect(record.bestSafeScores ?? {}).toEqual({})
  expect(record.learnTaskHistory).toBeUndefined()
  expect(record.completedLessonIds ?? []).toEqual([])
  expect(record.completedPracticeCaseIds ?? []).toEqual([])
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
}
/**
 * Elements of the page content (not the site header) that spill past the window, ignoring
 * anything inside its own horizontal scroll container. At 200% root text the site header itself
 * overflows by about 51 px at 1280 px — a platform item recorded in the Batch-03 handoff.
 */
async function contentOverflow(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('main')!
    return [...root.querySelectorAll('*')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.right <= innerWidth + 1) return false
        for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
          if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return false
        }
        return true
      })
      .map((el) => `${el.tagName}:${(el.textContent ?? '').trim().slice(0, 40)}`)
  })
}
async function hubReady(page: Page) {
  await page.goto('/en/baxter-crrt')
  await expect(page.locator('[data-hydrated="true"]')).toBeVisible()
}
async function keyboardActivate(page: Page, name: string | RegExp) {
  const control = page.getByRole('button', { name, exact: typeof name === 'string' })
  await control.focus()
  await page.keyboard.press('Enter')
}
async function openGoalsCheck(page: Page) {
  await page.goto('/en/baxter-crrt/learn?lesson=crrt-indications-modality')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue without this exercise' }).click()
  await expect(
    page.getByRole('heading', { name: 'Apply: identify goals and constraints' }),
  ).toBeVisible()
}
async function openPressureLab(page: Page) {
  await page.goto('/en/baxter-crrt/learn?lesson=crrt-circuit-pressures')
  for (let step = 0; step < 3; step++)
    await page.getByRole('button', { name: 'Continue without this exercise' }).click()
  await expect(page.getByRole('button', { name: 'Commit prediction' })).toBeVisible()
}
async function developCrrt13Alert(page: Page) {
  await page.goto('/en/baxter-crrt/practice?case=CRRT-13')
  const card = (text: string) =>
    page.getByRole('article').filter({ hasText: text }).getByRole('button').first()
  await card('Assess the patient and treatment').click()
  await card('Advance to the worsening pattern').click()
}

test('hub: orientation, glossary by keyboard, and a visited lesson that is not completed', async ({
  page,
}) => {
  await hubReady(page)
  const orientation = page.getByRole('region', { name: 'Who this is for and how it works' })
  await expect(orientation).toContainText('a recommendation, not a requirement')
  await expect(orientation).toContainText('It is not a record of completion or competence')
  await expect(page.locator('[data-visited-marker]')).toHaveCount(0)

  const trigger = page.getByRole('button', { name: 'Glossary', exact: true })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'CRRT glossary' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Pre-blood-pump (PBP) fluid')
  await expect(dialog).toContainText('no clinician has reviewed them yet')
  await dialog.getByRole('button', { name: 'The two fluid ledgers' }).click()
  const ledgers = dialog.getByRole('heading', { name: 'The two fluid ledgers' })
  await expect(ledgers).toBeFocused()
  await expect(ledgers).toBeInViewport()
  await expect(dialog.getByRole('region', { name: 'The two fluid ledgers' })).toContainText(
    'Whole-patient fluid balance',
  )
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()

  await page.goto('/en/baxter-crrt/learn?lesson=crrt-indications-modality')
  await expect(
    page.getByRole('heading', { name: 'Two treatment goals, one blood circuit' }),
  ).toBeVisible()
  await hubReady(page)
  const sequence = page.locator('[data-crrt-learn-sequence]')
  await expect(sequence.locator('[data-visited="true"]')).toHaveCount(1)
  await expect(sequence.locator('[data-visited="true"]')).toContainText('Visited')
  await assertNothingJudged(page)
})

test('Learn optional try: worked explanation first, then a miss that names the accepted answer, retry and continue', async ({
  page,
}) => {
  await openGoalsCheck(page)
  await keyboardActivate(page, 'Show worked explanation')
  const worked = page.locator('[data-crrt-worked-explanation]')
  await expect(worked).toContainText('Accepted answer:')
  await expect(worked).toContainText('Not accepted:')
  await keyboardActivate(page, 'Hide worked explanation')

  const wrong = page.getByRole('radio', { name: /Fluid removal alone/ })
  await wrong.focus()
  await page.keyboard.press('Space')
  await keyboardActivate(page, 'Check reasoning')
  const feedback = page
    .getByRole('status')
    .filter({ hasText: 'Your choice is not the accepted answer' })
  await expect(feedback).toContainText('You chose: Fluid removal alone')
  await expect(feedback.locator('[data-crrt-accepted-answers]')).toContainText(
    'Solute/acid-base support and fluid management',
  )
  await keyboardActivate(page, 'Try again')
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
  await page.getByRole('radio', { name: /Solute\/acid-base support and fluid management/ }).check()
  await page.getByRole('button', { name: 'Check reasoning' }).click()
  await expect(page.getByRole('status')).toContainText('Your choice matches the accepted answer')
  await keyboardActivate(page, 'Review feedback and continue')
  await expect(
    page.getByRole('heading', { name: 'Apply again: a different fluid goal' }),
  ).toBeVisible()
  await assertNothingJudged(page)
})

test('pressure lab: each of the six predictions is compared in words, with its own arithmetic', async ({
  page,
}) => {
  await openPressureLab(page)
  for (const signal of [
    'Access pressure',
    'Filter pressure',
    'Return pressure',
    'Effluent pressure',
    'TMP',
    'Filter pressure drop',
  ]) {
    const choice =
      signal === 'Filter pressure' ||
      signal === 'Return pressure' ||
      signal === 'Filter pressure drop'
        ? 'Higher'
        : 'Unchanged'
    // The styled label covers its radio, so select the way a pointer does: on the label.
    await page
      .getByRole('group', { name: signal, exact: true })
      .getByRole('radio', { name: choice, exact: true })
      .locator('..')
      .click()
  }
  await page.getByRole('button', { name: 'Commit prediction' }).click()
  await page.getByRole('button', { name: 'Reveal pressure pattern' }).click()
  const why = page.getByRole('region', { name: 'Why each signal moved' })
  await expect(why.locator('li[data-comparison]')).toHaveCount(6)
  const tmp = why.locator('[data-crrt-pressure-signal="tmp"]')
  await expect(tmp).toContainText('You predicted unchanged; observed higher.')
  await expect(tmp).toContainText('Does not match')
  await expect(tmp).toContainText('TMP therefore rose from 37 to 57 mmHg')
  await expect(why.locator('[data-crrt-pressure-signal="filter-drop"]')).toContainText(
    'drop stayed at 5 mmHg',
  )
  // No total: "Task 4 of 6" in the lesson chrome is a position, so look inside the lab only.
  const lab = page.getByRole('region', { name: 'Pressure Localization Lab' })
  await expect(lab.getByText(/\d+\s*(of|\/)\s*6\b|\bscore\b|\bcorrect\b/i)).toHaveCount(0)
  await assertNothingJudged(page)
})

test('Practice: reuse label, a simulated alert that is not a PrisMax alarm, drills and one debrief', async ({
  page,
}) => {
  await developCrrt13Alert(page)
  await expect(page.locator('[data-crrt-case-reuse]')).toContainText(
    'Lesson 5 (tasks 5–9) walked through a guided version of this case.',
  )
  await expect(page.getByText('Simulated access-obstruction alert').first()).toBeAttached()
  await expect(page.getByText(/ACCESS_OBSTRUCTION/)).toHaveCount(0)
  await expect(page.getByText(/Priority:\s*none shown/).first()).toBeAttached()

  // A drill: the worked example is available before any choice; reset says what it clears.
  await keyboardActivate(page, 'Show worked safety example')
  await expect(page.getByRole('heading', { name: 'Worked safety example' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset this drill' })).toHaveAccessibleDescription(
    /for this drill only/,
  )

  const debriefTab = page.getByRole('tab', { name: 'Debrief', exact: true })
  if (await debriefTab.isVisible()) await debriefTab.click()
  await page.getByRole('button', { name: 'End run and review debrief' }).click()
  await expect(page.getByRole('heading', { name: 'What you did in this run' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Causal debrief' })).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Your clinical model' })).toHaveCount(0)
  await expect(page.getByText(/intervention performed|debrief revealed/)).toHaveCount(0)
  await assertNothingJudged(page)
})

const matrix = [
  { width: 1440, height: 900 },
  { width: 1280, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
  { width: 1280, height: 900, text200: true },
] as const

for (const v of matrix) {
  const label = `${v.width}x${v.height}${'text200' in v ? '-text200' : ''}`
  test(`matrix ${label}: Batch-04 surfaces reflow without sideways scrolling`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: v.width, height: v.height })
    const enlarge = async () => {
      if ('text200' in v) await page.addStyleTag({ content: 'html { font-size:32px !important; }' })
    }
    const shot = async (name: string, info: TestInfo) => {
      expect(await contentOverflow(page)).toEqual([])
      if (!('text200' in v)) await noOverflow(page)
      const documentOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      )
      console.log(`[matrix] ${label} ${name}: document overflow ${documentOverflow} px`)
      await page.screenshot({ path: info.outputPath(`${label}-${name}.png`) })
    }

    await hubReady(page)
    await enlarge()
    await page
      .getByRole('region', { name: 'Who this is for and how it works' })
      .scrollIntoViewIfNeeded()
    await shot('hub-orientation', info)
    await page.getByRole('button', { name: 'Glossary', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'CRRT glossary' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(v.width + 1)
    await shot('glossary', info)
    await page.keyboard.press('Escape')

    await openGoalsCheck(page)
    await enlarge()
    await page.getByRole('radio', { name: /Fluid removal alone/ }).check()
    await page.getByRole('button', { name: 'Check reasoning' }).click()
    await page.getByRole('status').filter({ hasText: 'Your choice' }).scrollIntoViewIfNeeded()
    await shot('learn-feedback', info)

    await openPressureLab(page)
    await enlarge()
    await page.getByRole('button', { name: 'Show explanation', exact: true }).click()
    await page.getByRole('region', { name: 'Why each signal moved' }).scrollIntoViewIfNeeded()
    await shot('pressure-comparison', info)

    await developCrrt13Alert(page)
    await enlarge()
    await page.locator('[data-crrt-case-reuse]').scrollIntoViewIfNeeded()
    await shot('practice-reuse-and-actions', info)
    await page.getByRole('button', { name: 'Show worked safety example' }).click()
    await page.getByRole('heading', { name: 'Worked safety example' }).scrollIntoViewIfNeeded()
    await shot('drill-worked-example', info)
    const debriefTab = page.getByRole('tab', { name: 'Debrief', exact: true })
    if (await debriefTab.isVisible()) await debriefTab.click()
    await page.getByRole('button', { name: 'End run and review debrief' }).click()
    await page.getByRole('heading', { name: 'What you did in this run' }).scrollIntoViewIfNeeded()
    await shot('debrief', info)
    await assertNothingJudged(page)
  })
}
