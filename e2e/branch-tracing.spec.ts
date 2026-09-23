import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import { LESSONS } from '../src/features/bronchial-branch-tracing/content/lessons'
import { localExercise } from '../src/features/bronchial-branch-tracing/content/local-exercises'
import {
  ASSESS_TRACES,
  SEGMENT_PRACTICE_TRACES,
} from '../src/features/bronchial-branch-tracing/content/practice'
import {
  targetForTrace,
  traceById,
} from '../src/features/bronchial-branch-tracing/geometry/native-ct'
import { displayAnswerLabel } from '../src/features/bronchial-branch-tracing/engine/branch-identity'

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
    // BBT-PRE-REVIEW-03: the slot is named by its neutral identity (Daughter A · RMSB).
    const label = displayAnswerLabel(exercise.trace.checkpoints[0], i, point.label)
    await button(
      page,
      new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · slice`),
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
  // BBT-PRE-REVIEW-04: the worked example's skip action names the learner's own target.
  await button(
    page,
    `Skip to your own trace: ${targetForTrace(traceById(lesson.prediction)).segment.code}`,
  ).click()
  await markRoute(page, lesson.prediction)
  await button(page, 'Record trace').click()
  await describe(page)
  await button(page, 'Reveal CT comparison').click()
  await capture(page, 'complete-route-comparison')
  await button(page, 'Review the relationship').click()
  await button(
    page,
    `Continue to another trace: ${targetForTrace(traceById(lesson.transfer)).segment.code}`,
  ).click()
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
  await expect(page.locator('[data-current-task] [data-now-primary]')).toHaveText(
    /^Mark Daughter B/,
  )
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
  for (const [i, point] of exercise.answerPoints.entries()) {
    const label = displayAnswerLabel(exercise.trace.checkpoints[0], i, point.label)
    await button(
      page,
      new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · slice`),
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

// BBT-PRE-REVIEW-03 — CT-to-parent-view teaching: the paired model camera is discoverable from
// Lesson 2 without an answer, its captions keep the CT display and the modelled camera apart,
// opening letters are drawn only where a daughter's model point is really in line of sight, the
// matching diagram is legible with the CT letters, and intermediate demonstration planes carry
// model course locators. Nothing here records a mark or changes a coordinate.
const scopeColumn = (page: Page) => page.locator('[data-paired-scope-column]')
const scopeCanvas = (page: Page) => scopeColumn(page).locator('canvas')
async function openParentViewIfHidden(page: Page) {
  const show = button(page, 'Show parent airway view')
  if (await show.isVisible()) await show.click()
  await expect(scopeColumn(page)).toBeVisible()
}

