import { expect, test, type Page, type TestInfo } from '@playwright/test'

const shellSelector = '[data-ecmo-shell="learn"]'

async function settle(page: Page) {
  await page.waitForTimeout(800)
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('[data-ecmo-shell]')!
    const focus = document.activeElement as HTMLElement
    const strip = shell.querySelector<HTMLElement>('[data-ecmo-context-strip]')!
    const site = document.querySelector<HTMLElement>('body header')!
    const describe = (node: HTMLElement) => ({
      rect: node.getBoundingClientRect().toJSON(),
      scrollTop: node.scrollTop,
      scrollPadding: getComputedStyle(node).scrollPadding,
      scrollMargin: getComputedStyle(node).scrollMargin,
      position: getComputedStyle(node).position,
      overflowY: getComputedStyle(node).overflowY,
    })
    const rect = focus.getBoundingClientRect()
    const hits = [rect.top + 1, rect.top + rect.height / 2, rect.bottom - 1].map((y) => {
      const hit = document.elementFromPoint(rect.left + rect.width / 2, y)
      return { own: hit === focus || focus.contains(hit), hit: hit?.tagName }
    })
    const desktop = getComputedStyle(shell).overflowY === 'auto'
    let visibleTop = Math.max(
      site.getBoundingClientRect().bottom,
      desktop ? shell.getBoundingClientRect().top : 0,
    )
    // A strip below the viewport top is still in normal flow. Only count it when pinned.
    if (getComputedStyle(strip).position === 'sticky' && !strip.contains(focus)) {
      const stripRect = strip.getBoundingClientRect()
      if (stripRect.top <= visibleTop + 1 && stripRect.bottom > visibleTop)
        visibleTop = stripRect.bottom
    }
    return {
      name: focus.getAttribute('aria-label') || focus.textContent?.trim(),
      tag: focus.tagName,
      role: focus.getAttribute('role'),
      readingRegion:
        focus.hasAttribute('data-signal-register-scroller') ||
        focus.matches('[data-fit-width-surface][data-fit-mode="actual"]'),
      focus: describe(focus),
      site: describe(site),
      header: describe(shell.firstElementChild as HTMLElement),
      strip: describe(strip),
      shell: describe(shell),
      document: describe(document.documentElement),
      owner: desktop ? 'shell' : 'document',
      visibleTop,
      visibleBottom: desktop
        ? Math.min(innerHeight, shell.getBoundingClientRect().bottom)
        : innerHeight,
      hits,
      width: innerWidth,
      pageWidth: document.documentElement.scrollWidth,
    }
  })
}

async function tabTo(page: Page, name: string) {
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab')
    await settle(page)
    if (
      await (
        name === 'Sources for this lesson'
          ? page.locator('[data-stage-sources] > summary')
          : page.getByRole('button', { name, exact: true })
      ).evaluate((node) => node === document.activeElement)
    )
      return
  }
  throw new Error(`Tab did not reach ${name}`)
}

async function visibleFocus(page: Page) {
  const g = await geometry(page)
  const ring = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!)
    return Math.max(2, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset))
  })
  if (g.readingRegion && g.focus.rect.height > g.visibleBottom - g.visibleTop) {
    // The signal table is a named horizontal scroll region, not a discrete control. Its rows
    // exceed a viewport; retain keyboard access and require an unobstructed readable intersection.
    const top = Math.max(g.visibleTop, g.focus.rect.top)
    const bottom = Math.min(g.visibleBottom, g.focus.rect.bottom)
    expect(bottom - top).toBeGreaterThan(40)
    expect(
      await page.evaluate(
        ({ x, y }) => {
          const focus = document.activeElement!
          const hit = document.elementFromPoint(x, y)
          return focus === hit || focus.contains(hit)
        },
        { x: g.focus.rect.left + g.focus.rect.width / 2, y: (top + bottom) / 2 },
      ),
    ).toBe(true)
  } else {
    expect(g.focus.rect.top - ring).toBeGreaterThanOrEqual(g.visibleTop - 1)
    expect(g.focus.rect.bottom + ring).toBeLessThanOrEqual(g.visibleBottom + 1)
    expect(g.hits.every((hit) => hit.own)).toBe(true)
  }
  expect(g.pageWidth).toBeLessThanOrEqual(g.width)
  if (g.owner === 'shell') expect(g.document.scrollTop).toBe(0)
}

async function record(page: Page, info: TestInfo, label: string) {
  const data = await geometry(page)
  await info.attach(label, { body: JSON.stringify(data, null, 2), contentType: 'application/json' })
  return data
}

async function open(page: Page, lesson: string, text200 = false) {
  await page.goto(
    `/en/cardiohelp-ecmo/learn?track=${lesson.startsWith('va-') ? 'va' : 'vv'}&lesson=${lesson}`,
  )
  await expect(page.locator('[data-now-card]')).toBeVisible()
  if (text200) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  await settle(page)
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort()
    if (url.pathname.startsWith('/api/'))
      return route.fulfill({ json: { ok: true, accountId: null, modules: [] } })
    return route.continue()
  })
})

