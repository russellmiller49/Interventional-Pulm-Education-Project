import { expect, test, type Locator, type Page } from '@playwright/test'

// Local production build only; no login, backend writes, stored answers or completion seeds.
const routes = {
  pi: '/en/peripheral-imaging/learn?section=projection',
  ebus: '/en/ebus-guided/learn?section=image-depth',
  bf: '/en/bronchoscopy-foundations/learn?section=five-controls',
  crrt: '/en/baxter-crrt/learn?lesson=crrt-indications-modality',
} as const
const variants = [
  { name: '1600', width: 1600, height: 900 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 768 },
  { name: '390', width: 390, height: 844 },
  { name: '320', width: 320, height: 740 },
  { name: 'text200', width: 1440, height: 900 },
]

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== new URL(baseURL!).origin) return route.abort()
    if (url.pathname.startsWith('/api/'))
      return route.fulfill({ status: url.pathname.includes('analytics') ? 204 : 401, body: '' })
    return route.continue()
  })
})

async function band(page: Page) {
  return page.evaluate(() => {
    let top = 0
    let bottom = innerHeight
    const pinned = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => ['fixed', 'sticky'].includes(getComputedStyle(el).position))
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(
        ({ rect }) =>
          rect.width > innerWidth / 2 && rect.height > 0 && rect.height < innerHeight * 0.75,
      )
    // The site and module headers can form two adjacent layers.
    for (let i = 0; i < 3; i++)
      for (const { el, rect } of pinned) {
        if (rect.top <= top + 1 && rect.bottom > top) top = rect.bottom
        if (getComputedStyle(el).bottom !== 'auto' && rect.bottom >= innerHeight - 1)
          bottom = Math.min(bottom, rect.top)
      }
    return { top, bottom }
  })
}
async function geometry(control: Locator, visuals: Locator[]) {
  const boxes = await Promise.all([control, ...visuals].map((el) => el.boundingBox()))
  expect(boxes.every(Boolean)).toBe(true)
  const rects = boxes.map((box) => box!)
  const top = Math.min(...rects.map((r) => r.y))
  const bottom = Math.max(...rects.map((r) => r.y + r.height))
  return { control: rects[0], visuals: rects.slice(1), top, bottom, span: bottom - top }
}
async function uncovered(control: Locator) {
  return control.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return !!hit && (el === hit || el.contains(hit) || hit.contains(el))
  })
}
async function settleScroll(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let previous = scrollY,
          stable = 0
        const start = performance.now()
        const frame = () => {
          stable = scrollY === previous ? stable + 1 : 0
          previous = scrollY
          if (stable >= 10 || performance.now() - start > 2500) resolve()
          else requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
      }),
  )
}
async function positionWorkbench(page: Page, control: Locator, visuals: Locator[]) {
  // One ordinary orientation scroll before manipulating. No scroll is permitted between
  // the change and observing its result. This also accounts for a header reaching its sticky edge.
  for (let n = 0; n < 2; n++) {
    await page.mouse.move(4, page.viewportSize()!.height / 2)
    const clear = await band(page)
    const pair = await geometry(control, visuals)
    await page.mouse.wheel(0, pair.top - clear.top - 12)
    await settleScroll(page)
  }
}
async function visiblePixels(page: Page, visual: Locator) {
  const r = (await visual.boundingBox())!
  const viewport = page.viewportSize()!
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

for (const id of Object.keys(routes) as (keyof typeof routes)[]) {
  for (const variant of variants) {
    test(`${id}: controls and actual output — ${variant.name}`, async ({ page }, info) => {
      await page.setViewportSize(variant)
      // Exercise PI's rapid native Tab transition without reduced motion masking smooth-scroll
      // races. Its existing regression file separately covers reduced-motion focus behavior.
      if (id === 'pi') await page.emulateMedia({ reducedMotion: 'no-preference' })
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(routes[id])
      if (variant.name === 'text200')
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
      if (id === 'bf') {
        await page.locator('[data-now-primary]').click()
        await page.getByRole('button', { name: 'Try with guidance', exact: true }).click()
        await expect(page.locator('[data-three-state]')).toHaveAttribute(
          'data-three-state',
          'ready',
        )
      }
      if (id === 'crrt') {
        await page.locator('[data-now-primary]').click()
        await page.locator('[data-now-primary]').click()
      }
      const frame = page.frameLocator('iframe[title="EBUS workbench"]')
      const control =
        id === 'pi'
          ? page.locator('#peripheral-imaging-control-orbit')
          : id === 'ebus'
            ? frame.getByRole('slider', { name: 'Image depth' })
            : id === 'bf'
              ? page.getByRole('button', { name: 'Advance', exact: true })
              : page.getByRole('button', { name: /^CVVHD(?: ✓)?$/ })
      const output =
        id === 'pi'
          ? page.locator('[data-current-image] [data-projection-state]')
          : id === 'ebus'
            ? frame.locator('.recorded-current')
            : id === 'bf'
              ? page.locator('[data-pilot-bench="true"]')
              : page.locator('[data-now-card] svg[data-overlay]')
      const visuals =
        id === 'pi' && variant.width >= 1024 && variant.name !== 'text200'
          ? [output, page.locator('[data-suite-viewport]')]
          : [output]
      await expect(control).toBeEnabled({ timeout: 60_000 })
      if (id === 'pi') await expect(output).toHaveAttribute('data-projection-state', 'ready')
      if (variant.name === 'text200') {
        for (const child of page.frames().slice(1))
          await child.addStyleTag({ content: 'body { font-size: 30px !important; }' })
      }
      await page.waitForTimeout(300)
      if (id === 'crrt') {
        const heading = page.locator('[data-now-card] h2').first()
        await expect(heading).toBeVisible()
        expect(await uncovered(heading)).toBe(true)
        expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual((await band(page)).top)
      }
      const initial = await geometry(control, visuals)
      await page.screenshot({ path: info.outputPath('entry.png') })
      // At ordinary desktop/laptop entry some of the principal visual must be discoverable.
      if (variant.width >= 1024 && variant.name !== 'text200') {
        expect(initial.visuals[0].y).toBeLessThan((await band(page)).bottom)
        expect(initial.visuals[0].y + initial.visuals[0].height).toBeGreaterThan(
          (await band(page)).top,
        )
      }
      await control.focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      await expect(control).toBeFocused()
      await settleScroll(page)
      expect(await uncovered(control)).toBe(true)
      const keyboard = await geometry(control, visuals)
      await positionWorkbench(page, control, visuals)
      const paired = await geometry(control, visuals)
      const clear = await band(page)
      if (variant.width >= 1024 && variant.name !== 'text200') {
        expect(paired.top).toBeGreaterThanOrEqual(clear.top)
        expect(paired.bottom).toBeLessThanOrEqual(clear.bottom)
      }
      // On compact screens the intentionally scrollable CRRT schematic retains its readable
      // width. Adjacency is measured vertically; the document itself must never overflow.
      expect(paired.span).toBeLessThan(variant.name === 'text200' ? 780 : 680)
      await page.screenshot({ path: info.outputPath('paired-before.png') })
      const pixels = await visiblePixels(page, output)
      const beforeScroll = await page.evaluate(() => scrollY)
      if (id === 'pi' || id === 'ebus') {
        const before = await control.inputValue()
        await control.press(Number(before) === 0 ? 'End' : 'Home')
        await expect(control).not.toHaveValue(before)
        if (id === 'ebus')
          await expect
            .poll(() =>
              frame
                .locator('.recorded-current video')
                .evaluate((v: HTMLVideoElement) => v.readyState),
            )
            .toBeGreaterThanOrEqual(2)
      } else if (id === 'bf') {
        const readout = page
          .locator('dt')
          .filter({ hasText: /^Insertion depth$/ })
          .locator('..')
        const before = await readout.innerText()
        await control.press('Enter')
        await expect(readout).not.toHaveText(before)
      } else {
        await control.press('Space')
        await expect(control).toHaveAttribute('aria-pressed', 'true')
        await expect(output).toHaveAttribute('data-overlay', 'cvvhd')
      }
      await expect.poll(async () => (await visiblePixels(page, output)).equals(pixels)).toBe(false)
      expect(await page.evaluate(() => scrollY)).toBe(beforeScroll)
      expect(await uncovered(control)).toBe(true)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1)
      if (id === 'ebus') {
        expect(
          await frame
            .locator('body')
            .evaluate(() => document.documentElement.scrollHeight - innerHeight),
        ).toBeLessThanOrEqual(2)
      }
      await page.screenshot({ path: info.outputPath('paired-after.png') })
      await info.attach('geometry', {
        body: JSON.stringify(
          {
            id,
            variant,
            initial,
            keyboard,
            paired,
            clear,
            after: await geometry(control, visuals),
          },
          null,
          2,
        ),
        contentType: 'application/json',
      })
      expect(errors).toEqual([])
    })
  }
}