for (const [width, height] of [
  [1427, 1226],
  [390, 844],
])
  test(`Lesson 2 pairs the CT with the fixed parent airway view before any answer at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.goto(`${base}/learn?lesson=orientation`)
    await ctReady(page)
    await expect(scopeColumn(page)).toBeVisible()
    await expect(scopeCanvas(page)).toBeVisible({ timeout: 30000 })
    await expect(page.locator('[data-scope-caption]')).toContainText(
      'looking caudally along Trachea. Reference roll for this region: anterior at the top of the view.',
    )
    await expect(page.locator('[data-display-caption]')).toContainText(
      'CT display: Standard axial (A up, R screen-left)',
    )
    await expect(page.locator('[data-scope-caption]')).not.toContainText(/always/i)
    await capture(page, `bbt03-L2-context-${width}x${height}`)
    await focusAirway(page)
    await expect(page.locator('[data-comparison-scope]')).toBeVisible()
    await expect(page.locator('[data-comparison-scope] canvas')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('[data-comparison-scope-caption]')).toContainText(
      'renders the same whichever CT display you choose',
    )
    const before = await page
      .locator('[data-comparison-copy] image')
      .evaluateAll((els) => els.map((e) => e.parentElement!.getAttribute('transform')))
    await button(page, 'Compare with the caudal tracing view').click()
    await expect(page.locator('[data-comparison-ready]')).toHaveAttribute(
      'data-comparison-ready',
      'true',
    )
    const after = await page
      .locator('[data-comparison-copy] image')
      .evaluateAll((els) => els.map((e) => e.parentElement!.getAttribute('transform')))
    expect(after[0]).toBe(before[0])
    expect(after[1]).not.toBe(before[1])
    await expect(page.locator('[data-comparison-scope] canvas')).toBeVisible()
    await expect(page.locator('[data-symmetric-note]')).toContainText('nearly round, midline lumen')
    await capture(page, `bbt03-L2-compare-${width}x${height}`)
    await button(page, 'Apply this to the same airway').click()
    await ctReady(page)
    await expect(scopeColumn(page)).toBeVisible()
    await expect(page.locator('[data-display-caption]')).toContainText(
      'CT display: Left–right reflection (A up, L screen-left)',
    )
    await expect(page.locator('[data-scope-caption]')).toContainText(
      'looking caudally along Trachea',
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    const saved = await draft(page, 'orientation')
    expect(saved.marks).toEqual([null])
    expect(saved.history).toEqual({})
    await capture(page, `bbt03-L2-demo-${width}x${height}`)
  })

test('CT transforms leave the modelled parent camera unchanged while a real mark keeps its native pixels', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  await startLocal(page, 'continuity')
  await openParentViewIfHidden(page)
  await expect(scopeCanvas(page)).toBeVisible({ timeout: 30000 })
  await button(page, 'Go to response slice').click()
  await ctReady(page)
  await page.getByRole('group', { name: /^CT image\./ }).press('Enter')
  const placed = (await draft(page, 'continuity')).marks[0]
  expect(placed.pixel).not.toBeNull()
  const pose = await scopeColumn(page).getAttribute('data-scope-pose')
  expect(pose).toMatch(/^[-\d.,]+\|[-\d.,]+\|[-\d.,]+$/)
  await page.getByText('More orientation controls').click()
  const preset = () => page.locator('[data-preset]').getAttribute('data-preset')
  const display = () => page.locator('[data-display-caption]').textContent()
  const standardCaption = await display()
  for (const [name, expected] of [
    [/Rotate 90° left/, 'rul'],
    [/Rotate 90° right/, 'standard'],
    [/Rotate 90° right/, 'upper-division'],
    [/Flip left–right/, 'custom'],
  ] as const) {
    await button(page, name).click()
    expect(await preset()).toBe(expected)
    expect(await scopeColumn(page).getAttribute('data-scope-pose')).toBe(pose)
    expect((await draft(page, 'continuity')).marks[0]).toEqual(placed)
  }
  expect(await display()).not.toBe(standardCaption)
  await button(page, 'Return to standard axial').click()
  expect(await preset()).toBe('standard')
  expect(await display()).toBe(standardCaption)
  expect(await scopeColumn(page).getAttribute('data-scope-pose')).toBe(pose)
  expect((await draft(page, 'continuity')).marks[0]).toEqual(placed)
  await capture(page, 'bbt03-transform-invariance')
})

test('opening letters in the paired view follow real line of sight, stay apart and inside the view, and are withheld while a matching try is open', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  await startLocal(page, 'continuity')
  await markLocal(page, localExercise(LESSONS[2].exercises![0]), true)
  await parentApplication(page)
  await expect(scopeColumn(page)).toBeVisible()
  await expect(scopeCanvas(page)).toBeVisible({ timeout: 30000 })
  await expect(page.locator('[data-scope-annotations-drawn]')).toBeVisible({ timeout: 30000 })
  const drawn = await page
    .locator('[data-scope-annotations-drawn]')
    .getAttribute('data-scope-annotations-drawn')
  expect(Number(drawn)).toBeGreaterThan(0)
  const boxes = await page.evaluate(() => {
    const svg = document.querySelector('[data-scope-annotations-drawn]')!
    const host = svg.parentElement!.getBoundingClientRect()
    return {
      host: { x: host.x, y: host.y, w: host.width, h: host.height },
      texts: Array.from(svg.querySelectorAll('text')).map((t) => {
        const r = t.getBoundingClientRect()
        return { text: t.textContent, x: r.x, y: r.y, w: r.width, h: r.height }
      }),
    }
  })
  expect(boxes.texts.length).toBe(Number(drawn))
  for (const t of boxes.texts) {
    expect(t.h).toBeGreaterThanOrEqual(12)
    expect(t.x).toBeGreaterThanOrEqual(boxes.host.x - 1)
    expect(t.x + t.w).toBeLessThanOrEqual(boxes.host.x + boxes.host.w + 1)
    expect(t.y).toBeGreaterThanOrEqual(boxes.host.y - 1)
    expect(t.y + t.h).toBeLessThanOrEqual(boxes.host.y + boxes.host.h + 1)
  }
  for (let i = 0; i < boxes.texts.length; i++)
    for (let j = i + 1; j < boxes.texts.length; j++) {
      const a = boxes.texts[i],
        b = boxes.texts[j]
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
      expect(overlap).toBe(false)
    }
  await expect(page.locator('[data-scope-annotations]')).toContainText(
    /model locator seen through the opening|not in line of sight|outside this view/,
  )
  // The letters match the CT labels and the diagram letters.
  expect(boxes.texts.map((t) => t.text).sort()).toEqual(['A · RMSB', 'B · LMSB'])
  await expect(page.locator('[data-parent-map] [data-opening-letter]')).toHaveCount(2)
  await capture(page, 'bbt03-L3-parent-view-letters')
  await button(page, 'Next example: LLL').click()
  await markLocal(page, localExercise(LESSONS[2].exercises![1]))
  await button(page, 'Continue to branch matching').click()
  await finishPendingIntroduction(page)
  await expect(button(page, 'Opening 1')).toBeVisible()
  await expect(scopeColumn(page)).toBeVisible()
  await expect(scopeCanvas(page)).toBeVisible({ timeout: 30000 })
  await expect(page.locator('[data-scope-annotations-drawn]')).toHaveCount(0)
  await expect(page.locator('[data-parent-map] [data-opening-letter]')).toHaveCount(0)
  await button(page, 'Show the labels').click()
  await expect(page.locator('[data-parent-map] [data-opening-letter]')).toHaveCount(2)
  await expect(page.locator('[data-scope-annotations]')).toContainText(
    /model locator seen through the opening|not in line of sight|outside this view/,
    { timeout: 30000 },
  )
  expect((await draft(page, 'continuity')).viewAnswer).toBeNull()
  await capture(page, 'bbt03-L3-independent-labels')
})

for (const [width, height] of [
  [1427, 1226],
  [390, 844],
])
  test(`the branch-matching diagram is legible and names identities at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await startLocal(page, 'continuity')
    await markLocal(page, localExercise(LESSONS[2].exercises![0]))
    await parentApplication(page)
    const map = page.locator('[data-parent-map="junction-1"]')
    await expect(map).toBeVisible()
    const measured = await map.evaluate((figure) => {
      const svg = figure.querySelector('svg')!.getBoundingClientRect()
      const axes = Array.from(figure.querySelectorAll('[data-axis-label]')).map((t) => ({
        text: t.textContent,
        h: t.getBoundingClientRect().height,
      }))
      const letters = figure.querySelectorAll('[data-opening-letter]').length
      return { svg: svg.width, axes, letters }
    })
    expect(measured.svg).toBeGreaterThanOrEqual(width < 500 ? 280 : 300)
    expect(measured.letters).toBe(2)
    expect(measured.axes.map((a) => a.text).sort()).toEqual(['A', 'L', 'P', 'R'])
    for (const axis of measured.axes) expect(axis.h).toBeGreaterThanOrEqual(16)
    await expect(map.locator('[data-along-view="S–I"]')).toContainText(
      'runs along the line of sight',
    )
    await expect(map.locator('[data-opening-legend]')).toHaveCount(2)
    await expect(map).toContainText(
      /Opening [12] · Daughter A · RMSB \(source label “more right”\)/,
    )
    await expect(map).toContainText(/slices caudal of the parent point/)
    await expect(map.locator('figcaption')).toContainText(
      'Reference roll for this region: anterior at the top of the view',
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await map.scrollIntoViewIfNeeded()
    await capture(page, `bbt03-L3-diagram-${width}x${height}`)
  })

