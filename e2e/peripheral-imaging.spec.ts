import { test, expect, type Page, type TestInfo, type Locator } from '@playwright/test'

import { imagingCases } from '../src/features/peripheral-imaging/content/cases'
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

test.beforeEach(async ({ context, page }) => {
  if (!['localhost', '127.0.0.1'].includes(new URL(base()).hostname))
    throw new Error('Imaging checks require localhost.')
  const token = process.env.LOCAL_DEV_AUTH_TOKEN
  if (!token)
    throw new Error(
      'Load the repository local development auth environment before running the imaging checks.',
    )
  // Values remain in memory; do not print the auth URL or persist a browser trace.
  const auth = await context.request
    .get(base() + '/api/local-dev-auth', {
      params: { token, next: '/en/fluoroview' },
      maxRedirects: 0,
    })
    .catch(() => {
      throw new Error('Local development auth request failed.')
    })
  expect(auth.status()).toBe(307)
  await page.goto(base() + '/en/fluoroview')
  await expect(page.locator('[data-imaging-continue]')).toHaveAttribute(
    'data-imaging-continue',
    'resolved',
  )
})

const stageId = (page: Page) => page.locator('[data-stage]').getAttribute('data-stage')
const primary = (page: Page) => page.locator('[data-now-card] [data-now-primary]')
const status = (page: Page) => page.locator('[data-now-status]')

async function openSection(page: Page, sectionId: string) {
  await page.goto(`${base()}/en/fluoroview/learn?section=${sectionId}`)
  await expect(page.locator('[data-stage]')).toHaveAttribute(
    'data-stage',
    `${sectionId}-1-recognize`,
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

test('the one door opens the first section, and a sorted section runs to its record', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const first = peripheralImagingSectionIds[0]
  await expect(page.locator('[data-imaging-continue]')).toHaveCount(1)
  await expect(page.locator('[data-imaging-continue]')).toHaveAttribute('data-next-section', first)
  await capture(page, testInfo, 'hub-desktop.png')
  await page.locator('[data-imaging-continue]').click()
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', `${first}-1-recognize`)
  await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-lit', /./)
  await noHorizontalOverflow(page)

  // Recognize → Predict: no verdict, sources withheld, the primary waits for a choice.
  await primary(page).click()
  expect(await stageId(page)).toBe(`${first}-2-predict`)
  await expect(page.locator('[data-verdict-outcome]')).toHaveCount(0)
  await expect(page.locator('[data-stage-sources]')).toHaveAttribute(
    'data-stage-sources-claims',
    'false',
  )
  await expect(primary(page)).toBeDisabled()
  await commitKeyed(page, first, 1)
  await expect(page.locator('[data-stage-sources]')).toHaveAttribute(
    'data-stage-sources-claims',
    'true',
  )
  await capture(page, testInfo, 'predict-verdict.png')
  await primary(page).click()

  // Act: the sort, committed as a set, graded in words.
  expect(await stageId(page)).toBe(`${first}-3-act`)
  await expect(primary(page)).toBeDisabled()
  const lesson = imagingStageLesson(first as never)
  const sortStep = lesson.steps[2]
  if (sortStep.interaction.kind !== 'sort') throw new Error('expected a sort')
  for (const row of sortStep.interaction.sort.rows) {
    await page.locator(`[data-sort-row="${row.id}"] select`).selectOption(row.origin)
  }
  await primary(page).click()
  await expect(page.locator('[data-sort-verdict="held"]')).toHaveCount(
    sortStep.interaction.sort.rows.length,
  )
  await primary(page).click()

  // Explain → Transfer → the record.
  expect(await stageId(page)).toBe(`${first}-4-explain`)
  await expect(page.locator('[data-explain-recap] [data-answer-verdict]')).toBeVisible()
  await primary(page).click()
  expect(await stageId(page)).toBe(`${first}-5-transfer`)
  await commitKeyed(page, first, 4)
  await expect(primary(page)).toHaveText(/Finish the section/)
  await primary(page).click()
  await expect(page.locator('[data-section-completion]')).toBeVisible()
  await expect(page.locator('[data-section-completion] [data-next-section]')).toHaveAttribute(
    'data-next-section',
    peripheralImagingSectionIds[1],
  )
  const record = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
    PERIPHERAL_IMAGING_STORAGE_KEY,
  )
  expect(record.version).toBe(2)
  expect(record.completedSectionIds).toEqual([first])

  // Back on the hub the chip is worked through and the door moved on.
  await page.goto(base() + '/en/fluoroview')
  await expect(page.locator('[data-imaging-continue]')).toHaveAttribute(
    'data-next-section',
    peripheralImagingSectionIds[1],
  )
  await expect(page.locator(`[data-pathway-accordion] a[data-complete="true"]`)).toHaveCount(1)
  expect(errors).toEqual([])
})

