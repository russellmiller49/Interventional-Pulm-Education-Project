import { expect, test, type Page } from '@playwright/test'

const lesson = '/en/mechanical-circulatory-support/learn?lesson=impella-unloading-placement'

async function openExample(page: Page) {
  await page.goto(lesson)
  await expect(page.locator('[data-now-card]')).toBeVisible()
  for (let i = 0; i < 8; i++) {
    if (await page.locator('[data-unloading-comparison]').isVisible()) return
    await page.locator('[data-now-primary]').click()
  }
  throw new Error('Unloading comparison not reached through Continue')
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)
}

test.beforeEach(async ({ page }) => {
  // Isolated dev verification has no account backend. Leave the model and local progress real.
  await page.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test('replays provided outputs, resets, skips and preserves the placement exercise', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openExample(page)
  await expect(page.getByRole('heading', { name: 'How to read the comparison' })).toBeVisible()
  await expect(page.getByRole('radio')).toHaveCount(0)
  await expect(page.getByText(/Suction is present at both settings/)).toBeVisible()
  await expect(
    page.locator('[data-unloading-condition="filled"] [data-unloading-signal="lvedvMl"]'),
  ).toContainText('116')
  await expect(
    page.locator('[data-unloading-condition="filled"] [data-unloading-signal="lvedvMl"]'),
  ).toContainText('114')
  await screenshot(page, 'filled-underfilled-p6')
  const stored = await page.evaluate(() =>
    Object.fromEntries(
      Object.entries(localStorage).filter(([key]) => /mcs|mechanical-circulatory/i.test(key)),
    ),
  )
  const p8 = page.getByRole('button', { name: 'P8', exact: true })
  await p8.focus()
  await page.keyboard.press('Enter')
  await expect(p8).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('columnheader', { name: 'P8', exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Replay comparison', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Comparison replayed' })).toBeVisible()
  await screenshot(page, 'p8-replayed')
  await page.getByRole('button', { name: 'Reset comparison to P6' }).click()
  await expect(page.getByRole('button', { name: 'P6', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(
    await page.evaluate(() =>
      Object.fromEntries(
        Object.entries(localStorage).filter(([key]) => /mcs|mechanical-circulatory/i.test(key)),
      ),
    ),
  ).toEqual(stored)
  await page.locator('[data-now-primary]').click()
  await expect(page.locator('[data-mcs-task-flow]')).toHaveAttribute(
    'data-stage',
    'impella-unloading-placement-recognize',
  )
  await page.getByRole('button', { name: 'Show answer', exact: true }).click()
  await expect(page.locator('[data-provided-explanation]')).toBeVisible()
  await page.locator('[data-task-map] > summary').click()
  await page
    .locator('[data-step-list]')
    .getByRole('button', { name: /Move the inlet out of position/ })
    .click()
  await expect(page.getByRole('combobox', { name: 'Placement state' })).toHaveValue('correct')
  // Every control the device has sits with the simulator, closed until asked for.
  await expect(
    page.locator('[data-mcs-visual]').getByRole('button', { name: 'All device controls' }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('reload and return use the topic boundary without retaining an invented model action', async ({
  page,
}) => {
  await openExample(page)
  await page.getByRole('button', { name: 'P8', exact: true }).click()
  await page.reload()
  await expect(page.locator('[data-mcs-task-flow]')).toHaveAttribute(
    'data-stage',
    'impella-unloading-placement-inlet-outlet',
  )
  await page.locator('[data-now-primary]').click()
  await expect(page.getByRole('button', { name: 'P6', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('[data-captured-results]')).toHaveCount(0)
  await page.locator('[data-now-primary]').click()
  await page.locator('[data-task-map] > summary').click()
  await page
    .locator('[data-step-list]')
    .getByRole('button', { name: /Guided example: ventricular unloading/ })
    .click()
  // The provided example again: its own figure, read in the text, with no live patient beside it.
  await expect(page.locator('[data-unloading-comparison]')).toBeVisible()
  await expect(page.locator('[data-flow-visual]')).toHaveCount(0)
  await expect(page.locator('[data-clock-bar]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'P6', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

for (const [width, height] of [
  [1280, 720],
  [1024, 768],
  [900, 800],
  [720, 450],
  [390, 844],
  [320, 844],
] as const) {
  test(`readable comparison and keyboard controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await openExample(page)
    await expect(page.getByRole('table')).toHaveCount(2)
    for (const cell of await page.locator('[data-unloading-comparison] td').all()) {
      // Numbers only: a cell that is a phrase ("No resolvable displayed change") may wrap.
      if (!/\d/.test((await cell.textContent()) ?? '')) continue
      const lines = await cell.evaluate((element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        return range.getClientRects().length
      })
      expect(lines, 'A physiological number must not wrap across lines').toBe(1)
    }
    for (const card of await page.locator('[data-unloading-condition]').all()) {
      await card.getByText('Starting state', { exact: true }).click()
      await expect(card.getByText(/eight simulated seconds of observation/)).toBeVisible()
    }
    await page.getByRole('button', { name: 'P8', exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Replay comparison', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status').filter({ hasText: 'Comparison replayed' })).toBeVisible()
    await screenshot(page, `unloading-${width}`)
    await page
      .locator('[data-unloading-condition=underfilled]')
      .screenshot({ path: test.info().outputPath(`underfilled-card-${width}.png`) })
  })
}
