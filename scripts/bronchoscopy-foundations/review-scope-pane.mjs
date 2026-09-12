import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const output = path.join(root, 'artifacts/bronchoscopy-build')
await mkdir(output, { recursive: true })
await build({
  entryPoints: [path.join(root, 'scripts/bronchoscopy-foundations/scope-harness.tsx')],
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  outfile: path.join(output, 'harness.js'),
  loader: { '.module.css': 'local-css' },
  logLevel: 'silent',
  alias: {
    'next/dynamic': path.join(root, 'scripts/bronchoscopy-foundations/scope-harness-dynamic.tsx'),
  },
  define: { 'process.env.NODE_ENV': '"production"' },
})
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost').pathname
    if (url === '/') {
      res.setHeader('Content-Type', 'text/html')
      res.end(
        '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scope pane review</title><link rel="stylesheet" href="/build/harness.css"><style>body{margin:0;background:#07131c;color:#d8e7ec;font:14px system-ui}*{box-sizing:border-box}button,input,select{font:inherit}select{max-width:100%}</style><div id="root"></div><script type="module" src="/build/harness.js"></script>',
      )
      return
    }
    const base = url.startsWith('/build/') ? output : path.join(root, 'public')
    const filename = path.resolve(base, url.startsWith('/build/') ? url.slice(7) : url.slice(1))
    if (!filename.startsWith(base + path.sep)) throw Error('outside public')
    res.setHeader(
      'Content-Type',
      {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.wasm': 'application/wasm',
        '.glb': 'model/gltf-binary',
      }[path.extname(filename)] ?? 'application/octet-stream',
    )
    res.end(await readFile(filename))
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1100, height: 1100 },
  reducedMotion: 'reduce',
})
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') console.log(message.text().slice(0, 500))
})
const ready = async () => {
  await page.locator('[data-scope-state="ready"]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(250)
}
const state = () =>
  page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return window.scopeHarness.state
  })
const command = (cmd) =>
  page.evaluate(async (cmd) => {
    window.scopeHarness.command(cmd)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }, cmd)
