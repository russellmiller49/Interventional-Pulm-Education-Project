import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { LESSONS, lessonById } from '../src/features/eus-b-guided/content/curriculum'
import { eusbLab } from '../src/lib/eus-b-guided-contract'
import { stationById } from '../src/features/eus-b-guided/content/stations'
import { goToActivity, lab } from './eus-b-guided-steps'

const manifest = JSON.parse(
  readFileSync(
    join(process.cwd(), 'EBUS-course/apps/web/public/simulator/eus-b-case-001/case_manifest.json'),
    'utf8',
  ),
) as { landmarks: { key: string; sMm: number; rollDeg: number }[] }
const viewOf = (key: string) => manifest.landmarks.find((landmark) => landmark.key === key)!

/** Everything the learner needs for the task is inside the window, and neither page scrolls. */
async function expectOneScreen(page: Page) {
  const size = page.viewportSize()!
  const shell = await page.locator('main').first().boundingBox()
  expect(shell!.y + shell!.height).toBeLessThanOrEqual(size.height + 1)
  for (const selector of ['[data-now-primary]', 'iframe[title="EUS-B lab"]']) {
    const box = await page.locator(selector).boundingBox()
    expect(box, selector).not.toBeNull()
    expect(box!.y, selector).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height, selector).toBeLessThanOrEqual(size.height + 1)
    expect(box!.x + box!.width, selector).toBeLessThanOrEqual(size.width + 1)
  }
  const inside = await lab(page)
    .locator('.eusg')
    .evaluate(() => {
      const within = (element: Element) => {
        const box = element.getBoundingClientRect()
        return (
          box.top >= 0 && box.bottom <= window.innerHeight + 1 && box.right <= window.innerWidth + 1
        )
      }
      return {
        scrolls: document.scrollingElement!.scrollHeight > window.innerHeight + 1,
        image: within(document.querySelector('[data-eusg-image]')!),
        controls: Array.from(document.querySelectorAll('input[type=range], button')).every(within),
        // The white light view, and the 3D view while it is open.
        views: Array.from(document.querySelectorAll('[data-eusg-view]')).every(within),
      }
    })
  expect(inside).toEqual({ scrolls: false, image: true, controls: true, views: true })
}

/** Click a landmark in the lab's image, at the point the lab itself gives for it. */
async function clickLandmark(page: Page, key: string) {
  const frame = lab(page)
  const point = await frame.locator('.eusg').evaluate(
    (_, structure) =>
      (
        window as unknown as {
          __eusgTest: { landmarkPoint(key: string): { x: number; y: number } | null }
        }
      ).__eusgTest.landmarkPoint(structure),
    key,
  )
  expect(point, key).not.toBeNull()
  const box = (await frame.locator('[data-eusg-image]').boundingBox())!
  await page.mouse.click(box.x + point!.x * box.width, box.y + point!.y * box.height)
}

const scopeLessons = LESSONS.filter((lesson) => lesson.steps.some((step) => step.kind === 'lab'))

