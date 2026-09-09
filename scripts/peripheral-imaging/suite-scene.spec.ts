import { SUITE_VIEWS } from '../../src/features/peripheral-imaging/content/suiteViews'
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
  await expect(page.locator('[data-suite-state=ready]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-projection-state=ready]')).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(2)
}
async function setRange(page: Page, label: string, value: number) {
  const input = page.getByRole('slider', { name: label, exact: true })
  const minimum = Number(await input.getAttribute('min'))
  const step = Number(await input.getAttribute('step')) || 1
  const fromAbove = value - step < minimum
  await input.fill(String(fromAbove ? value + step : value - step))
  await input.press(fromAbove ? 'ArrowLeft' : 'ArrowRight')
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
  await expect(page.locator('[data-suite-state=ready]')).toBeVisible({ timeout: 15000 })
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
  await expect(page.locator('[data-suite-state=ready]')).toBeVisible({ timeout: 15000 })
  expect(await pixels(page.locator('[data-projection-state=ready] canvas'))).toBeGreaterThan(35)
})

test('field shutters, display crop and monitor zoom have distinct physical effects', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${preview}?section=field`)
  await page.bringToFront()
  await ready(page)
  const scene = page.locator('canvas[data-three-state=ready]')
  const original = await scene.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
  await setRange(page, 'Field side length', 45)
  await expect(page.locator('[data-readout=irradiatedAreaPct] dd')).toHaveText('20%')
  await expect
    .poll(() => scene.evaluate((c) => (c as HTMLCanvasElement).toDataURL()))
    .not.toBe(original)
  const narrowed = await scene.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
  const mask = await page.locator('[data-field-mask] path').getAttribute('d')
  await page
    .getByRole('checkbox', { name: 'Use display crop instead of physical shutters' })
    .check()
  await expect(page.locator('[data-field-mask]')).toHaveAttribute('data-physical-field', '100')
  await expect(page.locator('[data-field-mask] path')).toHaveAttribute('d', mask!)
  await expect(page.locator('[data-readout=irradiatedAreaPct] dd')).toContainText('100')
  await expect
    .poll(() => scene.evaluate((c) => (c as HTMLCanvasElement).toDataURL()))
    .not.toBe(narrowed)
  // DOM bindings update before the demand-rendered scene. Wait for the restored
  // cone and detector texture to settle before testing a display-only change.
  await expect
    .poll(async () => {
      const before = await scene.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
      await page.waitForTimeout(200)
      return before === (await scene.evaluate((c) => (c as HTMLCanvasElement).toDataURL()))
    })
    .toBe(true)
  const cropped = await scene.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
  await page.getByRole('slider', { name: 'Stored-image display zoom' }).fill('2')
  await expect(page.locator('[data-monitor-zoom]')).toHaveAttribute('data-monitor-zoom', '2')
  await expect.poll(() => scene.evaluate((c) => (c as HTMLCanvasElement).toDataURL())).toBe(cropped)
  await page.getByRole('button', { name: 'Toggle control lock' }).click()
  await expect(page.getByRole('slider', { name: 'Field side length' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Step', exact: true })).toBeDisabled()
  await expect(page.locator('[data-model-boundary]')).toHaveText(SUITE_VIEWS.field.boundary)
})

test('time holds discrete images over a static DRR; reduced motion steps one pulse and locking pauses', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${preview}?section=time`)
  await page.bringToFront()
  await ready(page)
  const suite = page.locator('[data-suite-scene]')
  await expect(suite).toHaveAttribute('data-suite-anim', 'idle')
  const overlay = page.locator('[data-temporal-frame]')
  const frame = Number(await overlay.getAttribute('data-temporal-frame'))
  const image = page.locator('[data-projection-state=ready] canvas')
  const background = await image.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(overlay).toHaveAttribute('data-temporal-frame', String(frame + 1))
  await expect(suite).toHaveAttribute('data-suite-anim', 'idle')
  await setRange(page, 'Pulse width', 20)
  await expect(page.locator('[data-readout=inFrameBlurMm] dd')).toHaveText('0.40 mm')
  await expect(page.locator('[data-time-sample]')).toHaveCount(6)
  await expect
    .poll(() => image.evaluate((c) => (c as HTMLCanvasElement).toDataURL()))
    .toBe(background)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(suite).toHaveAttribute('data-suite-anim', 'running')
  await page.getByRole('button', { name: 'Toggle control lock' }).click()
  await expect(suite).toHaveAttribute('data-suite-anim', 'idle')
  await expect(page.getByRole('button', { name: 'Step', exact: true })).toBeDisabled()
})