test('intermediate demonstration planes carry dotted model course locators only where the source edge crosses', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  await page.goto(`${base}/learn?lesson=continuity`)
  await ctReady(page)
  await finishPendingIntroduction(page)
  await expect(page.locator('[data-teaching-overlay]')).toHaveCount(1)
  await expect(page.locator('[data-course-locator]')).toHaveCount(0)
  await button(page, 'Next demonstration slice').click()
  await ctReady(page)
  await button(page, 'Next demonstration slice').click()
  await ctReady(page)
  await expect(page.locator('[data-course-locator]').first()).toBeVisible()
  await expect(page.locator('[data-course-locator] text')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'CT demonstration controls' })).toContainText(
    'Dotted gold crosshair: where the model centreline of Parent · Trachea crosses this plane',
  )
  await expect(page.locator('[data-course-legend]')).toBeVisible()
  await capture(page, 'bbt03-L3-course-locator')
  await button(page, 'Hide overlays').click()
  await expect(page.locator('[data-course-locator]')).toHaveCount(0)
  await button(page, 'Show overlays').click()
  await expect(page.locator('[data-course-locator]').first()).toBeVisible()
  expect((await draft(page, 'continuity')).marks).toEqual([null, null])
})

test('the RB1 source naming is stated before marking and repeated names are told apart by role and direction', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  await startLocal(page, 'vertical')
  await expect(page.locator('[data-branch-identities="junction-14"]')).toContainText(
    'Daughter A is labelled RB1b in this source (more anterior); Daughter B is labelled RB1a in this source (more posterior). The a/b letters follow this source’s labelling and are pending nomenclature review',
  )
  await expect(button(page, /^Daughter A · RB1b · slice 422/)).toBeVisible()
  await expect(page.getByRole('heading', { name: '2. Mark Daughter A · RB1b' })).toBeVisible()
  await capture(page, 'bbt03-L4-naming-before-marking')
  await startLocal(page, 'horizontal-oblique')
  await expect(button(page, /^Daughter A · RB3a · more cranial · slice 396/)).toBeVisible()
  await expect(button(page, /^Daughter B · RB3a · more caudal · slice 384/)).toBeVisible()
  await expect(page.locator('[data-branch-identities="junction-16"]')).toContainText(
    'Parent · RB3a',
  )
  await expect(page.locator('[data-branch-identities="junction-16"]')).not.toContainText(
    /RB3a[bc]\b/,
  )
  await page.locator('[data-parent-schematic] summary').click()
  await expect(
    page.locator('[data-parent-schematic] [data-parent-map="junction-16"]'),
  ).toBeVisible()
  await capture(page, 'bbt03-L7-identities')
})

