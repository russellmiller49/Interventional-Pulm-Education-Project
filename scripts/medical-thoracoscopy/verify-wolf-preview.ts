/**
 * Verify the private manufacturer preview in a real Chromium, end to end.
 *
 *   WOLF_PREVIEW_CODE_FILE=<file holding one review code> \
 *     npx tsx scripts/medical-thoracoscopy/verify-wolf-preview.ts --base https://<host> [--shots <dir>]
 *
 * The code is read from WOLF_PREVIEW_CODE_FILE (or WOLF_PREVIEW_CODE) and is never printed,
 * logged or captured: screenshots are taken only when the code field is empty or gone.
 *
 * Steps: a fresh context meets the code screen; a wrong code is refused; the right code opens the
 * explorer; every major control is used; a model URL the explorer loaded is requested from a
 * second, fresh context and must be refused; ending the preview removes access to the page and
 * the models; signing in again and reloading brings the explorer back. Then the explorer is looked
 * at 1440 × 900, 1024 × 768, 390 × 844 and at 200% zoom, and the private bucket is asked directly,
 * without a key, for one object. Exits non-zero on any failure.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { chromium, type BrowserContext, type Page } from 'playwright'

import { wolfPreviewAssets } from '../../src/features/medical-thoracoscopy/wolf-preview/server/assetManifest'

const args = process.argv.slice(2)
const option = (name: string) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}
const BASE = (option('--base') ?? 'http://localhost:3139').replace(/\/$/, '')
const SHOTS = option('--shots')
const SUPABASE = option('--supabase') ?? 'https://tqnhxlwvkkswuckszlee.supabase.co'
const PAGE = `${BASE}/en/medical-thoracoscopy/wolf-preview`
const CODE = (
  process.env.WOLF_PREVIEW_CODE_FILE
    ? readFileSync(process.env.WOLF_PREVIEW_CODE_FILE, 'utf8')
    : (process.env.WOLF_PREVIEW_CODE ?? '')
).trim()

const results: { step: string; ok: boolean; detail?: string }[] = []
function check(step: string, ok: boolean, detail?: string) {
  results.push({ step, ok, ...(detail ? { detail } : {}) })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? `  (${detail})` : ''}`)
}

async function fresh(
  browser: import('playwright').Browser,
  viewport = { width: 1440, height: 900 },
  scale = 1,
) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale })
  // tsx compiles with esbuild's keepNames, which wraps functions passed to the page in `__name`.
  await context.addInitScript({ content: 'window.__name = (target) => target' })
  return context
}

function watch(page: Page) {
  const errors: string[] = []
  const models: string[] = []
  page.on('pageerror', (error) => errors.push(`page: ${String(error).slice(0, 200)}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // The site's own analytics and sign-in chrome are not the preview's.
    if (/api\/analytics|supabase\.co\/auth|status of 401/.test(text)) return
    errors.push(`console: ${text.slice(0, 200)}`)
  })
  page.on('response', (response) => {
    if (response.url().includes('/api/medical-thoracoscopy/wolf-preview/models/')) {
      models.push(`${response.status()} ${response.url()}`)
    }
  })
  return { errors, models }
}

async function signIn(page: Page, code: string) {
  await page.getByLabel('Review code', { exact: true }).fill(code)
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.getByRole('button', { name: 'Open preview', exact: true }).click(),
  ])
}

async function explorerReady(page: Page) {
  await page.waitForSelector('canvas[data-explorer-canvas="ready"]', { timeout: 60000 })
  await page
    .waitForResponse((response) => response.url().endsWith('/models/operative-telescope.glb'), {
      timeout: 60000,
    })
    .catch(() => null)
  await page.waitForTimeout(1500)
}

async function modelStatus(context: BrowserContext, url: string) {
  const response = await context.request.get(url, { failOnStatusCode: false })
  const body = await response.body()
  return { status: response.status(), glb: body.subarray(0, 4).toString('latin1') === 'glTF' }
}

async function main() {
  if (CODE.length < 16) throw new Error('Set WOLF_PREVIEW_CODE_FILE (or WOLF_PREVIEW_CODE)')
  const browser = await chromium.launch({
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  })

  // 1–2: a fresh visitor meets only the code screen.
  const reviewer = await fresh(browser)
  await reviewer.route('**/api/analytics**', (route) => route.abort())
  const page = await reviewer.newPage()
  const seen = watch(page)
  const first = await page.goto(PAGE, { waitUntil: 'domcontentloaded' })
  check('page answers', first?.status() === 200, `status ${first?.status()}`)
  check(
    'page is noindex',
    /noindex/.test(first?.headers()['x-robots-tag'] ?? '') &&
      (await page.locator('meta[name="robots"]').getAttribute('content'))?.includes('noindex') ===
        true,
  )
  check(
    'fresh context sees the code screen only',
    (await page.getByRole('heading', { name: 'Device Explorer — Manufacturer Review' }).count()) ===
      1 && (await page.locator('canvas').count()) === 0,
  )
  const html = await page.content()
  check(
    'code screen carries no code or reviewer',
    !html.includes(CODE) && !/wolf-reviewer|claude-/.test(html),
  )
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'wolf-gate.png') })

  // 3–4: a wrong code, then the right one.
  await signIn(page, 'MTW-WRONG-WRONG-WRONG-WRONG-WRONG')
  check(
    'wrong code refused with one generic message',
    (await page.getByRole('alert').textContent())?.trim() === 'Review code not recognized.' &&
      (await page.locator('canvas').count()) === 0,
  )
  const cookiesBefore = await reviewer.cookies()
  check(
    'no session cookie after a wrong code',
    !cookiesBefore.some((cookie) => cookie.name.includes('mt-wolf-preview')),
  )
  await signIn(page, CODE)
  await explorerReady(page)
  const cookies = await reviewer.cookies()
  const session = cookies.find((cookie) => cookie.name.includes('mt-wolf-preview'))
  check(
    'correct code opens the explorer with an HttpOnly session cookie',
    Boolean(session?.httpOnly) &&
      (await page.locator('canvas[data-explorer-canvas]').count()) === 1,
    session
      ? `${session.name}, secure=${session.secure}, sameSite=${session.sameSite}`
      : 'no cookie',
  )
  check(
    'the page shows the private-preview notice',
    (await page
      .getByText('Development preview for manufacturer review.', { exact: false })
      .count()) > 0,
  )
  check('the URL carries no code', !page.url().includes(CODE))
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'wolf-explorer-1440.png') })

  // 5: the major controls.
  const viewport = page.locator('[role="img"]').first()
  const box = (await viewport.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.45, { steps: 20 })
  await page.mouse.up()
  await page.mouse.wheel(0, -300)
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Labels', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Labels', exact: true }).click()
  await page.getByRole('button', { name: 'Exploded view', exact: true }).click()
  await page.waitForTimeout(1300)
  await page.getByRole('button', { name: 'Assemble', exact: true }).click()
  await page.getByRole('button', { name: /^Play/ }).click()
  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByLabel('Assembly progress', { exact: true }).fill('16')
  await page.getByRole('button', { name: /^7 Forceps advances/ }).click()
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: /^9 Jaws open and close/ }).click()
  await page.waitForTimeout(1000)
  const jaws = page.getByRole('group', { name: 'Jaws' })
  await jaws.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Working channel exit', exact: true }).click()
  check('a hotspot shows its evidence', (await page.getByText('Sourced device fact').count()) > 0)
  await page.getByRole('button', { name: 'Next step', exact: true }).click()
  await page.getByRole('button', { name: 'Previous step', exact: true }).click()
  const devices = page.getByRole('navigation', { name: 'Devices' })
  for (const name of [
    /^Operative telescope/,
    /^Telescope cutaway/,
    /^Flexible trocar sleeve/,
    /^Trocar for the flexible sleeve/,
    /^Trocar sleeve with valves/,
    /^Double-spoon forceps/,
    /^Hook electrode/,
    /^Tower/,
  ]) {
    await devices.getByRole('button', { name }).click()
    await page.waitForTimeout(700)
  }
  await devices.getByRole('button', { name: /^Operative telescope/ }).click()
  await page.getByRole('checkbox', { name: 'Cutaway', exact: true }).click()
  await page.waitForTimeout(800)
  check(
    'cutaway shows its illustrative badge',
    (await page.getByText('Internal paths illustrative').count()) > 0,
  )
  await devices.getByRole('button', { name: /^Double-spoon forceps/ }).click()
  await page.waitForTimeout(800)
  await page
    .getByRole('group', { name: 'Jaws' })
    .getByRole('button', { name: 'Open', exact: true })
    .click()
  await page.waitForTimeout(800)
  if (SHOTS) await viewport.screenshot({ path: path.join(SHOTS, 'wolf-forceps-open.png') })
  await devices.getByRole('button', { name: /^Assembled system/ }).click()
  await page.waitForTimeout(1500)
  const loaded = seen.models.filter((entry) => entry.startsWith('200 '))
  check(
    'every model the explorer asked for was served',
    loaded.length >= 13 && seen.models.every((entry) => entry.startsWith('200 ')),
    `${loaded.length} served`,
  )
  check('no preview errors in the console', seen.errors.length === 0, seen.errors.join(' | '))

  // 8–10: a model URL copied into a fresh, unauthenticated context.
  const modelUrl = loaded[0].slice(4)
  const stranger = await fresh(browser)
  const copied = await modelStatus(stranger, modelUrl)
  check(
    'a copied model URL is refused without the cookie',
    copied.status === 401 && !copied.glb,
    `status ${copied.status}`,
  )
  const strangerPage = await stranger.newPage()
  const direct = await strangerPage.goto(modelUrl)
  check(
    'opening it as a page is refused too',
    direct?.status() === 401,
    `status ${direct?.status()}`,
  )
  const unknown = await modelStatus(
    reviewer,
    `${BASE}/api/medical-thoracoscopy/wolf-preview/models/frame-02.png`,
  )
  check(
    'a reference-image name is not served even with a session',
    unknown.status === 404,
    `status ${unknown.status}`,
  )
  const traversal = await modelStatus(
    reviewer,
    `${BASE}/api/medical-thoracoscopy/wolf-preview/models/..%2F..%2Fmanifest.json`,
  )
  check('a traversal attempt is not served', traversal.status === 404, `status ${traversal.status}`)
  const object = Object.values(wolfPreviewAssets.models)[0].object
  for (const [name, url] of [
    [
      'public storage URL',
      `${SUPABASE}/storage/v1/object/public/${wolfPreviewAssets.bucket}/${wolfPreviewAssets.prefix}/${object}`,
    ],
    [
      'public module-assets path',
      `${SUPABASE}/storage/v1/object/public/module-assets/v1/${wolfPreviewAssets.prefix}/${object}`,
    ],
    ['site module-assets path', `${BASE}/module-assets/v1/${wolfPreviewAssets.prefix}/${object}`],
    ['site models path', `${BASE}/models/${object}`],
  ]) {
    const result = await modelStatus(stranger, url)
    check(
      `no copy at the ${name}`,
      !result.glb && (result.status < 200 || result.status >= 300),
      `status ${result.status}`,
    )
  }
  await stranger.close()

  // 11–12: end the preview.
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.getByRole('button', { name: 'End preview', exact: true }).click(),
  ])
  check(
    'ending the preview returns to the code screen',
    (await page.getByLabel('Review code', { exact: true }).count()) === 1 &&
      (await page.locator('canvas').count()) === 0,
  )
  check(
    'the session cookie is gone',
    !(await reviewer.cookies()).some((cookie) => cookie.name.includes('mt-wolf-preview')),
  )
  const after = await modelStatus(reviewer, modelUrl)
  check(
    'models are refused after ending the preview',
    after.status === 401,
    `status ${after.status}`,
  )
  await page.reload()
  check('reloading still shows the code screen', (await page.locator('canvas').count()) === 0)

  // 13–14: sign in again and reload.
  await signIn(page, CODE)
  await explorerReady(page)
  await page.reload()
  await explorerReady(page)
  check(
    'signing in again and reloading keeps the explorer',
    (await page.locator('canvas[data-explorer-canvas]').count()) === 1,
  )
  const storedCookies = await reviewer.storageState()
  await reviewer.close()

  // Layouts.
  for (const [label, width, height, scale] of [
    ['1440x900', 1440, 900, 1],
    ['1024x768', 1024, 768, 1],
    ['390x844', 390, 844, 3],
    ['200pct-of-1440x900', 720, 450, 2],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: scale,
      storageState: storedCookies,
    })
    await context.route('**/api/analytics**', (route) => route.abort())
    const view = await context.newPage()
    const layoutErrors = watch(view)
    await view.goto(PAGE, { waitUntil: 'domcontentloaded' })
    await explorerReady(view)
    const overflow = await view.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    const controls = await view.getByRole('button', { name: /^Play|Pause/ }).count()
    check(
      `layout ${label}: explorer, controls, no horizontal scroll`,
      overflow <= 1 && controls === 1 && layoutErrors.errors.length === 0,
      `overflow ${overflow}px`,
    )
    if (SHOTS)
      await view.screenshot({ path: path.join(SHOTS, `wolf-${label}.png`), fullPage: true })
    await context.close()
  }

  await browser.close()
  const failed = results.filter((result) => !result.ok)
  console.log(`\n${results.length - failed.length} of ${results.length} checks passed`)
  if (failed.length > 0) process.exit(1)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
