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
const ready = async (page: Page) => {
  await page.locator('[data-three-state]').scrollIntoViewIfNeeded()
  await expect(page.locator('[data-three-state]')).toHaveAttribute('data-three-state', 'ready', {
    timeout: 30_000,
  })
}
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
async function reachAct(page: Page, id: BronchSectionId) {
  const lesson = await openSection(page, id)
  for (const step of lesson.steps) {
    if (step.course?.kind === 'practice') break
    if (step.interaction.kind === 'prediction') {
      await page
        .locator(
          '[data-prediction-choices] input[value="' +
            step.interaction.stage.item.correctChoiceIds[0] +
            '"]',
        )
        .check()
      await primary(page).click()
    }
    await primary(page).click()
  }
  return { lesson }
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

test('one entry, Back review and reload preserve the first decision and its support', async ({
  page,
}) => {
  await expect(page.locator('[data-bronch-continue]')).toHaveAttribute(
    'href',
    /section=shared-airway/,
  )
  await page.locator('[data-bronch-continue]').click()
  const lesson = bronchStageLesson('shared-airway')
  const check = lesson.steps[lesson.predictionStepIndex]
  if (check.interaction.kind !== 'prediction') throw new Error('Check expected')
  await expect(page.locator('[data-course-teaching]')).toBeVisible()
  for (const step of lesson.steps.slice(0, lesson.predictionStepIndex)) {
    await expect(stage(page)).toHaveAttribute('data-stage', step.id)
    await primary(page).click()
  }
  await page.locator('[data-now-back]').click()
  await expect(page.locator('[data-now-status]')).toContainText('looking back')
  await primary(page).click()
  const item = check.interaction.stage.item
  const wrong = item.choices.find((entry) => !item.correctChoiceIds.includes(entry.id))!
  await page.locator('[data-prediction-choices] input[value="' + wrong.id + '"]').check()
  await primary(page).click()
  const saved = await record(page)
  expect(Object.values(saved.firstAttempts)).toEqual([
    expect.objectContaining({ choiceId: wrong.id, correct: false, support: 'reviewed-teaching' }),
  ])
  expect(saved.completedSectionIds).toEqual([])
  await page.reload()
  await expect(stage(page)).toHaveAttribute('data-stage', lesson.steps[0].id)
  for (let index = 0; index < lesson.predictionStepIndex; index++) await primary(page).click()
  await page
    .locator('[data-prediction-choices] input[value="' + item.correctChoiceIds[0] + '"]')
    .check()
  await primary(page).click()
  expect((await record(page)).firstAttempts).toEqual(saved.firstAttempts)
})

async function pilotAction(page: Page, name: string) {
  await page.locator('[data-now-card]').getByRole('button', { name, exact: true }).click()
}
async function pilotContinue(page: Page) {
  await primary(page).click()
}
async function pilotMovement(page: Page, id: string) {
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

      await expect(page.getByRole('heading', { name: 'What each hand does' })).toBeVisible()
      await expect(page.locator('[data-prediction-choices]')).toHaveCount(0)
      await page.screenshot({ path: info.outputPath('01-before-answer-teaching.png') })

      await expect(page.locator('[data-instrument-orientation]')).toBeVisible()
      await page.getByRole('button', { name: 'Steering and suction', exact: true }).click()
      await page.screenshot({ path: info.outputPath('02-instrument.png') })
      await pilotContinue(page)
      let first: unknown
      for (const step of lesson.steps.slice(1)) {
        await expect(stage(page)).toHaveAttribute('data-stage', step.id)
        if (step.interaction.kind === 'prediction') {
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
              /^-?0\.00$/,
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
            await expect(primary(page)).toBeDisabled()
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

            await expect(page.locator('[data-now-status]')).toContainText(
              'advanced before centering',
            )
            await page.screenshot({ path: info.outputPath('08-target-error-feedback.png') })
            await pilotAction(page, 'Reset this attempt')
            await expect(primary(page)).toBeDisabled()
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
  await expect(primary(page)).toBeDisabled()
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
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
]) {
  test(
    'course presentations reflow with one task and continuation at ' + viewport.width,
    async ({ page }, info) => {
      test.setTimeout(240_000)
      await page.setViewportSize(viewport)
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      const ids =
        viewport.width === 1440
          ? BRONCH_SECTION_IDS
          : ([
              'pre-use-check',
              'five-controls',
              'right-side',
              'deterioration',
              'honest-report',
            ] as const)
      for (const id of ids) {
        await openSection(page, id)
        await expect(page.locator('[data-course-teaching]')).toBeVisible()
        for (const img of await page.locator('[data-media-kind] img:visible').all()) {
          await expect
            .poll(() => img.evaluate((image) => (image as HTMLImageElement).naturalWidth))
            .toBeGreaterThan(0)
        }

        await expect(page.locator('[data-step-list]')).toHaveCount(0)
        await expect(page.getByRole('tab', { name: /^(Steps|Teaching|Simulator)$/ })).toHaveCount(0)
        await expect(primary(page)).toBeVisible()
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true)
        expect(await page.locator('[data-stage]').innerText()).not.toMatch(
          /(?:return to|read|in) the (?:Steps|Teaching|Simulator) panel/i,
        )
        await page.screenshot({
          path: info.outputPath(id + '-' + viewport.width + '.png'),
          fullPage: true,
        })
        await primary(page).focus()
        await primary(page).press('Enter')
        await expect(page.locator('[data-now-focus]')).toBeFocused()
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true)
      }
      expect(errors).toEqual([])
    },
  )
}