test('CBCT shares one DRR across scouts and orbit, gates capture, and invalidates a moved setup', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${preview}?section=mobile-suite`)
  await page.bringToFront()
  await expect(page.locator('[data-suite-state=ready]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-scout-state=ready]')).toHaveCount(2)
  await expect(page.locator('[data-cbct-frame]')).toHaveCount(24, { timeout: 20000 })
  await expect(
    page.getByRole('button', { name: 'Capture teaching state', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(page.locator('[data-cbct-frame]')).toHaveCount(1)
  await expect(page.locator('[data-cbct-frame]')).toHaveAttribute('data-cbct-frame', '-100')
  await page.getByRole('button', { name: 'Center the teaching target', exact: true }).click()
  await expect(page.locator('[data-cbct-frame]')).toHaveCount(24, { timeout: 20000 })
  await expect(page.locator('[data-readout=centered] dd')).toHaveText('yes')
  await expect(page.locator('[data-scout-state=ready]')).toHaveCount(2)
  for (const scout of await page.locator('[data-scout-state=ready] [data-target-overlay]').all())
    await expect(scout).toHaveAttribute('cx', '256')
  for (const key of ['target', 'clearance', 'state', 'protection'])
    await page.locator(`#peripheral-imaging-control-${key}`).check()
  await page.getByRole('button', { name: 'Capture teaching state', exact: true }).click()
  await expect(page.locator('[data-cbct-frame]')).toHaveCount(24, { timeout: 20000 })
  const capturedReadout = await page.locator('[data-readout=captured] dd').textContent()
  await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-anim', 'idle')
  await expect(page.locator('[data-ct-state=ready]')).toHaveCount(3)
  await expect(
    page.getByText('Original CT standing in for a reconstructed volume.', { exact: false }),
  ).toBeVisible()
  const contexts = await page
    .locator('canvas')
    .evaluateAll(
      (canvases) =>
        canvases.filter((c) => Boolean((c as HTMLCanvasElement).getContext('webgl2'))).length,
    )
  expect(contexts).toBe(2)
  await setRange(page, 'Authored orbit inspection angle', 30)
  await expect(page.locator('[data-readout=captured] dd')).toHaveText('no')
  await expect(page.locator('[data-cbct-frame]')).toHaveCount(24, { timeout: 20000 })
  await expect(page.locator('[data-readout=ready] dd')).toHaveText('no')
  const scene = page.locator('canvas[data-three-state=ready]')
  const mobile = await scene.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
  await page.getByRole('combobox', { name: 'Suite workflow' }).selectOption('fixed')
  await expect(page.locator('[data-gantry-variant]')).toHaveAttribute(
    'data-gantry-variant',
    'fixed',
  )
  await expect
    .poll(() => scene.evaluate((c) => (c as HTMLCanvasElement).toDataURL()))
    .not.toBe(mobile)
  expect(capturedReadout).toBe('yes')
})

test('CBCT pauses, steps one remaining projection, and clears the sequence on reset', async ({
  page,
}) => {
  await page.goto(`${preview}?section=mobile-suite`)
  await page.bringToFront()
  await expect(page.locator('[data-scout-state=ready]')).toHaveCount(2)
  await page.getByRole('button', { name: 'Run the orbit', exact: true }).click()
  await page.getByRole('button', { name: 'Pause orbit', exact: true }).click()
  await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-anim', 'idle')
  const paused = await page.locator('[data-cbct-frame]').count()
  expect(paused).toBeLessThan(24)
  await page.waitForTimeout(200)
  await expect(page.locator('[data-cbct-frame]')).toHaveCount(paused)
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(page.locator('[data-cbct-frame]')).toHaveCount(paused + 1)
  await page.getByRole('button', { name: 'Reset this model', exact: true }).click()
  await expect(page.locator('[data-cbct-frame]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Run the orbit', exact: true }).click()
  await page.getByRole('button', { name: 'Toggle control lock', exact: true }).click()
  await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-anim', 'idle')
  const locked = await page.locator('[data-cbct-frame]').count()
  await page.waitForTimeout(200)
  await expect(page.locator('[data-cbct-frame]')).toHaveCount(locked)
})

