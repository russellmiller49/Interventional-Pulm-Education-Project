import { chromium } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
const base = process.env.BRONCH_REVIEW_URL ?? 'http://localhost:3130',
  output = 'artifacts/bronchoscopy-embedded-review'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
if (process.env.BRONCH_REVIEW_AUTH_FILE) {
  const { token } = JSON.parse(await readFile(process.env.BRONCH_REVIEW_AUTH_FILE, 'utf8'))
  await context.addCookies([{ name: 'ip_local_dev_auth', value: token, url: base }])
}
const page = await context.newPage(),
  errors = [],
  expectedMissingAuthoringOverlays = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const url = m.location().url
  // Embedded builds deliberately omit the optional authoring candidate overlays.
  if (m.text().includes('404') && url.endsWith('/cases/default/book_candidates.json'))
    expectedMissingAuthoringOverlays.push(url)
  else errors.push(`${m.text()} ${url}`)
})
await page.route('**/api/analytics', (route) => route.fulfill({ status: 204 }))
try {
  await page.goto(`${base}/socal-ebus-course/app/?publicTraining=1#/simulator?publicTraining=1`)
  await page.getByLabel('Continuous EBUS ultrasound', { exact: true }).waitFor({ timeout: 60000 })
  await page.waitForFunction(
    () => document.querySelector('[data-acoustic-version="simplified-v2"] canvas')?.width === 384,
  )
  await page.getByRole('combobox').selectOption('station_4r_node_a::default')
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas[aria-label="Grayscale ultrasound image"]')
    if (!canvas) return false
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
    let bright = 0
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 40) bright++
    return bright > 1500
  })
  await page.getByLabel('Continuous EBUS ultrasound', { exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${output}/ebus.png` })
  console.log('Embedded EBUS acoustic volume and worker loaded')
  await page.goto(`${base}/bronch-navigation-trainer/app/`)
  await page.getByRole('button', { name: 'Surprise me', exact: true }).waitFor({ timeout: 60000 })
  await page.waitForFunction(
    () =>
      document.querySelector('.scope-render')?.dataset.scopePoseLps &&
      [...document.querySelectorAll('canvas.ct-canvas')].every((c) => c.dataset.slicePlaneLps),
  )
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.ct-source-level')].every((e) => e.textContent !== 'Preview'),
  )
  await page.screenshot({ path: `${output}/navigation.png` })
  console.log('Embedded trainer optical and signed CT workers loaded')
  await writeFile(
    `${output}/browser-review.json`,
    JSON.stringify(
      {
        embeddedEbus: true,
        embeddedEbusStation: '4r',
        populatedUltrasound: true,
        embeddedTrainer: true,
        expectedMissingAuthoringOverlays,
        errors,
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
}
if (errors.length) {
  console.error(errors)
  process.exitCode = 1
}
