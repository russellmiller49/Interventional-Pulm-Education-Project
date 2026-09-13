import { expect, test, type Page } from '@playwright/test'
import sharp from 'sharp'
import { bronchStageLesson } from '../src/features/bronchoscopy-foundations/content/stageLessons'
import {
  BRONCH_SECTION_IDS,
  type BronchSectionId,
} from '../src/features/bronchoscopy-foundations/content/pathway'
import { CAPSTONE_CASES } from '../src/features/bronchoscopy-foundations/content/capstone'
import { capstoneStageItem } from '../src/features/bronchoscopy-foundations/engine/caseStandard'
import {
  BRONCH_STORAGE_KEY,
  createEmptyBronchRecord,
  withSectionCompleted,
} from '../src/features/bronchoscopy-foundations/engine/learnProgress'
import { scopeControlId } from '../src/features/bronchoscopy-foundations/components/scope/types'

// Opt in to the module's isolated local server; never write a test record on a deployed site.
test.skip(!process.env.BRONCH_FOUNDATIONS_BASE_URL, 'Use the dedicated config and a local server.')
test.setTimeout(120_000)
// Enables native taps in the phone journey; desktop controls still use mouse/keyboard.
test.use({ hasTouch: true })
const base = '/en/bronchoscopy-foundations'
const primary = (page: Page) => page.locator('[data-now-card] [data-now-primary]')
const stage = (page: Page) => page.locator('[data-stage]')
const ready = (page: Page) =>
  expect(page.locator('[data-three-state]')).toHaveAttribute('data-three-state', 'ready', {
    timeout: 30_000,
  })
const control = (page: Page, key: Parameters<typeof scopeControlId>[0]) =>
  page.locator('[id="' + scopeControlId(key) + '"]')

test.beforeEach(async ({ page }) => {
  const url = process.env.BRONCH_FOUNDATIONS_BASE_URL!
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('Local server required')
  await page.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
  const response = await page.goto(base)
  expect(response?.status()).toBe(200)
  await expect(page.locator('[data-bronch-continue]')).toHaveCount(1)
})
async function openSection(page: Page, id: BronchSectionId) {
  const lesson = bronchStageLesson(id)
  await page.goto(base + '/learn?section=' + id)
  await expect(stage(page)).toHaveAttribute('data-stage', lesson.steps[0].id)
  return lesson
}
async function reachAct(page: Page, id: BronchSectionId, miss = false) {
  const lesson = await openSection(page, id)
  await primary(page).click()
  const step = lesson.steps[lesson.predictionStepIndex]
  if (step.interaction.kind !== 'prediction') throw new Error('Prediction expected')
  const item = step.interaction.stage.item
  const choice = miss
    ? item.choices.find((entry) => !item.correctChoiceIds.includes(entry.id))!.id
    : item.correctChoiceIds[0]
  await page.locator('[data-prediction-choices] input[value="' + choice + '"]').check()
  await primary(page).click()
  await expect(page.locator('[data-answer-verdict]')).toHaveAttribute('data-revealed', 'true')
  await primary(page).click()
  return { lesson, choice, item }
}
async function setRange(page: Page, key: 'rotate' | 'deflect', value: number) {
  // Native keyboard input exercises React's real change handler and input provenance.
  const slider = control(page, key)
  await slider.focus()
  let current = Number(await slider.inputValue())
  const step = Number((await slider.getAttribute('step')) ?? 1)
  const pageStep =
    (Number(await slider.getAttribute('max')) - Number(await slider.getAttribute('min'))) / 10
  // Native PageUp/PageDown covers larger movements without hundreds of one-degree renders.
  // Read the browser's actual value after every page key; rounding varies across range bounds.
  while (Math.abs(value - current) > pageStep) {
    const before = current
    await slider.press(current < value ? 'PageUp' : 'PageDown')
    current = Number(await slider.inputValue())
    if (current === before) break
  }
  const direction = current < value ? 1 : -1
  for (let at = current; direction * at < direction * value; at += direction * step)
    await slider.press(direction === 1 ? 'ArrowRight' : 'ArrowLeft')
}
async function record(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), BRONCH_STORAGE_KEY)
}

