/** @jest-environment node */
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import JSZip from 'jszip'
import {
  deleteOwnerDraft,
  deleteUnreadableOwnerDrafts,
  maxDraftAnnotations,
  ownerDraftDatabase,
  ownerDraftDatabaseVersion,
  ownerDraftSchemaVersion,
  readOwnerDrafts,
  saveOwnerDraft,
} from './ownerDraftStore'
import {
  clearOwnerFeedback,
  listOwnerFeedback,
  ownerFeedbackDatabase,
  ownerFeedbackExists,
  ownerFeedbackVersion,
  saveOwnerFeedback,
} from './ownerFeedbackStore'
import { exportOwnerFeedback } from './ownerFeedbackExport'
import { hasReferencedText, isMeaningfulDraft } from './draftContent'
import { maxScreenshotBytes } from './schema'

const draft = {
  id: 'b8b3da51-5068-4c58-9ebd-3f846a27b337',
  hostModuleId: 'peripheral-imaging',
  moduleId: 'peripheral-imaging',
  pagePath: '/en/peripheral-imaging/learn?section=imaging-questions&phase=recognize',
  comment: '  Unsent wording.\n```text\nKeep this.  ',
  selectedText: 'Selected words',
  annotations: [] as unknown[],
}
const otherId = 'f85254c6-4251-4613-a882-9fef981c70de'
const token = '0b0c3f52-6d0b-4d5e-9c59-5f4e7a0f0a11'
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE1sAAAAASUVORK5CYII=',
  'base64',
)
const image = (value = token) => ({ blob: new Blob([png], { type: 'image/png' }), token: value })
const marks = [
  { tool: 'box', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  { tool: 'arrow', start: { x: 0, y: 1 }, end: { x: 1, y: 0 } },
  {
    tool: 'draw',
    points: [
      { x: 0, y: 0 },
      { x: 0.5, y: 1 },
    ],
  },
  { tool: 'text', point: { x: 0, y: 0 }, text: 'Needs contrast' },
]
beforeEach(() => {
  global.indexedDB = new IDBFactory()
})
afterEach(() => {
  jest.restoreAllMocks()
})
function raw(name: string, version: number) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, version)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function rawPut(store: 'drafts' | 'images', value: unknown) {
  const db = await raw(ownerDraftDatabase, ownerDraftDatabaseVersion)
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).put(value)
  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve()
  })
  db.close()
}

describe('meaningful draft content', () => {
  it('treats an empty or whitespace-only dialog as no draft', () => {
    for (const selectedText of ['', ' \n\t ', '​﻿⁠'])
      expect(isMeaningfulDraft({ comment: ' \n ', selectedText, hasImage: false })).toBe(false)
    expect(hasReferencedText('​ \n')).toBe(false)
  })
  it('counts a comment, referenced text, or an image on its own', () => {
    expect(isMeaningfulDraft({ comment: 'x', selectedText: '', hasImage: false })).toBe(true)
    expect(isMeaningfulDraft({ comment: '', selectedText: ' Dose ', hasImage: false })).toBe(true)
    expect(isMeaningfulDraft({ comment: '', selectedText: '', hasImage: true })).toBe(true)
  })
})

