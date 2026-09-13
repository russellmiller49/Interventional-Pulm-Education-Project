import { expect, test, type Page } from '@playwright/test'
import { LESSONS } from '../src/features/bronchial-branch-tracing/content/lessons'
import { localExercise } from '../src/features/bronchial-branch-tracing/content/local-exercises'
import { ASSESS_TRACES } from '../src/features/bronchial-branch-tracing/content/practice'
import {
  traceById,
  nativeImageUrl,
} from '../src/features/bronchial-branch-tracing/geometry/native-ct'

const base = '/en/learn/anatomy/branch-tracing'
async function showPane(page: Page, name: 'Steps' | 'Simulator') {
  const tab = page.getByRole('tab', { name, exact: true })
  if (await tab.isVisible()) await tab.click()
}
async function orient(page: Page, id: string) {
  await showPane(page, 'Simulator')
  const preset = traceById(id).preset
  await page.getByRole('button', { name: 'Reset to standard', exact: true }).click()
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
  await page.getByRole('button', { name: /^(Check orientation|Use this orientation)$/ }).click()
}
async function markRoute(page: Page, id: string, mode: 'learn' | 'practice' | 'assess') {
  const trace = traceById(id)
  await orient(page, id)
  for (const [i, point] of trace.checkpoints.entries()) {
    await showPane(page, 'Steps')
    if (point.decision) await page.locator('input[type="radio"][value="unresolved"]').check()
    await showPane(page, 'Simulator')
    await page.getByRole('button', { name: 'Go to answer slice', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Lumen unresolved here' })).toBeEnabled()
    await expect(page.locator(`[data-ct-reference="${i + 1}"]`)).toHaveCount(0)
    await page.getByRole('button', { name: 'Lumen unresolved here' }).click()
    await showPane(page, 'Steps')
    await page
      .getByRole('button', {
        name: point.decision
          ? mode === 'assess'
            ? 'Record this junction'
            : mode === 'learn'
              ? 'Check this junction'
              : 'Check this junction'
          : 'Record nodule approach',
        exact: true,
      })
      .click()
    await showPane(page, 'Simulator')
    if (mode === 'assess') await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
    else await expect(page.locator(`[data-ct-reference="${i + 1}"]`)).toBeVisible()
    await showPane(page, 'Steps')
    if (i < trace.checkpoints.length - 1)
      await page
        .getByRole('button', {
          name:
            i + 1 === trace.checkpoints.length - 1
              ? 'Inspect the distal airway–nodule relationship'
              : 'Next junction',
          exact: true,
        })
        .click()
  }
}
async function describe(page: Page) {
  await showPane(page, 'Steps')
  await page.getByRole('combobox', { name: 'Airway course' }).selectOption('uncertain')
  await page
    .getByRole('combobox', { name: 'Airway–nodule relationship' })
    .selectOption('unresolved')
}
async function markLocal(page: Page, exercise: ReturnType<typeof localExercise>) {
  for (const point of exercise.answerPoints) {
    await page
      .getByRole('button', {
        name: new RegExp(`^${point.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · slice`),
      })
      .click()
    await expect(page.getByRole('button', { name: 'Lumen unresolved here' })).toBeEnabled()
    await page.getByRole('button', { name: 'Lumen unresolved here' }).click()
  }
  if (exercise.spec.kind === 'pattern')
    await page.getByRole('combobox', { name: 'Airway course' }).selectOption('uncertain')
  if (exercise.spec.kind === 'integration')
    await page.getByRole('radio', { name: 'Continuation unresolved' }).check()
}

test('entry routes remain anonymous, unlisted, and lead to the first local skill', async ({
  page,
}) => {
  for (const suffix of ['', '/learn', '/practice', '/assess']) {
    const response = await page.goto(base + suffix)
    expect(response?.status()).toBe(200)
    expect(response?.headers()['x-robots-tag']).toContain('noindex')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  }
  await page.goto(base)
  await expect(
    page.getByRole('link', { name: /^(Start learning|Continue: Follow one airway)$/ }),
  ).toHaveAttribute('href', /lesson=follow-one-airway/)
  await page.screenshot({ path: '/tmp/branch-tracing-overview-updated.png', fullPage: true })
})

for (const lesson of LESSONS.filter((l) => l.exercises)) {
  test(`local teaching loop: ${lesson.id}`, async ({ page }) => {
    const warmup = lesson.exercises![0].kind === 'same-lumen'
    await page.goto(`${base}/learn?lesson=${lesson.id}`)
    if (lesson.exercises![0].kind === 'integration') {
      await page.getByRole('combobox', { name: 'Starting segmental bronchus' }).selectOption('LB6')
      await page.getByRole('button', { name: 'Use this starting parent' }).click()
    }
    await page
      .getByRole('button', { name: warmup ? 'Start tracing' : 'Your turn', exact: true })
      .click()
    for (const spec of lesson.exercises!) {
      const exercise = localExercise(spec)
      await expect(page.locator('[data-teaching-overlay]')).toHaveCount(0)
      await expect(page.locator('[data-ct-nodule]')).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: warmup ? 'Review my mark' : 'Check my tracing' }),
      ).toBeDisabled()
      await markLocal(page, exercise)
      await page
        .getByRole('button', { name: warmup ? 'Review my mark' : 'Check my tracing', exact: true })
        .click()
      await expect(page.getByRole('heading', { name: 'Review the image evidence' })).toBeVisible()
      if (spec.kind !== 'same-lumen') {
        await page.getByRole('button', { name: 'Relate the parent view', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Show parent airway view' })).toHaveCount(0)
        await page.getByText('Your progressive branch map', { exact: true }).click()
        await expect(page.getByRole('img', { name: /^Model direction schematic/ })).toHaveCount(
          lesson.exercises!.indexOf(spec) + 1,
        )
        await page.getByRole('button', { name: 'Opening unresolved' }).click()
        await expect(page.getByRole('button', { name: 'Show parent airway view' })).toBeVisible()
        await page.getByText('Your progressive branch map', { exact: true }).click()
      }
      await page
        .getByRole('button', {
          name: /^(Try another local example|Finish lesson|Next airway|Continue to bifurcations)$/,
        })
        .click()
    }
    if (warmup) {
      await expect(page).toHaveURL(/lesson=continuity/)
      await page.goto(`${base}/learn?lesson=${lesson.id}`)
    }
    await expect(
      page.getByRole('heading', {
        name: warmup ? 'Warm-up completed' : 'Local exercises recorded',
      }),
    ).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole('heading', {
        name: warmup ? 'Warm-up completed' : 'Local exercises recorded',
      }),
    ).toBeVisible()
  })
}

