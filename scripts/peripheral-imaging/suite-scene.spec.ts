import { test, expect, type Locator, type Page } from '@playwright/test'
import { createRequire } from 'node:module'
import type { AxeResults } from 'axe-core'
import {
  DEFAULT_GEOMETRY,
  LESION_CENTER,
  projectToDetector,
  toolTipForDepth,
} from '../../src/features/peripheral-imaging/lib/physics'

test.setTimeout(120_000)
const preview = '/scripts/peripheral-imaging/suite-harness.html'
const suiteRequire = createRequire(`${process.cwd()}/package.json`)
async function ready(page: Page) {
  await expect(page.locator('[data-suite-state=ready]')).toBeVisible()
  await expect(page.locator('[data-projection-state=ready]')).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(2)
}
async function setRange(page: Page, label: string, value: number) {
  const input = page.getByRole('slider', { name: label, exact: true })
  await input.fill(String(value - 1))
  await input.press('ArrowRight')
  await expect(input).toHaveValue(String(value))
}
const pixels = (canvas: Locator) =>
  canvas.evaluate((node) => {
    const c = node as HTMLCanvasElement,
      gl = c.getContext('webgl2')!
    const bytes = new Uint8Array(c.width * c.height * 4)
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes)
    let low = 255,
      high = 0
    for (let i = 0; i < bytes.length; i += 4) {
      low = Math.min(low, bytes[i])
      high = Math.max(high, bytes[i])
    }
    return high - low
  })

test('scene, detector and lab oracle agree; native chain answers lock after commit', async ({
  page,
}) => {
  await page.goto(preview)
  await page.bringToFront()
  await ready(page)
  const scene = page.locator('canvas[data-three-state=ready]'),
    monitor = page.locator('[data-projection-state=ready] canvas')
  await expect.poll(() => pixels(scene)).toBeGreaterThan(35)
  await expect.poll(() => pixels(monitor)).toBeGreaterThan(35)
  const before = await scene.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
  const monitorBefore = await monitor.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
  await setRange(page, 'C-arm obliquity', 30)
  await setRange(page, 'Cranial / caudal tilt', 15)
  const a = projectToDetector(LESION_CENTER, 30, 15),
    b = projectToDetector(toolTipForDepth(22), 30, 15)
  await expect(page.locator('[data-readout=separationMm] dd')).toHaveText(
    Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(1) + ' mm',
  )
  await expect(page.locator('[data-target-overlay]')).toHaveAttribute(
    'cx',
    String(256 + (a[0] / DEFAULT_GEOMETRY.field) * 512),
  )
  await expect
    .poll(() => scene.evaluate((c) => (c as HTMLCanvasElement).toDataURL()))
    .not.toBe(before)
  await expect
    .poll(() => monitor.evaluate((c) => (c as HTMLCanvasElement).toDataURL()))
    .not.toBe(monitorBefore)
  await expect(page.locator('[data-model-boundary]')).toContainText('Authored cone geometry')
  await expect(page.locator('[data-harness-child]')).toBeVisible()
  await page.getByRole('button', { name: 'Toggle chain answer' }).click()
  await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-lit', '')
  await expect(page.locator('[data-chain-map] [data-chain-pin]')).toHaveCount(6)
  await expect(page.locator('[data-chain-map] [aria-current]')).toHaveCount(0)
  await expect(page.locator('[data-chain-outcome]')).toHaveCount(0)
  await expect(page.locator('[role=img] label[data-chain-pin]')).toHaveCount(0)
  await page.locator('label[data-chain-pin=detector]').click()
  const selected = page.locator('input[type=radio][value=detector]')
  await expect(selected).toBeChecked()
  await selected.press('ArrowRight')
  await expect(page.locator('input[type=radio][value=patient]')).toBeChecked()
  await page.getByRole('button', { name: 'Commit preview answer' }).click()
  await expect(page.locator('[data-chain-answer]')).toHaveAttribute('data-chain-outcome', 'other')
  for (const radio of await page.getByRole('radio').all()) await expect(radio).toBeDisabled()
  await expect(page.getByRole('slider', { name: 'C-arm obliquity', exact: true })).toBeDisabled()
})