async function expectPaintedControlHead(page: Page) {
  const head = page.locator('[data-control-head]')
  await head.scrollIntoViewIfNeeded()
  // Readiness alone cannot detect a View that was cleared after returning onscreen.
  // The middle of the close-up must contain both the pale studio and the dark instrument.
  await expect
    .poll(
      async () => {
        const { data, info } = await sharp(await head.screenshot())
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
        let light = 0,
          dark = 0,
          count = 0
        for (let y = Math.floor(info.height * 0.2); y < info.height * 0.82; y++) {
          for (let x = Math.floor(info.width * 0.1); x < info.width * 0.9; x++) {
            const at = (y * info.width + x) * info.channels
            if (data[at] > 175 && data[at + 1] > 175 && data[at + 2] > 175) light++
            if (data[at] < 115 && data[at + 1] < 115 && data[at + 2] < 115) dark++
            count++
          }
        }
        return light / count > 0.3 && dark / count > 0.025
      },
      { timeout: 10_000 },
    )
    .toBe(true)
}

test('one entry, direct links and incomplete-section resume preserve the first decision', async ({
  page,
}) => {
  await expect(page.locator('[data-bronch-continue]')).toHaveAttribute(
    'href',
    /section=shared-airway/,
  )
  await page.locator('[data-bronch-continue]').click()
  await expect(stage(page)).toHaveAttribute(
    'data-stage',
    bronchStageLesson('shared-airway').steps[0].id,
  )
  const { lesson, choice, item } = await reachAct(page, 'branch-entry', true)
  await ready(page)
  const saved = await record(page)
  const first = Object.values(saved.firstAttempts) as { choiceId: string; correct: boolean }[]
  expect(first).toEqual([expect.objectContaining({ choiceId: choice, correct: false })])
  expect(saved.completedSectionIds).not.toContain('branch-entry')
  await page.reload()
  await expect(stage(page)).toHaveAttribute('data-stage', lesson.steps[0].id)
  await primary(page).click()
  await page
    .locator('[data-prediction-choices] input[value="' + item.correctChoiceIds[0] + '"]')
    .check()
  await primary(page).click()
  expect((await record(page)).firstAttempts).toEqual(saved.firstAttempts)
})

