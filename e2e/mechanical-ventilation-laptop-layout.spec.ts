import { expect, test, type Page } from '@playwright/test'

/**
 * Mechanical ventilation at a laptop's width.
 *
 * At 1440 × 800 the picture pane was 814 px: too narrow for the rail, so the readings, the lung
 * drawing and the teaching patient's sliders were under the console on every task, and a wrapped
 * cue in the clock bar pushed the console's tab row below the window. From a 1440 px window the
 * pane now gets the width the console and the rail need, and the text column takes the rest.
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
      .locator('[data-step-list] li:not([data-case-row]) button')
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
      const seen = Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0)
      return box.height > 0 ? Math.max(0, seen) / box.height : 0
    })
}

const box = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const r = element.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height }
    })

for (const [width, height] of [
  [1440, 800],
  [1440, 900],
  [1536, 864],
] as const) {
  test(`the rail is beside the console and the tab row is whole — ${width}×${height}`, async ({
    page,
  }) => {
    await openTask(page, width, height, 'mechanics-load-and-pressure', 3)
    const consoleBox = await box(page, '[data-ventilation-console]')
    const patient = await box(page, '[data-patient-properties]')
    const readings = await box(page, '[data-live-readings]')
    expect(patient.left).toBeGreaterThanOrEqual(consoleBox.right)
    expect(readings.left).toBeGreaterThanOrEqual(consoleBox.right)
    // What the task says to move, the values it changes and the console's own tabs, on screen.
    expect(await shareInView(page, '[data-patient-properties]')).toBe(1)
    expect(await shareInView(page, '[data-live-readings] dl')).toBeGreaterThan(0.9)
    expect(await shareInView(page, '[data-ventilation-console] nav')).toBe(1)
    // The clock bar keeps the pane's width, so the cue beside the clock does not push the
    // console down: this task's cue wrapped to four lines in the narrow bar.
    const clock = await box(page, '[data-clock-bar]')
    expect(clock.right).toBeGreaterThan(patient.left)
    expect(clock.height).toBeLessThan(70)
    // The text column is narrower, never cut off.
    const text = await page.locator('[data-flow-teaching]').evaluate((pane) => ({
      width: pane.clientWidth,
      sideways: pane.scrollWidth - pane.clientWidth,
    }))
    expect(text.width).toBeGreaterThanOrEqual(350)
    expect(text.sideways).toBeLessThanOrEqual(1)
  })

  test(`the bedside actions are beside the console — ${width}×${height}`, async ({ page }) => {
    await openTask(page, width, height, 'waveform-reading-sequence', 3)
    const consoleBox = await box(page, '[data-ventilation-console]')
    const actions = await box(page, '[data-bedside-actions]')
    expect(actions.left).toBeGreaterThanOrEqual(consoleBox.right)
    expect(await shareInView(page, '[data-bedside-actions]')).toBe(1)
    expect(await shareInView(page, '[data-ventilation-console] nav')).toBe(1)
  })
}

/*
 * A smaller laptop. Until this, a 1366 × 768 or 1280 × 720 window had the rail under the console
 * on every task, and with four traces on the console its tab row ended below the fold (on 51 and
 * 63 of the 94 console tasks). The rail is now beside the console from a 1280 px window, and the
 * tab row is pinned to the bottom of the console's pane while the console runs past it.
 */
