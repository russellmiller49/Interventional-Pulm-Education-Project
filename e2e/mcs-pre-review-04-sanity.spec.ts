import { expect, test, type Page } from '@playwright/test'

test.use({ baseURL: process.env.MCS_E2E_BASE_URL ?? 'http://127.0.0.1:3161' })
const route = '/en/mechanical-circulatory-support'
const key = 'interventionalpulm:mcs-progress:v1'
const sections = [
  'mcs-foundations-signals',
  'mcs-foundations-mechanisms',
  'iabp-timing-triggering',
  'iabp-efficacy-limits',
  'impella-unloading-placement',
  'impella-suction-purge-rv',
  'lvad-parameters-assessment',
  'lvad-alarms-emergencies',
  'mcs-device-selection-integration',
]

async function open(page: Page, section: string) {
  await page.goto(`${route}/learn?lesson=${section}`)
  await page.waitForSelector('[data-now-card], [data-prerequisite-reference]')
  await page.waitForTimeout(800)
  if (await page.locator('[data-prerequisite-reference]').count()) {
    await expect(page.locator('[data-source-review-hold]')).toBeVisible()
  }
  for (let i = 0; i < 6; i++) {
    const button = page.locator('[data-prerequisite-reference] button', {
      hasText: /Next reference|Begin the patient example|Continue/,
    })
    if (!(await button.count())) break
    await button.first().click()
  }
  await expect(page.locator('[data-now-card]')).toBeVisible()
}
async function forward(page: Page) {
  const before = await page.locator('[data-now-card] p').first().textContent()
  await page.locator('[data-step-bar-continue]').click()
  await expect(page.locator('[data-now-card] p').first()).not.toHaveText(before!)
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/analytics**', (route) => route.fulfill({ status: 204, body: '' }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})
for (const width of [1280, 390]) {
  test(`unanswered classifications and meaningful replay at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 })
    await open(page, 'mcs-foundations-mechanisms')
    for (let i = 0; i < 20 && !(await page.locator('[data-control-panel-sort]').count()); i++)
      await forward(page)
    const sort = page.locator('[data-control-panel-sort]')
    const before = await page.evaluate((k) => localStorage.getItem(k), key)
    await page.getByRole('button', { name: 'Show example classifications' }).click()
    await expect(sort.locator('[data-sort-outcome-label]')).toHaveText(
      Array(7).fill('Example classification.'),
    )
    expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before)
    expect(
      await sort
        .locator('select')
        .evaluateAll((xs) => xs.every((x) => !(x as HTMLSelectElement).value)),
    ).toBe(true)
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    for (const select of await sort.locator('select').all()) await select.selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Compare classifications' }).click()
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    expect(
      await sort
        .locator('select')
        .evaluateAll((xs) =>
          xs.every((x) => !(x as HTMLSelectElement).disabled && !(x as HTMLSelectElement).value),
        ),
    ).toBe(true)
    await forward(page)
    await expect(page.locator('[data-section-recap]')).toBeVisible()
  })
  test(`all nine skip paths keep the hold visible and preserve only navigation at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(180000)
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 })
    for (const section of sections) {
      await open(page, section)
      for (let step = 0; step < 25; step++) {
        const hold = page.locator('[data-source-review-hold]')
        await expect(hold).toBeVisible()
        await expect(hold).toContainText('MCS-03-10 · NOT REVIEWED · source-owner review required')
        expect(await hold.evaluate((el) => Boolean(el.closest('details')))).toBe(false)
        expect(await page.locator('input[type="radio"]:checked').count()).toBe(0)
        if (await page.locator('[data-section-recap]').count()) break
        await forward(page)
      }
      await expect(page.locator('[data-section-recap]')).toBeVisible()
      expect(await page.locator('[data-section-recap]').innerText()).not.toMatch(
        /\bscore\b|\bmastered\b|\b\d+\s+of\s+\d+\s+(correct|answered)/i,
      )
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1)
    }
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key)
    expect(Object.keys(saved).sort()).toEqual(['selfPaced', 'version'])
    expect(Object.keys(saved.selfPaced).sort()).toEqual([
      'lastActivityId',
      'lastDevice',
      'lastPhase',
      'lastSection',
      'locationUpdatedAt',
      'visitedCaseIds',
      'visitedLessonIds',
    ])
  })
}

test('unmapped cases and Studio expose the source hold before explanations; Studio has no accessible stepper', async ({
  page,
}) => {
  for (const id of ['IABP-03', 'IMP-03', 'LVAD-02', 'CAP-LVAD-01']) {
    await page.goto(`${route}/${id.startsWith('CAP-') ? 'assess' : 'practice'}?case=${id}`)
    await expect(page.locator('[data-source-review-hold]')).toBeVisible()
  }
  await page.goto(`${route}/practice`)
  await page.getByRole('button', { name: 'Explore mechanisms' }).click()
  await expect(page.locator('[data-mechanism-studio]')).toBeVisible()
  await expect(page.getByRole('group', { name: 'MCS shared activity phases' })).toHaveCount(0)
  const client = await page.context().newCDPSession(page)
  const ax = await client.send('Accessibility.getFullAXTree')
  expect(
    ax.nodes
      .filter((node) => !node.ignored)
      .map((node) => node.name?.value ?? '')
      .join('\n'),
  ).not.toMatch(/MCS shared activity phases|^GUIDED$/m)
})