async function showPanel(page: Page, name: 'Steps' | 'Teaching' | 'Simulator') {
  const tab = page.getByRole('tab', { name, exact: true })
  if (await tab.isVisible()) await tab.click()
}
async function pilotAction(page: Page, name: string) {
  await showPanel(page, 'Steps')
  await page.locator('[data-now-card]').getByRole('button', { name, exact: true }).click()
}
async function pilotContinue(page: Page) {
  await showPanel(page, 'Steps')
  await primary(page).click()
}
async function pilotMovement(page: Page, id: string) {
  await showPanel(page, 'Simulator')
  const depth = async (direction: 'advance' | 'withdraw') => {
    if ((page.viewportSize()?.width ?? 1440) <= 390) await control(page, direction).tap()
    else await control(page, direction).click()
  }
  switch (id) {
    case 'depth':
    case 'depth-repeat':
      await depth('advance')
      await depth('withdraw')
      break
    case 'bend':
    case 'bend-repeat':
      await setRange(page, 'deflect', 25)
      await setRange(page, 'deflect', 0)
      break
    case 'rotation':
      await setRange(page, 'rotate', 45)
      await setRange(page, 'deflect', 25)
      await setRange(page, 'rotate', 0)
      break
    case 'rotation-repeat':
      await setRange(page, 'rotate', 30)
      break
    case 'combine':
      await setRange(page, 'rotate', 45)
      await setRange(page, 'deflect', 27)
      await depth('advance')
      await depth('advance')
      await setRange(page, 'deflect', 31)
      await depth('advance')
      await setRange(page, 'deflect', 33)
      await depth('advance')
      break
    case 'suction':
    case 'suction-repeat':
      await control(page, 'suction').check()
      await control(page, 'suction').uncheck()
      break
    case 'transfer':
      await setRange(page, 'deflect', -20)
      await depth('advance')
      await depth('advance')
      await setRange(page, 'deflect', -24)
      await depth('advance')
      await setRange(page, 'deflect', -25)
      await depth('advance')
      await expect(control(page, 'rotate')).toHaveValue('0')
      break
  }
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(
    'teaching-first pilot completes with real controls and honest records at ' + viewport.width,
    async ({ page }, info) => {
      test.setTimeout(240_000)
      await page.setViewportSize(viewport)
      await page.emulateMedia({
        reducedMotion: viewport.width === 1440 ? 'no-preference' : 'reduce',
      })
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      const lesson = await openSection(page, 'five-controls')
      await showPanel(page, 'Teaching')
      await expect(page.getByRole('heading', { name: 'What each hand does' })).toBeVisible()
      await expect(page.locator('[data-prediction-choices]')).toHaveCount(0)
      await page.screenshot({ path: info.outputPath('01-before-answer-teaching.png') })
      await showPanel(page, 'Simulator')
      await expect(page.locator('[data-instrument-orientation]')).toBeVisible()
      await page.getByRole('button', { name: 'Steering and suction', exact: true }).click()
      await page.screenshot({ path: info.outputPath('02-instrument.png') })
      await pilotContinue(page)
      let first: unknown
      for (const step of lesson.steps.slice(1)) {
        await expect(stage(page)).toHaveAttribute('data-stage', step.id)
        if (step.interaction.kind === 'prediction') {
          await showPanel(page, 'Steps')
          const item = step.interaction.stage.item
          // Current teaching has no example-specific answer; key/rationales are not rendered.
          const teachingText = await page.locator('[data-pilot-teaching]').textContent()
          for (const denied of lesson.section.precommitDenyPatterns)
            expect(teachingText).not.toMatch(denied)
          const wrong = item.choices.find(
            (choice) => !item.correctChoiceIds.includes(choice.id),
          )!.id
          await page.locator('[data-prediction-choices] input[value="' + wrong + '"]').check()
          await primary(page).click()
          await expect(page.locator('[data-answer-verdict]')).toHaveAttribute(
            'data-verdict-outcome',
            'not-correct',
          )
          await expect(stage(page)).toHaveAttribute('data-stage', step.id)
          await page.screenshot({ path: info.outputPath('05-wrong-answer-feedback.png') })
          first = (await record(page)).firstAttempts['five-controls-learn-v2:N03']
          await pilotAction(page, 'Try this check again')
          await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
          await page.screenshot({ path: info.outputPath('06-check-retry.png') })
          await page
            .locator('[data-prediction-choices] input[value="' + item.correctChoiceIds[0] + '"]')
            .check()
          await primary(page).click()
          expect((await record(page)).firstAttempts['five-controls-learn-v2:N03']).toEqual(first)
        } else if (step.interaction.kind === 'scope-task') {
          if (step.learn?.id === 'bend') {
            await pilotAction(page, 'Watch the example')
            for (const [index, angle] of [60, 0, -60, 0].entries()) {
              if (index) await pilotAction(page, 'Next demonstration movement')
              await showPanel(page, 'Simulator')
              await ready(page)
              await expect(page.locator('[data-control-head]')).toHaveAttribute(
                'data-lever-deflection',
                angle.toFixed(2),
              )
              await expect(control(page, 'deflect')).toBeDisabled()
              await page.locator('[data-control-closeups]').scrollIntoViewIfNeeded()
              await expectPaintedControlHead(page)
              await page.screenshot({ path: info.outputPath('lever-and-tip-' + index + '.png') })
              const closeups = await page.locator('[data-control-closeups]').boundingBox()
              expect(closeups?.width).toBeGreaterThan(140)
              expect(
                await page.evaluate(
                  () => document.documentElement.scrollWidth <= window.innerWidth,
                ),
              ).toBe(true)
            }
            expect((await record(page)).completedSectionIds).toEqual([])
          }
          if (step.learn?.id === 'depth') {
            await pilotAction(page, 'Watch the example')
            await showPanel(page, 'Simulator')
            await ready(page)
            await expect(page.locator('[data-readout="depthMm"] dd')).toContainText('12 mm')
            await expect(control(page, 'advance')).toBeDisabled()
            await page.locator('[data-three-state]').scrollIntoViewIfNeeded()
            await page.screenshot({ path: info.outputPath('03-real-engine-demonstration.png') })
            await pilotAction(page, 'Next demonstration movement')
            expect((await record(page)).firstAttempts).toEqual({})
            expect((await record(page)).completedSectionIds).toEqual([])
          }
          if (step.learn?.demonstration) await pilotAction(page, 'Try with guidance')
          await showPanel(page, 'Simulator')
          await ready(page)
          if (step.learn?.id === 'rotation') {
            await setRange(page, 'deflect', 45)
            await setRange(page, 'rotate', 90)
            await expect(page.locator('[data-control-head]')).toHaveAttribute(
              'data-handle-rotation',
              '90.00',
            )
            await expect(page.locator('[data-control-head]')).toHaveAttribute(
              'data-lever-deflection',
              '45.00',
            )
            await page.locator('[data-control-closeups]').scrollIntoViewIfNeeded()
            await expectPaintedControlHead(page)
            await page.screenshot({ path: info.outputPath('handle-rotation.png') })
            await control(page, 'reset').click()
            await expect(page.locator('[data-control-head]')).toHaveAttribute(
              'data-handle-rotation',
              '0.00',
            )
          }
          if (step.learn?.id === 'suction') {
            await control(page, 'suction').check()
            await expect(page.locator('[data-control-head]')).toHaveAttribute(
              'data-suction-travel',
              '1.00',
            )
            await page.locator('[data-control-closeups]').scrollIntoViewIfNeeded()
            await expectPaintedControlHead(page)
            await page.screenshot({ path: info.outputPath('suction-valve.png') })
            await control(page, 'reset').click()
          }
          if (step.learn?.id === 'depth') {
            await control(page, 'advance').press('Enter')
            await control(page, 'advance').press('Enter')
            await expect(primary(page)).toHaveCount(0)
            await control(page, 'reset').click()
            await expect(page.locator('[data-readout="depthMm"] dd')).toContainText('0 mm')
          }
          if (step.learn?.id === 'transfer') {
            await expect(page.locator('[data-pilot-cue]')).toHaveCount(0)
            await expect(page.locator('[data-demonstration-caption]')).toHaveCount(0)
            const centers = await page.locator('[data-bench-reticle]').evaluate((reticle) => {
              const cross = reticle.getBoundingClientRect()
              const viewport = reticle.parentElement!.firstElementChild!.getBoundingClientRect()
              return { crossY: cross.y + cross.height / 2, viewY: viewport.y + viewport.height / 2 }
            })
            expect(Math.abs(centers.crossY - centers.viewY)).toBeLessThan(1)
            await page.locator('[data-three-state]').scrollIntoViewIfNeeded()
            await page.screenshot({ path: info.outputPath('07-changed-target.png') })
            await control(page, 'advance').click()
            await showPanel(page, 'Steps')
            await expect(page.locator('[data-now-status]')).toContainText(
              'advanced before centering',
            )
            await page.screenshot({ path: info.outputPath('08-target-error-feedback.png') })
            await pilotAction(page, 'Reset this attempt')
            await expect(primary(page)).toHaveCount(0)
          }
          await pilotMovement(page, step.learn!.id)
          if (step.learn?.id === 'depth')
            await page.screenshot({ path: info.outputPath('04-learner-depth-return.png') })
          if (step.learn?.id === 'transfer') {
            await page.locator('[data-three-state]').scrollIntoViewIfNeeded()
            await page.screenshot({ path: info.outputPath('09-target-retry-success.png') })
          }
        }
        await pilotContinue(page)
      }
      await expect(page.locator('[data-section-completion]')).toBeVisible()
      await page.screenshot({ path: info.outputPath('10-completion.png') })
      const saved = await record(page)
      expect(saved.sectionVersions['five-controls']).toBe(2)
      expect(saved.sectionPerformance['five-controls-learn-v2']).toMatchObject({
        unaided: false,
        assistsUsed: ['guided-practice'],
      })
      expect(saved.sectionPerformance['five-controls-learn-v2'].inputModes).not.toContain(
        'scripted',
      )
      await expect(page.locator('[data-section-completion] [data-next-section]')).toHaveAttribute(
        'data-next-section',
        'branch-entry',
      )
      await page.reload()
      await expect(stage(page)).toHaveAttribute('data-stage', lesson.steps[0].id)
      expect((await record(page)).firstAttempts['five-controls-learn-v2:N03']).toEqual(first)
      expect(errors).toEqual([])
    },
  )
}