for (const [width, height] of [
  [1366, 768],
  [1280, 720],
] as const) {
  test(`a smaller laptop has the rail beside the console — ${width}×${height}`, async ({
    page,
  }) => {
    await openTask(page, width, height, 'mechanics-load-and-pressure', 3)
    const consoleBox = await box(page, '[data-ventilation-console]')
    const patient = await box(page, '[data-patient-properties]')
    const readings = await box(page, '[data-live-readings]')
    expect(patient.left).toBeGreaterThanOrEqual(consoleBox.right)
    expect(readings.left).toBeGreaterThanOrEqual(consoleBox.right)
    expect(await shareInView(page, '[data-patient-properties]')).toBe(1)
    expect(await shareInView(page, '[data-lung-figure]')).toBe(1)
    // The console keeps its own size: nothing on it is scaled down to fit.
    expect(consoleBox.right - consoleBox.left).toBeGreaterThanOrEqual(500)
    const scale = await page
      .locator('[data-ventilation-console] > div > div')
      .first()
      .evaluate((element) => getComputedStyle(element).transform)
    expect(scale).toBe('none')
    const text = await page.locator('[data-flow-teaching]').evaluate((pane) => ({
      width: pane.clientWidth,
      sideways: pane.scrollWidth - pane.clientWidth,
    }))
    expect(text.width).toBeGreaterThanOrEqual(350)
    expect(text.sideways).toBeLessThanOrEqual(1)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1)
  })

  test(`the console’s tab row stays on screen under four traces — ${width}×${height}`, async ({
    page,
  }) => {
    // This task begins "Open Controls on the console"; its console shows the effort trace too.
    await openTask(page, width, height, 'triggering-and-cycling', 3)
    const pane = page.locator('[data-flow-visual]')
    const nav = page.locator('[data-ventilation-console] nav')
    const edges = async () => ({
      pane: await box(page, '[data-flow-visual]'),
      nav: await box(page, '[data-ventilation-console] nav'),
      consoleBox: await box(page, '[data-ventilation-console]'),
    })
    const opened = await edges()
    // The console is taller than its pane, and its tab row is whole inside the pane all the same.
    expect(opened.consoleBox.bottom).toBeGreaterThan(opened.pane.bottom)
    expect(opened.nav.bottom).toBeLessThanOrEqual(opened.pane.bottom + 1)
    expect(opened.nav.top).toBeGreaterThan(opened.consoleBox.top)
    // It works where it is.
    await nav.getByRole('button', { name: 'Controls' }).click()
    await expect(nav.getByRole('button', { name: 'Controls' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect((await edges()).nav.bottom).toBeLessThanOrEqual(opened.pane.bottom + 1)
    await nav.getByRole('button', { name: 'Monitoring' }).click()
    // Scrolled to the console's end, the row is back in its own place: the foot of the screen.
    await pane.evaluate((element) => (element.scrollTop = element.scrollHeight))
    const foot = await nav.evaluate((element) => {
      const row = element.getBoundingClientRect()
      const bezel = element.parentElement!.getBoundingClientRect()
      return { gap: Math.abs(bezel.bottom - row.bottom), inPane: row.bottom <= window.innerHeight }
    })
    expect(foot.gap).toBeLessThanOrEqual(2)
    expect(foot.inPane).toBe(true)
  })

  test(`the bedside actions are beside the console — ${width}×${height} (smaller laptop)`, async ({
    page,
  }) => {
    await openTask(page, width, height, 'waveform-reading-sequence', 3)
    const consoleBox = await box(page, '[data-ventilation-console]')
    const actions = await box(page, '[data-bedside-actions]')
    expect(actions.left).toBeGreaterThanOrEqual(consoleBox.right)
    expect(await shareInView(page, '[data-bedside-actions]')).toBe(1)
    const pane = await box(page, '[data-flow-visual]')
    const nav = await box(page, '[data-ventilation-console] nav')
    expect(nav.bottom).toBeLessThanOrEqual(pane.bottom + 1)
  })
}

for (const [width, height] of [
  [1440, 800],
  [1600, 852],
] as const) {
  test(`the oxygenation panel and its reference values fit the text column — ${width}×${height}`, async ({
    page,
  }) => {
    // This section opens on its matched comparison, with no console to wait for.
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await page.setViewportSize({ width, height })
    await page.goto('/en/mechanical-ventilation/learn?activity=oxygenation-response')
    await expect(page.locator('[data-now-card]').first()).toBeVisible({ timeout: 90_000 })
    await expect(page.locator('[data-flow-teaching] [data-teaching-panel]')).toHaveCount(1)
    const fit = await page.locator('[data-flow-teaching]').evaluate((pane) => {
      pane
        .querySelectorAll<HTMLDetailsElement>('details[data-lesson-disclosure]')
        .forEach((fold) => (fold.open = true))
      const edge = pane.getBoundingClientRect().left + pane.clientWidth
      const panel = pane.querySelector('[data-teaching-panel]')!
      const past = [...panel.querySelectorAll('h2, h3, h4, p, dt, dd, button')].filter(
        (element) => element.getBoundingClientRect().right > edge + 1,
      ).length
      const goal = [...panel.querySelectorAll('dd')].find((value) =>
        (value.textContent ?? '').includes('88–95%'),
      )
      return { past, goalRight: goal ? goal.getBoundingClientRect().right : null, edge }
    })
    // Sized by its content the panel was 612 px wide, and the goal values were cut off.
    expect(fit.past).toBe(0)
    expect(fit.goalRight).not.toBeNull()
    expect(fit.goalRight!).toBeLessThanOrEqual(fit.edge)
  })
}
