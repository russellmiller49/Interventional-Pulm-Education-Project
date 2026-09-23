import { test, expect, type Page, type Locator } from '@playwright/test'

/**
 * CRRT-FELLOW-03 — readable workbench, Help, Cases, role, Learn order, task controls, circuit,
 * membrane and pressure arithmetic, measured in a real browser. Every check reads rendered
 * geometry or behaviour rather than class names.
 */

const matrix: readonly {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly text200?: boolean
}[] = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x900', width: 1280, height: 900 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x740', width: 320, height: 740 },
  { name: '1280x900-text200', width: 1280, height: 900, text200: true },
]

async function enlargeText(page: Page) {
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
}

/** Nothing inside the CRRT activity shell spills past the window (scroll containers excluded). */
async function shellOverflow(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector('[data-critical-care-activity-shell]')!
    return [...shell.querySelectorAll('*')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.right <= innerWidth + 1) return false
        for (let p = el.parentElement; p && p !== shell; p = p.parentElement) {
          if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return false
        }
        return true
      })
      .map((el) => `${el.tagName}:${(el.textContent ?? '').trim().slice(0, 30)}`)
  })
}

async function uncoveredWhenInView(target: Locator) {
  await target.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }))
  await target.page().waitForTimeout(50)
  return target.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return {
      uncovered: !!hit && (hit === el || el.contains(hit)),
      inViewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
    }
  })
}

const clock = (page: Page) =>
  page.locator('[aria-label="Advance simulated time"]').first().innerText()

for (const viewport of matrix) {
  test(`workbench reads without sideways scrolling and keeps labels uncovered — ${viewport.name}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/en/baxter-crrt/practice?case=CRRT-02')
    if (viewport.text200) await enlargeText(page)
    const evidence = page.getByRole('region', { name: 'Live patient, prescription, and circuit' })
    await expect(evidence).toBeVisible()

    // No sideways strip: the evidence panel does not scroll horizontally and nothing in the shell
    // spills past the window. (The site header's own overflow at 200% text is a platform item.)
    expect(await evidence.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    expect(await shellOverflow(page)).toEqual([])
    if (!viewport.text200) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    }

    // Every evidence label and the decisive supplied labs are reachable and uncovered.
    const labels = evidence.getByRole('term')
    expect(await labels.count()).toBe(8)
    for (let index = 0; index < 8; index++) {
      expect(await uncoveredWhenInView(labels.nth(index))).toEqual({
        uncovered: true,
        inViewport: true,
      })
    }
    await expect(evidence).toContainText(/K 6\.9 mmol\/L/)
    await expect(evidence).toContainText(/pH 7\.08/)

    // The current task and the first case action are reachable and uncovered.
    const task = page.getByRole('region', { name: 'Current task' })
    expect(await uncoveredWhenInView(task.getByRole('heading', { name: 'Current task' }))).toEqual({
      uncovered: true,
      inViewport: true,
    })
    const perform = page.getByRole('button', { name: 'Perform' }).first()
    expect(await uncoveredWhenInView(perform)).toEqual({ uncovered: true, inViewport: true })

    // Beside the case on a wide window, the task/evidence column never overlaps the case column.
    const rail = page.locator('[data-crrt-workbench-rail]')
    const main = page.getByRole('region', { name: 'Simulation viewport' })
    const [railBox, mainBox] = [await rail.boundingBox(), await main.boundingBox()]
    const sideBySide = railBox!.x + railBox!.width <= mainBox!.x + 1
    const stacked = railBox!.y + railBox!.height <= mainBox!.y + 1
    expect(sideBySide || stacked).toBe(true)

    // The last content (the footer) is reachable in normal document flow; nothing is pinned.
    const footer = page.locator('[data-critical-care-activity-shell] > footer')
    expect(await footer.evaluate((el) => getComputedStyle(el).position)).toBe('static')
    expect(await uncoveredWhenInView(footer)).toEqual({ uncovered: true, inViewport: true })
    await page.screenshot({ path: info.outputPath(`practice-${viewport.name}.png`) })
    await info.attach('layout', {
      body: JSON.stringify({ viewport, rail: railBox, main: mainBox, sideBySide }),
      contentType: 'application/json',
    })
  })
}

test('all detail expanded: the case actions stay reachable and nothing spills sideways', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/en/baxter-crrt/practice?case=CRRT-13')
  await page.getByRole('button', { name: 'Show task details' }).click()
  await page.getByText(/^Objective and /).click()
  await page.getByText('Device profile and safety constraints').click()
  await page.getByRole('button', { name: 'Show hint' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Hint' })).toBeVisible()
  expect(await shellOverflow(page)).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  const perform = page.getByRole('button', { name: 'Perform' }).first()
  expect(await uncoveredWhenInView(perform)).toEqual({ uncovered: true, inViewport: true })
})

for (const viewport of [matrix[1], matrix[3], matrix[4], matrix[5]]) {
  test(`Help opens a visible dialog by mouse and keyboard, changes nothing — ${viewport.name}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/en/baxter-crrt/practice?case=CRRT-11')
    if (viewport.text200) await enlargeText(page)
    await page.getByRole('button', { name: 'Perform' }).first().click()
    await page.getByRole('button', { name: '+1 hr', exact: true }).click()
    const before = { clock: await clock(page), url: page.url() }
    const help = page.getByRole('button', { name: 'Help', exact: true })

    // Mouse.
    await help.click()
    const dialog = page.getByRole('dialog', { name: 'Help for this case' })
    await expect(dialog).toBeVisible()
    const box = (await dialog.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    await expect(dialog).toContainText('Hint')
    await page.screenshot({ path: info.outputPath(`help-${viewport.name}.png`) })
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(help).toBeFocused()

    // Keyboard.
    await page.keyboard.press('Enter')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(help).toBeFocused()

    expect({ clock: await clock(page), url: page.url() }).toEqual(before)
  })
}