const mode = async (name) => {
  await page.getByLabel('Scene mode').selectOption(name)
  await ready()
}
const screenshot = async (name) => {
  const bytes = await page
    .locator('[data-three-state]')
    .screenshot({ path: path.join(output, name + '.png') })
  const { data } = await sharp(bytes)
    .resize(64, 64)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const colors = new Set()
  for (let i = 0; i < data.length; i += 3)
    colors.add([data[i] >> 4, data[i + 1] >> 4, data[i + 2] >> 4].join(','))
  assert(colors.size > 12, name + ' has no rendered geometry')
  return { name, colors: colors.size, bytes: bytes.length }
}
const report = { modes: [], checks: [], errors }
try {
  await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' })
  await ready()
  for (const name of [
    'guided-walk',
    'free-drive',
    'controls-isolated',
    'tube',
    'accessory',
    'larynx-entry',
    'idle',
  ]) {
    await mode(name)
    assert.equal(await page.locator('canvas').count(), 1)
    report.modes.push(await screenshot(name))
  }
  await mode('guided-walk')
  await page.evaluate(() => window.scopeHarness.runTask('rul'))
  assert((await state()).events.includes('entered:RUL'))
  await screenshot('entered-rul')
  report.checks.push('guided branch entry reaches the actual RUL')
  await page.evaluate(() => window.scopeHarness.runTask('survey'))
  assert((await state()).events.includes('survey-complete'))
  assert.equal((await state()).location.label, 'RB6')
  await screenshot('survey-completed')
  report.checks.push('complete survey on the loaded lumen, declared inspections and return to RB6')
  await mode('free-drive')
  await page.evaluate(() =>
    window.scopeHarness.setView({ ...window.scopeHarness.view, script: 'red-out' }),
  )
  await command({ type: 'rotate', deg: 0 })
  assert.equal((await state()).signals.view, 'red-out')
  await screenshot('red-out')
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click()
  assert.equal((await state()).signals.view, 'clear')
  assert((await state()).events.includes('red-out-recovered'))
  await page.evaluate(() =>
    window.scopeHarness.setView({ ...window.scopeHarness.view, script: 'lens-contamination' }),
  )
  await command({ type: 'rotate', deg: 0 })
  assert.equal((await state()).signals.view, 'contaminated')
  await page.getByRole('button', { name: 'Clear the lens', exact: true }).click()
  assert.equal((await state()).signals.view, 'clear')
  report.checks.push('wall-contact red field recovery and contaminated lens clearing')
  await mode('tube')
  assert(
    (await page.locator('[data-readout="annularAreaFraction"]').innerText()).includes(
      (1 - (6 / 8) ** 2).toFixed(2),
    ),
  )
  assert(
    (await page.locator('[data-readout="annularAreaMm2"]').innerText()).includes(
      String(Math.round((Math.PI * (8 * 8 - 6 * 6)) / 4)),
    ),
  )
  report.checks.push('tube annular geometry agrees with the authored diameters')
  await mode('controls-isolated')
  const before = await page.locator('[data-three-state]').screenshot()
  await page.locator('[data-view-signal]').focus()
  await page.keyboard.press('d')
  assert.equal((await state()).inputs.rotationDeg, 5)
  assert((await state()).inputModes.includes('keyboard'))
  await command({ type: 'set-rotation', deg: 90 })
  await screenshot('bench-rotated')
  assert(!before.equals(await page.locator('[data-three-state]').screenshot()))
  report.checks.push('keyboard and bench rotation')
  await page.getByLabel('Controls enabled').uncheck()
  await page.locator('[data-view-signal]').focus()
  await page.keyboard.press('w')
  assert.equal((await state()).depthMm, 0)
  await page.getByLabel('Controls enabled').check()
  await page.getByRole('button', { name: 'Advance', exact: true }).click()
  assert((await state()).depthMm > 0)
  report.checks.push('locked controls and pointer insertion')
  await mode('larynx-entry')
  const time = (await state()).signals.clockSec
  await page.waitForTimeout(500)
  assert.equal((await state()).signals.clockSec, time)
  await page.getByRole('button', { name: 'Step one second' }).click()
  assert.equal((await state()).signals.clockSec, time + 1)
  await command({ type: 'advance', mm: 28 })
  await screenshot('larynx-at-folds')
  await command({ type: 'tick', seconds: 1.8 })
  assert.equal((await state()).inputs.cords, 'abducted')
  await command({ type: 'advance', mm: 18 })
  assert((await state()).events.includes('glottis-crossed-open'))
  await screenshot('larynx-tracheal-entry')
  report.checks.push('reduced motion, manual breath step and glottic entry')
  await mode('accessory')
  await page.evaluate(() =>
    window.scopeHarness.setView({
      ...window.scopeHarness.view,
      defaults: { accessory: 'needle-sheathed', accessoryPosition: 'at-tip' },
    }),
  )
  await page.waitForFunction(() => window.scopeHarness.state.inputs.accessory === 'needle-sheathed')
  await page.getByLabel('Accessory position').selectOption('extended')
  await page.getByLabel('Accessory', { exact: true }).selectOption('needle-exposed')
  await screenshot('needle-exposed')
  assert.equal((await state()).inputs.accessory, 'needle-exposed')
  report.checks.push('accessory node and position change')
  await mode('guided-walk')
  const depth = (await state()).depthMm
  await page
    .locator('canvas')
    .evaluate((canvas) =>
      canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext(),
    )
  await page.waitForTimeout(150)
  await ready()
  assert.equal((await state()).depthMm, depth)
  assert.equal(await page.locator('canvas').count(), 1)
  report.checks.push('WebGL context replacement preserves state')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('tab', { name: 'Airway map', exact: true }).click()
  const overlap = await page.locator('[data-airway-pin]').evaluateAll((pins) => {
    const boxes = pins.map((pin) => pin.getBoundingClientRect())
    return boxes.some((a, i) =>
      boxes
        .slice(i + 1)
        .some(
          (b) =>
            Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
            Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top),
        ),
    )
  })
  assert.equal(overlap, false, 'Map pins overlap')
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: path.join(output, 'phone-map.png') })
  await page.getByRole('tab', { name: 'Scope view', exact: true }).click()
  await ready()
  await screenshot('phone-scope-optical')
  await page.screenshot({ path: path.join(output, 'phone-scope.png') })
  report.checks.push('phone reflow, map switch and non-overlapping pins')
  await page.setViewportSize({ width: 1100, height: 1100 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await mode('larynx-entry')
  await page.evaluate(() =>
    window.scopeHarness.setView({
      ...window.scopeHarness.view,
      controls: window.scopeHarness.view.controls.filter((key) => key !== 'step'),
    }),
  )
  await ready()
  const ticking = (await state()).signals.clockSec
  await page.waitForTimeout(450)
  assert((await state()).signals.clockSec > ticking)
  await page.evaluate(() => (document.querySelector('main').style.marginTop = '2000px'))
  await page.waitForTimeout(200)
  const hidden = (await state()).signals.clockSec
  await page.waitForTimeout(350)
  assert.equal((await state()).signals.clockSec, hidden)
  await page.evaluate(() => (document.querySelector('main').style.marginTop = '20px'))
  await page.getByLabel('Controls enabled').uncheck()
  const locked = (await state()).signals.clockSec
  await page.waitForTimeout(350)
  assert.equal((await state()).signals.clockSec, locked)
  report.checks.push('normal breath animation pauses when offscreen or locked')
  const touch = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  await touch.goto(page.url(), { waitUntil: 'networkidle' })
  await touch.getByLabel('Scene mode').selectOption('controls-isolated')
  await touch.locator('[data-three-state="ready"]').waitFor()
  await touch.getByRole('button', { name: 'Advance', exact: true }).tap()
  assert((await touch.evaluate(() => window.scopeHarness.state)).inputModes.includes('touch'))
  await touch.close()
  report.checks.push('touch insertion is recorded as touch')
  const retry = await browser.newPage({
    viewport: { width: 1000, height: 900 },
    reducedMotion: 'reduce',
  })
  await retry.route('**/devices/bench.glb', (route) => route.abort())
  await retry.goto(page.url(), { waitUntil: 'networkidle' })
  await retry.getByLabel('Scene mode').selectOption('controls-isolated')
  await retry.locator('[data-scope-state="failed"]').waitFor()
  await retry.unroute('**/devices/bench.glb')
  await retry.getByRole('button', { name: 'Reload the 3D view', exact: true }).click()
  await retry.locator('[data-three-state="ready"]').waitFor()
  await retry.close()
  const unsupported = await browser.newPage({
    viewport: { width: 1000, height: 900 },
    reducedMotion: 'reduce',
  })
  await unsupported.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind.startsWith('webgl') || kind === 'experimental-webgl'
        ? null
        : original.call(this, kind, ...args)
    }
  })
  await unsupported.goto(page.url(), { waitUntil: 'networkidle' })
  await unsupported.locator('[data-scope-state="failed"]').waitFor()
  await unsupported.getByRole('button', { name: 'Use the schematic view', exact: true }).click()
  await unsupported.locator('[data-scope-state="fallback"]').waitFor()
  assert.equal(await unsupported.locator('canvas').count(), 0)
  await unsupported.getByRole('button', { name: 'Withdraw', exact: true }).click()
  assert(
    (await unsupported.evaluate(() => window.scopeHarness.state)).inputModes.includes('pointer'),
  )
  await unsupported.close()
  report.checks.push('missing asset retry and a usable schematic when WebGL is unavailable')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  await page.screenshot({ path: path.join(output, 'harness-error.png') })
  console.log((await page.locator('body').innerText()).slice(0, 1500))
  throw error
} finally {
  await writeFile(
    path.join(output, 'scope-pane-review.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
