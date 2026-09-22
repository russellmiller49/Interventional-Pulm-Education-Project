import { expect, test, type Locator, type Page } from '@playwright/test'

// Real production output, isolated browser storage and native input. No seeded learner work.
const variants = [
  { name: '1600', width: 1600, height: 900 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 768 },
  { name: '390', width: 390, height: 844 },
  { name: '320', width: 320, height: 740 },
  { name: 'text200', width: 1440, height: 900 },
]
const scrollRoutes = [
  {
    id: 'crrt',
    route: '/en/baxter-crrt/learn?lesson=crrt-indications-modality',
    owner: 'document',
  },
  {
    id: 'mv',
    route: '/en/mechanical-ventilation/learn?activity=ventilation-and-co2',
    owner: 'document',
  },
  {
    id: 'mcs',
    route: '/en/mechanical-circulatory-support/learn?lesson=iabp-timing-triggering',
    owner: 'document',
  },
  {
    id: 'bbt',
    route: '/en/learn/anatomy/branch-tracing/learn?lesson=follow-one-airway',
    owner: 'workspace',
  },
  {
    id: 'ecmo',
    route: '/en/cardiohelp-ecmo/learn?track=vv&lesson=why-extracorporeal-support',
    owner: 'workspace',
  },
] as const
const activeBoundary = '#main-content > [data-learning-scroll-owner]'

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== new URL(baseURL!).origin) return route.abort()
    if (url.pathname.startsWith('/api/'))
      return route.fulfill({ status: url.pathname.includes('analytics') ? 204 : 401, body: '' })
    return route.continue()
  })
})
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = scrollY,
          stable = 0
        const start = performance.now()
        const frame = () => {
          stable = scrollY === last ? stable + 1 : 0
          last = scrollY
          if (stable >= 10 || performance.now() - start > 2500) resolve()
          else requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
      }),
  )
}
async function headerBottom(page: Page) {
  return page
    .locator('#main-content')
    .evaluate((el) => el.previousElementSibling!.getBoundingClientRect().bottom)
}
async function uncovered(target: Locator) {
  return target.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return !!hit && (el === hit || el.contains(hit))
  })
}
async function geometry(control: Locator, circuit: Locator) {
  const a = (await control.boundingBox())!,
    b = (await circuit.boundingBox())!
  const top = Math.min(a.y, b.y),
    bottom = Math.max(a.y + a.height, b.y + b.height)
  return { control: a, circuit: b, top, bottom, span: bottom - top }
}
async function orient(page: Page, control: Locator, circuit: Locator) {
  await control.focus()
  for (let i = 0; i < 2; i++) {
    const pair = await geometry(control, circuit)
    await page.mouse.move(4, page.viewportSize()!.height / 2)
    await page.mouse.wheel(0, pair.top - (await headerBottom(page)) - 12)
    await settle(page)
  }
}
async function visiblePixels(page: Page, target: Locator) {
  const r = (await target.boundingBox())!,
    viewport = page.viewportSize()!
  const x = Math.max(0, r.x),
    y = Math.max(0, r.y)
  return page.screenshot({
    clip: {
      x,
      y,
      width: Math.min(r.x + r.width, viewport.width) - x,
      height: Math.min(r.y + r.height, viewport.height) - y,
    },
  })
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
}
async function reachWithTab(page: Page, target: Locator) {
  for (let i = 0; i < 150; i++) {
    if (await target.evaluate((el) => document.activeElement === el)) return
    await page.keyboard.press('Tab')
  }
  throw new Error('Native Tab navigation did not reach the selected task')
}

