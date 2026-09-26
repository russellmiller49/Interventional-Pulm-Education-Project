import { expect, test, type Page } from '@playwright/test'

/**
 * MCS-PRE-REVIEW-03 — visual workbench and accessibility, measured in a real browser.
 *
 * Every check reads rendered geometry, computed style or keyboard behaviour: where the controls a
 * step needs are, whether labels collide, whether a trend stays out of its caption, whether a radio
 * reads as its state, whether the Sections drawer reaches its ninth entry, whether a phone or 200%
 * text pushes anything off the side. Run it against a dev or production server:
 *
 *   MCS_E2E_BASE_URL=http://localhost:3122 npx playwright test e2e/mcs-pre-review-03.spec.ts
 *
 * The jsdom contracts are in `mcs-pre-review-03*.test.tsx` beside the feature.
 */

test.use({ baseURL: process.env.MCS_E2E_BASE_URL ?? 'http://127.0.0.1:3001' })

const MCS = '/en/mechanical-circulatory-support'

test.beforeEach(async ({ page }) => {
  // Isolated verification has no account backend; the model and local progress stay real.
  await page.route('**/api/analytics**', (route) => route.fulfill({ status: 204, body: '' }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

async function enlargeText(page: Page) {
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
    .toBe('32px')
}

async function openLesson(page: Page, lesson: string, continues = 0) {
  await page.goto(`${MCS}/learn?lesson=${lesson}`)
  await page.waitForSelector('[data-now-card], [data-prerequisite-reference]')
  const reference = page.locator('[data-prerequisite-reference] button', {
    hasText: 'Continue to the model',
  })
  if (await reference.count()) await reference.click()
  await expect(page.locator('[data-now-card]')).toBeVisible()
  for (let index = 0; index < continues; index += 1) {
    await page.locator('[data-now-primary]').click()
    await page.waitForTimeout(400)
  }
}

async function documentOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
}

/* ------------------------------------------------------------------ F03 */

for (const size of [
  { width: 1204, height: 987 },
  { width: 1280, height: 800 },
]) {
  test(`F03 · on arrival at ${size.width}×${size.height}, Continue is on screen and Save & exit is secondary`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await openLesson(page, 'mcs-foundations-signals')
    await page.evaluate(() => window.scrollTo(0, 0))
    const top = page.locator('[data-step-bar-continue]')
    await expect(top).toBeInViewport()
    const paint = await page.evaluate(() => ({
      continueBg: getComputedStyle(document.querySelector('[data-step-bar-continue]')!)
        .backgroundColor,
      saveBg: getComputedStyle(document.querySelector('[data-stage-save-exit]')!).backgroundColor,
      identity: document.querySelector('[data-session-identity]')!.textContent,
    }))
    expect(paint.saveBg).toBe('rgba(0, 0, 0, 0)')
    expect(paint.continueBg).not.toBe('rgba(0, 0, 0, 0)')
    expect(paint.identity).not.toMatch(/seed \d+/i)
  })
}

test('F03 · a step that says "Look here" at the monitor opens it', async ({ page }) => {
  await openLesson(page, 'iabp-efficacy-limits', 1)
  await expect(page.getByText(/^Look here:/).first()).toBeVisible()
  await expect(
    page.getByRole('region', { name: /Synchronized mechanical-support bedside monitor/ }),
  ).toBeVisible()
})

/* ------------------------------------------------------------------ F04 / F20 / F34 */

test('F34 · the trend stays out of the caption under it, and the PV display is on a phone too', async ({
  page,
}) => {
  await page.goto(`${MCS}/practice?case=IABP-01`)
  const monitor = page.getByRole('region', {
    name: /Synchronized mechanical-support bedside monitor/,
  })
  await expect(monitor).toBeVisible()
  const gap = await monitor.evaluate((node) => {
    const caption = [...node.querySelectorAll('p')].find((p) =>
      /Why the display changed/.test(p.textContent ?? ''),
    )!
    const lines = [...node.querySelectorAll('[data-series]')].map((path) =>
      path.getBoundingClientRect(),
    )
    return caption.getBoundingClientRect().top - Math.max(...lines.map((line) => line.bottom))
  })
  expect(gap).toBeGreaterThanOrEqual(0)
  await page.setViewportSize({ width: 390, height: 844 })
  const pv = page.locator('[data-pv-display]')
  await pv.scrollIntoViewIfNeeded()
  await expect(pv).toBeVisible()
  expect((await pv.boundingBox())!.height).toBeGreaterThan(150)
})

/* ------------------------------------------------------------------ F05 */

for (const lesson of [
  'mcs-foundations-signals',
  'impella-unloading-placement',
  'impella-suction-purge-rv',
  'lvad-parameters-assessment',
]) {
  test(`F05 · ${lesson}: no two labels on the map overlap and no vessel halo is filled`, async ({
    page,
  }) => {
    await openLesson(page, lesson)
    const map = page.locator('[data-circulation-map]').first()
    await map.evaluate((node) => {
      for (
        let details = node.closest('details');
        details;
        details = details.parentElement?.closest('details') ?? null
      )
        details.open = true
    })
    await map.scrollIntoViewIfNeeded()
    const result = await map.evaluate((node) => {
      const boxes = [...node.querySelectorAll('svg text')]
        .map((text) => ({ text: text.textContent, rect: text.getBoundingClientRect() }))
        .filter((box) => box.rect.width > 0)
      const overlaps: string[] = []
      for (let a = 0; a < boxes.length; a += 1)
        for (let b = a + 1; b < boxes.length; b += 1) {
          const [p, q] = [boxes[a].rect, boxes[b].rect]
          if (p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom)
            overlaps.push(`${boxes[a].text} × ${boxes[b].text}`)
        }
      // A vessel's halo is a path (chambers are rects, organs ellipses); a filled open path is
      // the phantom wedge.
      const filledVessels = [...node.querySelectorAll('[data-map-emphasis-target] > path')]
        .map((shape) => getComputedStyle(shape).fill)
        .filter((fill) => fill !== 'none')
      return { overlaps, filledVessels }
    })
    expect(result.overlaps).toEqual([])
    expect(result.filledVessels).toEqual([])
  })
}

/* ------------------------------------------------------------------ F32 */

test('F32 · stage radios read as their state and move with the arrow keys', async ({ page }) => {
  await openLesson(page, 'iabp-efficacy-limits', 1)
  const radios = page.locator('fieldset[data-prediction-choices] input[type="radio"]')
  await radios.nth(0).focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowDown')
  await expect(radios.nth(1)).toBeChecked()
  await expect(radios.nth(0)).not.toBeChecked()
  const paint = await radios.evaluateAll((inputs) =>
    inputs.map((input) => ({
      checked: (input as HTMLInputElement).checked,
      dot: getComputedStyle(input, '::before').transform,
      outline: document.activeElement === input ? getComputedStyle(input).outlineStyle : null,
    })),
  )
  for (const radio of paint) {
    if (radio.checked) expect(radio.dot).not.toBe('matrix(0, 0, 0, 0, 0, 0)')
    else expect(radio.dot).toBe('matrix(0, 0, 0, 0, 0, 0)')
  }
  expect(paint.find((radio) => radio.checked)?.outline).toBe('solid')
})

test('F32 · case radios read as their state in a dark browser', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.addInitScript(() => window.localStorage.setItem('theme', 'dark'))
  await page.goto(`${MCS}/practice?case=IABP-01`, { waitUntil: 'load' })
  const group = page.getByRole('group', { name: /Optional prediction/ })
  const radios = group.getByRole('radio')
  // A click before hydration is undone by React; select until the controlled state holds.
  await expect(async () => {
    await radios.nth(1).check()
    await expect(radios.nth(1)).toBeChecked()
  }).toPass()
  await expect
    .poll(() =>
      radios.evaluateAll((inputs) =>
        inputs.map(
          (input) =>
            (input as HTMLInputElement).checked ===
            (getComputedStyle(input, '::before').transform !== 'matrix(0, 0, 0, 0, 0, 0)'),
        ),
      ),
    )
    .toEqual([true, true, true])
})

/* ------------------------------------------------------------------ F33 */

test('F33 · the worked explanation uses the card, side by side on a desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`${MCS}/practice?case=IABP-01`)
  await page.getByRole('button', { name: 'Open worked explanation' }).click()
  const layout = await page.locator('[data-worked-explanation]').evaluate((card) => {
    const width = card.getBoundingClientRect().width
    const blocks = ['teaching', 'conditions', 'run'].map((name) =>
      card.querySelector(`[data-debrief-${name}]`)!.getBoundingClientRect(),
    )
    return {
      share: blocks.reduce((sum, block) => sum + block.width, 0) / width,
      sideBySide: Math.abs(blocks[0].top - blocks[1].top) < 2,
    }
  })
  expect(layout.share).toBeGreaterThan(0.8)
  expect(layout.sideBySide).toBe(true)
})

