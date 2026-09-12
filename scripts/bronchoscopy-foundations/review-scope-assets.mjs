/** Build a temporary static harness and test through the shipping browser decoder. */
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
import prettier from 'prettier'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cache = path.join(root, 'artifacts/scope-assets')
const out = path.join(
  root,
  'public/bronchoscopy-foundations/anatomy/adult-teaching-combined-left-basal-v1/review',
)
await mkdir(out, { recursive: true })
await build({
  entryPoints: [
    path.join(root, 'scripts/bronchoscopy-foundations/review-scope-assets.browser.mts'),
  ],
  bundle: true,
  format: 'esm',
  outfile: path.join(cache, 'review.js'),
  logLevel: 'silent',
})
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost').pathname
    if (url === '/') {
      res.setHeader('Content-Type', 'text/html')
      res.end(
        '<!doctype html><title>Scope asset review</title><script type="module" src="/build/review.js"></script>',
      )
      return
    }
    const base = url.startsWith('/build/') ? cache : path.join(root, 'public')
    const filename = path.resolve(base, url.startsWith('/build/') ? url.slice(7) : url.slice(1))
    if (!filename.startsWith(base + path.sep)) {
      res.writeHead(403)
      res.end()
      return
    }
    res.setHeader(
      'Content-Type',
      {
        '.js': 'text/javascript',
        '.wasm': 'application/wasm',
        '.json': 'application/json',
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
let browser
try {
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    viewport: { width: 800, height: 600 },
    deviceScaleFactor: 1,
  })
  const errors = []
  page.on('pageerror', (e) => {
    errors.push(e.message)
    console.error(e.message)
  })
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  await page.waitForFunction(() => Boolean(globalThis.scopeAssetReview), null, { timeout: 120000 })
  const report = await page.evaluate(() => globalThis.scopeAssetReview.report)
  const references = []
  for (const id of ['rul', 'rml', 'lul']) {
    references.push(
      await page.evaluate((id) => globalThis.scopeAssetReview.renderReference(id), id),
    )
    await page.locator('canvas').screenshot({ path: path.join(out, `${id}.png`) })
    await page.evaluate((id) => globalThis.scopeAssetReview.renderReference(id, true), id)
    await page.locator('canvas').screenshot({ path: path.join(cache, `${id}-source.png`) })
  }
  const sha = (buffer) => createHash('sha256').update(buffer).digest('hex')
  report.lumenSha256 = sha(await readFile(path.join(out, '../lumen.glb')))
  report.graphSha256 = sha(await readFile(path.join(out, '../graph.json')))
  report.sourceLumenSha256 = sha(
    await readFile(path.join(root, 'public/airway-anatomy/case-001/lumen-v2.glb')),
  )
  report.build = JSON.parse(await readFile(path.join(cache, 'lumen-build.json'), 'utf8'))
  report.references = references
  report.browser.errors = errors
  const options = await prettier.resolveConfig(path.join(root, 'package.json'))
  await writeFile(
    path.join(out, 'collision-review.json'),
    await prettier.format(JSON.stringify(report), { ...options, parser: 'json' }),
  )
  await page.waitForFunction(() => Boolean(globalThis.scopeDeviceReview), null, { timeout: 60000 })
  const deviceReview = await page.evaluate(() => globalThis.scopeDeviceReview.report)
  const deviceOutput = path.join(root, 'public/bronchoscopy-foundations/anatomy/review')
  await mkdir(deviceOutput, { recursive: true })
  for (const [state, weight] of [
    ['abducted', 0],
    ['narrowing', 0.5],
    ['adducted', 1],
  ]) {
    await page.evaluate((weight) => globalThis.scopeDeviceReview.renderLarynx(weight), weight)
    await page
      .locator('canvas')
      .screenshot({ path: path.join(deviceOutput, `larynx-${state}.png`) })
  }
  await page.evaluate(() => globalThis.scopeDeviceReview.renderLarynx(0, true))
  await page.locator('canvas').screenshot({ path: path.join(deviceOutput, 'larynx-framework.png') })
  deviceReview.accessories = await page.evaluate(() =>
    globalThis.scopeDeviceReview.renderAccessories(),
  )
  await page.locator('canvas').screenshot({ path: path.join(deviceOutput, 'accessories.png') })
  deviceReview.accessoriesSha256 = sha(
    await readFile(path.join(deviceOutput, '../devices/accessories.glb')),
  )
  deviceReview.larynxSha256 = sha(
    await readFile(path.join(deviceOutput, '../larynx/larynx-lumen.glb')),
  )
  deviceReview.larynxPathSha256 = sha(
    await readFile(path.join(deviceOutput, '../larynx/larynx.json')),
  )
  await writeFile(
    path.join(deviceOutput, 'device-review.json'),
    await prettier.format(JSON.stringify(deviceReview), { ...options, parser: 'json' }),
  )
  console.log(JSON.stringify(deviceReview, null, 2))
  console.log(
    JSON.stringify(
      { ...report, airwayClearances: undefined, references: undefined, build: undefined },
      null,
      2,
    ),
  )
  if (
    errors.length ||
    report.outsideSamples ||
    !report.actualSurfaceAdvanceWithdraw ||
    !report.largeStepWallStop
  )
    process.exitCode = 1
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
}