test('a lab section: the suite is locked until the commitment, a goal flips, and a reload restarts the section', async ({
  page,
}, testInfo) => {
  await openSection(page, 'projection')
  await expect(page.locator('[data-suite-controls]')).toBeDisabled()
  await primary(page).click()
  expect(await stageId(page)).toBe('projection-2-predict')
  await expect(page.locator('[data-suite-controls]')).toBeDisabled()
  await commitKeyed(page, 'projection', 1)
  await expect(page.locator('[data-suite-controls]')).toBeEnabled()
  await primary(page).click()
  expect(await stageId(page)).toBe('projection-3-act')

  // The DRR behind the controls carries an image (the fallback lab until the suite lands).
  const monitor = page.locator('[data-projection-state=ready] canvas')
  if ((await monitor.count()) > 0) await expectImageSignal(monitor.first())

  // The goal flips on the suite, and nothing continues before it does.
  const goals = page.locator('[data-step-goals] li')
  await expect(goals.first()).toHaveAttribute('data-met', 'false')
  await expect(primary(page)).toHaveCount(0)
  await setRange(page, /obliquity/i, 60)
  await expect(goals.first()).toHaveAttribute('data-met', 'true')
  await expect(status(page)).toHaveText(/^Done/)
  await capture(page, testInfo, 'act-goal-met.png')

  // A reload restarts the section at its first step while the record keeps the first attempt.
  await page.reload()
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'projection-1-recognize')
  await expect(page.locator('[data-verdict-outcome]')).toHaveCount(0)
  const record = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
    PERIPHERAL_IMAGING_STORAGE_KEY,
  )
  expect(
    Object.keys(record.firstAttempts).filter((key) => key.startsWith('projection:')),
  ).toHaveLength(1)
  expect(record.completedSectionIds).toEqual([])
})

test('the capstone: gated on the sections, decided once, one wrong critical decision fails the standard', async ({
  page,
}) => {
  await page.goto(base() + '/en/fluoroview/assess')
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
  await page.goto(base() + '/en/fluoroview/assess')
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

test('compact layout: one pane at a time, following the step', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base() + '/en/fluoroview')
  await noHorizontalOverflow(page)
  await capture(page, testInfo, 'hub-mobile.png')
  await openSection(page, 'projection')
  const tabs = page.getByRole('tablist', { name: 'Workspace panel views' })
  await expect(tabs).toBeVisible()
  await noHorizontalOverflow(page)
  // Recognize reads in the Teaching pane; Predict answers in the Steps pane.
  await expect(tabs.getByRole('tab', { selected: true })).toHaveText(/Teaching/i)
  await tabs.getByRole('tab', { name: /Steps/i }).click()
  await primary(page).click()
  expect(await stageId(page)).toBe('projection-2-predict')
  await expect(tabs.getByRole('tab', { selected: true })).toHaveText(/Steps/i)
  await capture(page, testInfo, 'predict-mobile.png')
  await noHorizontalOverflow(page)
})
