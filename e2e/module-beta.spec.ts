import { test, expect, chromium } from '@playwright/test'
import { hubBetaModules } from '../src/features/module-beta/rollout'
import { betaModuleReviewPath } from '../src/features/module-beta/catalog'

const id = 'b8b3da51-5068-4c58-9ebd-3f846a27b337'
const guideSeenKey = 'module-beta:feedback-guide-seen:v1'
// The hub opens its feedback guide on a first visit; every test but the guide's own starts past it.
test.beforeEach(async ({ context }, testInfo) => {
  if (!testInfo.title.startsWith('feedback guide'))
    await context.addInitScript((key) => window.localStorage.setItem(key, '1'), guideSeenKey)
})
test('all preview modules remain under Still in development with sign-in, noindex and feedback API gates', async ({
  page,
  context,
  request,
}) => {
  const response = await request.get('/en/development-beta', { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  expect(response.headers().location).toContain('/en/login?next=')
  await context.addCookies([
    {
      name: 'ip_local_dev_auth',
      value: process.env.MODULE_BETA_TEST_TOKEN!,
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  const hub = await page.goto('/en/development-beta')
  expect(hub!.headers()['x-robots-tag']).toContain('noindex')
  await expect(page.getByRole('heading', { name: 'Help shape the next modules' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Test with feedback' })).toHaveCount(
    hubBetaModules.length,
  )
  await expect(page.getByRole('heading', { name: 'Ready for review', exact: true })).toHaveCount(0)
  const preview = page.getByRole('region', { name: 'Still in development', exact: true })
  await expect(preview).toBeVisible()
  await expect(preview.getByRole('article')).toHaveCount(hubBetaModules.length)
  // The hub opens modules only in their feedback wrapper; direct links are an admin tool.
  await expect(page.getByRole('link', { name: 'Standard module', exact: true })).toHaveCount(0)
  for (const group of ['Bronchoscopy', 'Critical care']) {
    await expect(preview.getByRole('heading', { name: group, exact: true })).toBeVisible()
  }
  // Withheld by the owner (2026-11-04); they open from Admin › Modules in development instead.
  for (const title of [
    'Live Bronchoscopy Anatomy',
    'Dolphin Bronchoscopy',
    'Device Atlas — Device Intelligence beta',
    'Literature Atlas',
  ])
    await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0)
  for (const entry of hubBetaModules) {
    const card = preview.getByRole('article').filter({
      has: page.getByRole('heading', { name: entry.title, exact: true }),
    })
    await expect(card).toHaveCount(1)
    await expect(
      card.getByRole('link', { name: 'Test with feedback', exact: true }),
    ).toHaveAttribute('href', `/en/development-beta/${entry.id}`)
  }
  await expect(page.getByRole('heading', { name: /Therapeutic Bronchoscopy/ })).toHaveCount(0)
  await page.screenshot({
    path: 'artifacts/module-beta-hub.png',
    fullPage: true,
    animations: 'disabled',
  })
  expect((await context.request.get('/api/module-feedback')).status()).toBe(401)
  expect(
    (
      await context.request.post('/api/module-feedback', {
        headers: { origin: 'http://127.0.0.1:3110' },
        multipart: { id, moduleId: 'devices', pagePath: '/en/devices', comment: 'Test' },
      })
    ).status(),
  ).toBe(401)
})

test('feedback preserves the page, selection and all annotation tools across continue testing', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'ip_local_dev_auth',
      value: process.env.MODULE_BETA_TEST_TOKEN!,
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  await page.route('**/en/devices', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body style="font:24px sans-serif;padding:40px"><h1>Device Atlas</h1><p id="label">This device label needs more contrast.</p></body></html>',
    }),
  )
  let submitted: FormData | undefined
  const attempts: FormData[] = []
  let failFirst = true
  await page.route('**/api/module-feedback', async (route) => {
    const req = route.request()
    submitted = await new Response(new Uint8Array(req.postDataBuffer() ?? []), {
      headers: { 'Content-Type': req.headers()['content-type'] },
    }).formData()
    attempts.push(submitted)
    if (failFirst) {
      failFirst = false
      await route.fulfill({
        status: 503,
        json: { error: 'Feedback storage is not available yet. Your draft has been kept open.' },
      })
      return
    }
    await route.fulfill({ status: 201, json: { id } })
  })
  await page.goto('/en/development-beta/devices')
  const moduleFrame = page.frameLocator('iframe')
  await expect(moduleFrame.getByRole('heading', { name: 'Device Atlas' })).toBeVisible()
  const source = await page.locator('iframe').screenshot()
  await moduleFrame.locator('#label').evaluate((element) => {
    const selection = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(element)
    selection.removeAllRanges()
    selection.addRange(range)
    history.pushState(null, '', '/en/devices?view=grid#label')
  })
  await page.getByRole('button', { name: 'Give feedback', exact: true }).click()
  await expect(page.getByLabel('Text or section')).toHaveValue(
    'This device label needs more contrast.',
  )
  await expect(page.getByText('Page: /en/devices?view=grid#label')).toBeVisible()
  await page.getByLabel('What should we know?').fill('Increase contrast here.')
  await page
    .getByLabel('Upload screenshot')
    .setInputFiles({ name: 'screen.png', mimeType: 'image/png', buffer: source })
  const canvas = page.getByLabel('Screenshot preview.', { exact: false })
  await expect(canvas).toBeVisible()
  await canvas.scrollIntoViewIfNeeded()
  const rect = (await canvas.boundingBox())!
  await page.mouse.move(rect.x + 10, rect.y + 10)
  await page.mouse.down()
  await page.mouse.move(rect.x + 180, rect.y + 65)
  await page.mouse.up()
  await expect(
    page.getByText('1 annotation · Included with your feedback', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Arrow', exact: true }).click()
  await canvas.scrollIntoViewIfNeeded()
  const arrowBox = (await canvas.boundingBox())!
  await page.mouse.move(arrowBox.x + 40, arrowBox.y + 100)
  await page.mouse.down()
  await page.mouse.move(arrowBox.x + 200, arrowBox.y + 100)
  await page.mouse.up()
  await page.getByRole('button', { name: 'Draw', exact: true }).click()
  await canvas.scrollIntoViewIfNeeded()
  const drawBox = (await canvas.boundingBox())!
  await page.mouse.move(drawBox.x + 80, drawBox.y + 140)
  await page.mouse.down()
  await page.mouse.move(drawBox.x + 160, drawBox.y + 160)
  await page.mouse.move(drawBox.x + 200, drawBox.y + 140)
  await page.mouse.up()
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await page.getByLabel('Text note', { exact: true }).fill('Needs more contrast')
  await page.getByRole('button', { name: 'Add note at top' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('4 annotations · Included with your feedback')).toBeVisible()
  const annotated = await canvas.evaluate(
    (element) => (element as HTMLCanvasElement).toDataURL('image/png').split(',')[1],
  )
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: 'Continue feedback' }).click()
  await expect(canvas).toBeVisible()
  await expect(
    page.getByText('4 annotations · Included with your feedback', { exact: true }),
  ).toBeVisible()
  expect(
    await canvas.evaluate(
      (element) => (element as HTMLCanvasElement).toDataURL('image/png').split(',')[1],
    ),
  ).toBe(annotated)
  await page.screenshot({
    path: 'artifacts/module-beta-feedback.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'Feedback storage is not available yet. Your draft has been kept open.',
  )
  await expect(page.getByRole('status')).not.toContainText('Feedback saved')
  await expect(page.getByLabel('What should we know?')).toHaveValue('Increase contrast here.')
  expect(
    (await page.evaluate(() => indexedDB.databases())).some((db) =>
      db.name?.startsWith('module-owner-feedback'),
    ),
  ).toBe(false)
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByRole('status')).toContainText('Feedback saved')
  expect(attempts).toHaveLength(2)
  expect(attempts[0].get('id')).toBe(attempts[1].get('id'))
  for (const attempt of attempts) {
    const image = attempt.get('screenshot') as File
    expect(Buffer.from(await image.arrayBuffer())).toEqual(Buffer.from(annotated, 'base64'))
  }
  expect(submitted!.get('pagePath')).toBe('/en/devices?view=grid#label')
  expect(submitted!.get('selectedText')).toBe('This device label needs more contrast.')
  const attachment = submitted!.get('screenshot') as File
  expect(attachment.type).toBe('image/png')
  expect(attachment.size).toBeGreaterThan(100)
  expect(Buffer.from(await attachment.arrayBuffer())).toEqual(Buffer.from(annotated, 'base64'))
  await page.goto('/en/devices')
  await expect(page.getByRole('button', { name: /feedback/i })).toHaveCount(0)
})

test('server-mode drafts stay in memory: an empty dialog is no draft and nothing is kept in the browser', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'ip_local_dev_auth',
      value: process.env.MODULE_BETA_TEST_TOKEN!,
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  await page.route('**/en/devices', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Device Atlas</h1><p>Row label</p>' }),
  )
  let posts = 0
  await page.route('**/api/module-feedback', (route) => {
    posts++
    return route.fulfill({ status: 201, json: { id } })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/en/development-beta/devices')
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Device Atlas' }),
  ).toBeVisible()
  await expect(page.getByText('Beta testing', { exact: true })).toBeVisible()
  await expect(page.getByText('Owner review', { exact: false })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Review feedback' })).toHaveCount(0)
  const button = page.getByRole('button', { name: /^(Give|Continue) feedback$/ })
  // Opening and closing an empty dialog leaves no draft.
  await button.click()
  await expect(page.getByText('kept on this browser', { exact: false })).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await expect(button).toHaveText('Give feedback')
  await button.click()
  await page.keyboard.press('Escape')
  await expect(button).toHaveText('Give feedback')
  // Real content is a draft for this page only, held in memory.
  await button.click()
  await page.getByLabel('What should we know?').fill('Server-mode draft')
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await expect(button).toHaveText('Continue feedback')
  await page.waitForTimeout(900)
  // The only thing a server-mode hub keeps is that this browser has seen the guide: no content.
  const kept = () =>
    page.evaluate(
      async (guideKey) => ({
        databases: (await indexedDB.databases())
          .map((db) => db.name ?? '')
          .filter((name) => name.startsWith('module-owner-feedback')),
        storage: [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter(
          (key) => /feedback|draft/i.test(key) && key !== guideKey,
        ),
      }),
      guideSeenKey,
    )
  expect(await kept()).toEqual({ databases: [], storage: [] })
  // The compact review shell applies here too: one row of controls, no hidden page scroll.
  expect(
    await page.evaluate(() => {
      const bar = document.querySelector('iframe')!.parentElement!.querySelector(':scope > header')!
      return Math.round(bar.getBoundingClientRect().height)
    }),
  ).toBeLessThanOrEqual(96)
  await page.mouse.move(195, 20)
  await page.mouse.wheel(0, 600)
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  // The browser asks before the reload; leaving anyway discards the draft.
  const prompts: string[] = []
  page.on('dialog', (dialog) => {
    prompts.push(dialog.type())
    void dialog.accept()
  })
  await page.reload()
  expect(prompts).toEqual(['beforeunload'])
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Device Atlas' }),
  ).toBeVisible()
  await expect(button).toHaveText('Give feedback')
  await button.click()
  await expect(page.getByLabel('What should we know?')).toHaveValue('')
  await page.getByRole('button', { name: 'Discard draft' }).click()
  expect(await kept()).toEqual({ databases: [], storage: [] })
  expect(posts).toBe(0)
})

test('leaving the testing page asks first only while a server-mode draft is unsent', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'ip_local_dev_auth',
      value: process.env.MODULE_BETA_TEST_TOKEN!,
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  await page.route('**/en/devices', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Device Atlas</h1><p>Row label</p>' }),
  )
  await page.route('**/api/module-feedback', (route) =>
    route.fulfill({ status: 201, json: { id } }),
  )
  const asked: string[] = []
  const answers: Array<'accept' | 'dismiss'> = []
  page.on('dialog', (dialog) => {
    asked.push(`${dialog.type()}: ${dialog.message()}`)
    void (answers.shift() === 'accept' ? dialog.accept() : dialog.dismiss())
  })
  const heading = page.frameLocator('iframe').getByRole('heading', { name: 'Device Atlas' })
  const button = page.getByRole('button', { name: /^(Give|Continue) feedback$/ })
  const allModules = page.getByRole('link', { name: 'All beta modules' })
  const leaveQuestion =
    'confirm: Your feedback has not been sent. Leave this module and discard it?'
  await page.goto('/en/development-beta/devices')
  await expect(heading).toBeVisible()
  // Nothing unsent: no prompt on reload or on All modules.
  await button.click()
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await page.reload()
  await expect(heading).toBeVisible()
  await allModules.click()
  await expect(page).toHaveURL(/\/en\/development-beta$/)
  expect(asked).toEqual([])
  await page.goBack()
  await expect(heading).toBeVisible()
  await button.click()
  await expect(
    page.getByText('Not sent yet. Reloading the page or leaving this module discards this report.'),
  ).toBeVisible()
  await page.getByLabel('What should we know?').fill('Do not lose this')
  await page.getByRole('button', { name: 'Continue testing' }).click()
  // Staying keeps the draft, whether the reload or the link asked.
  answers.push('dismiss')
  await page.reload({ timeout: 3000 }).catch(() => undefined)
  answers.push('dismiss')
  await allModules.click()
  expect(asked).toEqual(['beforeunload: ', leaveQuestion])
  await expect(page).toHaveURL(/\/en\/development-beta\/devices$/)
  await expect(button).toHaveText('Continue feedback')
  await button.click()
  await expect(page.getByLabel('What should we know?')).toHaveValue('Do not lose this')
  await page.getByRole('button', { name: 'Continue testing' }).click()
  // Leaving anyway goes, and the draft is gone.
  answers.push('accept')
  await allModules.click()
  await expect(page).toHaveURL(/\/en\/development-beta$/)
  expect(asked).toEqual(['beforeunload: ', leaveQuestion, leaveQuestion])
  await page.goBack()
  await expect(heading).toBeVisible()
  await expect(button).toHaveText('Give feedback')
  // Once a report is sent nothing is asked.
  await button.click()
  await page.getByLabel('What should we know?').fill('Sent')
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByRole('status')).toContainText('Feedback saved')
  await page.reload()
  await expect(heading).toBeVisible()
  expect(asked).toHaveLength(3)
})

test('admin workspace filters reports, displays screenshots and saves a review', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'ip_local_dev_auth',
      value: process.env.MODULE_BETA_TEST_TOKEN!,
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  const entry = {
    id,
    module_id: 'devices',
    page_path: '/en/devices',
    comment: 'Increase label contrast.',
    selected_text: 'Device label',
    tester_email: 'tester@example.org',
    created_at: '2026-09-12T20:00:00Z',
    screenshot_path: 'private.png',
    status: 'new',
    reviewer_notes: '',
  }
  await page.route('**/api/module-feedback?**', (route) =>
    route.fulfill({ json: { entries: [entry], count: 1 } }),
  )
  await page.route(`**/api/module-feedback/${id}`, async (route) => {
    const review = route.request().postDataJSON()
    entry.status = review.status
    entry.reviewer_notes = review.reviewerNotes
    await route.fulfill({ json: { id } })
  })
  await page.route(`**/api/module-feedback/${id}/image`, (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1sAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  )
  await page.goto('/en/admin/module-feedback')
  await expect(page.getByText('Increase label contrast.')).toBeVisible()
  await page.getByRole('button', { name: 'View annotated screenshot' }).click()
  await expect(page.getByRole('img', { name: /Screenshot attached/ })).toBeVisible()
  await page.getByLabel('Review status').selectOption('resolved')
  await page.getByLabel('Private review notes').fill('Contrast updated.')
  await page.getByRole('button', { name: 'Save review' }).click()
  await expect(page.getByLabel('Review status')).toHaveValue('resolved')
  await expect(page.getByLabel('Private review notes')).toHaveValue('Contrast updated.')
  await page.screenshot({
    path: 'artifacts/module-beta-workspace.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: 'Feedback workspace' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('real standard module pages permit same-origin beta framing and have no feedback controls', async ({
  page,
  request,
}) => {
  test.setTimeout(90000)
  for (const path of [
    '/en/devices',
    '/en/peripheral-imaging',
    '/en/ebus-guided',
    '/en/ebus-guided/learn?section=acoustic-contact',
    '/en/eus-b-simulator',
    '/en/bronchoscopy-foundations',
    '/en/dolphin-bronchoscopy',
    '/en/literature-atlas',
    '/en/cardiohelp-ecmo',
    '/en/baxter-crrt',
    '/en/icu-hemodynamics',
    '/en/mechanical-ventilation',
    '/en/mechanical-circulatory-support',
    '/en/learn/anatomy/airway',
    '/en/learn/anatomy/branch-tracing',
    '/en/development-beta/live-anatomy/lesson',
  ]) {
    const response = await request.get(path, {
      headers: { cookie: `ip_local_dev_auth=${process.env.MODULE_BETA_TEST_TOKEN}` },
    })
    expect(response.status()).toBe(200)
    expect(response.headers()['x-robots-tag']).toContain('noindex')
    expect(response.headers()['x-frame-options']).toBe('SAMEORIGIN')
    expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'self'")
  }
  await page.goto('/en/intro-bronchoscopy/airway-anatomy')
  await expect(
    page.getByRole('heading', { name: 'Live Bronchoscopy Anatomy', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Give feedback', exact: true })).toHaveCount(0)
})

test('tab capture hides the form, verifies this tab and stops sharing after one screenshot', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'ip_local_dev_auth',
      value: process.env.MODULE_BETA_TEST_TOKEN!,
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  await page.route('**/en/devices', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Device Atlas</h1>' }),
  )
  await page.goto('/en/development-beta/devices')
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Device Atlas' }),
  ).toBeVisible()
  await page.evaluate(() => {
    const state = window as Window & {
      finishCapture?: () => void
      captureStopped?: boolean
      captureOptions?: unknown
      captureConfig?: { handle?: string }
      captureSurface?: string
      wrongTab?: boolean
      cancelCapture?: boolean
    }
    Object.defineProperty(navigator.mediaDevices, 'setCaptureHandleConfig', {
      configurable: true,
      value: (config: { handle?: string }) => {
        state.captureConfig = config
      },
    })
    Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
      configurable: true,
      value: (options: unknown) => {
        state.captureOptions = options
        state.captureStopped = false
        return new Promise<MediaStream>((resolve, reject) => {
          state.finishCapture = () => {
            if (state.cancelCapture) {
              reject(new DOMException('Cancelled', 'NotAllowedError'))
              return
            }
            const canvas = document.createElement('canvas')
            canvas.width = 320
            canvas.height = 200
            const ctx = canvas.getContext('2d')!
            const interval = setInterval(() => {
              ctx.fillStyle = 'white'
              ctx.fillRect(0, 0, 320, 200)
              ctx.fillStyle = 'black'
              ctx.fillText('Module screenshot', 20, 40)
            }, 16)
            const stream = canvas.captureStream(30)
            const track = stream.getVideoTracks()[0] as MediaStreamTrack & {
              getCaptureHandle: () => { handle: string } | null
            }
            track.getSettings = () => ({ displaySurface: state.captureSurface ?? 'browser' })
            track.getCaptureHandle = () => ({
              handle: state.wrongTab ? 'another-tab' : state.captureConfig!.handle!,
            })
            const stop = track.stop.bind(track)
            track.stop = () => {
              clearInterval(interval)
              state.captureStopped = true
              stop()
            }
            resolve(stream)
          }
        })
      },
    })
  })
  await page.getByRole('button', { name: 'Give feedback', exact: true }).click()
  await page.getByRole('button', { name: 'Capture this tab' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.evaluate(() => (window as Window & { finishCapture?: () => void }).finishCapture?.())
  await expect(page.getByRole('dialog')).toBeVisible()
  const canvas = page.getByLabel('Screenshot preview.', { exact: false })
  await expect(canvas).toBeVisible()
  expect(
    await page.evaluate(() => (window as Window & { captureStopped?: boolean }).captureStopped),
  ).toBe(true)
  expect(
    await page.evaluate(() => (window as Window & { captureOptions?: unknown }).captureOptions),
  ).toMatchObject({
    video: { displaySurface: 'browser' },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    monitorTypeSurfaces: 'exclude',
    surfaceSwitching: 'exclude',
    systemAudio: 'exclude',
  })
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await page.getByLabel('Text note', { exact: true }).fill('Keep this annotation')
  await page.getByRole('button', { name: 'Add note at top' }).click()
  const original = await canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL())
  for (const mode of ['other-tab', 'window', 'monitor', 'cancel']) {
    await page.evaluate((mode) => {
      Object.assign(window, {
        wrongTab: mode === 'other-tab',
        captureSurface: ['window', 'monitor'].includes(mode) ? mode : 'browser',
        cancelCapture: mode === 'cancel',
      })
    }, mode)
    await page.getByRole('button', { name: 'Retake this tab' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await page.evaluate(() => (window as Window & { finishCapture?: () => void }).finishCapture?.())
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(
      mode === 'cancel' ? 'Capture cancelled' : 'Choose “This Tab”',
    )
    if (mode !== 'cancel')
      expect(
        await page.evaluate(() => (window as Window & { captureStopped?: boolean }).captureStopped),
      ).toBe(true)
    expect(await canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL())).toBe(
      original,
    )
    await expect(
      page.getByText('1 annotation · Included with your feedback', { exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(() => (window as Window & { captureConfig?: unknown }).captureConfig),
    ).toEqual({})
  }
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByText('0 annotations · Included with your feedback')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await page.getByRole('button', { name: 'Add note at top' }).click()
  await page.getByRole('button', { name: 'Clear marks' }).click()
  await expect(page.getByText('0 annotations · Included with your feedback')).toBeVisible()
  await page.getByRole('button', { name: 'Remove image' }).click()
  await expect(canvas).not.toBeVisible()
})

test('native Chromium capture includes the module without the feedback overlay', async ({}, testInfo) => {
  const browser = await chromium.launch({
    channel: 'chromium',
    args: ['--auto-accept-this-tab-capture'],
  })
  try {
    const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:3110',
      viewport: { width: 1440, height: 1000 },
    })
    await context.addCookies([
      {
        name: 'ip_local_dev_auth',
        value: process.env.MODULE_BETA_TEST_TOKEN!,
        domain: '127.0.0.1',
        path: '/',
      },
    ])
    const page = await context.newPage()
    await page.addInitScript(() => {
      if (!navigator.mediaDevices?.getDisplayMedia) return
      const nativeCapture = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices)
      navigator.mediaDevices.getDisplayMedia = async (options) => {
        const stream = await nativeCapture(options)
        Object.assign(window, { capturedStream: stream })
        return stream
      }
    })
    await page.route('**/en/devices', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<body style="background:rgb(0,120,140);color:white"><h1>Device Atlas capture target</h1></body>',
      }),
    )
    await page.goto('/en/development-beta/devices')
    await expect(
      page.frameLocator('iframe').getByRole('heading', { name: 'Device Atlas capture target' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Give feedback', exact: true }).click()
    await page.getByRole('button', { name: 'Capture this tab' }).click()
    const canvas = page.getByLabel('Screenshot preview.', { exact: false })
    await expect(canvas).toBeVisible()
    expect(
      await canvas.evaluate((element) => {
        const c = element as HTMLCanvasElement
        return Array.from(c.getContext('2d')!.getImageData(c.width / 2, c.height / 2, 1, 1).data)
      }),
    ).toEqual([0, 120, 140, 255])
    await canvas.screenshot({ path: testInfo.outputPath('native-tab-capture.png') })
    expect(
      await page.evaluate(() =>
        (window as Window & { capturedStream?: MediaStream }).capturedStream
          ?.getTracks()
          .map((track) => track.readyState),
      ),
    ).toEqual(['ended'])
  } finally {
    await browser.close()
  }
})

test('unsupported tab capture keeps upload and annotation tools available on mobile', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await context.addCookies([
    {
      name: 'ip_local_dev_auth',
      value: process.env.MODULE_BETA_TEST_TOKEN!,
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  await page.route('**/en/devices', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Device Atlas</h1>' }),
  )
  await page.goto('/en/development-beta/devices')
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'Device Atlas' }),
  ).toBeVisible()
  const source = await page.locator('iframe').screenshot()
  await page.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, 'setCaptureHandleConfig', {
      configurable: true,
      value: undefined,
    }),
  )
  await page.getByRole('button', { name: 'Give feedback', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Capture this tab' })).toHaveCount(0)
  await expect(
    page.getByText('Tab capture is unavailable in this browser.', { exact: false }),
  ).toBeVisible()
  await page
    .getByLabel('Upload screenshot')
    .setInputFiles({ name: 'mobile.png', mimeType: 'image/png', buffer: source })
  const canvas = page.getByLabel('Screenshot preview.', { exact: false })
  await expect(canvas).toBeVisible()
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await page.getByLabel('Text note', { exact: true }).fill('Mobile note')
  await page.getByRole('button', { name: 'Add note at top' }).click()
  await expect(
    page.getByText('1 annotation · Included with your feedback', { exact: true }),
  ).toBeVisible()
  expect(
    await page
      .getByRole('dialog')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true)
})

test('overall review: the form by track, the offer on leaving, the hub status and the admin tab', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'ip_local_dev_auth',
      value: process.env.MODULE_BETA_TEST_TOKEN!,
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  await page.setViewportSize({ width: 1600, height: 905 })
  const saved: Record<string, unknown>[] = []
  await page.route('**/en/ebus-guided', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>EBUS Guided</h1><p>Station 7</p>' }),
  )
  await page.route('**/api/module-feedback', (route) =>
    route.fulfill({ status: 201, json: { id } }),
  )
  await page.route('**/api/module-review/mine', (route) =>
    route.fulfill({
      json: {
        profile: { label: 'Interventional Pulmonologist · 10-20 years', defaultTrack: 'educator' },
        reviewsOpen: true,
        reviews: saved,
        reportCounts: {},
      },
    }),
  )
  await page.route('**/api/module-review', async (route) => {
    const body = route.request().postDataJSON()
    const review = {
      id: 'r1',
      module_id: body.moduleId,
      track: body.track,
      answers: body.answers,
      updated_at: '2026-11-09T18:00:00Z',
    }
    saved.splice(0, saved.length, review)
    await route.fulfill({ json: { review } })
  })
  const heading = page.frameLocator('iframe').getByRole('heading', { name: 'EBUS Guided' })
  const reviewButton = page.getByRole('button', { name: /^(Edit )?overall review$/i })
  const form = page.getByRole('dialog', { name: 'Overall review' })
  await page.goto('/en/development-beta/ebus-guided')
  await expect(heading).toBeVisible()

  // An attending starts on the educator form, which carries the module's own questions.
  await reviewButton.click()
  await expect(form.getByText('Interventional Pulmonologist · 10-20 years')).toBeVisible()
  await expect(
    form.getByRole('radio', { name: 'An educator or practicing clinician', exact: true }),
  ).toBeChecked()
  await expect(form.getByRole('heading', { name: 'This module’s own questions' })).toHaveCount(0)
  await expect(form.getByText('This module’s own questions')).toBeVisible()
  await form.getByText('This module’s own questions').scrollIntoViewIfNeeded()
  await page.screenshot({
    path: 'artifacts/module-beta-overall-review-educator.png',
    animations: 'disabled',
  })
  await form.getByText('A learner', { exact: true }).click()
  await expect(form.getByRole('heading', { name: 'As a learner' })).toBeVisible()
  await page.screenshot({
    path: 'artifacts/module-beta-overall-review-learner.png',
    animations: 'disabled',
  })
  await form.getByRole('button', { name: 'Close', exact: true }).click()

  // A detailed report first; leaving then offers the overall review.
  await page.getByRole('button', { name: 'Give feedback', exact: true }).click()
  await page.getByLabel('What should we know?').fill('Station 7 landmark label is off')
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByRole('status')).toContainText('Feedback saved')
  await page.getByRole('link', { name: 'All beta modules' }).click()
  const offer = page.getByRole('dialog', { name: 'Before you go' })
  await expect(offer).toBeVisible()
  await expect(page).toHaveURL(/\/en\/development-beta\/ebus-guided$/)
  await page.screenshot({
    path: 'artifacts/module-beta-overall-review-offer.png',
    animations: 'disabled',
  })
  await offer.getByRole('button', { name: 'Start overall review' }).click()

  // The learner answers kept from before, then the rest of the form.
  await expect(form.getByRole('radio', { name: 'A learner', exact: true })).toBeChecked()
  // Choices are pills a reviewer clicks; the rating grids are plain radios.
  const pill = (name: string) => form.getByText(name, { exact: true }).click()
  const rate = (name: string) => form.getByLabel(name, { exact: true }).check()
  await pill('Most of it')
  await pill('Do it with supervision')
  await rate('Overall quality: Very good')
  await rate('Clarity of the teaching: Very good')
  await rate('Ease of use: finding your way, the controls: Good')
  await rate('The interactive parts: simulator, cases, questions: Excellent')
  await pill('About right')
  await rate('Before the module: Slightly')
  await rate('Now: Confident')
  await form.locator('[data-review-question="wouldUse"]').getByText('Yes', { exact: true }).click()
  await pill('Ready after minor fixes')
  await form.getByLabel('The one thing to fix before release (optional)').fill('Station 4L view')
  await form.getByRole('button', { name: 'Send review' }).click()
  await expect(form.getByText(/your overall review is saved/i)).toBeVisible()
  expect(saved[0]).toMatchObject({ module_id: 'ebus-guided', track: 'learner' })
  await form.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(reviewButton).toHaveText('Edit overall review')

  // Edit and reload through the browser UI. Persistence here is a synthetic route adapter;
  // the API authorization suite and production metadata cover separate boundaries.
  await reviewButton.click()
  await expect(form.getByLabel('The one thing to fix before release (optional)')).toHaveValue(
    'Station 4L view',
  )
  await form
    .getByLabel('The one thing to fix before release (optional)')
    .fill('Updated synthetic finding')
  await form.getByRole('button', { name: 'Update review' }).click()
  await expect(form.getByText('Your overall review is updated.', { exact: true })).toBeVisible()
  expect(saved).toHaveLength(1)
  expect(saved[0]).toMatchObject({ id: 'r1', answers: { oneFix: 'Updated synthetic finding' } })
  await form.getByRole('button', { name: 'Close', exact: true }).click()
  await page.reload()
  await reviewButton.click()
  await expect(form.getByLabel('The one thing to fix before release (optional)')).toHaveValue(
    'Updated synthetic finding',
  )
  await form.getByRole('button', { name: 'Close', exact: true }).click()

  // Reviewed: leaving goes straight to the hub, which shows the review on the card.
  await page.getByRole('link', { name: 'All beta modules' }).click()
  await expect(page).toHaveURL(/\/en\/development-beta$/)
  const card = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'EBUS: Guided Course', exact: true }),
  })
  await expect(card.getByText(/Overall review: submitted/)).toBeVisible()
  await expect(card.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute(
    'href',
    '/en/development-beta/ebus-guided?review=1',
  )
  await expect(page.getByText('Overall review: not yet').first()).toBeVisible()
  await card.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: 'artifacts/module-beta-overall-review-hub.png',
    animations: 'disabled',
  })

  // The admin tab: summary, the review, and that reviewer's detailed reports.
  const feedbackUrls: string[] = []
  await page.route('**/api/module-feedback?**', (route) => {
    feedbackUrls.push(route.request().url())
    return route.fulfill({
      json: {
        entries: [
          {
            id,
            user_id: '6a1d1c5e-6c56-4a77-8a5b-111111111111',
            module_id: 'ebus-guided',
            page_path: '/en/ebus-guided',
            comment: 'Station 7 landmark label is off',
            selected_text: '',
            tester_email: 'fellow@example.org',
            created_at: '2026-11-09T17:00:00Z',
            screenshot_path: null,
            status: 'new',
            reviewer_notes: '',
          },
        ],
        count: 1,
        reviewers: { '6a1d1c5e-6c56-4a77-8a5b-111111111111': 'PCCM Fellow · Fellow Year 2' },
      },
    })
  })
  await page.route('**/api/module-review?**', (route) =>
    route.fulfill({
      json: {
        reviews: [
          {
            ...saved[0],
            user_id: '6a1d1c5e-6c56-4a77-8a5b-111111111111',
            tester_email: 'fellow@example.org',
            profile_snapshot: {
              professional_role: 'pccm_fellow',
              training_level: 'fellow_year_2',
            },
            form_version: 1,
            created_at: '2026-11-09T18:00:00Z',
          },
        ],
        reportCounts: { '6a1d1c5e-6c56-4a77-8a5b-111111111111:ebus-guided': 1 },
      },
    }),
  )
  await page.goto('/en/admin/module-feedback')
  await expect(page.getByText('PCCM Fellow · Fellow Year 2')).toBeVisible()
  await page.getByRole('tab', { name: 'Overall reviews' }).click()
  const row = page.getByRole('row', { name: /EBUS: Guided Course/ })
  await expect(row).toContainText('1 (1 / 0)')
  await expect(row).toContainText('2.0 → 4.0')
  await page.screenshot({
    path: 'artifacts/module-beta-overall-review-admin.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'Their 1 detailed report on this module' }).click()
  await expect(page.getByRole('tab', { name: 'Detailed reports' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByText('Showing reports from')).toContainText('PCCM Fellow · Fellow Year 2')
  await expect
    .poll(() => feedbackUrls.at(-1))
    .toContain('user=6a1d1c5e-6c56-4a77-8a5b-111111111111')
})

test('all 11 visible hub wrappers resolve their catalog module and frame route', async ({
  page,
  context,
}) => {
  test.setTimeout(90000)
  expect(hubBetaModules).toHaveLength(11)
  await context.addCookies([
    {
      name: 'ip_local_dev_auth',
      value: process.env.MODULE_BETA_TEST_TOKEN!,
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  // Keep this wrapper check small; the separate standard-route check loads the real pages.
  for (const entry of hubBetaModules) {
    const path = `/en${betaModuleReviewPath(entry)}`
    await page.route(`**${path}`, (route) =>
      route.fulfill({ contentType: 'text/html', body: `<h1>Synthetic ${entry.id}</h1>` }),
    )
    const response = await page.goto(`/en/development-beta/${entry.id}`)
    expect(response?.status()).toBe(200)
    await expect(page.locator('iframe')).toHaveAttribute('src', path)
    await expect(
      page.frameLocator('iframe').getByRole('heading', { name: `Synthetic ${entry.id}` }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Give feedback', exact: true })).toBeVisible()
    await page.unroute(`**${path}`)
  }
})

test('feedback guide: opens on the first hub visit only, reopens from the hub and the module bar', async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: 'ip_local_dev_auth',
      value: process.env.MODULE_BETA_TEST_TOKEN!,
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  await page.setViewportSize({ width: 1600, height: 905 })
  await page.route('**/en/ebus-guided', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>EBUS Guided</h1><p>Station 7</p>' }),
  )
  await page.route('**/api/module-review/mine', (route) =>
    route.fulfill({
      json: { profile: null, reviewsOpen: true, reviews: [], reportCounts: {} },
    }),
  )
  const guide = page.getByRole('dialog', { name: 'How to give feedback' })
  await page.goto('/en/development-beta')
  await expect(guide).toBeVisible()
  await expect(guide.getByRole('listitem')).toHaveCount(4)
  // The whole guide fits the reviewers' window without scrolling.
  expect(await guide.evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true)
  await page.screenshot({
    path: 'artifacts/module-beta-feedback-guide.png',
    animations: 'disabled',
  })
  await guide.getByRole('button', { name: 'Start testing' }).click()
  await expect(guide).toBeHidden()

  // Seen once on this browser: a reload leaves it closed, and the hub button brings it back.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Help shape the next modules' })).toBeVisible()
  await expect(page.getByText('Overall review: not yet').first()).toBeVisible()
  await expect(guide).toBeHidden()
  await page.getByRole('button', { name: 'How to give feedback' }).click()
  await expect(guide).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(guide).toBeHidden()

  // In a module the guide never opens by itself; the top bar's button opens it.
  await page.goto('/en/development-beta/ebus-guided')
  await expect(
    page.frameLocator('iframe').getByRole('heading', { name: 'EBUS Guided' }),
  ).toBeVisible()
  await expect(guide).toBeHidden()
  const barButton = page.getByRole('button', { name: 'How to give feedback' })
  await expect(barButton).toBeVisible()
  await page.screenshot({
    path: 'artifacts/module-beta-guide-bar-button.png',
    animations: 'disabled',
  })
  await barButton.click()
  await expect(guide).toBeVisible()
  await guide.getByRole('button', { name: 'Back to the module' }).click()
  await expect(guide).toBeHidden()

  // On a phone the steps stack and the guide scrolls inside its own window.
  await page.evaluate((key) => window.localStorage.removeItem(key), guideSeenKey)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/en/development-beta')
  await expect(guide).toBeVisible()
  await page.screenshot({
    path: 'artifacts/module-beta-feedback-guide-mobile.png',
    animations: 'disabled',
  })
})