test('the pilot retains working controls and a text equivalent when WebGL is unavailable', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (kind: string, ...args: unknown[]) {
        return kind.includes('webgl') ? null : Reflect.apply(original, this, [kind, ...args])
      },
    })
  })
  await openSection(page, 'five-controls')
  await pilotContinue(page)
  await pilotAction(page, 'Try with guidance')
  await page.getByRole('button', { name: 'Use the schematic view', exact: true }).click()
  const schematic = page.getByRole('img', { name: /^Schematic scope view/ })
  await expect(schematic).toBeVisible()
  await control(page, 'advance').click()
  await expect(schematic).toHaveAttribute('aria-label', /Depth 3 mm/)
  await control(page, 'withdraw').click()
  await expect(schematic).toHaveAttribute('aria-label', /Depth 0 mm/)
  await expect(primary(page)).toBeEnabled()
  await page.screenshot({ path: info.outputPath('fallback-depth.png') })
  expect((await record(page)).completedSectionIds).toEqual([])
})

test('the survey distinguishes entering from inspecting and refuses an unseen-airway claim', async ({
  page,
}) => {
  await reachAct(page, 'systematic-survey')
  await ready(page)
  const rows = page.locator('[data-inspection-ledger] [data-ledger-row]')
  await expect(rows).toHaveCount(6)
  await expect(page.locator('[data-ledger-row="RLL"]')).not.toHaveAttribute(
    'data-ledger-status',
    'inspected',
  )
  const rll = page.locator('[data-ledger-row="RLL"] select')
  expect(await rll.locator('option[value="inspected"]').isDisabled()).toBe(true)
  const rb10 = page.locator('[data-ledger-row="RB10"] select')
  expect(await rb10.locator('option[value="not-safely-accessible"]').isDisabled()).toBe(true)
  await rb10.selectOption('not-observed')
  await expect(rb10).toHaveValue('')
  await expect(page.locator('[data-ledger-row="RB10"]')).toHaveAttribute(
    'data-ledger-status',
    'not-observed',
  )
  await expect(primary(page)).toHaveCount(0)
  await expect(page.locator('[data-scope-scene]')).toContainText(
    'Entering an airway is not inspecting it',
  )
})

