import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import { LESSONS } from '../src/features/bronchial-branch-tracing/content/lessons'
import { localExercise } from '../src/features/bronchial-branch-tracing/content/local-exercises'
import {
  ASSESS_TRACES,
  SEGMENT_PRACTICE_TRACES,
} from '../src/features/bronchial-branch-tracing/content/practice'
import { traceById } from '../src/features/bronchial-branch-tracing/geometry/native-ct'

const base = '/en/learn/anatomy/branch-tracing'
const evidence = '/tmp/bronchial-flow-evidence'
fs.mkdirSync(evidence, { recursive: true })
const button = (page: Page, name: string | RegExp) =>
  page.getByRole('button', { name, exact: typeof name === 'string' })
async function ctReady(page: Page) {
  await expect(page.locator('[data-ct-ready]').first()).toHaveAttribute('data-ct-ready', 'true')
}
async function capture(page: Page, name: string) {
  await page.screenshot({
    path: `${evidence}/${name}.png`,
    fullPage: page.viewportSize()!.width < 1024,
  })
}
async function draft(page: Page, id: string) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(`branch-tracing.draft.learn.${key}`)!).value,
    id,
  )
}
async function focusAirway(page: Page) {
  await button(page, 'Focus on this airway').click()
}
async function learnDisplayChange(page: Page) {
  await button(
    page,
    /^(Compare with the caudal tracing view|Rotate 90° counterclockwise|Rotate 90° clockwise)$/,
  ).click()
  await expect(page.locator('[data-comparison-ready]')).toHaveAttribute(
    'data-comparison-ready',
    'true',
  )
  await button(page, 'Only the CT display orientation').click()
  await button(page, 'Apply this to the same airway').click()
  await ctReady(page)
}
async function finishPendingIntroduction(page: Page) {
  if (await button(page, 'Focus on this airway').isVisible()) await focusAirway(page)
  if (
    await button(
      page,
      /^(Compare with the caudal tracing view|Rotate 90° counterclockwise|Rotate 90° clockwise)$/,
    ).isVisible()
  )
    await learnDisplayChange(page)
}
async function startLocal(page: Page, id: string) {
  await page.goto(`${base}/learn?lesson=${id}`)
  await ctReady(page)
  await finishPendingIntroduction(page)
  await button(page, /^(Start marking branches|Start tracing)$/).click()
  await ctReady(page)
}
async function markLocal(
  page: Page,
  exercise: ReturnType<typeof localExercise>,
  firstMark = false,
) {
  for (const [i, point] of exercise.answerPoints.entries()) {
    await button(
      page,
      new RegExp(`^${point.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · slice`),
    ).click()
    await ctReady(page)
    if (firstMark && i === 0) await page.getByRole('group', { name: /^CT image\./ }).press('Enter')
    else await button(page, 'Lumen unresolved here').click()
  }
  if (['pattern', 'integration'].includes(exercise.spec.kind))
    await page
      .getByRole('combobox', { name: 'Airway course' })
      .selectOption(exercise.spec.kind === 'integration' ? 'returning' : 'uncertain')
  if (exercise.spec.kind === 'integration')
    await page.getByRole('radio', { name: 'Continuation unresolved' }).check()
  await button(page, 'Check my tracing').click()
  await ctReady(page)
}
async function parentApplication(page: Page, independent = false) {
  await button(page, independent ? 'Continue to branch matching' : 'Study the parent view').click()
  await finishPendingIntroduction(page)
  if (independent) await button(page, 'Opening unresolved').click()
}
async function orient(page: Page) {
  await ctReady(page)
  await button(page, 'Use this orientation').click()
  await ctReady(page)
}
async function markRoute(page: Page, id: string, mode: 'learn' | 'practice' | 'assess') {
  const trace = traceById(id)
  await orient(page)
  for (const [i, point] of trace.checkpoints.entries()) {
    if (point.decision) await page.locator('input[type="radio"][value="unresolved"]').check()
    await button(page, 'Go to response slice').click()
    await ctReady(page)
    await expect(page.locator(`[data-ct-reference="${i + 1}"]`)).toHaveCount(0)
    await button(page, 'Lumen unresolved here').click()
    await button(
      page,
      point.decision
        ? mode === 'assess'
          ? 'Record this junction'
          : 'Check this junction'
        : 'Record nodule approach',
    ).click()
    if (mode === 'assess') {
      await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
      await expect(page.getByText('model continuation', { exact: false })).toHaveCount(0)
      await expect(button(page, 'Show parent airway view')).toHaveCount(0)
    } else await expect(page.locator(`[data-ct-reference="${i + 1}"]`)).toBeVisible()
    if (i < trace.checkpoints.length - 1)
      await button(
        page,
        i + 1 === trace.checkpoints.length - 1
          ? 'Inspect the distal airway–nodule relationship'
          : 'Continue to the next division',
      ).click()
  }
}
async function describe(page: Page) {
  await button(page, 'Show target').click()
  await ctReady(page)
  await page.getByRole('combobox', { name: 'Airway course' }).selectOption('uncertain')
  await page
    .getByRole('combobox', { name: 'Airway–nodule relationship' })
    .selectOption('unresolved')
}

