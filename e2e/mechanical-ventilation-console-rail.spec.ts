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
    // The reading values are on screen. With the drawing of the lungs between the sliders and
    // the readings, the tail of the notes under the values is below the fold on this task.
    expect(await shareInView(page, '[data-live-readings] dl')).toBeGreaterThan(0.9)
    expect(await shareInView(page, '[data-live-readings]')).toBeGreaterThan(0.75)
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
    expect(await shareInView(page, '[data-live-readings] dl')).toBeGreaterThan(0.9)
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

test('the lungs are drawn beside the console and follow its cursor — 1600×852', async ({
  page,
}) => {
  await openTask(page, 1600, 852, 'mechanics-load-and-pressure', 3)
  const figure = page.locator('[data-lung-figure]')
  await expect(figure).toBeVisible()
  const consoleBox = await box(page, '[data-ventilation-console]')
  const figureBox = await box(page, '[data-lung-figure]')
  expect(figureBox.left).toBeGreaterThanOrEqual(consoleBox.right)
  expect(await shareInView(page, '[data-lung-figure]')).toBe(1)
  // The patient's sliders lead it; the reading values after it are still on screen.
  const patient = await box(page, '[data-patient-properties]')
  expect(figureBox.top).toBeGreaterThanOrEqual(patient.bottom - 1)
  expect(await shareInView(page, '[data-live-readings] dl')).toBeGreaterThan(0.9)

  // It says what the read-out under the traces says, and changes with the cursor.
  const readOut = page.locator('[data-ventilation-console] [data-captured-breath] p', {
    hasText: 'Cursor at',
  })
  const volume = async () => (await readOut.textContent())!.match(/to (-?\d+) mL/)![1]
  await expect(figure).toHaveAttribute('data-flow', 'in')
  await expect(figure.locator('li').nth(1)).toHaveText(new RegExp(`^${await volume()} mL · `))
  const cursor = page.locator(
    '[data-ventilation-console] [data-captured-breath] input[type="range"]',
  )
  await cursor.fill(await cursor.evaluate((input) => (input as HTMLInputElement).max))
  await expect(figure).toHaveAttribute('data-flow', 'out')
  await expect(figure.locator('li').nth(1)).toHaveText(new RegExp(`^${await volume()} mL · `))

  // The learner's own change to the patient is drawn.
  const slider = page.locator('[data-patient-properties] input[type="range"]').first()
  await slider.focus()
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight')
  await expect(figure.locator('li', { hasText: 'Patient resistance' })).toHaveText(
    'Patient resistance 2.00×',
  )
  expect(Number(await figure.getAttribute('data-airway'))).toBeLessThan(1)
})

test('while the clock runs the lungs are drawn from the newest sample', async ({ page }) => {
  await openTask(page, 1600, 852, 'mechanics-load-and-pressure', 3)
  const figure = page.locator('[data-lung-figure]')
  await expect(figure.locator('strong')).toHaveText('Lungs at the cursor')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(figure.locator('strong')).toHaveText('Lungs now')
  // Both directions of flow are seen within a few breaths.
  const seen = new Set<string>()
  for (let i = 0; i < 80 && seen.size < 2; i++) {
    seen.add((await figure.getAttribute('data-flow'))!)
    await page.waitForTimeout(100)
  }
  expect([...seen].sort()).toEqual(expect.arrayContaining(['in', 'out']))
})

test('trapped gas is drawn in the air-trapping section, from the intrinsic PEEP reading beside it', async ({
  page,
}) => {
  // The opening reading has no readings beside it: nothing is drawn.
  await openTask(page, 1600, 852, 'expiration-and-air-trapping', 1)
  await expect(page.locator('[data-lung-figure]')).toBeVisible()
  await expect(page.locator('[data-lung-figure] [data-trapped-gas]')).toHaveCount(0)

  // Part 1 watches intrinsic PEEP with the rate, and the drawing follows the reading as the
  // learner raises the rate and the patient runs.
  await openTask(page, 1600, 852, 'expiration-and-air-trapping', 3)
  const partOne = page.locator('[data-lung-figure]')
  const partOneTile = page.locator('[data-live-readings] [data-metric="intrinsicPeep"] dd')
  const reading = async () => (await partOneTile.textContent())!.match(/^(-?\d+\.\d) cmH₂O/)![1]
  await expect(partOne.locator('li', { hasText: 'Intrinsic PEEP' })).toHaveText(
    `Intrinsic PEEP ${await reading()} cmH₂O · model estimate`,
  )

  // Part 2 shows the reading, and the drawing shades the lungs' base from it.
  await openTask(page, 1600, 852, 'expiration-and-air-trapping', 6)
  const figure = page.locator('[data-lung-figure]')
  await expect(figure.locator('[data-trapped-gas]')).toBeVisible()
  const tile = page.locator('[data-live-readings] [data-metric="intrinsicPeep"] dd')
  const shown = (await tile.textContent())!.match(/^(-?\d+\.\d) cmH₂O/)![1]
  await expect(figure.locator('li', { hasText: 'Intrinsic PEEP' })).toHaveText(
    `Intrinsic PEEP ${shown} cmH₂O · model estimate`,
  )
  expect(await shareInView(page, '[data-lung-figure]')).toBe(1)
  expect(await shareInView(page, '[data-live-readings] dl')).toBe(1)
})

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
