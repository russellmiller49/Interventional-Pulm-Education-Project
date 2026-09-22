import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
const fixture = JSON.parse(readFileSync('/tmp/socrates-rehearsal.json', 'utf8'))
async function login(context: BrowserContext, name = 'one') {
  const session = fixture.sessions[name]
  await context.addCookies([
    {
      name: 'sb-127-auth-token',
      value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: false,
      sameSite: 'Lax',
    },
  ])
}
async function view(page: Page) {
  return JSON.parse((await page.getByTestId('study-viewer').getAttribute('data-viewport')) ?? '{}')
}
async function ready(page: Page) {
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60000 })
  await expect(
    page.locator('[data-testid="deep-zoom-viewer"]:not([data-status="ready"])'),
  ).toHaveCount(0, { timeout: 60000 })
  await expect(page.getByText('The remote slide descriptor could not be loaded.')).toHaveCount(0)
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            performance.getEntriesByType('resource').filter((entry) => {
              const resource = entry as PerformanceResourceTiming
              return (
                resource.name.includes('/api/socrates/images/') &&
                /\.jpe?g$/.test(resource.name) &&
                resource.responseStatus === 200
              )
            }).length,
        ),
      { timeout: 60000 },
    )
    .toBeGreaterThan(0)
  // Descriptor readiness is not tile paint readiness. Inspect rendered canvas
  // pixels so the responsive screenshots cannot pass with an empty black pane.
  for (const viewer of await page.getByTestId('deep-zoom-viewer').all()) {
    await expect
      .poll(
        async () => {
          const png = await viewer.locator('canvas').first().screenshot()
          return page.evaluate(
            (source) =>
              new Promise<number>((resolve) => {
                const image = new Image()
                image.onload = () => {
                  const canvas = document.createElement('canvas')
                  canvas.width = canvas.height = 64
                  const context = canvas.getContext('2d')!
                  context.drawImage(
                    image,
                    image.width * 0.1,
                    image.height * 0.25,
                    image.width * 0.65,
                    image.height * 0.7,
                    0,
                    0,
                    64,
                    64,
                  )
                  const pixels = context.getImageData(0, 0, 64, 64).data
                  let colored = 0
                  for (let i = 0; i < pixels.length; i += 4) {
                    const channels = [pixels[i], pixels[i + 1], pixels[i + 2]]
                    if (
                      Math.max(...channels) > 80 &&
                      Math.max(...channels) - Math.min(...channels) > 40
                    )
                      colored++
                  }
                  resolve(colored)
                }
                image.src = source
              }),
            'data:image/png;base64,' + png.toString('base64'),
          )
        },
        { timeout: 60000 },
      )
      .toBeGreaterThan(20)
  }
}
async function linkedPanes(page: Page) {
  const regions = await page.locator('.displayregion').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect(),
        parent = element.parentElement!.getBoundingClientRect()
      return [
        (rect.x - parent.x) / parent.width,
        (rect.y - parent.y) / parent.height,
        rect.width / parent.width,
        rect.height / parent.height,
      ]
    }),
  )
  expect(regions).toHaveLength(2)
  for (let i = 0; i < 4; i++) expect(Math.abs(regions[0][i] - regions[1][i])).toBeLessThan(0.025)
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)
}
function center(v: {
  visibleImageBounds: { x: number; y: number; width: number; height: number }
}) {
  const r = v.visibleImageBounds
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}
async function verifyFocus(before: Awaited<ReturnType<typeof view>>, page: Page) {
  const after = await view(page)
  expect(Math.abs(after.zoomRatio - before.zoomRatio)).toBeLessThan(0.02)
  expect(Math.abs(center(after).x - center(before).x)).toBeLessThan(5)
  expect(Math.abs(center(after).y - center(before).y)).toBeLessThan(5)
}

