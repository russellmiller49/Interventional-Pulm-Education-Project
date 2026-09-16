import { test, expect, type Page, type TestInfo, type Locator } from '@playwright/test'

import { imagingCases } from '../src/features/peripheral-imaging/content/cases'
import { imagingMicroCasesInPathwayOrder } from '../src/features/peripheral-imaging/content/microCases'
import { peripheralImagingSectionIds } from '../src/features/peripheral-imaging/content/pathway'
import { imagingStageLesson } from '../src/features/peripheral-imaging/content/stageLessons'
import {
  LEGACY_IMAGING_RECORD_KEY_V1,
  LEGACY_IMAGING_RECORD_KEY_V2,
} from '../src/features/peripheral-imaging/engine/learnProgress'
import { IMAGING_PROGRESS_STORAGE_KEY } from '../src/features/peripheral-imaging/engine/selfPacedProgress'

/*
 * The peripheral-imaging course: actual lesson transitions, rendered image evidence, self-paced
 * navigation (skip, explanation before an answer, retry, reload, deep links, outline jumps),
 * truthful progress, the integrated cases on the old Assess address, and responsive layouts.
 */

// Explicit opt-in keeps this suite independent of the default port-3001 E2E server.
test.skip(
  !process.env.PERIPHERAL_IMAGING_BASE_URL,
  'Run with the dedicated imaging config and a local development server.',
)
test.setTimeout(120_000)

const base = () => process.env.PERIPHERAL_IMAGING_BASE_URL!

test.beforeEach(async ({ page }) => {
  if (!['localhost', '127.0.0.1'].includes(new URL(base()).hostname))
    throw new Error('Imaging checks require localhost.')
  // No sign-in step: the module is in development and reachable by direct link, so arriving on
  // the hub with no account and no cookie is the promise this suite is here to keep. A gate that
  // regresses to requiring an account fails here, on the first navigation.
  const response = await page.goto(base() + '/en/peripheral-imaging')
  expect(response?.status()).toBe(200)
  expect(new URL(page.url()).pathname).toBe('/en/peripheral-imaging')
  await expect(page.locator('[data-imaging-continue]')).toHaveAttribute(
    'data-imaging-continue',
    'resolved',
  )
})

const primary = (page: Page) => page.locator('[data-now-card] [data-now-primary]')
const secondary = (page: Page) => page.locator('[data-now-card] [data-now-secondary]')
const skip = (page: Page) => page.locator('[data-now-card] [data-now-skip]')

async function openSection(page: Page, sectionId: string) {
  await page.goto(`${base()}/en/peripheral-imaging/learn?section=${sectionId}`)
  await expect(page.locator('[data-stage]')).toHaveAttribute(
    'data-stage',
    imagingStageLesson(sectionId as never).steps[0].id,
  )
  await expect(page.locator('[data-imaging-flow]')).toBeVisible()
}

async function advanceReading(page: Page, id: string) {
  const lesson = imagingStageLesson(id as never)
  for (let count = 0; count < lesson.steps.length; count++) {
    const stepId = await page.locator('[data-stage]').getAttribute('data-stage')
    const step = lesson.steps.find((s) => s.id === stepId)!
    if (step.interaction.kind !== 'read') return
    await expect(primary(page)).toBeEnabled({ timeout: 60000 })
    await primary(page).click()
  }
  throw new Error('No task after reading')
}

async function commitKeyed(page: Page, sectionId: string, stepIndex: number) {
  const step = imagingStageLesson(sectionId as never).steps[stepIndex]
  if (step.interaction.kind !== 'prediction') throw new Error(`${step.id} is not a prediction`)
  const keyed = step.interaction.item.choices.find((choice) => choice.plausibility === 'best')!
  await page.locator(`[data-prediction-choices] input[value="${keyed.id}"]`).check()
  await primary(page).click()
  await expect(page.locator('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'correct',
  )
}

/**
 * Whether the suite's controls are locked. Playwright treats a `<fieldset disabled>` as enabled
 * — the disabled state it reports belongs to form controls — so ask a control inside the dock,
 * which is the thing the learner cannot actually move.
 */
async function setRange(page: Page, label: string | RegExp, value: number) {
  const input = page.getByRole('slider', { name: label })
  await input.fill(String(value))
  await input.dispatchEvent('input')
  await input.dispatchEvent('change')
}

async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(name), fullPage: false })
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
}

/** A canvas that carries an image, not a blank renderer. */
async function expectImageSignal(canvas: Locator, webgl = true) {
  await expect
    .poll(() =>
      canvas.evaluate((node, useWebgl) => {
        const c = node as HTMLCanvasElement
        let pixels: Uint8Array | Uint8ClampedArray
        if (useWebgl) {
          const gl = c.getContext('webgl2')!
          pixels = new Uint8Array(c.width * c.height * 4)
          gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
        } else pixels = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
        let min = 255,
          max = 0
        for (let i = 0; i < pixels.length; i += 4) {
          min = Math.min(min, pixels[i])
          max = Math.max(max, pixels[i])
        }
        return max - min
      }, webgl),
    )
    .toBeGreaterThan(35)
}

test('the hub starts with the imaging task and keeps the available Practice cases', async ({
  page,
}, info) => {
  await expect(page.locator('[data-imaging-continue]')).toHaveCount(1)
  await expect(page.getByText(/Learn to optimize fluoroscopy/)).toBeVisible()
  await expect(page.getByText(/practice cases are available/).first()).toBeVisible()
  await capture(page, info, 'hub-desktop.png')
  await page.locator('[data-imaging-continue]').click()
  await expect(page.locator('[data-imaging-question-example]')).toBeVisible()
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
  const lesson = imagingStageLesson('imaging-questions')
  await advanceReading(page, 'imaging-questions')
  const sort = lesson.steps.find((s) => s.interaction.kind === 'sort')!.interaction
  if (sort.kind !== 'sort') throw new Error('Missing sort')
  for (const row of sort.sort.rows)
    await page.locator(`[data-sort-row="${row.id}"] select`).selectOption(row.origin)
  await primary(page).click()
  await primary(page).click()
  await commitKeyed(page, 'imaging-questions', lesson.predictionStepIndex)
  await primary(page).click()
  await primary(page).click()
  await commitKeyed(page, 'imaging-questions', lesson.transferStepIndex)
  await primary(page).click()
  await expect(page.locator('[data-section-completion]')).toBeVisible()
  expect((await storedProgress(page)).reviewedSectionIds).toContain('imaging-questions')
  await expectNoStoredResponses(page)
})