// BBT-PRE-REVIEW-03 sanity repair, finding 1. A demonstration walks the same CT plane once per
// daughter pass. Resolving the caption by slice number returned the first pass, so Daughter B's
// pass inherited the lead-in's approach caption and Daughter A's course-locator names.
test('a demonstration plane reached twice keeps the identity of the pass the learner is in', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  const short = localExercise(LESSONS.find((l) => l.id === 'orientation-changes')!.exercises![0])
  const transport = page.getByRole('region', { name: 'CT demonstration controls' })
  await page.goto(`${base}/learn?lesson=orientation-changes`)
  await ctReady(page)
  await button(page, 'Replay from parent').click()
  await expect(transport).toContainText(`Demonstration slice 332 · 1 of ${short.frames.length}`)
  await expect(transport).toContainText('Approach context, slice 332')
  const step = async (to: number, from: number) => {
    for (let i = from; i < to; i++) await button(page, 'Next demonstration slice').click()
    await expect(transport).toContainText(
      `Demonstration slice ${short.frames[to].slice} · ${to + 1} of ${short.frames.length}`,
    )
  }
  // The declared LLL lead-in, where the approach and the parent both cross this plane.
  await step(5, 0)
  await expect(transport).toContainText(
    'the model centreline of Approach · LLL and Parent · LB6 crosses this plane',
  )
  await expect(page.locator('[data-course-locator]')).toHaveCount(2)
  await capture(page, 'bbt03r-L8-lead-in-327')
  // Daughter B's pass crosses both planes again; nothing of the lead-in may survive.
  await step(21, 5)
  await expect(transport).toContainText('the model centreline of Parent · LB6 crosses this plane')
  await expect(transport).not.toContainText('Approach · LLL')
  await expect(page.locator('[data-course-locator]')).toHaveCount(1)
  await step(26, 21)
  await expect(transport).not.toContainText('Approach context, slice 332')
  await expect(transport).toContainText(short.frames[26].caption)
  await expect(page.locator('[data-course-locator]')).toHaveCount(0)
  await capture(page, 'bbt03r-L8-daughter-b-pass-332')
  expect((await draft(page, 'orientation-changes')).marks).toEqual([null, null])
})

// BBT-PRE-REVIEW-03 sanity repair, finding 2. The paired view suppresses a wall label whose
// projected point is behind the wall and says so in a sentence beside the camera. That sentence
// was laid out underneath an absolutely positioned, opaque canvas and could not be read.
async function secondLb6ParentView(page: Page) {
  const lesson = LESSONS.find((l) => l.id === 'orientation-changes')!
  await startLocal(page, lesson.id)
  await markLocal(page, localExercise(lesson.exercises![0]))
  await button(page, /^Next example/).click()
  await finishPendingIntroduction(page)
  await ctReady(page)
  await markLocal(page, localExercise(lesson.exercises![1]))
  await openParentViewIfHidden(page)
  await button(page, 'Go to B · LB6 · slice 345').click()
  await ctReady(page)
  await expect(scopeCanvas(page)).toBeVisible({ timeout: 60000 })
  await expect(page.locator('[data-scope-annotations]')).toBeVisible({ timeout: 60000 })
}

