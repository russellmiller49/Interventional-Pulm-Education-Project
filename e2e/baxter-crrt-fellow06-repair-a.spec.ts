import { test, expect, type Locator, type Page } from '@playwright/test'

/**
 * CRRT-FELLOW-06 repair A: browser journeys for F06-R01 (CRRT-03/04 laboratory-trend promises),
 * F06-R02 (worked teaching narrated as a completed run) and F06-R03 (CRRT-08/09 preconnection
 * and paused chronology beside a running fixture). Each journey reads the introduction, the
 * current task, an action response, Patient & trends and the debrief.
 */

const key = 'baxter-crrt-progress-v3'
const ASSESS = 'Complete the initial clinical assessment'
const WORKED_TEACHING = 'Worked teaching for this case · not a record of this run'

const laboratoryTrendPromise =
  /serial (solute|simulated) trend|trend (is|are) visible|trend changes|later (laboratory|solute)|laboratory trends\b|drives the later/i
const completedRunLanguage =
  /showed whether|plan is recorded|recorded in the case timeline|team receives|remains paused|framed the goal/i
const falseChronology =
  /Before connection,|Before treatment starts|remains paused|setup paused|before simulated connection/i

async function assertUngraded(page: Page) {
  const saved = await page.evaluate(
    (storageKey) => JSON.parse(localStorage.getItem(storageKey) ?? '{}'),
    key,
  )
  expect(saved.attempts ?? {}).toEqual({})
  expect(saved.bestSafeScores ?? {}).toEqual({})
  expect(saved.completedPracticeCaseIds ?? []).toEqual([])
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
}

const card = (page: Page, label: string) =>
  page.getByRole('article').filter({ has: page.getByText(label, { exact: true }) })

const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true })

const sectionOf = (page: Page, heading: string | RegExp) =>
  page.getByRole('heading', { name: heading }).locator('..')

/** Perform a case action from the keyboard and return its card. */
async function performByKeyboard(page: Page, label: string): Promise<Locator> {
  const button = card(page, label).getByRole('button').first()
  await button.focus()
  await expect(button).toBeFocused()
  await page.keyboard.press('Enter')
  return card(page, label)
}

async function openDebrief(page: Page) {
  await tab(page, 'Debrief').click()
  await page.getByRole('button', { name: 'End run and review debrief', exact: true }).click()
}

async function bloodFlowThroughCircuit(page: Page) {
  return page
    .locator('[aria-label="Pilot flow displays"]')
    .locator('div')
    .filter({ has: page.getByText('BFR through circuit', { exact: true }) })
    .locator('strong')
}