for (const width of [390, 320]) {
  test(`native reverse Tab after wheel clears the site header at ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 })
    await open(page, 'why-extracorporeal-support')
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.locator(shellSelector)).toHaveAttribute(
      'data-stage',
      'why-extracorporeal-support-worked-example',
    )
    await settle(page)
    await tabTo(page, 'Continue')
    // Match the report's pre-wheel position (native focus centering varies by browser version).
    const initial = await geometry(page)
    await page.mouse.move(width / 2, 420)
    await page.mouse.wheel(0, Math.round(initial.focus.rect.top - 400))
    await settle(page)
    await page.mouse.wheel(0, 230)
    await settle(page)
    const before = await record(page, info, 'before-reverse-tab')
    expect(before.focus.rect.top).toBeGreaterThan(168)
    expect(before.focus.rect.top).toBeLessThan(172)
    await page.keyboard.press('Shift+Tab')
    await settle(page)
    await expect(
      page.getByRole('button', { name: 'Continue without doing this step', exact: true }),
    ).toBeFocused()
    const after = await record(page, info, 'after-reverse-tab')
    await page.screenshot({ path: info.outputPath('reverse-tab.png') })
    await visibleFocus(page)
    expect(after.document.scrollTop).toBeGreaterThan(before.document.scrollTop - 100)
    await page.keyboard.press('Tab')
    await settle(page)
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeFocused()
    await visibleFocus(page)
  })
}

for (const lesson of [
  'arterial-bubble-stop',
  'transport-power-loss',
  'va-arterial-bubble-stop',
  'va-transport-power-loss',
]) {
  test(`native reverse Tab from Sources clears the enlarged operational strip: ${lesson}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, lesson, true)
    await tabTo(page, 'Sources for this lesson')
    await record(page, info, 'sources')
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Shift+Tab')
      await settle(page)
    }
    await expect(page.locator('summary').filter({ hasText: /^Why this matters$/ })).toBeFocused()
    await record(page, info, 'why-this-matters')
    await page.screenshot({ path: info.outputPath('reverse-tab.png') })
    await visibleFocus(page)
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab')
      await settle(page)
      await visibleFocus(page)
    }
    await expect(page.locator('[data-stage-sources] > summary')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-stage-sources]')).toHaveAttribute('open', '')
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-stage-sources]')).not.toHaveAttribute('open', '')
  })
}

for (const [width, height, text200] of [
  [1600, 900, false],
  [1440, 900, false],
  [1024, 768, false],
  [390, 844, false],
  [320, 844, false],
  [1440, 900, true],
] as const) {
  test(`native forward/reverse focus and reading bounds at ${width}x${height}, enlarged=${text200}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height })
    await open(page, 'arterial-bubble-stop', text200)
    // Entry task focus is authored; subsequent moves are browser-native.
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab')
      await settle(page)
      await record(page, info, `forward-${i}`)
      await visibleFocus(page)
      if (
        await page
          .locator('[data-stage-sources] > summary')
          .evaluate((node) => node === document.activeElement)
      )
        break
      if (i === 79) throw new Error('Sources was not reached')
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab')
      await settle(page)
      await visibleFocus(page)
    }
    await record(page, info, 'matrix-focus')
    await page.screenshot({ path: info.outputPath('matrix-focus.png') })
    const owner = width >= 1024 ? page.locator(shellSelector) : page.locator('html')
    await owner.evaluate((node) => node.scrollTo({ top: node.scrollHeight, behavior: 'instant' }))
    expect(
      await owner.evaluate((node) => node.scrollHeight - node.clientHeight - node.scrollTop),
    ).toBeLessThan(2)
    await owner.evaluate((node) => node.scrollTo({ top: 0, behavior: 'instant' }))
    expect(await owner.evaluate((node) => node.scrollTop)).toBe(0)
    const g = await geometry(page)
    expect(g.header.rect.top).toBeGreaterThanOrEqual(g.site.rect.bottom - 1)
  })
}

test('clearance follows resized chrome and is removed when leaving Learn', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, 'arterial-bubble-stop')
  const clearance = () =>
    page.evaluate(() => ({
      strip: parseFloat(
        document
          .querySelector<HTMLElement>('[data-ecmo-shell]')!
          .style.getPropertyValue('--ecmo-sticky-strip-height'),
      ),
      document: parseFloat(
        document.documentElement.style.getPropertyValue('--ecmo-document-focus-clearance'),
      ),
    }))
  const ordinary = await clearance()
  const enlarged = await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  await expect.poll(async () => (await clearance()).strip).toBeGreaterThan(ordinary.strip)
  await expect.poll(async () => (await clearance()).document).toBeGreaterThan(ordinary.document)
  await enlarged.evaluate((node) => (node as HTMLStyleElement).remove())
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => (await geometry(page)).owner).toBe('document')
  await tabTo(page, 'Sources for this lesson')
  await page.keyboard.press('Shift+Tab')
  await settle(page)
  await visibleFocus(page)
  // Use client-side navigation so cleanup is tested without replacing the document.
  await page
    .locator(`${shellSelector} a`)
    .filter({ hasText: /^ECMO Management$/ })
    .click()
  await expect(page.locator(shellSelector)).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--ecmo-document-focus-clearance'),
      ),
    )
    .toBe('')
  expect(
    await page.locator('html').evaluate((node) => getComputedStyle(node).scrollPaddingTop),
  ).toBe('auto')
})
