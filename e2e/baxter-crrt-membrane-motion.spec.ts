import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * CRRT: the membrane figure in motion, and what its ultrafiltration panel says.
 *
 * Clinical review, 2026-11-13: the ultrafiltration panel drew water crossing the membrane with no
 * solute, which read as a mechanism that carries none. Water pushed across the membrane takes
 * permeable solute with it. The panel now draws the same water and solute as the convection
 * panel, with nothing run back into the blood, and says it is about fluid balance.
 */

async function openFigure(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height })
  await page.goto('/en/baxter-crrt/learn?lesson=crrt-solute-transport')
  const figure = page.locator('[data-crrt-membrane-transport]')
  await expect(figure).toBeVisible({ timeout: 90_000 })
  await figure.scrollIntoViewIfNeeded()
  return figure
}

/** Where a panel's carried dots are now, measured from the left edge of its own drawing. */
const dotPlaces = (panel: Locator) =>
  panel.locator('svg').evaluate((svg) => {
    const origin = svg.getBoundingClientRect().left
    return [...svg.querySelectorAll('[data-crrt-carried]')].map((dot) =>
      Math.round(dot.getBoundingClientRect().left - origin),
    )
  })

async function moves(page: Page, panel: Locator) {
  const before = await dotPlaces(panel)
  await page.waitForTimeout(900)
  const after = await dotPlaces(panel)
  return before.some((left, index) => left !== after[index])
}

test('ultrafiltration carries solute in its water, with nothing replaced, and says what it is for', async ({
  page,
}) => {
  const figure = await openFigure(page, 1440, 900)
  await page.getByRole('button', { name: 'Ultrafiltration', exact: true }).click()
  await expect(figure).toHaveAttribute('data-selected', 'ultrafiltration')
  const convection = figure.locator('[data-mechanism="convection"]')
  const ultrafiltration = figure.locator('[data-mechanism="ultrafiltration"]')

  // The same three dots on the same water arrow as convection; only convection has replacement.
  await expect(ultrafiltration.locator('[data-crrt-carried]')).toHaveCount(3)
  await expect(convection.locator('[data-crrt-carried]')).toHaveCount(3)
  await expect(ultrafiltration.locator('[data-crrt-replacement]')).toHaveCount(0)
  await expect(convection.locator('[data-crrt-replacement]')).toHaveCount(1)
  await expect(ultrafiltration).toContainText('water + solute')
  await expect(ultrafiltration).toContainText('net fluid removal')

  // What the panel is for, under the heading while it is the selected one.
  const scope = figure.locator('[data-crrt-membrane-scope]')
  await expect(scope).toBeVisible()
  await expect(scope).toHaveText(
    'This panel is about fluid balance. The water that crosses carries dissolved solute with it, as in convection, and that solute is counted as convective clearance. What is not replaced is the net fluid removal.',
  )
  await expect(figure.getByRole('region', { name: 'What each panel shows' })).toContainText(
    'the same water arrow and solute dots as in convection, and no replacement arrow',
  )
  await expect(figure).not.toContainText(/no solute/i)
})

test('the figure plays, pauses and resumes, in both water panels', async ({ page }) => {
  const figure = await openFigure(page, 1440, 900)
  const ultrafiltration = figure.locator('[data-mechanism="ultrafiltration"]')
  const convection = figure.locator('[data-mechanism="convection"]')
  await expect(figure).toHaveAttribute('data-motion', 'playing')
  expect(await moves(page, ultrafiltration)).toBe(true)
  expect(await moves(page, convection)).toBe(true)

  await figure.getByRole('button', { name: 'Pause motion' }).click()
  await expect(figure).toHaveAttribute('data-motion', 'paused')
  // A browser applies a pause on its next frame; read once that frame has passed.
  await page.waitForTimeout(250)
  expect(await moves(page, ultrafiltration)).toBe(false)
  expect(await moves(page, convection)).toBe(false)
  // Paused, the panel is still a complete drawing: its dots are on it.
  await expect(ultrafiltration.locator('[data-crrt-carried]').first()).toBeVisible()

  await figure.getByRole('button', { name: 'Play motion' }).click()
  expect(await moves(page, ultrafiltration)).toBe(true)
})

/*
 * This module switches every animation off where the device asks for reduced motion. The figure's
 * Play button did nothing there, and its dots, placed by their paused animations, sat on their
 * start points: none showed in the diffusion panel and one in each water panel.
 */
test('where the device asks for reduced motion the figure is a complete still drawing, with no Play', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const figure = await openFigure(page, 1440, 900)
  await expect(figure).toHaveAttribute('data-motion', 'still')
  await expect(figure.getByRole('button', { name: /motion/ })).toHaveCount(0)
  await expect(figure.locator('[data-crrt-membrane-motion-off]')).toHaveText(
    'Shown still: this device asks for reduced motion.',
  )
  for (const id of ['convection', 'ultrafiltration']) {
    const panel = figure.locator(`[data-mechanism="${id}"]`)
    expect(await moves(page, panel)).toBe(false)
    // Three dots, apart from one another, along the arrow.
    const places = await dotPlaces(panel)
    expect(places).toHaveLength(3)
    expect(places[1] - places[0]).toBeGreaterThan(20)
    expect(places[2] - places[1]).toBeGreaterThan(20)
  }
  // Diffusion: the dots on each side are painted inside the drawing, more on the blood side.
  const sides = await figure.locator('[data-mechanism="diffusion"] svg').evaluate((svg) => {
    const frame = svg.getBoundingClientRect()
    const inside = (dot: Element) => {
      const box = dot.getBoundingClientRect()
      return box.top >= frame.top && box.bottom <= frame.bottom && box.height > 0
    }
    return [...svg.querySelectorAll('g[clip-path]')].map(
      (group) => [...group.querySelectorAll('circle')].filter(inside).length,
    )
  })
  expect(sides).toEqual([8, 2])
})

test('on a phone the three panels stack, the labels stay readable and nothing is pushed sideways', async ({
  page,
}) => {
  const figure = await openFigure(page, 390, 844)
  await page.getByRole('button', { name: 'Ultrafiltration', exact: true }).click()
  await expect(figure.locator('[data-crrt-membrane-scope]')).toBeVisible()
  const panels = figure.locator('[data-mechanism]')
  const boxes = await panels.evaluateAll((items) =>
    items.map((item) => {
      const box = item.getBoundingClientRect()
      return { left: box.left, right: box.right, top: box.top }
    }),
  )
  // One under another, each inside the window.
  expect(boxes[1].top).toBeGreaterThan(boxes[0].top)
  expect(boxes[2].top).toBeGreaterThan(boxes[1].top)
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(391)
  }
  // The labels inside the drawing, as they are painted: no smaller than 9 px.
  const smallest = await figure
    .locator('[data-mechanism="ultrafiltration"] svg text')
    .evaluateAll((labels) =>
      Math.min(...labels.map((label) => label.getBoundingClientRect().height)),
    )
  expect(smallest).toBeGreaterThanOrEqual(9)
  // The new label stays inside its panel's drawing.
  const fits = await figure.locator('[data-mechanism="ultrafiltration"] svg').evaluate((svg) => {
    const frame = svg.getBoundingClientRect()
    return [...svg.querySelectorAll('text')].every((label) => {
      const box = label.getBoundingClientRect()
      return box.left >= frame.left - 1 && box.right <= frame.right + 1
    })
  })
  expect(fits).toBe(true)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1)
})
