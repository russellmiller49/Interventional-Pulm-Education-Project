import { writeFileSync } from 'fs'
import { expect, test, type Locator, type Page } from '@playwright/test'
import sharp from 'sharp'
import { bronchStageLesson } from '../src/features/bronchoscopy-foundations/content/stageLessons'
import {
  BRONCH_SECTION_IDS,
  type BronchSectionId,
} from '../src/features/bronchoscopy-foundations/content/pathway'
import { CAPSTONE_CASES } from '../src/features/bronchoscopy-foundations/content/capstone'
import { capstoneStageItem } from '../src/features/bronchoscopy-foundations/content/stageItems'
import { BRONCH_STORAGE_KEY } from '../src/features/bronchoscopy-foundations/engine/learnProgress'
import { BRONCH_SELF_PACED_STORAGE_KEY } from '../src/features/bronchoscopy-foundations/engine/selfPacedProgress'
import { scopeControlId } from '../src/features/bronchoscopy-foundations/components/scope/types'
import {
  benchTipOrientation,
  compassRadius,
} from '../src/features/bronchoscopy-foundations/engine/scope/benchOrientation'
import { authoredScopePose } from '../src/features/bronchoscopy-foundations/engine/scope/scopeAuthoredPose'
import { DEFAULT_SCOPE_INPUTS } from '../src/features/bronchoscopy-foundations/engine/scope/scopeInputs'
import {
  BRONCH_GRAMMAR,
  grammarRowControl,
} from '../src/features/bronchoscopy-foundations/content/grammar'
import { bronchSection } from '../src/features/bronchoscopy-foundations/content/pathway'
import { bronchStageSources } from '../src/features/bronchoscopy-foundations/content/stageSources'
import {
  SOURCE_BY_ID,
  TRANSCRIPT_SENTENCE,
} from '../src/features/bronchoscopy-foundations/data/sources'

