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
async function captureViewport(page: Page, info: TestInfo, name: string, landmark: Locator) {
  await landmark.evaluate((element) =>
    window.scrollTo({
      top: Math.max(0, element.getBoundingClientRect().top + window.scrollY - 90),
      behavior: 'instant',
    }),
  )
  await page.screenshot({ path: info.outputPath(`${name}-viewport.png`) })
}

for (const compact of [false, true]) {
  test(`Batch C complete citrate and integration: ${compact ? 'compact keyboard reduced motion and deferred correction' : 'laptop pointer and coached correction'}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(compact ? { width: 390, height: 844 } : { width: 1280, height: 720 })
    if (compact) {
      keyboardPages.add(page)
      await page.emulateMedia({ reducedMotion: 'reduce' })
    }
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`${base}crrt-anticoagulation`)
    await expect(
      page.getByRole('heading', { name: 'Circuit effect and patient safety', exact: true }),
    ).toBeVisible()
    expect((await saved(page)).learnTaskHistory ?? []).toEqual([])
    await capture(page, info, '01-citrate-orientation')
    await click(page, 'Continue')
    await expect(button(page, 'Review observations and continue')).toBeDisabled()
    const locations = page
      .getByRole('group', { name: 'Citrate path and sampling selection' })
      .getByRole('button')
    for (let i = 0; i < 8; i++) {
      await activate(page, locations.nth(i))
      if ([1, 4, 6, 7].includes(i)) await capture(page, info, `02-citrate-location-${i}`)
    }
    await expect(page.locator('[data-node="systemic-sampling-domain"]')).toHaveAttribute(
      'data-highlighted',
      'true',
    )
    await captureViewport(
      page,
      info,
      '02-systemic-explanation',
      page.locator('[data-support="clinical-publication"]').first(),
    )
    await observations(page)
    await expect(page.getByText(/Obtain correctly identified systemic information/)).toHaveCount(0)
    await answer(page, /Patient calcium is adequate/)
    await expect(page.getByRole('status')).toContainText(
      'A circuit result cannot establish patient calcium safety',
    )
    expect((await saved(page)).completedLessonIds).not.toContain('crrt-anticoagulation')
    await capture(page, info, '03-wrong-first-sample-response')
    await review(page)
    await capture(page, info, '04-calcium-worked-example')
    await click(page, 'Continue')
    const patterns = page
      .getByRole('group', { name: 'Citrate comparison categories' })
      .getByRole('button')
    for (let i = 0; i < 4; i++) {
      await activate(page, patterns.nth(i))
      await capture(page, info, `05-citrate-pattern-${i}`)
    }
    await captureViewport(page, info, '05-pattern-reading', page.locator('[data-category]'))
    await observations(page)
    await answer(page, /Conclude that circuit anticoagulation is insufficient/)
    await expect(page.getByRole('status')).toContainText('could add to the systemic load')
    await review(page)
    await answer(page, /Net alkali excess/)
    await review(page)
    await answer(page, /Assess patient and circuit/)
    await review(page)
    expect((await saved(page)).selfPaced.visitedLessonIds).toContain('crrt-anticoagulation')
    await capture(page, info, '06-citrate-complete')

    await page.goto(`${base}crrt-pressure-profile-integration`)
    await expect(
      page.getByRole('heading', { name: 'Review one new treatment run', exact: true }),
    ).toBeVisible()
    expect(await page.locator('[data-foundation-lesson]').innerHTML()).not.toMatch(
      /return-obstruction|High return pressure versus return disconnection|restriction is verified|reposition-access/,
    )
    await capture(page, info, '07-clean-integrated-case')
    await click(page, 'Review patient and treatment')
    await click(page, 'Record the first 30 minutes')
    expect(await page.locator('[data-foundation-lesson]').innerHTML()).not.toMatch(
      /return-obstruction|restriction is verified|What produces it/,
    )
    await capture(page, info, '08-first-recorded-profile')
    await captureViewport(
      page,
      info,
      '08-profile-reading',
      page.getByRole('region', {
        name: 'Recorded pressure profiles; scroll horizontally if needed',
      }),
    )
    if (compact) {
      const region = page.getByRole('region', {
        name: 'Recorded pressure profiles; scroll horizontally if needed',
      })
      await reach(page, region)
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
      await capture(page, info, '09-keyboard-profile-pan')
    }
    await observations(page)
    await answer(
      page,
      compact
        ? /The return region needs inspection/
        : /Increased return-side resistance is plausible/,
    )
    await review(page)
    await answer(page, /Assess patient safety and inspect return tubing/)
    await review(page)
    await click(page, 'Record the selected circuit inspection')
    await expect(page.getByTestId('integration-state')).toContainText('Delivery: running')
    await click(page, 'Pause modeled delivery')
    await click(page, 'Record 10 minutes paused')
    await capture(page, info, '10-inspection-and-interruption')
    await observations(page)
    await answer(page, /Address the verified mechanical contributor/)
    await review(page)
    await answer(
      page,
      compact
        ? /Keep delivery paused and escalate/
        : /Increase blood flow through the unresolved restriction/,
    )
    await capture(page, info, '11-plan-feedback')
    await review(page)
    if (compact) await click(page, 'Explore paused escalation path')
    if (!compact) {
      await click(page, 'Explore correction path')
      await click(page, 'Apply the verified case correction')
      await expect(page.getByTestId('integration-state')).toContainText('Delivery: paused')
      await capture(page, info, '12-corrected-before-resume')
      await click(page, 'Resume this corrected simulation')
    } else await expect(button(page, 'Apply the verified case correction')).toHaveCount(0)
    await click(page, 'Record to 1 hour')
    await capture(page, info, '13-subsequent-observation')
    await observations(page)
    const numeric = page.getByRole('textbox', { name: 'Signed whole-patient balance (mL)' })
    await expect(button(page, 'Check recorded balance')).toBeDisabled()
    await fill(page, numeric, 'Infinity')
    await expect(button(page, 'Check recorded balance')).toBeDisabled()
    await fill(page, numeric, '')
    await expect(page.getByText(/Recorded balance:/)).toHaveCount(0)
    await capture(page, info, '14-blank-recorded-balance')
    await captureViewport(
      page,
      info,
      '14-balance-entry',
      page.getByRole('region', { name: 'Recorded balance calculation' }),
    )
    await fill(page, numeric, compact ? '150' : '133.3')
    await click(page, 'Check recorded balance')
    await expect(page.getByRole('status')).toContainText(compact ? '150 mL' : '133.3 mL')
    expect((await saved(page)).completedLessonIds).not.toContain(
      'crrt-pressure-profile-integration',
    )
    await review(page)
    if (!compact) await click(page, 'Record reassessment of this run')
    await capture(page, info, '15-reassessment')
    await answer(page, /Report regional findings, actions/)
    await review(page)
    await expect(
      page.getByRole('region', { name: 'Current run and recorded observations' }),
    ).toHaveCount(0)
    await answer(page, /Retain the reported effluent total/)
    await review(page)
    const progress = await saved(page)
    expect(progress.selfPaced.visitedLessonIds).toEqual(
      expect.arrayContaining(['crrt-anticoagulation', 'crrt-pressure-profile-integration']),
    )
    expect(progress.bestSafeScores).toEqual({})
    expect(progress.completedPracticeCaseIds).toEqual([])
    expect(progress.completedMasteryCapstoneIds).toEqual([])
    expect(progress.learnTaskHistory).toBeUndefined()
    expect(progress.completedLessonIds).toEqual([])
    await capture(page, info, '16-completed-citrate-and-integration')
    // F-25: the end card says Restart lesson, like the header control it duplicates.
    await page.getByRole('button', { name: 'Restart lesson', exact: true }).last().click()
    expect((await saved(page)).learnTaskHistory).toEqual(progress.learnTaskHistory)
    await expect(button(page, 'Review patient and treatment')).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('Batch C session review, reload and compact reflow keep answers transient and restart the whole session', async ({
  page,
}, info) => {
  await page.goto(`${base}crrt-pressure-profile-integration`)
  await click(page, 'Review patient and treatment')
  await click(page, 'Record the first 30 minutes')
  await observations(page)
  await answer(page, /An isolated access-side limitation/)
  await review(page)
  const old = (await saved(page)).learnTaskHistory
  await page.getByText(/Lesson tasks ·/).click()
  await click(page, 'Localize the change and state the uncertainty · reviewed')
  await expect(
    page.getByRole('radio', { name: /An isolated access-side limitation/ }),
  ).toBeChecked()
  await expect(
    page.getByRole('heading', { name: 'Your choice is not the accepted answer' }),
  ).toBeVisible()
  await capture(page, info, '17-review-current-session-answer')
  await review(page)
  await page.getByRole('combobox', { name: 'CRRT lesson' }).selectOption('crrt-anticoagulation')
  await page.goBack()
  await expect(button(page, 'Review patient and treatment')).toBeVisible()
  await expect(page.getByText(/clock 0h 00m/)).toBeVisible()
  await page.goForward()
  await expect(
    page.getByRole('heading', { name: 'Circuit effect and patient safety', exact: true }),
  ).toBeVisible()
  await page.goBack()
  await page.reload()
  await expect(button(page, 'Review patient and treatment')).toBeVisible()
  expect((await saved(page)).learnTaskHistory).toEqual(old)
  await expect(page.getByText(/Each visit starts a fresh simulation/)).toBeVisible()
  for (const width of [1440, 1280, 1024, 900, 720, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await capture(page, info, `18-integration-reflow-${width}`)
  }
  await page.goto(`${base}crrt-anticoagulation`)
  await click(page, 'Continue')
  for (const width of [1440, 1280, 1024, 900, 720, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await capture(page, info, `19-citrate-reflow-${width}`)
  }
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/en/baxter-crrt/practice')
  await expect(
    page.getByRole('heading', {
      name: 'Set CRRT priorities in septic shock, AKI, and fluid accumulation',
      exact: true,
      level: 1,
    }),
  ).toBeVisible()
  await capture(page, info, '20-practice-reference-1280')
})
