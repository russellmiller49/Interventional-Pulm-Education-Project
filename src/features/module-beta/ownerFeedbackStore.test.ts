/** @jest-environment node */
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import JSZip from 'jszip'
import {
  clearOwnerFeedback,
  deleteOwnerFeedback,
  listOwnerFeedback,
  ownerFeedbackDatabase,
  ownerFeedbackVersion,
  saveOwnerFeedback,
  updateOwnerFeedback,
} from './ownerFeedbackStore'
import { exportOwnerFeedback } from './ownerFeedbackExport'
import { maxScreenshotBytes } from './schema'

const input = {
  id: 'b8b3da51-5068-4c58-9ebd-3f846a27b337',
  moduleId: 'peripheral-imaging',
  pagePath: '/en/peripheral-imaging/learn?section=field',
  comment: '  Exact wording.\n```text\nKeep this.  ',
  selectedText: 'Selected words',
}
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1sAAAAASUVORK5CYII=',
  'base64',
)
const image = () => new Blob([png], { type: 'image/png' })
beforeEach(() => {
  global.indexedDB = new IDBFactory()
})
afterEach(() => {
  jest.restoreAllMocks()
})

it('inserts, lists and preserves the screenshot Blob and wording across connections', async () => {
  const saved = await saveOwnerFeedback(input, image())
  const [read] = await listOwnerFeedback()
  expect(read).toMatchObject({
    ...saved,
    schema_version: ownerFeedbackVersion,
    storage_mode: 'owner-local',
  })
  expect(Buffer.from(await read.screenshot!.blob.arrayBuffer())).toEqual(png)
  expect(read.screenshot).toMatchObject({
    type: 'image/png',
    width: 1,
    height: 1,
    size: png.length,
  })
  expect(read).not.toHaveProperty('tester_email')
})
it('serializes concurrent retries by ID without replacing review notes', async () => {
  await Promise.all([saveOwnerFeedback(input, image()), saveOwnerFeedback(input, image())])
  await updateOwnerFeedback(input.id, {
    status: 'in-review',
    reviewerNotes: '  Keep these notes.  ',
  })
  await saveOwnerFeedback({ ...input, comment: 'Retry' })
  expect(await listOwnerFeedback()).toHaveLength(1)
  expect((await listOwnerFeedback())[0]).toMatchObject({
    comment: input.comment,
    status: 'in-review',
    reviewer_notes: '  Keep these notes.  ',
  })
})
it('filters modules and status and persists independent status/note updates', async () => {
  await saveOwnerFeedback(input)
  await saveOwnerFeedback({
    ...input,
    id: 'f85254c6-4251-4613-a882-9fef981c70de',
    moduleId: 'ebus-guided',
    pagePath: '/en/ebus-guided/learn?section=acoustic-contact',
  })
  await updateOwnerFeedback(input.id, { status: 'in-review', reviewerNotes: '' })
  await updateOwnerFeedback(input.id, { status: 'in-review', reviewerNotes: 'Needs a revision.' })
  expect(
    await listOwnerFeedback({ moduleId: 'peripheral-imaging', status: 'in-review' }),
  ).toHaveLength(1)
  expect(await listOwnerFeedback({ moduleId: 'ebus-guided', status: 'in-review' })).toHaveLength(0)
  expect(await listOwnerFeedback({ status: 'new' })).toHaveLength(1)
  await expect(
    updateOwnerFeedback(input.id, { status: 'resolved', reviewerNotes: 'x'.repeat(10001) }),
  ).rejects.toThrow()
  expect((await listOwnerFeedback({ status: 'in-review' }))[0].reviewer_notes).toBe(
    'Needs a revision.',
  )
})
it('deletes and clears records and their screenshots', async () => {
  await saveOwnerFeedback(input, image())
  await deleteOwnerFeedback(input.id)
  expect(await listOwnerFeedback()).toEqual([])
  await expect(
    updateOwnerFeedback(input.id, { status: 'resolved', reviewerNotes: '' }),
  ).rejects.toThrow('not found')
  await saveOwnerFeedback(input, image())
  await clearOwnerFeedback()
  expect(await listOwnerFeedback()).toEqual([])
})
it('does not resolve success before an aborted transaction commits; retry keeps the ID', async () => {
  const add = IDBObjectStore.prototype.add
  jest.spyOn(IDBObjectStore.prototype, 'add').mockImplementationOnce(function (
    this: IDBObjectStore,
    ...args
  ) {
    const request = add.apply(this, args)
    this.transaction.abort()
    return request
  })
  await expect(saveOwnerFeedback(input, image())).rejects.toThrow('Keep your draft')
  expect(await listOwnerFeedback()).toEqual([])
  await saveOwnerFeedback(input, image())
  expect(await listOwnerFeedback()).toHaveLength(1)
})
it('rejects unsafe paths, oversized, forged and excessive-dimension screenshots', async () => {
  await expect(
    saveOwnerFeedback({ ...input, pagePath: input.pagePath + '&token=secret' }),
  ).rejects.toThrow()
  await expect(
    saveOwnerFeedback(input, new Blob(['<svg/>'], { type: 'image/png' })),
  ).rejects.toThrow()
  await expect(
    saveOwnerFeedback(
      input,
      new Blob([new Uint8Array(maxScreenshotBytes + 1)], { type: 'image/png' }),
    ),
  ).rejects.toThrow('3 MB')
  const huge = Buffer.from(png)
  huge.writeUInt32BE(4097, 16)
  await expect(saveOwnerFeedback(input, new Blob([huge], { type: 'image/png' }))).rejects.toThrow()
  expect(await listOwnerFeedback()).toEqual([])
})
async function rawDatabase(version = ownerFeedbackVersion) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(ownerFeedbackDatabase, version)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
it('opens schema v1 and refuses newer databases without deleting data', async () => {
  await saveOwnerFeedback(input, image())
  const db = await rawDatabase(2)
  expect(db.version).toBe(2)
  db.close()
  await expect(listOwnerFeedback()).rejects.toThrow('newer feedback database')
  const newer = await rawDatabase(2)
  const request = newer.transaction('reports').objectStore('reports').count()
  await new Promise<void>((resolve) => {
    request.onsuccess = () => {
      expect(request.result).toBe(1)
      resolve()
    }
  })
  newer.close()
})
it('refuses unsupported record versions without silently hiding or replacing them', async () => {
  const saved = await saveOwnerFeedback(input)
  const db = await rawDatabase()
  const tx = db.transaction('reports', 'readwrite')
  tx.objectStore('reports').put({ ...saved, schema_version: 2 })
  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve()
  })
  db.close()
  await expect(listOwnerFeedback()).rejects.toThrow('Unsupported')
  await expect(saveOwnerFeedback(input)).rejects.toThrow('Unsupported')
})
it('exports faithful Markdown and JSON plus exact screenshot bytes; leaves records intact', async () => {
  await saveOwnerFeedback(input, image())
  await updateOwnerFeedback(input.id, { status: 'in-review', reviewerNotes: '  Recheck later.  ' })
  const result = await exportOwnerFeedback(
    await listOwnerFeedback(),
    {},
    new Date('2026-09-18T12:00:00Z'),
  )
  expect(result.filename).toBe('module-owner-feedback-2026-09-18.zip')
  const archive = await JSZip.loadAsync(await result.blob.arrayBuffer())
  const json = JSON.parse(await archive.file('feedback.json')!.async('string'))
  expect(json).toMatchObject({
    schemaVersion: 1,
    mode: 'owner-local',
    records: [
      {
        comment: input.comment,
        selected_text: input.selectedText,
        page_path: input.pagePath,
        status: 'in-review',
        reviewer_notes: '  Recheck later.  ',
        screenshot_filename: `screenshots/${input.id}.png`,
      },
    ],
  })
  const markdown = await archive.file('feedback.md')!.async('string')
  for (const text of [input.comment, input.selectedText, input.pagePath, '  Recheck later.  '])
    expect(markdown).toContain(text)
  expect(await archive.file(`screenshots/${input.id}.png`)!.async('nodebuffer')).toEqual(png)
  expect(await listOwnerFeedback()).toHaveLength(1)
})