for (const variant of variants) {
  for (const family of [
    { id: 'modalities', lesson: 'crrt-indications-modality', advance: 2, control: 'CVVHD' },
    { id: 'blood-walk', lesson: 'crrt-circuit-pressures', advance: 0, control: 'Patient access' },
    { id: 'fluid-walk', lesson: 'crrt-circuit-pressures', advance: 1, control: 'Dialysate' },
    {
      id: 'pressure-sites',
      lesson: 'crrt-circuit-pressures',
      advance: 2,
      control: 'Access pressure',
    },
    { id: 'mechanisms', lesson: 'crrt-solute-transport', advance: 0, control: 'Convection' },
  ]) {
    test(`CRRT ${family.id}: primary circuit stays with its control — ${variant.name}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(variant)
      await page.goto('/en/baxter-crrt/learn?lesson=' + family.lesson)
      if (variant.name === 'text200')
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
      for (let i = 0; i < family.advance; i++) {
        if (family.id === 'modalities') await page.locator('[data-now-primary]').click()
        else
          await page
            .getByRole('button', { name: 'Continue without this exercise', exact: true })
            .click()
      }
      const work = page.locator('[data-crrt-circuit-workbench]')
      const control = work.getByRole('button', {
        name: new RegExp('^' + family.control + '(?: ✓)?$'),
      })
      const circuit = work.locator('svg[data-overlay]')
      await expect(control).toBeEnabled()
      await orient(page, control, circuit)
      if (family.id === 'fluid-walk') {
        // Batch 03 deliberately allows mobile panning. Sample the dialysate side,
        // not the unchanged blood path on the left, before activating its control.
        const pan = work.getByRole('group', {
          name: 'CRRT circuit schematic; horizontally scrollable on narrow screens',
        })
        if (await pan.evaluate((el) => el.scrollWidth > el.clientWidth)) {
          await pan.focus()
          for (let i = 0; i < 8; i++) {
            const target = await pan.evaluate((el) =>
              Math.min(el.scrollLeft + 140, el.scrollWidth - el.clientWidth),
            )
            await page.keyboard.press('ArrowRight')
            await expect
              .poll(() => pan.evaluate((el) => el.scrollLeft))
              .toBeGreaterThanOrEqual(target - 1)
          }
          await expect
            .poll(() => pan.evaluate((el) => el.scrollWidth - el.clientWidth - el.scrollLeft))
            .toBeLessThan(2)
          await orient(page, control, circuit)
        }
        await expect(circuit.locator('[data-path="dialysate-supply"]')).toHaveAttribute(
          'data-active',
          'false',
        )
      }
      const before = await geometry(control, circuit)
      if (variant.width >= 1024 && variant.name !== 'text200') {
        expect(before.top).toBeGreaterThanOrEqual(await headerBottom(page))
        expect(before.bottom).toBeLessThanOrEqual(variant.height)
      }
      const pixels = await visiblePixels(page, circuit)
      const inset = page.getByRole('figure').filter({ hasText: 'Filter inset' })
      const insetBefore =
        family.id === 'mechanisms' ? await inset.getByRole('img').innerHTML() : null
      const y = await page.evaluate(() => scrollY)
      await page.screenshot({ path: info.outputPath('paired-before.png') })
      await control.press('Space')
      await expect(control).toHaveAttribute('aria-pressed', 'true')
      if (family.id === 'fluid-walk')
        await expect(circuit.locator('[data-path="dialysate-supply"]')).toHaveAttribute(
          'data-active',
          'true',
        )
      await expect.poll(async () => (await visiblePixels(page, circuit)).equals(pixels)).toBe(false)
      await settle(page)
      expect(await page.evaluate(() => scrollY)).toBe(y)
      expect(await uncovered(control)).toBe(true)
      const after = await geometry(control, circuit)
      if (variant.width >= 1024 && variant.name !== 'text200') {
        expect(after.top).toBeGreaterThanOrEqual(await headerBottom(page))
        expect(after.bottom).toBeLessThanOrEqual(variant.height)
      }
      await page.screenshot({ path: info.outputPath('paired-after.png') })
      if (family.id === 'mechanisms') {
        await expect(circuit).toHaveAttribute('data-overlay', 'cvvh-post')
        expect(await inset.getByRole('img').innerHTML()).not.toBe(insetBefore)
        await expect(inset).toContainText('Filter inset · convection')
        await expect(inset.getByRole('img')).toHaveAccessibleName(
          /Water carries eligible dissolved solute/,
        )
        // It remains rendered, follows the primary pair in DOM order, and can be reached by wheel.
        expect(
          await inset.evaluate(
            (el) =>
              !!(
                el.compareDocumentPosition(
                  document.querySelector('[data-crrt-circuit-workbench]')!,
                ) & Node.DOCUMENT_POSITION_PRECEDING
              ),
          ),
        ).toBe(true)
        const insetY = (await inset.boundingBox())!.y
        await page.mouse.move(4, variant.height / 2)
        await page.mouse.wheel(0, insetY - (await headerBottom(page)) - 12)
        await settle(page)
        expect(await uncovered(inset.locator('strong'))).toBe(true)
        await page.screenshot({ path: info.outputPath('filter-inset.png') })
        if (variant.name === '1024') {
          await page.reload()
          await expect(control).toBeEnabled()
          await orient(page, control, circuit)
          const reloaded = await geometry(control, circuit)
          expect(reloaded.bottom).toBeLessThanOrEqual(variant.height)
          await expect(control).toHaveAttribute('aria-pressed', 'false')
        }
      }
      await noOverflow(page)
      await info.attach('geometry', {
        body: JSON.stringify({ variant, family: family.id, before, after }),
        contentType: 'application/json',
      })
    })
  }

  for (const input of ['mouse', 'keyboard'] as const) {
    test(`CRRT instruction navigation: expanded and closed map, first/middle/final — ${variant.name} ${input}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(variant)
      if (input === 'mouse') await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto('/en/baxter-crrt/learn?lesson=crrt-pressure-profile-integration')
      await expect(page.locator('[data-now-card]')).toBeVisible()
      if (variant.name === 'text200')
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
      await settle(page)
      // Initial hydration and text reflow must not perform task navigation.
      expect(await page.evaluate(() => scrollY)).toBe(0)
      const map = page
        .locator('details')
        .filter({ has: page.locator('summary').filter({ hasText: /^Lesson tasks/ }) })
      const summary = map.locator('summary')
      const activate = async (target: Locator) => {
        if (input === 'mouse') await target.click()
        else {
          await reachWithTab(page, target)
          await page.keyboard.press('Enter')
        }
      }
      await activate(summary)
      const buttons = map.getByRole('button')
      const count = await buttons.count()
      const results = []
      for (const index of [count - 1, Math.floor(count / 2), 0, 0]) {
        const target = buttons.nth(index)
        const title = await target.innerText()
        await activate(target)
        const heading = page.locator('#crrt-current-task [data-now-card] > h2')
        await expect(heading).toHaveText(title)
        await expect(heading).toBeFocused()
        await settle(page)
        const rect = (await heading.boundingBox())!
        expect(rect.y).toBeGreaterThanOrEqual(await headerBottom(page))
        expect(rect.y + rect.height).toBeLessThanOrEqual(variant.height)
        expect(await uncovered(heading)).toBe(true)
        await expect(target).toHaveAttribute('aria-current', 'step')
        await expect(map).toHaveAttribute('open', '')
        results.push({ index, title, heading: rect })
        await page.screenshot({ path: info.outputPath(`task-${index}.png`) })
        if (index !== 0) {
          await activate(summary)
          await expect(map).not.toHaveAttribute('open', '')
          await activate(
            page.getByRole('button', { name: 'Continue without this exercise', exact: true }),
          )
          await expect(heading).not.toHaveText(title)
          await settle(page)
          expect(await uncovered(heading)).toBe(true)
          expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(await headerBottom(page))
          await activate(summary)
        }
      }
      await activate(summary)
      await expect(map).not.toHaveAttribute('open', '')
      const previous = await page.locator('[data-now-card] > h2').innerText()
      await activate(
        page.getByRole('button', { name: 'Continue without this exercise', exact: true }),
      )
      const heading = page.locator('#crrt-current-task [data-now-card] > h2')
      await expect(heading).not.toHaveText(previous)
      await settle(page)
      expect(await uncovered(heading)).toBe(true)
      expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(await headerBottom(page))
      await noOverflow(page)
      await info.attach('navigation', {
        body: JSON.stringify(results),
        contentType: 'application/json',
      })
    })
  }
}

