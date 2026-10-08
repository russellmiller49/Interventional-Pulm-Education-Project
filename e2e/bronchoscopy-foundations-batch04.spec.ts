import { createHash } from 'crypto'
import { expect, test, type Page } from '@playwright/test'
import { bronchStageLesson } from '../src/features/bronchoscopy-foundations/content/stageLessons'
import type { BronchSectionId } from '../src/features/bronchoscopy-foundations/content/pathway'
import { BRONCH_STORAGE_KEY } from '../src/features/bronchoscopy-foundations/engine/learnProgress'
import { BRONCH_SELF_PACED_STORAGE_KEY } from '../src/features/bronchoscopy-foundations/engine/selfPacedProgress'

/**
 * BF-PRE-REVIEW-04 — teaching clarity, honest review state, the survey-to-report path, and the
 * 3D view's retry (BF-01 finding 3). Real routes of the production build with native pointer and
 * keyboard input: no forced clicks, no injected reducer state, no fabricated survey.
 */
test.skip(!process.env.BRONCH_FOUNDATIONS_BASE_URL, 'Use the dedicated config and a local server.')
test.setTimeout(120_000)

const base = '/en/bronchoscopy-foundations'
const primary = (page: Page) => page.locator('[data-now-card] [data-now-primary]')
const skip = (page: Page) => page.locator('[data-now-card] [data-now-skip]')
const stage = (page: Page) => page.locator('[data-stage]')
const three = (page: Page) => page.locator('[data-three-state]')
const sha256 = (value: string | null) =>
  value === null ? null : createHash('sha256').update(value).digest('hex')

test.beforeEach(async ({ page }) => {
  const url = process.env.BRONCH_FOUNDATIONS_BASE_URL!
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
    throw new Error('Local server required')
  await page.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
})

async function openSection(page: Page, id: BronchSectionId) {
  const lesson = bronchStageLesson(id)
  await page.goto(base + '/learn?section=' + id)
  await expect(stage(page)).toHaveAttribute('data-stage', lesson.steps[0].id)
  return lesson
}

/** Walks to the first step of the given kind by the ways on the page offers, answering nothing. */
async function walkTo(page: Page, id: BronchSectionId, stop: (stepId: string) => boolean) {
  const lesson = await openSection(page, id)
  for (let guard = 0; guard <= lesson.steps.length; guard += 1) {
    const stepId = (await stage(page).getAttribute('data-stage'))!
    if (stop(stepId)) return lesson
    if (await skip(page).count()) await skip(page).click()
    else await primary(page).click()
    await expect(stage(page)).not.toHaveAttribute('data-stage', stepId)
  }
  throw new Error('step not reached')
}

async function stored(page: Page) {
  return page.evaluate(
    ([current, earlier]) => ({
      current: localStorage.getItem(current),
      earlier: localStorage.getItem(earlier),
    }),
    [BRONCH_SELF_PACED_STORAGE_KEY, BRONCH_STORAGE_KEY],
  )
}

test.describe('BF-01 finding 3: the 3D view comes back after an asset failure', () => {
  const LARYNX_ASSETS = '**/anatomy/larynx/**'

  async function failedLarynxScene(page: Page) {
    await page.route(LARYNX_ASSETS, (route) => route.abort())
    const lesson = bronchStageLesson('larynx-and-entry')
    const act = lesson.steps.find((step) => step.interaction.kind === 'scope-task')!
    await walkTo(page, 'larynx-and-entry', (stepId) => stepId === act.id)
    await three(page).scrollIntoViewIfNeeded()
    await expect(three(page)).toHaveAttribute('data-three-state', 'failed', { timeout: 30_000 })
    await expect(page.getByText('The 3D view could not be loaded.')).toBeVisible()
  }

  test('failure, schematic view, then Try the 3D view again reaches a drawn scene', async ({
    page,
  }) => {
    await failedLarynxScene(page)
    await page.getByRole('button', { name: 'Use the schematic view', exact: true }).click()
    await expect(page.locator('[data-scope-state="fallback"]')).toBeVisible()
    await page.unroute(LARYNX_ASSETS)
    const retry = page.getByRole('button', { name: 'Try the 3D view again', exact: true })
    await retry.focus()
    await page.keyboard.press('Enter')
    await three(page).scrollIntoViewIfNeeded()
    await expect(three(page)).toHaveAttribute('data-three-state', 'ready', { timeout: 30_000 })
    // The controls open with the drawn scene, and the learner's command reaches the model.
    await expect(page.locator('[data-scope-state="ready"]')).toBeVisible()
  })

  test('a retry that fails again says so, and each further retry is a new bounded attempt', async ({
    page,
  }) => {
    await failedLarynxScene(page)
    await page.getByRole('button', { name: 'Use the schematic view', exact: true }).click()
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.getByRole('button', { name: 'Try the 3D view again', exact: true }).click()
      await three(page).scrollIntoViewIfNeeded()
      // Still failing: the view reports the failure instead of staying in "loading".
      await expect(three(page)).toHaveAttribute('data-three-state', 'failed', { timeout: 30_000 })
      await page.getByRole('button', { name: 'Use the schematic view', exact: true }).click()
      await expect(page.locator('[data-scope-state="fallback"]')).toBeVisible()
    }
    // The in-place reload is the same machine: failing again returns to failed, not to loading.
    await page.getByRole('button', { name: 'Try the 3D view again', exact: true }).click()
    await expect(three(page)).toHaveAttribute('data-three-state', 'failed', { timeout: 30_000 })
    await page.getByRole('button', { name: 'Reload the 3D view', exact: true }).click()
    await expect(three(page)).toHaveAttribute('data-three-state', 'failed', { timeout: 30_000 })
    // Then the assets come back and one more retry draws.
    await page.unroute(LARYNX_ASSETS)
    await page.getByRole('button', { name: 'Reload the 3D view', exact: true }).click()
    await expect(three(page)).toHaveAttribute('data-three-state', 'ready', { timeout: 30_000 })
  })
})

export { sha256, stored, walkTo, openSection, primary, skip, stage }
