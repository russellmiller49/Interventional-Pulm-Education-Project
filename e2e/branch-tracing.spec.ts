import { expect, test, type Page } from '@playwright/test'
import { LESSONS } from '../src/features/bronchial-branch-tracing/content/lessons'
import { ASSESS_TRACES } from '../src/features/bronchial-branch-tracing/content/practice'
import {
  traceById,
  pixelToDisplay,
  targetForTrace,
  nativeImageUrl,
} from '../src/features/bronchial-branch-tracing/geometry/native-ct'

const base = '/en/learn/anatomy/branch-tracing'
async function showPane(page: Page, name: 'Steps' | 'Simulator') {
  const tab = page.getByRole('tab', { name, exact: true })
  if (await tab.isVisible()) await tab.click()
}
async function orientTrace(page: Page, id: string) {
  await showPane(page, 'Simulator')
  await page.getByRole('button', { name: 'Reset to standard', exact: true }).click()
  const preset = traceById(id).preset
  await page
    .getByRole('button', {
      name:
        preset === 'mirror'
          ? /Flip left–right/
          : preset === 'rul'
            ? /Rotate 90° left/
            : /Rotate 90° right/,
    })
    .click()
  await showPane(page, 'Steps')
  const confirm = page.getByRole('button', { name: /^(Check orientation|Use this orientation)$/ })
  if (await confirm.count()) await confirm.click()
  await showPane(page, 'Simulator')
}
async function markTrace(
  page: Page,
  id: string,
  wrong = false,
  { start = 0, end = traceById(id).checkpoints.length, unresolved = false, keyboard = false } = {},
) {
  if (
    await page.getByRole('button', { name: /^(Check orientation|Use this orientation)$/ }).count()
  )
    await orientTrace(page, id)
  const trace = traceById(id)
  for (let i = start; i < end; i++) {
    const cp = trace.checkpoints[i]
    await showPane(page, 'Steps')
    if (cp.decision) {
      await expect(page.getByRole('radio')).toHaveCount(cp.decision.options.length + 1)
      const edge =
        wrong && i === 0
          ? cp.decision.options.find((o) => o.sourceEdgeId !== cp.sourceEdgeId)!.sourceEdgeId
          : cp.sourceEdgeId
      await page.locator(`input[type="radio"][value="${edge}"]`).check()
    }
    await showPane(page, 'Simulator')
    await expect(
      page.getByRole('button', { name: 'View next junction', exact: true }),
    ).toBeDisabled()
    await page.getByRole('button', { name: 'Current junction CT', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Lumen unresolved here' })).toBeEnabled()
    await expect(page.locator(`[data-ct-reference="${i + 1}"]`)).toHaveCount(0)
    const svg = page.getByRole('group', { name: /^CT image\./ })
    if (unresolved) await page.getByRole('button', { name: 'Lumen unresolved here' }).click()
    else if (keyboard) {
      await svg.focus()
      await svg.press('Enter')
    } else {
      const bounds = (await svg.boundingBox())!
      const point = wrong
        ? [10, 10]
        : pixelToDisplay(
            cp.pixel,
            cp.cropCenter ?? trace.cropCenter,
            cp.cropSize ?? trace.cropSize,
            trace.preset,
          )
      await svg.click({
        position: { x: (bounds.width * point[0]) / 100, y: (bounds.height * point[1]) / 100 },
      })
    }
    if (!unresolved)
      await expect(page.getByLabel(`Your mark ${i + 1}`, { exact: true })).toBeVisible()
    await showPane(page, 'Steps')
    await page
      .getByRole('button', {
        name: /^(Check this junction|Record this junction|Record nodule approach)$/,
      })
      .click()
    if (i + 1 < end)
      await page
        .getByRole('button', {
          name:
            i + 1 === trace.checkpoints.length - 1
              ? 'Continue to nodule approach'
              : 'Next junction',
          exact: true,
        })
        .click()
  }
}
test('anonymous routes are unlisted and the overview resolves the canonical first lesson', async ({
  page,
}) => {
  for (const suffix of ['', '/learn', '/practice', '/assess']) {
    const response = await page.goto(base + suffix)
    expect(response?.status()).toBe(200)
    expect(response?.headers()['x-robots-tag']).toContain('noindex')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    expect(page.url()).not.toContain('/login')
  }
  const image = await page.request.get('/branch-tracing/native-v1/axial/390.png')
  expect(image.status()).toBe(200)
  expect(image.headers()['content-type']).toContain('image/png')
  await page.goto(base)
  await expect(page.getByRole('link', { name: 'Start learning' })).toHaveAttribute(
    'href',
    new RegExp(`lesson=${LESSONS[0].id}`),
  )
  await page.screenshot({ path: '/tmp/branch-tracing-ct-overview.png', fullPage: true })
})
test('every lesson supports actual CT marking, withheld comparison, changed transfer and retained completion', async ({
  page,
}) => {
  test.setTimeout(420000)
  for (const lesson of LESSONS) {
    await page.goto(`${base}/learn?lesson=${lesson.id}`)
    await page.getByRole('button', { name: 'Trace this airway' }).click()
    await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Check orientation' })).toBeDisabled()
    await markTrace(page, lesson.prediction, true)
    await page.getByRole('button', { name: 'Record trace' }).click()
    await expect(page.locator('[data-ct-reference]').first()).toBeVisible()
    await page.getByRole('combobox', { name: 'Airway course' }).selectOption('cranial')
    await page
      .getByRole('combobox', { name: 'Airway–nodule relationship' })
      .selectOption('unresolved')
    if (lesson.id === 'horizontal-vertical')
      await page.screenshot({ path: '/tmp/branch-tracing-ct-pending.png', fullPage: true })
    await page.getByRole('button', { name: 'Reveal CT comparison' }).click()
    await expect(page.locator('[data-ct-reference]').first()).toBeVisible()
    await expect(page.getByLabel(/^Your mark \d+$/).last()).toBeVisible()
    await page.getByRole('button', { name: 'Review the relationship' }).click()
    await page.getByRole('button', { name: 'Trace another airway' }).click()
    await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Check orientation' })).toBeDisabled()
    await markTrace(page, lesson.transfer)
    await page.getByRole('combobox', { name: 'Airway course' }).selectOption('uncertain')
    await page
      .getByRole('combobox', { name: 'Airway–nodule relationship' })
      .selectOption('unresolved')
    await page.getByRole('button', { name: 'Compare new trace' }).click()
    await expect(page.getByRole('button', { name: 'Finish lesson' })).toBeVisible()
    await page.getByRole('button', { name: 'Finish lesson' }).click()
    await expect(page.getByRole('heading', { name: 'CT trace completed' })).toBeVisible()
  }
  await page.goto(base)
  await expect(page.getByText('8/8 complete', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Review the course' }).click()
  await expect(page.getByRole('button', { name: 'Trace this airway' })).toBeVisible()
})
test('independent interpretation withholds comparison through backtracking and edits until final submission', async ({
  page,
}) => {
  await page.goto(base + '/assess')
  await page.getByRole('button', { name: 'Start CT interpretation' }).click()
  for (const id of ASSESS_TRACES) {
    await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Tracing reminder' })).toHaveCount(0)
    await markTrace(page, id)
    await page.getByRole('combobox', { name: 'Airway course' }).selectOption('horizontal')
    await page
      .getByRole('combobox', { name: 'Airway–nodule relationship' })
      .selectOption('unresolved')
    await page.getByRole('button', { name: 'Record CT interpretation' }).click()
  }
  await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Trace 1 · recorded', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Airway course' })).toHaveValue('horizontal')
  await page.getByRole('button', { name: 'Trace 4 · recorded', exact: true }).click()
  await page.getByRole('combobox', { name: 'Airway course' }).selectOption('uncertain')
  await page
    .getByRole('combobox', { name: 'Airway–nodule relationship' })
    .selectOption('unresolved')
  await expect(page.getByRole('button', { name: 'Submit all CT interpretations' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Record CT interpretation' }).click()
  await page.getByRole('button', { name: 'Submit all CT interpretations' }).click()
  await expect(page.getByRole('heading', { name: 'CT interpretation debrief' })).toBeVisible()
  await page.getByRole('button', { name: 'Current junction CT', exact: true }).first().click()
  await expect(page.locator('[data-ct-reference]').first()).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export your CT worksheet' }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('bronchial-ct-interpretation.json')
  await page.screenshot({ path: '/tmp/branch-tracing-ct-debrief.png', fullPage: true })
  for (let i = 0; i < ASSESS_TRACES.length; i++) {
    const heading = page.getByRole('heading', { name: new RegExp(`^Target ${i + 1} ·`) })
    await heading.scrollIntoViewIfNeeded()
    await expect(heading).toBeInViewport()
    const row = page.locator('section').filter({ has: heading })
    await row.getByRole('button', { name: 'View next junction', exact: true }).click()
    await expect(row.locator('[data-ct-reference="2"]')).toBeVisible()
  }
  await page.screenshot({ path: '/tmp/branch-tracing-ct-debrief-last.png', fullPage: true })
})
test('book orientations rotate the actual CT and keep a learner point registered across views', async ({
  page,
}) => {
  for (const lessonId of ['orientation', 'vertical', 'horizontal-oblique']) {
    const lesson = LESSONS.find((l) => l.id === lessonId)!
    let trace = traceById(lesson.prediction)
    await page.goto(`${base}/learn?lesson=${lessonId}`)
    await page.getByRole('button', { name: 'Trace this airway' }).click()
    if (lessonId === 'horizontal-oblique') {
      await markTrace(page, trace.id)
      await page.getByRole('button', { name: 'Record trace' }).click()
      await page.getByRole('combobox', { name: 'Airway course' }).selectOption('cranial')
      await page
        .getByRole('combobox', { name: 'Airway–nodule relationship' })
        .selectOption('unresolved')
      await page.getByRole('button', { name: 'Reveal CT comparison' }).click()
      await page.getByRole('button', { name: 'Review the relationship' }).click()
      await page.getByRole('button', { name: 'Trace another airway' }).click()
      trace = traceById(lesson.transfer)
    }
    await markTrace(page, trace.id)
    const expected = pixelToDisplay(
      trace.checkpoints.at(-1)!.pixel,
      trace.cropCenter,
      trace.cropSize,
      'standard',
    )
    await page.getByRole('button', { name: 'Reset to standard', exact: true }).click()
    const mark = page
      .getByLabel(/^Your mark \d+$/)
      .last()
      .locator('circle')
    expect(Number(await mark.getAttribute('cx'))).toBeCloseTo(expected[0], 0)
    expect(Number(await mark.getAttribute('cy'))).toBeCloseTo(expected[1], 0)
    await orientTrace(page, trace.id)
    await page.getByRole('button', { name: 'Expand both views', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Close expanded views' })).toBeVisible()
    await page
      .getByRole('group', { name: 'Airway checkpoints', exact: true })
      .scrollIntoViewIfNeeded()
    const levels = await page
      .getByRole('group', { name: 'Airway checkpoints', exact: true })
      .boundingBox()
    expect(levels!.y + levels!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
    await expect(page.getByLabel(/^Your mark \d+$/).last()).toBeVisible()
    await page.screenshot({ path: `/tmp/branch-tracing-expanded-${trace.preset}.png` })
    await page.getByRole('button', { name: 'Close expanded views' }).click()
    await page.screenshot({ path: `/tmp/branch-tracing-ct-${trace.preset}.png`, fullPage: true })
  }
})
test('named RB5 checkpoints label the correct CT lumen after submission, including the RB5a transfer', async ({
  page,
}) => {
  await page.goto(`${base}/learn?lesson=horizontal-vertical`)
  await page.getByRole('button', { name: 'Trace this airway' }).click()
  await expect(page.getByText(/8 branch decisions, then the distal nodule approach/)).toBeVisible()
  await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
  await markTrace(page, 'middle-lobe-caudal')
  await page.getByRole('button', { name: 'Record trace' }).click()
  await page.getByRole('combobox', { name: 'Airway course' }).selectOption('caudal')
  await page
    .getByRole('combobox', { name: 'Airway–nodule relationship' })
    .selectOption('unresolved')
  await page.getByRole('button', { name: 'Reveal CT comparison' }).click()
  const reference = page.getByLabel(
    'Reference: Right medial bronchus, subsegment b, distal nodule approach',
    { exact: true },
  )
  await expect(reference.locator('text')).toHaveText('RB5b')
  await page.screenshot({ path: '/tmp/branch-tracing-named-rb5b.png', fullPage: true })
  await page.getByRole('button', { name: 'Expand both views', exact: true }).click()
  await page.screenshot({ path: '/tmp/branch-tracing-named-rb5b-expanded.png' })
  await page.getByRole('button', { name: 'Close expanded views' }).click()
  await page.getByRole('button', { name: 'Review the relationship' }).click()
  await page.getByRole('button', { name: 'Trace another airway' }).click()
  await expect(page.getByText(/8 branch decisions, then the distal nodule approach/)).toBeVisible()
  await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
  await markTrace(page, 'middle-lobe-cranial')
  await page.getByRole('combobox', { name: 'Airway course' }).selectOption('horizontal')
  await page
    .getByRole('combobox', { name: 'Airway–nodule relationship' })
    .selectOption('unresolved')
  await page.getByRole('button', { name: 'Compare new trace' }).click()
  await expect(
    page
      .getByLabel('Reference: Right medial bronchus, subsegment a, distal nodule approach', {
        exact: true,
      })
      .locator('text'),
  ).toHaveText('RB5a')
  await page.getByRole('button', { name: 'Expand both views', exact: true }).click()
  await page.screenshot({ path: '/tmp/branch-tracing-named-rb5a-expanded.png' })
  await page.getByRole('button', { name: 'Close expanded views' }).click()
})
test('a missing native slice blocks marking and recovers without losing a recorded mark', async ({
  page,
}) => {
  const trace = traceById(LESSONS[0].prediction)
  await page.goto(`${base}/learn?lesson=orientation`)
  await page.getByRole('button', { name: 'Trace this airway' }).click()
  await markTrace(page, trace.id)
  const failedSlice = trace.checkpoints.at(-1)!.slice + 1
  await page.route(`**${nativeImageUrl(failedSlice)}`, (route) =>
    route.fulfill({ status: 404, body: 'missing' }),
  )
  await page.getByRole('slider', { name: 'CT slice', exact: true }).fill(String(failedSlice))
  await expect(page.getByRole('button', { name: 'Retry slice' })).toBeVisible()
  await page.unroute(`**${nativeImageUrl(failedSlice)}`)
  await page.getByRole('button', { name: 'Retry slice' }).click()
  await expect(page.getByRole('button', { name: 'Retry slice' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Current junction CT', exact: true }).click()
  await expect(page.getByLabel(/^Your mark \d+$/).last()).toBeVisible()
})
test('real CT and airway surface load without sign-in; slices and camera remain independent', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(base + '/practice')
  await page.getByRole('button', { name: 'Open CT and airway explorer' }).click()
  await expect(page.getByRole('heading', { name: 'Your airway route' })).toBeVisible({
    timeout: 30000,
  })
  await expect(
    page.locator('canvas[aria-label="Exterior airway surface with selected CT plane"]'),
  ).toBeVisible({ timeout: 30000 })
  const slider = page.getByRole('slider', { name: 'Camera position along branch' })
  const initial = await slider.inputValue()
  await page.getByRole('slider', { name: 'Real CT slice' }).fill('159')
  await expect(slider).toHaveValue(initial)
  await page.getByRole('heading', { name: 'Teaching CT · axial stack' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/branch-tracing-real-ct.png', fullPage: true })
  await page.getByRole('button', { name: 'Virtual bronchoscopy', exact: true }).click()
  await expect(page.locator('canvas[aria-label="CT-derived virtual airway view"]')).toBeVisible()
  await page.screenshot({ path: '/tmp/branch-tracing-scope.png', fullPage: true })
  const slice = await page.getByRole('slider', { name: 'Real CT slice' }).inputValue()
  await page.getByRole('button', { name: 'Follow connected branch 1', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Real CT slice' })).toHaveValue(slice)
  await expect(page.getByRole('button', { name: 'Backtrack one branch' })).toBeEnabled()
  await page.getByRole('button', { name: 'Backtrack one branch' }).click()
  expect(errors).toEqual([])
})
test('compact layouts have no document overflow and retain usable pane switching', async ({
  page,
}) => {
  for (const [width, height] of [
    [1280, 720],
    [1024, 768],
    [900, 800],
    [390, 844],
    [320, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await page.goto(`${base}/learn?lesson=horizontal-vertical`)
    await expect(page.locator('[data-now-card]')).toHaveCount(1)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(1)
    const steps = page.getByRole('tab', { name: 'Steps', exact: true })
    if (await steps.isVisible()) {
      await steps.click()
      await expect(page.getByRole('button', { name: 'Trace this airway' })).toBeVisible()
      await steps.press('End')
      await expect(page.getByRole('tab', { name: 'Simulator', exact: true })).toBeFocused()
    }
    await page.screenshot({ path: `/tmp/branch-tracing-${width}.png`, fullPage: true })
  }
})

test('malformed geometry and a missing CT plane show recoverable errors', async ({ page }) => {
  await page.route('**/branch-tracing/preview-v1/geometry.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"frame":"wrong"}' }),
  )
  await page.goto(base + '/practice')
  await page.getByRole('button', { name: 'Open CT and airway explorer' }).click()
  await expect(page.getByRole('button', { name: 'Retry case' })).toBeVisible()
  await page.unroute('**/branch-tracing/preview-v1/geometry.json')
  await page.route('**/branch-tracing/preview-v1/axial/157.png', (route) =>
    route.fulfill({ status: 404, body: 'missing' }),
  )
  await page.getByRole('button', { name: 'Retry case' }).click()
  await expect(page.getByText(/This CT plane could not load/)).toBeVisible()
  await page.getByRole('button', { name: 'Next CT slice' }).click()
  await expect(page.getByText(/This CT plane could not load/)).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Follow connected branch 1', exact: true }),
  ).toBeEnabled()
})

test('blocked browser storage is disclosed, and a stale lesson link remains usable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Storage disabled for test')
    }
  })
  await page.goto(`${base}/learn?lesson=old-nonexistent-lesson`)
  await page.getByRole('button', { name: 'Trace this airway' }).click()
  await markTrace(page, LESSONS[0].prediction, true)
  await page.getByRole('button', { name: 'Record trace' }).click()
  await expect(
    page.getByText('Browser storage is unavailable. Work continues, but progress cannot be saved.'),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Trace this airway' })).toBeVisible()
})

test('WebGL context loss preserves the CT task and offers a surface retry', async ({ page }) => {
  await page.goto(base + '/practice')
  await page.getByRole('button', { name: 'Open CT and airway explorer' }).click()
  const canvas = page.locator('canvas[aria-label="Exterior airway surface with selected CT plane"]')
  await expect(canvas).toBeVisible({ timeout: 30000 })
  await canvas.dispatchEvent('webglcontextlost', { cancelable: true })
  await expect(page.getByRole('button', { name: 'Reload 3D view' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Real CT slice' })).toBeEnabled()
  await page.getByRole('button', { name: 'Reload 3D view' }).click()
  await expect(canvas).toBeVisible({ timeout: 30000 })
})

test('a selected segment uses a registered 3D nodule overlay and requires the distal relationship before debrief', async ({
  page,
}) => {
  await page.goto(base + '/practice')
  const selector = page.getByRole('combobox', { name: 'Target segment' })
  await expect(selector.locator('option')).toHaveCount(11)
  await selector.selectOption('left-upper-anterior')
  await page.getByRole('button', { name: 'Start CT practice' }).click()
  const trace = traceById('left-upper-anterior'),
    target = targetForTrace(trace)
  await expect(page.getByRole('heading', { name: 'Trace 1 of 1', exact: true })).toBeVisible()
  await expect(page.getByText('Loading CT slice…', { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show target', exact: true }).click()
  const overlay = page.locator('[data-ct-nodule]')
  await expect(overlay).toHaveAttribute('data-ct-nodule', target.id)
  const originalUrl = await overlay.getAttribute('href')
  await expect(page.getByRole('slider', { name: 'CT slice', exact: true })).toHaveValue(
    String(target.slice),
  )
  await page.getByRole('button', { name: 'More cranial CT slice' }).click()
  await expect(overlay).not.toHaveAttribute('href', originalUrl!)
  await page.getByRole('button', { name: 'Show target', exact: true }).click()
  await expect(overlay).toHaveAttribute('href', originalUrl!)
  await page.getByRole('button', { name: 'Reset to standard', exact: true }).click()
  await expect(overlay.locator('..')).toHaveAttribute('transform', /rotate\(0\)/)
  await orientTrace(page, trace.id)
  await page.getByRole('button', { name: 'Show target', exact: true }).click()
  await expect(overlay.locator('..')).toHaveAttribute('transform', /rotate\(90\)/)
  await page.getByText('Image details, orientation and controls', { exact: true }).click()
  await page.getByRole('button', { name: 'View original CT without nodule' }).click()
  await expect(overlay).toHaveCount(0)
  await expect(
    page.getByText('Original CT · simulated nodule hidden', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Restore simulated nodule' }).click()
  await expect(overlay).toHaveAttribute('href', originalUrl!)
  await page.getByText('Image details, orientation and controls', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Record this junction' })).toBeDisabled()
  await page.getByRole('button', { name: 'Expand both views', exact: true }).click()
  await page.screenshot({ path: '/tmp/branch-tracing-target-ls3-expanded.png' })
  await page.getByRole('button', { name: 'Close expanded views' }).click()
  await markTrace(page, trace.id, true)
  await page.getByRole('combobox', { name: 'Airway course' }).selectOption('cranial')
  await expect(page.getByRole('button', { name: 'Record CT interpretation' })).toBeDisabled()
  await page
    .getByRole('combobox', { name: 'Airway–nodule relationship' })
    .selectOption('different-structure')
  await page.getByRole('button', { name: 'Record CT interpretation' }).click()
  await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Submit all CT interpretations' }).click()
  await expect(page.getByText('Possible adjacent structure.', { exact: false })).toBeVisible()
  await expect(
    page.getByText(/Return to the parent junction and follow the air column again/),
  ).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export your CT worksheet' }).click()
  const download = await downloadPromise
  const stream = await download.createReadStream(),
    chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(chunk)
  const worksheet = JSON.parse(Buffer.concat(chunks).toString())
  expect(worksheet.traces).toHaveLength(1)
  expect(worksheet.traces[0].target).toMatchObject({
    id: target.id,
    segment: { code: 'LS3' },
    simulated: true,
  })
  expect(worksheet.traces[0].interpretation.targetRelation).toBe('different-structure')
  expect(worksheet.traces[0].interpretation.branches).toHaveLength(trace.checkpoints.length)
  expect(worksheet.traces[0].interpretation.branches[0]).toBe(1) // Deliberately chose right at the carina for a left target.
  expect(worksheet.branchRouteVersion).toBe('branch-tracing-decisions/v1')
})

test('a failed nodule patch is disclosed and recovers while retaining the recorded airway marks', async ({
  page,
}) => {
  const trace = traceById('middle-lobe-caudal'),
    target = targetForTrace(trace)
  await page.goto(base + '/practice')
  await page.getByRole('combobox', { name: 'Target segment' }).selectOption(trace.id)
  await page.getByRole('button', { name: 'Start CT practice' }).click()
  await markTrace(page, trace.id)
  await page.route(`**/targets-v1/patches/${target.id}/*.png`, (route) =>
    route.fulfill({ status: 404, body: 'missing' }),
  )
  await page.getByRole('button', { name: 'Show target', exact: true }).click()
  await expect(
    page.getByText('The simulated nodule could not load.', { exact: false }),
  ).toBeVisible()
  await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
  await page.unroute(`**/targets-v1/patches/${target.id}/*.png`)
  await page.getByRole('button', { name: 'Retry slice' }).click()
  await expect(page.getByRole('button', { name: 'Retry slice' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Current junction CT', exact: true }).click()
  await expect(page.getByLabel(/^Your mark \d+$/).last()).toBeVisible()
})

test('a phone learner can inspect the nodule, mark the airway and submit a chosen-segment interpretation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base + '/practice')
  await page.getByRole('combobox', { name: 'Target segment' }).selectOption('left-lingula')
  await page.getByRole('button', { name: 'Start CT practice' }).click()
  await page.getByRole('button', { name: 'Show target', exact: true }).click()
  await expect(page.locator('[data-ct-nodule]')).toHaveAttribute(
    'data-ct-nodule',
    'l-inferior-lingula',
  )
  await orientTrace(page, 'left-lingula')
  await markTrace(page, 'left-lingula', false, { keyboard: true })
  await page.getByRole('tab', { name: 'Steps', exact: true }).click()
  await page.getByRole('combobox', { name: 'Airway course' }).selectOption('caudal')
  await page
    .getByRole('combobox', { name: 'Airway–nodule relationship' })
    .selectOption('unresolved')
  await page.getByRole('button', { name: 'Record CT interpretation' }).click()
  await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Submit all CT interpretations' }).click()
  await expect(page.getByRole('heading', { name: 'CT interpretation debrief' })).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
})

test('the paired orientation exercise starts standard, preserves a wrong first choice and synchronizes same-plane RB5 stations', async ({
  page,
}) => {
  await page.goto(`${base}/learn?lesson=horizontal-vertical`)
  await expect(
    page.getByRole('heading', { name: 'Turn the CT into the tracing convention' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Trace this airway' }).click()
  await expect(page.locator('[data-preset]')).toHaveAttribute('data-preset', 'standard')
  await expect(page.getByRole('button', { name: 'Check orientation' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Show book convention' })).toHaveCount(0)
  await expect(page.getByText(/the book uses left–right reflection/i)).toHaveCount(0)
  await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
  await page.getByRole('button', { name: /Rotate 90° right/ }).click()
  await page.getByRole('button', { name: 'Check orientation' }).click()
  await expect(page.getByText('Recheck the direction letters', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lumen unresolved here' })).toHaveCount(0)
  await orientTrace(page, 'middle-lobe-caudal')
  await markTrace(page, 'middle-lobe-caudal', false, { end: 6 })
  const canvas = page.getByLabel('CT-derived virtual airway view', { exact: true })
  await expect(canvas).toBeVisible({ timeout: 30000 })
  const first = await page.locator('[data-scope-position]').getAttribute('data-scope-position')
  await page.getByRole('button', { name: 'Next junction', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'CT slice', exact: true })).toHaveValue('299')
  await expect(page.locator('[data-scope-position]')).not.toHaveAttribute(
    'data-scope-position',
    first!,
  )
  const ctBox = (await page.locator('[data-preset]').boundingBox())!,
    scopeBox = (await canvas.boundingBox())!
  expect(scopeBox.x).toBeGreaterThan(ctBox.x + ctBox.width - 1)
  expect(Math.abs(scopeBox.y - ctBox.y)).toBeLessThan(2)
  expect(ctBox.width).toBeGreaterThan(200)
  await expect
    .poll(() =>
      canvas.evaluate((element: HTMLCanvasElement) => {
        const gl = element.getContext('webgl2')!
        const pixel = new Uint8Array(4)
        gl.readPixels(
          Math.floor(element.width / 2),
          Math.floor(element.height / 2),
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixel,
        )
        return pixel[0]
      }),
    )
    .toBeGreaterThan(40)
  await markTrace(page, 'middle-lobe-caudal', false, { start: 6 })
  await page.getByRole('button', { name: 'Record trace' }).click()
  await page.getByRole('combobox', { name: 'Airway course' }).selectOption('caudal')
  await page
    .getByRole('combobox', { name: 'Airway–nodule relationship' })
    .selectOption('unresolved')
  await page.getByRole('button', { name: 'Reveal CT comparison' }).click()
  await expect(
    page.getByText(/first choice 90° clockwise; recorded left–right reflection/),
  ).toBeVisible()
  await canvas.dispatchEvent('webglcontextlost', { cancelable: true })
  await expect(page.getByRole('button', { name: 'Reload 3D view' })).toBeVisible()
  await expect(page.getByLabel(/^Your mark \d+$/).last()).toBeVisible()
  await page.getByRole('button', { name: 'Reload 3D view' }).click()
  await expect(canvas).toBeVisible({ timeout: 30000 })
})

test('independent orientation records the actual wrong choice and withholds the book convention until debrief', async ({
  page,
}) => {
  await page.goto(base + '/practice')
  await page.getByRole('combobox', { name: 'Target segment' }).selectOption('left-upper-anterior')
  await expect(page.getByRole('img', { name: /on real CT, in standard axial view/ })).toBeVisible()
  await page.getByRole('button', { name: 'Start CT practice' }).click()
  await expect(page.locator('[data-preset]')).toHaveAttribute('data-preset', 'standard')
  await page.getByRole('button', { name: /Flip left–right/ }).click()
  await page.getByRole('button', { name: 'Use this orientation' }).click()
  await expect(page.getByRole('button', { name: 'Show book convention' })).toHaveCount(0)
  await expect(page.getByText(/book convention for this region is/)).toHaveCount(0)
  await markTrace(page, 'left-upper-anterior', true, { unresolved: true })
  await page.getByRole('combobox', { name: 'Airway course' }).selectOption('uncertain')
  await page
    .getByRole('combobox', { name: 'Airway–nodule relationship' })
    .selectOption('unresolved')
  await page.getByRole('button', { name: 'Record CT interpretation' }).click()
  await page.getByRole('button', { name: 'Submit all CT interpretations' }).click()
  await expect(
    page.getByText(/first choice left–right reflection; recorded left–right reflection/),
  ).toBeVisible()
  await expect(page.getByText(/book convention for this region is 90° clockwise/)).toBeVisible()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export your CT worksheet' }).click()
  const stream = await (await downloading).createReadStream(),
    chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(chunk)
  const worksheet = JSON.parse(Buffer.concat(chunks).toString())
  expect(worksheet.traces[0].interpretation.orientation).toEqual({
    first: { turns: 0, reflected: true },
    used: { turns: 0, reflected: true },
  })
})

test('viewing the nodule cannot skip a fork, and backtracking to another case preserves recorded junction responses', async ({
  page,
}) => {
  await page.goto(base + '/assess')
  await page.getByRole('button', { name: 'Start CT interpretation' }).click()
  await page.getByRole('button', { name: 'Show target', exact: true }).click()
  await expect(page.getByRole('button', { name: 'View next junction', exact: true })).toBeDisabled()
  await markTrace(page, ASSESS_TRACES[0], false, { unresolved: true })
  await page.getByRole('combobox', { name: 'Airway course' }).selectOption('uncertain')
  await page
    .getByRole('combobox', { name: 'Airway–nodule relationship' })
    .selectOption('unresolved')
  await page.getByRole('button', { name: 'Record CT interpretation' }).click()
  await markTrace(page, ASSESS_TRACES[1], true, { end: 1, unresolved: true })
  await page.getByRole('button', { name: 'Trace 1 · recorded', exact: true }).click()
  await page.getByRole('button', { name: 'Trace 2', exact: true }).click()
  await expect(page.getByRole('radio')).toHaveCount(0)
  await expect(page.getByText(/Your recorded choice: LMSB/)).toBeVisible()
  await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Next junction', exact: true }).click()
  await expect(page.getByRole('radio')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'View next junction', exact: true })).toBeDisabled()
})
