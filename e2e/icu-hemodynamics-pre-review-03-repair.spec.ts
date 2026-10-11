import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { writeFileSync } from 'node:fs'

/**
 * HD-PRE-REVIEW-03 — the sanity-review repair, in real Chromium.
 *
 * The independent review of PR #326 found four defects. Three are asserted from the DOM in
 * `hd-pre-review-03-sanity-repair.test.tsx`; here they are driven through the page's own controls,
 * and the fourth — the Practice case overflowing a 390 px window at 200 % root text — is measured,
 * because only a browser lays the page out.
 *
 * Every journey marked "fails before the repair" was run against the reviewed tree and failed there
 * on the assertion named in its comment.
 *
 * "Root text" is CSS `font-size` on the root element. It is not native browser zoom.
 */

test.use({ channel: 'chromium' })

const consoleErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  consoleErrors.set(page, errors)
  page.on('console', (message) => {
    // `/api/analytics` answers 500 in a checkout with no analytics database; so does the base.
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) {
      errors.push(message.text().replace(/\s+/g, ' ').slice(0, 400))
    }
  })
  page.on('pageerror', (error) => errors.push(String(error).slice(0, 400)))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(consoleErrors.get(page) ?? [], 'console errors during the journey').toEqual([])
})

async function record(info: TestInfo, name: string, data: unknown) {
  const file = info.outputPath(`${name}.json`)
  writeFileSync(file, JSON.stringify(data, null, 2))
  await info.attach(name, { path: file, contentType: 'application/json' })
}

/** The theme class is set after hydration: nothing is touched before it is there. */
async function hydrated(page: Page) {
  await page.waitForFunction(() => /\b(dark|light)\b/.test(document.documentElement.className))
}

const pageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

async function rootText(page: Page, percent: 100 | 200) {
  await page.evaluate((value) => {
    document.documentElement.style.fontSize = `${value}%`
  }, percent)
  // Label layout and the container queries re-measure after the text size changes.
  await page.waitForTimeout(900)
}

/* ------------------------------------------------------------------ *
 * Practice — the populated workbench
 * ------------------------------------------------------------------ */

async function openPracticeActions(page: Page, caseId: string) {
  await page.goto(`/en/icu-hemodynamics/practice?case=${caseId}`)
  await hydrated(page)
  const checkpoints = page.getByRole('navigation', { name: 'Case checkpoints' })
  await checkpoints.getByRole('button', { name: /Choose an action/ }).click()
  await expect(page.locator('[data-case-flow]')).toHaveAttribute('data-phase', 'act')
}

async function openTool(page: Page, name: string) {
  const summary = page.locator('[aria-label="Measurement tools"] summary').filter({ hasText: name })
  if ((await summary.locator('..').getAttribute('open')) === null) await summary.click()
}

/**
 * The reviewer's journey: zero the line, open every tool, accept one thermodilution curve, give
 * fluid, and observe — a workbench with something in each part of it.
 */
async function populateAndObserve(page: Page) {
  await openTool(page, 'Pressure measurement')
  await page.getByRole('button', { name: 'Open to air + zero', exact: true }).click()
  await openTool(page, 'Catheter actions')
  await openTool(page, 'Cardiac-output trials')
  await openTool(page, 'Calculated results')
  const inject = page.locator('[class*="injectButton"]').first()
  await inject.focus()
  await page.keyboard.press('Enter')
  const card = page.locator('[class*="thermoTrialCard"]').last()
  await card.getByRole('button', { name: /Review this curve/ }).click()
  await card.getByRole('button', { name: 'Accept into the series' }).click()
  await page.locator('[data-intervention]').filter({ hasText: 'Fluid' }).first().click()
  const actions = await actionCards(page)
  await page.getByRole('button', { name: 'Observe the modeled response' }).click()
  await expect(page.locator('[data-case-flow]')).toHaveAttribute('data-phase', 'observe')
  return actions
}

/** Each action card as the learner left it: which are still offered and which are spent. */
function actionCards(page: Page) {
  return page
    .locator('[data-intervention]')
    .evaluateAll((cards) =>
      cards.map((card) => [
        card.getAttribute('data-intervention'),
        (card as HTMLButtonElement).disabled,
      ]),
    )
}