test('CRRT-03 plans a trajectory from delivery evidence and names the missing measurements', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/en/baxter-crrt/practice?case=CRRT-03')

  // Introduction and current task state the evidence boundary before any action.
  const main = page.locator('#main-content')
  await expect(main).toContainText('it carries no serial solute measurements')
  const task = page.getByLabel('Current task and case evidence')
  await expect(task).toContainText('serial solute measurements are not')
  await expect(main).not.toContainText(laboratoryTrendPromise)

  await page.getByRole('button', { name: 'Explain this case', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Worked example', exact: true })).toContainText(
    'Serial clinical measurements, which this case does not supply',
  )

  const coordinate = 'Pause and coordinate the intended trajectory before changing the prescription'
  await performByKeyboard(page, ASSESS)
  const response = await performByKeyboard(page, coordinate)
  await expect(response).toContainText('No solute series appears, because this case carries none')

  await page.getByRole('button', { name: '+1 hr', exact: true }).click()
  await page.getByRole('button', { name: '+1 hr', exact: true }).click()
  await tab(page, 'Patient & trends').click()
  const patient = sectionOf(page, 'Patient and delivered-therapy state')
  await expect(patient).toContainText('Delivered dose')
  await expect(patient).toContainText('Downtime')
  await expect(patient).not.toContainText(/potassium|urea|bicarbonate|creatinine/i)

  await openDebrief(page)
  await expect(sectionOf(page, 'What you did in this run')).toContainText(coordinate)
  const teaching = sectionOf(page, WORKED_TEACHING)
  await expect(teaching).toContainText('This case cannot show a solute trajectory')
  await expect(teaching).not.toContainText(laboratoryTrendPromise)
  await expect(sectionOf(page, 'Laboratory values in this case')).toContainText('Not modeled')
  await expect(sectionOf(page, 'Action teaching notes from this run')).not.toContainText(
    laboratoryTrendPromise,
  )

  await noOverflow(page)
  await assertUngraded(page)
  await page.screenshot({ path: info.outputPath('crrt03-debrief.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('CRRT-04 describes delivery and downtime without promising laboratory trends', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/en/baxter-crrt/practice?case=CRRT-04')

  const main = page.locator('#main-content')
  await expect(main).toContainText(
    'compare prescribed with delivered therapy after an interruption',
  )
  await expect(page.getByLabel('Current task and case evidence')).toContainText(
    'A treatment interruption will separate prescribed from delivered therapy.',
  )
  await expect(main).not.toContainText(laboratoryTrendPromise)

  const observe = card(page, 'Observe six hours of treatment')
  await expect(observe).toContainText('Laboratory values are not modeled over time.')
  await expect(
    card(page, 'Reassess delivered dose and downtime, and name the laboratory values to recheck'),
  ).toBeVisible()

  // The machine still owns the start: the case card stays unavailable before prime and review.
  await performByKeyboard(page, 'Define the solute and acid-base treatment goal')
  await expect(card(page, 'Start after review').getByRole('button').first()).toBeDisabled()
  await tab(page, 'Machine + circuit').click()
  await expect(page.getByText('Interface run active', { exact: true })).toHaveCount(0)

  await tab(page, 'Patient & trends').click()
  await expect(sectionOf(page, 'Patient and delivered-therapy state')).not.toContainText(
    /potassium|urea|bicarbonate/i,
  )

  await openDebrief(page)
  const teaching = sectionOf(page, WORKED_TEACHING)
  await expect(teaching).toContainText(
    'Review prescribed dose, delivered dose, downtime, and actual effluent.',
  )
  await expect(teaching).toContainText('needs serial clinical measurements')
  await expect(teaching).not.toContainText(laboratoryTrendPromise)
  await expect(sectionOf(page, 'Laboratory values in this case')).toContainText('Not modeled')

  await noOverflow(page)
  await assertUngraded(page)
  await page.screenshot({ path: info.outputPath('crrt04-debrief.png'), fullPage: true })
  expect(errors).toEqual([])
})

for (const journey of [
  {
    id: 'CRRT-08',
    intro: 'The machine shown alongside is an already-running demonstration',
    action: 'Stop the sequence, identify the mismatched domain, and complete an independent check',
    response: 'Nothing is stopped or paused: the running demonstration continues unchanged',
    teaching: 'This exercise does not model that hold',
  },
  {
    id: 'CRRT-09',
    intro: 'beside an already-running demonstration treatment',
    action: 'Verify protocol identity, applicability, responsible oversight, and independent check',
    response: 'the demonstration treatment keeps running as it was',
    teaching: 'Protocol verification is a record in this exercise, not a device state',
  },
] as const) {
  test(`${journey.id} narrative agrees with its running machine`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`/en/baxter-crrt/practice?case=${journey.id}`)

    const main = page.locator('#main-content')
    await expect(main).toContainText(journey.intro)
    await expect(page.getByLabel('Current task and case evidence')).toContainText('already running')
    await expect(main).not.toContainText(falseChronology)

    // The fixture is delivering from the first second, as the narrative now says.
    await tab(page, 'Machine + circuit').click()
    await expect(page.getByText('Interface run active', { exact: true })).toBeVisible()
    await expect(page.getByText('Pumps active', { exact: true })).toBeVisible()
    await expect(await bloodFlowThroughCircuit(page)).toHaveText('150 mL/min')

    await tab(page, 'Case').click()
    await performByKeyboard(page, ASSESS)
    const response = await performByKeyboard(page, journey.action)
    await expect(response).toContainText(journey.response)
    await expect(response).not.toContainText(falseChronology)

    await page.getByRole('button', { name: '+1 hr', exact: true }).click()
    await page.getByRole('button', { name: '+1 hr', exact: true }).click()
    await tab(page, 'Machine + circuit').click()
    await expect(page.getByText('Interface run active', { exact: true })).toBeVisible()
    await expect(await bloodFlowThroughCircuit(page)).toHaveText('150 mL/min')
    await page.screenshot({ path: info.outputPath(`${journey.id}-running.png`) })

    await tab(page, 'Patient & trends').click()
    const patient = sectionOf(page, 'Patient and delivered-therapy state')
    await expect(patient).toContainText('Delivered dose')
    await expect(patient.locator('div').filter({ hasText: /^Downtime/ })).toContainText('0 min')

    await openDebrief(page)
    const actual = sectionOf(page, 'What you did in this run')
    await expect(actual).toContainText(journey.action)
    await expect(actual).toContainText('150 mL/min')
    const teaching = sectionOf(page, WORKED_TEACHING)
    await expect(teaching).toContainText(journey.teaching)
    await expect(teaching).not.toContainText(falseChronology)

    await noOverflow(page)
    await assertUngraded(page)
    await page.screenshot({ path: info.outputPath(`${journey.id}-debrief.png`), fullPage: true })
    expect(errors).toEqual([])
  })
}