/* ------------------------------------------------------------------ F37 */

for (const size of [
  { width: 1204, height: 987 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
  { width: 390, height: 844, text200: true },
]) {
  test(`F37 · the Sections drawer reaches all nine by keyboard at ${size.width}×${size.height}${size.text200 ? ' with 200% text' : ''}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: size.width, height: size.height })
    await openLesson(page, 'mcs-foundations-signals')
    if (size.text200) await enlargeText(page)
    const summary = page.locator('[data-sections-drawer] summary')
    await summary.focus()
    await page.keyboard.press('Enter')
    const entries = page.locator('[data-sections-drawer] li button')
    await expect(entries).toHaveCount(9)
    for (let index = 0; index < 9; index += 1) await page.keyboard.press('Tab')
    await expect(entries.nth(8)).toBeFocused()
    await expect(entries.nth(8)).toBeInViewport()
    const broken = await page.locator('[data-sections-drawer]').evaluate((drawer) => {
      const split: string[] = []
      for (const node of drawer.querySelectorAll('li button strong, li button small')) {
        const text = node.firstChild
        if (!text || text.nodeType !== Node.TEXT_NODE) continue
        let from = 0
        for (const word of (text.textContent ?? '').split(/\s+/)) {
          const at = (text.textContent ?? '').indexOf(word, from)
          from = at + word.length
          if (!word) continue
          const range = document.createRange()
          range.setStart(text, at)
          range.setEnd(text, at + word.length)
          if ([...range.getClientRects()].filter((rect) => rect.width > 0).length > 1)
            split.push(word)
        }
      }
      return split
    })
    expect(broken).toEqual([])
    await page.keyboard.press('Escape')
    await expect(summary).toBeFocused()
    expect(
      await page.locator('[data-sections-drawer]').evaluate((d) => (d as HTMLDetailsElement).open),
    ).toBe(false)
  })
}

/* ------------------------------------------------------------------ F31 / F38 */

for (const size of [
  { width: 1204, height: 987 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
]) {
  test(`F31/F38 · the case page at ${size.width}×${size.height}: nothing covers the context, all six phases, no sticky footer`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await page.goto(`${MCS}/practice?case=IABP-01`)
    await expect(page.locator('[data-case-workflow]')).toBeVisible()
    const layout = await page.evaluate(() => {
      const shell = document.querySelector('[data-critical-care-activity-shell]')!
      const trigger = [...shell.querySelectorAll('summary')].find((summary) =>
        summary.textContent?.includes('Current task'),
      )!
      const t = trigger.getBoundingClientRect()
      const context = shell.querySelector('section[aria-label="Clinical context"]')!
      const covered = [...context.querySelectorAll('dt, dd, h2, h3, li, p')]
        .map((node) => ({ node, rect: node.getBoundingClientRect() }))
        .filter(
          ({ rect }) =>
            rect.width > 0 &&
            rect.left < t.right &&
            t.left < rect.right &&
            rect.top < t.bottom &&
            t.top < rect.bottom,
        )
        .map(({ node }) => node.textContent)
      const phases = [...shell.querySelectorAll('header ol > li')].filter((li) => {
        const rect = li.getBoundingClientRect()
        return rect.left >= 0 && rect.right <= window.innerWidth + 1
      }).length
      const footer = shell.querySelector(':scope > footer')!
      return { covered, phases, footer: getComputedStyle(footer).position }
    })
    expect(layout.covered).toEqual([])
    expect(layout.phases).toBe(6)
    expect(['static', 'relative']).toContain(layout.footer)
    expect(await documentOverflow(page)).toBeLessThanOrEqual(0)
  })
}

test('F31 · the case jump links look like and behave as links', async ({ page }) => {
  await page.goto(`${MCS}/practice?case=IABP-01`)
  const nav = page.getByRole('navigation', { name: 'Parts of this case' })
  const links = nav.getByRole('link')
  await expect(links).toHaveCount(4)
  expect(await links.first().evaluate((a) => getComputedStyle(a).textDecorationLine)).toBe(
    'underline',
  )
})

/* ------------------------------------------------------------------ F38 · 200% text */

for (const [name, open] of [
  ['Section 1 walk', (page: Page) => openLesson(page, 'mcs-foundations-signals', 1)],
  ['Section 4 predict', (page: Page) => openLesson(page, 'iabp-efficacy-limits', 1)],
  [
    'Section 5 unloading example',
    (page: Page) => openLesson(page, 'impella-unloading-placement', 1),
  ],
  ['Section 9 recognize', (page: Page) => openLesson(page, 'mcs-device-selection-integration')],
  ['case IABP-01', (page: Page) => page.goto(`${MCS}/practice?case=IABP-01`).then(() => undefined)],
] as const) {
  test(`F38 · ${name} at 390×844 with 200% text has no sideways overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await open(page)
    await enlargeText(page)
    await page.waitForTimeout(500)
    expect(await documentOverflow(page)).toBeLessThanOrEqual(0)
  })
}