test('canonical routes retain anonymous access and noindex boundaries', async ({ page }) => {
  for (const path of [
    base,
    `${base}/learn`,
    `${base}/practice`,
    `${base}/assess`,
    '/learn/anatomy/branch-tracing',
    '/es/learn/anatomy/branch-tracing',
    '/zh-CN/learn/anatomy/branch-tracing',
  ]) {
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
    expect(response?.headers()['x-robots-tag']).toContain('noindex')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  }
  await page.goto(base)
  await page.getByRole('link', { name: /^(Start learning|Continue: Follow one airway)$/ }).click()
  await expect(page).toHaveURL(/lesson=follow-one-airway/)
})

test('opening journey: familiar CT, two same-lumen intervals, observer comparison, negative answer, restored display and coached bifurcation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(base)
  await page.getByRole('link', { name: 'Start learning' }).click()
  await ctReady(page)
  await expect(page.locator('[data-preset]')).toHaveAttribute('data-preset', 'standard')
  await expect(page.locator('[data-preset] > span')).toHaveText(['A', 'L', 'P', 'R'])
  await expect(button(page, 'Airway detail')).toBeVisible()
  await capture(page, '01-standard-full-field')
  await focusAirway(page)
  await button(page, 'Start tracing').click()
  await markLocal(page, localExercise(LESSONS[0].exercises![0]), true)
  const first = (await draft(page, 'follow-one-airway')).history
  await capture(page, '02-same-lumen-comparison')
  await page.reload()
  await ctReady(page)
  expect((await draft(page, 'follow-one-airway')).history).toEqual(first)
  await button(page, 'Next airway interval').click()
  await markLocal(page, localExercise(LESSONS[0].exercises![1]))
  await button(page, /^Next lesson:/).click()
  await expect(page).toHaveURL(/lesson=orientation/)
  await ctReady(page)
  await focusAirway(page)
  await expect(
    page.getByRole('heading', { name: 'Patient, display and parent-airway viewpoint' }),
  ).toBeVisible()
  const before = await page.locator('[data-comparison-copy] image').evaluateAll((els) =>
    els.map((e) => ({
      url: e.getAttribute('href'),
      transform: e.parentElement!.getAttribute('transform'),
    })),
  )
  expect(before[0]).toEqual(before[1])
  await capture(page, '03-observer-reference')
  await button(page, 'Compare with the caudal tracing view').click()
  const after = await page.locator('[data-comparison-copy] image').evaluateAll((els) =>
    els.map((e) => ({
      url: e.getAttribute('href'),
      transform: e.parentElement!.getAttribute('transform'),
    })),
  )
  expect(after[0]).toEqual(before[0])
  expect(after[1].url).toBe(before[1].url)
  expect(after[1].transform).not.toBe(before[1].transform)
  await button(page, 'The CT became a bronchoscopic image').click()
  await expect(button(page, 'Apply this to the same airway')).toBeDisabled()
  await capture(page, '04-negative-comprehension')
  await page.reload()
  await expect(page.getByText(/Restored display:/)).toBeVisible()
  await capture(page, '05-restored-transform')
  await button(page, 'Return to standard axial').click()
  await button(page, 'Replay comparison').click()
  expect(Object.keys((await draft(page, 'orientation')).history)).toHaveLength(0)
  await button(page, 'Only the CT display orientation').click()
  await button(page, 'Apply this to the same airway').click()
  await button(page, 'Start tracing').click()
  await markLocal(page, localExercise(LESSONS[1].exercises![0]))
  await button(page, /^Next lesson:/).click()
  await expect(page).toHaveURL(/lesson=continuity/)
  await ctReady(page)
  await focusAirway(page)
  await button(page, 'Start marking branches').click()
  await markLocal(page, localExercise(LESSONS[2].exercises![0]))
  await parentApplication(page)
  await expect(button(page, 'Opening 1')).toHaveCount(0)
  await capture(page, '06-guided-parent-relationship')
  await button(page, 'Next example: LLL').click()
  await markLocal(page, localExercise(LESSONS[2].exercises![1]))
  await parentApplication(page, true)
  await button(page, 'Finish lesson').click()
  await expect(page.getByRole('link', { name: /^Next lesson:/ })).toHaveAttribute(
    'href',
    `${base}/learn?lesson=vertical`,
  )
})

