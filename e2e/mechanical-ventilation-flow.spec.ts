import { expect, test, type Page } from '@playwright/test'

/**
 * The mechanical ventilation Learn pathway on the flowing stage (October 2026): one pinned Now
 * card per task, one console with one clock beside the teaching, and the one-breath inspection on
 * the console itself.
 */
test.use({ channel: 'chromium' })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {
      /* A browser without storage still opens every section. */
    }
  })
})

const card = (page: Page) => page.locator('[data-now-card]')
const primary = (page: Page) => page.locator('[data-now-card] [data-now-primary]')

async function openSection(page: Page, sectionId: string) {
  await page.goto(`/en/mechanical-ventilation/learn?activity=${sectionId}`)
  await expect(card(page)).toBeVisible({ timeout: 60_000 })
}

async function chooseTask(page: Page, title: string) {
  const list = page.locator('[data-task-map]')
  if (!(await list.evaluate((node) => (node as HTMLDetailsElement).open)))
    await list.locator('summary').click()
  await list.getByRole('button', { name: new RegExp(title) }).click()
}

test('a fresh learner reaches Section 1 in one tap and meets a running console', async ({
  page,
}) => {
  await page.goto('/en/mechanical-ventilation')
  const start = page.locator('[data-ventilation-continue="resolved"]')
  await expect(start).toBeVisible({ timeout: 60_000 })
  await start.click()
  await expect(page).toHaveURL(/activity=breathing-with-support/)
  await expect(card(page)).toContainText('Task 1 of 8')
  await expect(card(page)).toContainText('Why a ventilator exists')
  await expect(page.locator('[data-teaching-block="orientation"]')).toBeVisible()
  // The console runs beside the orientation: the clock moves on its own.
  const time = page.locator('[data-clock-bar] [data-model-time]')
  const first = Number.parseFloat((await time.textContent()) ?? '0')
  await expect
    .poll(async () => Number.parseFloat((await time.textContent()) ?? '0'), { timeout: 10_000 })
    .toBeGreaterThan(first)
  // Eight tasks, every one of them open from the list.
  await page.locator('[data-task-map] summary').click()
  await expect(page.locator('[data-step-list] li')).toHaveCount(8)
  // One transport on the page.
  await expect(page.getByRole('button', { name: /^(Run|Pause)$/ })).toHaveCount(1)
})

test('one breath freezes on the console, and the marked interval’s evidence waits for the answer', async ({
  page,
}) => {
  await openSection(page, 'breathing-with-support')
  await primary(page).click()
  await expect(card(page)).toContainText('Watch one breath')
  await expect(primary(page)).toHaveCount(0)
  await page.locator('#mv-clock-one-breath').click()
  await expect(page.locator('[data-ventilation-console] [data-frozen-breath]')).toBeVisible()
  await expect(page.locator('[data-frozen-badge]')).toHaveText('Your last breath')
  await primary(page).click()

  await expect(card(page)).toContainText('Which phase is marked at A?')
  const note = page.locator('[data-ventilation-console] [data-marker-note="A"]')
  await expect(note).toHaveText('Interval A is marked on this breath.')
  await expect(page.locator('[data-ventilation-console]')).not.toContainText('gas moving out')
  await page.getByLabel('Expiration').check()
  await page.getByRole('button', { name: 'Compare my choice' }).click()
  await expect(note).toContainText('(gas moving out) and volume falling')
})

