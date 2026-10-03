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
      const open = indexedDB.open('module-owner-feedback-drafts')
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
// The whole draft database as stored, including the records that close a draft ID for good.
async function draftDatabase(page: Page) {
  return page.evaluate(async () => {
    type Stored = {
      version: number
      drafts: Array<{
        id: string
        module_id: string
        page_path: string
        comment: string
        selected_text: string
        annotations: Array<{ tool: string }>
        image: { token: string } | null
        forked_from?: string | null
        revision?: string
        schema_version: number
      }>
      images: Array<{ id: string; token: string }>
      finalizations: Array<{ id: string; outcome: string; fork: { id: string } | null }>
    }
    return new Promise<Stored>((resolve, reject) => {
      const open = indexedDB.open('module-owner-feedback-drafts')
      open.onsuccess = () => {
        const db = open.result
        const tx = db.transaction(['drafts', 'images', 'finalizations'])
        const drafts = tx.objectStore('drafts').getAll()
        const images = tx.objectStore('images').getAll()
        const finalizations = tx.objectStore('finalizations').getAll()
        tx.oncomplete = () => {
          db.close()
          resolve({
            version: db.version,
            drafts: drafts.result,
            images: images.result.map(({ id, token }) => ({ id, token })),
            finalizations: finalizations.result,
          })
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
    expect(dialog.message()).toContain('ALL saved local reports and screenshots')
    expect(dialog.message()).toContain('Unsent drafts are kept')
    return dialog.dismiss()
  })
  await expect(
    page.getByText('Unsent drafts are kept separately and are not removed by this action.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Clear saved feedback' }).click()
  expect(await databaseReports(page)).toHaveLength(1)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Clear saved feedback' }).click()
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
        const open = indexedDB.open('module-owner-feedback-drafts')
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
      // The skip link is left working. Activating it may move the covered outer document to
      // its target (about one site-header height); that is not asserted to be zero. What must
      // hold is that the fixed shell still covers the whole viewport, so nothing under it shows.
      await page.getByRole('link', { name: 'Skip to content' }).focus()
      await page.keyboard.press('Enter')
      await page.waitForTimeout(250)
      expect(
        await page.evaluate(() => {
          const shell = document.querySelector('iframe')!.parentElement!
          const box = shell.getBoundingClientRect()
          const points = [
            [1, 1],
            [innerWidth - 2, 1],
            [1, innerHeight - 2],
            [innerWidth - 2, innerHeight - 2],
            [innerWidth / 2, innerHeight / 2],
          ]
          return {
            box: [box.left, box.top, Math.round(box.width), Math.round(box.height)],
            covered: points.every(([x, y]) => shell.contains(document.elementFromPoint(x, y))),
          }
        }),
      ).toEqual({ box: [0, 0, viewport.width, viewport.height], covered: true })
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

// One owner, two tabs of the same browser profile, one stored draft. Every case below runs in a
// real persistent profile against real IndexedDB; nothing about the stores is mocked.
test.describe('one draft open in two tabs', () => {
  test.describe.configure({ timeout: 240000 })
  const testingPage = '/en/development-beta/peripheral-imaging'
  const commentBox = (page: Page) => page.getByLabel('What should we know?')
  // On a cold development server the first browser visit of these pages can still make it
  // reload every open tab once (the HTTP warm-up above does not cover that). Take that reload
  // here, in a throwaway context, so no test's first tab is reloaded behind its back.
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240000)
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3110' })
    const first = await context.newPage()
    await openSection(first, 'peripheral-imaging', piPath)
    const second = await context.newPage()
    await second.goto(testingPage)
    await expect(second.getByRole('button', { name: 'Give feedback' })).toBeEnabled()
    await second.waitForTimeout(3000)
    await context.close()
  })
  async function profile(testInfo: { outputPath: (name: string) => string }) {
    const directory = testInfo.outputPath('two-tab-profile')
    const launch = () =>
      chromium.launchPersistentContext(directory, {
        baseURL: 'http://127.0.0.1:3110',
        viewport: { width: 1440, height: 1000 },
      })
    return { launch, context: await launch() }
  }
  // Tab A starts a draft on a real lesson page; tab B restores the same stored draft.
  async function shareDraft(a: Page, b: Page, withImage = false) {
    await openSection(a, 'peripheral-imaging', piPath)
    await a.evaluate(() => Object.assign(window, { tabA: true }))
    await a.getByRole('button', { name: 'Give feedback' }).click()
    await commentBox(a).fill('Shared draft wording')
    if (withImage) {
      await a.getByLabel('Upload screenshot').setInputFiles({
        name: 'shared.png',
        mimeType: 'image/png',
        buffer: await a.locator('iframe').screenshot(),
      })
      await expect(a.getByLabel('Screenshot preview.', { exact: false })).toBeVisible()
      await drag(a, [10, 10], [180, 70])
      await a.getByRole('button', { name: 'Arrow', exact: true }).click()
      await drag(a, [40, 110], [220, 110])
      await expect(a.getByText('2 annotations · Included with your feedback')).toBeVisible()
    }
    await a.getByRole('button', { name: 'Continue testing' }).click()
    await expect.poll(async () => (await databaseDrafts(a)).drafts).toHaveLength(1)
    const id = (await databaseDrafts(a)).drafts[0].id
    await b.goto(testingPage)
    await expect(feedbackButton(b)).toHaveText('Continue feedback')
    return id
  }
  const open = async (page: Page) => {
    await page.getByRole('button', { name: 'Continue feedback' }).click()
    await expect(commentBox(page)).toBeVisible()
  }
  // Tab A must still be the page that started the draft. A development-server reload would
  // make it read the stored draft again, and the case would no longer be about a stale tab.
  const stillOpenSinceStart = (a: Page) =>
    a.evaluate(() => (window as unknown as { tabA?: boolean }).tabA === true)
  // The notice under the toolbar (the dialog shows the same words while it is open).
  const toolbarNotice = (page: Page, text: string) =>
    page.locator('#main-content').getByText(text, { exact: false })
  // Every stored image belongs to a stored draft.
  const orphanImages = (stored: Awaited<ReturnType<typeof draftDatabase>>) =>
    stored.images.filter((image) => !stored.drafts.some((draft) => draft.id === image.id))

  test('Save in A keeps the newer text B had already stored, across reload and browser restart', async ({}, testInfo) => {
    const { launch, context: first } = await profile(testInfo)
    let context = first
    try {
      const a = context.pages()[0]
      const b = await context.newPage()
      const id = await shareDraft(a, b)
      await open(b)
      await commentBox(b).fill('Tab B newer wording')
      await b.getByRole('button', { name: 'Continue testing' }).click()
      await expect
        .poll(async () => (await databaseDrafts(b)).drafts[0]?.comment)
        .toBe('Tab B newer wording')

      // A still shows what it had, and saves that.
      expect(await stillOpenSinceStart(a)).toBe(true)
      await open(a)
      await expect(commentBox(a)).toHaveValue('Shared draft wording')
      await a.getByRole('button', { name: 'Save feedback locally' }).click()
      await expect(a.getByText(`Feedback saved locally. Reference ${id.slice(0, 8)}`)).toBeVisible()
      await expect(
        toolbarNotice(a, 'A newer version stored by another tab was kept as an unsent draft.'),
      ).toBeVisible()
      const reports = await databaseReports(a)
      expect(reports.map((report) => report.id)).toEqual([id])
      expect((reports[0] as unknown as { comment: string }).comment).toBe('Shared draft wording')

      const stored = await draftDatabase(a)
      expect(stored.version).toBe(2)
      expect(stored.drafts).toHaveLength(1)
      const [kept] = stored.drafts
      expect(kept.id).not.toBe(id)
      expect(kept).toMatchObject({
        comment: 'Tab B newer wording',
        module_id: 'peripheral-imaging',
        page_path: piPath,
        forked_from: id,
      })
      expect(stored.finalizations).toEqual([
        expect.objectContaining({
          id,
          outcome: 'saved',
          fork: expect.objectContaining({ id: kept.id }),
        }),
      ])
      expect(orphanImages(stored)).toEqual([])

      // B keeps working on the same text: it continues the kept draft, never a second copy
      // and never the saved ID.
      await open(b)
      await commentBox(b).fill('Tab B newer wording, continued')
      await expect(
        b.getByText('Another tab already saved an earlier version of this draft.', {
          exact: false,
        }),
      ).toBeVisible()
      await b.getByRole('button', { name: 'Continue testing' }).click()
      await expect
        .poll(async () => (await draftDatabase(b)).drafts.map((draft) => [draft.id, draft.comment]))
        .toEqual([[kept.id, 'Tab B newer wording, continued']])

      // Reload: the report with this ID exists, and the newer text is still offered.
      await b.reload()
      await expect(feedbackButton(b)).toHaveText('Continue feedback')
      await open(b)
      await expect(commentBox(b)).toHaveValue('Tab B newer wording, continued')
      await expect(b.getByText(`Page: ${piPath}`, { exact: true })).toBeVisible()
      await b.getByRole('button', { name: 'Continue testing' }).click()

      // Restart the browser with the same profile.
      await context.close()
      context = await launch()
      const page = context.pages()[0]
      await page.goto('/en/development-beta')
      await expect(
        page.getByRole('status').filter({ hasText: 'Unsent feedback kept on this browser' }),
      ).toBeVisible()
      await page.goto(testingPage)
      await expect(feedbackButton(page)).toHaveText('Continue feedback')
      await open(page)
      await expect(commentBox(page)).toHaveValue('Tab B newer wording, continued')
      const after = await draftDatabase(page)
      expect(after.drafts.map((draft) => draft.id)).toEqual([kept.id])
      expect(after.finalizations.map((entry) => [entry.id, entry.outcome])).toEqual([[id, 'saved']])
      const [report] = await databaseReports(page)
      expect([report.id, (report as unknown as { comment: string }).comment]).toEqual([
        id,
        'Shared draft wording',
      ])
      // The kept draft is still unsent work, not a report, and saves as its own report.
      await page.getByRole('button', { name: 'Save feedback locally' }).click()
      await expect(
        page.getByText(`Feedback saved locally. Reference ${kept.id.slice(0, 8)}`),
      ).toBeVisible()
      await expect.poll(async () => (await draftDatabase(page)).drafts).toEqual([])
      expect((await databaseReports(page)).map((entry) => entry.id).sort()).toEqual(
        [id, kept.id].sort(),
      )
    } finally {
      await context.close()
    }
  })

  test('an edit in B after A saved becomes a new draft and never recreates the saved ID', async ({}, testInfo) => {
    const { context } = await profile(testInfo)
    try {
      const a = context.pages()[0]
      const b = await context.newPage()
      const id = await shareDraft(a, b)
      await open(b)
      await open(a)
      await a.getByRole('button', { name: 'Save feedback locally' }).click()
      await expect(a.getByText(`Feedback saved locally. Reference ${id.slice(0, 8)}`)).toBeVisible()
      await expect.poll(async () => (await draftDatabase(a)).drafts).toEqual([])
      await expect(feedbackButton(a)).toHaveText('Give feedback')

      await commentBox(b).fill('Typed in B after A saved')
      await expect
        .poll(async () => (await draftDatabase(b)).drafts.map((draft) => draft.comment))
        .toEqual(['Typed in B after A saved'])
      await expect(
        b.getByText(
          'Another tab already saved an earlier version of this draft. Your changes here were kept as a new unsent draft.',
        ),
      ).toBeVisible()
      const stored = await draftDatabase(b)
      expect(stored.drafts[0].id).not.toBe(id)
      expect(stored.drafts[0]).toMatchObject({ forked_from: id, page_path: piPath })
      await b.getByRole('button', { name: 'Continue testing' }).click()
      await b.reload()
      await expect(feedbackButton(b)).toHaveText('Continue feedback')
      await open(b)
      await expect(commentBox(b)).toHaveValue('Typed in B after A saved')
      const after = await draftDatabase(b)
      expect(after.drafts.map((draft) => draft.id)).toEqual([stored.drafts[0].id])
      const reports = await databaseReports(b)
      expect(reports.map((report) => report.id)).toEqual([id])
      expect((reports[0] as unknown as { comment: string }).comment).toBe('Shared draft wording')
    } finally {
      await context.close()
    }
  })

  test('Discard in A keeps the newer text B had already stored and the discarded ID stays closed', async ({}, testInfo) => {
    const { context } = await profile(testInfo)
    try {
      const a = context.pages()[0]
      const b = await context.newPage()
      const id = await shareDraft(a, b)
      await open(b)
      await commentBox(b).fill('Tab B newer wording')
      await b.getByRole('button', { name: 'Continue testing' }).click()
      await expect
        .poll(async () => (await databaseDrafts(b)).drafts[0]?.comment)
        .toBe('Tab B newer wording')
      expect(await stillOpenSinceStart(a)).toBe(true)
      await open(a)
      await a.getByRole('button', { name: 'Discard draft' }).click()
      await expect(
        toolbarNotice(
          a,
          'Draft discarded. A newer version stored by another tab was kept as an unsent draft.',
        ),
      ).toBeVisible()
      const stored = await draftDatabase(a)
      expect(stored.drafts.map((draft) => draft.comment)).toEqual(['Tab B newer wording'])
      expect(stored.drafts[0].id).not.toBe(id)
      expect(stored.finalizations.map((entry) => [entry.id, entry.outcome])).toEqual([
        [id, 'discarded'],
      ])
      expect(await databaseReports(a)).toEqual([])
      // B goes on typing in its tab: one draft, under the new ID.
      await open(b)
      await commentBox(b).fill('Tab B newer wording, continued')
      await b.getByRole('button', { name: 'Continue testing' }).click()
      await expect
        .poll(async () => (await draftDatabase(b)).drafts.map((draft) => [draft.id, draft.comment]))
        .toEqual([[stored.drafts[0].id, 'Tab B newer wording, continued']])
      await b.reload()
      await a.reload()
      for (const page of [a, b]) {
        await expect(feedbackButton(page)).toHaveText('Continue feedback')
        await open(page)
        await expect(commentBox(page)).toHaveValue('Tab B newer wording, continued')
        await page.getByRole('button', { name: 'Continue testing' }).click()
      }
      expect((await draftDatabase(a)).drafts.map((draft) => draft.id)).toEqual([
        stored.drafts[0].id,
      ])
    } finally {
      await context.close()
    }
  })

  test('an edit in B after A discarded becomes a new draft; the discarded one does not come back', async ({}, testInfo) => {
    const { context } = await profile(testInfo)
    try {
      const a = context.pages()[0]
      const b = await context.newPage()
      const id = await shareDraft(a, b)
      await open(b)
      expect(await stillOpenSinceStart(a)).toBe(true)
      await open(a)
      await a.getByRole('button', { name: 'Discard draft' }).click()
      await expect.poll(async () => (await draftDatabase(a)).drafts).toEqual([])
      await expect(feedbackButton(a)).toHaveText('Give feedback')
      await commentBox(b).fill('Typed in B after A discarded')
      await expect
        .poll(async () => (await draftDatabase(b)).drafts.map((draft) => draft.comment))
        .toEqual(['Typed in B after A discarded'])
      await expect(
        b.getByText('Another tab discarded an earlier version of this draft.', { exact: false }),
      ).toBeVisible()
      await b.getByRole('button', { name: 'Continue testing' }).click()
      await b.reload()
      await expect(feedbackButton(b)).toHaveText('Continue feedback')
      await open(b)
      await expect(commentBox(b)).toHaveValue('Typed in B after A discarded')
      const stored = await draftDatabase(b)
      expect(stored.drafts).toHaveLength(1)
      expect(stored.drafts[0].id).not.toBe(id)
      expect(stored.finalizations.map((entry) => [entry.id, entry.outcome])).toEqual([
        [id, 'discarded'],
      ])
      expect(await databaseReports(b)).toEqual([])
    } finally {
      await context.close()
    }
  })

  test('a tab that changed nothing gets no duplicate or phantom draft after Save or Discard elsewhere', async ({}, testInfo) => {
    const { context } = await profile(testInfo)
    try {
      const a = context.pages()[0]
      const b = await context.newPage()
      const id = await shareDraft(a, b)
      await open(a)
      await a.getByRole('button', { name: 'Save feedback locally' }).click()
      await expect(a.getByText(`Feedback saved locally. Reference ${id.slice(0, 8)}`)).toBeVisible()
      // B still shows its stale label until it looks; opening the draft finds it was saved.
      await b.getByRole('button', { name: 'Continue feedback' }).click()
      await expect(b.getByRole('dialog')).toHaveCount(0)
      await expect(toolbarNotice(b, 'This draft was already saved in another tab.')).toBeVisible()
      await expect(feedbackButton(b)).toHaveText('Give feedback')
      expect((await draftDatabase(b)).drafts).toEqual([])
      expect((await databaseReports(b)).map((report) => report.id)).toEqual([id])

      // The same for Discard, this time with B's dialog already open and untouched.
      await a.getByRole('button', { name: 'Give feedback' }).click()
      await commentBox(a).fill('Second shared draft')
      await a.getByRole('button', { name: 'Continue testing' }).click()
      await expect.poll(async () => (await draftDatabase(a)).drafts).toHaveLength(1)
      await b.reload()
      await expect(feedbackButton(b)).toHaveText('Continue feedback')
      await open(b)
      expect(await stillOpenSinceStart(a)).toBe(true)
      await open(a)
      await a.getByRole('button', { name: 'Discard draft' }).click()
      await expect.poll(async () => (await draftDatabase(a)).drafts).toEqual([])
      await b.getByRole('button', { name: 'Continue testing' }).click()
      await b.waitForTimeout(800)
      expect((await draftDatabase(b)).drafts).toEqual([])
      await b.getByRole('button', { name: 'Continue feedback' }).click()
      await expect(b.getByRole('dialog')).toHaveCount(0)
      await expect(
        toolbarNotice(b, 'This draft was already discarded in another tab.'),
      ).toBeVisible()
      await expect(feedbackButton(b)).toHaveText('Give feedback')
      await b.reload()
      await expect(b.getByRole('button', { name: 'Give feedback' })).toBeEnabled()
      const stored = await draftDatabase(b)
      expect(stored.drafts).toEqual([])
      expect(stored.images).toEqual([])
      expect((await databaseReports(b)).map((report) => report.id)).toEqual([id])
    } finally {
      await context.close()
    }
  })

  test('a kept draft carries its screenshot and editable annotations through the conflict', async ({}, testInfo) => {
    const { context } = await profile(testInfo)
    try {
      const a = context.pages()[0]
      const b = await context.newPage()
      const id = await shareDraft(a, b, true)
      const before = await draftDatabase(a)
      expect(before.images).toHaveLength(1)
      await open(a)
      const older = await previewData(a)

      // B adds a third mark and stores it.
      await open(b)
      await expect(b.getByText('2 annotations · Included with your feedback')).toBeVisible()
      expect(await previewData(b)).toBe(older)
      await b.getByRole('button', { name: 'Draw', exact: true }).click()
      await drag(b, [80, 150], [210, 150])
      await expect(b.getByText('3 annotations · Included with your feedback')).toBeVisible()
      const newer = await previewData(b)
      expect(newer).not.toBe(older)
      await b.getByRole('button', { name: 'Continue testing' }).click()
      await expect.poll(async () => (await databaseDrafts(b)).drafts[0]?.annotations.length).toBe(3)

      // A saves its older, two-mark version.
      await a.getByRole('button', { name: 'Save feedback locally' }).click()
      await expect(a.getByText(`Feedback saved locally. Reference ${id.slice(0, 8)}`)).toBeVisible()
      expect((await reportPng(a, id)).png).toBe(older)
      const stored = await draftDatabase(a)
      expect(stored.drafts).toHaveLength(1)
      const [kept] = stored.drafts
      expect(kept.id).not.toBe(id)
      expect(kept.annotations.map((mark) => mark.tool)).toEqual(['box', 'arrow', 'draw'])
      // The source image moved with the draft: same bytes token, one record, no orphan.
      expect(stored.images).toEqual([{ id: kept.id, token: before.images[0].token }])
      expect(kept.image?.token).toBe(before.images[0].token)

      await b.reload()
      await expect(feedbackButton(b)).toHaveText('Continue feedback')
      await open(b)
      await expect(b.getByText('3 annotations · Included with your feedback')).toBeVisible()
      expect(await previewData(b)).toBe(newer)
      // Still marks over the source image, not a flattened picture.
      await b.getByRole('button', { name: 'Undo', exact: true }).click()
      await expect(b.getByText('2 annotations · Included with your feedback')).toBeVisible()
      expect(await previewData(b)).toBe(older)
      await b.getByRole('button', { name: 'Continue testing' }).click()
      await expect.poll(async () => (await draftDatabase(b)).drafts[0]?.annotations.length).toBe(2)
      // Replacing the screenshot, then discarding, leaves no image behind.
      await open(b)
      await b.getByLabel('Upload screenshot').setInputFiles({
        name: 'replacement.png',
        mimeType: 'image/png',
        buffer: await b.locator('header').first().screenshot(),
      })
      await expect(b.getByText('0 annotations · Included with your feedback')).toBeVisible()
      await b.getByRole('button', { name: 'Continue testing' }).click()
      await expect
        .poll(async () => (await draftDatabase(b)).images.map((image) => image.token))
        .not.toEqual([before.images[0].token])
      const replaced = await draftDatabase(b)
      expect(replaced.images.map((image) => image.id)).toEqual([kept.id])
      await open(b)
      await b.getByRole('button', { name: 'Discard draft' }).click()
      await expect
        .poll(async () => {
          const end = await draftDatabase(b)
          return [end.drafts.length, end.images.length]
        })
        .toEqual([0, 0])
      // The saved report was never touched by any of it.
      expect((await reportPng(b, id)).png).toBe(older)
    } finally {
      await context.close()
    }
  })

  test('two tabs editing the same draft before either finalizes keep both versions', async ({}, testInfo) => {
    const { context } = await profile(testInfo)
    try {
      const a = context.pages()[0]
      const b = await context.newPage()
      const id = await shareDraft(a, b)
      await open(b)
      await commentBox(b).fill('Edited in B')
      await b.getByRole('button', { name: 'Continue testing' }).click()
      await expect
        .poll(async () => (await databaseDrafts(b)).drafts[0]?.comment)
        .toBe('Edited in B')
      await open(a)
      await commentBox(a).fill('Edited in A')
      await expect(
        a.getByText('This draft was also changed in another tab.', { exact: false }),
      ).toBeVisible()
      const stored = await draftDatabase(a)
      expect(stored.drafts.map((draft) => [draft.id === id, draft.comment]).sort()).toEqual([
        [false, 'Edited in A'],
        [true, 'Edited in B'],
      ])
      expect(stored.finalizations).toEqual([])
    } finally {
      await context.close()
    }
  })
})

test('a version 1 draft database is upgraded in place with its draft and image intact', async ({
  page,
}) => {
  // A page of this origin that never opens the draft database, so version 1 can be laid down.
  await page.goto('/en/admin/module-feedback')
  await expect(page.getByRole('button', { name: 'Clear saved feedback' })).toBeVisible()
  const seeded = await page.evaluate(async (pagePath) => {
    const canvas = document.createElement('canvas')
    canvas.width = 6
    canvas.height = 4
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#c2410c'
    ctx.fillRect(0, 0, 6, 4)
    const data = canvas.toDataURL('image/png').split(',')[1]
    const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'image/png' })
    const id = crypto.randomUUID()
    const token = crypto.randomUUID()
    const record = {
      id,
      host_module_id: 'peripheral-imaging',
      module_id: 'peripheral-imaging',
      page_path: pagePath,
      comment: 'Written by version 1',
      selected_text: 'Version 1 selection',
      annotations: [{ tool: 'box', start: { x: 1, y: 1 }, end: { x: 5, y: 3 } }],
      image: { token, type: 'image/png', size: blob.size, width: 6, height: 4 },
      created_at: '2026-10-02T10:00:00.000Z',
      updated_at: '2026-10-02T10:05:00.000Z',
      storage_mode: 'owner-local',
      record_kind: 'draft',
      schema_version: 1,
    }
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('module-owner-feedback-drafts', 1)
      open.onupgradeneeded = () => {
        open.result.createObjectStore('drafts', { keyPath: 'id' })
        open.result.createObjectStore('images', { keyPath: 'id' })
      }
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const tx = open.result.transaction(['drafts', 'images'], 'readwrite')
        tx.objectStore('drafts').put(record)
        tx.objectStore('images').put({ id, token, blob })
        tx.oncomplete = () => {
          open.result.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
    })
    return { record, png: data }
  }, piPath)
  expect(
    (await page.evaluate(() => indexedDB.databases()))
      .filter((db) => db.name === 'module-owner-feedback-drafts')
      .map((db) => db.version),
  ).toEqual([1])

  await page.goto('/en/development-beta/peripheral-imaging')
  await expect(feedbackButton(page)).toHaveText('Continue feedback')
  const upgraded = await draftDatabase(page)
  expect(upgraded.version).toBe(2)
  // The record itself was not rewritten by the upgrade.
  expect(upgraded.drafts).toEqual([seeded.record])
  expect(upgraded.images).toEqual([{ id: seeded.record.id, token: seeded.record.image.token }])
  expect(upgraded.finalizations).toEqual([])
  await page.getByRole('button', { name: 'Continue feedback' }).click()
  await expect(page.getByText(`Page: ${piPath}`, { exact: true })).toBeVisible()
  await expect(page.getByLabel('What should we know?')).toHaveValue('Written by version 1')
  await expect(page.getByLabel('Text or section')).toHaveValue('Version 1 selection')
  await expect(page.getByText('1 annotation · Included with your feedback')).toBeVisible()
  await page.getByRole('button', { name: 'Clear marks' }).click()
  expect(await previewData(page)).toBe(seeded.png)
  // The next edit continues the same draft, now in the current record shape.
  await page.getByLabel('What should we know?').fill('Edited after the upgrade')
  await page.getByRole('button', { name: 'Continue testing' }).click()
  await expect
    .poll(async () => (await draftDatabase(page)).drafts[0])
    .toMatchObject({
      id: seeded.record.id,
      comment: 'Edited after the upgrade',
      created_at: seeded.record.created_at,
      schema_version: 2,
      forked_from: null,
    })
  expect((await draftDatabase(page)).images).toEqual([
    { id: seeded.record.id, token: seeded.record.image.token },
  ])
  // The reports database was not created, upgraded, or touched by any of this.
  expect(
    (await page.evaluate(() => indexedDB.databases()))
      .filter((db) => db.name === 'module-owner-feedback')
      .every((db) => db.version === 1),
  ).toBe(true)
})