async function lockState(page: Page) {
  return page.evaluate(() => ({
    body: getComputedStyle(document.body).overflowY,
    main: getComputedStyle(document.getElementById('main-content')!).overflowY,
    footer: getComputedStyle(document.querySelector('#main-content + footer')!).display,
  }))
}
async function nativeWorkspaceScroll(page: Page) {
  const scrollers = page.locator('#main-content *')
  const index = await scrollers.evaluateAll((elements) =>
    elements.findIndex((el) => {
      const r = el.getBoundingClientRect()
      return (
        ['auto', 'scroll'].includes(getComputedStyle(el).overflowY) &&
        el.scrollHeight > el.clientHeight + 80 &&
        r.height > 100 &&
        r.width > 100 &&
        r.top >= 0 &&
        r.top < innerHeight - 100
      )
    }),
  )
  expect(index).toBeGreaterThanOrEqual(0)
  const scroller = scrollers.nth(index),
    r = (await scroller.boundingBox())!
  const before = await scroller.evaluate((el) => el.scrollTop)
  // Use the gutter: wheel over BBT's CT image deliberately changes slices.
  await page.mouse.move(r.x + 4, Math.min(page.viewportSize()!.height - 30, r.y + r.height / 2))
  await page.mouse.wheel(0, 350)
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(before)
  expect(await page.evaluate(() => scrollY)).toBe(0)
  return { before, after: await scroller.evaluate((el) => el.scrollTop) }
}
for (const variant of variants.slice(0, 3)) {
  for (const item of scrollRoutes) {
    test(`${item.id}: native ${item.owner} scroll ownership — ${variant.name}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(variant)
      await page.goto(item.route)
      await expect(page.locator(activeBoundary)).toHaveAttribute(
        'data-learning-scroll-owner',
        item.owner,
      )
      await expect(page.locator('[data-critical-care-activity-shell]')).toBeVisible()
      expect(await page.locator('[data-learning-scroll-owner]').count()).toBe(1)
      await settle(page)
      if (item.owner === 'workspace') {
        expect(await lockState(page)).toEqual({ body: 'hidden', main: 'hidden', footer: 'none' })
        await info.attach('wheel', {
          body: JSON.stringify(await nativeWorkspaceScroll(page)),
          contentType: 'application/json',
        })
      } else {
        expect((await lockState(page)).body).not.toBe('hidden')
        const before = await page.evaluate(() => scrollY)
        await page.mouse.move(4, variant.height / 2)
        await page.mouse.wheel(0, 350)
        await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before)
      }
    })
  }
}

test('workspace ownership ignores false, hidden, nested, sibling and portal markers; missing ownership retains the legacy lock', async ({
  page,
}, info) => {
  await page.goto(scrollRoutes[4].route)
  const root = page.locator(activeBoundary)
  await expect(root).toHaveAttribute('data-learning-scroll-owner', 'workspace')
  const locked = { body: 'hidden', main: 'hidden', footer: 'none' }
  expect(await lockState(page)).toEqual(locked)
  const records = []
  for (const placement of [
    'legacy-false',
    'false',
    'hidden',
    'nested',
    'sibling',
    'portal',
  ] as const) {
    await page.evaluate((placement) => {
      const owner = document.querySelector('#main-content > [data-learning-scroll-owner]')!
      const marker = document.createElement('div')
      marker.dataset.adversarialMarker = placement
      marker.setAttribute(
        placement === 'legacy-false' ? 'data-learning-document-flow' : 'data-learning-scroll-owner',
        placement.includes('false') ? 'false' : 'document',
      )
      if (placement === 'hidden' || placement === 'legacy-false') marker.hidden = true
      if (placement === 'sibling') owner.after(marker)
      else if (placement === 'portal' || placement === 'legacy-false') document.body.append(marker)
      else owner.querySelector('[data-critical-care-activity-shell]')!.append(marker)
    }, placement)
    const state = await lockState(page)
    expect(state, placement).toEqual(locked)
    records.push({ placement, state })
  }
  // Keep a handle to the actual owner while removing/replacing its declaration.
  const owner = page.locator('#main-content > [data-activity-mode="true"]')
  for (const value of [null, 'false', 'document', 'workspace']) {
    await owner.evaluate((el, value) => {
      if (value === null) el.removeAttribute('data-learning-scroll-owner')
      else el.setAttribute('data-learning-scroll-owner', value)
    }, value)
    const state = await lockState(page)
    if (value === 'document') {
      expect(state.body).not.toBe('hidden')
      expect(state.main).not.toBe('hidden')
      expect(state.footer).not.toBe('none')
    } else expect(state).toEqual(locked)
    records.push({ declaration: value, state })
  }
  await nativeWorkspaceScroll(page)
  await info.attach('adversarial-contract', {
    body: JSON.stringify(records),
    contentType: 'application/json',
  })
})

test('document ownership ignores nested workspace declarations and hidden unrelated activity shells', async ({
  page,
}) => {
  await page.goto(scrollRoutes[0].route)
  await expect(page.locator(activeBoundary)).toHaveAttribute(
    'data-learning-scroll-owner',
    'document',
  )
  await page.evaluate(() => {
    const owner = document.querySelector('#main-content > [data-learning-scroll-owner]')!
    const nested = document.createElement('section')
    nested.setAttribute('data-learning-scroll-owner', 'workspace')
    nested.innerHTML = '<div data-critical-care-activity-shell="true"></div>'
    owner.append(nested)
    const hidden = nested.cloneNode(true) as HTMLElement
    hidden.hidden = true
    owner.after(hidden)
    const portal = nested.cloneNode(true)
    document.body.append(portal)
  })
  expect((await lockState(page)).body).not.toBe('hidden')
  const before = await page.evaluate(() => scrollY)
  await page.mouse.move(4, 450)
  await page.mouse.wheel(0, 350)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before)
})

for (const variant of variants) {
  test(`all nine public entries retain navigation and reflow — ${variant.name}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(variant)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    for (const route of [
      '/en/bronchoscopy-foundations',
      '/en/peripheral-imaging',
      '/en/learn/anatomy/branch-tracing',
      '/en/ebus-guided',
      '/en/cardiohelp-ecmo',
      '/en/baxter-crrt',
      '/en/icu-hemodynamics',
      '/en/mechanical-ventilation',
      '/en/mechanical-circulatory-support',
    ]) {
      const response = await page.goto(route)
      expect(response?.status(), route).toBe(200)
      await expect(page.locator('h1').first()).toBeVisible()
      if (variant.name === 'text200')
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
      await noOverflow(page)
      const entry = page.getByRole('link', { name: /Learn|Start|Continue/ }).first()
      await expect(entry).toBeVisible()
      if (variant.name === '1440') {
        await entry.click()
        await expect.poll(() => new URL(page.url()).pathname).not.toBe(route)
      }
      if (variant.name === '320')
        await page.screenshot({ path: info.outputPath(route.split('/').at(-1) + '.png') })
    }
    expect(errors).toEqual([])
  })
}