for (const id of ['vertical', 'horizontal-horizontal', 'horizontal-vertical', 'horizontal-oblique'])
  test(`local pattern ${id}: own explanation, guided relationship, second interval and completion`, async ({
    page,
  }) => {
    const lesson = LESSONS.find((l) => l.id === id)!
    await page.goto(`${base}/learn?lesson=${id}`)
    await ctReady(page)
    await expect(page.getByText(lesson.teaching[0], { exact: true })).toBeVisible()
    await expect(page.locator('[data-preset]')).toHaveAttribute('data-preset', 'standard')
    await button(page, 'Start marking branches').click()
    await markLocal(page, localExercise(lesson.exercises![0]), true)
    await parentApplication(page)
    await capture(page, `${id}-parent-pair`)
    await button(page, /^Next example:/).click()
    await markLocal(page, localExercise(lesson.exercises![1]))
    await expect(button(page, 'Opening 1')).toHaveCount(0)
    await button(page, 'Finish lesson').click()
    await expect(page.getByRole('heading', { name: 'Lesson completed' })).toBeVisible()
  })

test('short route: declared approach reversal, all connected divisions, map growth, uncertainty and prior review', async ({
  page,
}) => {
  const lesson = LESSONS.find((l) => l.id === 'orientation-changes')!
  await page.goto(`${base}/learn?lesson=${lesson.id}`)
  await ctReady(page)
  await button(page, 'Replay from parent').click()
  await ctReady(page)
  await expect(page.getByText(/Approach context, slice/).first()).toBeVisible()
  await button(page, 'Start marking branches').click()
  for (const [i, spec] of lesson.exercises!.entries()) {
    await markLocal(page, localExercise(spec))
    await expect(page.locator('[data-map-division]')).toHaveCount(i + 1)
    await expect(page.locator('[data-map-division]').last()).toContainText('unresolved')
    await capture(page, `short-route-map-${i + 1}`)
    if (i < lesson.exercises!.length - 1) await button(page, /^Next example:/).click()
  }
  const before = await draft(page, lesson.id)
  await button(page, 'Review division 1').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await button(page, 'Close').click()
  expect((await draft(page, lesson.id)).history).toEqual(before.history)
  await button(page, 'Finish lesson').click()
  await expect(page.getByRole('heading', { name: 'Lesson completed' })).toBeVisible()
})

test('complete Learn route covers every fork, target inspection, review and second interpretation', async ({
  page,
}) => {
  const lesson = LESSONS.find((l) => l.id === 'variants-limits')!
  await page.goto(`${base}/learn?lesson=${lesson.id}`)
  await ctReady(page)
  await button(page, 'Trace this airway').click()
  await markRoute(page, lesson.prediction, 'learn')
  await button(page, 'Record trace').click()
  await describe(page)
  await button(page, 'Reveal CT comparison').click()
  await capture(page, 'complete-route-comparison')
  await button(page, 'Review the relationship').click()
  await button(page, 'Trace another airway').click()
  await markRoute(page, lesson.transfer, 'learn')
  await describe(page)
  await button(page, 'Compare new trace').click()
  await button(page, 'Finish lesson').click()
  await expect(page.getByRole('heading', { name: 'CT trace completed' })).toBeVisible()
})

