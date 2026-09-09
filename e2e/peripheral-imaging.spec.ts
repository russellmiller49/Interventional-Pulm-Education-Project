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

const stageId = (page: Page) => page.locator('[data-stage]').getAttribute('data-stage')
const primary = (page: Page) => page.locator('[data-now-card] [data-now-primary]')
const status = (page: Page) => page.locator('[data-now-status]')

async function openSection(page: Page, sectionId: string) {
  await page.goto(`${base()}/en/peripheral-imaging/learn?section=${sectionId}`)
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

/**
 * Whether the suite's controls are locked. Playwright treats a `<fieldset disabled>` as enabled
 * — the disabled state it reports belongs to form controls — so ask a control inside the dock,
 * which is the thing the learner cannot actually move.
 */
function firstSuiteControl(page: Page) {
  return page.locator('[data-suite-controls] input, [data-suite-controls] select').first()
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
  await page.goto(base() + '/en/peripheral-imaging')
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
  await expect(firstSuiteControl(page)).toBeDisabled()
  await primary(page).click()
  expect(await stageId(page)).toBe('projection-2-predict')
  await expect(firstSuiteControl(page)).toBeDisabled()
  await commitKeyed(page, 'projection', 1)
  await expect(firstSuiteControl(page)).toBeEnabled()
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

test('the image a control changes stays on screen while the control is used', async ({ page }) => {
  // The pane scrolls as one column, with the 3D view and the monitor above the control dock.
  // Reaching a slider used to push the image it changes off the top, so the learner could not
  // watch what their own change did. The displays are pinned to the top of the pane instead.
  // Comfortably inside the side-by-side layout rather than on its boundary.
  await page.setViewportSize({ width: 1700, height: 1000 })
  await openSection(page, 'projection')
  await primary(page).click()
  await commitKeyed(page, 'projection', 1)
  await primary(page).click()
  expect(await stageId(page)).toBe('projection-3-act')

  const geometry = await page.evaluate(() => {
    const pane = [...document.querySelectorAll('[role="region"][aria-label$="panel"]')].find((p) =>
      /Simulator/.test(p.getAttribute('aria-label') ?? ''),
    ) as HTMLElement
    const displays = document.querySelector('[data-suite-scene] [class*="displays"]') as HTMLElement
    return {
      pinned: getComputedStyle(displays).position,
      displaysHeight: Math.round(displays.getBoundingClientRect().height),
      paneHeight: Math.round(pane.getBoundingClientRect().height),
    }
  })
  // Pinning only makes sense while the pinned block is shorter than the pane it sits in.
  expect(geometry.pinned).toBe('sticky')
  expect(geometry.displaysHeight).toBeLessThan(geometry.paneHeight)

  // Scroll the pane far enough to bring every control into reach, then check that the image is
  // still on screen and that the control is clear of it rather than hidden underneath.
  const state = await page.evaluate(() => {
    const pane = [...document.querySelectorAll('[role="region"][aria-label$="panel"]')].find((p) =>
      /Simulator/.test(p.getAttribute('aria-label') ?? ''),
    ) as HTMLElement
    pane.scrollTop = 120
    const top = pane.getBoundingClientRect().top
    const box = (el: Element) => {
      const b = el.getBoundingClientRect()
      return { top: Math.round(b.top - top), bottom: Math.round(b.bottom - top) }
    }
    const displays = box(document.querySelector('[data-suite-scene] [class*="displays"]')!)
    const monitor = box(document.querySelector('[data-suite-scene] [class*="monitorPanel"]')!)
    const slider = box(document.getElementById('peripheral-imaging-control-orbit')!)
    return {
      displays,
      monitor,
      slider,
      paneHeight: Math.round(pane.getBoundingClientRect().height),
    }
  })
  expect(state.displays.top).toBe(0)
  expect(state.monitor.bottom).toBeGreaterThan(0)
  expect(state.slider.top).toBeGreaterThanOrEqual(state.displays.bottom)
  expect(state.slider.bottom).toBeLessThanOrEqual(state.paneHeight)

  // And moving it still changes the readout, with the image in view the whole time.
  const before = await page.locator('[data-readout="separationMm"] dd').textContent()
  await setRange(page, /obliquity/i, 60)
  await expect(page.locator('[data-readout="separationMm"] dd')).not.toHaveText(before ?? '')

  // A control you cannot read is not usable. The dock is a light surface inside a dark shell,
  // and inheriting the shell's near-white ink once left these at about 1.07:1.
  const contrast = await page.evaluate(() => {
    const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
    const luminance = (c: string) => {
      const [r, g, b] = (c.match(/\d+(\.\d+)?/g) ?? [])
        .slice(0, 3)
        .map((n) => channel(Number(n) / 255))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const backgroundOf = (el: Element | null) => {
      let node = el
      while (node) {
        const colour = getComputedStyle(node).backgroundColor
        if (colour && colour !== 'rgba(0, 0, 0, 0)') return colour
        node = node.parentElement
      }
      return 'rgb(255, 255, 255)'
    }
    const measure = (selector: string) => {
      const el = document.querySelector(selector)
      if (!el) return null
      const a = luminance(getComputedStyle(el).color)
      const b = luminance(backgroundOf(el))
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }
    return {
      label: measure('[data-suite-controls] [class*="controlLabel"] label'),
      value: measure('[data-suite-controls] output'),
      readout: measure('[data-readouts] dd'),
    }
  })
  for (const [name, value] of Object.entries(contrast)) {
    expect(value, `${name} contrast`).not.toBeNull()
    expect(value!, `${name} contrast`).toBeGreaterThanOrEqual(4.5)
  }
})

test('every overview view frames the whole chain, whatever shape the pane is', async ({ page }) => {
  // The views that show the whole chain have to fit every stop and its label at the pane's actual
  // aspect ratio. Only the suite view used to do that, so the fixed views clipped a pin as soon
  // as the pane was narrow — at 1280x800 the display stop sat one pixel from the edge.
  for (const [width, height] of [
    [1280, 800],
    [1600, 900],
  ] as const) {
    await page.setViewportSize({ width, height })
    await openSection(page, 'projection')
    await primary(page).click()
    await commitKeyed(page, 'projection', 1)
    await primary(page).click()
    for (const preset of ['Suite', 'Anterior', 'Side', 'Head']) {
      await page.getByRole('button', { name: preset, exact: true }).click()
      await page.waitForTimeout(900)
      const worst = await page.evaluate(() => {
        const host = document
          .querySelector('[data-suite-scene] [class*="viewport"]')!
          .getBoundingClientRect()
        let over = 0
        for (const pin of document.querySelectorAll('[data-suite-scene] [class*="pin"]')) {
          const b = pin.getBoundingClientRect()
          if (b.width === 0) continue
          over = Math.max(
            over,
            host.left - b.left,
            b.right - host.right,
            host.top - b.top,
            b.bottom - host.bottom,
          )
        }
        return Math.round(over)
      })
      expect(worst, `${preset} at ${width}x${height} clips a chain stop`).toBeLessThanOrEqual(0)
    }
  }
})

test('compact layout: one pane at a time, following the step', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base() + '/en/peripheral-imaging')
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
