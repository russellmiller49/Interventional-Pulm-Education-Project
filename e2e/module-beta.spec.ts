import { test, expect, chromium } from '@playwright/test'
import { betaModules } from '../src/features/module-beta/catalog'

const id = 'b8b3da51-5068-4c58-9ebd-3f846a27b337'
test('beta hub requires sign-in, is noindex, and feedback APIs reject preview cookies', async ({
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
    betaModules.length,
  )
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
  let failFirst = true
  await page.route('**/api/module-feedback', async (route) => {
    const req = route.request()
    submitted = await new Response(new Uint8Array(req.postDataBuffer() ?? []), {
      headers: { 'Content-Type': req.headers()['content-type'] },
    }).formData()
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
  await page.getByRole('button', { name: 'Give feedback' }).click()
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
  await expect(page.getByLabel('What should we know?')).toHaveValue('Increase contrast here.')
  expect(
    (await page.evaluate(() => indexedDB.databases())).some((db) =>
      db.name?.startsWith('module-owner-feedback'),
    ),
  ).toBe(false)
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByRole('status')).toContainText('Feedback saved')
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
  const kept = () =>
    page.evaluate(async () => ({
      databases: (await indexedDB.databases())
        .map((db) => db.name ?? '')
        .filter((name) => name.startsWith('module-owner-feedback')),
      storage: [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((key) =>
        /feedback|draft/i.test(key),
      ),
    }))
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
  await page.reload()
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
    '/en/bronchoscopy-foundations',
    '/en/cardiohelp-ecmo',
    '/en/baxter-crrt',
    '/en/icu-hemodynamics',
    '/en/mechanical-ventilation',
    '/en/mechanical-circulatory-support',
    '/en/learn/anatomy/airway',
    '/en/learn/anatomy/branch-tracing',
    '/en/intro-bronchoscopy/airway-anatomy',
  ]) {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    expect(response.headers()['x-robots-tag']).toContain('noindex')
    expect(response.headers()['x-frame-options']).toBe('SAMEORIGIN')
    expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'self'")
  }
  await page.goto('/en/intro-bronchoscopy/airway-anatomy')
  await expect(
    page.getByRole('heading', { name: 'Live Bronchoscopy Anatomy', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Give feedback' })).toHaveCount(0)
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
  await page.getByRole('button', { name: 'Give feedback' }).click()
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
    await page.getByRole('button', { name: 'Give feedback' }).click()
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
  await page.getByRole('button', { name: 'Give feedback' }).click()
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
