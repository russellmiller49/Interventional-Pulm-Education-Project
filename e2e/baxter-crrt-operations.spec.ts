import { test, expect, type Page, type Locator, type TestInfo } from '@playwright/test'

const base = '/en/baxter-crrt/learn?lesson='
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('baxter-crrt-progress-v3') || '{}'))
const keyboardPages = new WeakSet<Page>()
const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name, exact: typeof name === 'string' })
async function reach(page: Page, target: Locator) {
  for (let n = 0; n < 220; n++) {
    if (await target.evaluate((el) => el === document.activeElement)) return
    if (
      await target.evaluate(
        (el) =>
          el instanceof HTMLInputElement &&
          el.type === 'radio' &&
          document.activeElement instanceof HTMLInputElement &&
          document.activeElement.type === 'radio' &&
          el.name === document.activeElement.name,
      )
    )
      await page.keyboard.press('ArrowRight')
    else await page.keyboard.press('Tab')
  }
  throw new Error('Target could not be reached with native keyboard navigation')
}
async function activate(page: Page, target: Locator) {
  if (!keyboardPages.has(page))
    return (await target.getAttribute('type')) === 'radio'
      ? target.locator('..').click()
      : target.click()
  await reach(page, target)
  await page.keyboard.press((await target.getAttribute('type')) === 'radio' ? 'Space' : 'Enter')
}
const click = (page: Page, name: string | RegExp) => activate(page, button(page, name))
async function fill(page: Page, target: Locator, value: string) {
  if (!keyboardPages.has(page)) return target.fill(value)
  await reach(page, target)
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('Backspace')
  if (value) await page.keyboard.type(value)
}
const observations = (page: Page) => click(page, 'Review observations and continue')
const review = (page: Page) => click(page, 'Review feedback and continue')
async function answer(page: Page, name: RegExp) {
  await activate(page, page.getByRole('radio', { name }))
  await click(page, 'Check reasoning')
}
async function capture(page: Page, info: TestInfo, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true })
}
async function hardware(page: Page) {
  for (const name of [
    'Solution pump deck',
    'Syringe-pump position',
    'Pressure and safety-monitoring area',
    'Fluid scales and bag positions',
  ])
    await click(page, `Explore ${name}`)
  for (const name of [
    'Dialysate',
    'Pre-filter replacement',
    'Post-filter replacement',
    'PBP',
    'Effluent',
  ])
    await click(page, name)
  await observations(page)
}
async function setup(page: Page, info?: TestInfo) {
  await expect(button(page, 'Review observations and continue')).toBeDisabled()
  await click(page, /^New Patient/)
  await click(page, 'Confirm teaching reference')
  await click(page, /^CVVHD Diffusive/)
  await click(page, 'Continue with CVVHD workflow')
  const blood = page.getByRole('spinbutton', { name: /^Blood flow/ })
  const dialysate = page.getByRole('spinbutton', { name: /^Dialysate flow/ })
  const removal = page.getByRole('spinbutton', { name: /^Patient fluid removal/ })
  await expect(dialysate).toBeDisabled()
  await expect(button(page, 'Review and apply case values')).toBeDisabled()
  await fill(page, blood, '120')
  await fill(page, dialysate, '1800')
  await fill(page, removal, '100')
  await fill(page, blood, '')
  await expect(dialysate).toHaveValue('')
  await expect(removal).toHaveValue('')
  await expect(button(page, 'Review and apply case values')).toBeDisabled()
  if (info) await capture(page, info, '02-invalid-setup')
  await fill(page, blood, '120')
  await fill(page, dialysate, '1800')
  await fill(page, removal, '100')
  await expect(page.getByText('Applied blood flow', { exact: true }).locator('..')).toContainText(
    'Unavailable',
  )
  await click(page, 'Review and apply case values')
  await expect(page.getByText('Applied blood flow', { exact: true }).locator('..')).toContainText(
    '120 mL/min',
  )
  for (const name of [
    'Confirm training set path',
    'Confirm bag and scale positions',
    'Start prime sequence check',
    'Complete prime verification',
    'Confirm review',
    'Confirm simulated line path',
    'Start interface run',
  ])
    await click(page, name)
  await expect(page.getByText('Recorded effluent', { exact: true }).locator('..')).toContainText(
    '0 mL',
  )
  await observations(page)
}