test('CRRT-17 no-action debrief reports no escalation, reassessment or result', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/en/baxter-crrt/practice?case=CRRT-17')
  await openDebrief(page)

  await expect(page.getByText('Debrief opened · no run performed', { exact: true })).toBeVisible()
  const actual = sectionOf(page, 'What you did in this run')
  await expect(actual).toContainText('Not recorded. The recommended reassessment below')
  await expect(
    page.getByRole('heading', { name: 'Action teaching notes from this run' }),
  ).toHaveCount(0)

  const heading = page.getByRole('heading', { name: WORKED_TEACHING })
  await expect(heading).toBeVisible()
  const teaching = sectionOf(page, WORKED_TEACHING)
  await expect(teaching).toContainText('do not report an action, a reassessment, or a result')
  await expect(teaching).toContainText('An escalation would give the responsible team')
  await expect(teaching).toContainText('cannot show a calcium trend')
  await expect(teaching).not.toContainText(completedRunLanguage)
  await expect(page.locator('#main-content')).not.toContainText(
    /escalation and reassessment plan is recorded|responsible team receives/i,
  )

  await noOverflow(page)
  await assertUngraded(page)
  await teaching.screenshot({ path: info.outputPath('crrt17-worked-teaching.png') })
  await page.screenshot({ path: info.outputPath('crrt17-no-action-debrief.png'), fullPage: true })
  expect(errors).toEqual([])
})

for (const id of ['CRRT-01', 'CRRT-02', 'CRRT-06', 'CRRT-07', 'CRRT-11'] as const) {
  test(`${id} no-action debrief keeps its reassessment step prospective`, async ({ page }) => {
    await page.goto(`/en/baxter-crrt/practice?case=${id}`)
    await openDebrief(page)
    await expect(page.getByText('Debrief opened · no run performed', { exact: true })).toBeVisible()
    const teaching = sectionOf(page, WORKED_TEACHING)
    await expect(teaching).toContainText('would show whether the intended response occurred')
    await expect(teaching).not.toContainText(completedRunLanguage)
  })
}

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  for (const id of ['CRRT-03', 'CRRT-08', 'CRRT-17'] as const) {
    test(`${id} changed surfaces fit and stay reachable at 390 px`, async ({ page }, info) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(`/en/baxter-crrt/practice?case=${id}`)
      await noOverflow(page)
      await page.screenshot({ path: info.outputPath(`${id}-intro-390.png`), fullPage: true })

      const debriefTab = tab(page, 'Debrief')
      await debriefTab.focus()
      await page.keyboard.press('Enter')
      const end = page.getByRole('button', { name: 'End run and review debrief', exact: true })
      await end.focus()
      await page.keyboard.press('Enter')

      const heading = page.getByRole('heading', { name: WORKED_TEACHING })
      await heading.scrollIntoViewIfNeeded()
      await expect(heading).toBeVisible()
      const box = await heading.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(391)
      await expect(sectionOf(page, WORKED_TEACHING)).not.toContainText(completedRunLanguage)
      await noOverflow(page)
      await sectionOf(page, WORKED_TEACHING).screenshot({
        path: info.outputPath(`${id}-worked-teaching-390.png`),
      })
      await page.screenshot({ path: info.outputPath(`${id}-debrief-390.png`), fullPage: true })
      expect(errors).toEqual([])
    })
  }
})
