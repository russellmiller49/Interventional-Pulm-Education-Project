import { expect, test, type Page } from '@playwright/test'
import { LESSONS } from '../src/features/bronchial-branch-tracing/content/lessons'
import { ASSESS_EXERCISES } from '../src/features/bronchial-branch-tracing/content/practice'
import {
  childrenOf,
  openingPosition,
} from '../src/features/bronchial-branch-tracing/content/phantoms'
import type { Exercise } from '../src/features/bronchial-branch-tracing/content/types'

const base = '/en/learn/anatomy/branch-tracing'
async function answer(page: Page, e: Exercise, wrong = false) {
  const branch = childrenOf(e.phantom).find((b) =>
    wrong ? b.id !== e.targetId : b.id === e.targetId,
  )
  await page
    .getByRole('radio', {
      name: branch ? `Branch ${branch.label}` : 'Continuation unresolved',
      exact: true,
    })
    .check()
}
async function sketch(page: Page, e: Exercise) {
  for (const b of childrenOf(e.phantom))
    await page
      .getByRole('combobox', { name: `Opening ${b.label}`, exact: true })
      .selectOption(openingPosition(e.phantom, b))
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
  await page.goto(base)
  await expect(page.getByRole('link', { name: 'Start learning' })).toHaveAttribute(
    'href',
    new RegExp(`lesson=${LESSONS[0].id}`),
  )
  await page.screenshot({ path: '/tmp/branch-tracing-overview.png', fullPage: true })
})
test('every lesson supports wrong prediction, manual reveal, transfer and retained completion', async ({
  page,
}) => {
  test.setTimeout(240000)
  for (const lesson of LESSONS) {
    await page.goto(`${base}/learn?lesson=${lesson.id}`)
    await page.getByRole('button', { name: 'Try a new branch' }).click()
    await expect(page.getByRole('heading', { name: 'Reference comparison' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Record branch choice' })).toBeDisabled()
    await answer(page, lesson.prediction, true)
    await page.getByRole('button', { name: 'Record branch choice' }).click()
    await expect(page.getByRole('heading', { name: 'Reference comparison' })).toHaveCount(0)
    await sketch(page, lesson.prediction)
    if (lesson.id === 'horizontal-vertical')
      await page.screenshot({ path: '/tmp/branch-tracing-pending.png', fullPage: true })
    await page.getByRole('button', { name: 'Submit opening map' }).click()
    await expect(page.getByText('Review the branch connection', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reference comparison' })).toHaveCount(1)
    await page.getByRole('button', { name: 'Read the explanation' }).click()
    await page.getByRole('button', { name: 'Apply it to a changed view' }).click()
    await expect(page.getByRole('heading', { name: 'Reference comparison' })).toHaveCount(0)
    await answer(page, lesson.transfer)
    await sketch(page, lesson.transfer)
    await page.getByRole('button', { name: 'Submit new interpretation' }).click()
    await expect(page.getByRole('button', { name: 'Finish lesson' })).toBeVisible()
    await page.getByRole('button', { name: 'Finish lesson' }).click()
    await expect(page.getByRole('heading', { name: 'Ready for the next branch' })).toBeVisible()
  }
  await page.goto(base)
  await expect(page.getByText('8/8 complete', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Review the course' }).click()
  await expect(page.getByRole('button', { name: 'Try a new branch' })).toBeVisible()
})
test('assessment masks all reference feedback until the final submission', async ({ page }) => {
  await page.goto(base + '/assess')
  await page.getByRole('button', { name: 'Start geometric assessment' }).click()
  for (const exercise of ASSESS_EXERCISES) {
    await expect(page.getByRole('heading', { name: 'Reference comparison' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Show a hint' })).toHaveCount(0)
    await expect(
      page.getByText('Branch choice consistent with the evidence', { exact: true }),
    ).toHaveCount(0)
    await answer(page, exercise)
    await sketch(page, exercise)
    await page.getByRole('button', { name: 'Record interpretation' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Reference comparison' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Submit all interpretations' }).click()
  await expect(page.getByRole('heading', { name: 'Interpretation debrief' })).toBeVisible()
  await expect(page.getByText(/First-attempt unassisted branch decisions: 4\/4/)).toBeVisible()
  await page.screenshot({ path: '/tmp/branch-tracing-debrief.png', fullPage: true })
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
      await expect(page.getByRole('button', { name: 'Try a new branch' })).toBeVisible()
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
  await page.getByRole('button', { name: 'Try a new branch' }).click()
  await page.getByRole('radio', { name: 'Continuation unresolved', exact: true }).check()
  await page.getByRole('button', { name: 'Record branch choice' }).click()
  await expect(
    page.getByText('Browser storage is unavailable. Work continues, but progress cannot be saved.'),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Try a new branch' })).toBeVisible()
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