for (const compact of [false, true]) {
  test(`Batch B two-lesson journey: ${compact ? 'compact keyboard and reduced motion' : 'desktop pointer'}`, async ({
    page,
  }, info) => {
    if (compact) {
      keyboardPages.add(page)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
    }
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`${base}crrt-alarms-troubleshooting`)
    await expect(
      page.getByRole('heading', { name: 'From the circuit to the machine' }),
    ).toBeVisible()
    await expect(page.getByRole('radio')).toHaveCount(0)
    await capture(page, info, '01-hardware-orientation')
    await hardware(page)
    await setup(page, info)
    await click(page, 'Record 15 minutes')
    await expect(page.getByText('Recorded effluent', { exact: true }).locator('..')).toContainText(
      '475 mL',
    )
    await expect(
      page.getByRole('region', { name: 'Canonical CRRT circuit', exact: true }),
    ).toContainText('Circuit state: running')
    await capture(page, info, '03-normal-profile-circuit')
    await observations(page)
    await answer(page, /The current effluent setting alone/)
    expect((await saved(page)).completedLessonIds).not.toContain('crrt-alarms-troubleshooting')
    await review(page)
    await expect(page.locator('[data-run-id="access"]')).toContainText('clock 0h 00m')
    await click(page, 'Review patient and device assessment')
    await click(page, 'Advance to the 30-minute event')
    await expect(page.getByRole('region', { name: 'Alert and cause record' })).toContainText(
      'not acknowledged',
    )
    await capture(page, info, '04-alert-arrival')
    await observations(page)
    await answer(page, /Increase blood flow immediately/)
    await expect(page.getByRole('status')).toContainText('Do not use a higher blood-flow setting')
    await review(page)
    await click(page, 'Acknowledge the access alert')
    await expect(page.getByRole('region', { name: 'Alert and cause record' })).toContainText(
      'active cause · acknowledged',
    )
    await expect(page.getByText('Modeled pumps', { exact: true }).locator('..')).toContainText(
      'Blood: on · Fluid: on',
    )
    await click(page, 'Inspect the modeled access path')
    await click(page, 'Pause this case')
    await click(page, 'Record 10 minutes paused')
    await expect(page.getByText('Modeled pumps', { exact: true }).locator('..')).toContainText(
      'Blood: off · Fluid: off',
    )
    await expect(button(page, 'Review observations and continue')).toBeDisabled()
    await capture(page, info, '05-paused-delivery')
    await click(page, 'Apply the case access-position correction')
    await expect(page.getByRole('region', { name: 'Alert and cause record' })).toContainText(
      'cause resolved',
    )
    await observations(page)
    await answer(page, /Use the permitted case resume action/)
    await review(page)
    for (const name of [
      'Resume this corrected case',
      'Record 10 minutes after resumption',
      'Review restored delivery in this case',
    ])
      await click(page, name)
    await expect(
      page.getByText('Recorded charting window / downtime', { exact: true }).locator('..'),
    ).toContainText('0h 50m / 0h 10m')
    await capture(page, info, '06-resumed-verification')
    await observations(page)
    await answer(page, /Delivery has not been demonstrated/)
    expect((await saved(page)).completedLessonIds).not.toContain('crrt-alarms-troubleshooting')
    await review(page)
    expect((await saved(page)).selfPaced.visitedLessonIds).toContain('crrt-alarms-troubleshooting')
    // The stable intervening citrate lesson is Batch C; choose only the authorized fluid lesson.
    await page.goto(`${base}crrt-fluid-liberation`)
    await click(page, 'Continue')
    for (let h = 1; h <= 4; h++) await click(page, `Record to ${h} hours`)
    await capture(page, info, '07-common-interval-record')
    await observations(page)
    const input = page.getByRole('textbox', { name: 'Signed whole-patient balance (mL)' })
    await expect(button(page, 'Check recorded balance')).toBeDisabled()
    await fill(page, input, 'Infinity')
    await expect(button(page, 'Check recorded balance')).toBeDisabled()
    await fill(page, input, '')
    await expect(button(page, 'Check recorded balance')).toBeDisabled()
    await expect(page.getByText('Recorded balance:', { exact: false })).toHaveCount(0)
    await capture(page, info, '08-blank-balance-no-answer')
    await fill(page, input, compact ? '300' : '400')
    await click(page, 'Check recorded balance')
    await expect(page.getByRole('status')).toContainText('Recorded balance: 300 mL')
    expect((await saved(page)).completedLessonIds).not.toContain('crrt-fluid-liberation')
    await capture(page, info, '09-balance-feedback')
    await review(page)
    await expect(page.getByText('Not recorded in this chart', { exact: true })).toBeVisible()
    await expect(page.getByText('Urine output', { exact: true }).locator('..')).not.toContainText(
      '80 mL',
    )
    await answer(page, /Report that exact balance is unavailable/)
    await review(page)
    await expect(page.locator('[data-run-id="fluid"]')).toContainText('clock 0h 00m')
    for (const name of [
      'Review patient tolerance',
      'Review external intake and output',
      'Apply the case net-removal adjustment',
    ])
      await click(page, name)
    const compare = page.getByRole('region', { name: 'Immediate and subsequent response' })
    await expect(compare).toContainText('Immediately applied · 0h 00m')
    if (compact) {
      const scroll = page.getByRole('region', {
        name: 'Net-removal comparison; scroll horizontally if needed',
      })
      await reach(page, scroll)
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
    }
    await capture(page, info, '10-immediate-net-change')
    await observations(page)
    await click(page, 'Record 30 minutes')
    await expect(compare).toContainText('After observation · 0h 30m')
    await capture(page, info, '11-delayed-fluid-observation')
    await observations(page)
    await answer(page, /Reassess net removal and all patient inputs/)
    await review(page)
    await click(page, 'Continue')
    await answer(page, /Reassess the original indication, native function/)
    await review(page)
    const history = await saved(page)
    expect(history.selfPaced.visitedLessonIds).toEqual(
      expect.arrayContaining(['crrt-alarms-troubleshooting', 'crrt-fluid-liberation']),
    )
    expect(history.completedLessonIds).not.toContain('crrt-anticoagulation')
    expect(history.bestSafeScores).toEqual({})
    expect(history.learnTaskHistory).toBeUndefined()
    expect(history.completedLessonIds).toEqual([])
    expect(errors).toEqual([])
    await capture(page, info, '12-completed-two-lessons')
  })
}

