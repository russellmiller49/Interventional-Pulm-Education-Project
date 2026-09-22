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

// PI-HELP-01: root text and injected CSS zoom are separate conditions, neither is browser zoom.
const HELP_CONDITIONS = [
  { name: '1440-normal', width: 1440, height: 1000, text: 100, zoom: 1 },
  { name: '1440-text200', width: 1440, height: 1000, text: 200, zoom: 1 },
  { name: '1440-zoom2', width: 1440, height: 1000, text: 100, zoom: 2 },
  { name: '900-text200', width: 900, height: 1000, text: 200, zoom: 1 },
  { name: '390-normal', width: 390, height: 844, text: 100, zoom: 1 },
  { name: '390-text200', width: 390, height: 844, text: 200, zoom: 1 },
  { name: '320-normal', width: 320, height: 740, text: 100, zoom: 1 },
  { name: '320-text200', width: 320, height: 740, text: 200, zoom: 1 },
]

/** Wait for fonts and stable painted geometry, including native focus scrolling. */
async function settleHelp(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    let last = ''
    let stable = 0
    for (let frame = 0; frame < 120; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const nodes = document.querySelectorAll(
        '[data-stage-help-dialog], [data-stage-help-dialog] *',
      )
      const current = JSON.stringify([
        scrollY,
        ...[...nodes].map((node) => [
          node.getBoundingClientRect().toJSON(),
          getComputedStyle(node).backgroundColor,
          node.scrollTop,
        ]),
      ])
      stable = current === last ? stable + 1 : 0
      if (stable === 4) return
      last = current
    }
    throw new Error('Help geometry did not settle')
  })
}

/** Text ranges catch a five-line Close label even when its button border box fits. */
async function helpGeometry(page: Page) {
  return page.locator('[data-stage-help-dialog]').evaluate((node) => {
    const dialog = node as HTMLDialogElement
    const title = dialog.querySelector('h2')!
    const close = dialog.querySelector('button')!
    const info = (element: Element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const rects = [...range.getClientRects()].filter((r) => r.width && r.height)
      const style = getComputedStyle(element)
      return {
        box: element.getBoundingClientRect().toJSON(),
        textRects: rects.map((r) => r.toJSON()),
        lines: new Set(rects.map((r) => r.top)).size,
        font: style.fontSize,
        color: style.color,
        background: style.backgroundColor,
      }
    }
    const words = [...title.firstChild!.textContent!.matchAll(/\S+/g)].map((match) => {
      const range = document.createRange()
      range.setStart(title.firstChild!, match.index!)
      range.setEnd(title.firstChild!, match.index! + match[0].length)
      return { word: match[0], lines: new Set([...range.getClientRects()].map((r) => r.top)).size }
    })
    const style = getComputedStyle(dialog)
    return {
      dialog: info(dialog),
      title: info(title),
      close: info(close),
      header: info(title.parentElement!),
      words,
      modal: dialog.matches(':modal'),
      insidePI: Boolean(dialog.closest('[data-imaging-flow]')),
      panelToken: style.getPropertyValue('--panel').trim(),
      stagePanel: style.getPropertyValue('--stage-panel').trim(),
      border: style.borderTopColor,
      borderWidth: style.borderTopWidth,
      bodyFont: getComputedStyle(dialog.querySelector('p')!).fontSize,
      rootFont: getComputedStyle(document.documentElement).fontSize,
      documentWidth: document.documentElement.scrollWidth,
      scrollHeight: dialog.scrollHeight,
      clientHeight: dialog.clientHeight,
      clientWidth: dialog.clientWidth,
      scrollWidth: dialog.scrollWidth,
    }
  })
}

/** Every text line must fit horizontally and be reachable by scrolling the dialog itself. */
async function helpTextReachability(page: Page) {
  return page.locator('[data-stage-help-dialog]').evaluate((node) => {
    const dialog = node as HTMLDialogElement
    const box = dialog.getBoundingClientRect()
    // Client dimensions and scrollTop are unzoomed CSS lengths; Range rectangles include zoom.
    const scale = box.width / dialog.offsetWidth
    const left = box.left + dialog.clientLeft * scale
    const right = left + dialog.clientWidth * scale
    const top = box.top + dialog.clientTop * scale
    const bottom = top + dialog.clientHeight * scale
    const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT)
    const failures: { text: string; horizontal: boolean; unreachable: boolean }[] = []
    let lines = 0
    while (walker.nextNode()) {
      const text = walker.currentNode
      if (!text.textContent?.trim()) continue
      // Text inside a closed disclosure is collapsed by design, not clipped: Chrome still reports
      // layout rectangles for it. The open state is checked by the tests that open it.
      let ancestor = text.parentElement
      let collapsed = false
      while (ancestor) {
        if (ancestor.matches('details:not([open])')) {
          const summary = ancestor.querySelector(':scope > summary')
          if (!summary?.contains(text)) collapsed = true
        }
        ancestor = ancestor.parentElement
      }
      if (collapsed) continue
      const range = document.createRange()
      range.selectNodeContents(text)
      const count = range.getClientRects().length
      for (let index = 0; index < count; index++) {
        let rect = range.getClientRects()[index]
        if (!rect.width || !rect.height) continue
        dialog.scrollTop += (rect.top + rect.height / 2 - (top + bottom) / 2) / scale
        rect = range.getClientRects()[index]
        const horizontal = rect.left < left - 1 || rect.right > right + 1
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        )
        const unreachable =
          rect.top < top - 1 || rect.bottom > bottom + 1 || !hit || !dialog.contains(hit)
        if (horizontal || unreachable)
          failures.push({ text: text.textContent, horizontal, unreachable })
        lines++
      }
    }
    return { lines, failures, scrollTop: dialog.scrollTop }
  })
}

async function helpLearnerState(page: Page) {
  return {
    url: page.url(),
    stage: await page.locator('[data-stage]').getAttribute('data-stage'),
    storage: await storedValues(page),
    controls: await page
      .locator('[data-imaging-flow] input, [data-imaging-flow] select')
      .evaluateAll((nodes) =>
        nodes.map((n) => ({ id: n.id, value: (n as HTMLInputElement).value })),
      ),
  }
}

