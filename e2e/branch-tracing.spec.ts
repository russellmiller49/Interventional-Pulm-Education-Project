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
    // Harness fix (BBT-01): the slot button reaches the viewer one render later, and Enter pressed
    // while the previous slice was still shown placed no mark. The race also fails on baseline
    // 5d21844f. Wait for the requested slice before marking.
    await expect(
      page.getByText(`Slice ${point.slice} · patient directions`, { exact: false }).first(),
    ).toBeVisible()
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
async function markRoute(page: Page, id: string) {
  const trace = traceById(id)
  await orient(page)
  for (const [i, point] of trace.checkpoints.entries()) {
    if (point.decision) await page.locator('input[type="radio"][value="unresolved"]').check()
    await button(page, 'Go to response slice').click()
    await ctReady(page)
    await expect(page.locator(`[data-ct-reference="${i + 1}"]`)).toHaveCount(0)
    await button(page, 'Lumen unresolved here').click()
    await button(page, point.decision ? 'Check this junction' : 'Record nodule approach').click()
    await expect(page.locator(`[data-ct-reference="${i + 1}"]`)).toBeVisible()
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
  await page
    .getByRole('link', { name: /^(Start learning|(Continue|Resume): Follow one airway)$/ })
    .click()
  await expect(page).toHaveURL(/lesson=follow-one-airway/)
})

// BBT-01: the "negative answer" leg of this journey became a direct comparison with no answer.
test('opening journey: familiar CT, two same-lumen intervals, explanation before reflection, direct comparison, restored display and coached bifurcation', async ({
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
  await expect(page.getByText('The patient has not moved.', { exact: false })).toBeVisible()
  await expect(page.locator('[data-orientation-comparison]')).toBeVisible()
  await expect(button(page, 'Only the CT display orientation')).toHaveCount(0)
  await expect(button(page, 'Apply this to the same airway')).toBeEnabled()
  await capture(page, '04-direct-comparison')
  await page.reload()
  await expect(page.getByText(/Restored display:/)).toBeVisible()
  await capture(page, '05-restored-transform')
  await button(page, 'Return to standard axial').click()
  await button(page, 'Replay comparison').click()
  expect(Object.keys((await draft(page, 'orientation')).history)).toHaveLength(0)
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
    await expect(page.getByRole('heading', { name: 'Lesson finished' })).toBeVisible()
  })

test('self-paced journey: reference without a mark, continue without marking, outline jump, reload and return', async ({
  page,
}) => {
  await page.goto(`${base}/learn?lesson=follow-one-airway`)
  await ctReady(page)
  await focusAirway(page)
  await expect(page.locator('[data-lesson-teaching]')).toContainText('Why this matters')
  await expect(page.locator('[data-lesson-teaching]')).toContainText('trachea above the carina')
  await button(page, 'Start tracing').click()
  await ctReady(page)
  await button(page, 'Show reference').click()
  await ctReady(page)
  await expect(page.locator('[data-teaching-overlay]').first()).toBeVisible()
  await expect(page.getByLabel('Your mark 1', { exact: true })).toHaveCount(0)
  await capture(page, 'self-paced-reference-without-mark')
  await button(page, 'Continue without marking').click()
  await button(page, 'Continue without marking').click()
  await expect(
    page.getByText('You moved through the examples without checking marks', { exact: false }),
  ).toBeVisible()
  expect((await draft(page, 'follow-one-airway')).history).toEqual({})
  await button(page, 'Course outline').click()
  await page
    .getByRole('dialog')
    .getByRole('link', { name: 'Build and check a complete CT trace' })
    .click()
  await expect(page).toHaveURL(/lesson=variants-limits/)
  await ctReady(page)
  await page.reload()
  await ctReady(page)
  await page.goto(base)
  await expect(
    page.getByRole('link', { name: 'Resume: Build and check a complete CT trace' }),
  ).toBeVisible()
  const record = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('branch-tracing.self-paced-v1')!),
  )
  expect(record).toMatchObject({
    lastLessonId: 'variants-limits',
    reviewedLessonIds: ['follow-one-airway'],
  })
  expect(
    await page.evaluate(() => localStorage.getItem('critical-care-activity-progress-v1')),
  ).toBeNull()
})