test('Batch B history and restart retain old work while replacing the whole incomplete run', async ({
  page,
}, info) => {
  await page.goto(`${base}crrt-alarms-troubleshooting`)
  await hardware(page)
  await setup(page)
  await click(page, 'Record 15 minutes')
  await observations(page)
  await answer(page, /Compare actual accumulated effluent/)
  const old = (await saved(page)).learnTaskHistory
  await page.getByRole('combobox', { name: 'CRRT lesson' }).selectOption('crrt-fluid-liberation')
  await click(page, 'Continue')
  await click(page, 'Record to 1 hours')
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'From the circuit to the machine' })).toBeVisible()
  await page.goForward()
  await expect(
    page.getByRole('heading', { name: 'One charting interval for all fluid' }),
  ).toBeVisible()
  await click(page, 'Continue')
  await expect(page.locator('[data-run-id="delivery"]')).toContainText('clock 0h 00m')
  await click(page, 'Record to 1 hours')
  await page.reload()
  await click(page, 'Continue')
  await expect(page.locator('[data-run-id="delivery"]')).toContainText('clock 0h 00m')
  await click(page, 'Record to 1 hours')
  await click(page, 'Restart lesson')
  await click(page, 'Continue')
  await expect(page.locator('[data-run-id="delivery"]')).toContainText('clock 0h 00m')
  expect((await saved(page)).learnTaskHistory).toEqual(old)
  for (const width of [1280, 1024, 900, 720, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await capture(page, info, `history-timeline-${width}`)
  }
})

test('Practice and Assess retain their original entry surfaces and do not award results on visit', async ({
  page,
}, info) => {
  await page.goto('/en/baxter-crrt/practice?case=CRRT-13')
  await expect(page.getByRole('button', { name: 'Explain this case', exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'Localize and correct a worsening access-pressure pattern',
      exact: true,
      level: 1,
    }),
  ).toBeVisible()
  await capture(page, info, 'practice-reference-1440')
  await page.getByRole('tab', { name: 'Machine + circuit' }).click()
  await expect(
    page.getByRole('heading', { name: 'What the model is reporting right now' }),
  ).toBeVisible()
  await capture(page, info, 'practice-device-reference-1440')
  await page.goto('/en/baxter-crrt/assess')
  await expect(page.getByRole('button', { name: 'Explain this case', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reveal hint 1', exact: true })).toBeEnabled()
  await capture(page, info, 'assess-reference-1440')
  await page.setViewportSize({ width: 390, height: 844 })
  await capture(page, info, 'assess-reference-390')
  expect((await saved(page)).bestSafeScores ?? {}).toEqual({})
  expect((await saved(page)).completedLessonIds ?? []).toEqual([])
})
