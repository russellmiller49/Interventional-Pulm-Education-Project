import { expect, test, type Page } from '@playwright/test'

/**
 * The mechanical circulatory support case as the last task of its section (owner, 2026-10-17, as
 * ICU hemodynamics did on 2026-10-14): the case runs inside the section's task card at the task's
 * full width, on its own clock, with the section's simulator not mounted; Exit case and the end of
 * the case return to the section, whose completion card then shows. Practice still opens every
 * case on its own page.
 *
 *   MCS_E2E_BASE_URL=http://localhost:3141 npx playwright test e2e/mcs-section-case.spec.ts
 */
test.use({ baseURL: process.env.MCS_E2E_BASE_URL ?? 'http://127.0.0.1:3001', channel: 'chromium' })

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
const sectionCase = (page: Page) => page.locator('[data-section-case]')

/** Opens a section at its transfer and moves on to its case, the last task. */
async function openCaseTask(page: Page, sectionId: string) {
  await page.goto(`/en/mechanical-circulatory-support/learn?lesson=${sectionId}&phase=transfer`)
  await expect(card(page)).toBeVisible({ timeout: 60_000 })
  await expect(primary(page)).toHaveText(/Continue to the case/)
  await primary(page).click()
  await expect(primary(page)).toHaveText(/Start the case/)
}

test('on a desktop the case takes the task width, on its own clock, and returns to the section', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openCaseTask(page, 'iabp-efficacy-limits')

  // One engine: the section's simulator and its clock are gone from the case task.
  await expect(page.locator('[data-flow-visual]')).toHaveCount(0)
  await expect(page.locator('[data-clock-bar]')).toHaveCount(0)
  await expect(page.locator('[data-single-column="case"]')).toHaveCount(1)

  await primary(page).click()
  await expect(sectionCase(page)).toHaveAttribute('data-section-case', 'IABP-03')
  await expect(page.locator('[data-case-strip]')).toHaveText(
    'Case · Correct timing, inadequate circulation · the last task of Section 4',
  )
  await expect(page.locator('[data-clock-bar]')).toHaveCount(1)
  await expect(sectionCase(page).locator('[data-clock-bar]')).toBeInViewport()
  const time = () =>
    sectionCase(page)
      .locator('[data-clock-time]')
      .innerText()
      .then((text) => Number.parseFloat(text.replace(/[^\d.]/g, '')))
  await expect.poll(time, { timeout: 10_000 }).toBeGreaterThan(0.5)
  // The case is the task card's full width, not a column beside a simulator.
  const width = (await sectionCase(page).boundingBox())!.width
  expect(width).toBeGreaterThan(1200)
  // The page still does not scroll; the task body does.
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(
    true,
  )

  // The end of the case: its worked explanation, then the way back to the section.
  await sectionCase(page).getByRole('button', { name: 'Open worked explanation' }).click()
  const back = sectionCase(page).getByRole('button', {
    name: /Back to Section 4: Timed correctly, still not perfusing/,
  })
  await back.scrollIntoViewIfNeeded()
  await back.click()
  await expect(sectionCase(page)).toHaveCount(0)
  const completion = page.locator('[data-stage-completion]')
  await expect(completion).toBeVisible()
  await expect(completion).toBeFocused()
  await expect(completion).toContainText(
    'The case is closed: Correct timing, inadequate circulation.',
  )
  await expect(page.locator('[data-now-footer="pinned"] [data-now-primary]')).toHaveText(
    /Continue to the next section: Where is the inlet sitting\?/,
  )
  await expect(page).toHaveURL(/\/learn\?lesson=iabp-efficacy-limits/)
})

test('Exit case finishes the section without leaving it', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openCaseTask(page, 'lvad-alarms-emergencies')
  await primary(page).click()
  await expect(page.locator('[data-case-strip]')).toContainText(
    'on its power check, not its thrombosis pattern',
  )
  await sectionCase(page)
    .getByRole('button', { name: /Exit case/ })
    .click()
  await expect(page.locator('[data-stage-completion]')).toBeVisible()
  await expect(page.locator('[data-now-status]')).toHaveText('Section finished.')
  await expect(card(page).locator('[data-now-secondary]')).toHaveText(/Run the case again/)
  await expect(page).toHaveURL(/\/learn\?lesson=lvad-alarms-emergencies/)
})

test('on a phone the case fits the width', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await openCaseTask(page, 'impella-unloading-placement')
  await primary(page).click()
  await expect(sectionCase(page)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
})

test('Practice still opens a paired case on its own page', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/en/mechanical-circulatory-support/practice?case=IABP-03')
  const workflow = page.locator('[data-case-workflow]')
  await expect(workflow).toBeVisible({ timeout: 60_000 })
  await expect(workflow).toContainText('GUIDED CASE · IABP-03')
  await expect(page.locator('[data-case-strip]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Exit case/ })).toHaveCount(0)
})