const entryRoutes = [
  '/en/bronchoscopy-foundations',
  '/en/peripheral-imaging',
  '/en/learn/anatomy/branch-tracing',
  '/en/ebus-guided',
  '/en/cardiohelp-ecmo',
  '/en/baxter-crrt',
  '/en/icu-hemodynamics',
  '/en/mechanical-ventilation',
  '/en/mechanical-circulatory-support',
]
test('all nine public entry routes retain their anonymous entry and navigation', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const route of entryRoutes) {
    const response = await page.goto(route)
    expect(response?.status(), route).toBe(200)
    expect(new URL(page.url()).pathname, route).toBe(route)
    await expect(page.locator('h1').first()).toBeVisible()
    expect(
      await page.getByRole('link', { name: /Learn|Start|Continue/ }).count(),
      route,
    ).toBeGreaterThan(0)
  }
  expect(errors).toEqual([])
})

test('EBUS keeps recorded comparisons, freeze/calipers/save and self-paced unavailable checks truthful', async ({
  page,
}, info) => {
  const frame = () => page.frameLocator('iframe[title="EBUS workbench"]')
  await page.goto('/en/ebus-guided/learn?section=gain-contrast')
  const baseline = frame().locator('[data-recorded-baseline]')
  await expect(baseline).toBeVisible()
  const retained = await baseline.getAttribute('src')
  const gain = frame().getByRole('slider', { name: 'Image gain' })
  await expect(gain).toBeEnabled()
  await gain.press('End')
  await expect(gain).toHaveValue((await gain.getAttribute('max'))!)
  await expect(baseline).toHaveAttribute('src', retained!)
  const contrast = frame().getByRole('slider', { name: 'Image contrast' })
  await expect(contrast).toBeEnabled()
  const beforeContrast = await contrast.inputValue()
  await contrast.press(Number(beforeContrast) ? 'Home' : 'End')
  await expect(contrast).not.toHaveValue(beforeContrast)
  await frame().getByRole('button', { name: 'Keep this image for comparison' }).click()
  await expect(baseline).not.toHaveAttribute('src', retained!)

  await page.goto('/en/ebus-guided/learn?section=doppler')
  const doppler = frame().getByRole('button', { name: 'Color Doppler', exact: true })
  await expect(doppler).toBeEnabled()
  const pressed = await doppler.getAttribute('aria-pressed')
  await doppler.press('Space')
  await expect(doppler).toHaveAttribute('aria-pressed', pressed === 'true' ? 'false' : 'true')

  await page.goto('/en/ebus-guided/learn?section=capture')
  await frame().getByRole('button', { name: 'Freeze image', exact: true }).click()
  await expect(frame().getByRole('button', { name: 'Play clip', exact: true })).toBeDisabled()
  const save = frame().getByRole('button', { name: 'Save image', exact: true })
  await expect(save).toBeDisabled()
  await frame().getByRole('button', { name: 'Measure', exact: true }).click()
  await frame().getByRole('button', { name: 'Left', exact: true }).press('Enter')
  await frame().getByRole('button', { name: 'Set first caliper', exact: true }).click()
  await frame().getByRole('button', { name: 'Right', exact: true }).press('Enter')
  await frame().getByRole('button', { name: 'Right', exact: true }).press('Enter')
  await expect(save).toBeEnabled()
  await save.click()
  await expect(
    frame().getByRole('img', { name: 'Saved teaching image with the calipers you placed' }),
  ).toBeVisible()
  await page.screenshot({ path: info.outputPath('capture.png') })

  await page.goto(routes.ebus)
  await page.locator('[data-now-primary]').click() // prediction
  await page.locator('[data-now-primary]').click() // continue without answering
  await page.getByRole('button', { name: 'Continue without an image', exact: true }).click()
  const radios = page.getByRole('radio')
  expect(await radios.count()).toBeGreaterThan(0)
  for (const radio of await radios.all()) await expect(radio).toBeDisabled()
  await expect(page.locator('[data-question-unavailable]')).toContainText('No image is held')
  expect(
    await radios
      .first()
      .locator('..')
      .evaluate((el) => getComputedStyle(el).cursor),
  ).toBe('default')
  await page.screenshot({ path: info.outputPath('unavailable-answer.png') })
  await page.getByRole('button', { name: 'Show explanation', exact: true }).click()
  await page.locator('[data-now-primary]').click()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Compare the displayed fields', exact: true }),
  ).toBeVisible()
})