/* ------------------------------------------------------------------ state */

test('presentation leaves the model alone: theme, resize, disclosures, drawer and focus', async ({
  page,
}) => {
  await openLesson(page, 'iabp-efficacy-limits', 1)
  const playback = page.locator('details:has(> summary:text-is("Display playback"))')
  await playback.locator('summary').click()
  const pause = playback.getByRole('button', { name: 'Pause display playback' })
  if (await pause.count()) await pause.click()
  await expect(playback.getByRole('button', { name: 'Play display playback' })).toBeVisible()
  await page.locator('fieldset[data-prediction-choices] input[type="radio"]').nth(2).check()
  const read = () =>
    page.evaluate(() => ({
      identity: document.querySelector('[data-session-identity]')?.textContent,
      step: document
        .querySelector('[data-critical-care-activity-shell]')
        ?.getAttribute('data-stage'),
      checked: [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked')].map(
        (input) => input.value,
      ),
      stored: JSON.stringify({ ...window.localStorage }),
    }))
  const before = await read()
  // The application's own theme toggle, twice.
  const themeToggle = page.getByRole('button', { name: /theme|dark|light/i }).first()
  if (await themeToggle.count()) {
    await themeToggle.click()
    await themeToggle.click()
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.setViewportSize({ width: 1280, height: 800 })
  const monitor = page.locator('[data-monitor-disclosure] > summary')
  await monitor.click()
  await monitor.click()
  await page.locator('[data-run-details] > summary').click()
  await page.locator('[data-sections-drawer] summary').click()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  const after = await read()
  expect({ ...after, stored: undefined }).toEqual({ ...before, stored: undefined })
  // The theme toggle writes its own preference; nothing else may change what is stored.
  const strip = (value: string) => {
    const parsed = JSON.parse(value) as Record<string, string>
    delete parsed.theme
    return parsed
  }
  expect(strip(after.stored)).toEqual(strip(before.stored))
})
