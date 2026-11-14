import { expect, test, type Page } from '@playwright/test'

/**
 * Mechanical ventilation: the case is the section's last task.
 *
 * A section used to end with a link to Practice; the case ran on its own page and there was no way
 * back. Nine sections now end on their case, run inside the section on its own patient and clock.
 */

async function openLastOwnTask(page: Page, width: number, height: number, section: string) {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.setViewportSize({ width, height })
  await page.goto(`/en/mechanical-ventilation/learn?activity=${section}`)
  await expect(page.locator('[data-now-card]').first()).toBeVisible({ timeout: 90_000 })
  const list = page.locator('[data-task-map]')
  await list.evaluate((element) => ((element as HTMLDetailsElement).open = true))
  await list.locator('[data-step-list] li:not([data-case-row]) button').last().click()
  await list.evaluate((element) => ((element as HTMLDetailsElement).open = false))
}

const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

/** How much of "Section finished" the pinned Continue bar covers, in px. */
const coveredByBar = (page: Page) =>
  page.evaluate(() => {
    const done = document.querySelector('[data-section-completion]')
    const bar = document.querySelector('[data-now-footer]')
    if (!done || !bar) return -1
    return Math.max(
      0,
      Math.round(done.getBoundingClientRect().bottom - bar.getBoundingClientRect().top),
    )
  })

for (const [width, height] of [
  [1600, 852],
  [1440, 800],
  [390, 844],
] as const) {
  test(`a section runs its case as its last task and comes back finished — ${width}×${height}`, async ({
    page,
  }) => {
    await openLastOwnTask(page, width, height, 'expiration-and-air-trapping')
    const card = page.locator('[data-now-card]').first()
    await expect(card).toContainText('Task 7 of 8')
    await expect(page.locator('[data-section-completion]')).toHaveCount(0)
    // The task list names the case without naming what it shows.
    const caseRow = page.locator('[data-step-list] li[data-case-row]')
    await expect(caseRow).toHaveText('8. Apply it in a patient case')

    await card.getByRole('button', { name: 'Continue to the case' }).click()
    const view = page.locator('[data-section-case="MV-05"]')
    await expect(view).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Does the breath have time to finish?',
    )
    await expect(view.locator('h2[data-case-title]')).toHaveText(
      'COPD: dynamic hyperinflation with ineffective efforts',
    )
    await expect(page.locator('[data-case-kicker]')).toBeInViewport()
    await expect(view.locator('[data-case-title]')).toBeInViewport()
    // One console on the page, the case's, and its own clock runs.
    if (width >= 768) {
      await expect(page.locator('[data-device]')).toHaveCount(1)
      await expect(view.locator('[data-device]')).toHaveCount(1)
      const time = view.locator('[data-simulation-time]')
      await view.getByRole('button', { name: 'Run physiology' }).click()
      await expect
        .poll(async () => Number(await time.getAttribute('data-simulation-time')), {
          timeout: 10_000,
        })
        .toBeGreaterThan(0)
      await view.getByRole('button', { name: 'Pause', exact: true }).click()
    }
    // The section's own patient and panes are not on the page meanwhile.
    await expect(page.locator('[data-console-surface]')).toHaveCount(0)
    await expect(page.locator('[data-flow-teaching]')).toHaveCount(0)
    expect(await sideways(page)).toBeLessThanOrEqual(1)

    await view.getByRole('button', { name: 'Leave the case' }).click()
    await expect(view).toHaveCount(0)
    const done = page.locator('[data-section-completion]')
    await expect(done).toContainText('Section finished')
    await expect(done).toBeInViewport()
    await expect(done.getByRole('button', { name: 'Run the case again' })).toBeVisible()
    await expect(card.getByRole('button', { name: /^Continue to Section 8 · / })).toBeInViewport()
    await expect(page.locator('[data-console-surface]')).toHaveCount(1)
  })
}