for (const section of ['cbct-acquisition', 'fixed-suite', 'mobile-suite'] as const) {
  test(`${section} frames its chain and runs a discrete orbit`, async ({ page }) => {
    await page.goto(`${preview}?section=${section}`)
    await page.bringToFront()
    await expect(page.locator('[data-suite-state=ready]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-scout-state=ready]')).toHaveCount(2)
    await expect(page.locator('[data-chain-map] [data-chain-pin]')).toHaveCount(6)
    await page.getByRole('button', { name: 'Run the orbit', exact: true }).click()
    await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-anim', 'running')
    await expect(page.locator('[data-cbct-frame]')).toHaveCount(24, { timeout: 20000 })
    await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-anim', 'idle')
    await expect(page.locator('[data-readout=captured] dd')).toHaveText('no')
    await expect(page.locator('[data-ct-state=ready]')).toHaveCount(3)
    // Camera fitting includes the whole swept arc, including at pane widths where labels compact.
    await page.getByRole('button', { name: 'Suite', exact: true }).click()
    const viewport = await page.locator('[role=img]').first().boundingBox()
    for (const pin of await page.locator('[data-chain-map] [data-chain-pin]').all()) {
      const box = await pin.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(viewport!.x - 1)
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.x + viewport!.width + 1)
    }
  })
}

test('DTS uses its atlas without a DRR, refocuses the plane, and steps a settled sweep', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${preview}?section=dts-acquisition`)
  await page.bringToFront()
  await expect(page.locator('[data-suite-state=ready]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-dts-state=ready]')).toBeVisible()
  await expect(page.locator('[data-dts-frame]')).toHaveCount(13)
  expect(await pixels(page.locator('canvas[data-three-state=ready]'))).toBeGreaterThan(60)
  const contexts = await page
    .locator('canvas')
    .evaluateAll(
      (canvases) =>
        canvases.filter((c) => Boolean((c as HTMLCanvasElement).getContext('webgl2'))).length,
    )
  expect(contexts).toBe(1)
  const monitor = page.locator('[data-dts-state=ready] canvas')
  const targetPlane = await monitor.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
  await page.getByRole('button', { name: 'Tool plane', exact: true }).click()
  await expect(page.locator('[data-readout=planeMm] dd')).toHaveText('-18 mm')
  await expect
    .poll(() => monitor.evaluate((c) => (c as HTMLCanvasElement).toDataURL()))
    .not.toBe(targetPlane)
  await page.getByRole('button', { name: 'Lesion plane', exact: true }).click()
  await expect
    .poll(() => monitor.evaluate((c) => (c as HTMLCanvasElement).toDataURL()))
    .toBe(targetPlane)
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(page.locator('[data-dts-frame]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(page.locator('[data-dts-frame]')).toHaveCount(2)
  await setRange(page, 'Authored angular sweep', 60)
  await expect(page.locator('[data-dts-frame]')).toHaveCount(13)
  await expect(page.locator('[data-readout=sweepDeg] dd')).toHaveText('60°')
  await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-anim', 'idle')
  await page.getByRole('button', { name: 'Toggle control lock', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tool plane', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Step', exact: true })).toBeDisabled()
})

test('DTS playback pauses and Step deterministically collects thirteen projections', async ({
  page,
}) => {
  await page.goto(`${preview}?section=dts-acquisition`)
  await page.bringToFront()
  await expect(page.locator('[data-dts-state=ready]')).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-anim', 'idle')
  for (let count = await page.locator('[data-dts-frame]').count(); count < 13; count++) {
    await page.getByRole('button', { name: 'Step', exact: true }).click()
    await expect(page.locator('[data-dts-frame]')).toHaveCount(count + 1)
  }
  await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-anim', 'idle')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-anim', 'running')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const count = await page.locator('[data-dts-frame]').count()
  await page.waitForTimeout(200)
  await expect(page.locator('[data-dts-frame]')).toHaveCount(count)
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(page.locator('[data-dts-frame]')).toHaveCount(count === 13 ? 1 : count + 1)
})

test('DTS prior colours provenance separately and keeps the measured image recoverable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${preview}?section=dts-interpretation`)
  await page.bringToFront()
  await expect(page.locator('[data-suite-state=ready]')).toBeVisible({ timeout: 15000 })
  const image = page.locator('[data-dts-state=ready] canvas')
  // The authored provenance section is a sorter with a hidden monitor and a console camera.
  await expect(page.locator('[data-dts-state]')).toHaveAttribute('data-dts-state', 'ready')
  await expect(page.locator('[data-suite-scene]')).toHaveAttribute('data-suite-camera', 'console')
  const scene = page.locator('canvas[data-three-state=ready]')
  const consoleImage = await scene.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
  const measured = await image.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
  await page.getByRole('button', { name: 'Planning CT prior', exact: true }).click()
  await expect(page.locator('[data-image-provenance]')).toHaveAttribute(
    'data-image-provenance',
    'prior',
  )
  const prior = await image.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
  expect(prior).not.toBe(measured)
  await expect
    .poll(() => scene.evaluate((c) => (c as HTMLCanvasElement).toDataURL()))
    .not.toBe(consoleImage)
  const colour = await image.evaluate((c) => {
    const context = (c as HTMLCanvasElement).getContext('2d')!
    const rgba = context.getImageData(80, 80, 80, 80).data
    let red = 0,
      green = 0
    for (let i = 0; i < rgba.length; i += 4) {
      red += rgba[i]
      green += rgba[i + 1]
    }
    return green - red
  })
  expect(colour).toBeGreaterThan(1000)
  await page.getByRole('button', { name: 'Blend with prior', exact: true }).click()
  await expect
    .poll(() => image.evaluate((c) => (c as HTMLCanvasElement).toDataURL()))
    .not.toBe(prior)
  await page.getByRole('button', { name: 'Measured projections', exact: true }).click()
  await expect
    .poll(() => image.evaluate((c) => (c as HTMLCanvasElement).toDataURL()))
    .toBe(measured)
  const contexts = await page
    .locator('canvas')
    .evaluateAll(
      (canvases) =>
        canvases.filter((c) => Boolean((c as HTMLCanvasElement).getContext('webgl2'))).length,
    )
  expect(contexts).toBe(1)
  await page.getByRole('button', { name: 'Toggle control lock', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Planning CT prior', exact: true })).toBeDisabled()
})