/** Every stored value, so a test can show what the course did and did not write. */
async function storedValues(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(() =>
    Object.fromEntries(
      Array.from({ length: localStorage.length }, (_, index) => {
        const key = localStorage.key(index)!
        return [key, localStorage.getItem(key)]
      }),
    ),
  )
}

/** A self-paced session writes no answer, no correctness and no legacy graded record. */
async function expectNoStoredResponses(page: Page) {
  const values = await storedValues(page)
  expect(values[LEGACY_IMAGING_RECORD_KEY_V2] ?? null).toBeNull()
  expect(values[LEGACY_IMAGING_RECORD_KEY_V1] ?? null).toBeNull()
  expect(values[IMAGING_PROGRESS_STORAGE_KEY] ?? '').not.toMatch(/choice|correct|attempt|answer/i)
}

async function storedProgress(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
    IMAGING_PROGRESS_STORAGE_KEY,
  )
}

test('projection teaching, comparison, explanation before an answer, retry and reload store no answer', async ({
  page,
}, info) => {
  await openSection(page, 'projection')
  await expect(page.locator('[data-teaching-panel]')).toContainText('parallax')
  await expect(page.locator('[data-projection-state]')).toHaveAttribute(
    'data-projection-state',
    'ready',
  )
  const canvas = page.locator('[data-current-image] canvas')
  await expectImageSignal(canvas)
  const before = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL())
  await page.getByRole('button', { name: 'Save baseline image' }).click()
  const baseline = await page.locator('[data-baseline-image] img').getAttribute('src')
  await page.getByRole('button', { name: 'Change projection only', exact: true }).click()
  await expect
    .poll(() => canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL()))
    .not.toBe(before)
  expect(await page.locator('[data-baseline-image] img').getAttribute('src')).toBe(baseline)
  await expect(page.locator('[data-readout="depthMm"]')).toContainText('30 mm')
  await capture(page, info, 'projection-baseline-current.png')
  await page.getByRole('button', { name: 'Replay demonstration' }).click()
  await expectNoStoredResponses(page)
  await advanceReading(page, 'projection')
  await expect(page.getByRole('slider', { name: 'C-arm obliquity', exact: true })).toHaveValue('0')
  // The demonstration did not do the learner's work: no Continue, but a way on without it.
  await expect(primary(page)).toHaveCount(0)
  await expect(skip(page)).toHaveText('Skip this step')
  await setRange(page, 'C-arm obliquity', 35)
  await primary(page).click()
  await setRange(page, 'C-arm obliquity', 0)
  await primary(page).click()
  await expect(page.locator('[data-check-teaching]')).toBeVisible()
  await expect(page.locator('[data-check-teaching] [data-teaching-review]')).toHaveCount(1)
  await expect(
    page.locator(
      '[data-readout="depthMm"], [data-chain-outcome], [data-teaching-block="control-strip"]',
    ),
  ).toHaveCount(0)
  await expect(page.locator('[data-stage-sources]')).toHaveAttribute(
    'data-stage-sources-claims',
    'true',
  )
  // The explanation opens before any answer, and opening it chooses nothing.
  await expect(primary(page)).toBeDisabled()
  await expect(secondary(page)).toHaveText('Show the explanation')
  await secondary(page).click()
  await expect(page.locator('[data-explanation-reveal]')).toBeVisible()
  await expect(page.locator('[data-prediction-choices] input:checked')).toHaveCount(0)
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
  await capture(page, info, 'projection-explanation-before-answer.png')
  await secondary(page).click()
  await expect(page.locator('[data-explanation-reveal]')).toHaveCount(0)
  await page.locator('[data-prediction-choices] input[value="a"]').check()
  await primary(page).click()
  await expect(page.locator('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'not-correct',
  )
  await page.getByRole('button', { name: 'Try this question again' }).click()
  await page.locator('[data-prediction-choices] input[value="b"]').check()
  await primary(page).click()
  await expectNoStoredResponses(page)
  await page.reload()
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'projection:parallax')
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
  expect(await storedProgress(page)).toMatchObject({
    lastLocation: { kind: 'section', id: 'projection' },
    visitedSectionIds: ['projection'],
  })
  await expectNoStoredResponses(page)
})

test('field crop and zoom preserve a saved acquisition and restricted context cannot pass', async ({
  page,
}, info) => {
  await openSection(page, 'field')
  await expect(page.locator('[data-projection-state]')).toHaveAttribute(
    'data-projection-state',
    'ready',
  )
  await expectImageSignal(page.locator('[data-current-image] canvas'))
  await page.getByRole('button', { name: 'Save baseline image' }).click()
  const stored = await page.locator('[data-baseline-image]').textContent()
  const pixels = await page.locator('[data-baseline-image] img').getAttribute('src')
  await page.getByRole('button', { name: 'Physical collimation', exact: true }).click()
  await expect(page.locator('[data-current-image] [data-field-mask]')).toHaveAttribute(
    'data-physical-field',
    '80',
  )
  await capture(page, info, 'field-collimated.png')
  await primary(page).click()
  await expect(primary(page)).toBeEnabled({ timeout: 60000 })
  await page.getByRole('button', { name: 'Crop the baseline stored frame', exact: true }).click()
  await expect(page.locator('[data-current-image]')).toContainText('acquired field 100%')
  await page.getByRole('button', { name: 'Zoom the baseline stored frame', exact: true }).click()
  await expect(page.locator('[data-current-image] [data-monitor-zoom]')).toHaveAttribute(
    'data-monitor-zoom',
    '1.5',
  )
  expect(await page.locator('[data-baseline-image]').textContent()).toBe(stored)
  expect(await page.locator('[data-baseline-image] img').getAttribute('src')).toBe(pixels)
  await capture(page, info, 'field-stored-zoom.png')
  await expectNoStoredResponses(page)
  await primary(page).click()
  await setRange(page, 'Collimated field width', 45)
  await expect(primary(page)).toHaveCount(0)
  await expect(skip(page)).toBeVisible()
  await expect(page.locator('[data-readout="contextRetained"]')).toContainText('no')
  await setRange(page, 'Collimated field width', 90)
  await expect(primary(page)).toBeEnabled()
})