test('a setting is made on the console, then Run and capture puts the result beside it', async ({
  page,
}) => {
  await openSection(page, 'oxygenation-response')
  await chooseTask(page, 'Try a separate patient')
  await expect(primary(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Show me where' }).click()
  await expect(page.locator('#mv-screen-controls')).toHaveAttribute('data-guided-help', 'true')
  await page.locator('#mv-screen-controls').click()
  const tile = page.locator('#mv-control-peepCmH2O')
  await expect(tile).toHaveAttribute('data-guided-help', 'true')
  await tile.click()
  for (let guard = 0; guard < 30; guard += 1) {
    const value = Number(await tile.locator('strong').textContent())
    if (value === 10) break
    await tile.press(value < 10 ? 'ArrowUp' : 'ArrowDown')
  }
  await expect(tile.locator('strong')).toHaveText('10')
  await expect(primary(page)).toHaveText(/^Run \d+ s and capture$/)
  await primary(page).click()
  await expect(
    page.locator('[data-captured-result-near-task] [data-captured-result]'),
  ).toBeVisible()
  await expect(primary(page)).toHaveText('Continue')
})

test('on a desktop the text is left of the console and each scrolls on its own', async ({
  page,
}) => {
  // Two sections, each opened on a cold dev server.
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  // A reading step (once a narrower column) and a console step (once console-first).
  for (const sectionId of ['controls-and-goals', 'waveform-anatomy']) {
    await openSection(page, sectionId)
    if (sectionId === 'waveform-anatomy') await chooseTask(page, 'inspiratory flow to 60 L/min')
    const text = page.locator('[data-flow-teaching]')
    const visual = page.locator('[data-flow-visual]')
    const t = (await text.boundingBox())!
    const v = (await visual.boundingBox())!
    expect(t.x + t.width).toBeLessThanOrEqual(v.x)
    expect(t.width + v.width).toBeGreaterThan(1300)
    await expect(text.locator('[data-now-card]')).toBeVisible()
    const scrollTop = (pane: typeof text) => pane.evaluate((el) => el.scrollTop)
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2)
    await page.mouse.wheel(0, 500)
    await expect.poll(() => scrollTop(text)).toBeGreaterThan(0)
    expect(await scrollTop(visual)).toBe(0)
    expect(await page.evaluate(() => scrollY)).toBe(0)
    await expect(page.locator('[data-clock-bar]')).toBeInViewport()
    // The clock and the whole console screen down to its tab row, in the pane without scrolling.
    const tabs = (await page.locator('[data-flow-visual] [data-device] nav').boundingBox())!
    const clock = (await page.locator('[data-flow-visual] [data-clock-bar]').boundingBox())!
    expect(clock.y).toBeGreaterThanOrEqual(v.y - 1)
    expect(tabs.y + tabs.height).toBeLessThanOrEqual(v.y + v.height + 1)
  }
})

test('a narrower desktop or enlarged text makes the workspace one pane: text, console, sources', async ({
  page,
}) => {
  test.setTimeout(90_000)
  // Both under the 75rem the two panes need: a 1024 px window, and 200 % text at 1440 px.
  for (const { viewport, text } of [
    { viewport: { width: 1024, height: 768 }, text: 1 },
    { viewport: { width: 1440, height: 900 }, text: 2 },
  ]) {
    await page.setViewportSize(viewport)
    await openSection(page, 'waveform-anatomy')
    if (text !== 1) await page.addStyleTag({ content: `html { font-size: ${text * 100}%; }` })
    await chooseTask(page, 'inspiratory flow to 60 L/min')
    const pane = page.locator('[data-flow-content]')
    const textColumn = page.locator('[data-flow-teaching]')
    const visual = page.locator('[data-flow-visual]')
    await expect
      .poll(async () => (await textColumn.boundingBox())!.width)
      .toBeGreaterThan(viewport.width - 120)
    const t = (await textColumn.boundingBox())!
    const v = (await visual.boundingBox())!
    // The text above the console, the console the full width of the task body.
    expect(t.y + t.height).toBeLessThanOrEqual(v.y + 1)
    expect(v.width).toBeGreaterThan(viewport.width - 120)
    // The sources follow the console in the one pane.
    expect(
      await page.evaluate(() => {
        const sources = document.getElementById('mv-section-sources')
        const consoleColumn = document.querySelector('[data-flow-visual]')!
        return Boolean(
          sources &&
          document.querySelector('[data-flow-content]')!.contains(sources) &&
          consoleColumn.compareDocumentPosition(sources) & Node.DOCUMENT_POSITION_FOLLOWING,
        )
      }),
    ).toBe(true)
    // One scroller: the task body moves, the page does not, and nothing runs off to the side.
    const p = (await pane.boundingBox())!
    await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2)
    await page.mouse.wheel(0, 600)
    await expect.poll(() => pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    // At 200 % text the site header's links wrap to three rows, taller than the
    // `--site-header-height` the workspace is sized under; that is the site header, not this stage.
    if (text === 1)
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1),
      ).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    expect(await pane.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
})

test('the way on is pinned and visible at laptop and phone widths', async ({ page }) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await openSection(page, 'controls-and-goals')
    await chooseTask(page, 'Separate oxygen from breath delivery')
    await expect(page.locator('[data-now-footer="pinned"]')).toBeVisible()
    await expect(primary(page)).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
  }
})
