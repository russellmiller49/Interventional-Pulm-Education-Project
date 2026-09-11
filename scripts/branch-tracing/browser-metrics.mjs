import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

const base = process.env.BRANCH_TRACING_BASE_URL ?? 'http://localhost:3110'
const output = process.argv[2] ?? '/tmp/branch-tracing-metrics.json'
const browser = await chromium.launch({ headless: true, args: ['--enable-precise-memory-info'] })
const errors = []
let page
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('requestfailed', (request) =>
    errors.push(`${new URL(request.url()).pathname}: ${request.failure()?.errorText}`),
  )
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 40,
    downloadThroughput: 20_000_000 / 8,
    uploadThroughput: 5_000_000 / 8,
  })
  const start = Date.now()
  await page.goto(`${base}/en/learn/anatomy/branch-tracing/practice`, { timeout: 60000 })
  await page.getByRole('button', { name: 'Open CT and airway explorer' }).click()
  const canvas = page.locator('canvas[aria-label="Exterior airway surface with selected CT plane"]')
  await canvas.waitFor({ state: 'visible', timeout: 60000 })
  const readyMs = Date.now() - start
  const resources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((e) => ({
      path: new URL(e.name).pathname,
      bytes: e.transferSize,
      encodedBytes: e.encodedBodySize,
    })),
  )
  const latencies = []
  for (let n = 158; n < 168; n++) {
    const t = Date.now()
    await page.getByRole('slider', { name: 'Real CT slice' }).fill(String(n))
    await page
      .locator(`img[src$="/${String(n).padStart(3, '0')}.png"]`)
      .evaluate((img) => img.decode())
    latencies.push(Date.now() - t)
  }
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  const memory = []
  for (let n = 0; n < 3; n++) {
    await page.getByRole('button', { name: 'Close CT explorer' }).click()
    await cdp.send('HeapProfiler.collectGarbage')
    const usage = await cdp.send('Runtime.getHeapUsage')
    memory.push(usage.usedSize)
    await page.getByRole('button', { name: 'Open CT and airway explorer' }).click()
    await canvas.waitFor({ state: 'visible', timeout: 30000 })
  }
  await page.goto(`${base}/en/learn/anatomy/branch-tracing/learn?lesson=horizontal-vertical`)
  await page.locator('[data-now-card]').waitFor()
  // A 1440×900 display at 200% browser zoom has a 720×450 CSS layout viewport.
  // CSS `zoom` does not change media-query viewport units and is not browser zoom.
  await page.setViewportSize({ width: 720, height: 450 })
  await page.getByRole('tab', { name: 'Steps', exact: true }).click()
  const zoomOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  await page.screenshot({ path: '/tmp/branch-tracing-200-percent.png', fullPage: true })
  const result = {
    capturedAt: new Date().toISOString(),
    browser: browser.version(),
    base,
    environment:
      'Local macOS; headless Chromium; development server unless base URL explicitly points to production build.',
    viewport: '1440x900',
    network: '20 Mbps down / 5 Mbps up / 40 ms emulated latency, initial cold browser context',
    realExplorerReadyFromNavigationMs: readyMs,
    transferBytesAtExplorerReady: resources.reduce((n, r) => n + r.bytes, 0),
    imageAndModelTransferBytes: resources
      .filter((r) => r.path.startsWith('/branch-tracing/') || r.path.startsWith('/fluoroview/'))
      .reduce((n, r) => n + r.bytes, 0),
    sliceInputToDecodedImageMs: latencies,
    heapAfterCloseAndGcBytes: memory,
    twoTimesEquivalentReflowDocumentOverflowPx: zoomOverflow,
    limitations: [
      'Not a reference physical-device benchmark.',
      'On-demand rendering has no continuous guided animation; no GPU frame-rate claim.',
      'Three close/reopen cycles are a limited leak check, not proof of constant memory.',
      '720×450 CSS viewport tests reflow equivalent to 200% on 1440×900; native browser zoom UI was not exercised.',
    ],
  }
  await writeFile(output, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result))
} catch (error) {
  const failure = {
    capturedAt: new Date().toISOString(),
    base,
    status: 'measurement failed',
    error: String(error),
    browserErrors: errors,
    pageText: await page
      ?.locator('body')
      .innerText()
      .catch(() => ''),
  }
  await writeFile(output, JSON.stringify(failure, null, 2) + '\n')
  throw error
} finally {
  await browser.close()
}
