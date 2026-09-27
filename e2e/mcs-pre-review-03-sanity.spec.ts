import { expect, test } from '@playwright/test'

test.use({ baseURL: process.env.MCS_E2E_BASE_URL ?? 'http://localhost:3151' })
const root = '/en/mechanical-circulatory-support'
test.beforeEach(async ({ page }) => {
  await page.route('**/api/analytics**', (route) => route.fulfill({ status: 204, body: '' }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${root}/learn?lesson=iabp-efficacy-limits`)
  await page.locator('[data-now-card], [data-prerequisite-reference]').first().waitFor()
  const prerequisite = page.getByRole('button', { name: 'Continue to the model' })
  if (await prerequisite.count()) await prerequisite.click()
  await expect(page.locator('[data-step-bar-continue]')).toBeVisible()
})

for (const selector of ['[data-step-bar-continue]', '[data-now-primary]']) {
  for (const activation of ['click', 'Enter', 'Space', 'double-click']) {
    test(`${selector}: ${activation} advances exactly one task`, async ({ page }) => {
      const button = page.locator(selector)
      if (activation === 'double-click') await button.dblclick()
      else if (activation === 'click') await button.click()
      else await button.press(activation)
      await expect(page.locator('[data-critical-care-activity-shell]')).toHaveAttribute(
        'data-stage',
        'iabp-efficacy-limits-predict',
      )
      await expect(page.locator('[data-now-focus]')).toBeFocused()
    })
  }
}

test('the learner’s monitor preference survives forward, back and rerender', async ({ page }) => {
  const monitor = page.locator('[data-monitor-disclosure]')
  await expect(monitor).toHaveAttribute('open', '')
  await monitor.locator(':scope > summary').click()
  await expect(monitor).not.toHaveAttribute('open')
  await page.locator('[data-step-bar-continue]').click()
  await expect(monitor).toHaveAttribute('open', '')
  await page.getByRole('button', { name: /Back to/ }).click()
  await expect(monitor).not.toHaveAttribute('open')
  await page.setViewportSize({ width: 320, height: 740 })
  await expect(monitor).not.toHaveAttribute('open')
})

test('bottom Continue brings the new task into the usable viewport on a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('[data-now-primary]').click()
  await expect(page.locator('[data-critical-care-activity-shell]')).toHaveAttribute(
    'data-stage',
    'iabp-efficacy-limits-predict',
  )
  await expect
    .poll(async () =>
      page.locator('[data-now-focus]').evaluate((node) => {
        const top = node.getBoundingClientRect().top
        return top >= 64 && top < innerHeight - 60
      }),
    )
    .toBe(true)
})

for (const width of [320, 390]) {
  test(`cutaway legend words fit at ${width}px and 200% text`, async ({ page }) => {
    await page.goto(`${root}/learn?lesson=impella-unloading-placement`)
    await page.locator('[data-now-card], [data-prerequisite-reference]').first().waitFor()
    const prerequisite = page.getByRole('button', { name: 'Continue to the model' })
    if (await prerequisite.count()) await prerequisite.click()
    await page.setViewportSize({ width, height: 844 })
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    const legend = page.locator('[data-cutaway-legend]')
    const clipped = await legend.evaluate((node) => {
      const frame = node.getBoundingClientRect()
      return [...node.querySelectorAll('li')].flatMap((row) =>
        [...row.childNodes]
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .flatMap((text) => {
            const range = document.createRange()
            range.selectNodeContents(text)
            return [...range.getClientRects()].filter(
              (rect) =>
                rect.width > 0 && (rect.left < frame.left - 1 || rect.right > frame.right + 1),
            )
          }),
      ).length
    })
    expect(clipped).toBe(0)
  })
}

for (const theme of ['light', 'dark'] as const) {
  test(`case map labels and pump letters contrast in ${theme} browser theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme })
    await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
    await page.goto(`${root}/practice?case=IMP-01`)
    const map = page.locator('[data-circulation-map]')
    await map.waitFor({ state: 'attached' })
    const contrast = await map.evaluate((node) => {
      const luminance = (color: string) =>
        color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => {
            const c = v / 255
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
          })
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
      const ratio = (a: string, b: string) =>
        (Math.max(luminance(a), luminance(b)) + 0.05) /
        (Math.min(luminance(a), luminance(b)) + 0.05)
      const label = node.querySelector('[data-map-svg] text')!
      const letter = node.querySelector('[data-map-pathway="left-pump"] text')!
      const disc = node.querySelector('[data-map-pathway="left-pump"] rect')!
      return {
        label: ratio(getComputedStyle(label).fill, getComputedStyle(label).stroke),
        letter: ratio(getComputedStyle(letter).fill, getComputedStyle(disc).fill),
      }
    })
    expect(contrast.label).toBeGreaterThanOrEqual(4.5)
    expect(contrast.letter).toBeGreaterThanOrEqual(4.5)
  })
}

test('ninth drawer entry and monitor readout words fit at 320px / 200% text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  const drawer = page.locator('[data-sections-drawer]')
  await drawer.locator(':scope > summary').press('Enter')
  const ninth = drawer.locator('li button').last()
  await ninth.focus()
  const textFits = await ninth.evaluate((node) => {
    const frame = node.getBoundingClientRect()
    return [...node.querySelectorAll('strong, small')].every((text) => {
      const range = document.createRange()
      range.selectNodeContents(text)
      return [...range.getClientRects()].every(
        (rect) => rect.left >= frame.left && rect.right <= frame.right,
      )
    })
  })
  expect(textFits).toBe(true)
  await page.keyboard.press('Escape')
  const qualifier = page.locator('[data-wave-strip="ecgMv"] [data-readout-window]')
  const lines = await qualifier.evaluate((node) => {
    const range = document.createRange()
    range.selectNodeContents(node)
    return [...range.getClientRects()].length
  })
  expect(lines).toBe(1)
})
