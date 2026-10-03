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
 * hub with its three cards; the explorer opens from its card and every major control is used;
 * each demonstration page shows its video, stills and statement, and its interactive viewer
 * loads every file it asks for; a model URL, a viewer URL and a video URL are requested from a
 * second, fresh context and must be refused, as must withheld and traversal names with a session;
 * signing in from a demonstration page returns to it; ending the preview removes access to the
 * pages, the models and the files; signing in again and reloading brings the explorer back. Then
 * the explorer is looked at 1440 × 900, 1024 × 768, 390 × 844 and at 200% zoom, the hub and the
 * demonstration pages at 1440 × 900 and 390 × 844, and the private buckets are asked directly,
 * without a key, for one object each. Exits non-zero on any failure.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { chromium, type BrowserContext, type Page } from 'playwright'

import { WOLF_PREVIEW_DEMOS } from '../../src/features/medical-thoracoscopy/wolf-preview/demos'
import { wolfPreviewAssets } from '../../src/features/medical-thoracoscopy/wolf-preview/server/assetManifest'
import { wolfPreviewDemoAssets } from '../../src/features/medical-thoracoscopy/wolf-preview/server/demoManifest'

const args = process.argv.slice(2)
const option = (name: string) => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}
const BASE = (option('--base') ?? 'http://localhost:3139').replace(/\/$/, '')
const SHOTS = option('--shots')
const SUPABASE = option('--supabase') ?? 'https://tqnhxlwvkkswuckszlee.supabase.co'
const PAGE = `${BASE}/en/medical-thoracoscopy/wolf-preview`
const EXPLORER = `${PAGE}/device-explorer`
const FILES = `${BASE}/api/medical-thoracoscopy/wolf-preview/files`
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
  const files: string[] = []
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
    if (response.url().includes('/api/medical-thoracoscopy/wolf-preview/files/')) {
      files.push(`${response.status()} ${response.url()}`)
    }
  })
  return { errors, models, files }
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

async function fileStatus(context: BrowserContext, url: string, range?: string) {
  const response = await context.request.get(url, {
    failOnStatusCode: false,
    headers: range ? { range } : {},
  })
  return {
    status: response.status(),
    type: response.headers()['content-type'] ?? '',
    contentRange: response.headers()['content-range'] ?? '',
    bytes: (await response.body()).length,
  }
}