test('sampling links the side window, thin planes and slab without creating a DRR', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${preview}?section=tool-confirmation`)
  await page.bringToFront()
  await expect(page.locator('[data-suite-state=ready]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-ct-state=ready]')).toHaveCount(3)
  expect(await pixels(page.locator('canvas[data-three-state=ready]'))).toBeGreaterThan(60)
  const contexts = await page
    .locator('canvas')
    .evaluateAll(
      (canvases) =>
        canvases.filter((c) => Boolean((c as HTMLCanvasElement).getContext('webgl2'))).length,
    )
  expect(contexts).toBe(1)
  await setRange(page, 'Anterior / posterior offset', 0)
  await expect(page.locator('[data-readout=windowLabel] dd')).toHaveText(
    'Sampling window fully within the sphere',
  )
  await expect(page.locator('[data-readout=tipInside] dd')).toHaveText('no')
  const ct = page.locator('[data-ct-state=ready]').first()
  const thin = await ct.evaluate((c) => (c as HTMLCanvasElement).toDataURL())
  await page.getByRole('button', { name: 'Step', exact: true }).click()
  await expect(
    page.getByRole('slider', { name: 'Axial slice (superior / inferior)', exact: true }),
  ).toHaveValue('1')
  await expect.poll(() => ct.evaluate((c) => (c as HTMLCanvasElement).toDataURL())).not.toBe(thin)
  await page
    .getByRole('checkbox', { name: 'Combine depths into a teaching slab', exact: true })
    .check()
  await page.getByRole('button', { name: 'Slices through target center', exact: true }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Combine depths into a teaching slab', exact: true }),
  ).not.toBeChecked()
  await expect.poll(() => ct.evaluate((c) => (c as HTMLCanvasElement).toDataURL())).toBe(thin)
  await page.getByRole('checkbox', { name: 'Reveal geometric explanation', exact: true }).check()
  await expect(page.locator('[data-sampling-state]')).toHaveAttribute(
    'data-sampling-state',
    'revealed',
  )
  await setRange(page, 'Anterior / posterior offset', 12)
  await expect(page.locator('[data-sampling-state]')).toHaveAttribute(
    'data-sampling-state',
    'exploring',
  )
  await expect(page.locator('[data-readout=windowIntersects] dd')).toHaveText('no')
})

for (const section of [
  'mobile-suite',
  'dts-acquisition',
  'dts-interpretation',
  'tool-confirmation',
]) {
  test(`${section} has no automated accessibility violations`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`${preview}?section=${section}`)
    await page.bringToFront()
    await expect(page.locator('[data-suite-state=ready]')).toBeVisible({ timeout: 15000 })
    await page.addScriptTag({ path: suiteRequire.resolve('axe-core/axe.min.js') })
    const result = await page.evaluate(() =>
      (window as unknown as { axe: { run: (context: string) => Promise<AxeResults> } }).axe.run(
        '[data-suite-scene]',
      ),
    )
    expect(result.violations).toEqual([])
  })
}
