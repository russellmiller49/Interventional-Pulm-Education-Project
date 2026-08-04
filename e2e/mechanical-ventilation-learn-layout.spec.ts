import { expect, test, type Page } from '@playwright/test'

/**
 * The standard-laptop acceptance criteria for the mechanical-ventilation Learn workspace.
 *
 * jsdom performs no layout, so these questions can only be answered in a browser. Before this
 * package the Learn viewport was one scroll container holding a 40rem workspace: measured at
 * 1280x720 the shell gave it 377px and it carried 948px of content, so the learner reached the
 * current task by scrolling the ventilator off the top, through five levels of nested scrolling.
 *
 * The numeric matrix behind these assertions is produced by
 * `scripts/critical-care/measure-mv-learn-layout.mjs`.
 */
test.setTimeout(180_000)

const LESSON = '/en/mechanical-ventilation/learn?activity=waveform-anatomy'

/** The module's own compact trace height, so "readable" is its number rather than a new one. */
const READABLE_TRACE_PX = 100

/**
 * `mayCompact` allows the shared workspace to collapse to one tabbed pane at that width, which is
 * the deliberate small-display arrangement rather than a failure: the ventilator keeps the full
 * width and the other two panes are one labelled tab away, never unmounted. The Learn viewport is
 * sized so 1024x768 normally keeps all three panes, but a host that adds a scrollbar can push it
 * over the shared 960px threshold, and both arrangements must satisfy the same invariants.
 * Pause and Help are chrome at every size, so they are asserted unconditionally.
 */
const VIEWPORTS = [
  { name: '1600x900', width: 1600, height: 900, mayCompact: false },
  { name: '1440x900', width: 1440, height: 900, mayCompact: false },
  { name: '1280x720', width: 1280, height: 720, mayCompact: false },
  { name: '1024x768', width: 1024, height: 768, mayCompact: true },
] as const

/** Reveal the task pane when, and only when, the workspace has collapsed to tabs. */
async function revealTaskPane(page: Page): Promise<void> {
  const tabs = page.getByRole('tablist', { name: 'Workspace panel views' })
  if ((await tabs.count()) === 0) return
  await tabs.getByRole('tab', { name: 'Your turn' }).click()
}

/** Visible height after intersecting with the window and every clipping ancestor. */
async function visibleHeight(page: Page, selector: string, index = 0): Promise<number> {
  return page.evaluate(
    ({ selector: css, index: nth }) => {
      const element = document.querySelectorAll(css)[nth]
      if (!(element instanceof Element)) return -1
      const rect = element.getBoundingClientRect()
      let top = Math.max(rect.top, 0)
      let bottom = Math.min(rect.bottom, window.innerHeight)
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = window.getComputedStyle(parent)
        if (style.overflowY === 'visible' && style.overflowX === 'visible') continue
        const bounds = parent.getBoundingClientRect()
        top = Math.max(top, bounds.top)
        bottom = Math.min(bottom, bounds.bottom)
      }
      return Math.max(0, Math.round(bottom - top))
    },
    { selector, index },
  )
}

async function openLesson(page: Page) {
  await page.goto(LESSON)
  await expect(page.getByRole('heading', { name: /Waveform anatomy/ })).toBeVisible({
    timeout: 90_000,
  })
  // Every phase change writes a resume pointer, and a lesson that finds one shows the resume
  // banner instead of the workspace.
  await page.evaluate(() => window.localStorage.clear())
}

async function openPhase(page: Page, label: string) {
  await page.getByRole('button', { name: `Open ${label} phase` }).click()
}

const LEARN_PHASES = ['Predict', 'Act', 'Observe', 'Explain', 'Transfer'] as const