for (const [width, height] of [
  [1427, 1226],
  [390, 844],
  [320, 740],
])
  test(`the reason an occluded daughter carries no wall label is readable at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await secondLb6ParentView(page)
    // Daughter B stays off the wall: the ray cast is unchanged and only Daughter A is drawn.
    await expect(page.locator('[data-scope-annotations-drawn]')).toHaveAttribute(
      'data-scope-annotations-drawn',
      '1',
    )
    expect(await page.locator('[data-scope-annotations-drawn] text').allTextContents()).toEqual([
      'A · LB6',
    ])
    const note = page.locator('[data-scope-annotations]')
    await expect(note).toContainText(
      'B · LB6 is not in line of sight from this camera position (it lies behind the wall), so it is not marked.',
    )
    await note.scrollIntoViewIfNeeded()
    // Rendered evidence, not a class assertion: the canvas must not answer a hit test anywhere
    // down the sentence, and the sentence must sit inside the viewport.
    const measured = await page.evaluate(() => {
      const element = document.querySelector('[data-scope-annotations]') as HTMLElement
      const rect = element.getBoundingClientRect()
      const canvas = document.querySelector('[data-paired-scope-column] canvas')!
      const x = rect.x + rect.width / 2
      return {
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        canvas: canvas.getBoundingClientRect().bottom,
        hits: [0.15, 0.5, 0.85].map((fraction) => {
          const hit = document.elementFromPoint(x, rect.y + rect.height * fraction)
          return Boolean(hit) && (hit === element || element.contains(hit))
        }),
        viewport: { width: innerWidth, height: innerHeight },
      }
    })
    expect(measured.hits).toEqual([true, true, true])
    expect(measured.rect.height).toBeGreaterThan(24)
    expect(measured.rect.width).toBeGreaterThan(100)
    expect(measured.rect.y).toBeGreaterThanOrEqual(0)
    expect(measured.rect.y + measured.rect.height).toBeLessThanOrEqual(measured.viewport.height + 1)
    // The camera keeps its own space above the sentence rather than covering it.
    expect(measured.canvas).toBeLessThanOrEqual(measured.rect.y + 1)
    // Reading the reason moved neither the CT nor the recorded responses.
    await expect(
      page.getByText('Slice 345 · patient directions', { exact: false }).first(),
    ).toBeVisible()
    expect(
      (await draft(page, 'orientation-changes')).history[
        'left-lower-returning.junction-25.integration'
      ],
    ).toHaveLength(1)
    await capture(page, `bbt03r-occlusion-reason-${width}x${height}`)
  })

test('a lost WebGL context in the paired view leaves the CT and the lesson usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  await page.goto(`${base}/learn?lesson=orientation`)
  await ctReady(page)
  await expect(scopeCanvas(page)).toBeVisible({ timeout: 30000 })
  await scopeCanvas(page).dispatchEvent('webglcontextlost', { cancelable: true })
  await expect(page.getByRole('button', { name: 'Reload 3D view' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'CT slice' })).toBeEnabled()
  await expect(button(page, 'Focus on this airway')).toBeEnabled()
  await page.getByRole('button', { name: 'Reload 3D view' }).click()
  await expect(scopeCanvas(page)).toBeVisible({ timeout: 30000 })
})

test('the paired-view toggle is keyboard reachable with visible focus and records nothing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  await page.goto(`${base}/learn?lesson=orientation`)
  await ctReady(page)
  await page.getByRole('slider', { name: 'CT slice' }).focus()
  let reached = false
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press('Tab')
    reached = await page.evaluate(
      () => document.activeElement?.textContent?.trim() === 'Hide parent airway view',
    )
  }
  expect(reached).toBe(true)
  const focusStyle = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!)
    return { outline: style.outlineStyle, width: style.outlineWidth, shadow: style.boxShadow }
  })
  expect(focusStyle.outline !== 'none' || focusStyle.shadow !== 'none').toBe(true)
  await page.keyboard.press('Enter')
  await expect(scopeColumn(page)).toHaveCount(0)
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe(
    'Show parent airway view',
  )
  await page.keyboard.press('Space')
  await expect(scopeColumn(page)).toBeVisible()
  expect((await draft(page, 'orientation')).marks).toEqual([null])
})

test('200 percent root text keeps the Lesson 2 comparison and its parent airway view without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(`${base}/learn?lesson=orientation`)
  await ctReady(page)
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  await expect(page.locator('[data-enlarged-text="true"]')).toBeVisible()
  await focusAirway(page)
  await expect(page.locator('[data-comparison-scope]')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await capture(page, 'bbt03-L2-200-percent')
})

// BBT-PRE-REVIEW-04 — teaching before the try, entry language and a coherent optional route flow.
const noHorizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
async function inViewportAfterScroll(page: Page, locator: ReturnType<Page['locator']>) {
  // Bring the element's top into view (a section can be taller than the viewport), then require
  // that its top edge is on screen and that it is not cut off at either side.
  await locator.evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }))
  const box = await locator.boundingBox()
  const viewport = page.viewportSize()!
  return Boolean(
    box &&
    box.height > 0 &&
    box.x >= 0 &&
    box.x + box.width <= viewport.width + 1 &&
    box.y < viewport.height &&
    box.y + Math.min(box.height, viewport.height) > 0,
  )
}
/** Horizontal overflow inside the branch-tracing module itself (the shared site header excluded). */
const moduleOverflow = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector('[data-learning-scroll-owner]')!
    return Array.from(root.querySelectorAll('*'))
      .filter((el) => !el.closest('svg'))
      .map((el) => el.getBoundingClientRect())
      .filter((b) => b.width > 0 && b.right > innerWidth + 1).length
  })

test('all nine lesson entries open by direct link, and the route set addresses keep working', async ({
  page,
}) => {
  for (const lesson of LESSONS) {
    await page.goto(`${base}/learn?lesson=${lesson.id}`)
    await expect(page.getByRole('heading', { name: lesson.title, level: 1 })).toBeVisible()
    await ctReady(page)
  }
  await page.goto(`${base}/assess`)
  await expect(page.locator('[data-route-set-role="more-routes"]')).toContainText(
    'nothing is assessed',
  )
  await page.goto(`${base}/practice`)
  await expect(page.locator('[data-route-set-role="practice"]')).toContainText(
    'Suggested after the 9 Learn lessons',
  )
})

test('the overview maps Learn, Practice and More routes, keeps estimates after review and links each set', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  await page.goto(base)
  const map = page.locator('[data-course-map]')
  await expect(map).toContainText('not a measured learner time')
  await expect(page.locator('[data-naming-key]').first()).toContainText(
    'B denotes a bronchus and S its pulmonary segment',
  )
  await capture(page, 'bbt04-overview-1427')
  await page.evaluate(() =>
    localStorage.setItem(
      'branch-tracing.self-paced-v1',
      JSON.stringify({
        version: 1,
        lastLessonId: 'follow-one-airway',
        visitedLessonIds: ['follow-one-airway'],
        reviewedLessonIds: ['follow-one-airway'],
        reviewLaterLessonIds: ['vertical'],
        displayExplanationsShown: [],
        updatedAt: '2026-09-23T00:00:00.000Z',
      }),
    ),
  )
  await page.reload()
  await expect(
    page.getByRole('link', { name: LESSONS[0].title }).locator('xpath=ancestor::li[1]'),
  ).toContainText(`Reviewed · about ${LESSONS[0].minutes} min`)
  await expect(page.getByRole('heading', { name: 'Saved for later' })).toBeVisible()
  await map.getByRole('link', { name: 'More routes' }).click()
  await expect(page).toHaveURL(/\/assess$/)
  await page.goBack()
  await map.getByRole('link', { name: 'Practice' }).click()
  await expect(page).toHaveURL(/\/practice$/)
})

test('Lesson 9 keeps the worked route, your route and the transfer route apart and ends with Practice', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  const lesson = LESSONS.find((l) => l.id === 'variants-limits')!
  const [example, own, transfer] = [lesson.example, lesson.prediction, lesson.transfer].map(
    (id) => targetForTrace(traceById(id)).segment.code,
  )
  await page.goto(`${base}/learn?lesson=${lesson.id}`)
  await ctReady(page)
  await expect(
    page.getByRole('heading', { name: `Worked example: the route to ${example}` }),
  ).toBeVisible()
  await expect(page.locator('[data-map-owner]')).toHaveAttribute('data-map-owner', 'worked-example')
  await capture(page, 'bbt04-L9-worked-1427')
  const junctions = traceById(lesson.example).checkpoints.length
  for (let i = 1; i < junctions; i++) {
    await button(page, `Next worked junction (${example} route)`).click()
    await ctReady(page)
    await expect(page.locator('[data-map-division]')).toHaveCount(i + 1)
  }
  const worked = (await draft(page, lesson.id)).session
  expect(worked.marks.every((m: unknown) => m === null)).toBe(true)
  expect(worked.junctionHistory).toEqual({})
  await button(page, `Start your own trace: ${own}`).click()
  await ctReady(page)
  await expect(page.locator('[data-route-role="own"]').first()).toContainText(
    `Your trace · target ${own}`,
  )
  await expect(page.locator('[data-map-owner]')).toHaveAttribute('data-map-owner', 'learner')
  await orient(page)
  for (let i = 0; i < traceById(lesson.prediction).checkpoints.length - 1; i++) {
    await button(page, 'Continue without recording').click()
    await ctReady(page)
  }
  await button(page, 'Continue without recording this trace').click()
  await button(page, 'Show the comparison without recording').click()
  await ctReady(page)
  await button(page, 'Review the relationship').click()
  await expect(
    page.getByRole('heading', { name: 'Optional reflection: relate the two views' }),
  ).toBeVisible()
  await expect(page.locator('[data-reflection-reference]')).toContainText('Source levels:')
  await expect(page.locator('textarea')).toHaveCount(0)
  await capture(page, 'bbt04-L9-reflection-1427')
  await button(page, `Continue to another trace: ${transfer}`).click()
  await ctReady(page)
  await expect(page.locator('[data-route-role="transfer"]').first()).toContainText(
    `Another trace · target ${transfer}`,
  )
  await button(page, 'Finish without recording').click()
  await expect(page.getByRole('link', { name: 'Return to overview' })).toBeVisible()
  await page.getByRole('link', { name: 'Continue to Practice' }).click()
  await expect(page).toHaveURL(/\/practice$/)
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Lesson finished' })).toBeVisible()
})

test('a later example offers an optional worked walkthrough and start-from-parent that record nothing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  await startLocal(page, 'continuity')
  await button(page, 'Continue without marking').click()
  await finishPendingIntroduction(page)
  await button(page, 'Next example: LLL').click()
  await ctReady(page)
  await expect(page.locator('[data-mode="try"]')).toContainText('opens without a demonstration')
  const ex = localExercise(LESSONS.find((l) => l.id === 'continuity')!.exercises![1])
  await button(page, 'Watch a worked walkthrough').click()
  await ctReady(page)
  await expect(page.locator('[data-teaching-overlay]').first()).toBeVisible()
  await button(page, `Start from the parent · slice ${ex.trace.anchor.slice}`).click()
  await expect(page.locator('[data-preset]')).toHaveAttribute(
    'data-slice',
    String(ex.trace.anchor.slice),
  )
  const stored = await draft(page, 'continuity')
  expect(stored.marks).toEqual([null, null])
  expect(stored.history).toEqual({})
  await capture(page, 'bbt04-L3-ex2-try-1427')
})

test('Lesson 8 names its registry target and keeps the upper-division note in the optional reference', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  await page.goto(`${base}/learn?lesson=orientation-changes`)
  await ctReady(page)
  const note = page.locator('[data-regional-note="left-upper-division"]')
  await expect(note).toBeHidden()
  await page.getByText('Earlier teaching and regional worked example').click()
  await expect(note).toBeVisible()
  await button(page, 'Start marking branches').click()
  await ctReady(page)
  await expect(page.getByText(/Which daughter would you follow toward/)).toHaveText(
    'Which daughter would you follow toward the simulated nodule in LS6 (left lower lobe superior segment)?',
  )
  await expect(page.getByText(/toward LLL/)).toHaveCount(0)
  await capture(page, 'bbt04-L8-target-1427')
})

test('the try note and its optional controls are keyboard reachable with visible focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  await startLocal(page, 'vertical')
  await page.getByRole('button', { name: 'Check my tracing' }).focus()
  let reached = false
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press('Tab')
    reached = await page.evaluate(
      () => document.activeElement?.textContent?.trim() === 'Replay the worked walkthrough',
    )
  }
  expect(reached).toBe(true)
  const focusStyle = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!)
    return { outline: style.outlineStyle, shadow: style.boxShadow }
  })
  expect(focusStyle.outline !== 'none' || focusStyle.shadow !== 'none').toBe(true)
  await page.keyboard.press('Enter')
  await ctReady(page)
  await expect(page.locator('[data-teaching-overlay]').first()).toBeVisible()
  expect((await draft(page, 'vertical')).marks).toEqual([null, null])
})

for (const [width, height] of [
  [1427, 1226],
  [1440, 900],
  [1024, 768],
  [390, 844],
  [320, 740],
])
  test(`Prompt 04 surfaces reflow without clipping or horizontal overflow at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.goto(base)
    expect(await noHorizontalOverflow(page)).toBe(true)
    expect(await inViewportAfterScroll(page, page.locator('[data-course-map]'))).toBe(true)
    await capture(page, `bbt04-overview-${width}x${height}`)
    await startLocal(page, 'vertical')
    const tryNote = page.locator('[data-mode="try"]')
    expect(await inViewportAfterScroll(page, tryNote)).toBe(true)
    expect(await inViewportAfterScroll(page, button(page, 'Replay the worked walkthrough'))).toBe(
      true,
    )
    expect(await noHorizontalOverflow(page)).toBe(true)
    await capture(page, `bbt04-L4-try-${width}x${height}`)
    const lesson = LESSONS.find((l) => l.id === 'variants-limits')!
    const own = targetForTrace(traceById(lesson.prediction)).segment.code
    await page.goto(`${base}/learn?lesson=${lesson.id}`)
    await ctReady(page)
    for (const name of [
      `Next worked junction (${targetForTrace(traceById(lesson.example)).segment.code} route)`,
      `Skip to your own trace: ${own}`,
    ]) {
      const action = button(page, name)
      expect(await inViewportAfterScroll(page, action)).toBe(true)
      // The whole label is readable: no ellipsis or clipping inside the button.
      expect(
        await action.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.clientHeight > 0),
      ).toBe(true)
    }
    expect(await noHorizontalOverflow(page)).toBe(true)
    await capture(page, `bbt04-L9-worked-${width}x${height}`)
  })