// Opt in to the module's isolated local server; never write a test record on a deployed site.
test.skip(!process.env.BRONCH_FOUNDATIONS_BASE_URL, 'Use the dedicated config and a local server.')
test.setTimeout(120_000)
// Enables native taps in the phone journey; desktop controls still use mouse/keyboard.
test.use({ hasTouch: true })
const base = '/en/bronchoscopy-foundations'
const primary = (page: Page) => page.locator('[data-now-card] [data-now-primary]')
const skip = (page: Page) => page.locator('[data-now-card] [data-now-skip]')
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
/** The self-paced record (BF-01): location and section marks only. */
async function record(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
    BRONCH_SELF_PACED_STORAGE_KEY,
  )
}
/** The earlier record's raw bytes; new sessions never write it. */
async function earlierRecord(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), BRONCH_STORAGE_KEY)
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

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 900, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`larynx transition stays visible on approach, crossing and return at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await openSection(page, 'larynx-and-entry')
    await primary(page).click()
    await primary(page).click()
    await ready(page)
    // The learner reaches the real controls without a control-identification answer.
    await expect(page.locator('[data-prediction-choices]')).toHaveCount(0)
    await expect(control(page, 'advance')).toBeEnabled()
    await expect(skip(page)).toHaveText('Continue without completing')
    const optical = page.locator('[data-view-signal]')

    async function painted(name: string) {
      await optical.scrollIntoViewIfNeeded()
      // Read actual pixels, not the readiness flag: the old renderer reports "ready"
      // and "clear" even when no downstream anatomy is mounted and the view is black.
      await expect
        .poll(
          async () => {
            const { data, info } = await sharp(await optical.screenshot())
              .removeAlpha()
              .raw()
              .toBuffer({ resolveWithObject: true })
            let tissue = 0,
              count = 0
            for (let y = Math.floor(info.height * 0.2); y < info.height * 0.8; y++) {
              for (let x = Math.floor(info.width * 0.2); x < info.width * 0.8; x++) {
                const at = (y * info.width + x) * info.channels
                if (data[at] > 40 && data[at] > data[at + 1] * 1.15) tissue++
                count++
              }
            }
            return tissue / count
          },
          { timeout: 5000, message: name + ': visible mucosal surface in the optical view' },
        )
        .toBeGreaterThan(0.1)
      await testInfo.attach(name, { body: await optical.screenshot(), contentType: 'image/png' })
    }

    async function approach() {
      await control(page, 'reset').click()
      // Reduced motion pauses the authored breath. Three genuine Step clicks put
      // it in inspiration; the next fourteen 3 mm advances end at 42 mm.
      for (let i = 0; i < 3; i++) await control(page, 'step').click()
      for (let i = 0; i < 14; i++) await control(page, 'advance').press('Enter')
      await expect(page.locator('[data-scope-place]')).toHaveAttribute('data-scope-place', 'larynx')
    }

    await approach()
    await painted('approach-42mm')
    await control(page, 'advance').press('Enter')
    await expect(page.locator('[data-scope-place]')).toHaveCount(0)
    await painted('crossing-45mm')
    await control(page, 'advance').press('Enter')
    await painted('trachea-48mm')
    await control(page, 'withdraw').press('Enter')
    await control(page, 'withdraw').press('Enter')
    await painted('return-42mm')
    // Rotation and deflection retain their meaning on both sides of the handoff.
    await setRange(page, 'rotate', 30)
    await setRange(page, 'deflect', 10)
    await painted('return-rotated-deflected')
    await approach()
    await painted('repeat-approach-42mm')
    await expect(page.locator('[data-view-signal]')).toHaveAttribute('data-view-signal', 'clear')
    expect(await earlierRecord(page)).toBeNull()
    expect((await record(page)).reviewedSectionIds).toEqual([])
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await skip(page).click()
    await expect(page.locator('[data-scope-place]')).toHaveCount(0)
    expect(await earlierRecord(page)).toBeNull()
  })
}

test('one entry, explanation before an answer, Back review and a reload that restores no answer', async ({
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
  await expect(skip(page)).toHaveText('Continue without answering')
  await page.locator('[data-show-explanation]').click()
  await expect(page.locator('[data-explanation-reveal]')).toBeVisible()
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
  const item = check.interaction.stage.item
  const wrong = item.choices.find((entry) => !item.correctChoiceIds.includes(entry.id))!
  await page.locator('[data-prediction-choices] input[value="' + wrong.id + '"]').check()
  await primary(page).click()
  await expect(page.locator('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'not-correct',
  )
  const saved = await record(page)
  expect(saved).toMatchObject({ visitedSectionIds: ['shared-airway'], reviewedSectionIds: [] })
  expect(Object.keys(saved).sort()).toEqual([
    'lastSectionId',
    'reviewLaterSectionIds',
    'reviewedSectionIds',
    'surveySnapshot',
    'updatedAt',
    'version',
    'visitedSectionIds',
  ])
  expect(await earlierRecord(page)).toBeNull()
  await page.reload()
  await expect(stage(page)).toHaveAttribute('data-stage', lesson.steps[0].id)
  for (let index = 0; index < lesson.predictionStepIndex; index++) await primary(page).click()
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
  await expect(page.locator('[data-prediction-choices] input:checked')).toHaveCount(0)
  await skip(page).click()
  await expect(stage(page)).toHaveAttribute(
    'data-stage',
    lesson.steps[lesson.predictionStepIndex + 1].id,
  )
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
      for (const step of lesson.steps.slice(1)) {
        await expect(stage(page)).toHaveAttribute('data-stage', step.id)
        if (step.interaction.kind === 'prediction') {
          const item = step.interaction.stage.item
          // Current teaching has no example-specific answer; key/rationales are not rendered.
          const teachingText = await page.locator('[data-pilot-teaching]').textContent()
          for (const denied of lesson.section.precommitDenyPatterns)
            expect(teachingText).not.toMatch(denied)
          await expect(skip(page)).toHaveText('Continue without answering')
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
          expect(await earlierRecord(page)).toBeNull()
          await pilotAction(page, 'Try this check again')
          await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
          await page.screenshot({ path: info.outputPath('06-check-retry.png') })
          await page
            .locator('[data-prediction-choices] input[value="' + item.correctChoiceIds[0] + '"]')
            .check()
          await primary(page).click()
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
            expect((await record(page)).reviewedSectionIds).toEqual([])
          }
          if (step.learn?.id === 'depth') {
            await pilotAction(page, 'Watch the example')

            await ready(page)
            await expect(page.locator('[data-readout="depthMm"] dd')).toContainText('12 mm')
            await expect(control(page, 'advance')).toBeDisabled()
            await page.locator('[data-three-state]').scrollIntoViewIfNeeded()
            await page.screenshot({ path: info.outputPath('03-real-engine-demonstration.png') })
            await pilotAction(page, 'Next demonstration movement')
            expect((await record(page)).reviewedSectionIds).toEqual([])
            expect(await earlierRecord(page)).toBeNull()
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
            await expect(skip(page)).toHaveText('Continue without completing')
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
      await expect(page.locator('[data-section-completion]')).toHaveAttribute(
        'data-reviewed',
        'true',
      )
      await page.screenshot({ path: info.outputPath('10-completion.png') })
      expect((await record(page)).reviewedSectionIds).toEqual(['five-controls'])
      expect(await earlierRecord(page)).toBeNull()
      await expect(page.locator('[data-section-completion] [data-next-section]')).toHaveAttribute(
        'data-next-section',
        'branch-entry',
      )
      await page.reload()
      await expect(stage(page)).toHaveAttribute('data-stage', lesson.steps[0].id)
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
  expect((await record(page)).reviewedSectionIds).toEqual([])
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
  await expect(skip(page)).toHaveText('Continue without completing')
  await expect(page.locator('[data-scope-scene]')).toContainText(
    'Entering an airway is not inspecting it',
  )
})

test('a survey left without completing it saves no survey and claims nothing', async ({ page }) => {
  const lesson = await openSection(page, 'systematic-survey')
  for (let guard = 0; guard <= lesson.steps.length + 1; guard++) {
    if (await page.locator('[data-section-completion]').count()) break
    if (await skip(page).count()) await skip(page).click()
    else await primary(page).click()
  }
  await expect(page.locator('[data-section-completion]')).toBeVisible()
  await expect(page.locator('[data-completion-moved-past]')).toBeVisible()
  const saved = await record(page)
  expect(saved.reviewedSectionIds).toEqual(['systematic-survey'])
  expect(saved.surveySnapshot).toBeNull()
  expect(await earlierRecord(page)).toBeNull()
})

test('the report refuses unsupported claims and only opens Continue when every field is supported', async ({
  page,
}) => {
  const { lesson } = await reachAct(page, 'honest-report')
  const interaction = lesson.steps.find((step) => step.interaction.kind === 'report')!.interaction
  if (interaction.kind !== 'report') throw new Error('Report expected')
  await expect(primary(page)).toHaveCount(0)
  await expect(skip(page)).toHaveText('Continue without completing')
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

test('Practice explains before an answer, lets the learner try again, saves nothing and offers its paired lesson', async ({
  page,
}) => {
  await page.goto(base + '/practice')
  await page.locator('[data-next-case]').click()
  await expect(page.locator('[data-prediction-choices]')).toBeVisible()
  await expect(page.locator('a[href*="learn?section="]')).not.toHaveCount(0)
  await page.getByRole('button', { name: 'Show the explanation' }).click()
  await expect(page.locator('[data-explanation-reveal]')).toBeVisible()
  await page.locator('[data-prediction-choices] input').first().check()
  await page.getByRole('button', { name: 'Check my answer' }).click()
  await expect(page.locator('[data-answer-verdict]')).toHaveAttribute('data-revealed', 'true')
  await page.locator('[data-answer-again]').click()
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
  expect(await record(page)).toBeNull()
  expect(await earlierRecord(page)).toBeNull()
})

test('integrated cases open without the sections, give immediate safety feedback and keep no standard', async ({
  page,
}) => {
  await page.goto(base + '/assess')
  await expect(page.locator('[data-integrated-case]')).toHaveCount(CAPSTONE_CASES.length)
  await expect(page.locator('[data-prediction-choices]')).toHaveCount(CAPSTONE_CASES.length)
  const entry = CAPSTONE_CASES.find((candidate) =>
    capstoneStageItem(candidate.id).item.choices.some((choice) => choice.plausibility === 'unsafe'),
  )!
  const item = capstoneStageItem(entry.id).item
  const card = page.locator('[data-integrated-case="' + entry.id + '"]')
  await card.locator('[data-show-explanation]').click()
  await expect(card.locator('[data-explanation-reveal]')).toBeVisible()
  const unsafe = item.choices.find((option) => option.plausibility === 'unsafe')!
  await card.locator('input[value="' + unsafe.id + '"]').check()
  await card.locator('[data-check-answer]').click()
  await expect(card.locator('[data-answer-verdict][role="alert"]')).toBeVisible()
  await card.locator('[data-answer-again]').click()
  await card.locator('input[value="' + item.correctChoiceIds[0] + '"]').check()
  await card.locator('[data-check-answer]').click()
  await expect(card.locator('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'correct',
  )
  await expect(page.locator('[data-assess-landing]')).not.toContainText(
    /Standard met|not yet met|decided once/i,
  )
  await page.reload()
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
  expect(await record(page)).toBeNull()
  expect(await earlierRecord(page)).toBeNull()
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
    expect((await record(page)).reviewedSectionIds).toContain(id)
    expect(await earlierRecord(page)).toBeNull()
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
  // The left lung still opens on its tour; the rewritten right lung opens on its hook.
  await openSection(page, 'left-side')
  await expect(page.locator('[data-media-state="failed"]').first()).toBeVisible()
  expect((await record(page)).reviewedSectionIds).toEqual([])
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

/**
 * BF-PRE-REVIEW-01: the worked example, the scripted clock and a finished card, in a real browser.
 *
 * These are the three things the fellow walkthrough found disagreeing with the model. They are
 * exercised here with native pointer and keyboard actions on the real route, because the engine
 * fixtures already passed while the page did not: the fixtures send the scripted clock as a
 * learner input mode, and the pane sends it as `scripted`.
 */
const readout = (page: Page, id: string) => page.locator('[data-readout="' + id + '"]')

test('the worked accessory exchange keeps its false report and still ends protected', async ({
  page,
}) => {
  await reachAct(page, 'protected-accessories')
  await ready(page)
  const caption = page.locator('[data-demonstration-caption]')
  const message = page.locator('[data-scope-message]')
  const accessory = control(page, 'accessory')
  await primary(page).click()
  await expect(caption).toContainText('protected brush enters the channel')
  const captions: string[] = []
  for (let i = 0; i < 7; i++) {
    await primary(page).click()
    captions.push((await caption.textContent()) ?? '')
    // The assistant's false report is the teaching moment; it must still be here.
    if (/reports it done/.test(captions[i])) {
      await expect(message).toContainText('back in its sheath')
      await expect(accessory).toHaveValue('brush-exposed')
    }
    if (/report does not hold/.test(captions[i])) {
      await expect(message).toContainText('disagree')
      await expect(accessory).toHaveValue('brush-exposed')
    }
  }
  expect(captions.some((text) => /reports it done/.test(text))).toBe(true)
  expect(captions.some((text) => /report does not hold/.test(text))).toBe(true)
  // The example ends in the state its last line narrates, with no refusal on the way.
  await expect(caption).toContainText('protected brush returns into the channel')
  await expect(accessory).toHaveValue('brush-sheathed')
  await expect(control(page, 'accessory-move')).toHaveValue('in-channel')
  await expect(message).toHaveCount(0)
  // Watching it is not doing it: the learner's own attempt starts from nothing.
  await page.getByRole('button', { name: 'Try with guidance' }).click()
  await expect(accessory).toHaveValue('brush-sheathed')
  await expect(control(page, 'accessory-move')).toHaveValue('none')
  expect(await page.locator('[data-step-goals] li[data-met="true"]').count()).toBe(0)
  expect((await record(page)).reviewedSectionIds).toEqual([])
  // Replaying starts the example again from its first movement, on its own state.
  await page.getByRole('button', { name: 'Replay the example' }).click()
  await expect(caption).toContainText('protected brush enters the channel')
  await expect(control(page, 'accessory-move')).toHaveValue('in-channel')
  await page.getByRole('button', { name: 'Try with guidance' }).click()
  await expect(control(page, 'accessory-move')).toHaveValue('none')
  expect(await page.locator('[data-step-goals] li[data-met="true"]').count()).toBe(0)
  expect((await record(page)).reviewedSectionIds).toEqual([])
})

test.describe('the scripted scene runs on its own clock', () => {
  // The module config holds motion reduced for the pixel journeys; these two need it running.
  test.use({ contextOptions: { reducedMotion: 'no-preference' } })

  test('the authored breath moves on its own, and the crossing becomes reachable', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await reachAct(page, 'larynx-and-entry')
    await ready(page)
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
      false,
    )
    const folds = readout(page, 'cordsState')
    const crossed = page.locator('[data-goal="cross-glottis-open"]')
    // Nothing is pressed here: the patient breathes whether or not the learner acts.
    await expect(folds).toContainText('breath out', { timeout: 20_000 })
    await expect(folds).toContainText('breath in', { timeout: 20_000 })
    await expect(folds).toContainText('breath out', { timeout: 20_000 })
    // With the folds opening, a crossing timed to the opening is reachable at last.
    for (let i = 0; i < 25 && (await crossed.getAttribute('data-met')) !== 'true'; i++) {
      await expect(folds).toContainText('breath in', { timeout: 20_000 })
      await control(page, 'advance').press('Enter')
    }
    await expect(crossed).toHaveAttribute('data-met', 'true')
  })

  test('the carina hold runs down on its own and finishes on the learner’s actions', async ({
    page,
  }) => {
    const lesson = await openSection(page, 'branch-entry')
    for (const step of lesson.steps) {
      if (step.course?.id === 'hold-view') break
      const leave = skip(page)
      if (await leave.count()) await leave.click()
      else await primary(page).click()
    }
    await ready(page)
    const hold = readout(page, 'holdRemaining')
    await expect(hold).toContainText('scripted seconds still to run')
    // The clock runs with no learner action at all — and running out is not the hold.
    await expect(hold).toContainText('the assistant is still waiting', { timeout: 30_000 })
    for (const id of ['acknowledge', 'capture', 'hold', 'no-drift'])
      await expect(page.locator('[data-goal="' + id + '"]')).toHaveAttribute('data-met', 'false')
    await control(page, 'acknowledge').press('Enter')
    await expect(page.locator('[data-goal="hold"]')).toHaveAttribute('data-met', 'false')
    await control(page, 'capture').press('Enter')
    await expect(hold).toContainText('finished')
    for (const id of ['acknowledge', 'capture', 'hold', 'no-drift'])
      await expect(page.locator('[data-goal="' + id + '"]')).toHaveAttribute('data-met', 'true')
    await expect(primary(page)).toBeEnabled()
    // The lead reports the record and the live readings; it never approves the image.
    await expect(page.locator('[data-now-status]')).toHaveText(
      'Recorded: every step this card asks for, and its live readings hold.',
    )
    await expect(page.locator('[data-goal-group]')).toHaveAttribute('data-goal-group', 'mixed')
  })
})

test('closed folds still refuse the advance, and the manual step is the reduced-motion way on', async ({
  page,
}) => {
  // The module config holds motion reduced; the scene then exposes Step one second, and the
  // authored breath moves only when the learner moves it. That makes this check exact.
  test.setTimeout(240_000)
  await reachAct(page, 'larynx-and-entry')
  await ready(page)
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true,
  )
  await expect(page.locator('[data-scripted-scene="held"]')).toBeVisible()
  const folds = readout(page, 'cordsState')
  const crossed = page.locator('[data-goal="cross-glottis-open"]')
  const refusal = page.locator('[data-scope-message]', { hasText: 'not apart' })
  await control(page, 'reset').click()
  await expect(folds).toContainText('breath out')
  // The folds stay where the clock left them, so every press at the glottis meets them closed.
  let refused = false
  for (let i = 0; i < 20 && !refused; i++) {
    await control(page, 'advance').press('Enter')
    refused = await refusal.waitFor({ state: 'attached', timeout: 1000 }).then(
      () => true,
      () => false,
    )
  }
  expect(refused).toBe(true)
  await expect(folds).toContainText('breath out')
  await expect(crossed).toHaveAttribute('data-met', 'false')
  await expect(page.locator('[data-goal="no-advance-against-closure"]')).toHaveAttribute(
    'data-met',
    'false',
  )
  // Stepping the same authored cycle by hand opens the folds, and the same press then crosses.
  for (let i = 0; i < 8 && !(await folds.textContent())?.includes('breath in'); i++)
    await control(page, 'step').press('Enter')
  await expect(folds).toContainText('breath in')
  await control(page, 'advance').press('Enter')
  await expect(crossed).toHaveAttribute('data-met', 'true')
  await expect(refusal).toHaveCount(0)
})

// The report's own desktop viewport, and a phone: the bounded card has to read on both.
for (const viewport of [
  { width: 1204, height: 987 },
  { width: 390, height: 844 },
]) {
  test(
    'a finished card after an overshoot reports a record and not a view at ' + viewport.width,
    async ({ page }) => {
      test.setTimeout(240_000)
      await page.setViewportSize(viewport)
      await reachAct(page, 'view-loss')
      await ready(page)
      await control(page, 'withdraw').press('Enter')
      await expect(page.locator('[data-view-signal]')).toHaveAttribute('data-view-signal', 'clear')
      const carina = page.locator('[data-goal="on-to-the-carina"]')
      for (let i = 0; i < 40 && (await carina.getAttribute('data-met')) !== 'true'; i++)
        await control(page, 'advance').press('Enter')
      await expect(carina).toHaveAttribute('data-met', 'true')
      const status = page.locator('[data-now-status]')
      const heading = page.locator('[data-goal-group]')
      const limit = page.locator('[data-goal-now]')
      await expect(status).toHaveText('Recorded: every step this card asks for.')
      await expect(heading).toHaveText('On the record for this attempt')
      await expect(limit).toContainText('does not judge the bronchoscope image')
      // Keep going past the target, the way the walkthrough did.
      for (let i = 0; i < 12; i++) await control(page, 'advance').press('Enter')
      // The events happened, so the ticks stay; the headline still reports only the record.
      await expect(carina).toHaveAttribute('data-met', 'true')
      await expect(status).toHaveText('Recorded: every step this card asks for.')
      await expect(page.locator('[data-now-card]')).not.toContainText(
        'Every goal on this card is met',
      )
      // Where the tip is now stays visible, and separate from the record.
      await expect(limit).toContainText('Where the tip is now:')
      await expect(limit).not.toContainText('Where the tip is now: Trachea.')
      expect(await page.locator('[data-step-goals] li[data-goal-claim="history"]').count()).toBe(3)
      // The pane's own green list carries the same framing, not a bare row of ticks.
      await expect(page.locator('[data-scope-goals-group]')).toHaveText(
        'On the record for this attempt',
      )
      await expect(page.locator('[data-scope-goals-limit]')).toContainText(
        'does not judge the bronchoscope image',
      )
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
      const themeOf = () =>
        page.evaluate(() =>
          document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        )
      const shot = async (theme: string) =>
        page.locator('[data-now-card]').screenshot({
          path:
            'test-results/bronchoscopy-foundations/overshoot-card-' +
            viewport.width +
            '-' +
            theme +
            '.png',
        })
      const first = await themeOf()
      await shot(first)
      // The same card in the other theme: the heading and the limit are the learner's only
      // protection against reading the ticks as approval, so neither may disappear. The site's
      // theme control sits inside the collapsed navigation at phone width, which is this module's
      // chrome rather than its card, so the theme pass runs at the desktop width.
      if (viewport.width >= 1024) {
        const themeToggle = page.locator('button[aria-label="Toggle dark mode"]').first()
        await expect(themeToggle).toBeVisible({ timeout: 15_000 })
        await themeToggle.click()
        await expect.poll(themeOf, { timeout: 10_000 }).not.toBe(first)
        await expect(heading).toBeVisible()
        await expect(limit).toBeVisible()
        await expect(status).toHaveText('Recorded: every step this card asks for.')
        await expect(page.locator('[data-scope-goals-limit]')).toBeVisible()
        await shot(await themeOf())
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
    },
  )
}

test('a completed inspection record stays a record after the scope leaves those airways', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await reachAct(page, 'systematic-survey')
  await ready(page)
  // Every goal on this card reads the attempt: the sequences it walked and the record it wrote.
  const rows = page.locator('[data-step-goals] li')
  await expect(rows).toHaveCount(5)
  expect(await page.locator('[data-step-goals] li[data-goal-claim="history"]').count()).toBe(5)
  await expect(page.locator('[data-goal-group]')).toHaveAttribute('data-goal-group', 'history')
  await expect(page.locator('[data-now-card]')).not.toContainText('Read from the scope right now')
  await expect(page.locator('[data-goal-now]')).toContainText('Where the tip is now:')
})

/**
 * BF-PRE-REVIEW-02: the sources, Reading the view, the activities' own actions and the feedback
 * after them, on the real route with native pointer and keyboard input (fellow walkthrough A8–A10,
 * A12–A13, A15–A16, the module's part of A43, SUP-02, SUP-17). Each case fails against a build of
 * the unchanged baseline.
 */
test.describe('BF-PRE-REVIEW-02: sources, tables and the way on', () => {
  const CYAN = 'rgb(113, 225, 229)'

  async function stepTo(
    page: Page,
    id: BronchSectionId,
    kind: string,
    options: { readonly grammar?: boolean } = {},
  ) {
    const lesson = await openSection(page, id)
    const index = lesson.steps.findIndex((step) =>
      options.grammar
        ? step.course?.grammar === true
        : step.interaction.kind === kind && step.course?.kind !== 'transfer',
    )
    for (let i = 0; i < index; i += 1) {
      if (await skip(page).count()) await skip(page).click()
      else await primary(page).click()
      await expect(stage(page)).toHaveAttribute('data-stage', lesson.steps[i + 1].id)
    }
    return { lesson, step: lesson.steps[index], index }
  }

  /** The element, scrolled to its start, is what the browser hits there and is not under chrome. */
  async function startReadable(locator: Locator) {
    return locator.evaluate((element) => {
      element.scrollIntoView({ block: 'start' })
      const header = document.getElementById('main-content')?.previousElementSibling
      const headerBottom = header ? header.getBoundingClientRect().bottom : 0
      const rect = element.getBoundingClientRect()
      const hit = document.elementFromPoint(
        rect.left + Math.min(16, rect.width / 2),
        rect.top + Math.min(10, rect.height / 2),
      )
      return {
        top: Math.round(rect.top),
        headerBottom: Math.round(headerBottom),
        hitSelf: !!hit && (hit === element || element.contains(hit)),
      }
    })
  }

  /**
   * The focused element is on screen, below the header, and nothing is painted over it. A wrapped
   * inline control (a link across two lines at enlarged text) is tested at the centre of every
   * line fragment, since the centre of its union box can fall on the text beside it.
   */
  async function focusUncovered(page: Page) {
    return page.evaluate(() => {
      const element = document.activeElement as HTMLElement
      const header = document.getElementById('main-content')?.previousElementSibling
      const headerBottom = header ? header.getBoundingClientRect().bottom : 0
      const rect = element.getBoundingClientRect()
      const fragments = [...element.getClientRects()].filter((box) => box.width > 0)
      return {
        label: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40),
        inView: rect.top >= headerBottom - 1 && rect.bottom <= innerHeight + 1,
        hitSelf:
          fragments.length > 0 &&
          fragments.every((box) => {
            const hit = document.elementFromPoint(
              (box.left + box.right) / 2,
              (box.top + box.bottom) / 2,
            )
            return !!hit && (hit === element || element.contains(hit))
          }),
      }
    })
  }

  /**
   * Whether the course itself fits the viewport width. At 200% root text the site's own header and
   * footer links overflow the page on unchanged main too (not this module's), so the enlarged-text
   * cases check the course region and record the page separately.
   */
  async function courseFits(page: Page) {
    return page.evaluate(() => {
      const course = document.querySelector<HTMLElement>(
        '[data-module="bronchoscopy-foundations"]',
      )!
      const rect = course.getBoundingClientRect()
      return (
        course.scrollWidth <= course.clientWidth + 1 &&
        rect.left >= -1 &&
        rect.right <= document.documentElement.clientWidth + 1
      )
    })
  }

  /** The continuation bar, pinned or not, and the open list, in the same viewport coordinates. */
  async function barAndList(page: Page) {
    return page.evaluate(() => {
      const bar = [...document.querySelectorAll('[data-now-card] *')].find(
        (element) => getComputedStyle(element).position === 'sticky',
      )
      const list = document.querySelector('[data-stage-sources] > div')!
      const rect = (element: Element | undefined) => {
        if (!element) return null
        const box = element.getBoundingClientRect()
        return { top: Math.round(box.top), bottom: Math.round(box.bottom) }
      }
      return { bar: rect(bar), list: rect(list), position: getComputedStyle(list).position }
    })
  }

  test('each source is labelled as what it is, and copy and open keep its identity', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.setViewportSize({ width: 1204, height: 987 })
    for (const sectionId of ['shared-airway', 'sedation-and-monitoring', 'view-loss'] as const) {
      await openSection(page, sectionId)
      const summary = page.locator('[data-stage-sources] summary')
      await summary.scrollIntoViewIfNeeded()
      await summary.click()
      for (const { source } of bronchStageSources(sectionId).records) {
        const row = page.locator(`[data-stage-sources] [data-evidence-id="${source.id}"]`)
        await expect(row).toHaveAttribute('data-source-class', source.sourceClass)
        await expect(row.locator('[data-source-kind]')).toHaveText(source.kindLabel)
        const text = (await row.textContent()) ?? ''
        expect([source.id, text.split(TRANSCRIPT_SENTENCE).length - 1]).toEqual([
          source.id,
          source.sourceClass === 'transcript' ? 1 : 0,
        ])
      }
    }
    // Textbook, manuals and guidelines, by id, on the real route.
    await openSection(page, 'shared-airway')
    await page.locator('[data-stage-sources] summary').click()
    for (const id of ['S1', 'S2', 'S3', 'U1'])
      await expect(page.locator(`[data-stage-sources] [data-evidence-id="${id}"]`)).toHaveAttribute(
        'data-source-class',
        'reference',
      )
    await expect(
      page.locator('[data-stage-sources] [data-evidence-id="S1"] [data-source-locator-note]'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Copy citation for S2' }).click()
    await expect(page.getByRole('button', { name: 'Citation for S2 copied' })).toBeVisible()
    const s2 = SOURCE_BY_ID.get('S2')!
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${s2.byline}. ${s2.title} (${s2.year}).`,
    )
    const open = page.getByRole('link', { name: /Open source U1/ })
    await expect(open).toHaveAttribute('href', SOURCE_BY_ID.get('U1')!.url!)
    await expect(open).toHaveAttribute('target', '_blank')
  })

  for (const viewport of [
    { width: 1204, height: 987 },
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ])
    for (const text of [100, 200] as const)
      test(`the open source list clears the continuation bar at ${viewport.width}×${viewport.height}, ${text}% text`, async ({
        page,
      }, info) => {
        await page.setViewportSize(viewport)
        // The longest list the course has, so first and last are far apart.
        const longest = [...(['shared-airway', 'bleeding-priorities', 'view-loss'] as const)].sort(
          (a, b) => bronchStageSources(b).records.length - bronchStageSources(a).records.length,
        )[0]
        await openSection(page, longest)
        if (text === 200)
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '200%'
          })
        const summary = page.locator('[data-stage-sources] summary')
        await summary.scrollIntoViewIfNeeded()
        await summary.click()
        await expect(page.locator('[data-stage-sources]')).toHaveAttribute('open', '')
        const opened = await barAndList(page)
        const items = page.locator('[data-stage-sources] [data-evidence-id]')
        const first = await startReadable(items.first())
        const firstBar = await barAndList(page)
        const last = await startReadable(items.last())
        const lastBar = await barAndList(page)
        const measured = { opened, first, firstBar, last, lastBar }
        await info.attach('measurements', {
          body: JSON.stringify(measured, null, 1),
          contentType: 'application/json',
        })
        for (const state of [opened, firstBar, lastBar])
          if (state.bar && state.list)
            expect(state.bar.bottom <= state.list.top || state.bar.top >= state.list.bottom).toBe(
              true,
            )
        for (const edge of [first, last]) {
          expect(edge.hitSelf).toBe(true)
          expect(edge.top).toBeGreaterThanOrEqual(edge.headerBottom - 1)
        }
        // Keyboard: every control in the list is reached in view and uncovered, then Escape
        // closes the list and returns to its summary.
        await summary.focus()
        const stops: Awaited<ReturnType<typeof focusUncovered>>[] = []
        for (let guard = 0; guard < 40; guard += 1) {
          await page.keyboard.press('Tab')
          const inside = await page.evaluate(
            () => !!document.activeElement?.closest('[data-stage-sources] > div'),
          )
          if (!inside) break
          stops.push(await focusUncovered(page))
        }
        expect(stops.length).toBeGreaterThanOrEqual(await items.count())
        for (const stop of stops)
          expect([stop.label, stop.inView, stop.hitSelf]).toEqual([stop.label, true, true])
        await page.keyboard.press('Shift+Tab')
        await page.keyboard.press('Escape')
        await expect(page.locator('[data-stage-sources]')).not.toHaveAttribute('open', '')
        await expect(summary).toBeFocused()
        expect(await courseFits(page)).toBe(true)
        if (text === 100)
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          ).toBe(true)
      })

  // The rewritten sections (the right lung, bleeding) close on their checklist and do not print
  // the table in the lesson; the Reference keeps all of it.
  const GRAMMAR_SECTIONS = [
    'branch-entry',
    'view-loss',
    'larynx-and-entry',
    'left-side',
    'systematic-survey',
    'poor-return',
    'protected-accessories',
    'deterioration',
    'scope-in-a-tube',
  ] as const

  async function expectGrammarRows(table: Locator, rowIds: readonly string[]) {
    await expect(table.locator('tbody tr[data-grammar-row]')).toHaveCount(rowIds.length)
    for (const id of rowIds) {
      const row = BRONCH_GRAMMAR.find((entry) => entry.id === id)!
      const tr = table.locator(`tr[data-grammar-row="${id}"]`)
      await expect(tr.locator('th[scope="row"]')).toContainText(row.see)
      await expect(tr.locator('[data-grammar-cell="lives"]')).toContainText(row.lives)
      await expect(tr.locator('[data-grammar-cell="shortlist"] li')).toHaveText([...row.shortlist])
      await expect(tr.locator('[data-grammar-cell="control"]')).toContainText(
        grammarRowControl(row),
      )
    }
  }

  test('Reading the view is a table at every lesson occurrence and matches the Reference', async ({
    page,
  }) => {
    test.setTimeout(300_000)
    await page.setViewportSize({ width: 1204, height: 987 })
    let occurrences = 0
    for (const id of GRAMMAR_SECTIONS) {
      const lesson = await openSection(page, id)
      const rowIds = bronchSection(id).grammarRowIds
      for (const [index, step] of lesson.steps.entries()) {
        if (step.course?.grammar) {
          const table = page.getByRole('table', { name: 'Connect the observation to the problem' })
          await expect(table).toBeVisible()
          await expect(table.locator('thead th')).toHaveText([
            'You see',
            'Where it lives',
            'Shortlist',
            'Which control, if any',
          ])
          await expectGrammarRows(table, rowIds)
          occurrences += 1
        }
        if (index === lesson.steps.length - 1) break
        if (await skip(page).count()) await skip(page).click()
        else await primary(page).click()
        await expect(stage(page)).toHaveAttribute('data-stage', lesson.steps[index + 1].id)
      }
    }
    // Nine sections, eleven places: view-loss and poor-return show the rows twice. The two
    // rewritten sections no longer print the table in the lesson.
    expect(occurrences).toBe(11)
    await page.goto(base + '/reference')
    const reference = page.locator('#reading-the-view table[data-grammar]')
    await expect(reference.locator('thead th')).toHaveText([
      'You see',
      'Where it lives',
      'Shortlist',
      'Which control, if any',
      'Taught in',
    ])
    await expectGrammarRows(
      reference,
      BRONCH_GRAMMAR.map((row) => row.id),
    )
  })

  for (const viewport of [
    { width: 390, height: 844, text: 100 },
    { width: 320, height: 740, text: 100 },
    { width: 1204, height: 987, text: 200 },
  ])
    test(`Reading the view stacks into labelled rows at ${viewport.width}px, ${viewport.text}% text`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await stepTo(page, 'view-loss', 'read', { grammar: true })
      if (viewport.text === 200)
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%'
        })
      const table = page.getByRole('table', { name: 'Connect the observation to the problem' })
      await table.scrollIntoViewIfNeeded()
      const firstRow = table.locator('tbody tr').first()
      await expect(firstRow.locator('[data-grammar-cell-label]').first()).toBeVisible()
      await expect(firstRow.locator('[data-grammar-cell-label]')).toHaveText([
        'You see',
        'Where it lives',
        'Shortlist',
        'Which control, if any',
      ])
      expect((await table.locator('thead').boundingBox())?.width ?? 0).toBeLessThanOrEqual(1)
      const fits = await table.evaluate(
        (element) => element.scrollWidth <= element.parentElement!.clientWidth + 1,
      )
      expect(fits).toBe(true)
      expect(await courseFits(page)).toBe(true)
      if (viewport.text === 100)
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true)
      // The browser's own accessibility tree keeps the observation as each row's header.
      const cdp = await page.context().newCDPSession(page)
      const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as {
        nodes: { role?: { value: string }; name?: { value: string } }[]
      }
      const rowHeaders = nodes
        .filter((node) => node.role?.value === 'rowheader')
        .map((node) => node.name?.value ?? '')
      for (const id of bronchSection('view-loss').grammarRowIds)
        expect(
          rowHeaders.some((name) =>
            name.includes(BRONCH_GRAMMAR.find((row) => row.id === id)!.see),
          ),
        ).toBe(true)
    })

  test('the S4 ledger is checked with a visible primary Check, by keyboard, without new dose rules', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1204, height: 987 })
    const { step } = await stepTo(page, 'sedation-and-monitoring', 'ledger')
    if (step.interaction.kind !== 'ledger') throw new Error('not a ledger')
    const { ledger } = step.interaction
    const check = page.locator('[data-ledger-answer]')
    await expect(check).toHaveText('Check this answer')
    await expect(check).toBeDisabled()
    const box = (await check.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.width).toBeLessThan(400)
    // Disabled stays readable: the course's disabled primary, not a missing control.
    await expect(check).toHaveCSS('opacity', '1')
    await expect(check).toHaveCSS('background-color', 'rgb(31, 66, 73)')
    await expect(skip(page)).toHaveText('Continue without completing')
    // A false total: every entry off by the same amount is flagged, and the question can still be
    // checked — the entries carry no dose judgement.
    for (const row of ledger.rows)
      if (row.kind === 'measured') {
        const input = page.locator(`[data-ledger-row="${row.id}"] input[type="number"]`)
        await input.focus()
        await page.keyboard.type(String(row.concentrationMgPerMl * row.volumeMl + 7))
      }
    await expect(page.locator('[data-ledger-check="recheck"]')).toHaveCount(
      ledger.rows.filter((row) => row.kind === 'measured').length,
    )
    await expect(page.locator('[data-ledger-check-reason]')).toHaveText(
      'Choose a statement, then check it.',
    )
    const unsafe = ledger.totalChoices.find((choice) => choice.plausibility === 'unsafe')!
    await page.locator(`[data-ledger-total] input[value="${unsafe.id}"]`).check()
    await page.keyboard.press('Tab')
    await expect(check).toBeFocused()
    await expect(check).toHaveCSS('outline-style', 'solid')
    await expect(check).toHaveCSS('background-color', CYAN)
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-ledger-outcome="refused"]')).toContainText(
      'Not correct, and unsafe.',
    )
    await expect(page.locator('[data-now-status]')).toHaveText(
      'Choose another statement and check it, open the worked arithmetic, or continue without completing it.',
    )
    await expect(primary(page)).toHaveCount(0)
    const best = ledger.totalChoices.find((choice) => choice.plausibility === 'best')!
    await page.locator(`[data-ledger-total] input[value="${best.id}"]`).check()
    await page.keyboard.press('Tab')
    await expect(check).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-ledger-outcome="held"]')).toBeFocused()
    await expect(page.locator('[data-ledger-outcome="held"] strong')).toHaveText('Correct.')
    await expect(primary(page)).toBeEnabled()
  })

  for (const id of ['poor-return', 'deterioration', 'bleeding-priorities'] as const)
    test(`the ${id} case refuses the unsafe move and shows a visible way to the next observation`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1204, height: 987 })
      const { step } = await stepTo(page, id, 'scenario')
      if (step.interaction.kind !== 'scenario') throw new Error('not a scenario')
      const { frames } = step.interaction.scenario
      const decide = page.locator('[data-scenario-decide]')
      const status = page.locator('[data-now-status]')
      // The unsafe move on the first frame: refused, the frame stays, reveal and skip remain.
      const first = frames[0]
      const unsafe = first.choices.find((choice) => choice.plausibility === 'unsafe')!
      await page.locator(`[data-scenario-frame="${first.id}"] input[value="${unsafe.id}"]`).check()
      await decide.click()
      // In a case that evolves the unsafe move plays out on the monitor; otherwise it is refused.
      if (unsafe.consequence) {
        await expect(page.locator('[data-scenario-outcome="played-out"]')).toContainText(
          'Not correct, and unsafe.',
        )
        await expect(page.locator('[data-scenario-consequence]')).toContainText(
          unsafe.consequence.situation,
        )
        const worse = unsafe.consequence.readings.find((reading) => reading.value)!
        await expect(page.locator('[data-monitor-value]').first()).toContainText(worse.value!)
      } else
        await expect(page.locator('[data-scenario-outcome="refused"]')).toContainText(
          'Not correct, and unsafe.',
        )
      await expect(page.locator('[data-scenario-frame]')).toHaveAttribute(
        'data-scenario-frame',
        first.id,
      )
      await expect(status).toHaveText(
        'Decide again on this observation, open its reasoning, or continue without completing the case.',
      )
      await page.getByRole('button', { name: 'Show the reasoning' }).click()
      await expect(page.locator(`[data-scenario-explanation="${first.id}"]`)).toBeVisible()
      await expect(skip(page)).toBeVisible()
      for (const [index, frame] of frames.entries()) {
        const best = frame.choices.find((choice) => choice.plausibility === 'best')!
        await page.locator(`[data-scenario-frame="${frame.id}"] input[value="${best.id}"]`).check()
        await page.keyboard.press('Tab')
        await expect(decide).toBeFocused()
        await page.keyboard.press('Enter')
        if (index === frames.length - 1) break
        // No automatic advance: the feedback is on screen and the next frame is not.
        await expect(page.locator('[data-scenario-feedback]')).toContainText('Correct.')
        await expect(page.locator('[data-scenario-frame]')).toHaveCount(0)
        await expect(page.locator('[data-scenario-feedback-open]')).toBeFocused()
        await expect(status).toHaveText(
          'Read the feedback on your decision, then continue to the next observation. You can also continue without completing the case.',
        )
        const next = page.getByRole('button', { name: 'Continue to the next observation' })
        await next.scrollIntoViewIfNeeded()
        await expect(next).toBeVisible()
        await expect(next).toHaveCSS('background-color', CYAN)
        expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(44)
        expect(
          await next.evaluate((element) => {
            const rect = element.getBoundingClientRect()
            const hit = document.elementFromPoint(
              (rect.left + rect.right) / 2,
              (rect.top + rect.bottom) / 2,
            )
            return hit === element || element.contains(hit)
          }),
        ).toBe(true)
        await page.keyboard.press('Tab')
        await expect(next).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.locator('[data-scenario-frame]')).toHaveAttribute(
          'data-scenario-frame',
          frames[index + 1].id,
        )
      }
      await expect(page.locator('[data-scenario-done]')).toBeVisible()
      await expect(status).toHaveText('Done. You worked the case to its end.')
      await expect(primary(page)).toBeEnabled()
    })

  for (const viewport of [
    { width: 1204, height: 987 },
    { width: 390, height: 844 },
  ])
    test(`the S1 question stays in view after a wrong answer at ${viewport.width}px, and can be tried again`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      const { step } = await stepTo(page, 'shared-airway', 'prediction')
      if (step.interaction.kind !== 'prediction') throw new Error('not a prediction')
      const { item } = step.interaction.stage
      const wrong = item.choices.find((choice) => choice.plausibility === 'incorrect-mechanism')!
      await page.locator(`[data-prediction-choices] input[value="${wrong.id}"]`).check()
      await primary(page).click()
      const context = page.locator('[data-question-context]')
      await expect(context.locator('[data-question-stem]')).toHaveText(item.stem)
      await expect(context.locator('[data-chosen]')).toContainText(wrong.label)
      await expect(page.locator('[data-verdict-outcome-label]')).toHaveText('Not correct.')
      const comparison = page.locator('[data-answer-verdict] details summary')
      await expect(comparison).toHaveText('How the other answers compare')
      await comparison.click()
      await expect(page.locator('[data-keyed-answer-label]')).toBeVisible()
      await expect(page.locator('[data-answer-verdict]')).not.toContainText(
        'Why the other answers do not fit',
      )
      await page.getByRole('button', { name: 'Try this check again' }).click()
      await expect(page.locator('[data-prediction-choices] input:checked')).toHaveCount(0)
      await expect(page.locator('[data-question-context]')).toHaveCount(0)
    })

  test('the S1 matching set names the authored category, explanation first and after a wrong match', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1204, height: 987 })
    const { step } = await stepTo(page, 'shared-airway', 'sort')
    if (step.interaction.kind !== 'sort') throw new Error('not a sort')
    const { sort } = step.interaction
    const label = (id: string) => sort.origins.find((origin) => origin.id === id)!.label
    await page.getByRole('button', { name: 'Show the worked matches' }).click()
    await expect(
      page.locator('[data-sort-row="lavage-returned"] [data-sort-explanation]'),
    ).toContainText(`Belongs with: ${label('result')}`)
    await expect(page.locator('[data-bronch-sort]')).not.toContainText('?.')
    await page.getByRole('button', { name: 'Hide the explanation' }).click()
    for (const row of sort.rows)
      await page
        .locator(`[data-sort-row="${row.id}"] select`)
        .selectOption(row.id === 'lavage-returned' ? 'what' : row.origin)
    await primary(page).click()
    const verdict = page.locator('[data-sort-row="lavage-returned"] [data-sort-verdict]')
    await expect(verdict).toContainText('Not correct.')
    await expect(verdict).toContainText(`You chose: ${label('what')}`)
    await expect(verdict).toContainText(`Belongs with: ${label('result')}`)
    await expect(page.locator('[data-bronch-sort]')).not.toContainText('Did not hold')
    expect(await page.locator('[data-bronch-sort]').textContent()).not.toMatch(
      /\b\d+\s*(?:of|out of|\/)\s*\d+\b/,
    )
  })
})