test('signal density changes with angle; reduced motion is settled and Step moves one degree', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(preview)
  await page.bringToFront()
  await ready(page)
  await page.getByRole('button', { name: 'Toggle signal mode' }).click()
  await ready(page)
  await expect(page.locator('[data-ray-profile-state=ready]')).toBeVisible()
  const before = await page.locator('[data-ray-tissue=soft]').textContent()
  await setRange(page, 'C-arm obliquity', 30)
  await expect(page.locator('[data-ray-tissue=soft]')).not.toHaveText(before!)
  await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-anim', 'idle')
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'C-arm obliquity', exact: true })).toHaveValue('31')
  await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-anim', 'idle')
  await page.setViewportSize({ width: 390, height: 1000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('context loss recovers the scene and a failed monitor leaves the scene usable', async ({
  page,
}) => {
  await page.goto(preview)
  await page.bringToFront()
  await ready(page)
  await page
    .locator('canvas[data-three-state=ready]')
    .evaluate((c) =>
      (c as HTMLCanvasElement)
        .getContext('webgl2')!
        .getExtension('WEBGL_lose_context')!
        .loseContext(),
    )
  await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-state', 'failed')
  await page.getByRole('button', { name: 'Restore 3D view' }).click()
  await ready(page)
  await page
    .locator('[data-projection-state] canvas')
    .evaluate((c) =>
      (c as HTMLCanvasElement)
        .getContext('webgl2')!
        .getExtension('WEBGL_lose_context')!
        .loseContext(),
    )
  await expect(page.locator('[data-projection-state=failed]')).toBeVisible()
  await expect(page.locator('[data-suite-state=ready]')).toBeVisible()
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'C-arm obliquity', exact: true })).toHaveValue('1')
})

test('switching ready modes stays within two live WebGL contexts', async ({ page }) => {
  await page.addInitScript(() => {
    const contexts = new Set<WebGLRenderingContext>()
    const original = HTMLCanvasElement.prototype.getContext
    const observed: { maximum: number } = { maximum: 0 }
    Object.assign(window, { suiteContextBudget: observed })
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: [contextId: string, options?: unknown]
    ) {
      const result: unknown = Reflect.apply(original, this, args)
      if (result && (args[0] === 'webgl' || args[0] === 'webgl2')) {
        contexts.add(result as WebGLRenderingContext)
        observed.maximum = Math.max(
          observed.maximum,
          [...contexts].filter((gl) => !gl.isContextLost()).length,
        )
      }
      return result
    } as typeof original
  })
  await page.goto(preview)
  await page.bringToFront()
  await ready(page)
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Toggle signal mode' }).click()
    await ready(page)
  }
  const budget = await page.evaluate(
    () =>
      (window as unknown as { suiteContextBudget: { maximum: number } }).suiteContextBudget.maximum,
  )
  expect(budget).toBeLessThanOrEqual(2)
})

test('the native chain answer and signal view have no automated accessibility violations', async ({
  page,
}) => {
  await page.goto(preview)
  await page.bringToFront()
  await ready(page)
  await page.getByRole('button', { name: 'Toggle signal mode' }).click()
  await ready(page)
  await page.getByRole('button', { name: 'Toggle chain answer' }).click()
  await page.addScriptTag({ path: suiteRequire.resolve('axe-core/axe.min.js') })
  const result = await page.evaluate(() =>
    (
      window as unknown as {
        axe: { run: (context: string) => Promise<AxeResults> }
      }
    ).axe.run('[data-suite-scene]'),
  )
  expect(result.violations).toEqual([])
})

test('stage camera, spotlight, pause, hidden monitor and reset props stay live', async ({
  page,
}) => {
  await page.goto(preview)
  await page.bringToFront()
  await ready(page)
  await page.getByRole('button', { name: 'Side', exact: true }).click()
  await page.getByRole('button', { name: 'Change supplied camera' }).click()
  await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-camera', 'beam')
  await page.getByRole('button', { name: 'Change supplied camera' }).click()
  await page.getByRole('button', { name: 'Suite', exact: true }).click()
  await page.getByRole('button', { name: 'Spotlight tool depth' }).click()
  const depth = page.locator('#peripheral-imaging-control-depth')
  await expect(depth).toBeFocused()
  await expect(page.locator('[data-spotlight=true]')).toContainText('Tool depth offset')
  await setRange(page, 'C-arm obliquity', 30)
  await page.getByRole('button', { name: 'Toggle review pause' }).click()
  await expect(page.getByText('Reviewing the earlier state.', { exact: true })).toBeVisible()
  await expect(depth).toBeDisabled()
  await page.getByRole('button', { name: 'Toggle review pause' }).click()
  await page.getByRole('button', { name: 'Reset this model' }).click()
  await expect(page.getByRole('slider', { name: 'C-arm obliquity', exact: true })).toHaveValue('0')
  await expect(depth).toHaveValue('22')
  await page.getByRole('button', { name: 'Toggle monitor' }).click()
  await expect(page.locator('[data-projection-state=ready]')).toBeHidden()
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'C-arm obliquity', exact: true })).toHaveValue('1')
  await expect(page.locator('[data-suite-state=ready]')).toBeVisible()
  expect(await pixels(page.locator('[data-projection-state=ready] canvas'))).toBeGreaterThan(35)
})