/** Everything in the case that is drawn past the window's right edge and not inside a scroller. */
async function pastTheWindow(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const insideScroller = (element: Element) => {
      for (let node = element.parentElement; node && node !== document.body; ) {
        if (getComputedStyle(node).overflowX !== 'visible') return true
        node = node.parentElement
      }
      return false
    }
    return [...document.querySelectorAll('[data-case-flow] *')]
      .filter((element) => {
        const box = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return (
          box.width > 0 &&
          box.right > width + 0.5 &&
          style.position !== 'absolute' &&
          !insideScroller(element)
        )
      })
      .map((element) => ({
        tag: element.tagName,
        text: (element.textContent ?? '').slice(0, 50),
        right: Math.round(element.getBoundingClientRect().right),
      }))
      .slice(0, 12)
  })
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 740 },
]) {
  // Fails before the repair: 161 px of page overflow at 390 px, the Return button ending at 458 px.
  test(`P-03 — the populated Practice workbench fits the window while a response is observed — ${viewport.width}×${viewport.height}, 200% root text`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1204, height: 987 })
    await openPracticeActions(page, 'HD-01')
    const actionsBefore = await populateAndObserve(page)
    const clockBefore = await page.locator('section[class*="monitor"] header time').textContent()

    await page.setViewportSize(viewport)
    await rootText(page, 200)

    const observed = {
      overflow: await pageOverflow(page),
      pastTheWindow: await pastTheWindow(page),
    }
    await record(info, 'observe', observed)
    expect(observed.overflow, 'page overflow while observing').toBeLessThanOrEqual(1)
    expect(observed.pastTheWindow).toEqual([])

    // The way back is on screen, whole, and reachable and visibly focused from the keyboard.
    const back = page.getByRole('button', { name: 'Back to actions and measurements' })
    // Arrive on it by Tab, as a keyboard user does: a scripted focus alone shows no focus ring.
    await back.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    const focused = await back.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        isFocused: document.activeElement === element,
        left: box.left,
        right: box.right,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        outlineStyle: style.outlineStyle,
      }
    })
    await record(info, 'return-button', focused)
    expect(focused.isFocused).toBe(true)
    expect(focused.left).toBeGreaterThanOrEqual(0)
    expect(focused.right).toBeLessThanOrEqual(viewport.width)
    expect(focused.outlineStyle).not.toBe('none')
    expect(focused.outlineWidth).toBeGreaterThanOrEqual(2)

    // The before-and-current table: each value under its observation, with its column named in
    // sight, and the Current value — the one this step is about — inside the window.
    const table = await page.locator('[aria-label="Retained case observations"]').evaluate((card) =>
      [...card.querySelectorAll('td')].map((cell) => ({
        label: getComputedStyle(cell, '::before').content,
        display: getComputedStyle(cell).display,
        right: cell.getBoundingClientRect().right,
        left: cell.getBoundingClientRect().left,
      })),
    )
    expect(table).toHaveLength(4)
    for (const cell of table) {
      expect(cell.display).toBe('block')
      expect(cell.label).toMatch(/Before action: |Current: /)
      expect(cell.left).toBeGreaterThanOrEqual(0)
      expect(cell.right).toBeLessThanOrEqual(viewport.width)
    }
    await expect(
      page.getByRole('table').filter({ hasText: 'Accepted thermodilution CO' }),
    ).toBeVisible()

    // The monitor's readouts each stay inside their own cell: none runs over its neighbour.
    const readouts = await page
      .locator('section[class*="monitor"] [class*="numericRail"] > div')
      .evaluateAll((cells) =>
        cells.map((cell) =>
          Math.round(
            cell.querySelector('strong')!.getBoundingClientRect().right -
              cell.getBoundingClientRect().right,
          ),
        ),
      )
    expect(readouts).toHaveLength(8)
    for (const spill of readouts) expect(spill).toBeLessThanOrEqual(1)

    // A tool whose content cannot narrow scrolls inside its own frame; nothing of it is cut off.
    const tools = await page
      .locator('[aria-label="Measurement tools"] > details[open] > :not(summary)')
      .evaluateAll((frames) =>
        frames.map((frame) => ({
          overflowX: getComputedStyle(frame).overflowX,
          right: Math.round(frame.getBoundingClientRect().right),
          inside: frame.scrollWidth - frame.clientWidth,
        })),
      )
    await record(info, 'tool-frames', tools)
    expect(tools.length).toBeGreaterThanOrEqual(4)
    for (const frame of tools) {
      expect(frame.overflowX).toBe('auto')
      expect(frame.right).toBeLessThanOrEqual(viewport.width)
    }
    await back.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath('observe.png') })

    // Back by keyboard: the same case, the same tools, still inside the window.
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-case-flow]')).toHaveAttribute('data-phase', 'act')
    await rootText(page, 200)
    expect(await pageOverflow(page), 'page overflow back at the actions').toBeLessThanOrEqual(1)
    expect(await pastTheWindow(page)).toEqual([])
    await expect(page.locator('[class*="thermoTrialCard"]')).toHaveCount(1)
    expect(await actionCards(page)).toEqual(actionsBefore)
    for (const name of ['Pressure measurement', 'Catheter actions', 'Cardiac-output trials']) {
      await expect(
        page
          .locator('[aria-label="Measurement tools"] summary')
          .filter({ hasText: name })
          .locator('..'),
      ).toHaveAttribute('open', '')
    }
    const clockAfter = await page.locator('section[class*="monitor"] header time').textContent()
    expect(Number.parseFloat(clockAfter ?? '0')).toBeGreaterThanOrEqual(
      Number.parseFloat(clockBefore ?? '0'),
    )
  })
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 740 },
  { width: 1204, height: 987 },
]) {
  test(`P-03 — at 100% root text the case is laid out as it was: a table, and nothing scrolling sideways — ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1204, height: 987 })
    await openPracticeActions(page, 'HD-01')
    await populateAndObserve(page)
    await page.setViewportSize(viewport)
    await page.waitForTimeout(700)
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
    const cells = await page
      .locator('[aria-label="Retained case observations"] td')
      .evaluateAll((nodes) => nodes.map((cell) => getComputedStyle(cell).display))
    expect(cells).toEqual(['table-cell', 'table-cell', 'table-cell', 'table-cell'])
    // The readouts are two to a row on a phone and one column beside the tracings on a desktop.
    const railColumns = await page
      .locator('section[class*="monitor"] [class*="numericRail"]')
      .evaluate((rail) => getComputedStyle(rail).gridTemplateColumns.split(' ').length)
    expect(railColumns).toBe(viewport.width < 761 ? 2 : 1)
    // No opened tool needs its backstop: the content fits its frame.
    const inside = await page
      .locator('[aria-label="Measurement tools"] > details[open] > :not(summary)')
      .evaluateAll((frames) => frames.map((frame) => frame.scrollWidth - frame.clientWidth))
    for (const extra of inside) expect(extra).toBeLessThanOrEqual(1)
  })
}

// Fails before the repair: the notice ended "The axis changed; the pressure did not."
test('L2-06 — after a fluid step the refitted axis is announced without denying the pressure change — 1204×987', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1204, height: 987 })
  await openPracticeActions(page, 'HD-02')
  const readout = page.getByRole('group', { name: 'Current PAC pressure' }).locator('strong')
  const before = await readout.textContent()
  await page.locator('[data-intervention]').filter({ hasText: 'Fluid' }).first().click()
  await page.getByRole('button', { name: 'Observe the modeled response' }).click()
  const observe = page.getByRole('button', { name: /Observe 15 model seconds/ })
  const note = page.locator('[data-scale-change-note]')
  for (let step = 0; step < 6 && (await note.count()) === 0; step += 1) await observe.click()
  await expect(note).toBeVisible()
  const text = (await note.textContent()) ?? ''
  const after = await readout.textContent()
  await record(info, 'axis-notice', { before, after, text })
  // The pressure the monitor prints did move, which is why the axis was refitted.
  expect(after).not.toBe(before)
  expect(text).toMatch(/Axis changed from 0 to 40 mmHg to 0 to 80 mmHg\./)
  expect(text).toMatch(/Read a change from the axis numbers and the readout/)
  expect(text).not.toMatch(/pressure did not|did not change|unchanged/i)
  await note.screenshot({ path: info.outputPath('axis-notice.png') })
})

/* ------------------------------------------------------------------ *
 * Learn — the live strip and its held copy across a change of transducer height
 * ------------------------------------------------------------------ */

async function openLearnTask(page: Page, section: string, ordinal: number) {
  await page.goto(`/en/icu-hemodynamics/learn?activity=${section}`)
  await expect(page.locator('[data-lesson-shell]')).toBeVisible({ timeout: 90_000 })
  await hydrated(page)
  if (ordinal > 1) {
    const list = page.locator('[data-step-list]')
    await list.evaluate((element) => {
      const details = element.closest('details')
      if (details) details.open = true
    })
    await list
      .locator('button')
      .nth(ordinal - 1)
      .click()
    await page.waitForFunction(
      (n) =>
        document
          .querySelector('[data-lesson-shell]')
          ?.getAttribute('data-stage')
          ?.includes(`-${n}-`),
      ordinal,
    )
  }
  await page.waitForTimeout(700)
}

interface TraceGeometry {
  readonly seams: number
  readonly marker: string | null
  readonly earlier: readonly (readonly [number, number])[]
  readonly current: readonly (readonly [number, number])[]
}

/** One strip's seam, its dimmed trace and its current trace, read in a single frame. */
function traceGeometry(page: Page, strip: string): Promise<TraceGeometry> {
  return page.locator(strip).evaluate((figure) => {
    const points = (kind: string) =>
      [...figure.querySelectorAll(`polyline[data-strip-trace="${kind}"]`)].flatMap((line) =>
        (line.getAttribute('points') ?? '')
          .split(' ')
          .filter(Boolean)
          .map((pair) => pair.split(',').map(Number) as [number, number]),
      )
    return {
      seams: figure.querySelectorAll('[data-strip-seam]').length,
      marker: figure.querySelector('[data-strip-marker="seam"]')?.textContent ?? null,
      earlier: points('earlier'),
      current: points('current'),
    }
  })
}

/**
 * The step a transducer move puts into the buffer has to fall in the gap between the two traces.
 * Before the repair the current trace began on the last sample of the earlier setting, so the gap
 * was one ordinary sample step and the instrument's step was drawn as the current trace's first
 * line segment.
 */
function expectStepLeftOpen(geometry: TraceGeometry) {
  const lastEarlier = geometry.earlier.at(-1)!
  const [first, second] = geometry.current
  const acrossTheGap = Math.abs(first[1] - lastEarlier[1])
  const firstSegment = Math.abs(second[1] - first[1])
  // Soft, so that on a tree with both defects the held copy's missing seam is reported as well.
  expect.soft(first[0]).toBeGreaterThan(lastEarlier[0])
  // Twenty centimetres of height is about 15 mmHg: a quarter of this axis, 20 or more of its 92 units.
  expect.soft(acrossTheGap, 'the step, across the gap between the traces').toBeGreaterThan(12)
  expect.soft(firstSegment, 'the current trace’s first segment').toBeLessThan(acrossTheGap * 0.6)
}

for (const viewport of [
  { width: 1707, height: 900 },
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  // Fails before the repair twice over: the current trace starts on the earlier setting's last
  // sample, and the held copy has no seam at all.
  test(`L2-06 and L5-05 — a transducer move leaves its step open on the live strip and on a held copy of it — ${viewport.width}×${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport)
    await openLearnTask(page, 'pressure-system', 2)
    const monitor = page.locator('[data-focused-monitor="pac"]')
    const live =
      '[data-focused-monitor="pac"] [data-waveform-strip="papMmHg"]:not([data-still-copy])'
    const level = page.locator('#hemodynamics-control-level')
    const hold = monitor.locator('[data-hold-view]')
    await expect(page.locator(live).locator('[data-strip-seam]')).toHaveCount(0)

    // By keyboard: End takes the slider to its top, 20 cm above the reference.
    await level.focus()
    await page.keyboard.press('End')
    await expect(page.locator('[data-level-readout]')).toHaveText('+20 cm')
    await hold.focus()
    await page.keyboard.press('Enter')
    await expect(hold).toHaveAttribute('aria-pressed', 'true')

    const held = '[data-held-view] [data-waveform-strip="papMmHg"]'
    const heldGeometry = await traceGeometry(page, held)
    // Read once the live strip has a few samples under the new setting.
    await expect
      .poll(async () => (await traceGeometry(page, live)).current.length)
      .toBeGreaterThan(3)
    const liveGeometry = await traceGeometry(page, live)
    await record(info, 'seams', { live: liveGeometry, held: heldGeometry })

    expect(liveGeometry.seams).toBe(1)
    expect(liveGeometry.marker).toBe('transducer height changed')
    expectStepLeftOpen(liveGeometry)

    // The held copy was taken within its two beats of the move: it keeps the break.
    expect.soft(heldGeometry.seams, 'seams on the held copy').toBe(1)
    expect(heldGeometry.marker).toBe('transducer height changed')
    expect(heldGeometry.earlier.length).toBeGreaterThan(1)
    if (heldGeometry.current.length > 1) expectStepLeftOpen(heldGeometry)
    const heldNote = page.locator('[data-held-view-note]')
    await expect(heldNote).toContainText('Held copy · not live.')
    await expect(page.locator('[data-held-view-seam]')).toContainText(
      /transducer height changed at \d+\.\d s/,
    )
    // Which sentence follows depends on whether a sample under the new height arrived before the
    // hold: the copy either crosses the change or ends at it, and says which.
    await expect(page.locator('[data-held-view-seam]')).toContainText(
      heldGeometry.current.length > 0
        ? /These two beats cross a change.*not joined to the part after it/
        : /These two beats end at a change.*All of this copy was drawn under the earlier setting/,
    )
    await expect(page.locator(held).getByRole('img')).toHaveAccessibleName(
      /transducer height changed; the tracing before that marker was drawn under the earlier setting/,
    )

    // Held is still, live is live: the copy does not move while the strip above it goes on.
    const heldPoints = await page
      .locator(`${held} polyline[data-strip-trace]`)
      .evaluateAll((lines) => lines.map((line) => line.getAttribute('points')))
    const liveBefore = await page.locator(live).getByRole('img').getAttribute('aria-label')
    await page.waitForTimeout(1200)
    expect(
      await page
        .locator(`${held} polyline[data-strip-trace]`)
        .evaluateAll((lines) => lines.map((line) => line.getAttribute('points'))),
    ).toEqual(heldPoints)
    expect(await page.locator(live).getByRole('img').getAttribute('aria-label')).not.toBe(
      liveBefore,
    )
    await expect(page.locator('[data-held-view]')).toHaveCount(1)
    await monitor.screenshot({ path: info.outputPath('held-with-seam.png') })

    // Release by keyboard: back to the live strip alone, with the level where it was put.
    await page.keyboard.press('Space')
    await expect(hold).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('[data-held-view]')).toHaveCount(0)
    await expect(page.locator('[data-level-readout]')).toHaveText('+20 cm')
    await expect(hold).toBeFocused()
    expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
  })
}