async function imagesLoaded(page: Page, selector: string) {
  // A cold server reads each file from storage once, so give the images time to arrive.
  await page
    .waitForFunction(
      (query) =>
        Array.from(document.querySelectorAll(query)).every(
          (image) => (image as HTMLImageElement).complete,
        ),
      selector,
      { timeout: 30000 },
    )
    .catch(() => null)
  return page.$$eval(selector, (images) =>
    images.map(
      (image) =>
        (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
    ),
  )
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
    (await page
      .getByRole('heading', { name: 'Development Preview — Manufacturer Review' })
      .count()) === 1 && (await page.locator('canvas').count()) === 0,
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
    (await page.locator('main p[role="alert"]').textContent())?.trim() ===
      'Review code not recognized.' && (await page.locator('canvas').count()) === 0,
  )
  const cookiesBefore = await reviewer.cookies()
  check(
    'no session cookie after a wrong code',
    !cookiesBefore.some((cookie) => cookie.name.includes('mt-wolf-preview')),
  )
  await signIn(page, CODE)
  const cookies = await reviewer.cookies()
  const session = cookies.find((cookie) => cookie.name.includes('mt-wolf-preview'))
  const cards = page.getByRole('heading', { level: 2 }).getByRole('link')
  check(
    'correct code opens the hub with an HttpOnly session cookie',
    Boolean(session?.httpOnly) && page.url() === PAGE && (await cards.count()) === 3,
    session
      ? `${session.name}, secure=${session.secure}, sameSite=${session.sameSite}`
      : 'no cookie',
  )
  check(
    'the hub shows a card for each of the three, with its image',
    (await cards.allTextContents()).join('|') ===
      'Device Explorer|Pleural Model Progress|Portable Hybrid Thoracoscopy Trainer' &&
      (await imagesLoaded(page, 'main img')).every(Boolean),
  )
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'wolf-hub-1440.png'), fullPage: true })
  await Promise.all([
    page.waitForURL(EXPLORER),
    page.getByRole('link', { name: 'Device Explorer', exact: true }).click(),
  ])
  await explorerReady(page)
  check(
    'the explorer opens from its card',
    (await page.locator('canvas[data-explorer-canvas]').count()) === 1,
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

  // The hub link, then each demonstration page and its viewer.
  await Promise.all([
    page.waitForURL(PAGE),
    page.getByRole('link', { name: /All previews/ }).click(),
  ])
  check('All previews returns to the hub', page.url() === PAGE)
  const viewerUrls: string[] = []
  let videoUrl = ''
  for (const demo of Object.values(WOLF_PREVIEW_DEMOS)) {
    const demoPage = `${PAGE}/${demo.id}`
    await Promise.all([
      page.waitForURL(demoPage),
      page.getByRole('link', { name: demo.title, exact: true }).click(),
    ])
    check(
      `${demo.id}: page opens from its card`,
      (await page.getByRole('heading', { level: 1, name: demo.title }).count()) === 1,
    )
    if (demo.statement) {
      check(
        `${demo.id}: its own statement comes first`,
        (
          await page.getByRole('region', { name: 'Status of this concept' }).textContent()
        )?.includes(demo.statement.lead) === true,
      )
    }
    const video = `${FILES}/${demo.id}/${demo.video.file}`
    videoUrl ||= video
    const range = await fileStatus(reviewer, video, 'bytes=0-1023')
    check(
      `${demo.id}: the video is served in ranges`,
      range.status === 206 && range.type === 'video/mp4' && range.bytes === 1024,
      `${range.status} ${range.contentRange}`,
    )
    const metadata = await page.locator('video').evaluate(
      (element: HTMLVideoElement) =>
        new Promise<number>((resolve) => {
          if (element.readyState >= 1) return resolve(element.duration)
          element.addEventListener('loadedmetadata', () => resolve(element.duration), {
            once: true,
          })
          element.addEventListener('error', () => resolve(-1), { once: true })
          setTimeout(() => resolve(-2), 20000)
        }),
    )
    check(`${demo.id}: the video plays in the page`, metadata > 10, `duration ${metadata}`)
    await page.locator('ul li figure img').last().scrollIntoViewIfNeeded()
    const stills = await imagesLoaded(page, 'figure img')
    check(
      `${demo.id}: every still preview loads`,
      stills.length === demo.stills.length && stills.every(Boolean),
      `${stills.filter(Boolean).length} of ${demo.stills.length}`,
    )
    const full = await fileStatus(reviewer, `${FILES}/${demo.id}/${demo.stills[0].file}`)
    check(
      `${demo.id}: a full-resolution still is served`,
      full.status === 200 && /^image\//.test(full.type),
      `${full.status} ${full.type}`,
    )
    if (SHOTS)
      await page.screenshot({ path: path.join(SHOTS, `wolf-${demo.id}.png`), fullPage: true })

    const viewerSeen = watch(page)
    const viewer = `${FILES}/${demo.id}/${demo.viewer.file}`
    viewerUrls.push(viewer)
    await Promise.all([
      page.waitForURL(viewer),
      page.getByRole('link', { name: 'Open the interactive viewer' }).click(),
    ])
    const ready = await page
      .waitForFunction(
        () => (window as unknown as { __demoReady?: boolean }).__demoReady === true,
        null,
        {
          timeout: 120000,
        },
      )
      .then(() => true)
      .catch(() => false)
    await page.waitForTimeout(2500)
    if (demo.id === 'pleural-model-progress') {
      await page.locator('#free').click()
      await page.waitForTimeout(800)
      await page.getByLabel('Effusion').uncheck()
    } else {
      await page.getByLabel('Cutaway').check()
      await page.locator('#explode').fill('0.6')
    }
    await page.waitForTimeout(1200)
    const served = viewerSeen.files.filter((entry) => entry.includes(`/files/${demo.id}/`))
    check(
      `${demo.id}: the viewer loads every file it asks for and renders`,
      ready &&
        (await page.locator('canvas').count()) > 0 &&
        served.length >= 10 &&
        served.every((entry) => entry.startsWith('200 ')),
      `${served.length} files, ready=${ready}`,
    )
    check(
      `${demo.id}: no errors in the viewer`,
      viewerSeen.errors.length === 0,
      viewerSeen.errors.join(' | '),
    )
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `wolf-${demo.id}-viewer.png`) })
    await page.goBack({ waitUntil: 'domcontentloaded' })
    await Promise.all([
      page.waitForURL(PAGE),
      page.getByRole('link', { name: /All previews/ }).click(),
    ])
  }

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
  for (const url of [...viewerUrls, videoUrl]) {
    const refused = await fileStatus(stranger, url)
    check(
      `a copied file URL is refused without the cookie (${url.split('/files/')[1]})`,
      refused.status === 401,
      `status ${refused.status}`,
    )
  }
  const strangerViewer = await strangerPage.goto(viewerUrls[0])
  check(
    'opening a viewer as a page is refused without the cookie',
    strangerViewer?.status() === 401,
    `status ${strangerViewer?.status()}`,
  )
  for (const name of [
    'portable-trainer-concept/stills/07-scope-tracker-platform-comparison.png',
    'pleural-model-progress/README.md',
    'portable-trainer-concept/diagrams/architecture.html',
    'pleural-model-progress/..%2F..%2Fmodels%2Fprobe.glb',
    'hub/index.html',
  ]) {
    const withheld = await fileStatus(reviewer, `${FILES}/${name}`)
    check(
      `withheld or traversal name not served with a session (${name})`,
      withheld.status === 404,
      `status ${withheld.status}`,
    )
  }
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
    [
      'public storage URL of a demonstration file',
      `${SUPABASE}/storage/v1/object/public/${wolfPreviewDemoAssets.bucket}/${wolfPreviewDemoAssets.prefix}/${wolfPreviewDemoAssets.groups['pleural-model-progress']['index.html'].object}`,
    ],
  ]) {
    const result = await modelStatus(stranger, url)
    check(
      `no copy at the ${name}`,
      !result.glb && (result.status < 200 || result.status >= 300),
      `status ${result.status}`,
    )
  }
  // Signing in from a demonstration page returns to it.
  const returning = await strangerPage.goto(`${PAGE}/portable-trainer-concept`)
  check(
    'a demonstration page shows the code screen first',
    returning?.status() === 200 &&
      (await strangerPage.getByLabel('Review code', { exact: true }).count()) === 1,
  )
  await signIn(strangerPage, CODE)
  check(
    'signing in there returns to that page',
    strangerPage.url() === `${PAGE}/portable-trainer-concept` &&
      (await strangerPage.getByRole('link', { name: 'Open the interactive viewer' }).count()) === 1,
    strangerPage.url(),
  )
  await stranger.close()

  // 11–12: end the preview.
  await page.goto(EXPLORER, { waitUntil: 'domcontentloaded' })
  await explorerReady(page)
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
  const afterFile = await fileStatus(reviewer, viewerUrls[0])
  check(
    'files are refused after ending the preview',
    afterFile.status === 401,
    `status ${afterFile.status}`,
  )
  await page.reload()
  check('reloading still shows the code screen', (await page.locator('canvas').count()) === 0)

  // 13–14: sign in again and reload.
  await signIn(page, CODE)
  await page.goto(EXPLORER, { waitUntil: 'domcontentloaded' })
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
    await view.goto(EXPLORER, { waitUntil: 'domcontentloaded' })
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
  // Scale 2 at phone width: a 3x full-page capture of a long page exceeds Chromium's limit.
  for (const [label, width, height, scale] of [
    ['1440x900', 1440, 900, 1],
    ['390x844', 390, 844, 2],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: scale,
      storageState: storedCookies,
    })
    await context.route('**/api/analytics**', (route) => route.abort())
    const view = await context.newPage()
    for (const [name, url] of [
      ['hub', PAGE],
      ...Object.keys(WOLF_PREVIEW_DEMOS).map((id) => [id, `${PAGE}/${id}`]),
    ]) {
      await view.goto(url, { waitUntil: 'networkidle' })
      const overflow = await view.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      check(
        `layout ${label}: ${name} has no horizontal scroll`,
        overflow <= 1,
        `overflow ${overflow}px`,
      )
      if (SHOTS && label === '390x844')
        await view.screenshot({
          path: path.join(SHOTS, `wolf-${name}-${label}.png`),
          fullPage: true,
        })
    }
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