test('the report refuses unsupported claims and only opens Continue when every field is supported', async ({
  page,
}) => {
  const { lesson } = await reachAct(page, 'honest-report')
  const interaction = lesson.steps.find((step) => step.interaction.kind === 'report')!.interaction
  if (interaction.kind !== 'report') throw new Error('Report expected')
  await expect(primary(page)).toHaveCount(0)
  const field = interaction.report.fields.find((entry) =>
    entry.options.some((option) => !option.supported),
  )!
  const rejected = field.options.find((option) => !option.supported)!
  const row = page.locator('[data-report-field="' + field.id + '"]')
  await row.locator('input[value="' + rejected.id + '"]').click()
  await expect(row).toHaveAttribute('data-outcome', 'refused')
  await expect(primary(page)).toHaveCount(0)
  for (const entry of interaction.report.fields) {
    const supported = entry.options.find((option) => option.supported)!
    await page
      .locator('[data-report-field="' + entry.id + '"] input[value="' + supported.id + '"]')
      .check()
  }
  await expect(page.locator('[data-report-field][data-outcome="held"]')).toHaveCount(
    interaction.report.fields.length,
  )
  await expect(primary(page)).toBeEnabled()
})

test('Practice records the first answer and offers its paired lesson', async ({ page }) => {
  await page.goto(base + '/practice')
  await page.locator('[data-next-case]').click()
  await expect(page.locator('[data-prediction-choices]')).toBeVisible()
  await page.locator('[data-prediction-choices] input').first().check()
  await page.getByRole('button', { name: 'Submit this answer' }).click()
  await expect(page.locator('[data-answer-verdict]')).toHaveAttribute('data-revealed', 'true')
  expect(Object.keys((await record(page)).firstAttempts)).toHaveLength(1)
  await expect(page.locator('a[href*="learn?section="]')).not.toHaveCount(0)
})