test('browsing, help, hints, retry and exit preserve separate attempts and native marks', async ({
  page,
}) => {
  const exercise = localExercise(LESSONS.find((l) => l.id === 'continuity')!.exercises![0])
  await page.goto(`${base}/learn?lesson=continuity`)
  await page.getByRole('button', { name: 'Your turn', exact: true }).click()
  await page.getByRole('button', { name: 'Go to answer slice' }).click()
  const image = page.getByRole('group', { name: /^CT image\./ })
  await image.focus()
  await image.press('Enter')
  await expect(page.getByLabel('Your mark 1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'More cranial CT slice' }).click()
  const slice = await page.getByRole('slider', { name: 'CT slice', exact: true }).inputValue()
  await expect(page.getByText(new RegExp(`Exploring slice ${slice}`))).toBeVisible()
  await page.getByRole('button', { name: 'What do I do now?' }).click()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'CT slice', exact: true })).toHaveValue(slice)
  await page.getByRole('button', { name: 'Save & exit' }).click()
  await page.getByRole('link', { name: lessonTitle('continuity'), exact: true }).click()
  await expect(page.getByRole('slider', { name: 'CT slice', exact: true })).toHaveValue(slice)
  await page.getByRole('button', { name: 'Go to answer slice' }).click()
  await expect(page.getByLabel('Your mark 1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '2. Return to the parent' }).click()
  await markLocal(page, exercise)
  await page.getByRole('button', { name: 'Check my tracing' }).click()
  const history = await page.evaluate(
    () => JSON.parse(localStorage.getItem('branch-tracing.draft.learn.continuity')!).value.history,
  )
  await page.getByRole('button', { name: 'Try this bifurcation again' }).click()
  await expect(page.locator('[data-teaching-overlay]')).toHaveCount(0)
  await markLocal(page, exercise)
  await page.getByRole('button', { name: 'Check my tracing' }).click()
  const next = await page.evaluate(
    () => JSON.parse(localStorage.getItem('branch-tracing.draft.learn.continuity')!).value.history,
  )
  expect(next[exercise.id]).toHaveLength(2)
  expect(next[exercise.id][0]).toEqual(history[exercise.id][0])
  await page.screenshot({ path: '/tmp/branch-tracing-comparison-updated.png' })
})
function lessonTitle(id: string) {
  return LESSONS.find((l) => l.id === id)!.title
}

test('the warm-up explains its purpose and keeps review beside the instruction after a mark and reload', async ({
  browser,
}) => {
  const exercise = localExercise(LESSONS[0].exercises![0])
  for (const [width, height] of [
    [2488, 885],
    [1993, 927],
    [1280, 720],
    [1024, 768],
    [900, 800],
    [390, 844],
    [320, 844],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 800 })
    const page = await context.newPage()
    await page.goto(`${base}/learn?lesson=follow-one-airway`)
    await expect(page.getByText(/This is a brief viewer warm-up/)).toBeVisible()
    await page.getByRole('button', { name: 'Start tracing', exact: true }).click()
    await page.getByRole('button', { name: '3. Replay the walkthrough' }).click()
    await page.getByRole('button', { name: 'Go to answer slice' }).click()
    await expect(page.getByRole('button', { name: 'Lumen unresolved here' })).toBeEnabled()
    const ct = page.getByRole('group', { name: /^CT image\./ })
    if (width < 800) await ct.tap()
    else {
      await ct.focus()
      await ct.press('Enter')
    }
    await expect(page.getByRole('heading', { name: 'Mark placed — ready to review' })).toBeVisible()
    const action = page.getByRole('button', { name: 'Review my mark', exact: true })
    await expect(action).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Next demonstration slice' })).toHaveCount(0)
    const instruction = (await page
      .locator('[data-current-task] [data-now-card] > p')
      .nth(1)
      .boundingBox())!
    const button = (await action.boundingBox())!
    expect(Math.abs(button.x - instruction.x)).toBeLessThanOrEqual(2)
    expect(button.y - (instruction.y + instruction.height)).toBeLessThanOrEqual(20)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Mark placed — ready to review' })).toBeVisible()
    await expect(page.getByText(/Your mark on slice 412 is ready/)).toBeVisible()
    await expect(page.getByText(/Answer slice 412: mark the lumen/)).toHaveCount(0)
    if (width >= 1024) {
      const workspace = (await page
        .getByRole('region', { name: 'CT tracing viewer' })
        .locator('..')
        .boundingBox())!
      const task = (await page.locator('[data-current-task]').boundingBox())!
      const image = (await ct.boundingBox())!
      expect(workspace.height / height).toBeGreaterThanOrEqual(0.7)
      expect(workspace.y / height).toBeLessThanOrEqual(0.25)
      expect(task.x + task.width).toBeLessThanOrEqual(workspace.x + 1)
      expect(image.y / height).toBeLessThanOrEqual(0.35)
      expect(image.width).toBeGreaterThanOrEqual(350)
      await expect(ct).toBeInViewport({ ratio: 0.99 })
      await expect(page.getByRole('button', { name: 'Go to answer slice' })).toBeInViewport()
      await expect(page.getByRole('slider', { name: 'CT slice', exact: true })).toBeInViewport()
    }
    await page.screenshot({ path: `/tmp/branch-tracing-warmup-marked-${width}.png` })
    await action.click()
    await page
      .getByRole('button', { name: `Starting slice ${exercise.trace.anchor.slice}` })
      .click()
    await expect(page.getByRole('slider', { name: 'CT slice', exact: true })).toHaveValue(
      String(exercise.trace.anchor.slice),
    )
    await page
      .getByRole('button', { name: `My response · slice ${exercise.answerPoints[0].slice}` })
      .click()
    await expect(page.getByRole('slider', { name: 'CT slice', exact: true })).toHaveValue(
      String(exercise.answerPoints[0].slice),
    )
    await expect(page.getByRole('button', { name: 'Next airway', exact: true })).toBeInViewport()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1)
    await page.screenshot({ path: `/tmp/branch-tracing-warmup-review-${width}.png` })
    await context.close()
  }
})

