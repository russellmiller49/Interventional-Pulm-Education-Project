import { test, expect, chromium, type Page } from '@playwright/test'
import JSZip from 'jszip'
import { readFile } from 'node:fs/promises'
import { betaModules } from '../src/features/module-beta/catalog'

const piPath = '/en/peripheral-imaging/learn?section=imaging-questions&phase=recognize'
const ebusPath = '/en/ebus-guided/learn?section=acoustic-contact'
const comment = 'Owner finding: keep this exact wording.\nSecond line with `code`.'
// The first compile of a route can make the development server reload every open page, which
// sends the module frame back to its first page mid-test (seen as a second and third request for
// the testing page in the trace). Compile the routes these tests visit before any page is open.
test.beforeAll(async ({ request }) => {
  test.setTimeout(300000)
  for (const path of [
    '/en/development-beta',
    '/en/admin/module-feedback',
    '/en/development-beta/peripheral-imaging',
    '/en/development-beta/ebus-guided',
    '/en/peripheral-imaging',
    piPath,
    '/en/ebus-guided',
    ebusPath,
  ])
    expect((await request.get(path, { timeout: 120000 })).status(), path).toBe(200)
})
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
    .poll(
      () =>
        page
          .locator('iframe')
          .evaluate(
            (element) =>
              (element as HTMLIFrameElement).contentWindow?.location.pathname +
              ((element as HTMLIFrameElement).contentWindow?.location.search ?? ''),
          ),
      // The first real lesson visit compiles its route in the development server.
      { timeout: 30000 },
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
// Unsent drafts live in their own database; reading it must never create or upgrade the other.
async function databaseDrafts(page: Page) {
  return page.evaluate(async () => {
    type Draft = {
      id: string
      host_module_id: string
      module_id: string
      page_path: string
      comment: string
      selected_text: string
      annotations: Array<{ tool: string }>
      image: { token: string; size: number; width: number; height: number } | null
      record_kind: string
    }
    if (!(await indexedDB.databases()).some((db) => db.name === 'module-owner-feedback-drafts'))
      return { drafts: [] as Draft[], images: 0 }
    return new Promise<{ drafts: Draft[]; images: number }>((resolve, reject) => {
      const open = indexedDB.open('module-owner-feedback-drafts', 1)
      open.onsuccess = () => {
        const db = open.result
        const tx = db.transaction(['drafts', 'images'])
        const drafts = tx.objectStore('drafts').getAll()
        const images = tx.objectStore('images').count()
        tx.oncomplete = () => {
          db.close()
          resolve({ drafts: drafts.result, images: images.result })
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      }
      open.onerror = () => reject(open.error)
    })
  })
}
async function reportPng(page: Page, id: string) {
  return page.evaluate(async (id) => {
    const open = indexedDB.open('module-owner-feedback', 1)
    const db = await new Promise<IDBDatabase>((resolve) => {
      open.onsuccess = () => resolve(open.result)
    })
    const request = db.transaction('reports').objectStore('reports').get(id)
    const record = await new Promise<{
      page_path: string
      comment: string
      screenshot: { blob: Blob }
    }>((resolve) => {
      request.onsuccess = () => resolve(request.result)
    })
    db.close()
    let binary = ''
    for (const byte of new Uint8Array(await record.screenshot.blob.arrayBuffer()))
      binary += String.fromCharCode(byte)
    return { page_path: record.page_path, comment: record.comment, png: btoa(binary) }
  }, id)
}
const frameAddress = (page: Page) =>
  page
    .locator('iframe')
    .evaluate(
      (element) =>
        (element as HTMLIFrameElement).contentWindow!.location.pathname +
        (element as HTMLIFrameElement).contentWindow!.location.search,
    )
const feedbackButton = (page: Page) =>
  page.getByRole('button', { name: /^(Give|Continue) feedback$/ })
const previewData = (page: Page) =>
  page
    .getByLabel('Screenshot preview.', { exact: false })
    .evaluate((element) => (element as HTMLCanvasElement).toDataURL('image/png').split(',')[1])
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const canvas = page.getByLabel('Screenshot preview.', { exact: false })
  await canvas.scrollIntoViewIfNeeded()
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + from[0], box.y + from[1])
  await page.mouse.down()
  await page.mouse.move(box.x + (from[0] + to[0]) / 2, box.y + (from[1] + to[1]) / 2 + 12)
  await page.mouse.move(box.x + to[0], box.y + to[1])
  await page.mouse.up()
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
    await expect(
      page.getByText('1 annotation · Included with your feedback', { exact: true }),
    ).toBeVisible()
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
  await expect(
    page.getByText('1 annotation · Included with your feedback', { exact: true }),
  ).toBeVisible()
  // The failed save left nothing in the reports store and kept the draft recoverable.
  expect(await databaseReports(page)).toHaveLength(0)
  const failedDraftImage = await previewData(page)
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await expect.poll(async () => (await databaseDrafts(page)).drafts).toHaveLength(1)
  const [failedDraft] = (await databaseDrafts(page)).drafts
  expect(failedDraft).toMatchObject({ comment: 'EBUS finding', page_path: ebusPath })
  await page.reload()
  await page.getByRole('button', { name: 'Continue feedback' }).click()
  await expect(page.getByText(`Page: ${ebusPath}`, { exact: true })).toBeVisible()
  await expect(page.getByLabel('What should we know?')).toHaveValue('EBUS finding')
  await expect(page.getByLabel('Text or section')).toHaveValue('Acoustic contact')
  await expect(canvas).toBeVisible()
  await expect(
    page.getByText('1 annotation · Included with your feedback', { exact: true }),
  ).toBeVisible()
  expect(await previewData(page)).toBe(failedDraftImage)
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
  // The retry committed under the draft's own ID, and only then was the draft cleared.
  const savedAfterRetry = await databaseReports(page)
  expect(savedAfterRetry.map((report) => report.id)).toEqual([failedDraft.id])
  await expect.poll(async () => (await databaseDrafts(page)).drafts).toEqual([])
  expect((await databaseDrafts(page)).images).toBe(0)
  await page.getByRole('button', { name: 'Give feedback' }).click()
  await page.getByLabel('What should we know?').fill('Discard me')
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await expect.poll(async () => (await databaseDrafts(page)).drafts).toHaveLength(1)
  await page.reload()
  await page.getByRole('button', { name: 'Continue feedback' }).click()
  await expect(page.getByLabel('What should we know?')).toHaveValue('Discard me')
  await page.getByRole('button', { name: 'Discard draft' }).click()
  await expect(page.getByRole('button', { name: 'Give feedback' })).toBeEnabled()
  // Discarding removes that draft only: the saved report and its screenshot stay.
  await expect.poll(async () => (await databaseDrafts(page)).drafts).toEqual([])
  expect((await databaseReports(page)).map((report) => report.id)).toEqual([failedDraft.id])
  await page.reload()
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

test('an empty feedback dialog is not a pending draft; text, a selection or an image is', async ({
  page,
}) => {
  await openSection(page, 'peripheral-imaging', piPath)
  await expect(page.getByRole('button', { name: 'Give feedback' })).toBeEnabled()
  // Open and close without adding anything, by button and by Escape.
  await page.getByRole('button', { name: 'Give feedback' }).click()
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(feedbackButton(page)).toHaveText('Give feedback')
  await page.getByRole('button', { name: 'Give feedback' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(feedbackButton(page)).toHaveText('Give feedback')
  expect((await databaseDrafts(page)).drafts).toEqual([])
  await page.reload()
  await expect(page.getByRole('button', { name: 'Give feedback' })).toBeEnabled()
  // Adding and then removing every piece of content returns to no draft.
  await page.getByRole('button', { name: 'Give feedback' }).click()
  await page.getByLabel('What should we know?').fill('Temporary')
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await expect(feedbackButton(page)).toHaveText('Continue feedback')
  await expect.poll(async () => (await databaseDrafts(page)).drafts).toHaveLength(1)
  await page.getByRole('button', { name: 'Continue feedback' }).click()
  await page.getByLabel('What should we know?').fill('   ')
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await expect(feedbackButton(page)).toHaveText('Give feedback')
  await expect.poll(async () => (await databaseDrafts(page)).drafts).toEqual([])
  // Selected text alone is a draft, and it survives a reload with its page.
  const reloaded = (await (await page.locator('iframe').elementHandle())!.contentFrame())!
  const selected = await reloaded
    .locator('h1')
    .first()
    .evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      window.getSelection()!.removeAllRanges()
      window.getSelection()!.addRange(range)
      return element.textContent!
    })
  const selectionPage = await frameAddress(page)
  await page.getByRole('button', { name: 'Give feedback' }).click()
  await expect(page.getByLabel('Text or section')).toHaveValue(selected)
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await expect(feedbackButton(page)).toHaveText('Continue feedback')
  await expect.poll(async () => (await databaseDrafts(page)).drafts).toHaveLength(1)
  await page.reload()
  await page.getByRole('button', { name: 'Continue feedback' }).click()
  await expect(page.getByLabel('Text or section')).toHaveValue(selected)
  await expect(page.getByLabel('What should we know?')).toHaveValue('')
  await expect(page.getByText(`Page: ${selectionPage}`, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Discard draft' }).click()
  await expect.poll(async () => (await databaseDrafts(page)).drafts).toEqual([])
  // An image alone is a draft too.
  await page.getByRole('button', { name: 'Give feedback' }).click()
  await page.getByLabel('Upload screenshot').setInputFiles({
    name: 'only.png',
    mimeType: 'image/png',
    buffer: await page.locator('iframe').screenshot(),
  })
  await expect(page.getByLabel('Screenshot preview.', { exact: false })).toBeVisible()
  const imageOnly = await previewData(page)
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await expect(feedbackButton(page)).toHaveText('Continue feedback')
  await expect.poll(async () => (await databaseDrafts(page)).images).toBe(1)
  expect((await databaseDrafts(page)).drafts[0]).toMatchObject({ comment: '', selected_text: '' })
  await page.reload()
  await page.getByRole('button', { name: 'Continue feedback' }).click()
  await expect(page.getByText('0 annotations · Included with your feedback')).toBeVisible()
  expect(await previewData(page)).toBe(imageOnly)
  await page.getByRole('button', { name: 'Remove image' }).click()
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await expect(feedbackButton(page)).toHaveText('Give feedback')
  await expect.poll(async () => await databaseDrafts(page)).toEqual({ drafts: [], images: 0 })
})

test('an unsent draft keeps its text, annotated image and original page across reload and browser restart, and is never exported', async ({}, testInfo) => {
  test.setTimeout(240000)
  const profile = testInfo.outputPath('draft-profile')
  const launch = () =>
    chromium.launchPersistentContext(profile, {
      baseURL: 'http://127.0.0.1:3110',
      viewport: { width: 1440, height: 1000 },
    })
  let context = await launch()
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
  const draftComment = 'Unsent draft: keep this exact wording.\nSecond line.'
  try {
    let page = context.pages()[0]
    // A saved report exists first, so the draft work below can be shown to leave it untouched.
    const frame = await openSection(page, 'peripheral-imaging', piPath)
    await page.getByRole('button', { name: 'Give feedback' }).click()
    await page.getByLabel('What should we know?').fill('Earlier saved report')
    await page.getByLabel('Upload screenshot').setInputFiles({
      name: 'saved.png',
      mimeType: 'image/png',
      buffer: await page.locator('iframe').screenshot(),
    })
    await expect(page.getByLabel('Screenshot preview.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Save feedback locally' }).click()
    await expect(page.getByRole('status')).toContainText('Feedback saved locally')
    const [savedBefore] = await databaseReports(page)
    const savedPng = (await reportPng(page, savedBefore.id)).png

    // Build a draft with a selection, a comment and all four annotation tools.
    const selected = await frame
      .locator('h1')
      .first()
      .evaluate((element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        window.getSelection()!.removeAllRanges()
        window.getSelection()!.addRange(range)
        return element.textContent!
      })
    await page.getByRole('button', { name: 'Give feedback' }).click()
    await expect(page.getByText(`Page: ${piPath}`, { exact: true })).toBeVisible()
    await page.getByLabel('What should we know?').fill(draftComment)
    await page.getByLabel('Upload screenshot').setInputFiles({
      name: 'draft.png',
      mimeType: 'image/png',
      buffer: await page.locator('iframe').screenshot(),
    })
    await expect(page.getByLabel('Screenshot preview.', { exact: false })).toBeVisible()
    await drag(page, [10, 10], [180, 70])
    await page.getByRole('button', { name: 'Arrow', exact: true }).click()
    await drag(page, [40, 110], [220, 110])
    await page.getByRole('button', { name: 'Draw', exact: true }).click()
    await drag(page, [80, 150], [210, 150])
    await page.getByRole('button', { name: 'Text', exact: true }).click()
    await page.getByLabel('Text note', { exact: true }).fill('Needs more contrast')
    await page.getByRole('button', { name: 'Add note at top' }).click()
    await expect(page.getByText('4 annotations · Included with your feedback')).toBeVisible()
    const annotated = await previewData(page)
    await page.getByRole('button', { name: 'Continue testing' }).click()
    await expect(feedbackButton(page)).toHaveText('Continue feedback')
    await expect.poll(async () => (await databaseDrafts(page)).drafts).toHaveLength(1)
    const stored = await databaseDrafts(page)
    const draftId = stored.drafts[0].id
    expect(stored.images).toBe(1)
    expect(stored.drafts[0]).toMatchObject({
      host_module_id: 'peripheral-imaging',
      module_id: 'peripheral-imaging',
      page_path: piPath,
      comment: draftComment,
      selected_text: selected,
      record_kind: 'draft',
    })
    expect(stored.drafts[0].annotations.map((mark) => mark.tool)).toEqual([
      'box',
      'arrow',
      'draw',
      'text',
    ])
    // A draft is not a report: the reports store still holds only the earlier one.
    expect((await databaseReports(page)).map((report) => report.id)).toEqual([savedBefore.id])
    expect(draftId).not.toBe(savedBefore.id)

    // Move the module somewhere else, then reload: the draft must keep its original page.
    // Follow a real module link, as openSection does, so Next's client router owns the move.
    // (A hard navigation to a route the development server has not compiled yet can make it
    // reload the whole testing page, which is the next step's job, not this one's.)
    await frame.locator('a[href="/en/peripheral-imaging"]:visible').first().click()
    await expect.poll(() => frameAddress(page)).toBe('/en/peripheral-imaging')
    // Opening feedback elsewhere must reopen the draft, not capture this later page.
    await page.getByRole('button', { name: 'Continue feedback' }).click()
    await expect(page.getByText(`Page: ${piPath}`, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Continue testing' }).click()
    await page.reload()
    await expect(feedbackButton(page)).toHaveText('Continue feedback')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText(/Feedback saved/)).toHaveCount(0)
    await page.getByRole('button', { name: 'Continue feedback' }).click()
    await expect(page.getByText(`Page: ${piPath}`, { exact: true })).toBeVisible()
    await expect(page.getByLabel('What should we know?')).toHaveValue(draftComment)
    await expect(page.getByLabel('Text or section')).toHaveValue(selected)
    await expect(page.getByText('4 annotations · Included with your feedback')).toBeVisible()
    expect(await previewData(page)).toBe(annotated)
    // The marks are still editable, not baked into the image.
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(page.getByText('3 annotations · Included with your feedback')).toBeVisible()
    const edited = await previewData(page)
    expect(edited).not.toBe(annotated)
    await page.getByRole('button', { name: 'Continue testing' }).click()
    await expect
      .poll(async () => (await databaseDrafts(page)).drafts[0]?.annotations.length)
      .toBe(3)
    expect((await databaseDrafts(page)).drafts[0].id).toBe(draftId)

    // Restart the browser with the same profile.
    await context.close()
    context = await launch()
    observe()
    page = context.pages()[0]
    // The unsent draft is not a saved report and is not exported.
    await page.goto('/en/admin/module-feedback')
    await expect(page.getByText('Earlier saved report', { exact: true })).toBeVisible()
    await expect(page.getByText('1 report', { exact: false })).toBeVisible()
    await expect(page.getByText(draftComment, { exact: true })).toHaveCount(0)
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export feedback', exact: true }).click()
    const archive = await JSZip.loadAsync(await readFile((await (await downloadPromise).path())!))
    const exportedJson = await archive.file('feedback.json')!.async('string')
    const exportedMarkdown = await archive.file('feedback.md')!.async('string')
    expect(JSON.parse(exportedJson).records.map((record: { id: string }) => record.id)).toEqual([
      savedBefore.id,
    ])
    for (const text of [exportedJson, exportedMarkdown]) {
      expect(text).not.toContain('Unsent draft')
      expect(text).not.toContain(draftId)
    }
    expect(Object.keys(archive.files).filter((name) => name.endsWith('.png'))).toEqual([
      `screenshots/${savedBefore.id}.png`,
    ])
    // The existing report's screenshot bytes are exactly what was saved before any draft work.
    expect(await archive.file(`screenshots/${savedBefore.id}.png`)!.async('base64')).toBe(savedPng)

    // The hub points back to the testing page that holds the unsent draft.
    await page.goto('/en/development-beta')
    const notice = page
      .getByRole('status')
      .filter({ hasText: 'Unsent feedback kept on this browser' })
    await expect(notice).toContainText('not saved yet')
    await expect(notice.getByRole('link')).toHaveText(['Peripheral Bronchoscopy Imaging'])
    await notice.getByRole('link', { name: 'Peripheral Bronchoscopy Imaging' }).click()
    await expect(page).toHaveURL(/\/en\/development-beta\/peripheral-imaging$/)
    await expect(feedbackButton(page)).toHaveText('Continue feedback')
    // A different testing page does not claim this draft.
    await page.goto('/en/development-beta/ebus-guided')
    await expect(page.getByRole('button', { name: 'Give feedback' })).toBeEnabled()
    await page.goto('/en/development-beta/peripheral-imaging')
    await page.getByRole('button', { name: 'Continue feedback' }).click()
    await expect(page.getByText(`Page: ${piPath}`, { exact: true })).toBeVisible()
    await expect(page.getByLabel('What should we know?')).toHaveValue(draftComment)
    await expect(page.getByLabel('Text or section')).toHaveValue(selected)
    await expect(page.getByText('3 annotations · Included with your feedback')).toBeVisible()
    expect(await previewData(page)).toBe(edited)

    // Saving commits the report under the draft's ID, and only then clears the draft.
    await page.getByRole('button', { name: 'Save feedback locally' }).click()
    await expect(page.getByRole('status')).toContainText(
      `Feedback saved locally. Reference ${draftId.slice(0, 8)}`,
    )
    await expect(feedbackButton(page)).toHaveText('Give feedback')
    await expect.poll(async () => await databaseDrafts(page)).toEqual({ drafts: [], images: 0 })
    const reports = await databaseReports(page)
    expect(reports.map((report) => report.id).sort()).toEqual([draftId, savedBefore.id].sort())
    expect(await reportPng(page, draftId)).toEqual({
      page_path: piPath,
      comment: draftComment,
      png: edited,
    })
    // The earlier report was never rewritten by any of the draft work.
    expect((await reportPng(page, savedBefore.id)).png).toBe(savedPng)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Give feedback' })).toBeEnabled()
    await page.goto('/en/development-beta')
    await expect(page.getByRole('heading', { name: 'Help shape the next modules' })).toBeVisible()
    await expect(page.getByText('Unsent feedback kept on this browser')).toHaveCount(0)
    expect(requests).toEqual([])
  } finally {
    await context.close()
  }
})

test('a damaged draft record is named, kept, and removed only on request', async ({ page }) => {
  await openSection(page, 'ebus-guided', ebusPath)
  await page.getByRole('button', { name: 'Give feedback' }).click()
  await page.getByLabel('What should we know?').fill('Readable EBUS draft')
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await expect.poll(async () => (await databaseDrafts(page)).drafts).toHaveLength(1)
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('module-owner-feedback-drafts', 1)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction('drafts', 'readwrite')
          tx.objectStore('drafts').put({ id: 'damaged-record', schema_version: 99, comment: 7 })
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
        open.onerror = () => reject(open.error)
      }),
  )
  await page.reload()
  const warning = page.getByText('cannot be opened by this version', { exact: false })
  await expect(warning).toBeVisible()
  await expect(warning).toContainText('It has not been removed')
  expect((await databaseDrafts(page)).drafts).toHaveLength(2)
  // The readable draft is still offered beside the warning.
  await expect(feedbackButton(page)).toHaveText('Continue feedback')
  await page.getByRole('button', { name: 'Remove unreadable draft' }).click()
  await expect(warning).toHaveCount(0)
  const remaining = (await databaseDrafts(page)).drafts
  expect(remaining.map((draft) => draft.comment)).toEqual(['Readable EBUS draft'])
  await page.getByRole('button', { name: 'Continue feedback' }).click()
  await page.getByRole('button', { name: 'Discard draft' }).click()
  await expect.poll(async () => (await databaseDrafts(page)).drafts).toEqual([])
})

for (const viewport of [
  { width: 1280, height: 900, toolbar: 56 },
  { width: 1024, height: 768, toolbar: 56 },
  { width: 390, height: 844, toolbar: 96 },
  // At 320 the storage label needs a second line; the toolbar was 141 px here before.
  { width: 320, height: 740, toolbar: 112 },
]) {
  test(`review shell at ${viewport.width}×${viewport.height}: one scroll owner, compact toolbar, module layout unchanged`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    for (const [moduleId, path] of [
      ['peripheral-imaging', piPath],
      ['ebus-guided', ebusPath],
    ] as const) {
      // Direct route first: what the module looks like without the review shell.
      await page.goto(path)
      await expect(page.locator('h1').first()).toBeVisible()
      const layout = () => {
        const header = document.querySelector('body > div > header')!
        return {
          siteHeader: Math.round(header.getBoundingClientRect().height),
          headerPosition: getComputedStyle(header).position,
          scrollable: document.scrollingElement!.scrollHeight > innerHeight,
          horizontalOverflow: document.scrollingElement!.scrollWidth > innerWidth,
        }
      }
      const direct = await page.evaluate(layout)
      expect(direct.horizontalOverflow).toBe(false)

      const frame = await openSection(page, moduleId, path)
      const shell = await page.evaluate(() => {
        const iframe = document.querySelector('iframe')!
        const bar = iframe.parentElement!.querySelector(':scope > header')!
        return {
          toolbar: Math.round(bar.getBoundingClientRect().height),
          frameTop: Math.round(iframe.getBoundingClientRect().top),
          frameBottom: Math.round(iframe.getBoundingClientRect().bottom),
          frameWidth: Math.round(iframe.getBoundingClientRect().width),
          outsideView: [...bar.querySelectorAll('a,button')].filter((element) => {
            const box = element.getBoundingClientRect()
            return box.left < 0 || box.right > innerWidth + 0.5 || box.top < 0
          }).length,
        }
      })
      expect(shell.toolbar).toBeLessThanOrEqual(viewport.toolbar)
      expect(shell.outsideView).toBe(0)
      expect(shell.frameTop).toBe(shell.toolbar)
      expect(shell.frameBottom).toBe(viewport.height)
      expect(shell.frameWidth).toBe(viewport.width)
      // The site page under the shell does not move for a wheel or the keyboard.
      await page.mouse.move(viewport.width / 2, 20)
      await page.mouse.wheel(0, 600)
      await page.getByRole('link', { name: 'All beta modules' }).focus()
      await page.keyboard.press('End')
      await page.keyboard.press('PageDown')
      await page.waitForTimeout(250)
      expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0])
      // Its covered navigation is not a second copy for the keyboard or a screen reader:
      // nothing outside the shell is focusable except the skip link, and Shift+Tab from the
      // first shell control goes there rather than to a control hidden under the shell.
      expect(
        await page.evaluate(() => {
          const shell = document.querySelector('iframe')!.parentElement!
          const outside = (selector: string) =>
            [...document.querySelectorAll(selector)].filter(
              (element) => !shell.contains(element) && !element.closest('[inert]'),
            )
          return {
            focusable: outside('a[href],button,select,input,textarea').map((element) =>
              element.textContent!.trim(),
            ),
            navigation: outside('nav,[role=navigation]').length,
          }
        }),
      ).toEqual({ focusable: ['Skip to content'], navigation: 0 })
      await page.keyboard.press('Shift+Tab')
      await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(page.getByRole('link', { name: 'All beta modules' })).toBeFocused()
      // The module document is the scroll owner: a real wheel moves it, and wheeling past its
      // end does not reach a second document behind it.
      await page.mouse.move(
        viewport.width / 2,
        shell.toolbar + (viewport.height - shell.toolbar) / 2,
      )
      await page.mouse.wheel(0, 500)
      await expect.poll(() => frame.evaluate(() => window.scrollY)).toBeGreaterThan(100)
      await frame.evaluate(() => window.scrollTo(0, document.scrollingElement!.scrollHeight))
      await page.mouse.wheel(0, 1500)
      await page.waitForTimeout(250)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      await frame.evaluate(() => window.scrollTo(0, 0))
      // Inside the frame the module is laid out exactly as on its direct route.
      const wrapped = await frame.evaluate(layout)
      expect(wrapped).toEqual(direct)
      // Keyboard reaches the shell controls and then the module.
      await page.getByRole('link', { name: 'All beta modules' }).focus()
      await page.keyboard.press('Tab')
      await expect(page.getByRole('link', { name: 'Review feedback', exact: true })).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(feedbackButton(page)).toBeFocused()
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('IFRAME')
      // The feedback page context still follows in-module navigation.
      await page.getByRole('button', { name: 'Give feedback' }).click()
      await expect(page.getByText(`Page: ${path}`, { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Discard draft' }).click()
    }
    await expect(page.getByRole('link', { name: 'All beta modules' })).toHaveAttribute(
      'href',
      '/en/development-beta',
    )
  })
}

test('every module in the current beta catalog opens in the review shell without a hidden page scroll', async ({
  page,
  request,
}) => {
  test.setTimeout(600000)
  for (const entry of betaModules)
    expect((await request.get(`/en${entry.path}`, { timeout: 120000 })).status(), entry.id).toBe(
      200,
    )
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    for (const entry of betaModules) {
      await page.goto(`/en/development-beta/${entry.id}`)
      await expect(page.getByText('Owner review · saved locally on this browser')).toBeVisible()
      await expect(page.getByRole('heading', { level: 1, name: entry.title })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Give feedback' })).toBeEnabled({
        timeout: 60000,
      })
      await expect(page.getByRole('link', { name: 'All beta modules' })).toBeVisible()
      await expect
        .poll(
          () =>
            page.locator('iframe').evaluate((element) => {
              const inner = (element as HTMLIFrameElement).contentWindow!
              return inner.document.readyState !== 'loading' &&
                inner.document.querySelector('#main-content')
                ? inner.location.pathname
                : ''
            }),
          { timeout: 90000 },
        )
        .toContain(entry.path)
      await page.mouse.move(viewport.width / 2, 20)
      await page.mouse.wheel(0, 600)
      await page.getByRole('link', { name: 'All beta modules' }).focus()
      await page.keyboard.press('End')
      await page.waitForTimeout(150)
      expect(
        await page.evaluate(() => ({
          scrolled: [window.scrollX, window.scrollY],
          frameFillsToBottom:
            document.querySelector('iframe')!.getBoundingClientRect().bottom === innerHeight,
        })),
        entry.id,
      ).toEqual({ scrolled: [0, 0], frameFillsToBottom: true })
    }
  }
})
