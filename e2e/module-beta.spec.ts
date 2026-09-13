import { test, expect } from '@playwright/test'

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
  await expect(page.getByRole('link', { name: 'Test with feedback' })).toHaveCount(12)
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

test('feedback preserves the page, selection and highlighted screenshot across continue testing', async ({
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
      await route.fulfill({ status: 503, json: { error: 'Storage temporarily unavailable.' } })
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
  await expect(page.getByText('1 highlighted area', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: 'Continue feedback' }).click()
  await expect(canvas).toBeVisible()
  await expect(page.getByText('1 highlighted area', { exact: true })).toBeVisible()
  await page.screenshot({
    path: 'artifacts/module-beta-feedback.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByRole('alert')).toHaveText('Storage temporarily unavailable.')
  await expect(page.getByLabel('What should we know?')).toHaveValue('Increase contrast here.')
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByRole('status')).toContainText('Feedback saved')
  expect(submitted!.get('pagePath')).toBe('/en/devices?view=grid#label')
  expect(submitted!.get('selectedText')).toBe('This device label needs more contrast.')
  const attachment = submitted!.get('screenshot') as File
  expect(attachment.type).toBe('image/png')
  expect(attachment.size).toBeGreaterThan(100)
  await page.goto('/en/devices')
  await expect(page.getByRole('button', { name: /feedback/i })).toHaveCount(0)
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
    '/en/bronchoscopy-foundations',
    '/en/cardiohelp-ecmo',
    '/en/baxter-crrt',
    '/en/icu-hemodynamics',
    '/en/mechanical-ventilation',
    '/en/mechanical-circulatory-support',
    '/en/admin/therapeutic-bronchoscopy',
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

test('screen capture hides the form and stops the media stream after one screenshot', async ({
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
    const state = window as Window & { finishCapture?: () => void; captureStopped?: boolean }
    Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
      configurable: true,
      value: () =>
        new Promise<MediaStream>((resolve) => {
          state.finishCapture = () => {
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
            const stream = canvas.captureStream(30),
              track = stream.getVideoTracks()[0]
            const stop = track.stop.bind(track)
            track.stop = () => {
              clearInterval(interval)
              state.captureStopped = true
              stop()
            }
            resolve(stream)
          }
        }),
    })
  })
  await page.getByRole('button', { name: 'Give feedback' }).click()
  await page.getByRole('button', { name: 'Capture screen' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.evaluate(() => (window as Window & { finishCapture?: () => void }).finishCapture?.())
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Screenshot preview.', { exact: false })).toBeVisible()
  expect(
    await page.evaluate(() => (window as Window & { captureStopped?: boolean }).captureStopped),
  ).toBe(true)
})
