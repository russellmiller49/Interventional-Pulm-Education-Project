import { expect, test, type FrameLocator, type Page } from '@playwright/test'

/**
 * EBUS-PRE-REVIEW-03 regressions, driven through the real host and embedded app. Bridge events
 * are read from the host window; nothing is seeded. Run against the built site
 * (`EBUS_E2E_BASE_URL` or the config's baseURL).
 */
const base = process.env.EBUS_E2E_BASE_URL ?? ''
const setRange = (el: HTMLInputElement, v: number) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v))
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
async function openLesson(page: Page, id: string, until: 'live' | 'demonstration') {
  await page.addInitScript(() => {
    ;(window as unknown as { __ebusEvents: unknown[] }).__ebusEvents = []
    window.addEventListener('message', (e) => {
      if (e.origin === location.origin && e.data?.type === 'observation')
        (window as unknown as { __ebusEvents: unknown[] }).__ebusEvents.push(e.data)
    })
  })
  await page.goto(`${base}/en/ebus-guided/learn?section=${id}`)
  for (let i = 0; i < 8; i++) {
    if ((await page.locator(`[data-evidence-identity="${until}"]`).count()) > 0) break
    await page.locator('[data-now-primary]').click()
    await page.waitForTimeout(300)
  }
  await expect(page.locator(`[data-evidence-identity="${until}"]`)).toBeVisible()
  return page.frameLocator('iframe[title="EBUS workbench"]')
}
const latest = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as { __ebusEvents: { observation: Record<string, unknown> }[] }
      ).__ebusEvents.at(-1)?.observation as
        | {
            roll: number
            frameReady: boolean
            targetVisible: boolean
            actionCount: number
            linked?: {
              assetsReady: boolean
              approach: string
              sweeps?: Record<string, { phase: string; samples: number; span: number }>
            }
          }
        | undefined,
  )
async function ready(page: Page) {
  await expect
    .poll(
      async () => {
        const o = await latest(page)
        return !!o?.frameReady && !!o.linked?.assetsReady
      },
      { timeout: 90000 },
    )
    .toBe(true)
}
async function setRoll(page: Page, f: FrameLocator, roll: number) {
  await f.getByRole('slider', { name: 'Scope rotation' }).evaluate(setRange, roll)
  await expect
    .poll(async () => (await latest(page))?.roll === roll && (await latest(page))?.frameReady, {
      timeout: 10000,
    })
    .toBe(true)
}
async function sweepTo(page: Page, f: FrameLocator, to: number, step: number) {
  let roll = (await latest(page))!.roll
  const dir = Math.sign(to - roll)
  while (roll !== to) {
    roll += dir * Math.min(step, Math.abs(to - roll))
    await setRoll(page, f, roll)
  }
}

test.describe('landmark markers', () => {
  test('lesson 3 markers keep their column across rotation, hover and focus identify one structure, names are optional', async ({
    page,
  }) => {
    const f = await openLesson(page, 'scope-orientation', 'live')
    await ready(page)
    const letters = f.locator('.linked-structure-letter:not([hidden])')
    await expect(letters).toHaveCount(4)
    const sideOf = async () =>
      letters.evaluateAll(
        (els, width) =>
          els.map((b) => [
            b.querySelector('.linked-structure-glyph')!.textContent,
            parseFloat((b as HTMLElement).style.left) < width / 2 ? 'left' : 'right',
          ]),
        await f.locator('.linked-canvas').evaluate((c) => c.clientWidth),
      )
    const before = await sideOf()
    for (const roll of [40, 0, -40, -85]) await setRoll(page, f, roll)
    expect(await sideOf()).toEqual(before)
    // Hover a letter: its structure is highlighted (letter and leader carry the same state).
    const a = letters.first()
    await a.hover()
    await expect(a).toHaveClass(/is-hovered/)
    await expect(f.locator('.linked-structure-callouts circle.is-hovered')).toHaveCount(1)
    await a.focus()
    await expect(a).toHaveClass(/is-hovered/)
    await page.keyboard.press('Enter')
    await expect(a).toHaveAttribute('aria-pressed', 'true')
    await expect(f.locator('.linked-selection')).toContainText('highlighted in violet')
    await expect
      .poll(async () => (await latest(page))?.linked?.selectedStructure ?? '')
      .toMatch(/./)
    await f.locator('[data-structure-names]').click()
    await expect(a).toHaveAttribute('aria-label', /Structure A: .+/)
    await expect(letters.first().locator('.linked-structure-name')).not.toBeEmpty()
  })
  test('lesson 4 has no landmark task and shows no letters', async ({ page }) => {
    const f = await openLesson(page, 'acoustic-contact', 'live')
    await ready(page)
    await expect(f.locator('.linked-structure-callouts')).toBeHidden()
    await expect(f.locator('.linked-contact-comparison .guided-label').first()).toContainText(
      'bright band is the airway wall',
    )
  })
})