for (const condition of HELP_CONDITIONS) {
  test(`Help presentation and dismissal: ${condition.name}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
    await page.setViewportSize({ width: condition.width, height: condition.height })
    await openSection(page, 'projection')
    await expect(primary(page)).toBeEnabled({ timeout: 60000 })
    await page.addStyleTag({
      content: `html { font-size:${condition.text}% !important; zoom:${condition.zoom}; }`,
    })
    const help = page.getByRole('button', { name: 'Help', exact: true })
    await help.focus()
    await settleHelp(page)
    const before = await helpLearnerState(page)
    const beforeWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'What do I do now?', exact: true })
    const close = dialog.getByRole('button', { name: 'Close', exact: true })
    await expect(close).toBeFocused()
    await settleHelp(page)
    const geometry = await helpGeometry(page)
    await info.attach('help-geometry.json', {
      body: JSON.stringify(geometry, null, 2),
      contentType: 'application/json',
    })
    await capture(page, info, 'help-top.png')
    // The native modal is in the top layer. An opaque resolved background plus the inspected
    // screenshot establishes that lesson text cannot show through the panel.
    expect.soft(geometry.modal).toBe(true)
    expect.soft(geometry.insidePI).toBe(true)
    expect.soft(geometry.stagePanel).toBe(geometry.panelToken)
    expect.soft(geometry.dialog.background).toBe('rgb(16, 38, 43)')
    expect.soft(geometry.dialog.color).toBe('rgb(234, 244, 244)')
    expect.soft(geometry.border).toBe('rgba(163, 206, 209, 0.22)')
    expect.soft(geometry.borderWidth).toBe('1px')
    expect.soft(geometry.bodyFont).toBe(`${(16 * condition.text) / 100}px`)
    expect.soft(geometry.rootFont).toBe(`${(16 * condition.text) / 100}px`)
    expect.soft(geometry.close.lines, 'Close must stay a word').toBe(1)
    expect
      .soft(
        geometry.words.filter((w) => w.lines !== 1),
        'heading words must stay readable',
      )
      .toEqual([])
    const d = geometry.dialog.box
    expect.soft(d.left).toBeGreaterThanOrEqual(0)
    expect.soft(d.top).toBeGreaterThanOrEqual(0)
    expect.soft(d.right).toBeLessThanOrEqual(condition.width)
    expect.soft(d.bottom).toBeLessThanOrEqual(condition.height)
    const t = geometry.title.box
    const c = geometry.close.box
    expect.soft(t.right <= c.left || t.bottom <= c.top, 'heading overlaps Close').toBe(true)
    if (condition.name === '320-text200') {
      expect.soft(t.width / geometry.header.box.width).toBeGreaterThan(0.9)
      expect.soft(c.top).toBeGreaterThanOrEqual(t.bottom)
      expect.soft(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight)
    }
    if (condition.name === '1440-normal') {
      expect.soft(geometry.title.lines).toBe(1)
      expect.soft(t.right).toBeLessThan(c.left)
    }
    expect.soft(geometry.documentWidth, 'Help must not add page overflow').toBe(beforeWidth)
    expect.soft(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
    const text = await helpTextReachability(page)
    expect.soft(text.lines).toBeGreaterThan(5)
    expect.soft(text.failures, 'clipped or unreachable text ranges').toEqual([])
    await capture(page, info, 'help-bottom.png')
    await info.attach('help-text-reachability.json', {
      body: JSON.stringify(text, null, 2),
      contentType: 'application/json',
    })

    // Enter activates the actual Close control even after reading the bottom of a tall dialog.
    await close.focus()
    await page.keyboard.press('Enter')
    await expect(dialog).not.toBeVisible()
    await expect(help).toBeFocused()
    expect(await helpLearnerState(page)).toEqual(before)
    await help.click()
    await close.click()
    await expect(help).toBeFocused()
    expect(await helpLearnerState(page)).toEqual(before)
    await help.click()
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(help).toBeFocused()
    expect(await helpLearnerState(page)).toEqual(before)
  })
}

test('Help keeps longer existing content reachable and keyboard navigation modal in both site themes', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openSection(page, 'projection')
  await advanceReading(page, 'projection')
  await page.addStyleTag({ content: 'html { font-size:200% !important; }' })
  const help = page.getByRole('button', { name: 'Help', exact: true })
  const dialog = page.getByRole('dialog', { name: 'What do I do now?', exact: true })
  const close = dialog.getByRole('button', { name: 'Close', exact: true })
  const locate = dialog.getByRole('button', { name: 'Show me where', exact: true })
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await expect(page.locator('html')).toHaveClass(new RegExp(colorScheme))
    const before = await helpLearnerState(page)
    await help.focus()
    await page.keyboard.press('Enter')
    await expect(close).toBeFocused()
    await expect(locate).toBeVisible()
    await settleHelp(page)
    const geometry = await helpGeometry(page)
    expect(geometry.dialog.background).toBe('rgb(16, 38, 43)')
    expect(geometry.dialog.color).toBe('rgb(234, 244, 244)')
    expect(geometry.close.lines).toBe(1)
    expect((await helpTextReachability(page)).failures).toEqual([])
    await page.keyboard.press('Tab')
    await expect(locate).toBeFocused()
    await settleHelp(page)
    const visible = await locate.evaluate((node) => {
      const box = node.getBoundingClientRect()
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      return box.top >= 0 && box.bottom <= innerHeight && Boolean(hit && node.contains(hit))
    })
    expect(visible).toBe(true)
    await capture(page, info, `help-long-${colorScheme}-bottom.png`)
    await page.keyboard.press('Tab')
    const terms = dialog.locator('[data-section-glossary="help"]')
    await expect(terms.locator(':scope > summary')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(terms).toHaveAttribute('open', '')
    expect((await helpTextReachability(page)).failures).toEqual([])
    await page.keyboard.press('Enter')
    await expect(terms).not.toHaveAttribute('open', '')
    await page.keyboard.press('Shift+Tab')
    await expect(locate).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(close).toBeFocused()
    await settleHelp(page)
    await capture(page, info, `help-long-${colorScheme}-top.png`)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(help).toBeFocused()
    expect(await helpLearnerState(page)).toEqual(before)
  }
})

/* ------------------------------------------------------------------ *
 * PI-FELLOW-01 — AI-assisted first-year-fellow walkthrough, 2026-09-18
 *
 * Three browser regressions for the runtime defects that walkthrough reported. The evidence
 * provenance is an AI walkthrough, not a learner study: these tests check the application's
 * behaviour, and establish nothing clinical.
 * ------------------------------------------------------------------ */

/** Walk `chain-walk` to its fixed example, changing the C-arm on the way when asked to. */
async function reachWalkCheckWithObliquity(page: Page, priorObliquity: number | null) {
  const lesson = imagingStageLesson('chain-walk')
  const checkId = lesson.steps[lesson.predictionStepIndex].id
  await openSection(page, 'chain-walk')
  for (let guard = 0; guard < 40; guard++) {
    const stage = await page.locator('[data-stage]').getAttribute('data-stage')
    if (stage === checkId) return
    const step = lesson.steps.find((candidate) => candidate.id === stage)!
    if (step.interaction.kind === 'walk' && priorObliquity !== null)
      await controlRange(page, 'orbit', priorObliquity)
    if ((await primary(page).count()) > 0) {
      await expect(primary(page)).toBeEnabled({ timeout: 60000 })
      await primary(page).click()
    } else await skip(page).click()
  }
  throw new Error(`Never reached ${checkId}`)
}

/** What a learner can read of a fixed example's acquisition state. */
async function fixedExampleReading(page: Page) {
  await expect(page.locator('[data-authored-example]')).toHaveCount(1)
  return page.evaluate(() => {
    const value = (key: string) =>
      (document.getElementById(`peripheral-imaging-control-${key}`) as HTMLInputElement | null)
        ?.value ?? null
    const output = (key: string) =>
      document
        .querySelector(`output[for="peripheral-imaging-control-${key}"]`)
        ?.textContent?.trim() ?? null
    return {
      identity: document
        .querySelector('[data-authored-example]')
        ?.getAttribute('data-authored-example'),
      orbit: value('orbit'),
      tilt: value('tilt'),
      orbitShown: output('orbit'),
      tiltShown: output('tilt'),
      dockDisabled:
        document.querySelector<HTMLFieldSetElement>('[data-suite-controls]')?.disabled ?? null,
      lockedReason:
        Array.from(document.querySelectorAll('[data-suite-locked], .reason, p'))
          .map((node) => node.textContent?.trim() ?? '')
          .find((text) => /stays fixed so the question and the image match/.test(text)) ?? null,
    }
  })
}

test('report 2.1: the fixed example is one authored image whatever the learner set beforehand', async ({
  page,
}, info) => {
  // PDF p.16, screenshot p.22. The banner promised a held image; the pane was handed the learner's
  // own controls, so a C-arm left at 47 degrees in the component walk contradicted a question
  // about a superimposed tool and nodule. Fails against the pre-repair module at the first history.
  const readings: {
    history: number | null
    reading: Awaited<ReturnType<typeof fixedExampleReading>>
  }[] = []
  for (const history of [null, 47, -28, 75]) {
    await page.evaluate(() => localStorage.clear())
    await reachWalkCheckWithObliquity(page, history)
    readings.push({ history, reading: await fixedExampleReading(page) })
    await capture(page, info, `fellow-21-prior-${history}.png`)
  }
  const [first, ...rest] = readings
  expect(first.reading.identity).toBe('chain-walk:example:0')
  expect(first.reading.orbit).toBe('0')
  expect(first.reading.tilt).toBe('0')
  expect(first.reading.orbitShown).toBe('0°')
  expect(first.reading.dockDisabled).toBe(true)
  expect(first.reading.lockedReason).not.toBeNull()
  for (const other of rest) expect(other.reading).toEqual(first.reading)

  // Reading, revealing and retrying the example is not work performed.
  await secondary(page).click()
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
  await page.locator('[data-prediction-choices] input').first().check()
  await primary(page).click()
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(1)
  await secondary(page).click()
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
  expect(await fixedExampleReading(page)).toEqual(first.reading)
  await expectNoStoredResponses(page)
  expect((await storedProgress(page)).reviewedSectionIds).toEqual([])
})

/** The two comparison panels, reduced to acquisition state and display operations. */
async function comparisonPanels(page: Page) {
  return page.evaluate(() => {
    const read = (selector: string) => {
      const root = document.querySelector(selector)
      if (!root) return null
      return {
        caption: root.querySelector('figcaption')?.textContent?.trim() ?? null,
        pixels: root.querySelector('img')?.getAttribute('src') ?? null,
        zoom: root.querySelector('[data-monitor-zoom]')?.getAttribute('data-monitor-zoom') ?? null,
        masks: Array.from(root.querySelectorAll('[data-field-mask]')).map(
          (node) => (node as HTMLElement).dataset.maskKind ?? 'unknown',
        ),
      }
    }
    return { baseline: read('[data-baseline-image]'), current: read('[data-current-image]') }
  })
}

test('report 2.12: a stored acquisition keeps its own pixels while display operations change the current view', async ({
  page,
}, info) => {
  // PDF p.20, screenshot p.26. The baseline panel inherited the electronic crop and display zoom
  // that happened to be applied when it was frozen, so both panels showed the same cropped picture.
  await openSection(page, 'good-image')
  await expect(primary(page)).toBeEnabled({ timeout: 60000 })
  await primary(page).click()
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'good-image:display')
  await expect(page.locator('[data-projection-state]')).toHaveAttribute(
    'data-projection-state',
    'ready',
  )
  await expect(page.locator('[data-baseline-image]')).toHaveCount(1)

  // The authored comparison opens on the crop example, and the two panels differ.
  await expect(
    page.getByRole('button', { name: 'Crop the baseline stored frame', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  const cropped = await comparisonPanels(page)
  expect(cropped.baseline!.masks).toEqual(['acquired-field'])
  expect(cropped.current!.masks).toContain('display-crop')
  expect(cropped.baseline!.zoom).toBe('1')
  await capture(page, info, 'fellow-212-crop.png')

  // Display zoom moves the current view and leaves the stored acquisition alone.
  await page.getByRole('button', { name: 'Zoom the baseline stored frame', exact: true }).click()
  const zoomed = await comparisonPanels(page)
  expect(zoomed.current!.zoom).toBe('1.5')
  expect(zoomed.baseline).toEqual(cropped.baseline)
  expect(zoomed.current!.masks).not.toContain('display-crop')
  await capture(page, info, 'fellow-212-zoom.png')

  // Replaying the demonstration and resizing leave the same stored acquisition in place.
  await page.getByRole('button', { name: 'Replay demonstration' }).click()
  await expect(page.locator('[data-projection-state]')).toHaveAttribute(
    'data-projection-state',
    'ready',
  )
  await page.setViewportSize({ width: 1024, height: 768 })
  const replayed = await comparisonPanels(page)
  expect(replayed.baseline!.masks).toEqual(['acquired-field'])
  expect(replayed.baseline!.caption).toBe(cropped.baseline!.caption)
  expect(replayed.baseline!.zoom).toBe('1')
  await page.setViewportSize({ width: 1440, height: 1050 })
  await expectNoStoredResponses(page)
})

test('report 4.5: the image source that is already selected is styled as selected, with no click', async ({
  page,
}, info) => {
  // PDF p.34. "Acquired projections" carried aria-pressed="true" on load but the dock had no rule
  // for it, so all three buttons looked identical until another was clicked.
  await openSection(page, 'dts-interpretation')
  await expect(primary(page)).toBeEnabled({ timeout: 60000 })
  await primary(page).click()
  await expect(page.locator('[data-stage]')).toHaveAttribute(
    'data-stage',
    'dts-interpretation:prior',
  )
  const source = page.locator('fieldset', { has: page.getByText('Image source', { exact: true }) })
  const selected = source.getByRole('button', { name: 'Acquired projections', exact: true })
  await expect(selected).toHaveAttribute('aria-pressed', 'true', { timeout: 60000 })
  const styles = await source.evaluate((node) =>
    Array.from(node.querySelectorAll('button')).map((button) => {
      const computed = getComputedStyle(button)
      return {
        label: button.textContent?.trim(),
        pressed: button.getAttribute('aria-pressed'),
        background: computed.backgroundColor,
        borderColor: computed.borderTopColor,
        fontWeight: computed.fontWeight,
      }
    }),
  )
  const [pressed, ...others] = styles
  expect(pressed.pressed).toBe('true')
  for (const other of others) {
    expect(other.pressed).toBe('false')
    expect(other.background).not.toBe(pressed.background)
    expect(other.borderColor).not.toBe(pressed.borderColor)
  }
  await capture(page, info, 'fellow-45-image-source.png')
})

/* ------------------------------------------------------------------ *
 * PI-FELLOW-02 — the figure, the instruction and the control together.
 *
 * Source: an AI-assisted walkthrough written in a first-year-fellow persona (PDF pp.4–47). Each
 * test below reproduces one of its browser observations against the running module with real
 * pointer, wheel and keyboard input, and measures rendered rectangles, pixels and computed styles.
 * None of it is learner-study evidence or clinical review.
 * ------------------------------------------------------------------ */

/** Advance with Continue on reading steps and the step's own skip elsewhere, to the first `kind`. */
async function advanceToKind(page: Page, sectionId: string, kind: string) {
  const lesson = imagingStageLesson(sectionId as never)
  await openSection(page, sectionId)
  for (let guard = 0; guard < lesson.steps.length; guard++) {
    const stage = await page.locator('[data-stage]').getAttribute('data-stage')
    const step = lesson.steps.find((candidate) => candidate.id === stage)!
    if (step.interaction.kind === kind) return step
    if (step.interaction.kind === 'read') {
      await expect(primary(page)).toBeEnabled({ timeout: 60000 })
      await primary(page).click()
    } else await skip(page).click()
    await expect(page.locator('[data-stage]')).not.toHaveAttribute('data-stage', stage!)
  }
  throw new Error(`No ${kind} step in ${sectionId}`)
}

/**
 * A real pointer click at the control's own centre. `locator.click()` first scrolls its target
 * "into view" against the page's scroll-padding, which for a button in the pinned footer moves the
 * page on every click — an artefact of the harness that a learner's click does not have.
 */
async function pointerClick(page: Page, target: Locator) {
  const box = (await target.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

/** How much of each element lies in the band the pinned header and footer leave uncovered. */
async function inUncoveredBand(page: Page, selectors: Record<string, string>) {
  return page.evaluate((entries) => {
    const flow = document.querySelector('[data-imaging-flow]')!
    const header = flow.querySelector(':scope > header')!
    const footer = flow.querySelector(':scope > footer')!
    const pinned = (node: Element) => getComputedStyle(node).position === 'sticky'
    const top = pinned(header) ? header.getBoundingClientRect().bottom : 0
    const bottom = pinned(footer) ? footer.getBoundingClientRect().top : window.innerHeight
    const result: Record<string, { visiblePx: number; fraction: number; top: number } | null> = {}
    for (const [name, selector] of Object.entries(entries)) {
      const node = document.querySelector(selector)
      if (!node) {
        result[name] = null
        continue
      }
      const rect = node.getBoundingClientRect()
      const visiblePx = Math.max(0, Math.min(rect.bottom, bottom) - Math.max(rect.top, top))
      result[name] = {
        visiblePx: Math.round(visiblePx),
        fraction: rect.height ? visiblePx / rect.height : 0,
        top: Math.round(rect.top - top),
      }
    }
    return result
  }, selectors)
}

async function sceneReady(page: Page) {
  await expect(page.locator('[data-suite-scene]').first()).toHaveAttribute(
    'data-suite-state',
    'ready',
    { timeout: 90000 },
  )
}

/** Rendered bounds of every scene label, and each label's distance from the object it names. */
async function sceneLabels(page: Page) {
  return page.evaluate(() => {
    const host = document.querySelector('[data-suite-viewport]')!.getBoundingClientRect()
    const labels = [...document.querySelectorAll<HTMLElement>('[data-scene-label]')]
      .filter((node) => getComputedStyle(node).visibility !== 'hidden')
      .map((node) => {
        const rect = node.getBoundingClientRect()
        const ax = Number(node.dataset.anchorX) + host.left
        const ay = Number(node.dataset.anchorY) + host.top
        const dx = Math.max(rect.left - ax, 0, ax - rect.right)
        const dy = Math.max(rect.top - ay, 0, ay - rect.bottom)
        return {
          id: node.dataset.sceneLabel!,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          fromObject: Math.hypot(dx, dy),
          leader: node.dataset.labelLeader === 'true',
          inside:
            rect.left >= host.left - 1 &&
            rect.right <= host.right + 1 &&
            rect.top >= host.top - 1 &&
            rect.bottom <= host.bottom + 1,
        }
      })
    const overlaps: string[] = []
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i]
        const b = labels[j]
        if (
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5
        )
          overlaps.push(`${a.id} × ${b.id}`)
      }
    return { labels, overlaps }
  })
}

async function scenePixels(page: Page) {
  return page.locator('[data-suite-viewport] canvas').evaluate((node) => {
    const canvas = node as HTMLCanvasElement
    const gl = canvas.getContext('webgl2')!
    const pixels = new Uint8Array(canvas.width * canvas.height * 4)
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    let hash = 0
    for (let i = 0; i < pixels.length; i += 97) hash = (hash * 31 + pixels[i]) >>> 0
    return hash
  })
}

test('report 2.2: the wheel over the 3D scene scrolls the page, and the camera has explicit keyboard controls', async ({
  page,
}, info) => {
  // PDF p.16. With the pointer over the scene the wheel zoomed the camera and the page stood still.
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await advanceToKind(page, 'chain-walk', 'walk')
  await sceneReady(page)
  const viewport = page.locator('[data-suite-viewport]')
  const box = (await viewport.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  const before = await scenePixels(page)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.mouse.wheel(0, 300)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(250)
  // The wheel did not move the camera on its way past.
  expect(await scenePixels(page)).toBe(before)

  // Ctrl + wheel is the browser's zoom gesture: the scene must not cancel it.
  await page.evaluate(() => window.scrollTo(0, 0))
  const prevented = await viewport.locator('canvas').evaluate((canvas) => {
    const event = new WheelEvent('wheel', {
      deltaY: -120,
      ctrlKey: true,
      cancelable: true,
      bubbles: true,
    })
    canvas.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(prevented).toBe(false)
  // Touch: a vertical swipe belongs to the page, and a pinch to the browser.
  expect(
    await viewport.locator('canvas').evaluate((canvas) => getComputedStyle(canvas).touchAction),
  ).toBe('pan-y pinch-zoom')

  // The explicit controls, by keyboard, change what the scene draws; Reset brings the preset back.
  const moves = page.getByRole('group', { name: 'Move the 3D camera' })
  await moves.getByRole('button', { name: 'Zoom the view in' }).focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => scenePixels(page)).not.toBe(before)
  const zoomed = await scenePixels(page)
  await moves.getByRole('button', { name: 'Rotate the view right' }).focus()
  await page.keyboard.press('Space')
  await expect.poll(() => scenePixels(page)).not.toBe(zoomed)
  await moves.getByRole('button', { name: 'Reset view' }).focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => scenePixels(page)).toBe(before)

  // Pointer rotation still works, with no mode to enter or leave.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => scenePixels(page)).not.toBe(before)
  await capture(page, info, 'fellow2-22-camera.png')
})

for (const size of [
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
]) {
  test(`report 2.3: the walk keeps the highlighted component and its text together at ${size.width}×${size.height}`, async ({
    page,
  }, info) => {
    // PDF p.17/p.23. The component text started about 1,000 px below the highlight it describes.
    await page.setViewportSize(size)
    await page.emulateMedia({ colorScheme: 'dark' })
    await advanceToKind(page, 'chain-walk', 'walk')
    await sceneReady(page)
    const together = async () => {
      // The highlight moves between pins on a change; read it once it has landed.
      await expect(page.locator('[data-chain-pin][aria-current="step"]')).toBeVisible()
      const seen = await inUncoveredBand(page, {
        scene: '[data-suite-viewport]',
        text: '[data-walk-stop]',
        lit: '[data-chain-pin][aria-current="step"]',
      })
      // The lit component, the scene it is in, and the start of the text about it.
      expect(seen.scene!.fraction).toBeGreaterThan(0.85)
      expect(seen.lit!.fraction).toBeGreaterThan(0.99)
      expect(seen.text!.visiblePx).toBeGreaterThan(200)
      expect(seen.text!.top).toBeGreaterThanOrEqual(0)
      // Beside it, not below it.
      const [scene, text] = await Promise.all([
        page.locator('[data-suite-viewport]').boundingBox(),
        page.locator('[data-walk-stop]').boundingBox(),
      ])
      expect(text!.x).toBeGreaterThanOrEqual(scene!.x + scene!.width)
    }
    await together()
    const titles = new Set<string>()
    for (let stop = 0; stop < 4; stop++) {
      titles.add((await page.locator('[data-walk-stop]').getAttribute('data-walk-stop'))!)
      await pointerClick(page, primary(page))
      await expect
        .poll(async () => page.locator('[data-walk-stop]').getAttribute('data-walk-stop'))
        .not.toBe([...titles].at(-1))
      // Nothing scrolled: the learner is still looking at the highlight that just moved.
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      await together()
    }
    // After reading down to the projections and back by wheel, the pair is still together.
    await page.mouse.move(size.width / 2, size.height / 2)
    await page.mouse.wheel(0, 500)
    await page.mouse.wheel(0, -500)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await together()
    await capture(page, info, `fellow2-23-walk-${size.width}.png`)
    await noHorizontalOverflow(page)
  })
}

test('report 2.3: at the beam-geometry stop the slider, the projection it changes and the text are on screen together', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await advanceToKind(page, 'chain-walk', 'walk')
  await sceneReady(page)
  await pointerClick(page, primary(page))
  await expect(page.locator('[data-walk-stop]')).toHaveAttribute('data-walk-stop', 'beam')
  const slider = page.getByRole('slider', { name: 'C-arm obliquity' })
  // One ordinary orientation scroll: bring the control into view the way Tab would.
  await slider.focus()
  await page.waitForTimeout(150)
  const current = page.locator('[data-current-image] canvas')
  const pixelsBefore = await current.evaluate((node) =>
    (node as HTMLCanvasElement).toDataURL().slice(-200),
  )
  const scrollBefore = await page.evaluate(() => window.scrollY)
  for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-current-image] figcaption')).toContainText('C-arm obliquity 30°')
  await expect
    .poll(() => current.evaluate((node) => (node as HTMLCanvasElement).toDataURL().slice(-200)))
    .not.toBe(pixelsBefore)
  // The change was made and read without scrolling away from the control.
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)
  const seen = await inUncoveredBand(page, {
    slider: '#peripheral-imaging-control-orbit',
    current: '[data-current-image] canvas',
    text: '[data-walk-stop]',
  })
  expect(seen.slider!.fraction).toBeGreaterThan(0.99)
  expect(seen.current!.fraction).toBeGreaterThan(0.95)
  expect(seen.text!.visiblePx).toBeGreaterThan(200)
  // The 3D scene above them is scrolled out of view at this height. That is recorded as a
  // limitation in the handoff, not asserted: the slider and the projection it changes are the
  // causal pair this stop asks for.
  // A projection reduced for the walk is still a readable image, not a thumbnail.
  expect((await current.boundingBox())!.width).toBeGreaterThanOrEqual(180)
  await capture(page, info, 'fellow2-23-beam-stop.png')
})

test('report 2.4 and 2.5: labels stay beside their objects, never collide, and every preset says what it shows', async ({
  page,
}, info) => {
  // PDF p.17/p.18/p.25. "X-ray tube" sat top-left while the tube is under the table; "Tool tip" was
  // printed over "Authored target"; in Beam view all six labels were drawn at one point.
  await page.setViewportSize({ width: 1280, height: 900 })
  await advanceToKind(page, 'chain-walk', 'walk')
  await sceneReady(page)
  // Each label's box is applied a frame behind the camera, so while a preset animates a label
  // can sit outside the figure for a frame. The property is where the labels end up: read them
  // once two consecutive reads agree, and judge that snapshot.
  const settled = async () => {
    let last: Awaited<ReturnType<typeof sceneLabels>> | null = null
    let previous = ''
    await expect
      .poll(
        async () => {
          const now = await sceneLabels(page)
          const key = JSON.stringify(
            now.labels.map((l) => [l.id, Math.round(l.left), Math.round(l.top)]),
          )
          const stable = key === previous
          previous = key
          last = now
          return {
            count: now.labels.length,
            overlaps: now.overlaps,
            outside: now.labels.filter((l) => !l.inside).map((l) => l.id),
            stable,
          }
        },
        { intervals: [150, 150, 150, 250, 250, 500] },
      )
      .toEqual({ count: 8, overlaps: [], outside: [], stable: true })
    return last!
  }
  const purposes = new Set<string>()
  for (const [name, camera] of [
    ['Suite', 'suite'],
    ['Beam view', 'beam'],
    ['Anterior', 'anterior'],
    ['Side', 'side'],
    ['Head', 'head'],
    ['Target', 'target'],
    ['Suite', 'suite'],
  ] as const) {
    const before = await scenePixels(page)
    const previous = await page.locator('[data-suite-scene]').getAttribute('data-suite-camera')
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-camera', camera)
    // A label never trails its object through the change: within one poll they are apart again.
    const { labels } = await settled()
    // A preset shows its subject, not merely a pressed button: the drawn scene changed.
    if (previous !== camera) await expect.poll(() => scenePixels(page)).not.toBe(before)
    for (const label of labels) {
      expect(label.inside, `${label.id} in ${name}`).toBe(true)
      // Beside its object, or joined to it by a leader when it has had to give way.
      expect(label.fromObject < 40 || label.leader, `${label.id} in ${name}`).toBe(true)
    }
    const purpose = page.locator('[data-camera-purpose]')
    await expect(purpose).toHaveAttribute('data-camera-purpose', camera)
    purposes.add((await purpose.innerText()).split(':')[0])
    await capture(page, info, `fellow2-24-${camera}.png`)
  }
  expect([...purposes]).toEqual(['Suite', 'Beam view', 'Anterior', 'Side', 'Head', 'Target'])

  // The whole-suite view is the one the report's screenshot shows: every label is near its object.
  const suite = await settled()
  const tube = suite.labels.find((label) => label.id === 'pin-source')!
  const detector = suite.labels.find((label) => label.id === 'pin-detector')!
  expect(tube.fromObject).toBeLessThan(60)
  expect(detector.fromObject).toBeLessThan(60)
  // The tube is under the table and the detector above it; their labels follow them.
  expect(tube.top).toBeGreaterThan(detector.bottom)

  // Moving the C-arm moves the objects; the labels follow and still do not collide.
  await controlRange(page, 'orbit', 47)
  const moved = await settled()
  for (const label of moved.labels) expect(label.fromObject < 40 || label.leader).toBe(true)

  // A narrower figure re-lays the labels out rather than letting them overlap.
  await page.setViewportSize({ width: 1024, height: 768 })
  await settled()
  await capture(page, info, 'fellow2-24-1024.png')
})

test('report 2.9, 2.10, 2.13 and 2.15: cue before the figure, checklist with the controls, dark cards, opaque footer', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'dark' })
  // 2.9 — PDF p.19: the cue sat under the figure and its controls, below the fold.
  await openSection(page, 'projection')
  await sceneReady(page)
  const cue = await inUncoveredBand(page, {
    cue: '[data-look-for]',
    figure: '[data-suite-scene]',
  })
  expect(cue.cue!.fraction).toBeGreaterThan(0.99)
  expect(cue.cue!.top).toBeLessThan(cue.figure!.top)

  // 2.10 — PDF p.20: the control card was the brightest thing beside a dark image.
  const luminance = (rgb: string) => {
    const [r, g, b] = rgb.match(/\d+(\.\d+)?/g)!.map(Number)
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  }
  const surfaces = await page.evaluate(() => {
    const colour = (selector: string) => {
      const node = document.querySelector(selector)
      return node ? getComputedStyle(node).backgroundColor : null
    }
    return {
      dock: colour('[data-lab-dock]'),
      readout: colour('[data-readout]'),
      cue: colour('[data-look-for]'),
      example: colour('[data-lesson-demonstration] button'),
      ink: getComputedStyle(document.querySelector('[data-lab-dock] label')!).color,
    }
  })
  for (const [name, value] of Object.entries(surfaces))
    // The old cards measured about 0.96; the darkest of them is now the pressed example button.
    if (name !== 'ink') expect(luminance(value!), name).toBeLessThan(0.4)
  expect(luminance(surfaces.ink)).toBeGreaterThan(0.8)

  // 2.15 — PDF p.21: body text showed through the pinned footer.
  const footer = await page.locator('[data-imaging-flow] > footer').evaluate((node) => {
    const style = getComputedStyle(node)
    return { background: style.backgroundColor, position: style.position }
  })
  expect(footer.position).toBe('sticky')
  expect(footer.background).toMatch(/^rgb\(/)

  // 2.13 — PDF p.21/p.27: "the changes listed below" pointed at a list under the fold.
  await advanceToKind(page, 'good-image', 'lab-task')
  await sceneReady(page)
  await expect(page.locator('[data-now-status]')).toContainText('listed with the controls')
  await expect(page.locator('[data-step-goals]')).toHaveCount(0)
  const list = await inUncoveredBand(page, {
    goals: '[data-dock-goals]',
    controls: '[data-suite-controls]',
    image: '[data-current-image] canvas',
  })
  expect(list.goals!.fraction).toBeGreaterThan(0.99)
  expect(list.image!.fraction).toBeGreaterThan(0.9)
  const [goals, controls] = await Promise.all([
    page.locator('[data-dock-goals]').boundingBox(),
    page.locator('[data-suite-controls]').boundingBox(),
  ])
  // In the same dock, directly above the controls it is about.
  expect(Math.abs(goals!.x - controls!.x)).toBeLessThan(40)
  expect(controls!.y - (goals!.y + goals!.height)).toBeLessThan(40)
  // A real change ticks the list where the learner is looking.
  const unmet = page.locator('[data-dock-goals] li[data-met="false"]')
  const before = await unmet.count()
  expect(before).toBeGreaterThan(0)
  await controlRange(page, 'orbit', 35)
  await expect.poll(() => unmet.count()).toBeLessThan(before)
  await expect(skip(page)).toBeVisible()
  await capture(page, info, 'fellow2-213-checklist.png')
})

test('report 3.8: the pulse strip has the width of its card, one text size, and marks the readouts a change moved', async ({
  page,
}, info) => {
  // PDF p.31/p.32. Six dashes about 100 px wide under captions several times the body size.
  await page.setViewportSize({ width: 1280, height: 900 })
  await advanceToKind(page, 'time', 'lab-task')
  await sceneReady(page)
  const strip = page.locator('[data-pulse-strip]')
  const reading = () =>
    page.evaluate(() => {
      const host = document.querySelector('[data-temporal-phase]')!
      const svg = host.querySelector('[data-pulse-strip]')!
      const xs = [...svg.querySelectorAll('[data-time-sample] line')].map(
        (line) => line.getBoundingClientRect().left,
      )
      const sizes = new Set(
        [...host.querySelectorAll('p')].map((p) => getComputedStyle(p).fontSize),
      )
      return {
        span: Math.max(...xs) - Math.min(...xs),
        card: host.getBoundingClientRect().width,
        svgText: svg.querySelectorAll('text').length,
        sizes: [...sizes],
      }
    })
  const first = await reading()
  expect(first.span).toBeGreaterThan(200)
  expect(first.svgText).toBe(0)
  expect(first.sizes).toHaveLength(1)
  // The scale is fixed, so a lower pulse rate visibly spreads the samples: the causal picture.
  const readouts = async () =>
    Object.fromEntries(
      await page
        .locator('[data-readout]')
        .evaluateAll((nodes) =>
          nodes.map((node) => [
            node.getAttribute('data-readout'),
            node.querySelector('dd')!.textContent,
          ]),
        ),
    )
  const before = await readouts()
  await page.getByLabel('Pulse width').focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  const after = await readouts()
  const moved = Object.keys(after).filter((key) => after[key] !== before[key])
  expect(moved.length).toBeGreaterThan(0)
  expect(moved.length).toBeLessThan(Object.keys(after).length)
  const marked = await page
    .locator('[data-readout][data-readout-changed="true"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-readout')))
  // Exactly the readouts the change moved, and with their values intact.
  expect(marked.sort()).toEqual(moved.sort())
  expect(after.interFrameTravelMm).toBe(before.interFrameTravelMm)
  await strip.scrollIntoViewIfNeeded()
  await capture(page, info, 'fellow2-38-pulse.png')
})

test('report 4.2 and 4.3: an optional, truthful DTS overlay and projections that enlarge in place', async ({
  page,
}, info) => {
  // PDF p.33/p.38: no mark for the tool or the lesion. p.34: thirteen ~45 px thumbnails.
  await page.setViewportSize({ width: 1280, height: 900 })
  await openSection(page, 'dts-acquisition')
  for (let i = 0; i < 2; i++) {
    const stage = await page.locator('[data-stage]').getAttribute('data-stage')
    await expect(primary(page)).toBeEnabled({ timeout: 60000 })
    await primary(page).click()
    await expect(page.locator('[data-stage]')).not.toHaveAttribute('data-stage', stage!)
  }
  const plane = page.locator('[data-dts-state]')
  await expect(plane).toHaveAttribute('data-dts-state', 'ready', { timeout: 90000 })
  // Off by default: the image is read unmarked first, and its pixels are never drawn on.
  await expect(plane).toHaveAttribute('data-dts-overlay', 'hidden')
  await expect(page.locator('[data-dts-mark]')).toHaveCount(0)
  const raw = await plane
    .locator('canvas')
    .evaluate((node) => (node as HTMLCanvasElement).toDataURL())

  const toggle = page.locator('[data-dts-overlay-toggle]')
  await toggle.focus()
  await page.keyboard.press('Space')
  await expect(plane).toHaveAttribute('data-dts-overlay', 'shown')
  await expect(page.locator('[data-dts-overlay-note]')).toContainText('not something detected')
  // The "tool" example opens on the tool's plane: the tool is in it, the target 18 mm away.
  await expect(page.locator('[data-dts-mark="tool"]')).toHaveAttribute('data-in-plane', 'true')
  await expect(page.locator('[data-dts-mark="target"]')).toHaveAttribute('data-in-plane', 'false')
  await expect(page.locator('[data-dts-mark="target"] text')).toHaveText(
    'Target (model position) · 18 mm from this plane',
  )
  // An out-of-plane object gets a dotted guide, never a solid outline.
  expect(await page.locator('[data-dts-mark="target"] rect').getAttribute('stroke-dasharray')).toBe(
    '2 4',
  )
  expect(
    await page.locator('[data-dts-mark="tool"] rect').getAttribute('stroke-dasharray'),
  ).toBeNull()
  expect(
    await plane.locator('canvas').evaluate((node) => (node as HTMLCanvasElement).toDataURL()),
  ).toBe(raw)

  // The mark sits on what the model drew: the sharpest thin horizontal structure in this plane is
  // on the row the overlay names, inside the columns it brackets.
  const sharpestRow = await plane.locator('canvas').evaluate((node) => {
    const data = (node as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 256, 256).data
    const at = (x: number, y: number) => data[(y * 256 + x) * 4]
    let best = -1
    let bestScore = -1
    for (let y = 100; y < 156; y++) {
      let score = 0
      for (let x = 60; x < 160; x++) score += Math.abs(2 * at(x, y) - at(x, y - 3) - at(x, y + 3))
      if (score > bestScore) [best, bestScore] = [y, score]
    }
    return best
  })
  const toolBox = await page.locator('[data-dts-mark="tool"] rect').evaluate((rect) => ({
    y: Number(rect.getAttribute('y')),
    height: Number(rect.getAttribute('height')),
  }))
  expect(sharpestRow).toBeGreaterThanOrEqual(toolBox.y)
  expect(sharpestRow).toBeLessThanOrEqual(toolBox.y + toolBox.height)
  await capture(page, info, 'fellow2-42-overlay-tool-plane.png')

  await toggle.uncheck()
  await expect(page.locator('[data-dts-mark]')).toHaveCount(0)
  // The check that follows reads the image unaided.
  // 4.3 — a thumbnail opens the same projection, enlarged, and gives focus back on Escape.
  const thumb = page.locator('[data-dts-frame="0"] button')
  await thumb.scrollIntoViewIfNeeded()
  expect((await thumb.boundingBox())!.width).toBeLessThan(90)
  await thumb.focus()
  await page.keyboard.press('Enter')
  const enlarged = page.locator('[data-dts-enlarged]')
  await expect(enlarged).toHaveAttribute('data-dts-enlarged', '0')
  await expect(enlarged.locator('figcaption')).toContainText('Projection 1 of 13 · -15°')
  expect((await enlarged.locator('canvas').boundingBox())!.width).toBeGreaterThanOrEqual(300)
  const same = await page.evaluate(() => {
    const big = document.querySelector<HTMLCanvasElement>('[data-dts-enlarged] canvas')!
    const small = document.querySelector<HTMLCanvasElement>('[data-dts-frame="0"] canvas')!
    return big.toDataURL() === small.toDataURL()
  })
  expect(same).toBe(true)
  await enlarged.locator('[data-dts-enlarged-next]').focus()
  await page.keyboard.press('Enter')
  await expect(enlarged).toHaveAttribute('data-dts-enlarged', '1')
  await expect(page.locator('[data-dts-frame="1"] button')).toHaveAttribute('aria-pressed', 'true')
  await capture(page, info, 'fellow2-43-enlarged.png')
  await page.keyboard.press('Escape')
  await expect(enlarged).toHaveCount(0)
  await expect(thumb).toBeFocused()
})

test('report 4.2: a check never offers the overlay that would answer it', async ({ page }) => {
  await advanceToKind(page, 'dts-acquisition', 'prediction')
  await expect(page.locator('[data-dts-state]')).toHaveAttribute('data-dts-state', 'ready', {
    timeout: 90000,
  })
  await expect(page.locator('[data-dts-overlay-toggle]')).toHaveCount(0)
  await expect(page.locator('[data-dts-mark]')).toHaveCount(0)
  await expect(secondary(page)).toHaveText('Show the explanation')
})

test('report 6.2 and 6.4: controls beside the planes, and the slab shown with the thin plane through it', async ({
  page,
}, info) => {
  // PDF p.41. The sliders sat above the images here and elsewhere beside or below them; the slab
  // replaced the thin planes instead of sitting with them.
  await page.setViewportSize({ width: 1280, height: 900 })
  await advanceToKind(page, 'tool-confirmation', 'lab-task')
  await expect(page.locator('[data-ct-state="ready"]').first()).toBeVisible({ timeout: 90000 })
  const [dock, planes] = await Promise.all([
    page.locator('[data-lab-dock]').boundingBox(),
    page.locator('[data-sampling-state]').boundingBox(),
  ])
  // Beside, to the right, top-aligned: the comparison workbenches' arrangement.
  expect(dock!.x).toBeGreaterThanOrEqual(planes!.x + planes!.width)
  expect(Math.abs(dock!.y - planes!.y)).toBeLessThan(24)
  const axial = page.locator('#peripheral-imaging-control-axial')
  await axial.focus()
  const scrollBefore = await page.evaluate(() => window.scrollY)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-sampling-state]')).toContainText('Axial · 2 mm')
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)
  const seen = await inUncoveredBand(page, {
    slider: '#peripheral-imaging-control-axial',
    planes: '[data-sampling-state] svg',
  })
  expect(seen.slider!.fraction).toBeGreaterThan(0.99)
  expect(seen.planes!.fraction).toBeGreaterThan(0.9)

  await page.locator('#peripheral-imaging-control-slab').check()
  const pairs = page.locator('[data-slab-pair]')
  await expect(pairs).toHaveCount(3)
  for (const plane of ['Axial', 'Coronal', 'Sagittal']) {
    const pair = page.locator(`[data-slab-pair="${plane}"]`)
    const [thin, slab] = await Promise.all([
      pair.locator('[data-slab-pair-view="thin"]').boundingBox(),
      pair.locator('[data-slab-pair-view="slab"]').boundingBox(),
    ])
    // Matched: same size, same row, side by side.
    expect(Math.abs(thin!.width - slab!.width)).toBeLessThan(2)
    expect(Math.abs(thin!.y - slab!.y)).toBeLessThan(2)
    expect(slab!.x).toBeGreaterThan(thin!.x)
    expect(thin!.width).toBeGreaterThan(110)
    await expect(pair.locator('[data-slab-pair-view="thin"] svg')).toHaveAttribute(
      'aria-label',
      /teaching slice at/,
    )
    await expect(pair.locator('[data-slab-pair-view="slab"] svg')).toHaveAttribute(
      'aria-label',
      /teaching slab/,
    )
  }
  await capture(page, info, 'fellow2-64-slab-pairs.png')
  // A phone keeps each pair side by side and readable, one plane per row.
  await page.setViewportSize({ width: 390, height: 844 })
  const phone = await page
    .locator('[data-slab-pair="Axial"] [data-slab-pair-view="thin"]')
    .boundingBox()
  expect(phone!.width).toBeGreaterThan(130)
  await noHorizontalOverflow(page)
})

test('report PR3, 1.9, O3 and O5: readable disabled Check, readable rationale, a full intro card and labels on the picture', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'dark' })
  const contrast = (foreground: string, background: string) => {
    const channel = (value: number) => {
      const c = value / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    const lum = (rgb: string) => {
      const [r, g, b] = rgb.match(/\d+(\.\d+)?/g)!.map(Number)
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }
    const [a, b] = [lum(foreground), lum(background)].sort((x, y) => y - x)
    return (a + 0.05) / (b + 0.05)
  }

  // PR3 — PDF p.46/p.47.
  const firstCase = imagingMicroCasesInPathwayOrder()[0]
  await page.goto(`${base()}/en/peripheral-imaging/practice?case=${firstCase.id}`)
  const check = page.getByRole('button', { name: /Check my answer/ })
  await expect(check).toBeDisabled()
  const checkStyle = await check.evaluate((node) => {
    const style = getComputedStyle(node)
    return { color: style.color, background: style.backgroundColor, opacity: style.opacity }
  })
  expect(checkStyle.opacity).toBe('1')
  expect(contrast(checkStyle.color, checkStyle.background)).toBeGreaterThan(4.5)
  // The explanation is offered before any answer, as a real button, and opens without one.
  const explain = page.getByRole('button', { name: 'Show the explanation' })
  await expect(explain).toBeEnabled()
  expect(await explain.evaluate((node) => getComputedStyle(node).borderTopWidth !== '0px')).toBe(
    true,
  )
  await explain.click()
  await expect(page.getByText('Shown without an answer.')).toBeVisible()
  await expect(check).toBeDisabled()
  await page.locator('[data-prediction-choices] input').first().check()
  await expect(check).toBeEnabled()
  await capture(page, info, 'fellow2-pr3-check.png')

  // 1.9 — PDF p.13.
  await check.click()
  const others = page.locator('[data-answer-verdict] details')
  await others.locator('summary').click()
  const rationale = await page
    .locator('[data-other-answers] li')
    .first()
    .evaluate((node) => {
      const style = getComputedStyle(node)
      let surface = node as HTMLElement | null
      let background = 'rgba(0, 0, 0, 0)'
      // The panel is a translucent wash; the opaque colour under it decides what the text is read on.
      while (surface && /rgba\(.*, 0(\.\d+)?\)$/.test(background)) {
        background = getComputedStyle(surface).backgroundColor
        surface = surface.parentElement
      }
      return { color: style.color, size: style.fontSize, background }
    })
  expect(parseFloat(rationale.size)).toBeGreaterThanOrEqual(16)
  expect(contrast(rationale.color, 'rgb(16, 38, 43)')).toBeGreaterThan(7)

  // O3 and O5 — PDF p.4/p.5.
  await page.goto(`${base()}/en/peripheral-imaging`)
  const card = page.locator('[data-hub-before-you-start]')
  await card.scrollIntoViewIfNeeded()
  const cardBox = (await card.boundingBox())!
  const entries = await card
    .locator('dl > div')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect()).map((rect) => [rect.left, rect.right]),
    )
  // The entries use both halves of the card; no empty column.
  expect(Math.min(...entries.map(([left]) => left)) - cardBox.x).toBeLessThan(60)
  expect(cardBox.x + cardBox.width - Math.max(...entries.map(([, right]) => right))).toBeLessThan(
    60,
  )
  expect(new Set(entries.map(([left]) => Math.round(left))).size).toBe(2)

  const hero = page.locator('[data-hub-hero]')
  await hero.scrollIntoViewIfNeeded()
  const labels = await hero.locator('[data-hub-hero-label] span').evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return {
        text: node.textContent,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      }
    }),
  )
  expect(labels.map((label) => label.text)).toEqual([
    'X-ray tube',
    'Beam geometry',
    'Patient anatomy',
    'Flat-panel detector',
    'Reconstruction and registration',
    'Display and interpretation',
  ])
  const picture = (await hero.locator('img').boundingBox())!
  for (let i = 0; i < labels.length; i++) {
    expect(labels[i].left).toBeGreaterThanOrEqual(picture.x)
    expect(labels[i].right).toBeLessThanOrEqual(picture.x + picture.width)
    for (let j = i + 1; j < labels.length; j++)
      expect(
        Math.min(labels[i].right, labels[j].right) - Math.max(labels[i].left, labels[j].left) > 0 &&
          Math.min(labels[i].bottom, labels[j].bottom) - Math.max(labels[i].top, labels[j].top) > 0,
      ).toBe(false)
  }
  // The caption is still the text equivalent.
  await expect(hero.locator('[data-hub-hero-stop]')).toHaveCount(6)
  await hero.screenshot({ path: info.outputPath('fellow2-o5-hero.png') })
})

for (const condition of [
  { name: '390', width: 390, height: 844, root: 100 },
  { name: '320', width: 320, height: 740, root: 100 },
  { name: '1280-200pct-root-text', width: 1280, height: 900, root: 200 },
  { name: '390-200pct-root-text', width: 390, height: 844, root: 200 },
]) {
  test(`the repaired workbenches stack readably at ${condition.name}`, async ({ page }, info) => {
    // Root-text enlargement, not CSS zoom, device pixel ratio or native browser zoom.
    await page.setViewportSize({ width: condition.width, height: condition.height })
    await advanceToKind(page, 'chain-walk', 'walk')
    if (condition.root !== 100) {
      await page.addStyleTag({ content: `html { font-size: ${condition.root}% !important; }` })
      // Held, so the condition cannot silently fail to apply.
      expect(
        await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)),
      ).toBe(32)
      await expect(page.locator('[data-imaging-flow]')).toHaveAttribute(
        'data-chrome-pinned',
        'false',
      )
    }
    await sceneReady(page)
    // Stacked, in reading order: the scene, then the text about it. No pinned side column, and so
    // no fixed-height panel with a scrollbar of its own.
    const [scene, text] = await Promise.all([
      page.locator('[data-suite-viewport]').boundingBox(),
      page.locator('[data-walk-stop]').boundingBox(),
    ])
    expect(text!.y).toBeGreaterThan(scene!.y)
    const explanation = page.locator('[data-current-task] > div').nth(1)
    expect(await explanation.evaluate((node) => getComputedStyle(node).position)).toBe('static')
    expect(
      await explanation.evaluate((node) => node.scrollHeight - node.clientHeight),
    ).toBeLessThanOrEqual(1)
    // The scene draws no frames while it is off screen, so bring it into view before reading it:
    // at enlarged text it starts below the fold.
    await page.locator('[data-suite-viewport]').scrollIntoViewIfNeeded()
    await expect.poll(async () => (await sceneLabels(page)).overlaps).toEqual([])
    // The wheel still belongs to the page.
    const shown = (await page.locator('[data-suite-viewport]').boundingBox())!
    await page.mouse.move(shown.x + shown.width / 2, shown.y + Math.min(shown.height, 200) / 2)
    const y = await page.evaluate(() => window.scrollY)
    await page.mouse.wheel(0, 200)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y)
    if (condition.root === 100) await noHorizontalOverflow(page)
    await capture(page, info, `fellow2-compact-${condition.name}.png`)
  })
}

// Independent pre-merge sanity review: enlargement must work from the keyboard's actual focus,
// including immediate dismissal and returning to the opener after browsing other projections.
test('projection enlargement keeps keyboard entry and dismissal tied to the originating thumbnail', async ({
  page,
}) => {
  await advanceToKind(page, 'dts-acquisition', 'lab-task')
  await expect(page.locator('[data-dts-state]')).toHaveAttribute('data-dts-state', 'ready', {
    timeout: 90000,
  })
  for (const origin of [0, 6, 11]) {
    const thumb = page.locator(`[data-dts-frame="${origin}"] button`)
    await thumb.focus()
    await page.keyboard.press('Enter')
    const enlarged = page.locator('[data-dts-enlarged]')
    await expect(enlarged).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(enlarged).toHaveCount(0)
    await expect(thumb).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(enlarged).toBeFocused()
    // Tab from the enlarged figure reaches its controls in normal document order.
    await page.keyboard.press('Tab')
    if (origin > 0) {
      await expect(page.locator('[data-dts-enlarged-previous]')).toBeFocused()
      await page.keyboard.press('Tab')
    }
    await expect(page.locator('[data-dts-enlarged-next]')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(enlarged).toHaveAttribute('data-dts-enlarged', String(origin + 1))
    if (origin === 11) await expect(enlarged).toBeFocused()
    else await expect(page.locator('[data-dts-enlarged-next]')).toBeFocused()
    if (origin === 0 || origin === 11) await page.keyboard.press('Escape')
    else {
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-dts-enlarged-close]')).toBeFocused()
      // The next tab leaves the enlargement: this is not a modal focus trap.
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-dts-frame="0"] button')).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Enter')
    }
    await expect(enlarged).toHaveCount(0)
    await expect(thumb).toBeFocused()
  }
  const second = page.locator('[data-dts-frame="1"] button')
  await second.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await expect(page.locator('[data-dts-enlarged-previous]')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-dts-enlarged]')).toHaveAttribute('data-dts-enlarged', '0')
  await expect(page.locator('[data-dts-enlarged]')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-dts-enlarged]')).toHaveCount(0)
  await expect(second).toBeFocused()
})

test('a vertical touch gesture beginning on the 3D scene scrolls the document', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  try {
    const page = await context.newPage()
    await advanceToKind(page, 'chain-walk', 'walk')
    await sceneReady(page)
    const canvas = page.locator('[data-suite-viewport] canvas')
    await canvas.scrollIntoViewIfNeeded()
    await settleHelp(page)
    const box = (await canvas.boundingBox())!
    const x = box.x + box.width * 0.7
    const y = box.y + box.height * 0.65
    expect(
      await canvas.evaluate((node, point) => document.elementFromPoint(point.x, point.y) === node, {
        x,
        y,
      }),
    ).toBe(true)
    const before = await page.evaluate(() => window.scrollY)
    // Native Chromium touch input exercises the ancestor touch-action intersection too. This is
    // emulated touch evidence, not a physical-device test or merely a canvas-style assertion.
    const input = await context.newCDPSession(page)
    await input.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    })
    for (let step = 1; step <= 10; step++) {
      await input.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - step * 15 }],
      })
      await page.waitForTimeout(20)
    }
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 80)
  } finally {
    await context.close()
  }
})

test('slab comparison keeps each thin section tied to its own live plane slider', async ({
  page,
}) => {
  await advanceToKind(page, 'tool-confirmation', 'lab-task')
  await page.locator('#peripheral-imaging-control-slab').check()
  const pairs = page.locator('[data-slab-pair]')
  await expect(pairs.locator('[data-ct-state="ready"]')).toHaveCount(6)
  const pixels = () =>
    pairs
      .locator('canvas')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLCanvasElement).toDataURL()))
  for (const [axis, title, position, index] of [
    ['axial', 'Axial', 6, 0],
    ['coronal', 'Coronal', -12, 2],
    ['sagittal', 'Sagittal', 18, 4],
  ] as const) {
    const before = await pixels()
    for (const value of [17, -13, position]) await controlRange(page, axis, value)
    const thin = page.locator(`[data-slab-pair="${title}"] [data-slab-pair-view="thin"]`)
    await expect(thin.locator('figcaption')).toHaveText(`Thin plane · ${position} mm`)
    await expect(thin.locator('svg')).toHaveAttribute(
      'aria-label',
      new RegExp(`slice at ${position} millimeters`),
    )
    await expect.poll(async () => (await pixels())[index]).not.toBe(before[index])
    const after = await pixels()
    // The full-depth slabs and the other two thin sections have not changed.
    for (let other = 0; other < after.length; other++)
      if (other !== index) expect(after[other]).toBe(before[other])
  }
})

/*
 * PI-FELLOW-03 — Teaching clarity. Report IDs are the AI-assisted fellow walkthrough's own.
 */

async function walkToTransfer(page: Page, sectionId: string) {
  const lesson = imagingStageLesson(sectionId as never)
  const transferId = lesson.steps[lesson.transferStepIndex].id
  await openSection(page, sectionId)
  for (let guard = 0; guard < lesson.steps.length; guard++) {
    const stage = await page.locator('[data-stage]').getAttribute('data-stage')
    if (stage === transferId) return lesson
    const step = lesson.steps.find((candidate) => candidate.id === stage)!
    if (step.interaction.kind === 'read' || step.interaction.kind === 'explain') {
      await expect(primary(page)).toBeEnabled({ timeout: 60000 })
      await primary(page).click()
    } else await skip(page).click()
    await expect(page.locator('[data-stage]')).not.toHaveAttribute('data-stage', stage!)
  }
  throw new Error(`No closing question reached in ${sectionId}`)
}

async function fitsViewport(page: Page, selector: string) {
  return page.evaluate((s) => {
    const node = document.querySelector(s)
    if (!node) return null
    const rect = node.getBoundingClientRect()
    return rect.left >= -1 && rect.right <= window.innerWidth + 1
  }, selector)
}

/**
 * No horizontal overflow at normal text; at enlarged root text the shared site header (outside
 * this module) already exceeds 1280 px, so the module's own stage is what is held to the viewport.
 */
async function stageFitsViewport(page: Page, root: number) {
  if (root === 100) await noHorizontalOverflow(page)
  expect(await fitsViewport(page, '[data-imaging-flow]')).toBe(true)
  expect(await fitsViewport(page, '[data-current-task]')).toBe(true)
}

async function enlargeRootText(page: Page, root: number) {
  if (root === 100) return
  await page.addStyleTag({ content: `html { font-size: ${root}% !important; }` })
  expect(
    await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize)),
  ).toBe((16 * root) / 100)
}

test('report CW3, O2 and CW4: a deep-linked section defines its own terms, shows its opening question, and Help still navigates first', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await openSection(page, 'dts-acquisition')
  const glossary = page.locator('[data-section-glossary="teaching"]')
  await expect(glossary).toBeVisible()
  expect(await glossary.evaluate((node) => node.closest('[data-teaching-review]'))).toBeNull()
  await glossary.locator('summary').click()
  for (const id of ['dts', 'missing-wedge', 'anisotropy', 'tool-plane-spread']) {
    await expect(glossary.locator(`[data-glossary-term="${id}"]`)).toBeVisible()
  }
  await expect(
    glossary.locator('[data-glossary-term="cbct"] [data-glossary-taught-in]'),
  ).toHaveAttribute('href', /section=cbct-acquisition/)
  // The framing question is printed where it is asked, outside any disclosure, asking nothing.
  const question = page.locator('[data-opening-question]')
  await expect(question).toBeVisible()
  expect(await question.evaluate((node) => node.closest('details'))).toBeNull()
  await expect(question).toContainText(imagingStageLesson('dts-acquisition').lesson.recall.prompt)
  await expect(question.locator('input, button')).toHaveCount(0)
  await capture(page, info, 'fellow3-cw3-glossary-1280-dark.png')

  // Help: navigation first, then the section's terms and the one statement about the models.
  await page.getByRole('button', { name: 'Help', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'What do I do now?', exact: true })
  await expect(dialog).toBeVisible()
  expect(
    await dialog.evaluate((node) => {
      const nav = [...node.querySelectorAll('p')].find((p) =>
        /Any step can be skipped/.test(p.textContent ?? ''),
      )
      const terms = node.querySelector('[data-section-glossary="help"]')
      if (!nav || !terms) return null
      return Boolean(nav.compareDocumentPosition(terms) & Node.DOCUMENT_POSITION_FOLLOWING)
    }),
  ).toBe(true)
  const termsSummary = dialog.locator('[data-section-glossary="help"] > summary')
  await termsSummary.focus()
  await expect(termsSummary).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(dialog.locator('[data-section-glossary="help"]')).toHaveAttribute('open', '')
  await expect(dialog.locator('[data-glossary-term="dts"]')).toBeVisible()
  await expect(dialog.locator('[data-help-models]')).toBeVisible()
  await settleHelp(page)
  const text = await helpTextReachability(page)
  expect(text.failures, 'clipped or unreachable Help text').toEqual([])
  await capture(page, info, 'fellow3-cw3-help-1280-dark.png')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('[data-stage]')).toHaveAttribute(
    'data-stage',
    imagingStageLesson('dts-acquisition').steps[0].id,
  )
})

test('report CW1: a reused closing question is labelled optional review with a link to its section; reveal, retry and leaving unanswered remain', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const lesson = await walkToTransfer(page, 'dts-acquisition')
  await expect(page.locator('[data-now-focus] h2')).toHaveText(
    'Optional review · Projection & depth',
  )
  const origin = page.locator('[data-transfer-origin="projection"] [data-transfer-origin-link]')
  await expect(origin).toHaveAttribute('href', /section=projection/)
  await expect(page.locator('[data-now-focus]')).toContainText(
    'it first appears at the end of Section 6',
  )
  await capture(page, info, 'fellow3-cw1-review-1440.png')
  // The explanation opens before any answer.
  await expect(primary(page)).toBeDisabled()
  await expect(secondary(page)).toHaveText('Show the explanation')
  await secondary(page).click()
  await expect(page.locator('[data-explanation-reveal]')).toBeVisible()
  await secondary(page).click()
  // An answer can be checked and retried.
  await commitKeyed(page, 'dts-acquisition', lesson.transferStepIndex)
  await page.getByRole('button', { name: 'Try this question again' }).click()
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
  await expect(page.locator('[data-prediction-choices] input:checked')).toHaveCount(0)
  // The section can be finished without answering, and nothing about the answer is stored.
  await expect(skip(page)).toHaveText('Finish without answering')
  await skip(page).click()
  await expect(page.locator('[data-section-completion]')).toBeVisible()
  expect((await storedProgress(page)).reviewedSectionIds).toEqual(['dts-acquisition'])
  await expectNoStoredResponses(page)
  // The link opens the originating section at its start.
  await walkToTransfer(page, 'dts-acquisition')
  await origin.click()
  await expect(page).toHaveURL(/section=projection/)
  await expect(page.locator('[data-stage]')).toHaveAttribute(
    'data-stage',
    imagingStageLesson('projection').steps[0].id,
  )
  await expect(page.locator('[data-transfer-origin]')).toHaveCount(0)
})

test('report PR4 and CW5: the eccentric rEBUS case is offered from Section 1 and opens unchanged, and the recap folds the full feedback', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await walkToTransfer(page, 'imaging-questions')
  await expect(page.locator('[data-now-focus] h2')).toHaveText('Apply it to another situation')
  await expect(page.locator('[data-transfer-origin]')).toHaveCount(0)
  const related = page.locator('[data-related-practice-case="two-dimensional-practice-1"] a')
  await expect(related).toHaveText('Eccentric radial EBUS view')
  await related.click()
  await expect(page).toHaveURL(/practice\?case=two-dimensional-practice-1/)
  await expect(page.getByText('Eccentric radial EBUS view').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Check my answer/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Show the explanation' })).toBeEnabled()

  // CW5 — the explain step: choice, best-supported reading, takeaway; the full verdict folded.
  await openSection(page, 'projection')
  await advanceReading(page, 'projection')
  await skip(page).click()
  await skip(page).click()
  const lesson = imagingStageLesson('projection')
  await expect(page.locator('[data-stage]')).toHaveAttribute(
    'data-stage',
    lesson.steps[lesson.predictionStepIndex].id,
  )
  await commitKeyed(page, 'projection', lesson.predictionStepIndex)
  await primary(page).click()
  const recap = page.locator('[data-explain-recap] [data-check-recap]')
  await expect(recap).toBeVisible()
  await expect(recap.locator('[data-recap-best]')).toContainText('best-supported reading')
  const full = page.locator('[data-explain-recap] [data-recap-full]')
  expect(await full.evaluate((node) => (node as HTMLDetailsElement).open)).toBe(false)
  await expect(full.locator('[data-answer-verdict]')).toBeHidden()
  await full.locator(':scope > summary').click()
  await expect(full.locator('[data-answer-verdict]')).toBeVisible()
  // The step's own rhythm is untouched: Continue is where it was.
  await expect(primary(page)).toBeEnabled()
  await capture(page, info, 'fellow3-cw5-recap-1440.png')
})

for (const condition of [
  { name: '1440x900', width: 1440, height: 900, root: 100 },
  { name: '1280x900', width: 1280, height: 900, root: 100 },
  { name: '1024x768', width: 1024, height: 768, root: 100 },
  { name: '390x844', width: 390, height: 844, root: 100 },
  { name: '320x740', width: 320, height: 740, root: 100 },
  { name: '1280-200pct-root-text', width: 1280, height: 900, root: 200 },
  { name: '320-200pct-root-text', width: 320, height: 740, root: 200 },
]) {
  test(`the teaching-clarity surfaces reflow at ${condition.name}`, async ({ page }, info) => {
    test.setTimeout(300_000)
    await page.setViewportSize({ width: condition.width, height: condition.height })
    await page.emulateMedia({ reducedMotion: 'reduce' })

    // Section 10: the terms, the opening question and the DTS-led reconstruction comparison.
    await openSection(page, 'dts-acquisition')
    await enlargeRootText(page, condition.root)
    const glossary = page.locator('[data-section-glossary="teaching"]')
    await glossary.locator('summary').click()
    await expect(glossary.locator('[data-glossary-term="dts"]')).toBeVisible()
    expect(await fitsViewport(page, '[data-section-glossary="teaching"]')).toBe(true)
    await expect(page.locator('[data-opening-question]')).toBeVisible()
    const comparison = page.locator('[data-reconstruction-comparison][data-lead="tomosynthesis"]')
    await comparison.scrollIntoViewIfNeeded()
    await expect(comparison.locator('[data-reconstruction-analogy]')).toBeVisible()
    await expect(
      comparison.locator('[data-reconstruction-figure="tomosynthesis"] svg'),
    ).toBeVisible()
    await expect(comparison.locator('[data-reconstruction-table]')).toBeVisible()
    if (condition.width <= 640) {
      await expect(comparison.locator('[data-reconstruction-table] tbody td').first()).toHaveCSS(
        'display',
        'block',
      )
    }
    expect(await fitsViewport(page, '[data-reconstruction-table]')).toBe(true)
    expect(await fitsViewport(page, '[data-reconstruction-figure="cone-beam"]')).toBe(true)
    await stageFitsViewport(page, condition.root)
    await capture(page, info, `fellow3-s10-${condition.name}.png`)
    // Help, with the terms opened, stays reachable.
    await page.getByRole('button', { name: 'Help', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'What do I do now?', exact: true })
    const termsSummary = dialog.locator('[data-section-glossary="help"] > summary')
    await termsSummary.focus()
    await expect(termsSummary).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog.locator('[data-section-glossary="help"]')).toHaveAttribute('open', '')
    await settleHelp(page)
    const text = await helpTextReachability(page)
    expect(text.failures, 'clipped or unreachable Help text').toEqual([])
    await capture(page, info, `fellow3-help-${condition.name}.png`)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()

    // Section 18: the quantities table and the copyable template with nothing filled in.
    await openSection(page, 'dose-reporting')
    await enlargeRootText(page, condition.root)
    const quantities = page.locator('[data-dose-quantities]')
    await quantities.scrollIntoViewIfNeeded()
    await expect(quantities).toBeVisible()
    expect(await fitsViewport(page, '[data-dose-quantities] table')).toBe(true)
    const template = page.locator('[data-dose-note-lines]')
    await template.scrollIntoViewIfNeeded()
    await expect(template).toBeVisible()
    expect(await template.textContent()).not.toMatch(/\d/)
    expect(await fitsViewport(page, '[data-dose-note-lines]')).toBe(true)
    await stageFitsViewport(page, condition.root)
    await capture(page, info, `fellow3-s18-${condition.name}.png`)

    // Section 1: the figure's labels and the definition at the point of need.
    await openSection(page, 'imaging-questions')
    await enlargeRootText(page, condition.root)
    await page.getByRole('button', { name: 'Sampling component' }).click()
    const definition = page.locator('[data-sampling-component-definition]')
    await definition.scrollIntoViewIfNeeded()
    await expect(definition).toBeVisible()
    await expect(definition.locator('[data-sampling-component-link]')).toHaveAttribute(
      'href',
      /section=tool-confirmation/,
    )
    await expect(page.locator('[data-figure-label="sampling-component"]')).toBeVisible()
    const labelBounds = await page
      .locator('[data-figure-label="sampling-component"]')
      .evaluate((node) => {
        const box = (node as SVGGraphicsElement).getBBox()
        const view = (node.closest('svg') as SVGSVGElement).viewBox.baseVal
        return { left: box.x, right: box.x + box.width, width: view.width }
      })
    expect(labelBounds.left).toBeGreaterThanOrEqual(0)
    expect(labelBounds.right).toBeLessThanOrEqual(labelBounds.width)
    await expect(page.locator('[data-figure-legend]')).toBeVisible()
    await stageFitsViewport(page, condition.root)
    await capture(page, info, `fellow3-s1-${condition.name}.png`)
  })
}
