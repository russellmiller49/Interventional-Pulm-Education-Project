import { test, expect, chromium, type Page } from '@playwright/test'
import JSZip from 'jszip'
import { readFile } from 'node:fs/promises'

const piPath = '/en/peripheral-imaging/learn?section=imaging-questions&phase=recognize'
const ebusPath = '/en/ebus-guided/learn?section=acoustic-contact'
const comment = 'Owner finding: keep this exact wording.\nSecond line with `code`.'
async function openSection(page: Page, moduleId: string, path: string) {
  await page.goto(`/en/development-beta/${moduleId}`)
  await expect(page.getByText('Owner review · saved locally on this browser')).toBeVisible()
  const moduleFrame = page.frameLocator('iframe')
  await expect(moduleFrame.locator('h1').first()).toBeVisible()
  // Follow a real course link so Next's client router owns module navigation.
  await moduleFrame
    .locator(`a[href="${path.replace('&phase=recognize', '')}"]:visible`)
    .first()
    .click()
  await expect
    .poll(() =>
      page
        .locator('iframe')
        .evaluate(
          (element) =>
            (element as HTMLIFrameElement).contentWindow?.location.pathname +
            ((element as HTMLIFrameElement).contentWindow?.location.search ?? ''),
        ),
    )
    .toBe(path)
  const frame = (await (await page.locator('iframe').elementHandle())!.contentFrame())!
  await expect(frame.locator('h1').first()).toBeVisible()
  return frame
}
async function databaseReports(page: Page) {
  return page.evaluate(async () => {
    return new Promise<Array<{ id: string; status: string; screenshot: { blob: Blob } | null }>>(
      (resolve, reject) => {
        const open = indexedDB.open('module-owner-feedback', 1)
        open.onsuccess = () => {
          const db = open.result
          const request = db.transaction('reports').objectStore('reports').getAll()
          request.onsuccess = () => {
            db.close()
            resolve(request.result)
          }
          request.onerror = () => {
            db.close()
            reject(request.error)
          }
        }
        open.onerror = () => reject(open.error)
      },
    )
  })
}