test('short route: declared approach reversal, all connected divisions, map growth, uncertainty and prior review', async ({
  page,
}) => {
  const lesson = LESSONS.find((l) => l.id === 'orientation-changes')!
  await page.goto(`${base}/learn?lesson=${lesson.id}`)
  await ctReady(page)
  await button(page, 'Replay from parent').click()
  await ctReady(page)
  // BBT-PRE-REVIEW-02 moved the live caption to the transport beside the CT; the
  // full transcript stays in the instructions pane.
  await expect(
    page
      .getByRole('region', { name: 'CT demonstration controls' })
      .getByText(/Approach context, slice/),
  ).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'Lesson finished' })).toBeVisible()
})

test('complete Learn route covers every fork, target inspection, review and second interpretation', async ({
  page,
}) => {
  const lesson = LESSONS.find((l) => l.id === 'variants-limits')!
  await page.goto(`${base}/learn?lesson=${lesson.id}`)
  await ctReady(page)
  await button(page, 'Trace this airway').click()
  await markRoute(page, lesson.prediction)
  await button(page, 'Record trace').click()
  await describe(page)
  await button(page, 'Reveal CT comparison').click()
  await capture(page, 'complete-route-comparison')
  await button(page, 'Review the relationship').click()
  await button(page, 'Trace another airway').click()
  await markRoute(page, lesson.transfer)
  await describe(page)
  await button(page, 'Compare new trace').click()
  await button(page, 'Finish lesson').click()
  await expect(page.getByRole('heading', { name: 'Lesson finished' })).toBeVisible()
})