test('the case can be skipped, and stays one press away', async ({ page }) => {
  await openLastOwnTask(page, 1600, 852, 'mechanics-load-and-pressure')
  const card = page.locator('[data-now-card]').first()
  await card.getByRole('button', { name: 'Skip the case' }).click()
  const done = page.locator('[data-section-completion]')
  await expect(done).toContainText('You skipped this section’s case')
  await done.getByRole('button', { name: 'Open the case' }).click()
  await expect(page.locator('[data-section-case="MV-13"]')).toBeVisible()
})

test('the section whose case a later section ends on keeps its link to Practice', async ({
  page,
}) => {
  await openLastOwnTask(page, 1600, 852, 'lung-protection')
  await expect(page.locator('[data-step-list] li[data-case-row]')).toHaveCount(0)
  const pairing = page.locator('[data-section-completion] [data-practice-pairing]')
  await expect(pairing).toContainText('It is also the last task of Section 9')
  await expect(pairing.getByRole('link')).toHaveAttribute('href', /\/practice\?case=MV-01$/)
})

// Section 9's last task is long: at this size the card used to sit two-thirds behind the bar.
test('skipping the case brings "Section finished" clear of the pinned Continue bar', async ({
  page,
}) => {
  await openLastOwnTask(page, 1440, 800, 'oxygenation-response')
  const card = page.locator('[data-now-card]').first()
  await card.getByRole('button', { name: 'Skip the case' }).click()
  const done = page.locator('[data-section-completion]')
  await expect(done).toContainText('You skipped this section’s case')
  await expect(done.getByRole('button', { name: 'Open the case' })).toBeInViewport({ ratio: 1 })
  expect(await coveredByBar(page)).toBe(0)
})

// Given their case by the owner on 2026-11-12.
for (const [section, caseId, title, next] of [
  [
    'oxygenation-response',
    'MV-01',
    'ARDS hypoxemia: recruitment versus overdistension',
    /^Continue to Section 10 · /,
  ],
  [
    'ventilation-and-co2',
    'MV-06',
    'Severe asthma: auto-PEEP with obstructive shock',
    /^Continue to Section 11 · /,
  ],
  [
    'high-peak-pressure-integration',
    'MV-14',
    'Sudden loss of compliance: tension pneumothorax',
    null,
  ],
] as const) {
  test(`${section} ends on ${caseId} and comes back finished`, async ({ page }) => {
    await openLastOwnTask(page, 1440, 800, section)
    const card = page.locator('[data-now-card]').first()
    await expect(page.locator('[data-step-list] li[data-case-row]')).toHaveAttribute(
      'data-case-row',
      caseId,
    )
    await expect(page.locator('[data-task-map]')).not.toContainText(title)
    await card.getByRole('button', { name: 'Continue to the case' }).click()
    const view = page.locator(`[data-section-case="${caseId}"]`)
    await expect(view.locator('h2[data-case-title]')).toHaveText(title)
    await expect(view.locator('[data-case-title]')).toBeInViewport()
    await expect(view.locator('[data-device]')).toHaveCount(1)
    expect(await sideways(page)).toBeLessThanOrEqual(1)
    await view.getByRole('button', { name: 'Leave the case' }).click()
    const done = page.locator('[data-section-completion]')
    await expect(done).toContainText(`You opened this section’s case: ${title}.`)
    await expect(done).toBeInViewport()
    expect(await coveredByBar(page)).toBe(0)
    if (next) await expect(card.getByRole('button', { name: next })).toBeInViewport()
  })
}

test('Practice still opens the same case on its own page', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1600, height: 852 })
  await page.goto('/en/mechanical-ventilation/practice?case=MV-05&device=hamilton-c6&mode=guided')
  await expect(page.locator('h1[data-case-title]')).toHaveText(
    'COPD: dynamic hyperinflation with ineffective efforts',
    { timeout: 90_000 },
  )
  await expect(page.locator('[data-case-strip]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Continue to another case' }).first()).toBeVisible()
})