/* ------------------------------------------------------------------ *
 * The tracing and the controls that change it, in one window
 * ------------------------------------------------------------------ */

interface Together {
  readonly control: string
  readonly group: string
  readonly span: number
  readonly available: number
  readonly together: boolean
}

/**
 * For each enabled control: is there one scroll position at which the control and every live
 * pressure strip it changes are wholly inside the window, below the site header? A sticky monitor
 * is allowed to follow the scroll; the answer is read from where things actually end up.
 */
function measureTogether(page: Page, scope: string, controls: string): Promise<Together[]> {
  return page.evaluate(
    async ({ scope, controls }) => {
      document.documentElement.style.scrollBehavior = 'auto'
      const frame = () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        )
      const headerBottom = () => {
        let bottom = 0
        for (const element of document.querySelectorAll('header')) {
          const style = getComputedStyle(element)
          const box = element.getBoundingClientRect()
          if ((style.position === 'sticky' || style.position === 'fixed') && box.top <= 1) {
            if (box.height < 200) bottom = Math.max(bottom, box.bottom)
          }
        }
        return bottom
      }
      const root = document.querySelector(scope)!
      const strips = () =>
        [
          ...root.querySelectorAll(
            '[data-waveform-strip]:not([data-waveform-strip="ecgMv"]):not([data-waveform-strip="pleth"]):not([data-still-copy]) [data-strip-plot]',
          ),
        ].filter((plot) => plot.getBoundingClientRect().height > 20)
      const rows: Together[] = []
      for (const control of root.querySelectorAll<HTMLElement>(controls)) {
        if ((control as HTMLButtonElement).disabled || control.closest('fieldset:disabled'))
          continue
        if (control.getBoundingClientRect().height === 0) continue
        window.scrollTo({ top: 0, behavior: 'instant' })
        await frame()
        const boxes = [control, ...strips()].map((element) => element.getBoundingClientRect())
        const top = Math.min(...boxes.map((box) => box.top))
        const bottom = Math.max(...boxes.map((box) => box.bottom))
        window.scrollBy({ top: top - headerBottom() - 8, behavior: 'instant' })
        await frame()
        let box = control.getBoundingClientRect()
        if (box.bottom > window.innerHeight - 4) {
          window.scrollBy({ top: box.bottom - window.innerHeight + 8, behavior: 'instant' })
          await frame()
          box = control.getBoundingClientRect()
        }
        const header = headerBottom()
        const whole = (rect: DOMRect) =>
          rect.top >= header - 1 && rect.bottom <= window.innerHeight + 1
        rows.push({
          control: (control.getAttribute('aria-label') ?? control.textContent ?? control.id)
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 40),
          group:
            control.closest('[data-dock]')?.getAttribute('data-dock') ??
            control
              .closest('[aria-label="Measurement tools"] details')
              ?.querySelector('summary')
              ?.textContent?.slice(0, 24) ??
            'task',
          span: Math.round(bottom - top),
          available: Math.round(window.innerHeight - header),
          together: whole(box) && strips().every((plot) => whole(plot.getBoundingClientRect())),
        })
      }
      window.scrollTo({ top: 0, behavior: 'instant' })
      return rows
    },
    { scope, controls },
  )
}