test('200 percent root text keeps the course map, the try note and the worked-route actions usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(base)
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  // The shared site header's own links can overflow at 200% root text; that header is outside
  // this module and unchanged here, so the overview is held to the module's own content.
  expect(await moduleOverflow(page)).toBe(0)
  expect(await inViewportAfterScroll(page, page.locator('[data-course-map]'))).toBe(true)
  await page.goto(`${base}/learn?lesson=vertical`)
  await ctReady(page)
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  await expect(page.locator('[data-enlarged-text="true"]')).toBeVisible()
  await button(page, 'Start marking branches').click()
  await ctReady(page)
  expect(await inViewportAfterScroll(page, page.locator('[data-mode="try"]'))).toBe(true)
  expect(await noHorizontalOverflow(page)).toBe(true)
  await capture(page, 'bbt04-L4-try-200-percent')
})

// PR #273 independent review — sanity repair. Each of these failed on the reviewed head 6004cd7f.
const storedRaw = (page: Page, key: string) =>
  page.evaluate((k) => localStorage.getItem(`branch-tracing.draft.${k}`), key)
const nowHeading = (page: Page) => page.locator('[data-now-card] h2')

test('review finding 1 · Lesson 5 states the response slice one slice cranial of a node nearest slice 306', async ({
  page,
}) => {
  await startLocal(page, 'horizontal-horizontal')
  await button(page, 'Continue without marking').click()
  await finishPendingIntroduction(page)
  await button(page, /^Next example: RB4/).click()
  await ctReady(page)
  await page.getByText('Before you mark: levels and what decides identity').click()
  const primer = page.locator('[data-division-primer="junction-19"]')
  await expect(primer).toContainText('The model node lies nearest native slice 306.')
  await expect(primer).toContainText(
    'Daughter B · RB4a’s response slice, 307, lies 1 slice cranial of the model node',
  )
  await expect(primer).not.toContainText('on the node’s level')
})