test('timing changes depict separate within-frame and between-frame effects with reduced motion', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openSection(page, 'time')
  await expect(page.locator('[data-projection-state]')).toHaveAttribute(
    'data-projection-state',
    'ready',
  )
  await expectImageSignal(page.locator('[data-current-image] canvas'))
  const blur = await page.locator('[data-readout="inFrameBlurMm"] dd').textContent()
  const gap = await page.locator('[data-readout="interFrameTravelMm"] dd').textContent()
  await page.getByRole('button', { name: 'Save baseline image' }).click()
  await page.getByRole('button', { name: 'Pulse width alone', exact: true }).click()
  await expect(page.locator('[data-readout="interFrameTravelMm"] dd')).toHaveText(gap!)
  await expect(page.locator('[data-readout="inFrameBlurMm"] dd')).not.toHaveText(blur!)
  await capture(page, info, 'timing-width.png')
  await page
    .locator('[data-temporal-phase]')
    .screenshot({ path: info.outputPath('timing-width-detail.png') })
  await primary(page).click()
  await expect(primary(page)).toBeEnabled({ timeout: 60000 })
  await page.getByRole('button', { name: 'Pulse rate alone', exact: true }).click()
  await expect(page.locator('[data-readout="inFrameBlurMm"] dd')).toHaveText(blur!)
  await expect(page.locator('[data-readout="interFrameTravelMm"] dd')).not.toHaveText(gap!)
  await capture(page, info, 'timing-rate.png')
  await page
    .locator('[data-temporal-phase]')
    .screenshot({ path: info.outputPath('timing-rate-detail.png') })
  const phase = await page.locator('[data-temporal-phase]').getAttribute('data-temporal-phase')
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(page.locator('[data-temporal-phase]')).not.toHaveAttribute(
    'data-temporal-phase',
    phase!,
  )
  await expectNoStoredResponses(page)
})

test('the old Assess address opens every integrated case with no prerequisite: explanation, safety feedback, retry, moving on, deep link and reload', async ({
  page,
}, info) => {
  // Contract change (PI-01): this was the capstone — locked until every section was worked
  // through, decided once, held to seven of eight with every safety decision correct.
  await page.goto(base() + '/en/peripheral-imaging/assess')
  await expect(page.locator('[data-capstone]')).toHaveCount(0)
  await expect(page.locator('[data-integrated-case-link]')).toHaveCount(imagingCases.length)
  await expect(page.locator('[data-integrated-continue]')).toHaveAttribute(
    'data-next-case',
    imagingCases[0].id,
  )
  // The site layout and the module frame are both <main>; scope to the landing itself.
  await expect(page.locator('[data-integrated-cases-landing]')).not.toContainText(
    /capstone|decisions held|standard/i,
  )

  const safetyCase = imagingCases.find((imagingCase) => imagingCase.id === 'case-6')!
  await page.locator('[data-integrated-case-link="case-6"]').click()
  await expect(page).toHaveURL(/\/en\/peripheral-imaging\/assess\?case=case-6$/)
  await expect(page.locator('[data-integrated-case="case-6"]')).toBeVisible()
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Show the explanation' }).click()
  await expect(page.locator('[data-explanation-reveal]')).toContainText(safetyCase.item.explanation)
  await expect(page.locator('[data-prediction-choices] input:checked')).toHaveCount(0)
  await capture(page, info, 'integrated-case-explanation.png')
  await page.getByRole('button', { name: 'Hide the explanation' }).click()

  const unsafe = safetyCase.item.choices.find((choice) => choice.plausibility === 'unsafe')!
  await page.locator(`[data-prediction-choices] input[value="${unsafe.id}"]`).check()
  await page.locator('[data-now-primary]').click()
  await expect(page.locator('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'unsafe',
  )
  await capture(page, info, 'integrated-case-unsafe-feedback.png')
  await page.locator('[data-answer-again]').click()
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)

  // Moving on needs no answer.
  await page.locator('[data-next-case]').click()
  await expect(page.locator('[data-integrated-case="case-7"]')).toBeVisible()

  // A deep link, and a reload that restores no answer.
  await page.goto(base() + '/en/peripheral-imaging/assess?case=case-1')
  await expect(page.locator('[data-integrated-case="case-1"]')).toBeVisible()
  await page.reload()
  await expect(page.locator('[data-integrated-case="case-1"]')).toBeVisible()
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)

  await page.goto(base() + '/en/peripheral-imaging/assess')
  await expect(page.locator('[data-integrated-case-link="case-6"]')).toHaveAttribute(
    'data-opened',
    'true',
  )
  await expectNoStoredResponses(page)
})

