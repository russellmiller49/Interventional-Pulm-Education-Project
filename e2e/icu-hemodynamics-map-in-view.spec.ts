import { expect, test, type Page } from '@playwright/test'

/**
 * "Where is the tip?": tracing, control and map on one screen.
 *
 * On the two hands-on tasks the learner presses a control, waits for the tracing to settle, and
 * confirms the place on the catheter map. The map used to close the monitor's column, below the
 * fold: every stop meant scrolling down to answer and back up to the control. It now leads the
 * column beside the monitor.
 */

async function openTask(page: Page, width: number, height: number, ordinal: number) {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/en/icu-hemodynamics/learn?activity=catheter-advancement')
  await expect(page.locator('[data-lesson-shell]')).toBeVisible({ timeout: 90_000 })
  await page.setViewportSize({ width, height })
  const list = page.locator('[data-step-list]')
  await list.evaluate((element) => {
    const details = element.closest('details')
    if (details) details.open = true
  })
  await list
    .locator('button')
    .nth(ordinal - 1)
    .click()
  await page.waitForFunction(
    (n) =>
      document.querySelector('[data-lesson-shell]')?.getAttribute('data-stage')?.includes(`-${n}-`),
    ordinal,
  )
  await list.evaluate((element) => {
    const details = element.closest('details')
    if (details) details.open = false
  })
  await expect(page.locator('[data-answer-map-column] [data-catheter-map-answer]')).toBeVisible()
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

const TRACING = '[data-monitor-column] [data-waveform-strip]:not([data-waveform-strip="ecg"])'
const MAP = '[data-answer-map-column] [data-catheter-map]'

for (const [width, height] of [
  [1695, 920],
  [1600, 852],
  [1280, 720],
] as const) {
  test(`Advance by the tracing opens with its tracing, its control and its map on screen — ${width}×${height}`, async ({
    page,
  }) => {
    await openTask(page, width, height, 3)
    expect(await shareInView(page, TRACING)).toBe(1)
    expect(await shareInView(page, MAP)).toBe(1)
    await expect(page.getByRole('button', { name: 'Advance', exact: true })).toBeInViewport({
      ratio: 1,
    })
  })
}

/*
 * One stop without scrolling: advance, let the tracing settle, confirm the place. With the tip in
 * the right ventricle the balloon-up notice takes about 220 px from the top of the window, so this
 * holds at these two sizes and not at 1280 × 720, where the answers are then below the fold.
 */
for (const [width, height] of [
  [1695, 920],
  [1600, 852],
] as const) {
  test(`a stop is advanced, read and confirmed without scrolling — ${width}×${height}`, async ({
    page,
  }) => {
    await openTask(page, width, height, 3)
    const paneScroll = () =>
      page.locator('[data-flow-visual]').evaluate((pane) => Math.round(pane.scrollTop))
    expect(await paneScroll()).toBe(0)
    await page.getByRole('button', { name: 'Advance', exact: true }).click()
    await expect(page.locator('[data-catheter-hold]')).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(6000)
    expect(await paneScroll()).toBe(0)
    expect(await shareInView(page, TRACING)).toBe(1)
    // The radio itself is visually hidden; its row is what the learner sees and presses.
    const ventricle = page
      .locator(`${MAP} [data-catheter-map-answer] label`)
      .filter({ hasText: /right ventricle/i })
    await expect(ventricle).toBeInViewport({ ratio: 1 })
    await ventricle.click()
    await expect(page.locator(MAP)).toContainText('Confirmed: the right ventricle.')
    // The map grows by the line that says so; nothing else moves.
    expect(await paneScroll()).toBeLessThanOrEqual(40)
    expect(await shareInView(page, TRACING)).toBe(1)
  })
}

test('Repair, then move has its map on screen too — 1600×852', async ({ page }) => {
  await openTask(page, 1600, 852, 7)
  expect(await shareInView(page, MAP)).toBe(1)
  expect(await shareInView(page, TRACING)).toBe(1)
})

test('on a phone the map follows the controls and comes before the heart', async ({ page }) => {
  await openTask(page, 390, 844, 3)
  const order = await page.evaluate(() => {
    const top = (selector: string) =>
      document.querySelector(selector)!.getBoundingClientRect().top + window.scrollY
    return {
      controls: top('[data-monitor-column] [data-dock]'),
      map: top('[data-answer-map-column] [data-catheter-map]'),
      heart: top('[data-answer-map-column] [data-surface="heart-3d"]'),
    }
  })
  expect(order.controls).toBeLessThan(order.map)
  expect(order.map).toBeLessThan(order.heart)
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(sideways).toBeLessThanOrEqual(1)
})