test.describe('BF-PRE-REVIEW-03: readable images and coherent scope workspaces', () => {
  /** Move on through a section's steps with the Now card's own actions until one is reached. */
  async function goToStep(page: Page, id: BronchSectionId, stepId: string) {
    const lesson = await openSection(page, id)
    const index = lesson.steps.findIndex((step) => step.id === stepId)
    for (let i = 0; i < index; i += 1) {
      if (await skip(page).count()) await skip(page).click()
      else await primary(page).click()
      await expect(stage(page)).toHaveAttribute('data-stage', lesson.steps[i + 1].id)
    }
    return { lesson, step: lesson.steps[index] }
  }

  /** The outline's screen box against the photograph's: registered if it is the file's own box, scaled. */
  async function registration(figure: Locator) {
    return figure.evaluate((element) => {
      const frame = element.querySelector('[data-media-frame-size]')!
      const img = frame.querySelector('img')!
      const polygon = frame.querySelector('polygon[data-media-outline]') as SVGPolygonElement | null
      if (!polygon) return null
      const svg = polygon.ownerSVGElement!
      const [, , vw, vh] = svg.getAttribute('viewBox')!.split(' ').map(Number)
      const points = polygon.getAttribute('points')!.split(' ').map(Number)
      const xs = points.filter((_, i) => i % 2 === 0)
      const ys = points.filter((_, i) => i % 2 === 1)
      const box = img.getBoundingClientRect()
      const drawn = polygon.getBoundingClientRect()
      const expected = {
        left: box.left + (Math.min(...xs) / vw) * box.width,
        top: box.top + (Math.min(...ys) / vh) * box.height,
        width: ((Math.max(...xs) - Math.min(...xs)) / vw) * box.width,
        height: ((Math.max(...ys) - Math.min(...ys)) / vh) * box.height,
      }
      return {
        error: Math.max(
          Math.abs(drawn.left - expected.left),
          Math.abs(drawn.top - expected.top),
          Math.abs(drawn.width - expected.width),
          Math.abs(drawn.height - expected.height),
        ),
        width: drawn.width,
        height: drawn.height,
      }
    })
  }

  test('S3: the instrument views are readable, open full size by keyboard and keep the chosen name', async ({
    page,
  }, info) => {
    for (const viewport of [
      { width: 1204, height: 987 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport)
      await goToStep(page, 'pre-use-check', 'pre-use-check-flow-v1-application')
      const rows = page.locator('[data-identify-row]')
      await expect(rows).toHaveCount(8)
      const alts = await rows.evaluateAll((elements) =>
        elements.map((row) => row.querySelector('figure img')?.getAttribute('alt')),
      )
      expect(new Set(alts).size).toBe(8)
      await expect(page.locator('details[data-part-reference] dt')).toHaveCount(8)
      for (const view of [2, 3, 6, 8]) {
        const row = rows.nth(view - 1)
        await row.scrollIntoViewIfNeeded()
        // The whole photograph keeps its registered outline at this size...
        const card = await registration(row.locator('figure'))
        expect(card!.error).toBeLessThan(1.5)
        // ...and the detail beside it shows the same outline large enough to read.
        const detail = await row
          .locator('svg[data-media-detail="card"] polygon')
          .evaluate((polygon) => polygon.getBoundingClientRect().width)
        expect(detail).toBeGreaterThan(40)
        expect(detail).toBeGreaterThan(card!.width * 1.5)
      }
      if (viewport.width === 1204) {
        await rows.nth(2).screenshot({ path: info.outputPath('s3-view3-card-1204.png') })
        // Choose a name, open the enlarged view by keyboard, close it with Escape.
        const row = rows.nth(2)
        await row.locator('input[value="working-channel-port"]').check()
        const enlarge = row.getByRole('button', { name: 'Enlarge view 3 of 8' })
        await enlarge.focus()
        await page.keyboard.press('Enter')
        const dialog = page.locator('dialog[data-media-dialog][open]')
        await expect(dialog).toBeVisible()
        await expect(dialog.getByRole('heading', { name: 'View 3 of 8, enlarged' })).toBeVisible()
        await expect(dialog.locator('[data-media-dialog-close]')).toBeFocused()
        const enlarged = await registration(dialog)
        const cardOutline = await registration(row.locator('figure'))
        expect(enlarged!.error).toBeLessThan(1.5)
        // The whole photograph is shown larger than on the card, and the detail beside it makes
        // the outlined part itself large.
        expect(enlarged!.width).toBeGreaterThan(cardOutline!.width * 1.5)
        const enlargedDetail = await dialog
          .locator('svg[data-media-detail="enlarged"] polygon')
          .evaluate((polygon) => polygon.getBoundingClientRect().width)
        expect(enlargedDetail).toBeGreaterThan(100)
        await page.screenshot({ path: info.outputPath('s3-view3-enlarged-1204.png') })
        await page.keyboard.press('Escape')
        await expect(page.locator('dialog[data-media-dialog][open]')).toHaveCount(0)
        await expect(enlarge).toBeFocused()
        await expect(row.locator('input[value="working-channel-port"]')).toBeChecked()
        // Resizing the window keeps the outline on its part.
        await page.setViewportSize({ width: 760, height: 900 })
        expect((await registration(row.locator('figure')))!.error).toBeLessThan(1.5)
      }
    }
  })

  test('S9, S10: honest still captions, real enlargement and a tour grouped by the tree', async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1204, height: 987 })
    await openSection(page, 'larynx-and-entry')
    await expect(page.locator('[data-workspace-caption]')).not.toContainText('annotated')
    const larynx = page.locator('[data-media-workspace] figure').first()
    await larynx.scrollIntoViewIfNeeded()
    await larynx.getByRole('button', { name: 'Enlarge this image' }).click()
    const dialog = page.locator('dialog[data-media-dialog][open]')
    await expect(dialog).toContainText('part of the recorded video frame, not a control')
    await page.screenshot({ path: info.outputPath('s9-larynx-enlarged.png') })
    await page.keyboard.press('Escape')
    await expect(larynx.getByRole('button', { name: 'Enlarge this image' })).toBeFocused()

    // The rewritten right lung walks its stills on two screens, each stop with one line of teaching.
    await goToStep(page, 'right-side', 'right-side-flow-v1-middle-and-lower')
    const tour = page.locator('[data-normal-airway-tour]')
    await expect(tour.locator('[data-tour-group]')).toHaveCount(3)
    for (const label of ['RB4', 'RB6', 'RB10']) {
      await tour.locator(`button[data-tour-airway="${label}"]`).click()
      const figure = tour.locator(`figure[data-media-id="${label.toLowerCase()}"]`)
      await expect(figure.locator('img')).toBeVisible()
      await expect.poll(async () => (await registration(figure))?.error ?? 99).toBeLessThan(1.5)
      await expect(tour.locator('[data-tour-note]')).not.toBeEmpty()
    }
    await tour.locator('button[data-tour-airway="RB6"]').click()
    await expect(tour.locator('[data-tour-note]')).toContainText('posterior wall')
    await tour.locator('button[data-tour-compare-toggle]').click()
    await expect(tour.locator('[data-tour-compare-grid] figure')).toHaveCount(5)
    await expect(tour.locator('[data-tour-frame]')).toHaveCount(0)
    await expect(tour).not.toContainText(/review pending|teaching profile|not recorded/i)
    await tour.screenshot({ path: info.outputPath('s10-tour-compare.png') })
  })

  test('S5: the bench says where the tip points at every angle, read from the model', async ({
    page,
  }, info) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: 1204, height: 987 })
    await goToStep(page, 'five-controls', 'five-controls-learn-bend')
    // While the model loads, the dock is disabled, so no press can count.
    const dock = page.locator('[data-scope-controls]')
    if ((await page.locator('[data-three-state]').getAttribute('data-three-state')) !== 'ready')
      await expect(dock).toHaveAttribute('disabled', '')
    await pilotAction(page, 'Try with guidance')
    await ready(page)
    const compass = page.locator('[data-tip-compass]')
    for (const angle of [0, 15, 60, -60, 120, -120]) {
      await setRange(page, 'deflect', angle)
      await expect(page.locator('[data-control-head]')).toHaveAttribute(
        'data-lever-deflection',
        angle.toFixed(2),
      )
      await expect(compass).toHaveAttribute('data-tip-angle', Math.abs(angle).toFixed(1))
      const toward = await compass.getAttribute('data-tip-toward')
      if (angle === 0) expect(toward).toBe('center')
      else expect(toward).toBe(`0.000,${angle > 0 ? '1.000' : '-1.000'}`)
      await expect(page.locator('[data-bench-off-card]')).toHaveCount(Math.abs(angle) >= 60 ? 1 : 0)
      await expect(compass).toHaveAttribute(
        'data-card-in-view',
        Math.abs(angle) >= 60 ? 'false' : 'true',
      )
      await page.locator('[data-three-state]').scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath(`s5-deflection-${angle}.png`) })
    }
    await setRange(page, 'deflect', 0)

    await goToStep(page, 'five-controls', 'five-controls-learn-rotation')
    await pilotAction(page, 'Try with guidance')
    await ready(page)
    await setRange(page, 'deflect', 30)
    for (const [rotation, bendUp, words] of [
      [0, '0.000,1.000', 'U toward the card’s top'],
      [90, '1.000,0.000', 'U toward the card’s right'],
      [180, '0.000,-1.000', 'U toward the card’s bottom'],
      [-90, '-1.000,0.000', 'U toward the card’s left'],
    ] as const) {
      await setRange(page, 'rotate', rotation)
      await expect(page.locator('[data-control-head]')).toHaveAttribute(
        'data-handle-rotation',
        rotation.toFixed(2),
      )
      await expect(compass).toHaveAttribute('data-tip-angle', '30.0')
      await expect(compass).toHaveAttribute('data-bend-up', bendUp)
      await expect(compass).toContainText(words)
      await compass.scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath(`s5-rotation-${rotation}.png`) })
    }
    await expect(compass).toContainText('the scope view turns 90° clockwise')
    // The keys the page now names still work: select the view, then the arrow deflects.
    await expect(page.locator('[data-keyboard-help]')).toContainText(
      'the up and down arrows deflect',
    )
    await page.locator('[data-three-state] [aria-label^="Scope view"]').first().click()
    await page.keyboard.press('ArrowUp')
    await expect(compass).toHaveAttribute('data-tip-angle', '35.0')
  })

  test('S6: at the main carina the labels point at their own openings and each view states its frame', async ({
    page,
  }, info) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: 1204, height: 987 })
    await goToStep(page, 'branch-entry', 'branch-entry-flow-v1-application')
    await ready(page)
    // Held keys are discoverable, and W advances once the view is selected.
    await expect(page.locator('[data-keyboard-help]')).toContainText('Hold a movement key')
    await page.locator('[data-three-state] [aria-label^="Scope view"]').first().click()
    const carina = page.locator('[data-goal="reach-carina"]')
    for (let i = 0; i < 60 && (await carina.getAttribute('data-met')) !== 'true'; i++)
      await page.keyboard.press('w')
    await expect(carina).toHaveAttribute('data-met', 'true')
    await page.locator('[data-three-state]').scrollIntoViewIfNeeded()
    const pins = page.locator('[data-three-state] [data-ostium-pin]')
    await expect(pins).toHaveCount(2)
    const boxes = await pins.evaluateAll((elements) =>
      elements.map((element) => {
        const r = element.getBoundingClientRect()
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
      }),
    )
    const gap = Math.max(
      Math.max(boxes[0].left, boxes[1].left) - Math.min(boxes[0].right, boxes[1].right),
      Math.max(boxes[0].top, boxes[1].top) - Math.min(boxes[0].bottom, boxes[1].bottom),
    )
    expect(gap).toBeGreaterThanOrEqual(8)
    // Every moved caption keeps a dot on its own opening and a line to it.
    const leaders = await page.evaluate(() =>
      [...document.querySelectorAll('[data-ostium-leader]')].map((line) => {
        const label = line.getAttribute('data-ostium-leader')!
        const anchor = document.querySelector(`[data-ostium-anchor="${label}"]`) as HTMLElement
        return {
          label,
          x: Number(line.getAttribute('x1')),
          y: Number(line.getAttribute('y1')),
          anchorLeft: parseFloat(anchor.style.left),
          anchorTop: parseFloat(anchor.style.top),
        }
      }),
    )
    for (const leader of leaders) {
      expect(leader.x).toBeCloseTo(leader.anchorLeft, 3)
      expect(leader.y).toBeCloseTo(leader.anchorTop, 3)
    }
    await expect(page.locator('[data-patient-tick]')).toHaveText(['A', 'L'])
    await expect(page.locator('[data-frame-badge="map"]')).toContainText(
      'patient’s right is on the map’s left',
    )
    await expect(page.locator('[data-frame-badge="scope"]')).toContainText(
      'A marks the patient’s front',
    )
    await page
      .locator('[data-three-state]')
      .screenshot({ path: info.outputPath('s6-carina-1204.png') })
    // The ticks turn with the picture: a quarter turn of the control section moves A by a quarter.
    const angleOf = () =>
      page.locator('[data-patient-tick="A"]').evaluate((tick) => {
        const view = tick.parentElement!.getBoundingClientRect()
        const box = tick.getBoundingClientRect()
        const x = box.left + box.width / 2 - (view.left + view.width / 2)
        const y = view.top + view.height / 2 - (box.top + box.height / 2)
        return (Math.atan2(y, x) * 180) / Math.PI
      })
    const before = await angleOf()
    await setRange(page, 'rotate', 90)
    const turned = await angleOf()
    const delta = ((((turned - before + 180) % 360) + 360) % 360) - 180
    expect(Math.abs(delta - 90)).toBeLessThan(8)
    await setRange(page, 'rotate', 0)

    // "Show me where" names a control from the model, and following it enters the bronchus.
    const inputs = () =>
      page.evaluate(() => {
        const line = document.querySelector('[data-input-mode]')!
        return `${line.getAttribute('data-input-mode')}|${line.getAttribute('data-assists-used')}|${document.querySelector('[data-readouts]')?.textContent}`
      })
    const right = page.locator('[data-goal="enter-right"]')
    for (let step = 0; step < 60 && (await right.getAttribute('data-met')) !== 'true'; step++) {
      const snapshot = await inputs()
      const where = page
        .locator('[data-now-card]')
        .getByRole('button', { name: /^(Show me where|Highlight it again)$/ })
      await where.click()
      const help = (await page.locator('[data-goal-help]').textContent()) ?? ''
      const spot = await page.locator('[data-spotlight="true"]').getAttribute('data-control')
      // Asking changes nothing.
      expect(await inputs()).toBe(snapshot)
      expect(help.split(/[\s:]/)[0].toLowerCase()).toBe(spot === 'rotate' ? 'rotate' : spot)
      if (step === 0) {
        await page.locator('[data-three-state]').scrollIntoViewIfNeeded()
        await page.screenshot({ path: info.outputPath('s6-show-me-where.png') })
      }
      if (spot === 'advance') await control(page, 'advance').click()
      else if (spot === 'rotate') {
        const now = Number(await control(page, 'rotate').inputValue())
        await setRange(page, 'rotate', now + (help.startsWith('Rotate counterclockwise') ? -5 : 5))
      } else if (spot === 'deflect') {
        const now = Number(await control(page, 'deflect').inputValue())
        await setRange(page, 'deflect', now + (help.startsWith('Deflect toward D') ? -5 : 5))
      } else throw new Error(`Unexpected help for entering: ${help}`)
    }
    await expect(right).toHaveAttribute('data-met', 'true')
  })

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ])
    test(`rewrite pilot: the right lung's six views are answered by clicking the opening, at ${viewport.width}px`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport)
      const { step } = await goToStep(page, 'right-side', 'right-side-flow-v1-name-the-views')
      if (step.interaction.kind !== 'find') throw new Error('not a click-on-image set')
      const { rows } = step.interaction.find
      await expect(primary(page)).toBeDisabled()
      for (const [index, row] of rows.entries()) {
        const card = page.locator(`[data-find-row="${row.id}"]`)
        await expect(card).toBeVisible()
        await expect(page.locator('[data-find-position]')).toHaveText(
          `Image ${index + 1} of ${rows.length}`,
        )
        // Before the answer: outlines without names, each a button named by its position.
        await expect(card.locator('[data-find-label]')).toHaveCount(0)
        await expect(card.locator('[data-find-marker]').first()).toHaveAttribute('role', 'button')
        await expect
          .poll(() =>
            card.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth),
          )
          .toBeGreaterThan(0)
        // The first image is answered with another opening, to see the correction.
        const frameMarkers = await card
          .locator('[data-find-marker]')
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-find-marker')!))
        const pick = index === 0 ? frameMarkers.find((id) => id !== row.targetId)! : row.targetId
        const outline = card.locator(`[data-find-marker="${pick}"]`)
        await outline.scrollIntoViewIfNeeded()
        await outline.click()
        const verdict = card.locator('[data-find-verdict]')
        await expect(verdict).toHaveAttribute('data-find-verdict', index === 0 ? 'other' : 'held')
        await expect(verdict).toBeFocused()
        await expect(card.locator(`[data-find-marker="${row.targetId}"]`)).toHaveAttribute(
          'data-state',
          'target',
        )
        await expect(card.locator('[data-find-label]')).toHaveCount(frameMarkers.length)
        if (row.rotation) {
          await expect(card).toHaveAttribute('data-find-rotation', String(row.rotation))
          await card.screenshot({ path: info.outputPath(`rotated-view-${viewport.width}.png`) })
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true)
        if (index < rows.length - 1) await page.locator('[data-find-next]').click()
      }
      await expect(primary(page)).toBeEnabled()
      await expect(page.locator('[data-stage]')).not.toContainText(
        /model boundary|teaching profile|clinical review pending|does not establish/i,
      )
    })

  test('rewrite pilot: the right lung\u2019s scope practice carries one line under the scene and no notes about the model', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1204, height: 987 })
    await goToStep(page, 'right-side', 'right-side-flow-v1-application')
    await ready(page)
    await expect(page.locator('[data-step-goals] li')).toHaveCount(3)
    await expect(page.locator('[data-stage]')).not.toContainText(
      /model boundary|clinical review pending|does not judge the bronchoscope|sends nothing to the scope/i,
    )
    await expect(page.locator('[data-stage]')).toContainText(
      'Guided travel: the scope follows the lumen. Opening names are off.',
    )
  })

  test('S10: in the less-assisted lesson, help and opening names are advice that records nothing', async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1204, height: 987 })
    await goToStep(page, 'right-side', 'right-side-flow-v1-application')
    await ready(page)
    const performance = page.locator('[data-input-mode]')
    const goals = () =>
      page
        .locator('[data-step-goals] li')
        .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-met')))
    const before = {
      mode: await performance.getAttribute('data-input-mode'),
      assists: await performance.getAttribute('data-assists-used'),
      goals: await goals(),
      record: await record(page),
    }
    await page.locator('[data-now-card]').getByRole('button', { name: 'Show me where' }).click()
    await expect(page.locator('[data-spotlight="true"]')).toHaveAttribute('data-control', 'rotate')
    await expect(page.locator('[data-goal-help]')).toContainText(/^Rotate/)
    const names = page.getByRole('button', { name: 'Show the opening names' })
    await names.click()
    await expect(page.getByRole('button', { name: 'Hide the opening names' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.locator('[data-reference-label]').first()).toBeVisible()
    await page
      .locator('[data-three-state]')
      .screenshot({ path: info.outputPath('s10-reference-names.png') })
    await expect(performance).toContainText('opening names shown for reference')
    expect(await performance.getAttribute('data-input-mode')).toBe(before.mode)
    expect(await performance.getAttribute('data-assists-used')).toBe(before.assists)
    expect(await goals()).toEqual(before.goals)
    expect(await record(page)).toEqual(before.record)
    await page.getByRole('button', { name: 'Hide the opening names' }).click()
    await expect(page.locator('[data-reference-label]')).toHaveCount(0)
    expect(await goals()).toEqual(before.goals)
  })

  for (const { viewport, text } of [
    { viewport: { width: 390, height: 844 }, text: 100 },
    { viewport: { width: 320, height: 740 }, text: 100 },
    { viewport: { width: 390, height: 844 }, text: 200 },
    { viewport: { width: 1204, height: 987 }, text: 200 },
  ])
    test(`mobile and enlarged text: the current goal sits beside the scope and its controls at ${viewport.width}px, ${text}% root text`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport)
      await goToStep(page, 'branch-entry', 'branch-entry-flow-v1-application')
      if (text === 200)
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%'
        })
      await ready(page)
      await page
        .locator('[data-scope-goal-now]')
        .evaluate((element) => element.scrollIntoView({ block: 'start' }))
      const layout = await page.evaluate(() => {
        const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect()
        const course = document.querySelector<HTMLElement>(
          '[data-module="bronchoscopy-foundations"]',
        )!
        const header = document.getElementById('main-content')?.previousElementSibling
        // The view's own header: the Scope/Airway map tabs and the review-status line.
        const tabs = document.querySelector('[role="tablist"][aria-label="Scope and airway map"]')
        const status = document.querySelector('[data-three-state]')?.previousElementSibling
        const own = [tabs, status].reduce((sum, element) => {
          if (!element) return sum
          const style = getComputedStyle(element)
          return (
            sum +
            element.getBoundingClientRect().height +
            parseFloat(style.marginTop) +
            parseFloat(style.marginBottom)
          )
        }, 0)
        // The pane's grid gaps (0.75rem each) on either side of that header, at this root size.
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
        return {
          viewHeader: own + 2 * 0.75 * rem,
          header: header ? header.getBoundingClientRect().height : 0,
          goal: box('[data-scope-goal-now]').top,
          goalBottom: box('[data-scope-goal-now]').bottom,
          view: box('[data-three-state]').top,
          viewBottom: box('[data-three-state]').bottom,
          advance: box('[id="bronchoscopy-foundations-scope-advance"]').bottom,
          dock: box('[data-scope-controls]').top,
          courseFits: course.scrollWidth <= course.clientWidth + 1,
          rows: document.querySelectorAll('[data-scope-goals] li').length,
        }
      })
      // The current goal directly above the view (only the view's own tabs and review line
      // between), and the view directly above its controls.
      expect(layout.goalBottom).toBeLessThanOrEqual(layout.view)
      expect(layout.view - layout.goalBottom).toBeLessThanOrEqual(layout.viewHeader + 2)
      expect(layout.viewBottom).toBeLessThanOrEqual(layout.dock)
      expect(layout.rows).toBe(1)
      expect(layout.courseFits).toBe(true)
      if (text === 100 && viewport.width <= 390) {
        // The current goal, the view and the first controls on one phone screen.
        expect(layout.advance - layout.goal).toBeLessThanOrEqual(viewport.height - layout.header)
      }
      await page.screenshot({ path: info.outputPath(`s6-${viewport.width}-${text}.png`) })
      // The full list stays reachable from the card, and a focused control stays visible.
      await page.locator('a[data-all-goals-link]').click()
      await expect(page.locator('[data-step-goals]')).toBeFocused()
      await expect(page.locator('[data-step-goals] li')).toHaveCount(5)
      await control(page, 'advance').focus()
      const focus = await page.evaluate(() => {
        const header = document.getElementById('main-content')?.previousElementSibling
        const r = document.activeElement!.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, header: header?.getBoundingClientRect().bottom ?? 0 }
      })
      expect(focus.top).toBeGreaterThanOrEqual(focus.header - 1)
      expect(focus.bottom).toBeLessThanOrEqual(viewport.height + 1)
    })

  test('S7: the CT and the still are compared side by side at laptop sizes, each for what it is', async ({
    page,
  }, info) => {
    for (const viewport of [
      { width: 1204, height: 987 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport)
      await goToStep(page, 'reference-frames', 'reference-frames-flow-v1-ct-display')
      const figures = page.locator('[data-media-workspace] figure')
      await expect(figures).toHaveCount(2)
      await expect(figures.nth(1).locator('img')).toBeVisible()
      await figures.first().scrollIntoViewIfNeeded()
      const [ct, still] = await figures.evaluateAll((elements) =>
        elements.map((figure) => {
          const r = figure.querySelector('img')!.getBoundingClientRect()
          return { top: r.top, bottom: r.bottom, left: r.left, width: r.width }
        }),
      )
      if (viewport.width >= 1024) {
        expect(Math.abs(ct.top - still.top)).toBeLessThan(2)
        expect(Math.max(ct.bottom, still.bottom) - Math.min(ct.top, still.top)).toBeLessThan(
          viewport.height - 100,
        )
        expect(still.left).toBeGreaterThan(ct.left + ct.width)
      } else expect(still.top).toBeGreaterThan(ct.bottom)
      await expect(page.locator('[data-media-frame]')).toHaveCount(2)
      await expect(page.locator('[data-media-comparison]')).toContainText('not a registered pair')
      await expect(page.locator('[data-media-comparison]')).toContainText(
        'this panel shows one axial slice',
      )
      await page.screenshot({ path: info.outputPath(`s7-${viewport.width}.png`) })
    }
  })

  test('S20: the scope in the tube is drawn in cross-section, to scale, from the readouts’ numbers', async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1204, height: 987 })
    for (const [stepId, tube, scope, mm2, share] of [
      ['scope-in-a-tube-flow-v1-application', 8, 6, '22 mm²', '0.44'],
      ['scope-in-a-tube-flow-v1-changed-tube', 7.5, 6.2, '14 mm²', '0.32'],
    ] as const) {
      await goToStep(page, 'scope-in-a-tube', stepId)
      await ready(page)
      const figure = page.locator('[data-tube-cross-section]')
      await figure.scrollIntoViewIfNeeded()
      const ratio = await figure.evaluate((element) => {
        const outer = element
          .querySelector('[data-cross-section-tube-radius]')!
          .getBoundingClientRect()
        const inner = element
          .querySelector('[data-cross-section-scope-radius]')!
          .getBoundingClientRect()
        return { ratio: inner.width / outer.width, outer: outer.width }
      })
      expect(ratio.ratio).toBeCloseTo(scope / tube, 2)
      expect(ratio.outer).toBeGreaterThan(120)
      await expect(page.locator('[data-readout="annularAreaMm2"] dd')).toContainText(mm2)
      await expect(page.locator('[data-readout="annularAreaFraction"] dd')).toContainText(share)
      await expect(figure).toContainText(mm2)
      await expect(figure).toContainText(`${share} of the tube’s lumen`)
      await expect(figure).toContainText('not a ventilation, airway-fit or device recommendation')
      await page.screenshot({ path: info.outputPath(`s20-${tube}-${scope}.png`) })
    }
  })

  /* ------------------------------------------------------------------ *
   * Independent review of this batch: four repairs
   * ------------------------------------------------------------------ */

  test('review repair 1: Show me where follows the learner past a goal they have met, unasked', async ({
    page,
  }, info) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: 1204, height: 987 })
    const practice = 'branch-entry-flow-v1-application'
    await goToStep(page, 'branch-entry', practice)
    await ready(page)
    const now = page.locator('[data-now-card]')
    const help = page.locator('[data-goal-help]')
    const lit = page.locator('[data-spotlight="true"]')
    const goalNow = page.locator('[data-scope-goal-now]')
    const goals = () =>
      page
        .locator('[data-step-goals] li')
        .evaluateAll((rows) =>
          rows.map((row) => `${row.getAttribute('data-goal')}:${row.getAttribute('data-met')}`),
        )
    const attempt = page.locator('[data-input-mode]')
    const before = {
      goals: await goals(),
      mode: await attempt.getAttribute('data-input-mode'),
      assists: await attempt.getAttribute('data-assists-used'),
      record: await record(page),
    }

    await now.getByRole('button', { name: 'Show me where' }).click()
    await expect(help).toHaveText('Advance down the trachea to the main carina.')
    await expect(lit).toHaveCount(1)
    await expect(lit).toHaveAttribute('data-control', 'advance')
    await expect(control(page, 'advance')).toBeFocused()
    // Asking is not a move: no goal, no input mode, no assist, no record.
    expect(await goals()).toEqual(before.goals)
    expect(await attempt.getAttribute('data-input-mode')).toBe(before.mode)
    expect(await attempt.getAttribute('data-assists-used')).toBe(before.assists)
    expect(await record(page)).toEqual(before.record)
    await page.screenshot({ path: info.outputPath('repair1-help-before-carina.png') })

    // Reach the carina with the Advance button itself. Help is not asked for again.
    const carina = page.locator('[data-goal="reach-carina"]')
    for (let i = 0; i < 80 && (await carina.getAttribute('data-met')) !== 'true'; i += 1)
      await control(page, 'advance').click()
    await expect(carina).toHaveAttribute('data-met', 'true')
    await expect(goalNow).toHaveAttribute('data-scope-goal-now', 'enter-right')

    // The reviewed build still said to advance to the carina here, and still lit Advance.
    await expect(help).not.toContainText(/carina/i)
    await expect(help).toContainText(/^Rotate (counter)?clockwise/)
    await expect(help).toContainText('right main bronchus')
    await expect(lit).toHaveCount(1)
    await expect(lit).toHaveAttribute('data-control', 'rotate')
    await expect(now.getByRole('button', { name: 'Highlight it again' })).toBeVisible()
    // The keyboard stays on the control in use; the advice changing does not move it.
    await expect(control(page, 'advance')).toBeFocused()
    await page.screenshot({ path: info.outputPath('repair1-help-after-carina.png') })

    // Do only what the help says. On the same goal it moves from Rotate to Deflect to Advance.
    const right = page.locator('[data-goal="enter-right"]')
    const seen: string[] = []
    for (let i = 0; i < 80 && (await right.getAttribute('data-met')) !== 'true'; i += 1) {
      const key = await lit.getAttribute('data-control')
      const sentence = (await help.textContent()) ?? ''
      if (seen[seen.length - 1] !== key) seen.push(key!)
      if (key === 'rotate') {
        const at = Number(await control(page, 'rotate').inputValue())
        await setRange(page, 'rotate', at + (/counterclockwise/.test(sentence) ? -15 : 15))
      } else if (key === 'deflect') {
        const at = Number(await control(page, 'deflect').inputValue())
        await setRange(page, 'deflect', at + (/toward U/.test(sentence) ? 5 : -5))
      } else if (key === 'advance') await control(page, 'advance').click()
      else throw new Error(`Unexpected help control ${key}: ${sentence}`)
    }
    await expect(right).toHaveAttribute('data-met', 'true')
    expect(seen).toEqual(['rotate', 'deflect', 'advance'])

    // Goal two to goal three, again unasked: the way on is back out, not further in.
    await expect(goalNow).toHaveAttribute('data-scope-goal-now', 'back-to-trachea')
    await expect(help).not.toContainText('goes into the opening of the right main bronchus')
    await expect(lit).toHaveCount(1)
    await expect(lit).toHaveAttribute('data-control', 'withdraw')
    await page.screenshot({ path: info.outputPath('repair1-help-after-right-main.png') })

    // A reset starts a new attempt without the last one's help.
    await control(page, 'reset').click()
    await expect(carina).toHaveAttribute('data-met', 'false')
    await expect(help).toHaveCount(0)
    await expect(lit).toHaveCount(0)
    await now.getByRole('button', { name: 'Show me where' }).click()
    await expect(help).toHaveText('Advance down the trachea to the main carina.')

    // Leaving the step ends it; coming back does not bring it back.
    await now.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(stage(page)).not.toHaveAttribute('data-stage', practice)
    await expect(help).toHaveCount(0)
    await expect(lit).toHaveCount(0)
    for (let i = 0; i < 4 && (await stage(page).getAttribute('data-stage')) !== practice; i += 1)
      await primary(page).click()
    await expect(stage(page)).toHaveAttribute('data-stage', practice)
    await expect(help).toHaveCount(0)
    await expect(lit).toHaveCount(0)
    await expect(now.getByRole('button', { name: 'Show me where' })).toBeVisible()
    // Nothing above was written as the learner's record by the help itself.
    expect(await attempt.getAttribute('data-assists-used')).toBe(before.assists)
  })

  /** What the bench and the end-on drawing show, read once per animation frame in the page. */
  interface BenchFrame {
    readonly t: number
    readonly rotation: number
    readonly deflection: number
    readonly cx: number
    readonly cy: number
    readonly tipX: number
    readonly tipY: number
    readonly planeX: number
    readonly planeY: number
    readonly overlay: boolean
    readonly note: boolean
    readonly words: string
  }
  async function startBenchSampler(page: Page) {
    await page.evaluate(() => {
      const frames: unknown[] = []
      const w = window as unknown as { __bench?: { frames: unknown[]; stop: boolean } }
      w.__bench = { frames, stop: false }
      const sample = () => {
        const head = document.querySelector('[data-control-head]')
        const compass = document.querySelector('[data-tip-compass]')
        if (head && compass) {
          const svg = compass.querySelector('svg')!
          const tip = compass.querySelector('[data-compass-tip]') as SVGCircleElement
          const plane = compass.querySelector('[data-compass-plane]') as SVGLineElement
          const frame = svg.getBoundingClientRect()
          const dot = tip.getBoundingClientRect()
          const [x0, y0, vw, vh] = svg.getAttribute('viewBox')!.split(' ').map(Number)
          frames.push({
            t: performance.now(),
            // What the 3D control head and bending section were handed for this frame.
            rotation: Number(head.getAttribute('data-handle-rotation')),
            deflection: Number(head.getAttribute('data-lever-deflection')),
            cx: tip.cx.baseVal.value,
            cy: tip.cy.baseVal.value,
            // Where the tip mark is actually painted, back in the drawing's own units.
            tipX: x0 + ((dot.left + dot.width / 2 - frame.left) / frame.width) * vw,
            tipY: y0 + ((dot.top + dot.height / 2 - frame.top) / frame.height) * vh,
            planeX: plane.x2.baseVal.value,
            planeY: plane.y2.baseVal.value,
            overlay: document.querySelector('[data-bench-off-card]') !== null,
            note: /outside the field of view/.test(
              [...compass.querySelectorAll(':not([aria-hidden="true"])')]
                .filter((element) => element.children.length === 0)
                .map((element) => element.textContent)
                .join(' '),
            ),
            words: compass.querySelector('figcaption')!.textContent ?? '',
          })
        }
        if (!w.__bench!.stop) requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
  }
  async function stopBenchSampler(page: Page): Promise<BenchFrame[]> {
    return page.evaluate(() => {
      const w = window as unknown as { __bench: { frames: unknown[]; stop: boolean } }
      w.__bench.stop = true
      return w.__bench.frames as BenchFrame[]
    }) as Promise<BenchFrame[]>
  }
  /** The end-on drawing for a control-head reading, from the engine's own frame. */
  function compassFor(rotationDeg: number, deflectionDeg: number) {
    const inputs = { ...DEFAULT_SCOPE_INPUTS, rotationDeg, deflectionDeg }
    const orientation = benchTipOrientation({
      place: 'bench',
      inputs,
      pose: authoredScopePose('bench', 0, inputs),
    })!
    const radius = compassRadius(orientation.angleDeg)
    return {
      angle: orientation.angleDeg,
      tip: orientation.toward
        ? { x: orientation.toward.x * radius, y: -orientation.toward.y * radius }
        : { x: 0, y: 0 },
      up: { x: orientation.bendUp.x, y: -orientation.bendUp.y },
    }
  }
  /** One native press or click on a slider, sampled from before it until the bench has settled. */
  async function sampledMove(page: Page, move: () => Promise<void>) {
    await startBenchSampler(page)
    await page.waitForTimeout(60)
    await move()
    await page.waitForTimeout(520)
    return stopBenchSampler(page)
  }
  /**
   * Every frame: the drawing is the one for the bench reading taken in that same frame.
   *
   * `painted` also compares where the tip mark is on screen. With reduced motion the site's own
   * stylesheet gives every property change a 0.001 ms transition, so a box measured inside the
   * frame that made a change is still the previous one; there the mark is measured once settled.
   */
  function expectFramesAgree(frames: readonly BenchFrame[], painted = true) {
    expect(frames.length).toBeGreaterThan(10)
    for (const [index, frame] of frames.entries()) {
      const expected = compassFor(frame.rotation, frame.deflection)
      const at = `frame at ${frame.t.toFixed(1)} ms, head ${frame.rotation}°/${frame.deflection}°`
      expect(Math.abs(frame.cx - expected.tip.x), at).toBeLessThan(0.002)
      expect(Math.abs(frame.cy - expected.tip.y), at).toBeLessThan(0.002)
      expect(Math.abs(frame.planeX - expected.up.x), at).toBeLessThan(0.002)
      expect(Math.abs(frame.planeY - expected.up.y), at).toBeLessThan(0.002)
      // As painted, to within a pixel and a half of a drawing about 140 px across.
      if (painted || index === frames.length - 1) {
        expect(Math.abs(frame.tipX - expected.tip.x), at).toBeLessThan(0.04)
        expect(Math.abs(frame.tipY - expected.tip.y), at).toBeLessThan(0.04)
      }
      // The note on the scope view and its words for assistive technology are the same state too.
      expect(frame.note, at).toBe(frame.overlay)
    }
  }
  /** Frames where the bench reading is strictly between two settled values. */
  const between = (frames: readonly BenchFrame[], key: 'rotation' | 'deflection') => {
    const first = frames[0][key]
    const last = frames[frames.length - 1][key]
    return frames.filter(
      (frame) => Math.abs(frame[key] - first) > 0.5 && Math.abs(frame[key] - last) > 0.5,
    )
  }
  /** Click a slider's track at a value; the browser's own hit-testing sets it. */
  async function clickTrackAt(page: Page, key: 'rotate' | 'deflect', value: number) {
    const slider = control(page, key)
    const box = (await slider.boundingBox())!
    const min = Number(await slider.getAttribute('min'))
    const max = Number(await slider.getAttribute('max'))
    await page.mouse.click(
      box.x + ((value - min) / (max - min)) * box.width,
      box.y + box.height / 2,
    )
  }

  test('review repair 2: the end-on drawing moves with the animated bench on every frame', async ({
    page,
  }, info) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: 1204, height: 987 })
    await goToStep(page, 'five-controls', 'five-controls-learn-rotation')
    await pilotAction(page, 'Try with guidance')
    await ready(page)
    await setRange(page, 'deflect', 0)
    await setRange(page, 'rotate', 0)
    const head = page.locator('[data-control-head]')
    const compass = page.locator('[data-tip-compass]')
    await head.scrollIntoViewIfNeeded()
    // Ordinary motion from here: the bench takes about 220 ms to reach a commanded state.
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.waitForTimeout(100)
    const report: Record<string, unknown> = {}
    const deflect = control(page, 'deflect')
    const rotate = control(page, 'rotate')

    // Deflection, by the slider's own keys and track: 0 → +120 → −120 → about 0.
    await deflect.focus()
    for (const [name, move] of [
      ['deflection 0 to +120 (End)', () => page.keyboard.press('End')],
      ['deflection +120 to -120 (Home)', () => page.keyboard.press('Home')],
      ['deflection -120 to 0 (track click)', () => clickTrackAt(page, 'deflect', 0)],
    ] as const) {
      const frames = await sampledMove(page, move)
      report[name] = frames
      writeFileSync(info.outputPath('bench-frames.json'), JSON.stringify(report, null, 1))
      const moving = between(frames, 'deflection')
      // Several frames part-way, and the drawing is the bench's on each of them.
      expect(moving.length, name).toBeGreaterThanOrEqual(3)
      expectFramesAgree(frames)
      const settled = frames[frames.length - 1]
      expect(settled.deflection).toBe(Number(await deflect.inputValue()))
      await expect(compass).toHaveAttribute(
        'data-tip-angle',
        Math.abs(settled.deflection).toFixed(1),
      )
    }
    expect(Math.abs(Number(await deflect.inputValue()))).toBeLessThanOrEqual(6)

    // Rotation with a fixed bend to show it: about 0 → 90 → 180 → 270 (the model's −90).
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await setRange(page, 'deflect', 30)
    await setRange(page, 'rotate', 0)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.waitForTimeout(100)
    for (const [name, move] of [
      ['rotation 0 to 90 (track click)', () => clickTrackAt(page, 'rotate', 90)],
      [
        'rotation 90 to 180 (End)',
        async () => {
          await rotate.focus()
          await page.keyboard.press('End')
        },
      ],
      ['rotation 180 to 270 (track click)', () => clickTrackAt(page, 'rotate', -90)],
    ] as const) {
      const frames = await sampledMove(page, move)
      report[name] = frames
      writeFileSync(info.outputPath('bench-frames.json'), JSON.stringify(report, null, 1))
      expect(between(frames, 'rotation').length, name).toBeGreaterThanOrEqual(3)
      expectFramesAgree(frames)
    }
    // 180° to −90° goes the short way, through 270°, and settles on the model's own value.
    const wrap = report['rotation 180 to 270 (track click)'] as BenchFrame[]
    expect(Math.max(...wrap.map((frame) => frame.rotation))).toBeGreaterThan(200)
    const settledRotation = Number(await rotate.inputValue())
    expect(Math.abs(settledRotation + 90)).toBeLessThanOrEqual(6)
    await expect(head).toHaveAttribute('data-handle-rotation', settledRotation.toFixed(2))
    const settled = compassFor(settledRotation, 30)
    await expect(compass).toHaveAttribute(
      'data-bend-up',
      `${settled.up.x.toFixed(3)},${(-settled.up.y).toFixed(3)}`,
    )

    // Both at once: the lever goes to its stop while the control section is still turning.
    const frames = await sampledMove(page, async () => {
      await clickTrackAt(page, 'rotate', 60)
      await deflect.focus()
      await page.keyboard.press('Home')
    })
    report['rotation and deflection together'] = frames
    writeFileSync(info.outputPath('bench-frames.json'), JSON.stringify(report, null, 1))
    expect(between(frames, 'deflection').length).toBeGreaterThanOrEqual(3)
    expect(between(frames, 'rotation').length).toBeGreaterThanOrEqual(3)
    expectFramesAgree(frames)

    await page.screenshot({ path: info.outputPath('repair2-bench-settled.png') })
  })

  test('review repair 2: with reduced motion the bench and the drawing change together, at once', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1204, height: 987 })
    await goToStep(page, 'five-controls', 'five-controls-learn-rotation')
    await pilotAction(page, 'Try with guidance')
    await ready(page)
    await setRange(page, 'deflect', 0)
    await control(page, 'deflect').focus()
    const frames = await sampledMove(page, () => page.keyboard.press('End'))
    expectFramesAgree(frames, false)
    // No frame part-way: the suite's reduced-motion setting leaves no transition to be out of step with.
    expect(between(frames, 'deflection')).toHaveLength(0)
    expect(frames[frames.length - 1].deflection).toBe(120)
    // Settled geometry is the accepted one: 120° up, at the rim, U toward the card's top.
    const compass = page.locator('[data-tip-compass]')
    await expect(compass).toHaveAttribute('data-tip-angle', '120.0')
    await expect(compass).toHaveAttribute('data-tip-toward', '0.000,1.000')
    await expect(compass).toHaveAttribute('data-bend-up', '0.000,1.000')
  })

  test('review repair 3: the bench’s out-of-view note is in the accessibility tree once, and goes when the card returns', async ({
    page,
  }, info) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: 1204, height: 987 })
    await goToStep(page, 'five-controls', 'five-controls-learn-rotation')
    await pilotAction(page, 'Try with guidance')
    await ready(page)
    const pane = page.locator('[data-scope-scene]')
    const overlay = page.locator('[data-bench-off-card]')
    const count = (text: string, part: string) => text.split(part).length - 1
    const signal = page.locator('[data-three-state] [data-view-signal]')
    const savedBefore = await record(page)
    const trees: Record<string, string> = {}
    await setRange(page, 'rotate', 0)
    for (const [rotation, deflection, out] of [
      [0, 0, false],
      [0, 60, true],
      [0, -60, true],
      [0, 120, true],
      [0, -120, true],
      [0, 15, false],
      [90, 60, true],
      [180, 120, true],
      [-90, -60, true],
      [-90, 0, false],
    ] as const) {
      await setRange(page, 'rotate', rotation)
      await setRange(page, 'deflect', deflection)
      await expect(page.locator('[data-control-head]')).toHaveAttribute(
        'data-lever-deflection',
        deflection.toFixed(2),
      )
      const tree = await pane.ariaSnapshot()
      trees[`${rotation},${deflection}`] = tree
      writeFileSync(info.outputPath('accessibility-trees.json'), JSON.stringify(trees, null, 1))
      const where = `rotation ${rotation}°, deflection ${deflection}°`
      if (out) {
        // What the eye is shown on the scope view, hidden from assistive technology there…
        await expect(overlay).toHaveCount(1)
        await expect(overlay).toHaveAttribute('aria-hidden', 'true')
        const visible = ((await overlay.textContent()) ?? '').replace(/\s+/g, ' ').trim()
        expect(visible).toBe(
          `The card is outside the field of view: the tip points ${Math.abs(deflection)}° from straight ahead. This is the bench, not a lost view of an airway.`,
        )
        // …is in the accessibility tree, in the same words, exactly once.
        expect(count(tree, 'The card is outside the field of view'), where).toBe(1)
        expect(count(tree, 'This is the bench, not a lost view of an airway'), where).toBe(1)
        expect(tree, where).toContain(visible)
        // It says where the card is and what this is, and claims nothing about an airway or safety.
        expect(visible).not.toMatch(/red-out|obstruct|contact|mucosa|wall|unsafe|injur/i)
        // By role, which leaves out what is hidden from assistive technology: one paragraph.
        await expect(pane.getByRole('paragraph').filter({ hasText: visible })).toHaveCount(1)
      } else {
        await expect(overlay).toHaveCount(0)
        expect(count(tree, 'outside the field of view'), where).toBe(0)
        expect(count(tree, 'lost view'), where).toBe(0)
      }
      // The bench is not an airway: the view signal never leaves "clear".
      await expect(signal).toHaveAttribute('data-view-signal', 'clear')
    }
    // Nothing about any of it reached the learner's record.
    const savedAfter = await record(page)
    expect({ ...savedAfter, updatedAt: null }).toEqual({ ...savedBefore, updatedAt: null })
  })

  /** The image inside a figure's card frame and inside its open enlarged view, as painted. */
  async function imageBox(image: Locator) {
    return image.evaluate((element) => {
      const img = element as HTMLImageElement
      const box = img.getBoundingClientRect()
      return {
        width: box.width,
        height: box.height,
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        src: img.currentSrc,
        natural: img.naturalWidth / img.naturalHeight,
      }
    })
  }
  for (const viewport of [
    { width: 1204, height: 987 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ])
    test(`review repair 4: S7 Enlarge shows each image at the size the screen allows at ${viewport.width}×${viewport.height}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport)
      await goToStep(page, 'reference-frames', 'reference-frames-flow-v1-ct-display')
      const figures = page.locator('[data-media-workspace] figure')
      await expect(figures).toHaveCount(2)
      const desktop = viewport.width >= 1024
      const measured: Record<string, unknown> = { viewport }
      for (const [index, name] of [
        [0, 'ct'],
        [1, 'still'],
      ] as const) {
        const figure = figures.nth(index)
        const cardImage = figure.locator('[data-media-frame-size="card"] img')
        await expect(cardImage).toBeVisible()
        await cardImage.scrollIntoViewIfNeeded()
        const card = await imageBox(cardImage)
        const enlarge = figure.getByRole('button', { name: `Enlarge image ${index + 1} of 2` })
        await enlarge.click()
        const dialog = page.locator('dialog[data-media-dialog][open]')
        await expect(dialog).toBeVisible()
        await expect(
          dialog.getByRole('heading', { name: `Image ${index + 1} of 2, enlarged` }),
        ).toBeVisible()
        await expect(dialog.locator('[data-media-dialog-close]')).toBeFocused()
        const largeImage = dialog.locator('[data-media-frame-size="enlarged"] img')
        await expect(largeImage).toBeVisible()
        const large = await imageBox(largeImage)
        const frame = await dialog.evaluate((element) => {
          const box = element.getBoundingClientRect()
          return {
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          }
        })
        measured[name] = {
          card: { width: card.width, height: card.height },
          dialog: { width: large.width, height: large.height },
          ratio: large.width / card.width,
        }
        writeFileSync(info.outputPath('s7-sizes.json'), JSON.stringify(measured, null, 1))

        // The same file at its own proportions, not a stretched or substituted one.
        expect(large.src).toBe(card.src)
        expect(large.width / large.height).toBeCloseTo(large.natural, 2)
        expect(card.width / card.height).toBeCloseTo(card.natural, 2)
        if (desktop) {
          // Materially larger: the reviewed build showed it at exactly the card's size.
          expect(large.width).toBeGreaterThan(card.width * 1.3)
          expect(large.height).toBeGreaterThan(card.height * 1.3)
        } else {
          // A phone's card already spans the column, so the enlarged view cannot be larger than
          // it: the dialog is the screen less its own border and padding. It stays close to it.
          expect(large.width).toBeGreaterThan(card.width * 0.9)
          expect(large.width).toBeGreaterThan(viewport.width * 0.85)
        }
        // It uses the screen without spilling off it or needing the dialog scrolled.
        expect(frame.left).toBeGreaterThanOrEqual(0)
        expect(frame.right).toBeLessThanOrEqual(viewport.width)
        expect(frame.top).toBeGreaterThanOrEqual(0)
        expect(frame.bottom).toBeLessThanOrEqual(viewport.height)
        expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth + 1)
        expect(large.left).toBeGreaterThanOrEqual(frame.left)
        expect(large.right).toBeLessThanOrEqual(frame.right)
        if (desktop) {
          expect(frame.scrollHeight).toBeLessThanOrEqual(frame.clientHeight + 1)
          expect(large.bottom).toBeLessThanOrEqual(frame.bottom)
        }
        await page.screenshot({
          path: info.outputPath(`repair4-s7-${name}-enlarged-${viewport.width}.png`),
        })

        // Close returns the focus to this figure's own Enlarge button; so does Escape.
        await dialog.locator('[data-media-dialog-close]').click()
        await expect(page.locator('dialog[data-media-dialog][open]')).toHaveCount(0)
        await expect(enlarge).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.locator('dialog[data-media-dialog][open]')).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(page.locator('dialog[data-media-dialog][open]')).toHaveCount(0)
        await expect(enlarge).toBeFocused()
        // The card is as it was: the comparison row is not made larger to fake the enlargement.
        const after = await imageBox(cardImage)
        expect(after.width).toBeCloseTo(card.width, 0)
      }
      // The side-by-side comparison and its wording are untouched.
      await expect(page.locator('[data-media-comparison]')).toContainText('not a registered pair')
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      ).toBeLessThanOrEqual(0)
    })
})
