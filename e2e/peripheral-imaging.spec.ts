import { test, expect, type Page, type TestInfo, type Locator } from '@playwright/test'

import { imagingCases } from '../src/features/peripheral-imaging/content/cases'
import { imagingMicroCasesInPathwayOrder } from '../src/features/peripheral-imaging/content/microCases'
import { peripheralImagingSectionIds } from '../src/features/peripheral-imaging/content/pathway'
import { imagingStageLesson } from '../src/features/peripheral-imaging/content/stageLessons'
import {
  createEmptyImagingRecord,
  PERIPHERAL_IMAGING_STORAGE_KEY,
  withSectionCompleted,
} from '../src/features/peripheral-imaging/engine/learnProgress'

/*
 * The peripheral-imaging course on the shared lesson stage: the one door, a section walked the
 * way a learner walks it, the answer boundary on the suite, the record kept across a reload, the
 * capstone standard, and the compact layout. The suite's own scene checks (pixels, animation,
 * the chain pins) are Codex's and live beside these once each view lands.
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

async function openSection(page: Page, sectionId: string) {
  await page.goto(`${base()}/en/peripheral-imaging/learn?section=${sectionId}`)
  await expect(page.locator('[data-stage]')).toHaveAttribute(
    'data-stage',
    `${sectionId}-1-recognize`,
  )
  // Server-rendered layout exists before the client measures the compact workspace.
  await expect(page.locator('[data-stage-frame] > section')).toHaveAttribute(
    'style',
    /--tw-primary-width: [\d.]+px/,
    { timeout: 30_000 },
  )
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
  await primary(page).click()
  await commitKeyed(page, 'imaging-questions', 1)
  await primary(page).click()
  const lesson = imagingStageLesson('imaging-questions')
  const sort = lesson.steps[2].interaction
  if (sort.kind !== 'sort') throw new Error('Missing sort')
  for (const row of sort.sort.rows)
    await page.locator(`[data-sort-row="${row.id}"] select`).selectOption(row.origin)
  await primary(page).click()
  await primary(page).click()
  await primary(page).click()
  await commitKeyed(page, 'imaging-questions', lesson.transferStepIndex)
  await primary(page).click()
  await expect(page.locator('[data-section-completion]')).toBeVisible()
})

async function attempts(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '{}').firstAttempts ?? {},
    PERIPHERAL_IMAGING_STORAGE_KEY,
  )
}

test('projection teaching, comparison, independent feedback, retry and reload preserve history', async ({
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
  expect(await attempts(page)).toEqual({})
  await primary(page).click()
  await expect(page.getByRole('slider', { name: 'C-arm obliquity', exact: true })).toHaveValue('0')
  await expect(primary(page)).toHaveCount(0)
  await setRange(page, 'C-arm obliquity', 35)
  await primary(page).click()
  await setRange(page, 'C-arm obliquity', 0)
  await primary(page).click()
  await expect(page.locator('[data-independent-foundations]')).toBeVisible()
  await expect(
    page.locator(
      '[data-readout="depthMm"], [data-chain-outcome], [data-teaching-block="control-strip"]',
    ),
  ).toHaveCount(0)
  await expect(page.locator('[data-stage-sources]')).toHaveAttribute(
    'data-stage-sources-claims',
    'false',
  )
  await page.locator('[data-prediction-choices] input[value="a"]').check()
  await primary(page).click()
  await expect(page.locator('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'not-correct',
  )
  await page.getByRole('button', { name: 'Try this question again' }).click()
  await page.locator('[data-prediction-choices] input[value="b"]').check()
  await primary(page).click()
  expect((await attempts(page))['projection:projection-interpretation-v2'].choiceId).toBe('a')
  await page.reload()
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'projection-1-recognize')
  expect((await attempts(page))['projection:projection-interpretation-v2'].choiceId).toBe('a')
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
  expect(await attempts(page)).toEqual({})
  await primary(page).click()
  await setRange(page, 'Collimated field width', 45)
  await expect(primary(page)).toHaveCount(0)
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
  expect(await attempts(page)).toEqual({})
})

test('the capstone: gated on the sections, decided once, one wrong critical decision fails the standard', async ({
  page,
}) => {
  await page.goto(base() + '/en/peripheral-imaging/assess')
  await expect(page.locator('[data-capstone]')).toHaveAttribute('data-capstone', 'locked')
  await expect(page.locator('[data-capstone="locked"] a')).toHaveCount(
    peripheralImagingSectionIds.length,
  )

  let record = createEmptyImagingRecord()
  for (const id of peripheralImagingSectionIds) record = withSectionCompleted(record, id)
  await page.evaluate(([key, json]) => localStorage.setItem(key, json), [
    PERIPHERAL_IMAGING_STORAGE_KEY,
    JSON.stringify(record),
  ] as const)
  await page.goto(base() + '/en/peripheral-imaging/assess')
  await expect(page.locator('[data-capstone]')).toHaveAttribute('data-capstone', 'deciding')
  for (const imagingCase of imagingCases) {
    await expect(page.locator('[data-capstone="deciding"]')).toHaveAttribute(
      'data-case',
      imagingCase.id,
    )
    // No verdict of any kind while the set is being decided.
    await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
    const keyed = imagingCase.item.choices.find((choice) => choice.plausibility === 'best')!
    const wrong = imagingCase.item.choices.find((choice) => choice.plausibility !== 'best')!
    const chosen = imagingCase.id === 'case-6' ? wrong : keyed
    await page.locator(`[data-prediction-choices] input[value="${chosen.id}"]`).check()
    await page.locator('[data-now-primary]').click()
  }
  await expect(page.locator('[data-capstone]')).toHaveAttribute('data-capstone', 'debrief')
  await expect(page.locator('[data-capstone]')).toHaveAttribute('data-standard-met', 'false')
  await expect(page.locator('[data-capstone-standard]')).toContainText(
    'Seven of eight decisions held',
  )
  await expect(page.locator('[data-capstone-standard]')).toContainText('not yet met')
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(imagingCases.length)
  // First decisions are immutable: the record keeps them across a reload.
  await page.reload()
  await expect(page.locator('[data-capstone]')).toHaveAttribute('data-capstone', 'debrief')
  await expect(page.locator('[data-capstone-standard]')).toContainText(
    'Seven of eight decisions held',
  )
})

test('a practice case is decided once, and can be answered as often as the learner likes', async ({
  page,
}) => {
  const cases = imagingMicroCasesInPathwayOrder()
  test.skip(cases.length === 0, 'No practice cases are authored yet.')
  const first = cases[0]
  const keyed = first.item.correctChoiceIds[0]
  const other = first.item.choices.find((choice) => choice.id !== keyed)!.id

  await page.goto(base() + '/en/peripheral-imaging/practice')
  await expect(page.locator('[data-practice-continue]')).toHaveCount(1)
  await expect(page.locator('[data-practice-case-link]')).toHaveCount(cases.length)
  await expect(page.locator('[data-practice-continue]')).toHaveAttribute('data-next-case', first.id)
  await page.locator('[data-practice-continue]').click()

  // The situation is shown; the reasoning is not, until a decision is made.
  await expect(page.locator(`[data-practice-case="${first.id}"]`)).toBeVisible()
  await expect(page.locator('[data-case-situation]')).toBeVisible()
  await expect(page.locator('[data-case-verdict]')).toHaveCount(0)

  await page.locator(`[data-prediction-choices] input[value="${other}"]`).check()
  await page.locator('[data-now-primary]').click()
  await expect(page.locator('[data-case-verdict]')).toBeVisible()

  // Answering again is allowed, and does not rewrite the first decision.
  await page.locator('[data-answer-again]').click()
  await expect(page.locator('[data-case-verdict]')).toHaveCount(0)
  await page.locator(`[data-prediction-choices] input[value="${keyed}"]`).check()
  await page.locator('[data-now-primary]').click()
  await expect(page.locator('[data-answer-verdict]')).toHaveAttribute(
    'data-verdict-outcome',
    'correct',
  )

  const attempt = await page.evaluate(
    ([key, caseId]) => {
      const record = JSON.parse(localStorage.getItem(key) ?? 'null')
      return record?.firstAttempts?.[`practice:${caseId}`] ?? null
    },
    [PERIPHERAL_IMAGING_STORAGE_KEY, first.id] as const,
  )
  expect(attempt?.choiceId).toBe(other)
  expect(attempt?.correct).toBe(false)

  // The list remembers, and the door moves on.
  await page.goto(base() + '/en/peripheral-imaging/practice')
  await expect(page.locator(`[data-practice-case-link="${first.id}"]`)).toHaveAttribute(
    'data-decided',
    'true',
  )
  if (cases.length > 1) {
    await expect(page.locator('[data-practice-continue]')).toHaveAttribute(
      'data-next-case',
      cases[1].id,
    )
  }
})

test('all nineteen sections retain rendered teaching and their real imaging representations', async ({
  page,
}, info) => {
  test.setTimeout(420_000)
  for (const id of peripheralImagingSectionIds) {
    await openSection(page, id)
    await expect(page.locator('[data-teaching-block="boundary"]')).toHaveCount(1)
    await page.locator('[data-suite-viewport]').scrollIntoViewIfNeeded()
    await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-state', 'ready', {
      timeout: 60000,
    })
    const canvas = page.locator('canvas[data-three-state="ready"]')
    await expect(canvas).toHaveCount(1)
    await expectImageSignal(canvas)
    const mode = await page.locator('[data-suite-scene]').getAttribute('data-suite-mode')
    if (
      ['projection', 'signal', 'field', 'time', 'cbct', 'navigation', 'augmented'].includes(mode!)
    ) {
      await expect(page.locator('[data-current-image] canvas')).toHaveCount(1)
      await expectImageSignal(page.locator('[data-current-image] canvas'))
    }
    await noHorizontalOverflow(page)
  }
  await capture(page, info, 'suite-cases-teaching.png')
})

test('acquisition movement invalidates readiness and independent sampling withholds geometric truth', async ({
  page,
}) => {
  await openSection(page, 'cbct-acquisition')
  await primary(page).click()
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
  await primary(page).click()
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

test('required-image failure prevents completion and keeps explanation and retry accessible', async ({
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
  expect(await attempts(page)).toEqual({})
})

test('desktop, tablet, phone, keyboard, and text zoom retain task and control access', async ({
  page,
}, info) => {
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 950 })
    await openSection(page, 'projection')
    await noHorizontalOverflow(page)
    const tabs = page.getByRole('tablist', { name: 'Workspace panel views' })
    if (width < 960) {
      await expect(tabs).toBeVisible()
      await tabs.getByRole('tab', { name: /Simulator/ }).click()
      await expect(page.locator('[data-projection-state]')).toHaveAttribute(
        'data-projection-state',
        'ready',
      )
      await tabs.getByRole('tab', { name: /Steps/ }).click()
      await primary(page).click()
      await expect(tabs.getByRole('tab', { selected: true })).toHaveText(/Simulator/)
      await tabs.getByRole('tab', { selected: true }).press('Home')
      await expect(tabs.getByRole('tab', { selected: true })).toHaveText(/Steps/)
      await tabs.getByRole('tab', { selected: true }).press('End')
      await expect(tabs.getByRole('tab', { selected: true })).toHaveText(/Simulator/)
    }
    await capture(page, info, `projection-${width}.png`)
  }
  for (const width of [900, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await openSection(page, 'projection')
    if (width === 900) await page.getByRole('tab', { name: /Simulator/ }).click()
    await expect(page.locator('[data-projection-state]')).toHaveAttribute(
      'data-projection-state',
      'ready',
    )
    await expect(primary(page)).toBeEnabled({ timeout: 30_000 })
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    await noHorizontalOverflow(page)
    if (width === 900) await page.getByRole('tab', { name: /Steps/ }).click()
    if (width === 1440) {
      expect(
        await page
          .getByRole('region', { name: 'Steps panel', exact: true })
          .evaluate((el) => el.clientHeight),
      ).toBeGreaterThan(350)
    }
    await expect(page.getByRole('button', { name: 'What do I do now?', exact: true })).toBeVisible()
    await primary(page).scrollIntoViewIfNeeded()
    await capture(page, info, `projection-text-200-percent-${width}.png`)
    await primary(page).click()
    await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'projection-2-act')
  }
})