test('CRRT fixed anticoagulation selector explains its native disabled state', async ({
  page,
}, info) => {
  await page.goto('/en/baxter-crrt/learn?lesson=crrt-prescription-dosing')
  await page.getByText('Explanation, sources and limits', { exact: true }).click()
  await page.getByText('Free calculation reference', { exact: true }).click()
  await page.getByRole('button', { name: /Continue to Construction/ }).click()
  const fixed = page.getByRole('combobox', { name: 'Anticoagulation approach' })
  await expect(fixed).toBeDisabled()
  await expect(fixed).toHaveValue('none')
  await expect(fixed).toHaveAccessibleDescription(/This setting is fixed in this exercise/)
  await fixed.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('fixed-selector.png') })
})

for (const id of ['mv', 'mcs'] as const) {
  for (const variant of variants) {
    test(`${id}: document flow and self-paced controls — ${variant.name}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(variant)
      await page.goto(
        id === 'mv'
          ? '/en/mechanical-ventilation/learn?activity=ventilation-and-co2'
          : '/en/mechanical-circulatory-support/learn?lesson=iabp-timing-triggering',
      )
      await expect(page.locator('[data-learning-document-flow]')).toBeVisible()
      if (variant.name === 'text200')
        await page.addStyleTag({ content: 'html { font-size:200% !important }' })
      await settleScroll(page)
      await page.screenshot({ path: info.outputPath('entry.png') })
      const before = await page.evaluate(() => ({
        y: scrollY,
        height: document.documentElement.scrollHeight,
      }))
      await page.mouse.move(4, variant.height / 2)
      await page.mouse.wheel(0, 350)
      await settleScroll(page)
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(before.y)
      await page.screenshot({ path: info.outputPath('wheel.png') })
      if (id === 'mv') {
        const rate = page.getByRole('slider', { name: 'Rate', exact: true })
        await rate.scrollIntoViewIfNeeded()
        await rate.focus()
        await settleScroll(page)
        expect(await uncovered(rate)).toBe(true)
        const readings = page.locator('[data-live-readings]')
        const deliveredRate = readings.locator('[data-metric="rate"]')
        const beforeReading = await deliveredRate.innerText()
        await positionWorkbench(page, rate, [readings])
        const pair = await geometry(rate, [readings])
        const clear = await band(page)
        if (variant.width >= 1024 && variant.name !== 'text200') {
          expect(pair.top).toBeGreaterThanOrEqual(clear.top)
          expect(pair.bottom).toBeLessThanOrEqual(clear.bottom)
        }
        await page.screenshot({ path: info.outputPath('paired-before.png') })
        const beforeChangeScroll = await page.evaluate(() => scrollY)
        const oldRate = await rate.inputValue()
        await rate.press('ArrowRight')
        await expect(rate).not.toHaveValue(oldRate)
        await expect(deliveredRate).not.toHaveText(beforeReading)
        expect(await page.evaluate(() => scrollY)).toBe(beforeChangeScroll)
        await page.screenshot({ path: info.outputPath('paired-after.png') })
        await info.attach('geometry', {
          body: JSON.stringify({ id, variant, paired: pair, clear }),
          contentType: 'application/json',
        })
        await page.getByRole('button', { name: 'Advance one breath', exact: true }).click()
        const step = page.getByRole('combobox', { name: 'Choose step', exact: true })
        await step.selectOption('1')
        await expect(step).toHaveValue('1')
        await page.getByRole('button', { name: 'Restart section', exact: true }).click()
        await expect(step).toHaveValue('0')
      } else {
        const stage = page.locator('[data-mcs-task-flow]')
        const previous = await stage.getAttribute('data-stage')
        await page.locator('[data-now-primary]').press('Enter')
        await expect(stage).not.toHaveAttribute('data-stage', previous!)
        await page.getByRole('button', { name: 'Show explanation', exact: true }).click()
        await page.reload()
        await expect(stage).toHaveAttribute('data-stage', previous!)
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1)
      await info.attach('scroll-owner', {
        body: JSON.stringify({
          before,
          after: await page.evaluate(() => ({
            y: scrollY,
            overflow: getComputedStyle(document.body).overflowY,
          })),
        }),
        contentType: 'application/json',
      })
    })
  }
}
