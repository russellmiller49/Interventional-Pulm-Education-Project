import { expect, test, type Page } from '@playwright/test'

/**
 * Mechanical ventilation: what the learner operates and reads, beside the console.
 *
 * The tasks say "under Teaching patient, beside the console" and "under Bedside actions, beside
 * the console". Stacked under the console, those controls and the readings they change were below
 * the fold. In a wide picture pane they are now a rail beside it.
 */

async function openTask(
  page: Page,
  width: number,
  height: number,
  section: string,
  ordinal: number,
) {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.setViewportSize({ width, height })
  await page.goto(`/en/mechanical-ventilation/learn?activity=${section}`)
  await expect(page.locator('[data-now-card]').first()).toBeVisible({ timeout: 90_000 })
  if (ordinal > 1) {
    const list = page.locator('[data-task-map]')
    await list.evaluate((element) => ((element as HTMLDetailsElement).open = true))
    await list
      .locator('[data-step-list] li button')
      .nth(ordinal - 1)
      .click()
    await list.evaluate((element) => ((element as HTMLDetailsElement).open = false))
  }
  await expect(page.locator('[data-console-surface]')).toBeVisible()
}

/** How much of an element is inside the window, as a fraction of its height. */
async function shareInView(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const box = element.getBoundingClientRect()
      const seen = Math.max(0, Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0))
      return box.height ? seen / box.height : 0
    })
}
const paneScroll = (page: Page) =>
  page.locator('[data-flow-visual]').evaluate((pane) => Math.round(pane.scrollTop))
const box = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const r = element.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height }
    })

for (const [width, height] of [
  [1695, 920],
  [1600, 852],
] as const) {
  test(`the teaching patient and the readings are beside the console — ${width}×${height}`, async ({
    page,
  }) => {
    await openTask(page, width, height, 'mechanics-load-and-pressure', 3)
    const consoleBox = await box(page, '[data-ventilation-console]')
    const patient = await box(page, '[data-patient-properties]')
    const readings = await box(page, '[data-live-readings]')
    // Beside the console, not under it.
    expect(patient.left).toBeGreaterThanOrEqual(consoleBox.right)
    expect(readings.left).toBeGreaterThanOrEqual(consoleBox.right)
    expect(patient.top).toBeLessThan(consoleBox.bottom)
    // On screen, with the traces and the console's own tabs.
    expect(await shareInView(page, '[data-patient-properties]')).toBe(1)
    expect(await shareInView(page, '[data-live-readings]')).toBe(1)
    expect(await shareInView(page, '[data-ventilation-console] nav')).toBe(1)
    // The clock bar keeps the pane's width and one line.
    const clock = await box(page, '[data-clock-bar]')
    expect(clock.right).toBeGreaterThan(patient.left)
    expect(clock.height).toBeLessThan(70)

    // Moving the patient's resistance does not move the screen.
    const slider = page.locator('[data-patient-properties] input[type="range"]').first()
    await slider.focus()
    for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight')
    await expect(page.locator('[data-patient-properties] output').first()).toHaveText('2.00×')
    expect(await paneScroll(page)).toBe(0)
    expect(await shareInView(page, '[data-live-readings]')).toBe(1)
  })

  test(`the bedside actions are beside the console — ${width}×${height}`, async ({ page }) => {
    await openTask(page, width, height, 'waveform-reading-sequence', 3)
    const consoleBox = await box(page, '[data-ventilation-console]')
    const actions = await box(page, '[data-bedside-actions]')
    expect(actions.left).toBeGreaterThanOrEqual(consoleBox.right)
    expect(await shareInView(page, '[data-bedside-actions]')).toBe(1)
    expect(await shareInView(page, '[data-live-readings]')).toBe(1)
    // The wide bedside panel keeps the console's width, under it.
    const panel = await box(page, '[data-console-under]')
    expect(panel.top).toBeGreaterThanOrEqual(consoleBox.bottom - 1)
    expect(panel.right).toBeLessThanOrEqual(actions.left)

    await page.getByRole('button', { name: 'Inspect the circuit', exact: true }).click()
    await expect(page.locator('[data-bedside-actions]')).toContainText(/Selected|In effect/)
    expect(await paneScroll(page)).toBe(0)
  })
}

test('a narrower pane keeps everything under the console, what is operated first — 1440×800', async ({
  page,
}) => {
  await openTask(page, 1440, 800, 'mechanics-load-and-pressure', 3)
  const consoleBox = await box(page, '[data-ventilation-console]')
  const patient = await box(page, '[data-patient-properties]')
  const readings = await box(page, '[data-live-readings]')
  expect(patient.top).toBeGreaterThanOrEqual(consoleBox.bottom - 1)
  expect(readings.top).toBeGreaterThanOrEqual(patient.bottom - 1)
  expect(await shareInView(page, '[data-ventilation-console] nav')).toBe(1)
})

test('on a phone nothing is pushed sideways', async ({ page }) => {
  await openTask(page, 390, 844, 'mechanics-load-and-pressure', 3)
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(sideways).toBeLessThanOrEqual(1)
  const consoleBox = await box(page, '[data-ventilation-console]')
  const patient = await box(page, '[data-patient-properties]')
  expect(patient.top).toBeGreaterThanOrEqual(consoleBox.bottom - 1)
})