test('imaging-questions: past the evidence sort and both checks without an answer, then an outline jump', async ({
  page,
}, info) => {
  // Contract change (PI-01): G00 found this sort blocked Continue with "6 of 6 still to place".
  const lesson = imagingStageLesson('imaging-questions')
  await openSection(page, 'imaging-questions')
  await advanceReading(page, 'imaging-questions')
  const sortStep = lesson.steps.find((step) => step.interaction.kind === 'sort')!
  if (sortStep.interaction.kind !== 'sort') throw new Error('Missing sort')
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', sortStep.id)
  await expect(primary(page)).toBeDisabled()
  await secondary(page).click()
  await expect(page.locator('[data-sort-reveal]')).toHaveCount(
    sortStep.interaction.sort.rows.length,
  )
  await expect(page.locator('[data-sort-verdict]')).toHaveCount(0)
  await capture(page, info, 'imaging-questions-matches-shown.png')
  await skip(page).click()

  await expect(page.locator('[data-stage]')).toHaveAttribute(
    'data-stage',
    lesson.steps[lesson.predictionStepIndex].id,
  )
  await secondary(page).click()
  await expect(page.locator('[data-explanation-reveal]')).toBeVisible()
  await skip(page).click()
  await expect(page.locator('[data-explain-unanswered]')).toBeVisible()
  await primary(page).click()
  await expect(skip(page)).toHaveText('Finish without answering')
  await skip(page).click()
  await expect(page.locator('[data-section-completion]')).toBeVisible()
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
  expect((await storedProgress(page)).reviewedSectionIds).toEqual(['imaging-questions'])
  await expectNoStoredResponses(page)

  // The outline opens any section; no answer is asked for first.
  await page.getByText('Course outline', { exact: true }).click()
  await page.locator('[data-course-outline] a[href*="section=projection"]').click()
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'projection:parallax')

  // The hub now recommends the next section, from the learner's own reviewed mark.
  await page.goto(base() + '/en/peripheral-imaging')
  await expect(page.locator('[data-imaging-continue]')).toHaveAttribute(
    'data-next-section',
    'projection',
  )
})

test('a practice case explains itself before an answer, repeats freely, moves on unanswered and stores no answer', async ({
  page,
}) => {
  // Contract change (PI-01): the first decision used to be written once and shown on return, and
  // the reasoning and section link were withheld until a decision.
  const cases = imagingMicroCasesInPathwayOrder()
  test.skip(cases.length < 2, 'Needs at least two practice cases.')
  const [first, second] = cases
  const keyed = first.item.correctChoiceIds[0]
  const other = first.item.choices.find((choice) => choice.id !== keyed)!.id

  await page.goto(base() + '/en/peripheral-imaging/practice')
  await expect(page.locator('[data-practice-continue]')).toHaveCount(1)
  await expect(page.locator('[data-practice-case-link]')).toHaveCount(cases.length)
  await expect(page.locator('[data-practice-continue]')).toHaveAttribute('data-next-case', first.id)
  await page.locator('[data-practice-continue]').click()

  await expect(page.locator(`[data-practice-case="${first.id}"]`)).toBeVisible()
  await expect(page.locator('[data-case-situation]')).toBeVisible()
  await expect(page.locator('[data-case-pairing] a')).toBeVisible()
  await expect(page.locator('[data-case-verdict]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Show the explanation' }).click()
  await expect(page.locator('[data-explanation-reveal]')).toContainText(first.item.explanation)
  await expect(page.locator('[data-prediction-choices] input:checked')).toHaveCount(0)

  await page.locator(`[data-prediction-choices] input[value="${other}"]`).check()
  await page.locator('[data-now-primary]').click()
  await expect(page.locator('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'not-correct',
  )
  await page.locator('[data-answer-again]').click()
  await expect(page.locator('[data-case-verdict]')).toHaveCount(0)
  await page.locator(`[data-prediction-choices] input[value="${keyed}"]`).check()
  await page.locator('[data-now-primary]').click()
  await expect(page.locator('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'correct',
  )

  // The next case never waits on an answer.
  await page.locator('[data-next-case]').click()
  await expect(page.locator(`[data-practice-case="${second.id}"]`)).toBeVisible()
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
  await expectNoStoredResponses(page)

  // The list says which cases were opened, and the door moves past them.
  await page.goto(base() + '/en/peripheral-imaging/practice')
  await expect(page.locator(`[data-practice-case-link="${first.id}"]`)).toHaveAttribute(
    'data-opened',
    'true',
  )
  if (cases.length > 2) {
    await expect(page.locator('[data-practice-continue]')).toHaveAttribute(
      'data-next-case',
      cases[2].id,
    )
  }
})

test('all nineteen sections render their authored explanation and visual, without architecture panels', async ({
  page,
}, info) => {
  test.setTimeout(420_000)
  for (const id of peripheralImagingSectionIds) {
    await openSection(page, id)
    const lesson = imagingStageLesson(id)
    await expect(page.locator('[data-teaching-block="boundary"]')).toHaveCount(1)
    await expect(page.getByRole('tablist', { name: 'Workspace panel views' })).toHaveCount(0)
    await expect(page.locator('[data-teaching-panel]')).toContainText(lesson.spec.objective)
    const initial = lesson.steps[0].activity
    if (initial.visual === 'suite') {
      await expect(primary(page)).toBeEnabled({ timeout: 60000 })
      const mode = await page.locator('[data-suite-scene]').getAttribute('data-suite-mode')
      if (
        ['projection', 'signal', 'field', 'time', 'cbct', 'navigation', 'augmented'].includes(mode!)
      ) {
        await expect(page.locator('[data-current-image] canvas')).toHaveCount(1)
        await expectImageSignal(page.locator('[data-current-image] canvas'))
      } else if (mode === 'sampling') {
        await expect(page.locator('[data-sampling-state] svg')).toHaveCount(3)
        await expect(
          page.locator('[data-sampling-state] canvas[data-ct-state="ready"]'),
        ).toHaveCount(3)
        for (const slice of await page.locator('[data-sampling-state] canvas').all())
          await expectImageSignal(slice, false)
      } else {
        await page.locator('[data-suite-viewport]').scrollIntoViewIfNeeded()
        await expectImageSignal(page.locator('canvas[data-three-state="ready"]'))
      }
    } else if (initial.visual === 'dose')
      await expect(page.locator('[data-dose-record] table')).toBeVisible()
    else if (initial.visual === 'provenance') {
      await expect(page.locator('[data-provenance-flow]')).toBeVisible()
      await expect(page.locator('[data-provenance-flow] li')).toHaveCount(5)
      await expect(page.locator('[data-provenance-flow]')).toContainText(
        'not a new biopsy-tool image',
      )
    } else await expect(page.locator('[data-lesson-demonstration] svg').first()).toBeVisible()
    await noHorizontalOverflow(page)
  }
  await capture(page, info, 'suite-cases-teaching.png')
})

test('acquisition movement invalidates readiness and the sampling check example shows no geometric overlay', async ({
  page,
}) => {
  await openSection(page, 'cbct-acquisition')
  await advanceReading(page, 'cbct-acquisition')
  await page.getByRole('button', { name: 'Center the lesion', exact: true }).click()
  for (const label of [
    'Target, tool and required anatomy covered',
    'Full CBCT spin path and lines checked',
    'Instrument state and anesthesia plan agreed',
    'Protection, monitoring and patient access confirmed',
  ])
    await page.getByRole('checkbox', { name: label, exact: true }).check()
  await expect(page.locator('[data-readout="ready"]')).toContainText('yes')
  await setRange(page, 'Lesion horizontal offset', 20)
  await expect(page.locator('[data-readout="ready"]')).toContainText('no')
  await expect(
    page.getByRole('checkbox', { name: 'Full CBCT spin path and lines checked', exact: true }),
  ).not.toBeChecked()
  await openSection(page, 'tool-confirmation')
  await advanceReading(page, 'tool-confirmation')
  await setRange(page, 'Tip along needle axis', 10)
  await setRange(page, 'Anterior / posterior offset', 0)
  await primary(page).click()
  await page
    .getByRole('checkbox', { name: 'Combine depths into a teaching slab', exact: true })
    .check()
  await page
    .getByRole('checkbox', { name: 'Combine depths into a teaching slab', exact: true })
    .uncheck()
  await page.getByRole('checkbox', { name: 'Reveal geometric explanation', exact: true }).check()
  await primary(page).click()
  await expect(page.locator('[data-sampling-state]')).toHaveAttribute(
    'data-sampling-state',
    'exploring',
  )
  await expect(
    page.locator('[data-readout="windowLabel"], [data-readout="windowIntersects"]'),
  ).toHaveCount(0)
  await expect(page.getByLabel('Reveal geometric explanation', { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Slices through target center', exact: true }),
  ).toHaveCount(0)
})

test('required-image failure counts nothing as seen, keeps explanation and retry, and still lets the learner move on', async ({
  page,
}) => {
  await page.route('**/peripheral-imaging/anatomy/**', (route) => route.abort())
  await openSection(page, 'projection')
  await expect(page.locator('[data-projection-state]')).toHaveAttribute(
    'data-projection-state',
    'failed',
    { timeout: 60000 },
  )
  await expect(primary(page)).toBeDisabled()
  await expect(page.locator('[data-teaching-panel]')).toContainText('parallax')
  await expect(page.getByRole('button', { name: 'Replay demonstration' })).toBeVisible()
  // Contract change (PI-01): the failed image no longer holds the learner on this step.
  await expect(skip(page)).toHaveText('Continue without the image')
  await skip(page).click()
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'projection:alignment')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.locator('[data-now-status]')).toContainText('without completing it')
  await expectNoStoredResponses(page)
})

test('laptop, tablet, small phone, keyboard and text zoom keep a single task flow', async ({
  page,
}, info) => {
  test.setTimeout(300_000)
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [1024, 768],
    [390, 844],
    [320, 740],
  ]) {
    await page.setViewportSize({ width, height })
    await openSection(page, 'projection')
    await expect(primary(page)).toBeEnabled({ timeout: 60000 })
    await noHorizontalOverflow(page)
    await expect(page.getByRole('tablist', { name: 'Workspace panel views' })).toHaveCount(0)
    await page.locator('[data-current-image]').scrollIntoViewIfNeeded()
    await expectImageSignal(page.locator('[data-current-image] canvas'))
    await capture(page, info, `projection-${width}.png`)
    await primary(page).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'projection:alignment')
    await expect(page.locator('[data-now-focus]')).toBeFocused()
  }
  for (const width of [900, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await openSection(page, 'projection')
    await expect(primary(page)).toBeEnabled({ timeout: 60000 })
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    await noHorizontalOverflow(page)
    await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeVisible()
    await primary(page).scrollIntoViewIfNeeded()
    await capture(page, info, `projection-text-200-percent-${width}.png`)
    await primary(page).click()
    await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'projection:alignment')
  }
})