// BBT-01 superseded "preserves … first responses": responses stay as placed for review and retry,
// with no hint use or support label; target inspection is needed only to record the distal part.
test('Practice keeps each junction response as placed, needs target inspection only to record, and exports a comparison', async ({
  page,
}) => {
  const id = SEGMENT_PRACTICE_TRACES[2]
  await page.goto(`${base}/practice`)
  await button(page, 'Start CT practice').click()
  await ctReady(page)
  await expect(button(page, 'Use this orientation')).toBeEnabled()
  await markRoute(page, id)
  await page.getByRole('combobox', { name: 'Airway course' }).selectOption('uncertain')
  await page
    .getByRole('combobox', { name: 'Airway–nodule relationship' })
    .selectOption('unresolved')
  await expect(button(page, 'Record CT interpretation')).toBeDisabled()
  await expect(button(page, 'Compare all routes')).toBeEnabled()
  await describe(page)
  await button(page, 'Record CT interpretation').click()
  await button(page, 'Compare all routes').click()
  await expect(
    page.getByRole('heading', { name: 'Compare your routes with the reference' }),
  ).toBeVisible()
  await capture(page, 'practice-comparison')
  const download = page.waitForEvent('download')
  await button(page, 'Export your CT worksheet').click()
  const file = await download
  await file.saveAs(`${evidence}/practice-worksheet.json`)
  const worksheet = JSON.parse(fs.readFileSync(`${evidence}/practice-worksheet.json`, 'utf8'))
  expect(worksheet.sourceCaseCount).toBe(1)
  expect(worksheet.activity).toMatch(/not scored/)
  expect(worksheet.assessment).toBeUndefined()
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
  expect(Object.values(attempts[0]).some((a) => (a as unknown[]).length === 2)).toBe(true)
  expect(JSON.stringify(attempts[0])).not.toMatch(/support|hints/)
  await page.getByText('Your responses at this junction · 2', { exact: true }).click()
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

// BBT-01 superseded "Assess withholds marks, model choices and camera cues … until independent set
// submission": the old address opens four more routes with the same reference and help as Practice.
test('the former Assess address opens four more routes: reference on request, open traces, reload and comparison without recording', async ({
  page,
}) => {
  await page.goto(`${base}/assess`)
  await expect(
    page.getByRole('heading', { name: 'Trace four more routes to simulated nodules' }),
  ).toBeVisible()
  await button(page, 'Start the route set').click()
  await orient(page)
  await button(page, 'Go to response slice').click()
  await ctReady(page)
  await expect(page.locator('[data-ct-reference="1"]')).toHaveCount(0)
  await button(page, 'Show reference for this junction').click()
  await expect(page.locator('[data-ct-reference="1"]')).toBeVisible()
  await expect(page.getByLabel('Your mark 1', { exact: true })).toHaveCount(0)
  await capture(page, 'more-routes-reference-without-mark')
  await button(page, 'Continue without recording').click()
  await expect(button(page, `Trace ${ASSESS_TRACES.length}`)).toBeEnabled()
  await button(page, 'Trace 3').click()
  await ctReady(page)
  await page.reload()
  await button(page, 'Start the route set').click()
  await ctReady(page)
  await expect(button(page, 'Use this orientation')).toBeVisible()
  await button(page, 'Compare all routes with the reference').click()
  await expect(
    page.getByRole('heading', { name: 'Compare your routes with the reference' }),
  ).toBeVisible()
  await expect(
    page.getByText('No interpretation recorded for this route.', { exact: false }),
  ).toHaveCount(ASSESS_TRACES.length)
  await page
    .getByRole('region', { name: 'CT tracing viewer' })
    .first()
    .getByRole('button', { name: 'Current junction CT' })
    .click()
  await expect(page.locator('[data-ct-reference]').first()).toBeVisible()
  await capture(page, 'more-routes-comparison')
  const drafts = await page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([k]) => k.startsWith('branch-tracing.draft.assess.'))
      .map(([, v]) => JSON.parse(v).value),
  )
  expect(drafts[0].attempts).toEqual({})
  expect(drafts[0].responses).toEqual(ASSESS_TRACES.map(() => null))
  expect(
    await page.evaluate(() => localStorage.getItem('critical-care-activity-progress-v1')),
  ).toBeNull()
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
  // Harness fix (BBT-PRE-REVIEW-02): the viewer now keeps the previous plane on
  // screen until the requested one has loaded, so read the patch once it is the
  // plane that was asked for.
  await ctReady(page)
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

// BBT-PRE-REVIEW-02. The reported appendix-A sequence: step to the response slice
// and click again at the same screen point.
for (const [width, height] of [
  [1427, 1226],
  [1024, 768],
])
  test(`slice controls keep their rectangle through the response slice at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await startLocal(page, 'follow-one-airway')
    const exercise = localExercise(LESSONS[0].exercises![0])
    const response = exercise.answerPoints[0].slice
    const minus = button(page, 'More caudal CT slice')
    const rects = async () => ({
      minus: await minus.boundingBox(),
      range: await page.getByRole('slider', { name: 'CT slice' }).boundingBox(),
      plus: await button(page, 'More cranial CT slice').boundingBox(),
      image: await page.locator('[data-preset]').boundingBox(),
    })
    for (let slice = exercise.trace.anchor.slice; slice > response + 1; slice--) {
      await minus.click()
      await ctReady(page)
    }
    const before = await rects()
    const point = {
      x: before.minus!.x + before.minus!.width / 2,
      y: before.minus!.y + before.minus!.height / 2,
    }
    await page.mouse.click(point.x, point.y)
    await ctReady(page)
    await expect(page.locator('[data-preset]')).toHaveAttribute('data-slice', String(response))
    expect(await rects()).toEqual(before)
    // The same coordinate still belongs to the same control, so the next click steps.
    expect(
      await page.evaluate(
        ([x, y]) => document.elementFromPoint(x, y)?.getAttribute('aria-label'),
        [point.x, point.y],
      ),
    ).toBe('More caudal CT slice')
    await page.mouse.click(point.x, point.y)
    await ctReady(page)
    await expect(page.locator('[data-preset]')).toHaveAttribute('data-slice', String(response - 1))
    await expect(minus).toBeFocused()
    await capture(page, `bbt02-controls-${width}-${height}`)
  })

test('checking a response keeps the crop, the workspace scroll and the mark where they were', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  await startLocal(page, 'follow-one-airway')
  await button(page, 'Go to response slice').click()
  await ctReady(page)
  await page.getByRole('group', { name: /^CT image\./ }).click({ position: { x: 320, y: 320 } })
  const stored = () =>
    page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('branch-tracing.draft.learn.follow-one-airway')!).value
          .marks,
    )
  const pane = page
    .locator('[data-preset]')
    .locator('xpath=ancestor::div[contains(@class,"localImageWorkspace")]')
  await pane.evaluate((node) => {
    node.scrollTop = node.scrollHeight
  })
  const geometry = async () => ({
    transform: await page.locator('[data-preset] g').first().getAttribute('transform'),
    scroll: await pane.evaluate((node) => node.scrollTop),
    mark: await page.getByLabel('Your mark 1', { exact: true }).locator('circle').boundingBox(),
  })
  const before = await geometry()
  const marksBefore = await stored()
  await button(page, 'Check my tracing').click()
  await ctReady(page)
  await expect(page.getByText(/Reviewing slice/)).toBeVisible()
  expect(await geometry()).toEqual(before)
  expect(await stored()).toEqual(marksBefore)
})

for (const [width, height] of [
  [390, 844],
  [1024, 768],
  [1427, 1226],
])
  test(`Check preserves the current task screen position at ${width}×${height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height })
    await startLocal(page, 'follow-one-airway')
    await button(page, 'Go to response slice').click()
    await ctReady(page)
    const image = page.getByRole('group', { name: /^CT image\./ })
    const imageBox = (await image.boundingBox())!
    await image.click({ position: { x: imageBox.width / 2, y: imageBox.height / 2 } })
    await expect(page.getByLabel('Your mark 1', { exact: true })).toBeVisible()
    const check = button(page, 'Check my tracing')
    if (width === 390) {
      // A real document scroll, with both Check and the marked CT still on screen.
      await page.evaluate(() => window.scrollTo(0, 100))
    } else {
      await page.locator('[class*="localImageWorkspace"]').evaluate((pane) => {
        pane.scrollTop = 50
      })
    }
    const geometry = () =>
      page.evaluate(() => {
        const image = document.querySelector('[data-preset]')!
        const pane = image.closest('[class*="localImageWorkspace"]')!
        const mark = image.querySelector('[aria-label="Your mark 1"] circle')!
        return {
          documentScroll: window.scrollY,
          paneScroll: pane.scrollTop,
          pane: pane.getBoundingClientRect().toJSON(),
          image: image.getBoundingClientRect().toJSON(),
          mark: mark.getBoundingClientRect().toJSON(),
          transform: image.querySelector('g')!.getAttribute('transform'),
          slice: image.getAttribute('data-slice'),
          marks: JSON.parse(localStorage.getItem('branch-tracing.draft.learn.follow-one-airway')!)
            .value.marks,
        }
      })
    // Wait for layout/scroll delivery before recording the actual click target.
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    )
    const before = await geometry()
    if (width === 390) expect(before.documentScroll).toBeGreaterThan(0)
    const target = (await check.boundingBox())!
    expect(target.y).toBeGreaterThanOrEqual(0)
    expect(target.y + target.height).toBeLessThan(height)
    await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2)
    await ctReady(page)
    await expect(
      page.getByRole('heading', { name: 'Review the image evidence', exact: true }),
    ).toHaveCount(1)
    const after = await geometry()
    await testInfo.attach('Check geometry', {
      body: JSON.stringify({ before, after }, null, 2),
      contentType: 'application/json',
    })
    expect(Math.abs(after.documentScroll - before.documentScroll)).toBeLessThanOrEqual(1)
    expect(Math.abs(after.paneScroll - before.paneScroll)).toBeLessThanOrEqual(1)
    for (const part of ['pane', 'image', 'mark'] as const)
      for (const coordinate of ['x', 'y'] as const)
        expect(Math.abs(after[part][coordinate] - before[part][coordinate])).toBeLessThanOrEqual(1)
    expect(after.transform).toBe(before.transform)
    expect(after.slice).toBe(before.slice)
    expect(after.marks).toEqual(before.marks)
    // Feedback stays in normal flow, reachable without a focus jump or acknowledgement.
    const feedback = page.getByRole('heading', { name: 'Review the image evidence', exact: true })
    await feedback.scrollIntoViewIfNeeded()
    await expect(feedback).toBeInViewport()
    await expect(button(page, 'Try this lumen again')).toBeVisible()
    if (width === 390) {
      await button(page, 'Next airway interval').click()
      await ctReady(page)
      // Genuine task entry still positions the new task and releases the old footprint.
      const task = page.locator('[data-current-task]')
      await expect(task).toBeInViewport()
      expect(await task.evaluate((node) => (node as HTMLElement).style.minBlockSize)).toBe('')
      await expect(page.locator('[data-preset]')).toHaveAttribute(
        'data-slice',
        String(localExercise(LESSONS[0].exercises![1]).trace.anchor.slice),
      )
    }
  })