test('owner saves a real PI finding, reviews after browser restart, and exports exact report plus screenshot', async ({}, testInfo) => {
  const profile = testInfo.outputPath('owner-profile')
  let context = await chromium.launchPersistentContext(profile, {
    baseURL: 'http://127.0.0.1:3110',
    viewport: { width: 1440, height: 1000 },
  })
  const requests: string[] = []
  const observe = () =>
    context.on('request', (request) => {
      if (
        request.url().includes('/api/module-feedback') ||
        (/\/api\/.*(progress|learner|attempt)/.test(request.url()) && request.method() !== 'GET')
      )
        requests.push(request.url())
    })
  observe()
  try {
    let page = context.pages()[0]
    const frame = await openSection(page, 'peripheral-imaging', piPath)
    const selected = await frame
      .locator('h1')
      .first()
      .evaluate((element) => {
        const selection = window.getSelection()!
        const range = document.createRange()
        range.selectNodeContents(element)
        selection.removeAllRanges()
        selection.addRange(range)
        return element.textContent!
      })
    const source = await page.locator('iframe').screenshot()
    const storageBefore = await page.evaluate(() => ({ ...localStorage }))
    await page.getByRole('button', { name: 'Give feedback' }).click()
    await expect(page.getByText(`Page: ${piPath}`, { exact: true })).toBeVisible()
    await expect(page.getByLabel('Text or section')).toHaveValue(selected)
    await page.getByLabel('What should we know?').fill(comment)
    await page
      .getByLabel('Upload screenshot')
      .setInputFiles({ name: 'pi.png', mimeType: 'image/png', buffer: source })
    const canvas = page.getByLabel('Screenshot preview.', { exact: false })
    await expect(canvas).toBeVisible()
    await canvas.scrollIntoViewIfNeeded()
    const box = (await canvas.boundingBox())!
    await page.mouse.move(box.x + 10, box.y + 10)
    await page.mouse.down()
    await page.mouse.move(box.x + 100, box.y + 70)
    await page.mouse.up()
    await expect(page.getByText('1 highlighted area', { exact: true })).toBeVisible()
    const annotated = await canvas.evaluate(
      (element) => (element as HTMLCanvasElement).toDataURL('image/png').split(',')[1],
    )
    await page.getByRole('button', { name: 'Save feedback locally' }).click()
    await expect(page.getByRole('status')).toContainText('Feedback saved locally. Reference')
    expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(storageBefore)
    await page.reload()
    await page.getByRole('link', { name: 'Review feedback', exact: true }).click()
    await expect(page.getByText(comment, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'View annotated screenshot' }).click()
    const image = page.getByRole('img', { name: /Screenshot attached by the owner/ })
    await expect(image).toBeVisible()
    await expect
      .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0)
    expect(await image.getAttribute('src')).toMatch(/^blob:/)
    await page.getByLabel('Review status').selectOption('in-review')
    await page.getByLabel('Private review notes').fill('Recheck this exact section after revision.')
    await page.getByRole('button', { name: 'Save review' }).click()
    await expect(page.locator('article span').filter({ hasText: /^In review$/ })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Review status')).toHaveValue('in-review')
    const [record] = await databaseReports(page)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({
      path: testInfo.outputPath('owner-workspace.png'),
      fullPage: true,
      animations: 'disabled',
    })
    await context.close()
    context = await chromium.launchPersistentContext(profile, {
      baseURL: 'http://127.0.0.1:3110',
      viewport: { width: 1440, height: 1000 },
    })
    observe()
    page = context.pages()[0]
    await page.goto('/en/admin/module-feedback')
    await expect(page.getByLabel('Review status')).toHaveValue('in-review')
    await expect(page.getByLabel('Private review notes')).toHaveValue(
      'Recheck this exact section after revision.',
    )
    await expect(page.getByRole('link', { name: `Open reported page: ${piPath}` })).toHaveAttribute(
      'href',
      piPath,
    )
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export feedback', exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^module-owner-feedback-\d{4}-\d{2}-\d{2}\.zip$/)
    const archive = await JSZip.loadAsync(await readFile((await download.path())!))
    const json = JSON.parse(await archive.file('feedback.json')!.async('string'))
    expect(json).toMatchObject({
      schemaVersion: 1,
      mode: 'owner-local',
      records: [
        {
          id: record.id,
          module_id: 'peripheral-imaging',
          page_path: piPath,
          comment,
          selected_text: selected,
          status: 'in-review',
          reviewer_notes: 'Recheck this exact section after revision.',
          screenshot_filename: `screenshots/${record.id}.png`,
        },
      ],
    })
    const markdown = await archive.file('feedback.md')!.async('string')
    for (const value of [
      comment,
      selected,
      piPath,
      record.id,
      'Recheck this exact section after revision.',
    ])
      expect(markdown).toContain(value)
    expect(await archive.file(`screenshots/${record.id}.png`)!.async('nodebuffer')).toEqual(
      Buffer.from(annotated, 'base64'),
    )
    expect(await databaseReports(page)).toHaveLength(1)
    expect(requests).toEqual([])
    await page.goto(piPath)
    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Give feedback' })).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test('narrow EBUS feedback preserves a failed draft, filters and clears only after confirmation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openSection(page, 'ebus-guided', ebusPath)
  const source = await page.locator('iframe').screenshot()
  await page.getByRole('button', { name: 'Give feedback' }).click()
  await expect(page.getByText(`Page: ${ebusPath}`, { exact: true })).toBeVisible()
  await page.getByLabel('What should we know?').fill('EBUS finding')
  await page.getByLabel('Text or section').fill('Acoustic contact')
  await page
    .getByLabel('Upload screenshot')
    .setInputFiles({ name: 'ebus.png', mimeType: 'image/png', buffer: source })
  const canvas = page.getByLabel('Screenshot preview.', { exact: false })
  await expect(canvas).toBeVisible()
  await canvas.scrollIntoViewIfNeeded()
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + 10, box.y + 10)
  await page.mouse.down()
  await page.mouse.move(box.x + 90, box.y + 60)
  await page.mouse.up()
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add
    IDBObjectStore.prototype.add = function (...args) {
      IDBObjectStore.prototype.add = add
      const result = add.apply(this, args)
      this.transaction.abort()
      return result
    }
  })
  await page.getByRole('button', { name: 'Save feedback locally' }).click()
  await expect(page.getByRole('alert')).toContainText('Keep your draft')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('What should we know?')).toHaveValue('EBUS finding')
  await expect(page.getByLabel('Text or section')).toHaveValue('Acoustic contact')
  await expect(page.getByText('1 highlighted area', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await page.getByRole('button', { name: 'Continue feedback' }).click()
  await expect(canvas).toBeVisible()
  await expect(page.getByText('1 highlighted area', { exact: true })).toBeVisible()
  expect(
    await page
      .getByRole('dialog')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true)
  await page.screenshot({
    path: 'artifacts/module-beta-owner-mobile.png',
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'Save feedback locally' }).click()
  await expect(page.getByRole('status')).toContainText('Feedback saved locally')
  expect(await databaseReports(page)).toHaveLength(1)
  await page.getByRole('button', { name: 'Give feedback' }).click()
  await page.getByLabel('What should we know?').fill('Discard me')
  await page.getByRole('button', { name: 'Discard draft' }).click()
  await page.getByRole('button', { name: 'Give feedback' }).click()
  await expect(page.getByLabel('What should we know?')).toHaveValue('')
  await page.getByRole('button', { name: 'Discard draft' }).click()
  await page.getByRole('link', { name: 'Review feedback', exact: true }).click()
  await expect(page.getByText('EBUS finding', { exact: true })).toBeVisible()
  await page.getByLabel('Module', { exact: true }).selectOption('peripheral-imaging')
  await expect(page.getByText('No feedback matches these filters.')).toBeVisible()
  await page.getByLabel('Module', { exact: true }).selectOption('ebus-guided')
  await page.getByLabel('Status', { exact: true }).selectOption('resolved')
  await expect(page.getByText('No feedback matches these filters.')).toBeVisible()
  await page.getByLabel('Status', { exact: true }).selectOption('new')
  await expect(page.getByText('EBUS finding', { exact: true })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export filtered feedback' }).click()
  const archive = await JSZip.loadAsync(await readFile((await (await downloadPromise).path())!))
  const json = JSON.parse(await archive.file('feedback.json')!.async('string'))
  expect(json.filters).toEqual({ moduleId: 'ebus-guided', status: 'new' })
  expect(json.records).toHaveLength(1)
  expect(json.records[0].page_path).toBe(ebusPath)
  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('ALL local reports and screenshots')
    return dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Clear local feedback' }).click()
  expect(await databaseReports(page)).toHaveLength(1)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Clear local feedback' }).click()
  await expect(page.getByText('No feedback matches these filters.')).toBeVisible()
  await page.reload()
  expect(await databaseReports(page)).toHaveLength(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('owner-local UI needs no account but never authorizes server feedback or other admin data', async ({
  request,
}) => {
  expect((await request.get('/en/development-beta')).status()).toBe(200)
  expect((await request.get('/en/admin/module-feedback')).status()).toBe(200)
  for (const path of [
    '/api/module-feedback',
    '/api/module-feedback/b8b3da51-5068-4c58-9ebd-3f846a27b337/image',
  ]) {
    expect((await request.get(path)).status()).toBe(503) // No configured auth; fail closed.
  }
  const response = await request.post('/api/module-feedback', {
    headers: { origin: 'http://127.0.0.1:3110' },
    multipart: { comment: 'Cannot bypass auth' },
  })
  expect(response.status()).toBe(503)
  const admin = await request.get('/en/admin/modules', { maxRedirects: 0 })
  expect(admin.status()).not.toBe(200)
})