async function controlRange(page: Page, key: string, value: number) {
  const control = page.locator(`#peripheral-imaging-control-${key}`)
  await expect(control).toBeEnabled({ timeout: 60000 })
  await control.fill(String(value))
  await control.dispatchEvent('change')
}
async function controlCheck(page: Page, key: string, checked = true) {
  await page.locator(`#peripheral-imaging-control-${key}`).setChecked(checked)
}
async function finishResponses(page: Page, id: string) {
  const lesson = imagingStageLesson(id as never)
  const item = lesson.steps[lesson.predictionStepIndex].interaction
  if (item.kind !== 'prediction') throw new Error('Missing interpretation')
  const wrong = item.item.choices.find((c) => !item.item.correctChoiceIds.includes(c.id))!
  await page.locator(`[data-prediction-choices] input[value="${wrong.id}"]`).check()
  await primary(page).click()
  await expect(page.locator('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'not-correct',
  )
  await page.getByRole('button', { name: 'Try this question again' }).click()
  await commitKeyed(page, id, lesson.predictionStepIndex)
  await primary(page).click()
  await primary(page).click()
  await commitKeyed(page, id, lesson.transferStepIndex)
  await primary(page).click()
  await expect(page.locator('[data-section-completion]')).toBeVisible()
  expect((await storedProgress(page)).reviewedSectionIds).toContain(id)
  await expectNoStoredResponses(page)
}

for (const id of [
  'projection',
  'field',
  'time',
  'dts-acquisition',
  'cbct-acquisition',
  'tool-confirmation',
  'changing-anatomy',
  'dose-reporting',
]) {
  test(`${id}: complete the image task, recover from a wrong interpretation and continue`, async ({
    page,
  }, info) => {
    test.setTimeout(180_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openSection(page, id)
    await advanceReading(page, id)
    if (id === 'projection') {
      await controlRange(page, 'orbit', 35)
      await primary(page).click()
      await controlRange(page, 'orbit', 0)
      await primary(page).click()
    }
    if (id === 'field') {
      await controlRange(page, 'field', 90)
      await primary(page).click()
      await controlCheck(page, 'crop')
      await controlRange(page, 'zoom', 1.5)
      await primary(page).click()
    }
    if (id === 'time') {
      await controlRange(page, 'width', 10)
      await primary(page).click()
      await controlRange(page, 'width', 5)
      await page.locator('#peripheral-imaging-control-rate').selectOption('3.75')
      await primary(page).click()
    }
    if (id === 'dts-acquisition') {
      await controlRange(page, 'plane', -18)
      await controlRange(page, 'plane', 0)
      await primary(page).click()
      await controlRange(page, 'sweep', 50)
      await primary(page).click()
      await expect(page.locator('#peripheral-imaging-control-plane')).toBeEnabled()
      await expect(page.locator('#peripheral-imaging-control-planeLesion')).toHaveCount(0)
      await controlRange(page, 'plane', 10)
      await expect(page.locator('[data-readout="planeMm"]')).toHaveCount(0)
    }
    if (id === 'cbct-acquisition') {
      await page.locator('#peripheral-imaging-control-center').click()
      for (const key of ['target', 'clearance', 'state', 'protection'])
        await controlCheck(page, key)
      await page.locator('#peripheral-imaging-control-captured').click()
      await expect(page.locator('[data-readout="captured"]')).toContainText('yes', {
        timeout: 60000,
      })
      await expect(page.locator('[data-cbct-state]')).toHaveAttribute('data-cbct-state', 'complete')
      await expect(page.locator('[data-scout-state] canvas')).toHaveCount(2)
      for (const scout of await page.locator('[data-scout-state] canvas').all())
        await expectImageSignal(scout, false)
      const scoutPixels = () =>
        page
          .locator('[data-scout-state] canvas')
          .evaluateAll((canvases) =>
            canvases.map((canvas) => (canvas as HTMLCanvasElement).toDataURL()).join('|'),
          )
      const capturedScouts = await scoutPixels()
      await page.locator('[data-cbct-state]').screenshot({
        path: info.outputPath('captured-volume.png'),
        style: 'header, footer { visibility: hidden !important; }',
      })
      await page.getByText('Course outline', { exact: true }).click()
      await page.getByText('Course outline', { exact: true }).click()
      await expect(page.locator('[data-readout="captured"]')).toContainText('yes')
      await primary(page).click()
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await page.getByRole('button', { name: /Return to step/ }).click()
      await page.getByText('Review earlier activities', { exact: true }).click()
      await page
        .getByRole('button', { name: 'Check coverage in both scout views', exact: true })
        .click()
      await page.getByRole('button', { name: 'Replay demonstration' }).click()
      await page.getByRole('button', { name: /Return to step/ }).click()
      await expect(page.locator('[data-readout="captured"]')).toContainText('yes')
      await expect(page.locator('[data-cbct-state]')).toHaveAttribute('data-cbct-state', 'complete')
      await expect.poll(async () => (await scoutPixels()) === capturedScouts).toBe(true)
      await controlRange(page, 'offsetX', 20)
      await expect(page.locator('[data-readout="ready"]')).toContainText('no')
      await expect(page.locator('[data-readout="captured"]')).toContainText('no')
      await primary(page).click()
    }
    if (id === 'tool-confirmation') {
      await controlRange(page, 'tipX', 10)
      await controlRange(page, 'tipY', 0)
      await controlRange(page, 'tipZ', 0)
      await primary(page).click()
      await controlCheck(page, 'slab')
      await controlCheck(page, 'slab', false)
      await controlCheck(page, 'revealed')
      await primary(page).click()
      await expect(page.locator('#peripheral-imaging-control-axial')).toBeEnabled()
      await controlRange(page, 'axial', 4)
      await expect(page.locator('#peripheral-imaging-control-revealed')).toHaveCount(0)
      await expect(page.locator('[data-readout="windowLabel"]')).toHaveCount(0)
      await page.setViewportSize({ width: 390, height: 844 })
      await noHorizontalOverflow(page)
      for (const overlay of await page.locator('[data-sampling-state] svg').all())
        await expect(overlay).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(page.locator('[data-sampling-state] canvas[data-ct-state="ready"]')).toHaveCount(
        3,
      )
      for (const slice of await page.locator('[data-sampling-state] canvas').all())
        await expectImageSignal(slice, false)
      await page.locator('[data-sampling-state]').scrollIntoViewIfNeeded()
      await page.locator('[data-sampling-state]').screenshot({
        path: info.outputPath('sampling-phone.png'),
        style: 'header, footer { visibility: hidden !important; }',
      })
      await page.setViewportSize({ width: 1440, height: 900 })
    }
    if (id === 'changing-anatomy') {
      await page.locator('#peripheral-imaging-control-capture').click()
      await controlRange(page, 'shift', 20)
      await expect(page.locator('[data-readout="storedShiftMm"]')).toContainText('0')
      await primary(page).click()
      await controlCheck(page, 'overlay', false)
      await expect(page.locator('[data-readout="currentShiftMm"]')).toContainText('20')
      await expect(page.locator('[data-readout="contourStale"]')).toContainText('yes')
      await primary(page).click()
    }
    if (id === 'dose-reporting') {
      await controlRange(page, 'area', 100)
      await primary(page).click()
      await advanceReading(page, id)
      await expect(page.locator('[data-dose-record]')).toContainText('6 Gy·cm²')
    }
    await expect(page.locator('[data-learning-activity]')).toHaveAttribute(
      'data-task-kind',
      'check',
    )
    await page.locator('[data-current-task]').scrollIntoViewIfNeeded()
    await capture(page, info, `${id}-independent.png`)
    await finishResponses(page, id)
  })
}

test('frozen learner images survive resizing, outline, demonstration replay and back review', async ({
  page,
}, info) => {
  await openSection(page, 'projection')
  await advanceReading(page, 'projection')
  await expect(page.locator('[data-baseline-image] img')).toHaveCount(1)
  const fingerprint = async () => page.locator('[data-baseline-image] img').getAttribute('src')
  const baseline = await fingerprint()
  await controlRange(page, 'orbit', 35)
  await page.getByText('Course outline', { exact: true }).click()
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.getByText('Course outline', { exact: true }).click()
  expect((await fingerprint()) === baseline).toBe(true)
  await primary(page).click()
  expect((await fingerprint()) === baseline).toBe(true)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save baseline image' })).toBeDisabled()
  expect((await fingerprint()) === baseline).toBe(true)
  await page.getByRole('button', { name: /Return to step/ }).click()
  await page.getByText('Review earlier activities', { exact: true }).click()
  await page
    .getByRole('button', {
      name: 'Compare projections of fixed tool and lesion geometry',
      exact: true,
    })
    .click()
  await page.getByRole('button', { name: 'Replay demonstration' }).click()
  await expectNoStoredResponses(page)
  await page.getByRole('button', { name: /Return to step/ }).click()
  expect((await fingerprint()) === baseline).toBe(true)
  await capture(page, info, 'frozen-learner-comparison.png')
})

/**
 * G02-PI-02. Course outline used to be an anchored dropdown whose only placement was `top: 100%;
 * right: 0` with a `min(80vw, 30rem)` width, so once enlarged text wrapped the header tools it
 * opened off the viewport — 412.9 px past the inline-start edge at 900 x 1000 with root text at
 * 32 px, every section link's centre outside the viewport — or, on a phone, past the bottom, where
 * the last section could not be reached at all.
 *
 * This walks the required matrix in a real browser and holds the geometry: the opened panel stays
 * inside the viewport, nothing is painted over it, the first link is there when it opens, the last
 * is reachable by scrolling the panel itself, Tab reaches every link with each one visible, and
 * the outline still navigates. Each of these fails against the pre-repair module.
 */
const OUTLINE_CONDITIONS = [
  { name: '1440x1000, normal text', width: 1440, height: 1000, textPercent: 100, anchored: true },
  { name: '1440x1000, 200% text', width: 1440, height: 1000, textPercent: 200, anchored: false },
  { name: '900x1000, 200% text', width: 900, height: 1000, textPercent: 200, anchored: false },
  { name: '390x844, 200% text', width: 390, height: 844, textPercent: 200, anchored: false },
  { name: '320x740, 200% text', width: 320, height: 740, textPercent: 200, anchored: false },
]

/** The opened panel, the viewport it has to stay inside, and what is painted over it. */
async function outlineGeometry(page: Page) {
  return page.evaluate(() => {
    const nav = document.querySelector('[data-course-outline] nav')!
    const summary = document.querySelector('[data-course-outline] summary')!
    const box = nav.getBoundingClientRect()
    const inset = 4
    // Five points on the panel: anything that comes back outside it is painted over the panel.
    const covered = (
      [
        [box.left + inset, box.top + inset],
        [box.right - inset, box.top + inset],
        [box.left + box.width / 2, box.top + box.height / 2],
        [box.left + inset, box.bottom - inset],
        [box.right - inset, box.bottom - inset],
      ] as const
    ).filter(([x, y]) => {
      if (x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight) return true
      const hit = document.elementFromPoint(x, y)
      return !(hit && nav.contains(hit))
    }).length
    const links = [...nav.querySelectorAll('a')]
    const reachable = (node: Element) => {
      const r = node.getBoundingClientRect()
      if (r.left < 0 || r.right > window.innerWidth || r.top < 0 || r.bottom > window.innerHeight)
        return false
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return Boolean(hit && (hit === node || node.contains(hit)))
    }
    return {
      position: getComputedStyle(nav).position,
      contained: (document.querySelector('[data-imaging-flow]') as HTMLElement).dataset
        .outlineContained,
      inViewport:
        box.left >= -0.5 &&
        box.right <= window.innerWidth + 0.5 &&
        box.top >= -0.5 &&
        box.bottom <= window.innerHeight + 0.5,
      covered,
      scrolls: nav.scrollHeight - nav.clientHeight > 1,
      firstLinkReachable: reachable(links[0]),
      linkCount: links.length,
      // The trigger's inline-end edge, which the anchored dropdown is aligned to.
      triggerRight: Math.round(summary.getBoundingClientRect().right * 100) / 100,
      panelRight: Math.round(box.right * 100) / 100,
      box: { top: box.top, right: box.right, bottom: box.bottom, left: box.left },
    }
  })
}

test('the Course outline opens inside the viewport at every width and text size', async ({
  page,
}, info) => {
  test.setTimeout(300_000)
  for (const condition of OUTLINE_CONDITIONS) {
    await page.setViewportSize({ width: condition.width, height: condition.height })
    await openSection(page, 'projection')
    await expect(primary(page)).toBeEnabled({ timeout: 60000 })
    if (condition.textPercent !== 100)
      await page.addStyleTag({
        content: `html { font-size: ${condition.textPercent}% !important; }`,
      })
    await page.waitForTimeout(400)

    // Opening the outline must not move the page under the learner, or widen it.
    const before = await page.evaluate(() => ({
      scrollY: window.scrollY,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    await page.evaluate(() => {
      ;(document.querySelector('[data-course-outline] summary') as HTMLElement).click()
    })
    await page.waitForTimeout(300)
    const after = await page.evaluate(() => ({
      scrollY: window.scrollY,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(after.scrollY, `${condition.name}: page jumped`).toBe(before.scrollY)
    // The page itself already overflows by 3 px at 320 px with 200% text, from the course title
    // block — pre-existing debt G02 recorded and this repair does not touch. What has to hold is
    // that the outline adds nothing to it.
    expect(after.scrollWidth, `${condition.name}: the outline widened the page`).toBe(
      before.scrollWidth,
    )

    const geometry = await outlineGeometry(page)
    expect(geometry.linkCount, condition.name).toBe(peripheralImagingSectionIds.length)
    expect(geometry.inViewport, `${condition.name}: outline left the viewport`).toBe(true)
    expect(geometry.covered, `${condition.name}: chrome painted over the outline`).toBe(0)
    expect(geometry.firstLinkReachable, `${condition.name}: first section unreachable`).toBe(true)

    // Desktop width at normal text keeps the anchored dropdown, aligned to its trigger.
    expect(geometry.contained, condition.name).toBe(String(!condition.anchored))
    expect(geometry.position, condition.name).toBe(condition.anchored ? 'absolute' : 'fixed')
    if (condition.anchored) expect(geometry.panelRight).toBe(geometry.triggerRight)

    // The last section is reached by scrolling the panel, never by scrolling the page.
    expect(geometry.scrolls, `${condition.name}: outline does not scroll`).toBe(true)
    const pageScroll = await page.evaluate(() => window.scrollY)
    const last = await page.evaluate(() => {
      const nav = document.querySelector('[data-course-outline] nav')!
      nav.scrollTop = nav.scrollHeight
      const links = [...nav.querySelectorAll('a')]
      const node = links[links.length - 1]
      const r = node.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return {
        text: node.textContent,
        reachable:
          r.top >= 0 && r.bottom <= window.innerHeight && Boolean(hit && node.contains(hit)),
      }
    })
    expect(last.reachable, `${condition.name}: last section unreachable`).toBe(true)
    expect(await page.evaluate(() => window.scrollY), `${condition.name}: page scrolled`).toBe(
      pageScroll,
    )

    // Tab reaches every link, and every focused link is visible and unobstructed.
    await page.evaluate(() => {
      const outline = document.querySelector('[data-course-outline]')!
      outline.querySelector('nav')!.scrollTop = 0
      ;(outline.querySelector('summary') as HTMLElement).focus()
    })
    for (let index = 0; index < geometry.linkCount; index += 1) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(80)
      const focused = await page.evaluate(() => {
        const node = document.activeElement!
        const nav = document.querySelector('[data-course-outline] nav')!
        const r = node.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return {
          inside: nav.contains(node),
          visible:
            r.top >= 0 &&
            r.bottom <= window.innerHeight &&
            r.left >= 0 &&
            r.right <= window.innerWidth &&
            Boolean(hit && (hit === node || node.contains(hit))),
        }
      })
      expect(focused.inside, `${condition.name}: Tab ${index + 1} left the outline`).toBe(true)
      expect(focused.visible, `${condition.name}: Tab ${index + 1} is not visible`).toBe(true)
    }
    await capture(page, info, `outline-${condition.width}-${condition.textPercent}.png`)

    // Escape closes it and puts focus back on a trigger the learner can see.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    const closed = await page.evaluate(() => {
      const outline = document.querySelector('[data-course-outline]') as HTMLDetailsElement
      const summary = outline.querySelector('summary')!
      const r = summary.getBoundingClientRect()
      const hit =
        r.top >= 0 && r.bottom <= window.innerHeight
          ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          : null
      return {
        open: outline.open,
        focused: document.activeElement === summary,
        visible: Boolean(hit && (hit === summary || summary.contains(hit))),
      }
    })
    expect(closed.open, `${condition.name}: Escape left it open`).toBe(false)
    expect(closed.focused, `${condition.name}: focus did not return to the trigger`).toBe(true)
    expect(closed.visible, `${condition.name}: the trigger came back hidden`).toBe(true)

    // Reopening and choosing a section still navigates.
    await page.evaluate(() => {
      ;(document.querySelector('[data-course-outline] summary') as HTMLElement).click()
    })
    await page.waitForTimeout(250)
    await page.evaluate(() => {
      const link = document.querySelector(
        '[data-course-outline] a[href*="section=dose-reporting"]',
      ) as HTMLElement
      link.click()
    })
    await expect(page.locator('[data-stage]')).toHaveAttribute(
      'data-stage',
      imagingStageLesson('dose-reporting' as never).steps[0].id,
      { timeout: 60000 },
    )
  }
})

/**
 * PI-FOCUS-01 (G02-PI-01) reserved the pinned chrome for the browser's own focus scrolling and
 * dropped the pin from chrome that no longer fits. The outline repair reuses that same
 * measurement, so this holds it: the chrome stays pinned where it fits and the reservation the
 * stylesheet reads is the chrome that is actually there.
 */
test('the activity still reserves its pinned chrome for keyboard focus', async ({ page }) => {
  test.setTimeout(120_000)
  for (const [width, height, textPercent, pinned] of [
    [1440, 1000, 100, true],
    [900, 1000, 200, false],
  ] as const) {
    await page.setViewportSize({ width, height })
    await openSection(page, 'projection')
    await expect(primary(page)).toBeEnabled({ timeout: 60000 })
    if (textPercent !== 100)
      await page.addStyleTag({ content: `html { font-size: ${textPercent}% !important; }` })
    await page.waitForTimeout(400)
    const state = await page.evaluate(() => {
      const shell = document.querySelector('[data-imaging-flow]') as HTMLElement
      const header = shell.querySelector(':scope > header')!
      const footer = shell.querySelector(':scope > footer')!
      const root = document.documentElement
      const measured = (name: string) =>
        Number.parseFloat(getComputedStyle(root).getPropertyValue(name))
      return {
        chromePinned: shell.dataset.chromePinned,
        headerPosition: getComputedStyle(header).position,
        footerPosition: getComputedStyle(footer).position,
        headerBottom: header.getBoundingClientRect().bottom,
        clearTop: measured('--imaging-focus-clear-top'),
        scrollPaddingTop: Number.parseFloat(getComputedStyle(root).scrollPaddingTop),
      }
    })
    expect(state.chromePinned, `${width}/${textPercent}`).toBe(String(pinned))
    expect(state.headerPosition, `${width}/${textPercent}`).toBe(pinned ? 'sticky' : 'static')
    expect(state.footerPosition, `${width}/${textPercent}`).toBe(pinned ? 'sticky' : 'static')
    // The page reserves what is actually painted over it, not a fixed length.
    expect(state.scrollPaddingTop).toBeCloseTo(state.clearTop, 1)
    if (pinned) expect(state.clearTop).toBeGreaterThan(state.headerBottom - 1)
  }
})