it('keeps a comment-only draft with its retry ID, module and original page verbatim', async () => {
  const saved = await saveOwnerDraft({ ...draft, selectedText: '' })
  const { drafts, unreadable } = await readOwnerDrafts()
  expect(unreadable).toEqual([])
  expect(drafts).toEqual([{ ...saved, screenshot: null }])
  expect(drafts[0]).toMatchObject({
    id: draft.id,
    host_module_id: 'peripheral-imaging',
    module_id: 'peripheral-imaging',
    page_path: draft.pagePath,
    comment: draft.comment,
    selected_text: '',
    record_kind: 'draft',
    storage_mode: 'owner-local',
    schema_version: ownerDraftSchemaVersion,
  })
})
it('keeps a selected-text-only draft and an image-only draft', async () => {
  await saveOwnerDraft({ ...draft, comment: '' })
  await saveOwnerDraft({ ...draft, id: otherId, comment: '', selectedText: '' }, image())
  const { drafts } = await readOwnerDrafts()
  const byId = Object.fromEntries(drafts.map((entry) => [entry.id, entry]))
  expect(byId[draft.id]).toMatchObject({ comment: '', selected_text: 'Selected words' })
  expect(byId[otherId].image).toEqual({
    token,
    type: 'image/png',
    size: png.length,
    width: 1,
    height: 1,
  })
  expect(Buffer.from(await byId[otherId].screenshot!.blob.arrayBuffer())).toEqual(png)
})
it('keeps the source image and every annotation tool as editable marks', async () => {
  await saveOwnerDraft({ ...draft, annotations: marks }, image())
  const [read] = (await readOwnerDrafts()).drafts
  expect(read.annotations).toEqual(marks)
  expect(read.screenshot!.token).toBe(token)
  expect(Buffer.from(await read.screenshot!.blob.arrayBuffer())).toEqual(png)
})
it('updates one draft by ID, keeping its creation time and original page context', async () => {
  const first = await saveOwnerDraft(draft, image())
  const put = jest.spyOn(IDBObjectStore.prototype, 'put')
  const second = await saveOwnerDraft({ ...draft, comment: 'Edited', annotations: marks }, image())
  // An unchanged image token rewrites the draft row only, never the stored image.
  expect(put).toHaveBeenCalledTimes(1)
  expect(second.created_at).toBe(first.created_at)
  const { drafts } = await readOwnerDrafts()
  expect(drafts).toHaveLength(1)
  expect(drafts[0]).toMatchObject({ id: draft.id, comment: 'Edited', page_path: draft.pagePath })
  await saveOwnerDraft({ ...draft, comment: 'Edited' }, null)
  expect((await readOwnerDrafts()).drafts[0]).toMatchObject({ image: null, screenshot: null })
})
it('keeps drafts for other testing pages apart and returns the newest first', async () => {
  await saveOwnerDraft(draft)
  await new Promise((resolve) => setTimeout(resolve, 5))
  await saveOwnerDraft({
    ...draft,
    id: otherId,
    hostModuleId: 'ebus-guided',
    moduleId: 'ebus-guided',
    pagePath: '/en/ebus-guided/learn?section=acoustic-contact',
  })
  expect((await readOwnerDrafts()).drafts.map((entry) => entry.host_module_id)).toEqual([
    'ebus-guided',
    'peripheral-imaging',
  ])
})
it('discards exactly one draft and never touches saved reports', async () => {
  const report = await saveOwnerFeedback(
    { ...draft, id: otherId },
    new Blob([png], { type: 'image/png' }),
  )
  await saveOwnerDraft(draft, image())
  await deleteOwnerDraft(draft.id)
  expect((await readOwnerDrafts()).drafts).toEqual([])
  expect(await listOwnerFeedback()).toEqual([report])
  expect(await ownerFeedbackExists(otherId)).toBe(true)
  expect(await ownerFeedbackExists(draft.id)).toBe(false)
})
it('keeps a saved report and a draft distinct, even under one ID', async () => {
  await saveOwnerDraft({ ...draft, comment: 'Draft wording' }, image())
  const report = await saveOwnerFeedback({ ...draft, comment: 'Saved wording' })
  expect(await listOwnerFeedback()).toEqual([report])
  expect((await readOwnerDrafts()).drafts[0]).toMatchObject({
    id: draft.id,
    comment: 'Draft wording',
    record_kind: 'draft',
  })
  await clearOwnerFeedback()
  expect((await readOwnerDrafts()).drafts).toHaveLength(1)
})
it('never includes an unsent draft in an export', async () => {
  await saveOwnerDraft({ ...draft, comment: 'Unsent draft wording' }, image())
  const report = await saveOwnerFeedback({ ...draft, id: otherId, comment: 'Saved report wording' })
  const exported = await exportOwnerFeedback(await listOwnerFeedback(), {})
  const zip = await JSZip.loadAsync(await exported.blob.arrayBuffer())
  const json = await zip.file('feedback.json')!.async('string')
  const markdown = await zip.file('feedback.md')!.async('string')
  expect(JSON.parse(json).records.map((entry: { id: string }) => entry.id)).toEqual([report.id])
  for (const text of [json, markdown]) {
    expect(text).toContain('Saved report wording')
    expect(text).not.toContain('Unsent draft wording')
    expect(text).not.toContain(draft.id)
  }
  expect(Object.keys(zip.files).filter((name) => name.startsWith('screenshots/'))).toEqual([])
})
it('leaves the reports database at its version with existing reports intact', async () => {
  const report = await saveOwnerFeedback(draft, new Blob([png], { type: 'image/png' }))
  await saveOwnerDraft({ ...draft, id: otherId }, image())
  await readOwnerDrafts()
  await deleteOwnerDraft(otherId)
  const names = (await indexedDB.databases()).map((db) => [db.name, db.version])
  expect(names).toEqual(
    expect.arrayContaining([
      [ownerFeedbackDatabase, ownerFeedbackVersion],
      [ownerDraftDatabase, ownerDraftDatabaseVersion],
    ]),
  )
  expect(ownerFeedbackVersion).toBe(1)
  const reports = await raw(ownerFeedbackDatabase, 1)
  expect(Array.from(reports.objectStoreNames)).toEqual(['reports'])
  reports.close()
  const [read] = await listOwnerFeedback()
  expect(read).toEqual(report)
  expect(Buffer.from(await read.screenshot!.blob.arrayBuffer())).toEqual(png)
})
it('does not report a draft kept before an aborted transaction commits; a retry keeps the ID', async () => {
  const put = IDBObjectStore.prototype.put
  jest.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function (
    this: IDBObjectStore,
    ...args
  ) {
    const request = put.apply(this, args)
    this.transaction.abort()
    return request
  })
  await expect(saveOwnerDraft(draft, image())).rejects.toThrow('Local draft storage failed')
  expect((await readOwnerDrafts()).drafts).toEqual([])
  await saveOwnerDraft(draft, image())
  expect((await readOwnerDrafts()).drafts.map((entry) => entry.id)).toEqual([draft.id])
})
it('rejects unsafe pages, unknown modules, stray annotations and bad images before writing', async () => {
  for (const input of [
    { ...draft, pagePath: draft.pagePath + '&token=secret' },
    { ...draft, pagePath: '/en/ebus-guided/learn' },
    { ...draft, hostModuleId: 'unknown-module' },
    { ...draft, id: 'not-a-uuid' },
    { ...draft, comment: 'x'.repeat(10001) },
    { ...draft, annotations: marks },
    { ...draft, annotations: [{ tool: 'stamp', point: { x: 0, y: 0 } }] },
  ])
    await expect(saveOwnerDraft(input)).rejects.toThrow('cannot be kept')
  await expect(
    saveOwnerDraft(
      {
        ...draft,
        annotations: Array.from({ length: maxDraftAnnotations + 1 }, () => marks[0]),
      },
      image(),
    ),
  ).rejects.toThrow('cannot be kept')
  await expect(
    saveOwnerDraft(draft, { blob: new Blob(['<svg/>'], { type: 'image/png' }), token }),
  ).rejects.toThrow('could not be read')
  await expect(
    saveOwnerDraft(draft, {
      blob: new Blob([new Uint8Array(maxScreenshotBytes + 1)], { type: 'image/png' }),
      token,
    }),
  ).rejects.toThrow('3 MB')
  const huge = Buffer.from(png)
  huge.writeUInt32BE(4097, 16)
  await expect(
    saveOwnerDraft(draft, { blob: new Blob([huge], { type: 'image/png' }), token }),
  ).rejects.toThrow('could not be read')
  expect(await indexedDB.databases()).toEqual([])
})
it('reports unsupported and damaged drafts by key without hiding or removing anything', async () => {
  const good = await saveOwnerDraft(draft, image())
  const future = { ...good, id: otherId, image: null, schema_version: 2 }
  await rawPut('drafts', future)
  await rawPut('drafts', { id: 'damaged', comment: 7 })
  const withoutImage = '6f0f6a2e-8f4b-4c1e-9d2a-1b2c3d4e5f60'
  await rawPut('drafts', { ...good, id: withoutImage })
  const first = await readOwnerDrafts()
  expect(first.drafts.map((entry) => entry.id)).toEqual([draft.id])
  expect(first.unreadable.sort()).toEqual([withoutImage, 'damaged', otherId].sort())
  // Reading again changes nothing: the unreadable records are still stored.
  expect((await readOwnerDrafts()).unreadable).toHaveLength(3)
  const db = await raw(ownerDraftDatabase, ownerDraftDatabaseVersion)
  const count = db.transaction('drafts').objectStore('drafts').count()
  await new Promise<void>((resolve) => {
    count.onsuccess = () => resolve()
  })
  expect(count.result).toBe(4)
  db.close()
  // Removal is a separate, explicit owner action and leaves readable drafts alone.
  await deleteUnreadableOwnerDrafts(first.unreadable)
  const after = await readOwnerDrafts()
  expect(after.unreadable).toEqual([])
  expect(after.drafts.map((entry) => entry.id)).toEqual([draft.id])
})
it('reports a draft whose stored image no longer matches its record', async () => {
  await saveOwnerDraft(draft, image())
  await rawPut('images', { id: draft.id, token, blob: new Blob(['<svg/>'], { type: 'image/png' }) })
  expect(await readOwnerDrafts()).toEqual({ drafts: [], unreadable: [draft.id] })
  await rawPut('images', { id: draft.id, token: otherId, blob: image().blob })
  expect(await readOwnerDrafts()).toEqual({ drafts: [], unreadable: [draft.id] })
})
it('refuses a newer draft database without deleting data', async () => {
  await saveOwnerDraft(draft)
  const newer = await raw(ownerDraftDatabase, ownerDraftDatabaseVersion + 1)
  newer.close()
  await expect(readOwnerDrafts()).rejects.toThrow('newer feedback draft database')
  await expect(saveOwnerDraft(draft)).rejects.toThrow('newer feedback draft database')
  const db = await raw(ownerDraftDatabase, ownerDraftDatabaseVersion + 1)
  const count = db.transaction('drafts').objectStore('drafts').count()
  await new Promise<void>((resolve) => {
    count.onsuccess = () => resolve()
  })
  expect(count.result).toBe(1)
  db.close()
})
it('fails explicitly when browser storage is unavailable', async () => {
  // @ts-expect-error simulate a browser without IndexedDB
  delete global.indexedDB
  await expect(saveOwnerDraft(draft)).rejects.toThrow('not kept across reloads')
  await expect(readOwnerDrafts()).rejects.toThrow('not kept across reloads')
})
