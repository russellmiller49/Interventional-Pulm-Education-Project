import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { LESSONS, lessonById } from '../src/features/eus-b-guided/content/curriculum'
import { eusbLab } from '../src/lib/eus-b-guided-contract'
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

for (const size of [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  for (const lessonId of ['liver', 'station-7'] as const) {
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
      await expectOneScreen(page)
    })
  }
}

test('a learner who is stuck can open the 3D view and be shown the view', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/en/eus-b-guided/learn?section=station-7')
  await goToActivity(page, 'station-7:find-station-7')
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
  await expect(page.locator('[data-requirement]')).toHaveText(/You were shown station 7\./)
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