for (const viewport of VIEWPORTS) {
  test(`keeps the live trace and the current task together at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await openLesson(page)

    const waveform = await visibleHeight(page, 'svg[role="img"][aria-label*="waveform"]')
    expect(waveform).toBeGreaterThanOrEqual(READABLE_TRACE_PX)

    const tabs = page.getByRole('tablist', { name: 'Workspace panel views' })
    if (!viewport.mayCompact) expect(await tabs.count()).toBe(0)

    // No sideways scroll trapped inside the pane that holds the device facsimile.
    const paneOverflow = await page.evaluate(() => {
      const pane = document.querySelector('[role="region"][aria-label="Ventilator panel"]')
      return pane ? pane.scrollWidth - pane.clientWidth : -1
    })
    expect(paneOverflow).toBeLessThanOrEqual(0)

    // The objective must be whole and at least one touch target of the control block on screen.
    await revealTaskPane(page)
    await expect(page.locator('[data-mv-task-objective]')).toBeVisible()
    expect(await visibleHeight(page, '[data-mv-task-controls]')).toBeGreaterThanOrEqual(44)

    // The Learn viewport itself never scrolls: panes do.
    const viewportScroll = await page.evaluate(() => {
      const node = document.querySelector('[data-mv-learn-viewport]')
      return node ? node.scrollHeight - node.clientHeight : -1
    })
    expect(viewportScroll).toBeLessThanOrEqual(2)

    // No horizontal page overflow at any of the four sizes.
    const horizontal = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(horizontal).toBeLessThanOrEqual(0)
  })

  test(`keeps Help and pause reachable in every Learn phase at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await openLesson(page)

    const clock = page.getByRole('region', { name: 'Lesson simulation clock' })
    const help = page
      .locator('[data-critical-care-activity-shell] header button')
      .filter({ hasText: /^Help$/ })

    for (const phase of ['Recognize', ...LEARN_PHASES]) {
      if (phase !== 'Recognize') await openPhase(page, phase)
      await expect(clock).toBeVisible()
      await expect(clock.getByRole('button', { name: /^(Pause|Start ventilation)$/ })).toBeVisible()
      await expect(help).toBeVisible()

      // Help answers where the learner is working, not only inside the collapsed task drawer.
      await help.click()
      await revealTaskPane(page)
      await expect(page.locator('[data-mv-learn-hint]')).toBeVisible()
    }
  })

  test(`opening Help never covers pause at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await openLesson(page)

    const clock = page.getByRole('region', { name: 'Lesson simulation clock' })
    const before = await clock.boundingBox()
    await page
      .locator('[data-critical-care-activity-shell] header button')
      .filter({ hasText: /^Help$/ })
      .click()
    await revealTaskPane(page)
    await expect(page.locator('[data-mv-learn-hint]')).toBeVisible()

    const after = await clock.boundingBox()
    expect(after?.y).toBeCloseTo(before?.y ?? -1, 0)
    await expect(clock.getByRole('button', { name: /^(Pause|Start ventilation)$/ })).toBeVisible()
  })
}

test('a verdict never moves the evidence the learner answered from', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openLesson(page)
  await openPhase(page, 'Predict')

  const evidenceScrollBefore = await page.evaluate(
    () => document.querySelector('[role="region"][aria-label="Ventilator panel"]')?.scrollTop ?? -1,
  )
  const traceBefore = await visibleHeight(page, 'svg[role="img"][aria-label*="waveform"]')

  await page
    .locator('[role="region"][aria-label="Your turn panel"] input[type=radio]')
    .first()
    .dispatchEvent('click')
  await page.getByRole('button', { name: 'Commit prediction' }).click()
  await expect(page.locator('[data-answer-verdict]')).toBeVisible()

  const evidenceScrollAfter = await page.evaluate(
    () => document.querySelector('[role="region"][aria-label="Ventilator panel"]')?.scrollTop ?? -1,
  )
  expect(evidenceScrollAfter).toBe(evidenceScrollBefore)
  expect(await visibleHeight(page, 'svg[role="img"][aria-label*="waveform"]')).toBe(traceBefore)
  // The verdict is inside the task pane, so it cannot displace the trace.
  expect(
    await page.evaluate(
      () =>
        document
          .querySelector('[role="region"][aria-label="Ventilator panel"]')
          ?.querySelector('[data-answer-verdict]') === null,
    ),
  ).toBe(true)
})

test('phase changes keep each pane where the learner left it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openLesson(page)

  const teachingPane = '[role="region"][aria-label="Teaching panel"]'
  await page.evaluate((selector) => {
    const pane = document.querySelector(selector)
    if (pane) pane.scrollTop = 120
  }, teachingPane)

  await openPhase(page, 'Act')
  const kept = await page.evaluate(
    (selector) => document.querySelector(selector)?.scrollTop ?? -1,
    teachingPane,
  )
  // The pane is never unmounted across a phase change, so the learner's position survives it.
  expect(kept).toBe(120)
})

test('no pane scroll is trapped inside another scrolling pane', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openLesson(page)

  const nested = await page.evaluate(() => {
    const scrolls = (element: Element) => {
      const style = window.getComputedStyle(element)
      const scrollable = ['auto', 'scroll', 'overlay'].includes(style.overflowY)
      return scrollable && element.scrollHeight - element.clientHeight > 2
    }
    const panes = Array.from(document.querySelectorAll('[data-mv-learn-workspace] [role="region"]'))
    return panes.filter((pane) => {
      for (let parent = pane.parentElement; parent; parent = parent.parentElement) {
        if (scrolls(parent)) return true
      }
      return false
    }).length
  })
  expect(nested).toBe(0)
})
