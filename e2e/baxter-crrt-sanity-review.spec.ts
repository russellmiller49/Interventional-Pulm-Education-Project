import { test, expect, type Page, type Locator } from '@playwright/test'

const card = (page: Page, label: string) =>
  page.getByRole('article').filter({ has: page.getByText(label, { exact: true }) })
const click = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name, exact: typeof name === 'string' }).click()
async function checkFocus(page: Page, target: Locator) {
  await target.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(target).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(target).toBeFocused()
  const focus = await target.evaluate((el) => ({
    visible: el.matches(':focus-visible'),
    outline: getComputedStyle(el).outlineWidth,
    rect: el.getBoundingClientRect().toJSON(),
  }))
  expect(focus.visible).toBe(true)
  expect(parseFloat(focus.outline)).toBeGreaterThan(0)
  expect(focus.rect.width).toBeGreaterThan(0)
}
async function noOverflow(page: Page) {
  // CRRT-FELLOW-03: Practice now scrolls the document, so the global site header's own overflow
  // at 200% root text (a platform item recorded in the Batch-03 handoff) reaches the document.
  // The CRRT contract is that nothing inside the module overflows the window.
  expect(
    await page.evaluate(() => {
      if (document.documentElement.scrollWidth <= innerWidth + 1) return true
      const moduleRoot = document.querySelector('#main-content')!
      return [...moduleRoot.querySelectorAll('*')].every((el) => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.right <= innerWidth + 1) return true
        for (let p = el.parentElement; p && p !== moduleRoot; p = p.parentElement)
          if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true
        return false
      })
    }),
  ).toBe(true)
}

test('sanity: real machine entry, case divergence, stale review and rereview preserve history', async ({
  page,
}, info) => {
  await page.goto('/en/baxter-crrt/practice?case=CRRT-04')
  await page.getByRole('tab', { name: 'Machine + circuit', exact: true }).click()
  await click(page, /^New Patient/)
  await click(page, 'Confirm case-free context')
  await click(page, /^CVVHD Diffusive/)
  await click(page, 'Continue with CVVHD workflow')
  await page.getByRole('spinbutton', { name: /^Blood flow/ }).fill('150')
  await page.getByRole('spinbutton', { name: /^Dialysate flow/ }).fill('1900')
  await page.getByRole('spinbutton', { name: /^Patient fluid removal/ }).fill('100')
  for (const name of [
    'Review and apply case values',
    'Confirm training set path',
    'Confirm bag and scale positions',
    'Start prime sequence check',
    'Complete prime verification',
    'Confirm review',
    'Confirm simulated line path',
    'Start interface run',
  ])
    await click(page, name)
  await page.getByRole('tab', { name: 'Case', exact: true }).click()
  await card(page, 'Define the solute and acid-base treatment goal')
    .getByRole('button')
    .first()
    .click()
  await card(page, 'Enter the case blood-flow rate first').getByRole('button').first().click()
  await page.getByRole('tab', { name: 'Machine + circuit', exact: true }).click()
  await expect(
    page.getByText(
      /you committed 150 mL\/min on the machine; the simulation is running 120 mL\/min/,
    ),
  ).toBeVisible()
  await expect(
    page.getByText('Machine prescription review: not current.', { exact: true }),
  ).toBeVisible()
  const rereview = page.getByRole('button', {
    name: 'Review current values',
    exact: true,
  })
  for (const [width, height, text200] of [
    [1440, 900, false],
    [1280, 900, false],
    [1024, 768, false],
    [390, 844, false],
    [320, 740, false],
    [1280, 900, true],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.evaluate((enlarged) => {
      document.documentElement.style.fontSize = enlarged ? '32px' : ''
    }, text200)
    await page.getByRole('tab', { name: 'Machine + circuit', exact: true }).focus()
    await rereview.click({ trial: true })
    await checkFocus(page, rereview)
    await noOverflow(page)
    const rect = await rereview.boundingBox()
    expect(rect).not.toBeNull()
    expect(rect!.y).toBeGreaterThanOrEqual(0)
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(height + 1)
    expect(
      await rereview.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
      }),
    ).toBe(true)
    expect(rect!.x).toBeGreaterThanOrEqual(0)
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(width + 1)
    await page.screenshot({
      path: info.outputPath(`rereview-focus-${width}${text200 ? '-text200' : ''}.png`),
    })
  }
  await page.screenshot({ path: info.outputPath('machine-divergence.png'), fullPage: true })
  await rereview.click()
  await expect(
    page.getByText('Machine prescription review: current.', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText(
      /you committed 150 mL\/min on the machine; the simulation is running 120 mL\/min/,
    ),
  ).toBeVisible()
  await page.getByRole('tab', { name: 'Debrief', exact: true }).click()
  await click(page, 'End run and review debrief')
  await expect(page.getByText(/Reviewed Blood flow: 120 mL\/min/)).toBeVisible()
  await noOverflow(page)
})

for (const v of [
  { width: 1440, height: 900 },
  { width: 1280, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
  { width: 1280, height: 900, text200: true },
]) {
  test(`sanity: evidence and debrief reflow ${v.width}x${v.height}${v.text200 ? ' text200' : ''}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(v)
    await page.goto('/en/baxter-crrt/practice?case=CRRT-17')
    if (v.text200) await page.addStyleTag({ content: 'html { font-size:32px !important; }' })
    const evidence = page.getByRole('region', { name: 'What this case can show you', exact: true })
    await expect(evidence).toContainText('1.05 mmol/L')
    await expect(evidence).toContainText('Not supplied')
    await evidence.scrollIntoViewIfNeeded()
    await noOverflow(page)
    await evidence.screenshot({ path: info.outputPath('supplied-evidence.png') })
    await checkFocus(page, page.getByRole('button', { name: 'Explain this case', exact: true }))
    await page.goto('/en/baxter-crrt/practice?case=CRRT-11')
    if (v.text200) await page.addStyleTag({ content: 'html { font-size:32px !important; }' })
    await page.getByRole('button', { name: '+1 hr', exact: true }).click()
    await page.getByRole('tab', { name: 'Debrief', exact: true }).click()
    await click(page, 'End run and review debrief')
    await expect(page.getByText(/Patient signals this exercise holds/)).toBeVisible()
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath('actual-debrief.png'), fullPage: true })
    // Scrollable evidence tables are intentional; the document and action controls must fit.
    const clipped = await page.locator('button:visible').evaluateAll((buttons) =>
      buttons
        .filter((el) => {
          const r = el.getBoundingClientRect()
          const css = getComputedStyle(el)
          return (
            r.width > 0 &&
            (r.width > innerWidth ||
              (el.scrollWidth > el.clientWidth + 2 && ['hidden', 'clip'].includes(css.overflowX)))
          )
        })
        .map((el) => el.textContent?.trim()),
    )
    expect(clipped).toEqual([])
  })
}