test.describe('camera and scrolling', () => {
  test('the wheel scrolls the page until the model is engaged, and Escape releases it', async ({
    page,
  }) => {
    const f = await openLesson(page, 'scope-orientation', 'live')
    await ready(page)
    const canvas = f.locator('.linked-canvas canvas')
    await expect(canvas).toHaveAttribute('data-engaged', 'false')
    expect(await canvas.evaluate((c) => getComputedStyle(c).touchAction)).toBe('pan-y')
    await canvas.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -160))
    const box = (await canvas.boundingBox())!
    const before = await page.evaluate(() => window.scrollY)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, 240)
    await expect.poll(() => page.evaluate(() => window.scrollY)).not.toBe(before)
    const box2 = (await canvas.boundingBox())!
    await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2)
    await expect(canvas).toHaveAttribute('data-engaged', 'true')
    expect(await canvas.evaluate((c) => getComputedStyle(c).touchAction)).toBe('none')
    const engagedBefore = await page.evaluate(() => window.scrollY)
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2)
    await page.mouse.wheel(0, 240)
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => window.scrollY)).toBe(engagedBefore)
    await page.keyboard.press('Escape')
    await expect(canvas).toHaveAttribute('data-engaged', 'false')
    await expect(f.getByRole('button', { name: 'Zoom in' })).toBeVisible()
    await expect(f.locator('[data-observer-caption]')).not.toContainText('scroll to zoom')
  })
  test('lesson 19 arrows are legible and the model is labelled', async ({ page }) => {
    const f = await openLesson(page, 'eus-b-route-model', 'live')
    const viewport = f.locator('.model-viewport')
    await expect(viewport).toHaveAttribute('data-arrow-px', /.+/, { timeout: 60000 })
    for (const [station, route] of [
      ['4L', 'airway'],
      ['7', 'airway'],
      ['7', 'esophagus'],
      ['4L', 'esophagus'],
    ] as const) {
      await f.getByLabel('Target / region').selectOption(station)
      await f.getByLabel('Approach').selectOption(route)
      await expect
        .poll(async () => Number(await viewport.getAttribute('data-arrow-px')))
        .toBeGreaterThan(40)
    }
    await expect(
      f.locator('.model-viewport .linked-structure-name').filter({ hasText: /esophagus/ }),
    ).toHaveCount(1)
    await expect(
      f.locator('.model-viewport .linked-structure-name').filter({ hasText: /aorta/ }),
    ).toHaveCount(1)
    await expect(f.locator('.model-image .model-caption').first()).toContainText(
      'shows viewing direction only',
    )
  })
})

test.describe('sweep state', () => {
  test('the seven journeys are reported truthfully from real events', async ({ page }) => {
    const f = await openLesson(page, 'station-seven', 'live')
    await ready(page)
    const panel = f.locator('.linked-sweep')
    // J2: default start inside the target from the left main bronchus.
    await f.getByRole('button', { name: /Left main bronchus/ }).click()
    await ready(page)
    await expect(panel).toHaveAttribute('data-sweep-in-plane', 'true')
    await expect(panel).toHaveAttribute('data-sweep-state', 'inside-start')
    await sweepTo(page, f, 60, 5)
    await expect(panel).toHaveAttribute('data-sweep-state', 'inside-start')
    expect((await latest(page))!.linked!.sweeps!.lms.samples).toBe(0)
    // J2b: leave, then return — the pass starts.
    await sweepTo(page, f, -70, 10)
    await expect(panel).toHaveAttribute('data-sweep-state', 'outside')
    await sweepTo(page, f, -50, 5)
    await expect(panel).toHaveAttribute('data-sweep-state', 'crossing')
    await expect(panel.locator('[data-sweep-progress]')).toContainText(
      'paused frames with the target',
    )
    // J4: jump into the target from outside (right main bronchus).
    await f.getByRole('button', { name: /Right main bronchus/ }).click()
    await ready(page)
    await expect(panel).toHaveAttribute('data-sweep-in-plane', 'false')
    await setRoll(page, f, 80)
    await expect(panel).toHaveAttribute('data-sweep-state', 'outside')
    await setRoll(page, f, 30)
    await expect(panel).toHaveAttribute('data-sweep-state', 'entered-too-fast')
    // J3: reverse partway.
    await sweepTo(page, f, 85, 10)
    await sweepTo(page, f, 20, 10)
    await expect(panel).toHaveAttribute('data-sweep-state', 'crossing')
    await sweepTo(page, f, 30, 10)
    await expect(panel.locator('[data-sweep-reset-reason]')).toContainText('direction reversed')
    // J1: outside → cross → exit.
    await sweepTo(page, f, 85, 10)
    await sweepTo(page, f, -80, 10)
    await expect(panel).toHaveAttribute('data-sweep-state', 'complete')
    expect((await latest(page))!.linked!.sweeps!.rms).toMatchObject({
      phase: 'complete',
      samples: 12,
      span: 110,
    })
    // J5: reset clears everything and starts a new session.
    await f.getByRole('button', { name: 'Reset acquisition' }).click()
    await ready(page)
    expect((await latest(page))!.actionCount).toBe(0)
    expect((await latest(page))!.linked!.sweeps).toEqual({})
    // J7: skip holds nothing.
    await page.locator('[data-skip-acquisition]').click()
    await expect(page.locator('[data-evidence-identity="held-missing"]')).toBeVisible()
  })
  test('a demonstration collects no learner samples and the real attempt starts empty', async ({
    page,
  }) => {
    const f = await openLesson(page, 'station-seven', 'demonstration')
    await expect(f.locator('.linked-sweep')).toHaveCount(0)
    const slider = f.getByRole('slider', { name: 'Scope rotation' })
    await expect(slider).toBeVisible({ timeout: 60000 })
    for (const v of [60, 30, 0]) {
      await slider.evaluate(setRange, v)
      await page.waitForTimeout(300)
    }
    for (
      let i = 0;
      i < 4 && (await page.locator('[data-evidence-identity="live"]').count()) === 0;
      i++
    ) {
      await page.locator('[data-now-primary]').click()
      await page.waitForTimeout(300)
    }
    await ready(page)
    const first = (await latest(page))!
    expect(first.actionCount).toBe(0)
    expect(first.linked!.sweeps).toEqual({})
  })
})
