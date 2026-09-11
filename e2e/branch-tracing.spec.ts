import { expect, test, type Page } from '@playwright/test'
import { LESSONS } from '../src/features/bronchial-branch-tracing/content/lessons'
import { ASSESS_TRACES } from '../src/features/bronchial-branch-tracing/content/practice'
import {
  traceById,
  pixelToDisplay,
} from '../src/features/bronchial-branch-tracing/geometry/native-ct'

const base = '/en/learn/anatomy/branch-tracing'
async function markTrace(page: Page, id: string, wrong = false) {
  const trace = traceById(id)
  for (let i = 0; i < 3; i++) {
    if (i === 0) await page.getByRole('button', { name: /^Mark 1:/ }).click()
    else
      await page
        .getByRole('group', { name: 'Airway checkpoints', exact: true })
        .getByRole('button')
        .nth(i + 1)
        .click()
    await expect(page.getByRole('button', { name: 'Lumen unresolved here' })).toBeEnabled()
    const svg = page.getByRole('group', { name: /^CT image\./ })
    const bounds = (await svg.boundingBox())!
    const point = wrong
      ? [10, 10]
      : pixelToDisplay(trace.checkpoints[i].pixel, trace.cropCenter, trace.cropSize, trace.preset)
    await svg.click({
      position: { x: (bounds.width * point[0]) / 100, y: (bounds.height * point[1]) / 100 },
    })
    await expect(
      page.getByLabel(`Your mark ${i + 1} for ${trace.checkpoints[i].airway.code}`, {
        exact: true,
      }),
    ).toBeVisible()
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
  test.setTimeout(240000)
  for (const lesson of LESSONS) {
    await page.goto(`${base}/learn?lesson=${lesson.id}`)
    await page.getByRole('button', { name: 'Trace this airway' }).click()
    await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Record trace' })).toBeDisabled()
    await markTrace(page, lesson.prediction, true)
    await page.getByRole('button', { name: 'Record trace' }).click()
    await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Airway course' }).selectOption('cranial')
    if (lesson.id === 'horizontal-vertical')
      await page.screenshot({ path: '/tmp/branch-tracing-ct-pending.png', fullPage: true })
    await page.getByRole('button', { name: 'Reveal CT comparison' }).click()
    await expect(page.locator('[data-ct-reference]').first()).toBeVisible()
    await expect(page.getByLabel(/^Your mark 3 for /)).toBeVisible()
    await page.getByRole('button', { name: 'Review the relationship' }).click()
    await page.getByRole('button', { name: 'Trace another airway' }).click()
    await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Compare new trace' })).toBeDisabled()
    await markTrace(page, lesson.transfer)
    await page.getByRole('combobox', { name: 'Airway course' }).selectOption('uncertain')
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
    await page.getByRole('button', { name: 'Record CT interpretation' }).click()
  }
  await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Trace 1 · recorded', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Airway course' })).toHaveValue('horizontal')
  await page.getByRole('button', { name: 'Trace 4 · recorded', exact: true }).click()
  await page.getByRole('combobox', { name: 'Airway course' }).selectOption('uncertain')
  await expect(page.getByRole('button', { name: 'Submit all CT interpretations' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Record CT interpretation' }).click()
  await page.getByRole('button', { name: 'Submit all CT interpretations' }).click()
  await expect(page.getByRole('heading', { name: 'CT interpretation debrief' })).toBeVisible()
  await expect(page.locator('[data-ct-reference]').first()).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export your CT worksheet' }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('bronchial-ct-interpretation.json')
  await page.screenshot({ path: '/tmp/branch-tracing-ct-debrief.png', fullPage: true })
  for (let i = 0; i < ASSESS_TRACES.length; i++) {
    const heading = page.getByRole('heading', { name: new RegExp(`^Trace ${i + 1} ·`) })
    await heading.scrollIntoViewIfNeeded()
    await expect(heading).toBeInViewport()
    const row = page.locator('section').filter({ has: heading })
    await row
      .getByRole('group', { name: 'Airway checkpoints', exact: true })
      .getByRole('button')
      .nth(3)
      .click()
    await expect(row.locator('[data-ct-reference="3"]')).toBeVisible()
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
      await page.getByRole('button', { name: 'Reveal CT comparison' }).click()
      await page.getByRole('button', { name: 'Review the relationship' }).click()
      await page.getByRole('button', { name: 'Trace another airway' }).click()
      trace = traceById(lesson.transfer)
    }
    await markTrace(page, trace.id)
    const expected = pixelToDisplay(
      trace.checkpoints[2].pixel,
      trace.cropCenter,
      trace.cropSize,
      'standard',
    )
    await page.getByRole('button', { name: 'Standard axial', exact: true }).click()
    const mark = page.getByLabel(/^Your mark 3 for /).locator('circle')
    expect(Number(await mark.getAttribute('cx'))).toBeCloseTo(expected[0], 0)
    expect(Number(await mark.getAttribute('cy'))).toBeCloseTo(expected[1], 0)
    await page.getByRole('button', { name: 'Book tracing view' }).click()
    await page.getByRole('button', { name: 'Expand CT', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Close expanded CT' })).toBeVisible()
    const levels = await page
      .getByRole('group', { name: 'Airway checkpoints', exact: true })
      .boundingBox()
    expect(levels!.y + levels!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
    await expect(page.getByLabel(/^Your mark 3 for /)).toBeVisible()
    await page.screenshot({ path: `/tmp/branch-tracing-expanded-${trace.preset}.png` })
    await page.getByRole('button', { name: 'Close expanded CT' }).click()
    await page.screenshot({ path: `/tmp/branch-tracing-ct-${trace.preset}.png`, fullPage: true })
  }
})
test('named RB5 checkpoints label the correct CT lumen after submission, including the RB5a transfer', async ({
  page,
}) => {
  await page.goto(`${base}/learn?lesson=horizontal-vertical`)
  await page.getByRole('button', { name: 'Trace this airway' }).click()
  await expect(
    page.getByRole('button', { name: 'Mark 1: Right medial segmental bronchus, proximal' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Mark 2: Right medial segmental bronchus, distal' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Mark 3: Right medial bronchus, subsegment b' }),
  ).toBeVisible()
  await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
  await markTrace(page, 'middle-lobe-caudal')
  await page.getByRole('button', { name: 'Record trace' }).click()
  await page.getByRole('combobox', { name: 'Airway course' }).selectOption('caudal')
  await page.getByRole('button', { name: 'Reveal CT comparison' }).click()
  const reference = page.getByLabel('Reference: Right medial bronchus, subsegment b', {
    exact: true,
  })
  await expect(reference.locator('text')).toHaveText('RB5b')
  await page.screenshot({ path: '/tmp/branch-tracing-named-rb5b.png', fullPage: true })
  await page.getByRole('button', { name: 'Expand CT', exact: true }).click()
  await page.screenshot({ path: '/tmp/branch-tracing-named-rb5b-expanded.png' })
  await page.getByRole('button', { name: 'Close expanded CT' }).click()
  await page.getByRole('button', { name: 'Review the relationship' }).click()
  await page.getByRole('button', { name: 'Trace another airway' }).click()
  await expect(
    page.getByRole('button', { name: 'Mark 3: Right medial bronchus, subsegment a' }),
  ).toBeVisible()
  await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
  await markTrace(page, 'middle-lobe-cranial')
  await page.getByRole('combobox', { name: 'Airway course' }).selectOption('horizontal')
  await page.getByRole('button', { name: 'Compare new trace' }).click()
  await expect(
    page
      .getByLabel('Reference: Right medial bronchus, subsegment a', { exact: true })
      .locator('text'),
  ).toHaveText('RB5a')
  await page.getByRole('button', { name: 'Expand CT', exact: true }).click()
  await page.screenshot({ path: '/tmp/branch-tracing-named-rb5a-expanded.png' })
  await page.getByRole('button', { name: 'Close expanded CT' }).click()
})
test('a missing native slice blocks marking and recovers without losing a recorded mark', async ({
  page,
}) => {
  const trace = traceById(LESSONS[0].prediction)
  await page.goto(`${base}/learn?lesson=orientation`)
  await page.getByRole('button', { name: 'Trace this airway' }).click()
  await markTrace(page, trace.id)
  const failedSlice = trace.checkpoints[2].slice + 1
  await page.route(`**/native-v1/axial/${failedSlice}.png`, (route) =>
    route.fulfill({ status: 404, body: 'missing' }),
  )
  await page.getByRole('slider', { name: 'CT slice', exact: true }).fill(String(failedSlice))
  await expect(page.getByRole('button', { name: 'Retry slice' })).toBeVisible()
  await page.unroute(`**/native-v1/axial/${failedSlice}.png`)
  await page.getByRole('button', { name: 'Retry slice' }).click()
  await expect(page.getByRole('button', { name: 'Retry slice' })).toHaveCount(0)
  await page
    .getByRole('group', { name: 'Airway checkpoints', exact: true })
    .getByRole('button')
    .nth(3)
    .click()
  await expect(page.getByLabel(/^Your mark 3 for /)).toBeVisible()
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