test('the wheel scrolls the workspace until slice stepping is turned on, and Escape releases it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  await startLocal(page, 'follow-one-airway')
  const image = page.locator('[data-preset]')
  const slice = () => image.getAttribute('data-slice')
  const box = (await image.boundingBox())!
  const pane = image.locator('xpath=ancestor::div[contains(@class,"localImageWorkspace")]')
  const scroll = () => pane.evaluate((node) => node.scrollTop)
  const start = await slice()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, 320)
  await page.waitForTimeout(250)
  expect(await slice()).toBe(start)
  expect(await scroll()).toBeGreaterThan(0)
  await button(page, 'Wheel steps slices: off').click()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, 320)
  await page.waitForTimeout(250)
  await ctReady(page)
  expect(Number(await slice())).toBe(Number(start) - 1)
  await page.keyboard.press('Escape')
  await expect(button(page, 'Wheel steps slices: off')).toBeVisible()
})

// BBTF-47: the reported rotated LS5 transfer state.
for (const [width, height] of [
  [1427, 1226],
  [1024, 768],
])
  test(`a rotated route plane keeps its direction labels and slice controls in the workspace at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.goto(`${base}/assess`)
    await button(page, 'Start the route set').click()
    await ctReady(page)
    await button(page, /Rotate 90° right/).click()
    await ctReady(page)
    const image = page.locator('[data-preset]')
    const pane = image.locator('xpath=ancestor::section[contains(@class,"routeEvidence")]')
    const paneBox = (await pane.boundingBox())!
    const imageBox = (await image.boundingBox())!
    // Aspect ratio and a useful size survive the rotation.
    expect(Math.abs(imageBox.width - imageBox.height)).toBeLessThan(2)
    expect(imageBox.width).toBeGreaterThan(260)
    expect(imageBox.width).toBeLessThanOrEqual(paneBox.width + 1)
    expect(await pane.evaluate((node) => getComputedStyle(node).overflowY)).toBe('auto')
    // All four patient directions stay attached to the image.
    await expect(image.locator('> span')).toHaveText(['R', 'A', 'L', 'P'])
    // The image and its slice row are reachable in the same scroll owner.
    const slider = page.getByRole('slider', { name: 'CT slice' })
    await slider.scrollIntoViewIfNeeded()
    const sliderBox = (await slider.boundingBox())!
    expect(sliderBox.y).toBeGreaterThanOrEqual(0)
    expect(sliderBox.y + sliderBox.height).toBeLessThanOrEqual(height)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await capture(page, `bbt02-rotated-${width}-${height}`)
  })

test('an expanded CT falls back in page when fullscreen is refused, and Escape returns focus', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('denied by test'))
  })
  await page.setViewportSize({ width: 1427, height: 1226 })
  await startLocal(page, 'follow-one-airway')
  const expand = button(page, 'Expand CT views')
  await expand.click()
  const viewer = page.getByRole('region', { name: 'CT tracing viewer' })
  await expect(viewer).toHaveAttribute('data-ct-enlarged', 'true')
  await expect(page.locator('[data-preset]')).toBeVisible()
  await expect(button(page, 'Close expanded views')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(viewer).not.toHaveAttribute('data-ct-enlarged', 'true')
  await expect(button(page, 'Expand CT views')).toBeFocused()
})

test('overlay labels stay apart on the crowded first division and can be hidden', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  await startLocal(page, 'continuity')
  const exercise = localExercise(LESSONS[2].exercises![0])
  for (const point of exercise.answerPoints) {
    await button(
      page,
      new RegExp(`^${point.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · slice`),
    ).click()
    await expect(
      page.getByText(`Slice ${point.slice} · patient directions`, { exact: false }).first(),
    ).toBeVisible()
    await ctReady(page)
    await page.getByRole('group', { name: /^CT image\./ }).press('Enter')
  }
  await button(page, 'Check my tracing').click()
  await ctReady(page)
  const boxes = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-preset] svg text')].map((node) => {
        const box = node.getBoundingClientRect()
        return { text: node.textContent, x: box.x, y: box.y, w: box.width, h: box.height }
      }),
    )
  const labels = await boxes()
  // Each learner mark is named, so A and B are not one generic label.
  expect(labels.map((label) => label.text)).toEqual(
    expect.arrayContaining(['Your mark A', 'Your mark B']),
  )
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i]
      const b = labels[j]
      expect(
        a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h,
        `${a.text} overlaps ${b.text}`,
      ).toBe(false)
    }
  // Leader lines pair each moved label with its unmoved anchor.
  expect(await page.locator('[data-preset] svg line').count()).toBe(labels.length)
  await capture(page, 'bbt02-crowded-labels')
  const marks = await page.evaluate(
    () => JSON.parse(localStorage.getItem('branch-tracing.draft.learn.continuity')!).value.marks,
  )
  await button(page, 'Hide overlays').click()
  expect(await page.locator('[data-preset] svg text').count()).toBe(0)
  await button(page, 'Show overlays').click()
  expect((await boxes()).length).toBe(labels.length)
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('branch-tracing.draft.learn.continuity')!).value.marks,
    ),
  ).toEqual(marks)
})

test('the demonstration transport sits with the CT and steps adjacent native planes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  await page.goto(`${base}/learn?lesson=follow-one-airway`)
  await ctReady(page)
  await focusAirway(page)
  const transport = page.getByRole('region', { name: 'CT demonstration controls' })
  await expect(transport).toBeVisible()
  const transportBox = (await transport.boundingBox())!
  const imageBox = (await page.locator('[data-preset]').boundingBox())!
  // Same column as the image, and inside the window without scrolling for it.
  expect(transportBox.x).toBeGreaterThanOrEqual(imageBox.x - 200)
  expect(transportBox.y + transportBox.height).toBeLessThanOrEqual(1226)
  const frames = localExercise(LESSONS[0].exercises![0]).frames
  await expect(page.locator('[data-preset]')).toHaveAttribute('data-slice', String(frames[0].slice))
  await button(page, 'Next demonstration slice').click()
  await ctReady(page)
  await expect(page.locator('[data-preset]')).toHaveAttribute('data-slice', String(frames[1].slice))
  expect(Math.abs(frames[1].slice - frames[0].slice)).toBe(1)
  await capture(page, 'bbt02-demonstration-transport')
})

for (const [width, height] of [
  [1427, 1226],
  [1024, 768],
  [390, 844],
])
  test(`delayed demonstration captions follow the decoded plane at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    let releaseOlder!: () => void
    let releaseLatest!: () => void
    const older = new Promise<void>((resolve) => (releaseOlder = resolve))
    const latest = new Promise<void>((resolve) => (releaseLatest = resolve))
    await page.route('**/native-v1/axial/415.png', async (route) => {
      await older
      await route.continue()
    })
    await page.route('**/native-v1/axial/414.png', async (route) => {
      await latest
      await route.continue()
    })
    try {
      await page.goto(`${base}/learn?lesson=follow-one-airway`, {
        waitUntil: 'domcontentloaded',
      })
      await ctReady(page)
      await focusAirway(page)
      const image = page.locator('[data-preset]')
      const transport = page.getByRole('region', { name: 'CT demonstration controls' })
      const shown = image.locator('image:not([visibility="hidden"])').first()
      await button(page, 'Next demonstration slice').click()
      await expect(image).toHaveAttribute('data-requested-slice', '415')
      await expect(image).toHaveAttribute('data-slice', '416')
      await expect(shown).toHaveAttribute('href', /\/416\.png$/)
      await expect(transport).toContainText('Demonstration slice 416 · 1 of 5')
      await expect(transport).toContainText(
        localExercise(LESSONS[0].exercises![0]).frames[0].caption,
      )
      await button(page, 'Next demonstration slice').click()
      await expect(image).toHaveAttribute('data-requested-slice', '414')
      releaseLatest()
      await ctReady(page)
      await expect(image).toHaveAttribute('data-slice', '414')
      await expect(transport).toContainText('Demonstration slice 414 · 3 of 5')
      const lateResponse = page.waitForResponse((response) =>
        response.url().endsWith('/native-v1/axial/415.png'),
      )
      releaseOlder()
      await lateResponse
      await expect(image).toHaveAttribute('data-slice', '414')
      await expect(shown).toHaveAttribute('href', /\/414\.png$/)
      await expect(transport).toContainText('Demonstration slice 414 · 3 of 5')
    } finally {
      releaseOlder()
      releaseLatest()
    }
  })