test('coached Practice preserves retries and first responses, gates target inspection and exports a debrief', async ({
  page,
}) => {
  const id = SEGMENT_PRACTICE_TRACES[2]
  await page.goto(`${base}/practice`)
  await button(page, 'Start CT practice').click()
  await ctReady(page)
  await expect(button(page, 'Use this orientation')).toBeEnabled()
  await markRoute(page, id, 'practice')
  await page.getByRole('combobox', { name: 'Airway course' }).selectOption('uncertain')
  await page
    .getByRole('combobox', { name: 'Airway–nodule relationship' })
    .selectOption('unresolved')
  await expect(button(page, 'Record CT interpretation')).toBeDisabled()
  await describe(page)
  await button(page, 'Record CT interpretation').click()
  await button(page, 'Submit all CT interpretations').click()
  await expect(page.getByRole('heading', { name: 'CT interpretation debrief' })).toBeVisible()
  await capture(page, 'practice-debrief')
  const download = page.waitForEvent('download')
  await button(page, 'Export your CT worksheet').click()
  const file = await download
  await file.saveAs(`${evidence}/practice-worksheet.json`)
  const worksheet = JSON.parse(fs.readFileSync(`${evidence}/practice-worksheet.json`, 'utf8'))
  expect(worksheet.sourceCaseCount).toBe(1)
  await button(page, 'Review and retry these junctions').click()
  await button(page, 'Review division 1').click()
  await button(page, 'Retry this junction').click()
  await page.locator('input[type="radio"][value="unresolved"]').check()
  await button(page, 'Go to response slice').click()
  await ctReady(page)
  await button(page, 'Lumen unresolved here').click()
  await button(page, 'Check this junction').click()
  const attempts = await page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([k]) => k.startsWith('branch-tracing.draft.practice.'))
      .map(([, v]) => JSON.parse(v).value.attempts),
  )
  expect(
    Object.values(attempts[0]).some(
      (a) => (a as { support: string }[]).at(-1)?.support === 'after-comparison',
    ),
  ).toBe(true)
  await page.getByText('First response and retries · 2 recorded', { exact: true }).click()
  await button(page, 'Inspect response 1').click()
  await expect(page.getByRole('dialog', { name: 'Recorded response · review only' })).toBeVisible()
  await button(page, 'Close').click()
  const afterReview = await page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([k]) => k.startsWith('branch-tracing.draft.practice.'))
      .map(([, v]) => JSON.parse(v).value.attempts),
  )
  expect(afterReview).toEqual(attempts)
})

test('Assess withholds marks, model choices and camera cues through reload until independent set submission', async ({
  page,
}) => {
  await page.goto(`${base}/assess`)
  await button(page, 'Start CT interpretation').click()
  for (const [i, id] of ASSESS_TRACES.entries()) {
    await markRoute(page, id, 'assess')
    await describe(page)
    if (i === 0) {
      await page.reload()
      await button(page, 'Start CT interpretation').click()
      await ctReady(page)
      await expect(page.locator('[data-ct-reference]')).toHaveCount(0)
    }
    await button(page, 'Record CT interpretation').click()
  }
  await button(page, 'Submit all CT interpretations').click()
  await expect(page.getByRole('heading', { name: 'CT interpretation debrief' })).toBeVisible()
  await page
    .getByRole('region', { name: 'CT tracing viewer' })
    .first()
    .getByRole('button', { name: 'Current junction CT' })
    .click()
  await expect(page.locator('[data-ct-reference]').first()).toBeVisible()
  await capture(page, 'independent-debrief')
})

test('failed CT and denied storage retain honest recovery and cannot complete image tasks', async ({
  page,
}) => {
  await page.route('**/branch-tracing/native-v1/axial/*.png', (route) =>
    route.fulfill({ status: 404, body: 'missing' }),
  )
  await page.goto(`${base}/learn?lesson=follow-one-airway`)
  await expect(button(page, 'Retry slice')).toBeVisible()
  await expect(button(page, 'Focus on this airway')).toBeDisabled()
  await page.unroute('**/branch-tracing/native-v1/axial/*.png')
  await button(page, 'Retry slice').click()
  await ctReady(page)
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('test quota denial')
    }
  })
  await button(page, 'Save & exit').click()
  await expect(page.getByRole('dialog', { name: 'This draft could not be saved' })).toBeVisible()
  await expect(button(page, 'Leave without saving')).toBeVisible()
})