for (const size of [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  for (const lessonId of scopeLessons.map((lesson) => lesson.id)) {
    test(`${lessonId}: find the view, then read it labeled, on one screen at ${size.width}x${size.height}`, async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const lesson = lessonById(lessonId)!
      const task = lesson.steps.find((step) => step.kind === 'lab')!
      if (task.kind !== 'lab') throw new Error('no scope task')
      const debrief = lesson.steps.find((step) => step.kind === 'debrief')!
      const target = viewOf(eusbLab(task.lab).target!)
      await page.setViewportSize(size)
      await page.goto(`/en/eus-b-guided/learn?section=${lessonId}`)
      await goToActivity(page, `${lessonId}:${task.id}`)

      const frame = lab(page)
      const root = frame.locator('.eusg')
      await expect(root).toHaveAttribute('data-eusg-lab', task.lab, { timeout: 60_000 })
      await expect(root).toHaveAttribute('data-phase', 'work')
      await expect(root).toHaveAttribute('data-frame-ready', 'true', { timeout: 60_000 })
      await expectOneScreen(page)

      // While searching, nothing in the lab names a structure, and the way on is closed.
      await expect(root).toHaveAttribute('data-names', 'hidden')
      await expect(frame.locator('[data-eusg-legend]')).toHaveCount(0)
      const primary = page.locator('[data-now-primary]')
      await expect(primary).toBeDisabled()
      await expect(page.locator('[data-requirement]')).toHaveAttribute('data-met', 'false')
      // Only the two movements the task offers are drawn.
      await expect(frame.locator('input[type=range]')).toHaveCount(2)
      // The white light view is beside the image, and it does not say which organ the scope is in.
      const whiteLight = frame.locator('[data-eusg-view="endoscope"]')
      await expect(whiteLight).toBeVisible()
      await expect(whiteLight.locator('.eus-endoscope-image')).toHaveAttribute(
        'data-status',
        'ready',
        { timeout: 60_000 },
      )
      await expect(whiteLight).not.toContainText(/stomach|esophagus/i)
      await expect(frame.locator('[data-eusg-view="anatomy"]')).toHaveCount(0)

      await frame.getByRole('slider', { name: /Rotate the shaft/ }).fill(String(target.rollDeg))
      await frame.getByRole('slider', { name: /Advance or withdraw/ }).fill(String(target.sMm))
      await expect(root).toHaveAttribute('data-found', 'true', { timeout: 15_000 })
      await expect(page.locator('[data-requirement]')).toHaveAttribute('data-met', 'true')
      await expect(primary).toBeEnabled()
      await expectOneScreen(page)

      await primary.click()

      // Where the lesson has one, the landmarks are marked next, on a still with nothing named.
      const marking = lesson.steps[lesson.steps.indexOf(task) + 1]
      if (marking.kind === 'identify') {
        const landmarks = eusbLab(marking.lab).landmarks!
        await expect(page.locator('[data-eusb-flow]')).toHaveAttribute(
          'data-activity-id',
          `${lessonId}:${marking.id}`,
        )
        await expect(root).toHaveAttribute('data-eusg-lab', marking.lab)
        await expect(root).toHaveAttribute('data-names', 'hidden')
        await expect(root).toHaveAttribute('data-frame-ready', 'true', { timeout: 30_000 })
        await expect(frame.locator('[data-eusg-legend]')).toHaveCount(0)
        await expect(frame.locator('input[type=range]')).toHaveCount(0)
        await expect(frame.locator('[data-eusg-ask] li')).toHaveCount(landmarks.length)
        await expect(page.locator('[data-requirement]')).toHaveCount(landmarks.length)
        await expect(primary).toBeDisabled()
        await expectOneScreen(page)
        for (const [at, key] of landmarks.entries()) {
          await expect(root).toHaveAttribute('data-eusg-asked', key)
          await clickLandmark(page, key)
          await expect(page.locator('[data-requirement]').nth(at)).toHaveAttribute(
            'data-met',
            'true',
          )
        }
        await expect(root).toHaveAttribute('data-identify-done', 'true')
        await expect(primary).toBeEnabled()
        await expectOneScreen(page)
        await primary.click()
      }

      await expect(page.locator('[data-eusb-flow]')).toHaveAttribute(
        'data-activity-id',
        `${lessonId}:${debrief.id}`,
      )
      await expect(root).toHaveAttribute('data-phase', 'review')
      await expect(root).toHaveAttribute('data-names', 'shown')
      await expect(root).toHaveAttribute('data-frame-ready', 'true', { timeout: 30_000 })
      await expect(frame.locator('[data-eusg-legend] li').first()).toBeVisible()
      await expect(frame.locator('input[type=range]')).toHaveCount(0)
      await expect(page.locator('[data-debrief-reference]')).toHaveCount(0)
      // The numbered landmarks beside the text are the numbered landmarks on the image.
      if (debrief.kind === 'debrief' && debrief.station) {
        const keys = stationById(debrief.station)!.landmarks.map((landmark) => landmark.key)
        const listed = page.locator('[data-station-landmarks] [data-landmark]')
        await expect(listed).toHaveCount(keys.length)
        const onImage = frame.locator('[data-eusg-landmarks] li[data-structure]')
        await expect(onImage).toHaveCount(keys.length)
        for (const [at, key] of keys.entries()) {
          await expect(listed.nth(at)).toHaveAttribute('data-landmark', key)
          await expect(onImage.nth(at)).toHaveAttribute('data-structure', key)
          await expect(onImage.nth(at)).toHaveAttribute('data-number', String(at + 1))
        }
        // The station itself was held, so its badge is on the image.
        await expect(frame.locator(`[data-eusg-marker="${keys.at(-1)}"]`)).toBeVisible()
      }
      await expectOneScreen(page)
    })
  }
}