test('review findings 2 and 3 · the worked RS8 route reopens over real LS9 work and writes nothing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1427, height: 1226 })
  const lesson = LESSONS.find((l) => l.id === 'variants-limits')!
  const [RS8, LS9] = [lesson.example, lesson.prediction].map(
    (id) => targetForTrace(traceById(id)).segment.code,
  )
  await page.goto(`${base}/learn?lesson=${lesson.id}`)
  await ctReady(page)
  const fresh = await storedRaw(page, `learn.${lesson.id}`)
  await button(page, `Next worked junction (${RS8} route)`).click()
  await ctReady(page)
  await button(page, `Next worked junction (${RS8} route)`).click()
  await ctReady(page)
  expect(await storedRaw(page, `learn.${lesson.id}`)).toBe(fresh)
  await button(page, `Skip to your own trace: ${LS9}`).click()
  await orient(page)
  const point = traceById(lesson.prediction).checkpoints[0]
  await page.locator(`input[type="radio"][value="${point.sourceEdgeId}"]`).check()
  await button(page, 'Go to response slice').click()
  await ctReady(page)
  await page.getByRole('group', { name: /^CT image\./ }).press('Enter')
  await button(page, 'Check this junction').click()
  const snapshot = await storedRaw(page, `learn.${lesson.id}`)
  expect(JSON.parse(snapshot!).value.session.marks[0].pixel).not.toBeNull()
  await button(page, `View the worked ${RS8} route (reference)`).click()
  await ctReady(page)
  await expect(
    page.getByRole('heading', { name: `Worked example: the route to ${RS8}` }),
  ).toBeVisible()
  await button(page, `Next worked junction (${RS8} route)`).click()
  await ctReady(page)
  await button(page, `Next worked junction (${RS8} route)`).click()
  await ctReady(page)
  await page.getByRole('button', { name: /^Previous junction/ }).click()
  await ctReady(page)
  await button(page, '⇆ Flip left–right').click()
  expect(await storedRaw(page, `learn.${lesson.id}`)).toBe(snapshot)
  await button(page, `Return to your trace: ${LS9}`).click()
  await ctReady(page)
  await expect(nowHeading(page)).toHaveText(
    `Junction 1 of ${traceById(lesson.prediction).checkpoints.length - 1}`,
  )
  await expect(page.getByLabel('Your mark 1', { exact: true })).toBeVisible()
  expect(await storedRaw(page, `learn.${lesson.id}`)).toBe(snapshot)
  await page.reload()
  await ctReady(page)
  expect(JSON.parse((await storedRaw(page, `learn.${lesson.id}`))!)).toEqual(JSON.parse(snapshot!))
  await button(page, 'Continue to the next division').click()
  await expect(nowHeading(page)).toHaveText(
    `Junction 2 of ${traceById(lesson.prediction).checkpoints.length - 1}`,
  )
})