test('Cases: previous, next, an additional case, Back, Forward and reload keep one identity', async ({
  page,
}) => {
  await page.goto('/en/baxter-crrt/practice?case=CRRT-02')
  const nav = page.getByRole('navigation', { name: 'Practice cases' })
  await expect(nav.getByText('Core case 2 of 10')).toBeVisible()
  const heading = page.locator('#practice-case-heading')
  const casesPicker = nav.getByRole('combobox', { name: 'Cases' })

  await nav.getByRole('button', { name: /^Next case: / }).click()
  await expect(page).toHaveURL(/case=CRRT-04/)
  await expect(nav.getByText('Core case 3 of 10')).toBeVisible()
  await expect(casesPicker).toHaveValue('CRRT-04')
  const third = await heading.innerText()

  await nav.getByRole('button', { name: /^Previous case: / }).click()
  await expect(page).toHaveURL(/case=CRRT-02/)
  await expect(casesPicker).toHaveValue('CRRT-02')

  await casesPicker.selectOption('CRRT-06')
  await expect(page).toHaveURL(/case=CRRT-06/)
  await expect(nav.getByText('Additional case 2 of 7 · optional')).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/case=CRRT-02/)
  await expect(casesPicker).toHaveValue('CRRT-02')
  await page.goBack()
  await expect(page).toHaveURL(/case=CRRT-04/)
  await expect(heading).toHaveText(third)
  await page.goForward()
  await expect(page).toHaveURL(/case=CRRT-02/)
  await page.reload()
  await expect(casesPicker).toHaveValue('CRRT-02')
  await expect(nav.getByText('Core case 2 of 10')).toBeVisible()
})

test('role perspective keeps the run and says it changes nothing', async ({ page }) => {
  await page.goto('/en/baxter-crrt/practice?case=CRRT-11')
  const roles = page.getByRole('group', { name: 'Reading perspective' })
  await expect(roles).toContainText('Switching keeps your run')
  await roles.getByRole('button', { name: 'Operator' }).click()
  await page.getByRole('button', { name: 'Perform' }).first().click()
  await page.getByRole('button', { name: '+1 hr', exact: true }).click()
  const before = await clock(page)
  for (const role of ['Prescriber', 'Both roles', 'Operator']) {
    await roles.getByRole('button', { name: role }).click()
    await expect(roles.getByRole('button', { name: role })).toHaveAttribute('aria-pressed', 'true')
    expect(await clock(page)).toBe(before)
    await expect(page.getByRole('button', { name: 'Completed' })).toHaveCount(1)
  }
})

test('Learn: one order across hub, picker, previous/next and resume', async ({ page }) => {
  await page.goto('/en/baxter-crrt/learn?lesson=crrt-indications-modality')
  await expect(page.getByText('Lesson 1 of 8')).toBeVisible()
  await page.goto('/en/baxter-crrt')
  const sequence = page.getByRole('list', { name: 'Recommended Learn sequence' })
  await expect(sequence.getByRole('listitem')).toHaveCount(8)
  const resume = page.getByRole('link', { name: /Continue to the next topic/ })
  await expect(resume).toContainText('Lesson 2: Circuit anatomy and pressure localization')
  await resume.click()
  await expect(page.getByText('Lesson 2 of 8')).toBeVisible()
  const steps = page.getByRole('navigation', { name: 'Previous and next lesson' })
  await steps.getByRole('button', { name: /^Next lesson: 3\. / }).click()
  await expect(page).toHaveURL(/lesson=crrt-solute-transport/)
  await expect(page.getByText('Lesson 3 of 8')).toBeVisible()
  await page.goBack()
  await expect(page.getByText('Lesson 2 of 8')).toBeVisible()
  await page.goto('/en/baxter-crrt/learn?lesson=crrt-pressure-profile-integration')
  await expect(page.getByText('Lesson 8 of 8')).toBeVisible()
  await expect(steps.getByText('Last lesson')).toBeVisible()
})