test('a learner who is stuck can open the 3D view and be shown the view', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/en/eus-b-guided/learn?section=liver')
  await goToActivity(page, 'liver:find-the-liver')
  const frame = lab(page)
  const root = frame.locator('.eusg')
  await expect(root).toHaveAttribute('data-frame-ready', 'true', { timeout: 60_000 })
  const primary = page.locator('[data-now-primary]')
  await expect(primary).toBeDisabled()

  // The 3D view opens beside the image and closes again; opening it finishes nothing.
  const anatomy = frame.locator('[data-eusg-view="anatomy"]')
  await frame.locator('[data-eusg-help="anatomy"]').click()
  await expect(anatomy).toBeVisible()
  await expect(anatomy.locator('.eus-anatomy-canvas')).toHaveAttribute('data-status', 'ready', {
    timeout: 90_000,
  })
  await expectOneScreen(page)
  await expect(primary).toBeDisabled()
  await frame.locator('[data-eusg-help="anatomy"]').click()
  await expect(anatomy).toHaveCount(0)

  // Show me drives the scope to the view. The task then says the view was shown, not found.
  await frame.locator('[data-eusg-help="show"]').click()
  await expect(root).toHaveAttribute('data-demo', 'running')
  await expect(frame.getByRole('slider', { name: /Rotate the shaft/ })).toBeDisabled()
  await expect(root).toHaveAttribute('data-shown', 'true', { timeout: 20_000 })
  await expect(root).toHaveAttribute('data-found', 'false')
  await expect(frame.locator('[data-eusg-hold]')).toHaveText('View shown')
  await expect(frame.locator('[data-eusg-help="show"]')).toHaveCount(0)
  await expect(page.locator('[data-requirement]')).toHaveText(
    /You were shown the left lobe of the liver\./,
  )
  await expect(primary).toBeEnabled()
  await expect(primary).toHaveText('Continue with the view shown')
  await expectOneScreen(page)

  await primary.click()
  await expect(page.locator('[data-eusb-flow]')).toHaveAttribute('data-step-kind', 'debrief')
  await expect(page.locator('[data-debrief-reference]')).toHaveAttribute(
    'data-debrief-reference',
    'shown',
  )
  await expect(root).toHaveAttribute('data-phase', 'review')

  // Starting the task again gives it back unfinished, with the help unused.
  await page.getByRole('button', { name: 'Previous task' }).click()
  await expect(root).toHaveAttribute('data-phase', 'work')
  await expect(root).toHaveAttribute('data-shown', 'false')
  await expect(frame.locator('[data-eusg-help="show"]')).toBeVisible()
  await expect(primary).toBeDisabled()
})

test('a missed landmark is not named, and one the learner is shown is recorded as shown', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/en/eus-b-guided/learn?section=station-4l')
  await goToActivity(page, 'station-4l:mark-station-4l')
  const frame = lab(page)
  const root = frame.locator('.eusg')
  await expect(root).toHaveAttribute('data-eusg-lab', 'station-4l-landmarks', { timeout: 60_000 })
  await expect(root).toHaveAttribute('data-frame-ready', 'true', { timeout: 60_000 })
  const [first, second, node] = eusbLab('station-4l-landmarks').landmarks!
  const rows = page.locator('[data-requirement]')
  const asked = frame.locator('[data-eusg-ask] li')

  // Asked for the first landmark, the learner clicks the node: nothing is given away.
  await expect(root).toHaveAttribute('data-eusg-asked', first)
  await clickLandmark(page, node)
  await expect(frame.locator('[data-eusg-identify-result]')).toContainText('Try again')
  await expect(frame.locator('[data-eusg-identify-result]')).not.toContainText(/station 4L/i)
  await expect(root).toHaveAttribute('data-eusg-asked', first)
  await expect(rows.nth(0)).toHaveAttribute('data-met', 'false')
  await expect(frame.locator('[data-eusg-marker]')).toHaveCount(0)

  // Shown at the learner's request: listed as shown on both sides.
  await frame.locator('[data-eusg-identify-show]').click()
  await expect(asked.nth(0)).toHaveAttribute('data-state', 'shown')
  await expect(rows.nth(0)).toHaveText(/You were shown the aorta\./)
  await expect(rows.nth(0)).toHaveAttribute('data-met', 'true')

  await expect(root).toHaveAttribute('data-eusg-asked', second)
  await clickLandmark(page, second)
  await expect(asked.nth(1)).toHaveAttribute('data-state', 'done')
  await clickLandmark(page, node)
  await expect(root).toHaveAttribute('data-identify-done', 'true')
  await expect(page.locator('[data-now-primary]')).toBeEnabled()
  await expectOneScreen(page)

  // Starting again clears every mark.
  await page.locator('[data-restart-task]').click()
  await expect(root).toHaveAttribute('data-identify-done', 'false')
  await expect(root).toHaveAttribute('data-eusg-asked', first)
  await expect(page.locator('[data-now-primary]')).toBeDisabled()
})

test('a scope task left unfinished is explained on the landmark, and says so', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/en/eus-b-guided/learn?section=liver')
  await goToActivity(page, 'liver:find-the-liver')
  await page.locator('[data-skip-lab]').click()
  await expect(page.locator('[data-eusb-flow]')).toHaveAttribute('data-step-kind', 'debrief')
  await expect(page.locator('[data-debrief-reference]')).toBeVisible()
  await expect(lab(page).locator('.eusg')).toHaveAttribute('data-phase', 'review', {
    timeout: 60_000,
  })
})

test('the overview opens the first lesson and shows the survey route', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/en/eus-b-guided')
  await expect(page.locator('[data-survey-route]')).toBeVisible()
  const door = page.locator('[data-course-door]')
  await expect(door).toHaveAttribute('href', new RegExp(`section=${LESSONS[0].id}$`))
  await door.click()
  await expect(page.locator('[data-eusb-flow]')).toHaveAttribute(
    'data-activity-id',
    `${LESSONS[0].id}:${LESSONS[0].steps[0].id}`,
  )
  // Nothing that answers the first prediction is on the page before a response.
  await expect(page.locator('[data-answer-verdict]')).toHaveCount(0)
  await expect(page.locator('[data-explanation-reveal]')).toHaveCount(0)
})