for (const id of ['pre-use-check', 'deterioration', 'honest-report'] as const) {
  test('complete course workspace through native responses: ' + id, async ({ page }, info) => {
    const lesson = await openSection(page, id)
    for (const step of lesson.steps) {
      await expect(stage(page)).toHaveAttribute('data-stage', step.id)
      const task = step.interaction
      if (task.kind === 'prediction') {
        await expect(page.locator('[data-course-teaching]')).toHaveCount(0)
        await expect(page.locator('[data-worked-example]')).toHaveCount(0)
        await page
          .locator(
            '[data-prediction-choices] input[value="' + task.stage.item.correctChoiceIds[0] + '"]',
          )
          .check()
        await primary(page).click()
      } else if (task.kind === 'identify') {
        for (const row of task.identify.rows)
          await page
            .locator('[data-identify-row="' + row.id + '"] input[value="' + row.answerId + '"]')
            .check()
        await primary(page).click()
      } else if (task.kind === 'report') {
        for (const field of task.report.fields)
          await page
            .locator(
              '[data-report-field="' +
                field.id +
                '"] input[value="' +
                field.options.find((option) => option.supported)!.id +
                '"]',
            )
            .check()
      } else if (task.kind === 'scenario') {
        for (const frame of task.scenario.frames) {
          if (await page.locator('[data-scenario-continue]').count())
            await page.locator('[data-scenario-continue]').click()
          await expect(page.locator('[data-case-baseline]')).toBeVisible()
          const unsafe = frame.choices.find((choice) => choice.plausibility === 'unsafe')
          if (unsafe) {
            await page
              .locator('[data-scenario-frame="' + frame.id + '"] input[value="' + unsafe.id + '"]')
              .check()
            await page.locator('[data-scenario-decide]').click()
            await expect(page.locator('[data-scenario-outcome="refused"]')).toBeVisible()
          }
          await page
            .locator(
              '[data-scenario-frame="' +
                frame.id +
                '"] input[value="' +
                frame.choices.find((choice) => choice.plausibility === 'best')!.id +
                '"]',
            )
            .check()
          await page.locator('[data-scenario-decide]').click()
        }
      }
      if (step.course?.kind === 'practice')
        await page.screenshot({ path: info.outputPath(step.id + '.png'), fullPage: true })
      await primary(page).click()
    }
    await expect(page.locator('[data-section-completion]')).toBeVisible()
    expect((await record(page)).completedSectionIds).toContain(id)
    await page.goto(base)
    await expect(page.locator('[data-bronch-continue]')).toHaveAttribute(
      'data-next-section',
      'shared-airway',
    )
  })
}

test('missing teaching media is explicitly identified', async ({ page }) => {
  await page.route('**/airway-quiz/quiz-frames.json', (route) => route.abort())
  await page.route('**/*quiz*frames*.json', (route) => route.abort())
  await openSection(page, 'right-side')
  await expect(page.locator('[data-media-state="failed"]')).toBeVisible()
  expect((await record(page)).completedSectionIds).toEqual([])
})

test('the course remains readable at 200 percent zoom', async ({ page }, info) => {
  await openSection(page, 'pre-use-check')
  await page.locator('[data-stage]').evaluate((element) => {
    ;(element as HTMLElement).style.zoom = '2'
  })
  await expect(primary(page)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
  await primary(page).press('Enter')
  await expect(page.locator('[data-now-focus]')).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
  await page.screenshot({ path: info.outputPath('course-200-percent.png') })
})
