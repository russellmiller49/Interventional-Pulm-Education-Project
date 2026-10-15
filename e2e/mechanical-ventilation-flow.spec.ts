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