test('catalog → training reveal, progress, native fullscreen and viewport preservation', async ({
  page,
  context,
}) => {
  await login(context)
  await page.goto('/en/socrates')
  await expect(
    page.getByRole('heading', { name: 'Synthetic category A', exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Synthetic training case', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Synthetic training case', exact: true }),
  ).toBeVisible()
  await ready(page)
  await expect(
    page.getByText(/(?:Opened|Teaching revealed|Completed) · progress saved/),
  ).toBeVisible()
  const html = await page.content()
  expect(html).not.toMatch(
    /PRIVATE_HIGHLIGHT|PRIVATE_PROVENANCE|PRIVATE_READINESS|PRIVATE_SOURCE_MARKER|SYNTHETIC_ADEQUACY_KEY|SYNTHETIC_CANCER_KEY|SYNTHETIC_REGION_EXPLANATION/,
  )
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect.poll(async () => (await view(page)).zoomRatio).toBeCloseTo(1.35, 4)
  const before = await view(page)
  await page.getByRole('button', { name: 'Expand viewer', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true)
  await page.waitForTimeout(300)
  await verifyFocus(before, page)
  const canvas = page.getByRole('dialog').locator('canvas').first()
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 + 30, { steps: 6 })
  await page.mouse.up()
  await page.mouse.wheel(0, -150)
  // Let the deliberately animated user zoom settle before comparing resize state.
  await page.waitForTimeout(1800)
  const expanded = await view(page)
  await linkedPanes(page)
  await page.getByRole('button', { name: 'Close expanded viewer' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.waitForTimeout(400)
  await verifyFocus(expanded, page)
  await expect(page.getByRole('button', { name: 'Expand viewer' })).toBeFocused()
  await page
    .getByRole('button', { name: /Reveal teaching interpretation|Continue teaching review/ })
    .click()
  await expect(page.getByText('Synthetic low-magnification observation')).toBeVisible()
  await page.getByRole('button', { name: 'Continue to high magnification' }).click()
  await expect(page.getByText('Synthetic high-magnification observation')).toBeVisible()
  await page.getByRole('button', { name: 'Continue to interpretation' }).click()
  await expect(page.getByText('SYNTHETIC_ADEQUACY_REASON')).toBeVisible()
  await page.getByRole('button', { name: 'Review learning points' }).click()
  await expect(page.getByText('SYNTHETIC_LEARNING_POINT')).toBeVisible()
  await page.getByRole('button', { name: 'Mark case completed' }).click()
  await expect(page.getByText('Completed · progress saved')).toBeVisible()
  await expect(page.getByText('Synthetic visual swatch (nonclinical)')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Completed · progress saved')).toBeVisible()
  await ready(page)
  await noOverflow(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: 'test-results/socrates/training-1440.png', fullPage: true })
})

test('authorized testing persists once, captures time/confidence, keeps rounds separate, and isolates participants', async ({
  page,
  context,
  browser,
}) => {
  await login(context)
  await page.goto('/en/socrates/testing')
  await expect(page.getByRole('heading', { name: 'Round 1', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Round 2', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue Round 1' }).click()
  await expect(page.getByRole('heading', { name: 'Case 1', exact: true })).toBeVisible()
  await ready(page)
  const singleBefore = await view(page)
  await page.getByRole('button', { name: 'Expand viewer' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.waitForTimeout(300)
  await verifyFocus(singleBefore, page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Expand viewer' })).toBeFocused()
  const id = page.url().split('/').at(-1)!
  const response = await page.request.get(`/api/socrates/attempt/${id}`)
  expect(response.status()).toBe(200)
  const body = await response.text()
  expect(body).not.toMatch(
    /PRIVATE_|SYNTHETIC_ADEQUACY_KEY|SYNTHETIC_CANCER_KEY|SYNTHETIC_REGION_EXPLANATION|SYNTHETIC_DIAGNOSTIC_TITLE|SYNTHETIC_LEARNING_POINT|barcode|vignette/,
  )
  await page.getByLabel('Synthetic adequacy question (required)').selectOption('Synthetic option A')
  await page.getByLabel('Synthetic cancer question (required)').selectOption('Synthetic option B')
  await page
    .getByLabel('Synthetic confidence question (required)')
    .selectOption('Synthetic option A')
  await page.getByRole('button', { name: 'Submit interpretation' }).click()
  await expect(page.getByText(/Completed · saved. Interpretation time:/)).toBeVisible()
  const submitted = await (await page.request.get(`/api/socrates/attempt/${id}`)).json()
  expect(submitted.attempt.elapsed_ms).toBeGreaterThan(0)
  expect(submitted.attempt.confidence).toBe('Synthetic option A')
  expect(submitted.feedback).toBeNull()
  const retry = await page.request.post('/api/socrates/submit', {
    data: { attemptId: id, responses: {} },
  })
  expect(retry.status()).toBe(200)
  expect((await retry.json()).attempt).toEqual(submitted.attempt)
  await page.reload()
  await expect(page.getByText(/Completed · saved/)).toBeVisible()
  await expect(page.getByLabel('Synthetic adequacy question (required)')).toBeDisabled()
  const other = await browser.newContext()
  await login(other, 'two')
  const p2 = await other.newPage()
  await p2.goto('/en/socrates/testing')
  expect((await p2.request.get(`/api/socrates/attempt/${id}`)).status()).toBe(404)
  expect((await p2.request.get('/api/socrates/admin/dashboard')).status()).toBe(403)
  expect((await p2.request.get('/api/socrates/admin/export')).status()).toBe(403)
  await other.close()
  await page.goto('/en/socrates/testing')
  await expect(page.getByText('Round completed', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue Round 2' }).click()
  await expect(page.getByRole('heading', { name: 'Case 1', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Side by side' })).toBeVisible()
  await ready(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: 'test-results/socrates/testing-1440.png', fullPage: true })
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await ready(page)
    await noOverflow(page)
    const control = page.getByLabel('Synthetic confidence question (required)')
    await control.focus()
    await expect(control).toBeFocused()
    const box = (await control.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: `test-results/socrates/testing-${viewport.width}.png`,
      fullPage: true,
    })
  }
})

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
])
  test(`rejected fullscreen fallback, mode switches and keyboard at ${viewport.width}×${viewport.height}`, async ({
    page,
    context,
  }) => {
    await login(context)
    await page.setViewportSize(viewport)
    await page.addInitScript(() => {
      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true })
      HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error('Forced rejection'))
    })
    await page.goto(`/en/socrates/training/${fixture.cid}`)
    await ready(page)
    const before = await view(page)
    await page.getByRole('button', { name: 'Expand viewer' }).click()
    await expect(page.getByRole('dialog')).toHaveAttribute('data-fallback', 'true')
    await page.getByRole('button', { name: 'Tissue only' }).click()
    await page.getByRole('button', { name: 'Color annotated', exact: true }).click()
    await page.getByRole('button', { name: 'Side by side' }).click()
    await ready(page)
    await linkedPanes(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Expand viewer' })).toBeFocused()
    await ready(page)
    await noOverflow(page)
    await expect(page.getByRole('heading', { name: 'Case vignette' })).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: `test-results/socrates/training-${viewport.width}.png`,
      fullPage: true,
    })
    // 200% base text: controls remain reachable, including Escape from enlarged fallback.
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    await noOverflow(page)
    await page.getByRole('button', { name: 'Expand viewer' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Expand viewer' })).toBeFocused()
    expect(before.zoomRatio).toBeGreaterThan(0)
  })

test('admin monitoring/export and standalone builder case fields', async ({ page, context }) => {
  await login(context, 'admin')
  await page.goto('/en/admin/socrates')
  await expect(page.getByRole('heading', { name: 'SOCRATES study dashboard' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Interpretation data' })).toContainText(
    'Synthetic option A',
  )
  const csv = await page.request.get('/api/socrates/admin/export')
  expect(csv.status()).toBe(200)
  expect(await csv.text()).toContain('elapsed_ms')
  expect(await csv.text()).not.toMatch(/PRIVATE_|@synthetic/)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: 'test-results/socrates/admin-1440.png', fullPage: true })
  await page.goto('/en/socrates-builder')
  await expect(page.getByRole('heading', { name: 'SOCRATES slide builder' })).toBeVisible()
  await expect(page.getByLabel('Case vignette')).toBeVisible()
  await page.getByLabel('Case vignette').fill('Synthetic edited vignette')
  await page
    .getByLabel('Low-magnification observations (one per line)')
    .fill('Synthetic low one\nSynthetic low two')
  await page.getByLabel('Internal highlight notes').fill('PRIVATE_EDIT_MARKER')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByText(/Draft revision \d+ saved/)).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Case vignette')).toHaveValue('Synthetic edited vignette')
  await expect(page.getByLabel('Internal highlight notes')).toHaveValue('PRIVATE_EDIT_MARKER')
})