test('review finding 3 · a local worked walkthrough and Show reference leave the draft untouched', async ({
  page,
}) => {
  await startLocal(page, 'vertical')
  const ex = localExercise(LESSONS.find((l) => l.id === 'vertical')!.exercises![0])
  const label = displayAnswerLabel(ex.trace.checkpoints[0], 0, ex.answerPoints[0].label)
  await button(page, new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · slice`)).click()
  await ctReady(page)
  await button(page, 'Lumen unresolved here').click()
  const before = await storedRaw(page, 'learn.vertical')
  await button(page, 'Show reference').click()
  await ctReady(page)
  await button(page, 'Next demonstration slice').click()
  await ctReady(page)
  await button(page, 'Previous demonstration slice').click()
  await ctReady(page)
  await button(page, 'Show reference').click()
  await button(page, 'Replay the worked walkthrough').click()
  await ctReady(page)
  await button(page, 'Show reference').click()
  expect(await storedRaw(page, 'learn.vertical')).toBe(before)
  await page.reload()
  await ctReady(page)
  expect(JSON.parse((await storedRaw(page, 'learn.vertical'))!)).toEqual(JSON.parse(before!))
})

test('review finding 4 · Continue works after a skip, and a partial route ends truthfully, in Lesson 9 and Practice', async ({
  page,
}) => {
  const lesson = LESSONS.find((l) => l.id === 'variants-limits')!
  const own = traceById(lesson.prediction)
  await page.goto(`${base}/learn?lesson=${lesson.id}`)
  await ctReady(page)
  await button(page, `Skip to your own trace: ${targetForTrace(own).segment.code}`).click()
  await orient(page)
  await button(page, 'Continue without recording').click()
  await ctReady(page)
  await page.locator('input[type="radio"][value="unresolved"]').check()
  await button(page, 'Go to response slice').click()
  await ctReady(page)
  await button(page, 'Lumen unresolved here').click()
  await button(page, 'Check this junction').click()
  await button(page, 'Continue to the next division').click()
  await expect(nowHeading(page)).toHaveText(`Junction 3 of ${own.checkpoints.length - 1}`)
  const junctions = own.checkpoints.length - 1
  for (let i = 2; i < junctions; i++) {
    await button(page, 'Continue without recording').click()
    await ctReady(page)
  }
  await button(page, 'Go to response slice').click()
  await ctReady(page)
  await button(page, 'Lumen unresolved here').click()
  await button(page, 'Record nodule approach').click()
  await button(page, 'Continue with this partial route').click()
  await expect(nowHeading(page)).toHaveText('Describe its course')
  const session = JSON.parse((await storedRaw(page, `learn.${lesson.id}`))!).value.session
  expect(session.recorded[0]).toBe(false)
  expect(session.marks[0]).toBeNull()

  const trace = traceById(SEGMENT_PRACTICE_TRACES[2])
  await page.goto(`${base}/practice`)
  await button(page, 'Start CT practice').click()
  await orient(page)
  await button(page, 'Continue without recording').click()
  await ctReady(page)
  await page.locator('input[type="radio"][value="unresolved"]').check()
  await button(page, 'Go to response slice').click()
  await ctReady(page)
  await button(page, 'Lumen unresolved here').click()
  await button(page, 'Check this junction').click()
  await button(page, 'Continue to the next division').click()
  await expect(nowHeading(page)).toHaveText(`Junction 3 of ${trace.checkpoints.length - 1}`)
})