test('Learn task: the exercise leads, the reason names what is left, skip stays usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/en/baxter-crrt/learn?lesson=crrt-circuit-pressures')
  const work = page.locator('[data-crrt-circuit-workbench]')
  const first = work.getByRole('button', { name: 'Patient access' })
  const last = work.getByRole('button', { name: /^Patient return/ })
  const circuit = work.locator('svg[data-overlay]')

  // The enlarged circuit and its first stop fit one screen together, within the systemic
  // adjacency budget (pair span under 680 px), and the drawing is larger than the old 0.60.
  await first.scrollIntoViewIfNeeded()
  const [stop, drawing] = [(await first.boundingBox())!, (await circuit.boundingBox())!]
  expect(
    Math.max(stop.y + stop.height, drawing.y + drawing.height) - Math.min(stop.y, drawing.y),
  ).toBeLessThan(680)
  const scale = await circuit.evaluate((svg) => {
    const box = svg.getBoundingClientRect()
    const viewBox = (svg as SVGSVGElement).viewBox.baseVal
    return Math.min(box.width / viewBox.width, box.height / viewBox.height)
  })
  expect(scale).toBeGreaterThan(0.7)

  await page.getByRole('button', { name: "Go to this task's continue controls" }).click()
  const actions = page.getByRole('group', { name: 'Continue from this task' })
  await expect(actions).toBeFocused()
  const primary = actions.getByRole('button', { name: 'Review observations and continue' })
  await expect(primary).toBeDisabled()
  await expect(actions).toContainText('Still to select, in order: Patient access')

  // Keyboard through the stops, first to last.
  for (const name of [
    'Patient access',
    'Pre-pump segment',
    'Blood pump',
    'Filter',
    'Return segment',
    'Patient return',
  ]) {
    const control = work.getByRole('button', { name: new RegExp(`^${name}(?: ✓)?$`) })
    await control.focus()
    await page.keyboard.press('Enter')
    expect(await control.evaluate((el) => el.matches(':focus-visible'))).toBe(true)
  }
  await expect(last).toHaveAttribute('aria-pressed', 'true')
  await expect(work.getByText('6 of 6 stops selected')).toBeVisible()
  await expect(primary).toBeEnabled()

  // Skip is a full-size button, reachable by keyboard.
  const skip = actions.getByRole('button', { name: 'Continue without this exercise' })
  const skipBox = (await skip.boundingBox())!
  expect(skipBox.height).toBeGreaterThanOrEqual(44)
  await skip.focus()
  await expect(skip).toBeFocused()
})

test('circuit expanded view: keyboard open, size, Escape back to the button', async ({ page }) => {
  await page.goto('/en/baxter-crrt/learn?lesson=crrt-circuit-pressures')
  const expand = page.getByRole('button', { name: 'Expand circuit' })
  await expand.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Canonical CRRT circuit · expanded' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '100%', exact: true }).click()
  const drawing = dialog.locator('svg[data-overlay]')
  const width = await drawing.evaluate((svg) => svg.getBoundingClientRect().width)
  expect(width).toBeGreaterThanOrEqual(1329)
  const minText = await drawing.evaluate((svg) =>
    Math.min(
      ...[...svg.querySelectorAll('text')]
        .map((text) => text.getBoundingClientRect().height)
        .filter((height) => height > 0),
    ),
  )
  expect(minText).toBeGreaterThanOrEqual(9)
  await expect(dialog.getByRole('group', { name: 'Line pattern legend' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(expand).toBeFocused()
})

test('membrane comparison and pressure arithmetic render beside their teaching', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/en/baxter-crrt/learn?lesson=crrt-solute-transport')
  const figure = page.getByRole('figure', { name: 'Filter inset · diffusion' })
  const panels = figure.locator('[data-mechanism]')
  await expect(panels).toHaveCount(3)
  const boxes = await panels.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width))
  for (const width of boxes) expect(width).toBeGreaterThan(300)
  await page.getByRole('button', { name: 'Convection' }).click()
  await expect(page.getByRole('figure', { name: 'Filter inset · convection' })).toBeVisible()

  await page.goto('/en/baxter-crrt/learn?lesson=crrt-circuit-pressures')
  for (let step = 0; step < 2; step++)
    await page.getByRole('button', { name: 'Continue without this exercise' }).click()
  const tmp = page.getByRole('region', { name: 'How this TMP is calculated now' })
  const drop = page.getByRole('region', { name: 'How this filter pressure drop is calculated now' })
  await expect(tmp).toContainText('(50 + 20) ÷ 2 − (−20) + (−18) = 37 mmHg')
  await expect(drop).toContainText('(50 − 20) + (−25) = 5 mmHg')
  await expect(drop).toContainText('placement held for device review')
})

test('the beta-wrapped route shows the same workbench without sideways overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/en/development-beta/baxter-crrt')
  // The wrapper is served without an account only in owner-local feedback mode.
  test.skip(
    (await page.locator('iframe').count()) === 0,
    'beta wrapper requires owner-local feedback mode or a signed-in account',
  )
  const frame = page.frameLocator('iframe')
  await page.locator('iframe').evaluate((el: HTMLIFrameElement) => {
    el.src = '/en/baxter-crrt/practice?case=CRRT-02'
  })
  await expect(
    frame.getByRole('region', { name: 'Live patient, prescription, and circuit' }),
  ).toBeVisible()
  const overflow = await frame
    .locator('html')
    .evaluate(() => document.documentElement.scrollWidth - innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
