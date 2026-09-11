import { chromium } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'

const base = process.env.BRANCH_TRACING_BASE_URL ?? 'http://localhost:3110'
const output = process.argv[2] ?? '/tmp/branch-tracing-metrics.json'
const manifest = JSON.parse(await readFile('public/branch-tracing/native-v1/manifest.json', 'utf8'))
const trace = manifest.traces.find((t) => t.id === 'right-upper-distal')
const browser = await chromium.launch({ headless: true, args: ['--enable-precise-memory-info'] })
const errors = []
let page
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 40,
    downloadThroughput: 20_000_000 / 8,
    uploadThroughput: 5_000_000 / 8,
  })
  const start = Date.now()
  const route = `${base}/en/learn/anatomy/branch-tracing/learn?lesson=vertical`
  await page.goto(route, { timeout: 60000 })
  await page.getByRole('button', { name: 'Trace this airway' }).click()
  await page.getByText('Loading CT slice…', { exact: true }).waitFor({ state: 'hidden' })
  const readyMs = Date.now() - start
  const resources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((e) => ({ path: new URL(e.name).pathname, bytes: e.transferSize })),
  )
  const latencies = []
  for (let k = trace.range[0] + 1; k <= trace.range[0] + 10; k++) {
    const t = Date.now()
    await page.getByRole('slider', { name: 'CT slice', exact: true }).fill(String(k))
    await page.getByText('Loading CT slice…', { exact: true }).waitFor({ state: 'hidden' })
    latencies.push(Date.now() - t)
  }
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  await page.getByRole('button', { name: 'Expand CT', exact: true }).click()
  await page.getByRole('button', { name: 'Close expanded CT' }).waitFor()
  await page.screenshot({ path: '/tmp/branch-tracing-native-expanded.png' })
  await page.getByRole('button', { name: 'Close expanded CT' }).click()
  await page.setViewportSize({ width: 720, height: 450 })
  await page.getByRole('tab', { name: 'Steps', exact: true }).click()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  await page.screenshot({ path: '/tmp/branch-tracing-ct-reflow.png', fullPage: true })
  const result = {
    capturedAt: new Date().toISOString(),
    version: 'c2-ct1-r2',
    browser: browser.version(),
    base,
    environment: 'Local macOS, headless Chromium; standalone server when base is port 3112.',
    viewport: '1440x900',
    network: '20 Mbps down / 5 Mbps up / 40 ms emulated latency; fresh browser context',
    nativeCtReadyFromNavigationMs: readyMs,
    transferBytesAtCtReady: resources.reduce((n, r) => n + r.bytes, 0),
    nativeImageTransferBytes: resources
      .filter((r) => r.path.includes('/native-v1/axial/'))
      .reduce((n, r) => n + r.bytes, 0),
    nativeImageRequestsAtReady: resources.filter((r) => r.path.includes('/native-v1/axial/'))
      .length,
    optionalModelRequestsAtReady: resources.filter((r) => /\.glb$/.test(r.path)).length,
    sliceInputToLoadedImageMs: latencies,
    twoTimesEquivalentReflowDocumentOverflowPx: overflow,
    browserErrors: errors,
    limitations: [
      'Local emulated-network benchmark, not a clinical-device study.',
      'Latency includes Playwright input and wait overhead; no sub-100 ms claim.',
      '720x450 CSS viewport approximates 200% reflow; native browser zoom not exercised.',
      'No prolonged memory, native screen-reader or GPU frame-rate study.',
    ],
  }
  await writeFile(output, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result))
} catch (error) {
  await writeFile(
    output,
    JSON.stringify({ base, status: 'measurement failed', error: String(error), errors }) + '\n',
  )
  throw error
} finally {
  await browser.close()
}
