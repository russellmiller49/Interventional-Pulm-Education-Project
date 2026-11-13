import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * ECMO: the live readings panels for LV loading, return obstruction and oxygenator resistance.
 *
 * Clinical review, 2026-11-13. A live panel is on the page from a drill's first step, so what it
 * has open before the learner answers is held here in the browser: the readings and questions
 * about them, and nothing of the response the drill asks the learner to choose. The LV panel's
 * list of moves (flow, inotrope, volume removal, vent) appears from the step where those moves are
 * made. The arterial strip in the LV panel carries the same two-sentence note as the monitor's.
 */

const SCHEMATIC =
  'Schematic simulated trace: its level and height follow MAP and pulse pressure; the upstroke and notch are illustrative, not measured.'
const FLAT =
  'A nearly flat trace is a low pulse pressure. It does not by itself show whether the ventricle is ejecting: read the aortic-valve opening row.'

const RESISTANCE_DRILLS = [
  { id: 'afterload-return-obstruction', track: 'vv' },
  { id: 'va-afterload-arterial-return-obstruction', track: 'va' },
  { id: 'afterload-oxygenator-resistance', track: 'vv' },
  { id: 'va-afterload-oxygenator-resistance', track: 'va' },
] as const

async function openDrill(page: Page, id: string, track: string) {
  await page.goto(`/en/cardiohelp-ecmo/learn?track=${track}&lesson=${id}`)
  const panel = page.locator(`[data-drill-live-panel="${id}"]`)
  await expect(panel).toBeAttached({ timeout: 90_000 })
  return panel
}

/** The panel's words at this step, without what the step folds to a heading. */
async function openText(panel: Locator) {
  return panel.evaluate((element) => {
    const copy = element.cloneNode(true) as HTMLElement
    for (const folded of copy.querySelectorAll('details:not([open])')) {
      const heading = folded.querySelector(':scope > summary')?.textContent ?? ''
      folded.replaceWith(document.createTextNode(` ${heading} `))
    }
    return copy.textContent ?? ''
  })
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

const LV_RESPONSE =
  /turn(?:ed|ing)?\s+(?:circuit\s+)?(?:flow\s+)?down|lower(?:ed|ing)?\s+(?:circuit\s+)?flow|inotrope|\bvent\b|volume removal|diure/i
const LV_MECHANISM = /ejects against|into the aorta|toward the valve|afterload|retrograde/i

test.describe('LV loading', () => {
  test.use({ viewport: { width: 1440, height: 800 } })

  test('holds its list of moves until the step where they are made', async ({ page }) => {
    const panel = await openDrill(page, 'va-lv-loading', 'va')

    // Recognize: the strip, the readings, and no moves.
    const strip = panel.locator('[data-lv-arterial] [data-arterial-trace]')
    await expect(strip).toBeVisible()
    await expect(strip.locator('[data-trace-schematic-note]')).toHaveText(`${SCHEMATIC} ${FLAT}`)
    await expect(panel.locator('[data-pattern-row]')).toHaveCount(3)
    await expect(panel.locator('[data-lv-moves]')).toHaveCount(0)
    let text = await openText(panel)
    expect(text).not.toMatch(LV_RESPONSE)
    expect(text).not.toMatch(LV_MECHANISM)

    // The strip's caption is the panel's own two numbers.
    const reading = await panel
      .locator('[data-pattern-row="What the ventricle is doing"] [data-pattern-reading]')
      .innerText()
    const pulse = reading.match(/Pulse pressure (\d+) mmHg/)?.[1]
    expect(pulse).toBeTruthy()
    await expect(strip.locator('figcaption strong')).toContainText(`pulse pressure ${pulse}`)

    // Predict: the questions open, and still no moves and no mechanism.
    await page.getByRole('button', { name: 'Inspect the starting pattern' }).click()
    await expect(page.locator('[data-prediction-choices]')).toBeVisible()
    await expect(panel.locator('[data-drill-discriminators]')).toBeVisible()
    await expect(panel.locator('[data-discriminator]')).toHaveCount(3)
    await expect(panel.locator('[data-lv-moves]')).toHaveCount(0)
    text = await openText(panel)
    expect(text).not.toMatch(LV_RESPONSE)
    expect(text).not.toMatch(LV_MECHANISM)

    // Answer, and the step where flow is turned down shows what is in place.
    await page.locator('[data-prediction-choices] input[type="radio"]').first().check()
    await page.getByRole('button', { name: /Commit this prediction/i }).click()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    const moves = panel.locator('[data-lv-moves]')
    await expect(moves).toBeVisible()
    await expect(moves.locator('[data-lv-move="flow"] dd')).toHaveText('not turned down')
    await expect(moves.locator('[data-lv-move="inotrope"] dd')).toHaveText('not started')
    await expect(moves.locator('[data-lv-move="plan"] dd')).toHaveText('no plan recorded')
  })
})

test.describe('return obstruction and oxygenator resistance', () => {
  test.use({ viewport: { width: 1440, height: 800 } })

  for (const drill of RESISTANCE_DRILLS) {
    test(`${drill.id}: readings and questions, and nothing of the answer`, async ({ page }) => {
      const panel = await openDrill(page, drill.id, drill.track)
      await expect(panel.locator('[data-clinical-question]')).toHaveText(
        /where the limitation is\?$/,
      )
      // The readings are the circuit's own: flow, the channel upstream, the two downstream, Δp.
      const flow = panel.locator('[data-pattern-row="Flow against speed"] [data-pattern-reading]')
      await expect(flow).toHaveText(/^Flow \d\.\d\d L\/min at \d+ rpm$/)
      await expect(
        panel.locator('[data-pattern-row="Across the membrane"] [data-pattern-reading]'),
      ).toHaveText(/^Δp \d+ mmHg$/)

      for (const step of ['recognize', 'predict'] as const) {
        if (step === 'predict') {
          await page.getByRole('button', { name: 'Inspect the starting pattern' }).click()
          await expect(page.locator('[data-prediction-choices]')).toBeVisible()
          await expect(panel.locator('[data-drill-discriminators]')).toBeVisible()
          await expect(panel).toContainText(
            'Read it at similar blood flow, against this circuit’s own earlier value.',
          )
        }
        const text = await openText(panel)
        expect(text).not.toMatch(/setting the circuit is short of/i)
        expect(text).not.toMatch(
          /return[- ](?:side|path)|downstream (?:of the (?:oxygenator|membrane)|resistance|obstruction)/i,
        )
        expect(text).not.toMatch(
          /oxygenator (?:resistance|dysfunction|thrombos)|membrane (?:fail|resistance)/i,
        )
        expect(text).not.toMatch(/kink|clamp|clot|exchange|backup|perfusionist/i)
      }
    })
  }
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the LV panel and a resistance panel fit the screen', async ({ page }) => {
    for (const drill of [
      { id: 'va-lv-loading', track: 'va' },
      { id: 'va-afterload-oxygenator-resistance', track: 'va' },
    ]) {
      const panel = await openDrill(page, drill.id, drill.track)
      await panel.scrollIntoViewIfNeeded()
      await expect(panel).toBeVisible()
      const box = await panel.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(390 + 1)
      await expectNoSidewaysScroll(page)
    }
  })
})
