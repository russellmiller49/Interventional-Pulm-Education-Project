import { expect, test, type Page } from '@playwright/test'

/**
 * ECMO: the arterial line on the VA bedside monitor says what it is.
 *
 * Clinical review, 2026-11-13. The strip is synthesized from four numbers of the patient model
 * (mean arterial pressure, pulse pressure, heart rate, aortic-valve-opening state). Its upstroke
 * and notch are one drawn shape and say nothing about the patient. The strip is therefore labelled
 * schematic, says its upstroke and notch are illustrative, and says a nearly flat trace is a low
 * pulse pressure and not, by itself, a statement about ejection.
 */

const SCHEMATIC =
  'Schematic simulated trace: its level and height follow MAP and pulse pressure; the upstroke and notch are illustrative, not measured.'
const FLAT =
  'A nearly flat trace is a low pulse pressure. It does not by itself show whether the ventricle is ejecting: read the aortic-valve opening row.'

/** Starts the case if there is one to start, and opens the monitor wherever the page folds it. */
async function openMonitor(page: Page) {
  for (const name of ['Begin case', 'Start guided activity']) {
    const start = page.getByRole('button', { name })
    if (await start.count()) await start.first().click()
  }
  const monitor = page.locator('#cardiohelp-patient-monitor')
  await expect(monitor).toBeAttached({ timeout: 90_000 })
  const surface = page.locator('section[data-surface]:has(#cardiohelp-patient-monitor)').first()
  if ((await surface.count()) && (await surface.getAttribute('data-open')) !== 'true')
    await surface.locator('button[aria-expanded]').first().click()
  return monitor
}

/** The monitor with its strip in view. */
async function showMonitor(page: Page) {
  const monitor = await openMonitor(page)
  const strip = monitor.locator('[data-arterial-trace]')
  await expect(strip).toBeVisible()
  await strip.scrollIntoViewIfNeeded()
  return { monitor, strip }
}

/** What the strip says, against the monitor's own rows, and where it sits. */
async function expectSchematicStrip(page: Page) {
  const { monitor, strip } = await showMonitor(page)
  await expect(strip.locator('figcaption span')).toHaveText('Arterial line · schematic')
  const note = strip.locator('[data-trace-schematic-note]')
  await expect(note).toBeVisible()
  await expect(note).toHaveText(`${SCHEMATIC} ${FLAT}`)

  // The caption repeats the monitor's own two numbers; the strip adds none.
  const rows = await monitor.evaluate((element) => {
    const value = (label: string) =>
      [...element.querySelectorAll('span')]
        .find((span) => span.textContent?.trim() === label)
        ?.parentElement?.querySelector('strong')
        ?.textContent?.trim()
    return { map: value('MAP'), pulse: value('Pulse pressure') }
  })
  expect(rows.map).toMatch(/^\d+ mmHg$/)
  expect(rows.pulse).toMatch(/^\d+ mmHg$/)
  await expect(strip.locator('figcaption strong')).toHaveText(
    `MAP ${rows.map} · pulse pressure ${rows.pulse}`,
  )
  // No systolic or diastolic value is printed from the drawing.
  await expect(strip).not.toContainText(/systolic|diastolic|\d+\s*\/\s*\d+/i)

  // The note is inside the strip, the strip is above the readings, and neither covers the other.
  const layout = await monitor.evaluate((element) => {
    const figure = element.querySelector('[data-arterial-trace]')!.getBoundingClientRect()
    const text = element.querySelector('[data-trace-schematic-note]')!.getBoundingClientRect()
    const readings = element
      .querySelector('[data-patient-signal="map"]')!
      .parentElement!.getBoundingClientRect()
    return {
      noteInside:
        text.left >= figure.left &&
        text.right <= figure.right + 1 &&
        text.bottom <= figure.bottom + 1,
      aboveReadings: figure.bottom <= readings.top + 1,
      noteHeight: text.height,
    }
  })
  expect(layout.noteInside).toBe(true)
  expect(layout.aboveReadings).toBe(true)
  expect(layout.noteHeight).toBeGreaterThan(10)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1)
  return { strip }
}

for (const [width, height] of [
  [1440, 800],
  [1280, 720],
  [390, 844],
] as const) {
  test(`VA lesson: the strip is labelled schematic and says what a flat trace is not — ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/en/cardiohelp-ecmo/learn?track=va&lesson=va-lv-loading')
    const { strip } = await expectSchematicStrip(page)
    // This lesson opens on a low pulse pressure: the strip is nearly flat, and says so in words
    // for a reader who cannot see it, without giving the notch a cause.
    await expect(strip).toHaveAttribute('data-low-pulsatility', 'true')
    const spoken = await strip.getByRole('img').getAttribute('aria-labelledby')
    const words = await page.locator(`[id="${spoken}"]`).textContent()
    expect(words).toMatch(/^Schematic simulated arterial pressure trace over 4 seconds\./)
    expect(words).toContain('The trace is nearly flat: low pulsatility.')
    expect(words).toMatch(/The upstroke and notch are illustrative, not measured\.$/)
    expect(words).not.toMatch(/because|not observed/)
  })
}

test('VA Practice and Assess show the same strip, with the same words', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 })
  await page.goto('/en/cardiohelp-ecmo/practice?track=va')
  await expectSchematicStrip(page)
  await page.goto('/en/cardiohelp-ecmo/assess?track=va')
  await expectSchematicStrip(page)
})

test('VV support has no arterial strip', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 })
  await page.goto('/en/cardiohelp-ecmo/practice?track=vv')
  const monitor = await openMonitor(page)
  await expect(monitor).toBeVisible()
  // The VV monitor reports no pulse pressure, and no strip is drawn from the model's fixed value.
  await expect(monitor).not.toContainText('Pulse pressure')
  await expect(page.locator('[data-arterial-trace]')).toHaveCount(0)
})