for (const [width, height] of [
  [1440, 900],
  [1280, 720],
  [1024, 768],
  [768, 900],
  [390, 844],
  [1280, 640],
])
  test(`image, controls and comparison reflow at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await startLocal(page, 'follow-one-airway')
    await button(page, 'Go to response slice').click()
    await ctReady(page)
    await page.getByRole('group', { name: /^CT image\./ }).press('Enter')
    await expect(button(page, 'Check my tracing')).toBeEnabled()
    const box = await page.locator('[data-preset]').boundingBox()
    expect(box!.width).toBeGreaterThan(260)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await capture(page, `marking-${width}-${height}`)
    await page.goto(`${base}/learn?lesson=orientation`)
    await ctReady(page)
    await focusAirway(page)
    await learnDisplayChange(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  })

test('200 percent text remains usable with keyboard marking and reduced-motion stepping', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${base}/learn?lesson=follow-one-airway`)
  await ctReady(page)
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  await expect(page.locator('[data-enlarged-text="true"]')).toBeVisible()
  await focusAirway(page)
  await button(page, 'Next demonstration slice').click()
  await button(page, 'Start tracing').click()
  await button(page, 'Go to response slice').click()
  await ctReady(page)
  await page.getByRole('group', { name: /^CT image\./ }).press('Enter')
  await button(page, 'Check my tracing').click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await page.locator('[data-current-task]').scrollIntoViewIfNeeded()
  await capture(page, 'text-200-percent')
  await page.getByRole('group', { name: /^CT image\./ }).scrollIntoViewIfNeeded()
  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector('header:has(+ #main-content)')!).position,
    ),
  ).toBe('static')
  await capture(page, 'text-200-percent-image')
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
  await startLocal(page, 'continuity')
  await page.getByRole('button', { name: 'Go to response slice' }).click()
  await expect(page.getByRole('button', { name: 'Lumen unresolved here' })).toBeEnabled()
  const image = page.getByRole('group', { name: /^CT image\./ })
  await image.focus()
  await image.press('Enter')
  const original = await page.evaluate(
    () => JSON.parse(localStorage.getItem('branch-tracing.draft.learn.continuity')!).value.marks,
  )
  const circle = page.getByLabel('Your mark 1', { exact: true }).locator('circle')
  await page.getByText('More orientation controls', { exact: true }).click()
  for (const name of [
    /Rotate 90° left/,
    /Rotate 90° right/,
    /Flip left–right/,
    /Return to standard axial/,
  ]) {
    await page.getByRole('button', { name }).click()
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('branch-tracing.draft.learn.continuity')!).value.marks,
      ),
    ).toEqual(original)
    await expect(circle).toBeVisible()
  }
  await page.getByText('Image details, orientation and controls', { exact: true }).click()
  await page.getByRole('slider', { name: 'CT magnification' }).fill('1.6')
  await page.reload()
  await expect(page.locator('[data-current-task] [data-now-primary]')).toHaveText(/^Mark B/)
  await page.getByText('Image details, orientation and controls', { exact: true }).click()
  await expect(page.getByRole('slider', { name: 'CT magnification' })).toHaveValue('1.6')
  await expect(circle).toBeVisible()
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('branch-tracing.draft.learn.continuity')!).value.marks,
    ),
  ).toEqual(original)
})

test('actual pointer round trips retain an off-center mark through all eight displays, magnification and expanded viewing', async ({
  page,
}) => {
  await startLocal(page, 'continuity')
  await button(page, 'Go to response slice').click()
  await ctReady(page)
  const ct = page.getByRole('group', { name: /^CT image\./ })
  for (let i = 0; i < 6; i++) await ct.press('ArrowRight')
  for (let i = 0; i < 4; i++) await ct.press('ArrowUp')
  await ct.press('Enter')
  const original = (await draft(page, 'continuity')).marks[0]
  await page.getByText('Image details, orientation and controls', { exact: true }).click()
  await page.getByRole('slider', { name: 'CT magnification' }).fill('1.6')
  await page.getByText('More orientation controls', { exact: true }).click()
  for (const reflected of [false, true]) {
    await button(page, 'Return to standard axial').click()
    if (reflected) {
      await button(page, /Flip left–right/).click()
      await button(page, 'Expand CT views').click()
    }
    for (const turns of [0, 1, 2, 3]) {
      if (turns) await button(page, /Rotate 90° right/).click()
      const circle = page.getByLabel('Your mark 1', { exact: true }).locator('circle')
      await circle.scrollIntoViewIfNeeded()
      const box = await circle.boundingBox()
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
      const restored = await draft(page, 'continuity')
      expect(restored.orientation).toEqual({ turns, reflected })
      expect(restored.marks[0].slice).toBe(original.slice)
      expect(restored.marks[0].pixel[0]).toBeCloseTo(original.pixel[0], 1)
      expect(restored.marks[0].pixel[1]).toBeCloseTo(original.pixel[1], 1)
    }
  }
  await button(page, 'Close expanded views').click()
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