test('full-route integration still gates every fork and restores its draft', async ({ page }) => {
  test.setTimeout(180000)
  const lesson = LESSONS.find((l) => l.id === 'variants-limits')!
  await page.goto(`${base}/learn?lesson=${lesson.id}`)
  await page.getByRole('button', { name: 'Trace this airway' }).click()
  await markRoute(page, lesson.prediction, 'learn')
  await page.getByRole('button', { name: 'Record trace' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Reveal CT comparison' })).toBeDisabled()
  await describe(page)
  await page.getByRole('button', { name: 'Reveal CT comparison' }).click()
  await page.getByRole('button', { name: 'Review the relationship' }).click()
  await page.getByRole('button', { name: 'Trace another airway' }).click()
  await markRoute(page, lesson.transfer, 'learn')
  await describe(page)
  await page.getByRole('button', { name: 'Compare new trace' }).click()
  await page.getByRole('button', { name: 'Finish lesson' }).click()
  await expect(page.getByRole('heading', { name: 'CT trace completed' })).toBeVisible()
})

test('practice defaults to one coached route, reveals after each junction and retains retries', async ({
  page,
}) => {
  await page.goto(base + '/practice')
  await expect(page.getByRole('combobox', { name: 'Target segment' })).toHaveValue(
    'middle-lobe-lateral',
  )
  await page.getByRole('button', { name: 'Start CT practice' }).click()
  await expect(page.getByRole('heading', { name: 'Trace 1 of 1' })).toBeVisible()
  await orient(page, 'middle-lobe-lateral')
  await page.getByRole('radio', { name: 'Cannot establish the daughter branch' }).check()
  await page.getByRole('button', { name: 'Go to answer slice' }).click()
  await page.getByRole('button', { name: 'Lumen unresolved here' }).click()
  await page.getByRole('button', { name: 'Check this junction' }).click()
  await expect(page.locator('[data-branch-comparison]')).toBeVisible()
  await page.getByRole('button', { name: 'Retry this junction' }).click()
  await expect(page.locator('[data-branch-comparison]')).toHaveCount(0)
  await page.getByRole('radio', { name: 'Cannot establish the daughter branch' }).check()
  await page.getByRole('button', { name: 'Lumen unresolved here' }).click()
  await page.getByRole('button', { name: 'Check this junction' }).click()
  await expect(page.getByText(/2 recorded attempts/)).toBeVisible()
  await page.getByRole('button', { name: 'Save & exit' }).click()
  await page.goto(base + '/practice')
  await page.getByRole('button', { name: 'Start CT practice' }).click()
  await expect(page.getByText(/2 recorded attempts/)).toBeVisible()
})

test('assessment withholds all comparison overlays through reload and revisits until set submission', async ({
  page,
}) => {
  test.setTimeout(240000)
  await page.goto(base + '/assess')
  await page.getByRole('button', { name: 'Start CT interpretation' }).click()
  for (const id of ASSESS_TRACES) {
    await markRoute(page, id, 'assess')
    await describe(page)
    await page.getByRole('button', { name: 'Record CT interpretation' }).click()
  }
  await page.reload()
  await page.getByRole('button', { name: 'Start CT interpretation' }).click()
  await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Trace 1 · recorded', exact: true }).click()
  await expect(page.locator('[data-branch-comparison]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Trace 4 · recorded', exact: true }).click()
  await page.getByRole('button', { name: 'Submit all CT interpretations' }).click()
  await expect(page.getByRole('heading', { name: 'CT interpretation debrief' })).toBeVisible()
  await page.getByRole('button', { name: 'Current junction CT', exact: true }).first().click()
  await expect(page.locator('[data-ct-reference]').first()).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export your CT worksheet' }).click()
  expect((await download).suggestedFilename()).toBe('bronchial-ct-interpretation.json')
})

test('a submitted practice worksheet can reopen for repair without losing its first junction response', async ({
  page,
}) => {
  await page.goto(base + '/practice')
  await page.getByRole('button', { name: 'Start CT practice' }).click()
  await markRoute(page, 'middle-lobe-lateral', 'practice')
  await describe(page)
  await page.getByRole('button', { name: 'Record CT interpretation' }).click()
  await page.getByRole('button', { name: 'Submit all CT interpretations' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Start CT practice' }).click()
  await page.getByRole('button', { name: 'Review and retry these junctions' }).click()
  await page.getByRole('button', { name: 'Retry this junction' }).click()
  await expect(
    page.getByRole('button', { name: 'Record nodule approach', exact: true }),
  ).toBeDisabled()
  await expect(page.getByText(/Lumen mark needed in the CT tracing stack/)).toBeVisible()
  await page.getByRole('button', { name: 'Go to answer slice' }).click()
  await page.getByRole('button', { name: 'Lumen unresolved here' }).click()
  await page.getByRole('button', { name: 'Record nodule approach', exact: true }).click()
  await expect(page.getByText(/2 recorded attempts/)).toBeVisible()
})

test('asset failures explain recovery, blocked storage warns before exit, and incompatible drafts are disclosed', async ({
  page,
}) => {
  const ex = localExercise(LESSONS[0].exercises![0]),
    slice = ex.answerPoints[0].slice
  await page.route(`**${nativeImageUrl(slice)}`, (route) =>
    route.fulfill({ status: 404, body: 'missing' }),
  )
  await page.goto(`${base}/learn?lesson=follow-one-airway`)
  await page.getByRole('button', { name: 'Start tracing', exact: true }).click()
  await page.getByRole('button', { name: 'Go to answer slice' }).click()
  await expect(page.getByRole('button', { name: 'Retry slice' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lumen unresolved here' })).toBeDisabled()
  await page.unroute(`**${nativeImageUrl(slice)}`)
  await page.getByRole('button', { name: 'Retry slice' }).click()
  await expect(page.getByRole('button', { name: 'Lumen unresolved here' })).toBeEnabled()
  await page.evaluate(() => {
    const key = 'branch-tracing.draft.learn.follow-one-airway'
    const value = JSON.parse(localStorage.getItem(key)!)
    value.signature = 'old-geometry'
    localStorage.setItem(key, JSON.stringify(value))
  })
  await page.reload()
  await expect(page.getByText(/different lesson content or CT annotations/)).toBeVisible()
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Test storage failure')
    }
  })
  await page.reload()
  await page.getByRole('button', { name: 'Save & exit' }).click()
  await expect(page.getByRole('dialog')).toHaveText(
    'This draft could not be savedCloseLeaving now will lose changes since the last successful save. Keep working here, or leave without saving.Leave without saving',
  )
})

test('laptop and touch layouts keep the task, CT marking and action reachable without overflow', async ({
  browser,
}) => {
  for (const [width, height] of [
    [1280, 800],
    [720, 900],
    [390, 844],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 800 })
    const page = await context.newPage()
    await page.goto(`${base}/learn?lesson=continuity`)
    await page.getByRole('button', { name: 'Your turn', exact: true }).click()
    await page.getByRole('button', { name: 'Go to answer slice' }).click()
    await expect(page.getByRole('button', { name: 'Lumen unresolved here' })).toBeEnabled()
    const image = page.getByRole('group', { name: /^CT image\./ })
    if (width < 800) await image.tap()
    else {
      await image.focus()
      await image.press('Enter')
    }
    await expect(page.getByLabel('Your mark 1', { exact: true })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1)
    await expect(page.locator('[data-current-task]')).toBeInViewport()
    const taskBounds = (await page.locator('[data-current-task]').boundingBox())!
    expect(taskBounds.y).toBeGreaterThanOrEqual(width < 800 ? 60 : 0)
    await expect(page.getByRole('button', { name: 'Check my tracing' })).toBeInViewport()
    await page.screenshot({ path: `/tmp/branch-tracing-local-${width}.png` })
    await context.close()
  }
})

test('the existing CT explorer and virtual airway retain recoverable WebGL behavior', async ({
  page,
}) => {
  await page.goto(base + '/practice')
  await page.getByRole('button', { name: 'Open CT and airway explorer' }).click()
  const canvas = page.getByLabel('Exterior airway surface with selected CT plane', { exact: true })
  await expect(canvas).toBeVisible()
  await canvas.dispatchEvent('webglcontextlost', { cancelable: true })
  await expect(page.getByRole('button', { name: 'Reload 3D view' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Real CT slice' })).toBeEnabled()
  await page.getByRole('button', { name: 'Reload 3D view' }).click()
  await expect(canvas).toBeVisible()
})

test('native marks keep their identity across display transforms, zoom and resume', async ({
  page,
}) => {
  await page.goto(`${base}/learn?lesson=orientation`)
  await page.getByRole('button', { name: 'Your turn', exact: true }).click()
  await page.getByRole('button', { name: 'Go to answer slice' }).click()
  await expect(page.getByRole('button', { name: 'Lumen unresolved here' })).toBeEnabled()
  const image = page.getByRole('group', { name: /^CT image\./ })
  await image.focus()
  await image.press('Enter')
  const original = await page.evaluate(
    () => JSON.parse(localStorage.getItem('branch-tracing.draft.learn.orientation')!).value.marks,
  )
  const circle = page.getByLabel('Your mark 1', { exact: true }).locator('circle')
  for (const name of [
    /Rotate 90° left/,
    /Rotate 90° right/,
    /Flip left–right/,
    /Reset to standard/,
  ]) {
    await page.getByRole('button', { name }).click()
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('branch-tracing.draft.learn.orientation')!).value.marks,
      ),
    ).toEqual(original)
    await expect(circle).toBeVisible()
  }
  await page.getByText('Image details, orientation and controls', { exact: true }).click()
  await page.getByRole('slider', { name: 'CT magnification' }).fill('1.6')
  await page.reload()
  await page.getByRole('button', { name: 'Check my tracing' }).waitFor()
  await page.getByText('Image details, orientation and controls', { exact: true }).click()
  await expect(page.getByRole('slider', { name: 'CT magnification' })).toHaveValue('1.6')
  await expect(circle).toBeVisible()
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('branch-tracing.draft.learn.orientation')!).value.marks,
    ),
  ).toEqual(original)
})