const LEARN_WORKBENCH_TASKS: readonly (readonly [
  section: string,
  ordinal: number,
  name: string,
])[] = [
  ['pressure-system', 2, 'Leveling'],
  ['pressure-system', 3, 'Zeroing'],
  ['pressure-system', 4, 'Arterial display scale'],
  ['pressure-system', 8, 'Read the response (fast flush)'],
  ['catheter-advancement', 3, 'Advance by the tracing'],
  ['catheter-advancement', 7, 'Repair, then move'],
  ['pawp-capture', 3, 'Occlude, read, release'],
  ['pac-signal-validation', 3, 'Restore the screen, in order'],
  ['pac-signal-validation', 7, 'Read the line before the number'],
]

for (const viewport of [
  { width: 1707, height: 900 },
  { width: 1440, height: 900 },
]) {
  test(`Learn — every control is in the window with the tracing it changes — ${viewport.width}×${viewport.height}`, async ({
    page,
  }, info) => {
    test.setTimeout(240_000)
    await page.setViewportSize(viewport)
    const measured: Record<string, Together[]> = {}
    for (const [section, ordinal, name] of LEARN_WORKBENCH_TASKS) {
      await openLearnTask(page, section, ordinal)
      const rows = await measureTogether(
        page,
        '[data-simulator-surface]',
        '[data-dock] button, [data-dock] input, [data-dock] select',
      )
      measured[`${section} ${ordinal} · ${name}`] = rows
      expect(rows.length, `${name}: enabled controls`).toBeGreaterThan(0)
      for (const row of rows) {
        expect(row.together, `${name}: "${row.control}" (${row.span} of ${row.available} px)`).toBe(
          true,
        )
      }
    }
    await record(info, 'learn-together', measured)
  })

  test(`Practice — the action cards and the Observe controls are in the window with the monitor's tracings — ${viewport.width}×${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport)
    await openPracticeActions(page, 'HD-01')
    const actions = await measureTogether(page, '[data-case-workspace]', '[data-intervention]')
    expect(actions).toHaveLength(5)
    for (const row of actions) expect(row.together, `"${row.control}"`).toBe(true)

    /*
     * The measurement tools open beneath the monitor, where they were before this batch. Their
     * controls are measured and attached, not asserted: at these sizes most of them cannot be in
     * the window with the tracing, and this repair does not claim otherwise (see the handoff).
     */
    const tools: Record<string, Together[]> = {}
    for (const name of ['Pressure measurement', 'Catheter actions']) {
      await openTool(page, name)
      tools[name] = await measureTogether(
        page,
        '[data-case-workspace]',
        '[aria-label="Measurement tools"] details[open] button, [aria-label="Measurement tools"] details[open] input[type="range"]',
      )
      await page
        .locator('[aria-label="Measurement tools"] summary')
        .filter({ hasText: name })
        .click()
    }

    await page.locator('[data-intervention]').filter({ hasText: 'Fluid' }).first().click()
    await page.getByRole('button', { name: 'Observe the modeled response' }).click()
    const observe = await measureTogether(
      page,
      '[data-case-workspace]',
      'section[aria-label="Current case task"] button',
    )
    expect(observe.map((row) => row.control)).toEqual([
      'Back to actions and measurements',
      'Observe 15 model seconds',
      'Reassess and open the debrief',
    ])
    for (const row of observe) expect(row.together, `"${row.control}"`).toBe(true)
    await record(info, 'practice-together', { actions, observe, toolsMeasuredNotAsserted: tools })
    info.annotations.push({
      type: 'measured, not asserted',
      description: `Practice measurement tools in the window with the tracing: ${Object.entries(
        tools,
      )
        .map(
          ([name, rows]) =>
            `${name} ${rows.filter((row) => row.together).length} of ${rows.length}`,
        )
        .join('; ')}`,
    })
  })
}

/* ------------------------------------------------------------------ *
 * Ported from PR #321 — Learn at phone width with enlarged text
 * ------------------------------------------------------------------ */

/** The five tasks PR #321's phone check opens, with what it does on each. */
const PHONE_TASKS: readonly (readonly [section: string, ordinal: number, name: string])[] = [
  ['pressure-system', 2, 'Leveling'],
  ['pressure-system', 8, 'Read the response'],
  ['waveform-components', 3, 'When the atrial contour changes'],
  ['waveform-components', 5, 'Interpret the component in context'],
  ['catheter-advancement', 3, 'Advance by the tracing'],
]

// Fails before the port: 112, 23 and 192 px of page overflow on three of the five.
test('PR #321 port — five Learn tasks hold 200% root text at 390×844 without the page scrolling sideways', async ({
  page,
}, info) => {
  test.setTimeout(240_000)
  await page.setViewportSize({ width: 390, height: 844 })
  const measured: Record<string, number> = {}
  for (const [section, ordinal, name] of PHONE_TASKS) {
    await openLearnTask(page, section, ordinal)
    await rootText(page, 200)
    if (name === 'Read the response') {
      await page.locator('#hemodynamics-control-flush').click()
      await expect(page.locator('[data-flush-classification]')).toBeVisible({ timeout: 15_000 })
    }
    // Sources opened by keyboard on every one of them: the list is in the page, under the lesson.
    await page.locator('[data-stage-sources] summary').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-stage-sources]')).toHaveAttribute('open', '')
    await page.waitForTimeout(600)
    measured[`${section} ${ordinal} · ${name}`] = await pageOverflow(page)

    if (name === 'Leveling') {
      // "Reference and current result" is still a table, with each value under its observation
      // and its column named beside it.
      const card = page.locator('[aria-label="Retained demonstration comparison"]')
      await expect(card.getByRole('table')).toBeVisible()
      await expect(
        card.getByRole('rowheader', { name: 'Transducer height', exact: true }),
      ).toBeVisible()
      const cells = await card.locator('td').evaluateAll((nodes) =>
        nodes.map((cell) => ({
          label: getComputedStyle(cell, '::before').content,
          display: getComputedStyle(cell).display,
          right: cell.getBoundingClientRect().right,
        })),
      )
      expect(cells.length).toBeGreaterThanOrEqual(6)
      for (const cell of cells) {
        expect(cell.display).toBe('block')
        expect(cell.label).toMatch(/Reference: |Current: /)
        expect(cell.right).toBeLessThanOrEqual(390)
      }
      // The height control is whole and still works from the keyboard at this size.
      const level = page.locator('#hemodynamics-control-level')
      const readout = page.locator('[data-level-readout]')
      await level.focus()
      await page.keyboard.press('ArrowRight')
      await expect(readout).toHaveText('+1 cm')
      const box = await readout.boundingBox()
      expect(box!.x + box!.width).toBeLessThanOrEqual(390)
      await page.keyboard.press('ArrowLeft')
    }
    await page.screenshot({ path: info.outputPath(`${section}-${ordinal}.png`) })
    await rootText(page, 100)
  }
  await record(info, 'learn-390-200', measured)
  for (const [task, overflow] of Object.entries(measured)) {
    expect(overflow, task).toBeLessThanOrEqual(1)
  }
})

test('PR #321 port — the same tasks at 100% root text keep their table and their one-row controls — 390×844', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openLearnTask(page, 'pressure-system', 2)
  expect(await pageOverflow(page)).toBeLessThanOrEqual(1)
  const cells = await page
    .locator('[aria-label="Retained demonstration comparison"] td')
    .evaluateAll((nodes) => nodes.map((cell) => getComputedStyle(cell).display))
  expect(new Set(cells)).toEqual(new Set(['table-cell']))
  // Label and slider still share a row: the stacked form is for enlarged text only.
  const row = await page
    .locator('[data-dock="line"] [class*="dockRow"]')
    .first()
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)
  expect(row).toBe(2)
})
