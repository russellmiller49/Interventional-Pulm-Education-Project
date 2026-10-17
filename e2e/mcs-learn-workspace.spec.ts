import { expect, test, type Page } from '@playwright/test'

/**
 * The mechanical circulatory support Learn sections in the layout the ICU hemodynamics and
 * mechanical ventilation sections use (October 2026): the text on the left — the task card, its
 * teaching and its question — and the simulator on the right, under one clock bar, each scrolling
 * on its own in a desktop workspace whose page does not scroll; one pane below 75rem.
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
  await page.goto(`/en/mechanical-circulatory-support/learn?lesson=${sectionId}`)
  const skip = page.getByRole('button', { name: 'Skip to the patient' })
  await expect(card(page).or(skip)).toBeVisible({ timeout: 60_000 })
  if (await skip.isVisible()) await skip.click()
  await expect(card(page)).toBeVisible()
}

test('on a desktop the text is left of the simulator and each scrolls on its own', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const sectionId of ['mcs-foundations-signals', 'impella-suction-purge-rv']) {
    await openSection(page, sectionId)
    expect(
      await page
        .locator('[data-learning-scroll-owner]')
        .evaluate((node) => node.getAttribute('data-learning-scroll-owner')),
    ).toBe('workspace')
    const text = page.locator('[data-flow-teaching]')
    const visual = page.locator('[data-flow-visual]')
    const t = (await text.boundingBox())!
    const v = (await visual.boundingBox())!
    expect(t.x + t.width).toBeLessThanOrEqual(v.x)
    expect(t.width + v.width).toBeGreaterThan(1300)
    await expect(text.locator('[data-now-card]')).toBeVisible()
    await expect(visual.locator('[data-clock-bar]')).toBeInViewport()
    // The way on is the card's pinned row, on screen without scrolling.
    await expect(page.locator('[data-now-footer="pinned"] [data-now-primary]')).toBeInViewport()
    await expect(page.locator('[data-now-primary]')).toHaveCount(1)
    const scrollTop = (pane: typeof text) => pane.evaluate((el) => el.scrollTop)
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2)
    await page.mouse.wheel(0, 500)
    await expect.poll(() => scrollTop(text)).toBeGreaterThan(0)
    expect(await scrollTop(visual)).toBe(0)
    expect(await page.evaluate(() => scrollY)).toBe(0)
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1),
    ).toBe(true)
    await expect(page.locator('[data-now-footer="pinned"] [data-now-primary]')).toBeInViewport()
  }
})

test('a narrower desktop or enlarged text makes the workspace one pane: text, then simulator', async ({
  page,
}) => {
  test.setTimeout(120_000)
  // Both under the 75rem the two panes need: a 1024 px window, and 200 % text at 1440 px.
  for (const { viewport, text } of [
    { viewport: { width: 1024, height: 768 }, text: 1 },
    { viewport: { width: 1440, height: 900 }, text: 2 },
  ]) {
    await page.setViewportSize(viewport)
    await openSection(page, 'iabp-timing-triggering')
    if (text !== 1) await page.addStyleTag({ content: `html { font-size: ${text * 100}%; }` })
    const pane = page.locator('[data-flow-content]')
    const textColumn = page.locator('[data-flow-teaching]')
    const visual = page.locator('[data-flow-visual]')
    await expect
      .poll(async () => (await textColumn.boundingBox())!.width)
      .toBeGreaterThan(viewport.width - 140)
    const t = (await textColumn.boundingBox())!
    const v = (await visual.boundingBox())!
    expect(t.y + t.height).toBeLessThanOrEqual(v.y + 1)
    expect(v.width).toBeGreaterThan(viewport.width - 140)
    // One scroller: the task body moves, the page does not, and nothing runs off to the side.
    const p = (await pane.boundingBox())!
    await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2)
    await page.mouse.wheel(0, 600)
    await expect.poll(() => pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    expect(await page.evaluate(() => scrollY)).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    expect(await pane.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
})

test('the way on is pinned and visible at laptop and phone widths', async ({ page }) => {
  test.setTimeout(120_000)
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await openSection(page, 'lvad-parameters-assessment')
    await expect(page.locator('[data-now-footer="pinned"] [data-now-primary]')).toBeInViewport()
    await primary(page).click()
    await expect(card(page)).toContainText('Task 2 of')
    await expect(page.locator('[data-now-footer="pinned"] [data-now-primary]')).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
  }
})

test('a place is asked over the map it is answered on, and the map lights nothing until then', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSection(page, 'impella-suction-purge-rv')
  const visual = page.locator('[data-flow-visual]')
  const callout = visual.locator('[data-map-question-callout]')
  await expect(callout).toBeVisible()
  const map = visual.locator('[data-surface="map"]')
  expect((await callout.boundingBox())!.y).toBeLessThan((await map.boundingBox())!.y)
  await expect(map).not.toContainText('places on the loop')
  await visual.locator('[data-map-answer] label').first().click()
  await page.locator('[data-question-check]').click()
  await expect(page.locator('[data-identify-feedback]')).toBeVisible()
  await expect(map).toContainText('places on the loop')
})

test('the clock bar is the one transport: run, pause and one cardiac cycle', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSection(page, 'mcs-foundations-signals')
  const bar = page.locator('[data-flow-visual] [data-clock-bar]')
  await expect(page.locator('[data-clock-bar]')).toHaveCount(1)
  await expect(bar).toHaveAttribute('data-clock-state', 'paused')
  const time = () => bar.locator('[data-clock-time]').innerText()
  const before = await time()
  await bar.getByRole('button', { name: 'One cardiac cycle' }).click()
  await expect.poll(time).not.toBe(before)
  await bar.getByRole('button', { name: 'Run' }).click()
  await expect(bar).toHaveAttribute('data-clock-state', 'running')
  await bar.getByRole('button', { name: 'Pause' }).click()
  await expect(bar).toHaveAttribute('data-clock-state', 'paused')
})