test('capstone with one unsafe critical decision does not meet the standard', async ({ page }) => {
  await page.goto(base + '/assess')
  await expect(page.locator('[data-capstone="locked"]')).toBeVisible()
  await page.evaluate(
    ({ key, completed }) => localStorage.setItem(key, JSON.stringify(completed)),
    {
      key: BRONCH_STORAGE_KEY,
      completed: BRONCH_SECTION_IDS.reduce(
        (record, id) => withSectionCompleted(record, id),
        createEmptyBronchRecord(),
      ),
    },
  )
  await page.reload()
  await expect(page.locator('[data-capstone="deciding"]')).toBeVisible()
  await expect(page.locator('[data-prediction-choices]')).toHaveCount(1)
  for (const [index, entry] of CAPSTONE_CASES.entries()) {
    const item = capstoneStageItem(entry.id).item
    const choice =
      index === 0
        ? item.choices.find((option) => option.plausibility === 'unsafe')!.id
        : item.correctChoiceIds[0]
    await page
      .locator('[data-capstone-case="' + entry.id + '"] input[value="' + choice + '"]')
      .check()
    await page.getByRole('button', { name: 'Submit this decision' }).click()
    if (index === 0) await expect(page.locator('[data-answer-verdict][role="alert"]')).toBeVisible()
    if (index === 1) {
      await expect(
        page.locator('[data-capstone-case="' + entry.id + '"] [data-answer-verdict]'),
      ).toHaveAttribute('data-revealed', 'false')
      await expect(page.locator('[data-case-pairing]')).toHaveCount(0)
    }
  }
  await expect(page.locator('[data-capstone-debrief]')).toHaveAttribute(
    'data-standard',
    'not-yet-met',
  )
  await expect(page.locator('[data-capstone-standard]')).toContainText('Seven of eight')
  await expect(page.locator('[data-case-pairing]')).toHaveCount(8)
  await page.reload()
  await expect(page.locator('[data-capstone-debrief]')).toHaveAttribute(
    'data-standard',
    'not-yet-met',
  )
})

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 700 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
]) {
  test('lesson surfaces reflow at ' + viewport.width + 'px', async ({ page }, info) => {
    test.setTimeout(240_000)
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    for (const id of [
      'shared-airway',
      'five-controls',
      'branch-entry',
      'right-side',
      'systematic-survey',
      'honest-report',
    ] as const) {
      const lesson = await openSection(page, id)
      const stepsTab = page.getByRole('tab', { name: 'Steps', exact: true })
      // Wait for responsive hydration; SSR markup alone is not a compact-layout result.
      if (viewport.width < 960) {
        await expect(stepsTab).toBeVisible()
        await stepsTab.click()
        await stepsTab.press('ArrowRight')
        await expect(page.getByRole('tab', { name: 'Teaching', exact: true })).toHaveAttribute(
          'aria-selected',
          'true',
        )
      }
      if (await stepsTab.isVisible()) await stepsTab.click()
      await expect(primary(page)).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
      const simTab = page.getByRole('tab', { name: 'Simulator', exact: true })
      if (await simTab.isVisible()) {
        await page.screenshot({ path: info.outputPath(id + '-' + viewport.width + '-steps.png') })
        await simTab.click()
      }
      if (lesson.section.workspace.kind === 'scope' && id !== 'five-controls') {
        await page.locator('[data-three-state]').scrollIntoViewIfNeeded()
        await ready(page)
        await expect
          .poll(() =>
            page.locator('[data-ostium-pin]').evaluateAll((elements) => {
              const boxes = elements
                .filter((element) => element.textContent?.trim() !== '·')
                .map((element) => element.getBoundingClientRect())
              return boxes.some((a, index) =>
                boxes
                  .slice(index + 1)
                  .some(
                    (b) =>
                      Math.min(a.right, b.right) > Math.max(a.left, b.left) + 0.5 &&
                      Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 0.5,
                  ),
              )
            }),
          )
          .toBe(false)
      }
      if (lesson.section.workspace.kind === 'media')
        await expect(page.locator('[data-media-workspace] img')).toHaveCount(
          lesson.section.workspace.media.length,
        )
      if (lesson.section.workspace.kind === 'map') {
        const map = page.getByRole('group', { name: 'The airway map', exact: true })
        await expect(map.locator('svg')).toBeVisible()
        await map.scrollIntoViewIfNeeded()
      }
      if (await simTab.isVisible()) await expect(simTab).toHaveAttribute('aria-selected', 'true')
      const shown = await page
        .locator('[data-stage-frame] [role="region"]')
        .evaluateAll((elements) =>
          elements
            .filter(
              (element) =>
                /^(Steps|Teaching|Simulator) panel$/.test(
                  element.getAttribute('aria-label') ?? '',
                ) && !element.hasAttribute('hidden'),
            )
            .map((element) => ({
              name: element.getAttribute('aria-label'),
              width: element.getBoundingClientRect().width,
              left: element.getBoundingClientRect().left,
            })),
        )
      expect(shown).toHaveLength(viewport.width < 960 ? 1 : 3)
      if (shown.length === 3) {
        expect([...shown].sort((a, b) => a.left - b.left).map((pane) => pane.name)).toEqual([
          'Steps panel',
          'Teaching panel',
          'Simulator panel',
        ])
        expect(shown[2].width).toBeGreaterThan(shown[0].width)
        expect(shown[2].width).toBeGreaterThan(shown[1].width)
      }
      await page.screenshot({ path: info.outputPath(id + '-' + viewport.width + '.png') })
    }
    expect(errors).toEqual([])
  })
}