test('nodule patches retain the native display transform and recover from asset failures', async ({
  page,
}) => {
  await page.goto(base + '/practice')
  await page.getByRole('combobox', { name: 'Target segment' }).selectOption('left-upper-anterior')
  await page.getByRole('button', { name: 'Start CT practice' }).click()
  await page.getByRole('button', { name: 'Show target', exact: true }).click()
  const patch = page.locator('[data-ct-nodule]')
  await expect(patch).toHaveCount(1)
  const url = (await patch.getAttribute('href'))!
  await page.getByRole('button', { name: /Rotate 90° right/ }).click()
  await expect(patch.locator('..')).toHaveAttribute('transform', /rotate\(90\)/)
  await page.getByText('Image details, orientation and controls', { exact: true }).click()
  await page.getByRole('button', { name: 'View original CT without nodule' }).click()
  await expect(patch).toHaveCount(0)
  await page.route(`**${url}`, (route) => route.fulfill({ status: 404, body: 'missing' }))
  await page.getByRole('button', { name: 'Restore simulated nodule' }).click()
  await expect(page.getByText(/The simulated nodule could not load/)).toBeVisible()
  await page.unroute(`**${url}`)
  await page.getByRole('button', { name: 'Retry slice' }).click()
  await expect(page.getByRole('button', { name: 'Retry slice' })).toHaveCount(0)
})
