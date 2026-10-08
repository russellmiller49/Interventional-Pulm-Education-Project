/** @jest-environment node */
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import JSZip from 'jszip'
import {
  beginOwnerDraftSave,
  deleteOwnerDraft,
  deleteUnreadableOwnerDrafts,
  discardOwnerDraft,
  finalizedOwnerDraftIds,
  finishOwnerDraftSave,
  releaseOwnerDraftSave,
  maxDraftAnnotations,
  ownerDraftDatabase,
  ownerDraftDatabaseVersion,
  ownerDraftSchemaVersion,
  ownerDraftStatus,
  readOwnerDrafts,
  saveOwnerDraft,
  settleOwnerDrafts,
} from './ownerDraftStore'
import {
  clearOwnerFeedback,
  createOwnerFeedback,
  ownerFeedbackContent,
  listOwnerFeedback,
  ownerFeedbackDatabase,
  ownerFeedbackExists,
  ownerFeedbackVersion,
  saveOwnerFeedback,
} from './ownerFeedbackStore'
import { exportOwnerFeedback } from './ownerFeedbackExport'
import { hasReferencedText, isMeaningfulDraft } from './draftContent'
import { submissionFingerprint } from './submissionFingerprint'
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
async function rawPut(
  store: 'drafts' | 'images' | 'finalizations' | 'save_attempts',
  value: unknown,
) {
  const db = await raw(ownerDraftDatabase, ownerDraftDatabaseVersion)
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).put(value)
  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve()
  })
  db.close()
}
// Everything in the draft database, as stored.
async function stored() {
  const db = await raw(ownerDraftDatabase, ownerDraftDatabaseVersion)
  const tx = db.transaction(['drafts', 'images', 'finalizations', 'save_attempts'])
  const rows = (['drafts', 'images', 'finalizations', 'save_attempts'] as const).map((name) =>
    tx.objectStore(name).getAll(),
  )
  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve()
  })
  db.close()
  const [drafts, images, finalizations, attempts] = rows.map((request) => request.result)
  return { drafts, images, finalizations, attempts } as {
    attempts: Array<{ attempt_id: string; draft_id: string; revision: string | null }>
    drafts: Array<{ id: string; comment: string; revision: string; forked_from: string | null }>
    images: Array<{ id: string; token: string; blob: Blob }>
    finalizations: Array<{
      id: string
      outcome: string
      revision: string | null
      fingerprint?: string | null
      fork: { id: string; revision: string } | null
    }>
  }
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
  const { draft: saved, superseded } = await saveOwnerDraft({ ...draft, selectedText: '' })
  expect(superseded).toBeNull()
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
  const { draft: first } = await saveOwnerDraft(draft, image())
  const put = jest.spyOn(IDBObjectStore.prototype, 'put')
  const { draft: second } = await saveOwnerDraft(
    { ...draft, comment: 'Edited', annotations: marks },
    image(),
    first.revision,
  )
  expect(second.revision).not.toBe(first.revision)
  // An unchanged image token rewrites the draft row only, never the stored image.
  expect(put).toHaveBeenCalledTimes(1)
  expect(second.created_at).toBe(first.created_at)
  const { drafts } = await readOwnerDrafts()
  expect(drafts).toHaveLength(1)
  expect(drafts[0]).toMatchObject({ id: draft.id, comment: 'Edited', page_path: draft.pagePath })
  await saveOwnerDraft({ ...draft, comment: 'Edited' }, null, second.revision)
  expect((await readOwnerDrafts()).drafts[0]).toMatchObject({ image: null, screenshot: null })
  expect(await stored()).toMatchObject({ drafts: [{ id: draft.id }], images: [] })
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
  const { draft: good } = await saveOwnerDraft(draft, image())
  const future = { ...good, id: otherId, image: null, schema_version: ownerDraftSchemaVersion + 1 }
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

describe('database upgrade', () => {
  it('opens a version 1 database with its drafts and images intact and unrewritten', async () => {
    const legacy = {
      id: draft.id,
      host_module_id: 'peripheral-imaging',
      module_id: 'peripheral-imaging',
      page_path: draft.pagePath,
      comment: 'Kept from version 1',
      selected_text: 'Selected words',
      annotations: marks,
      image: { token, type: 'image/png', size: png.length, width: 1, height: 1 },
      created_at: '2026-10-02T10:00:00.000Z',
      updated_at: '2026-10-02T10:05:00.000Z',
      storage_mode: 'owner-local',
      record_kind: 'draft',
      schema_version: 1,
    }
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(ownerDraftDatabase, 1)
      open.onupgradeneeded = () => {
        open.result.createObjectStore('drafts', { keyPath: 'id' })
        open.result.createObjectStore('images', { keyPath: 'id' })
      }
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const tx = open.result.transaction(['drafts', 'images'], 'readwrite')
        tx.objectStore('drafts').put(legacy)
        tx.objectStore('images').put({ id: draft.id, ...image() })
        tx.oncomplete = () => {
          open.result.close()
          resolve()
        }
      }
    })
    const { drafts, unreadable } = await readOwnerDrafts()
    expect(unreadable).toEqual([])
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({
      ...legacy,
      schema_version: ownerDraftSchemaVersion,
      forked_from: null,
    })
    expect(Buffer.from(await drafts[0].screenshot!.blob.arrayBuffer())).toEqual(png)
    const db = await raw(ownerDraftDatabase, ownerDraftDatabaseVersion)
    expect(Array.from(db.objectStoreNames)).toEqual([
      'drafts',
      'finalizations',
      'images',
      'save_attempts',
    ])
    db.close()
    // Reading upgraded the database, not the record.
    expect((await stored()).drafts).toEqual([legacy])
    // The next edit continues the same draft, with its creation time and its image.
    const next = await saveOwnerDraft({ ...draft, comment: 'Edited' }, image(), drafts[0].revision)
    expect(next).toMatchObject({
      superseded: null,
      draft: {
        id: draft.id,
        created_at: legacy.created_at,
        schema_version: ownerDraftSchemaVersion,
      },
    })
    expect((await stored()).images.map((entry) => entry.id)).toEqual([draft.id])
  })
})

describe('one draft open in two tabs', () => {
  // Both tabs restored the same stored draft and hold this revision.
  async function shared(withImage = false) {
    const { draft: first } = await saveOwnerDraft(
      { ...draft, comment: 'Shared', annotations: withImage ? marks : [] },
      withImage ? image() : null,
    )
    return first.revision
  }
  const report = (comment = 'Tab A wording') => createOwnerFeedback({ ...draft, comment })
  // The fingerprint of a text-only submission of this draft with the given comment.
  const print = (comment = 'Tab A wording') =>
    submissionFingerprint({
      moduleId: draft.moduleId,
      pagePath: draft.pagePath,
      comment,
      selectedText: draft.selectedText,
    })
  let attempts = 0
  // One tab's Save of the shared draft, up to the point where the report would be written.
  const begin = async (base: string, comment = 'Tab A wording') =>
    beginOwnerDraftSave({
      attemptId: `00000000-0000-4000-8000-${String(++attempts).padStart(12, '0')}`,
      id: draft.id,
      base,
      fingerprint: await print(comment),
    })
  const open = { closed: null, fingerprint: null }
  const orphans = async () => {
    const { drafts, images } = await stored()
    return images.filter((entry) => !drafts.some((row) => row.id === entry.id))
  }

  it('saving in A keeps newer content B had already stored, under a new ID, exactly once', async () => {
    const base = await shared(true)
    const { draft: newer } = await saveOwnerDraft(
      { ...draft, comment: 'Tab B newer', annotations: marks },
      image(),
      base,
    )
    expect(await begin(base)).toEqual(open)
    await report()
    expect(await finishOwnerDraftSave(draft.id, await print())).toEqual({ preserved: true })
    // Finishing again, from any tab, changes nothing.
    expect(await finishOwnerDraftSave(draft.id, await print())).toEqual({ preserved: false })
    const after = await stored()
    expect(after.drafts).toHaveLength(1)
    const [fork] = after.drafts
    expect(fork).toMatchObject({ comment: 'Tab B newer', forked_from: draft.id })
    expect(fork.id).not.toBe(draft.id)
    expect(after.finalizations).toEqual([
      expect.objectContaining({
        id: draft.id,
        outcome: 'saved',
        revision: base,
        fingerprint: await print(),
        fork: { id: fork.id, revision: newer.revision },
      }),
    ])
    const [read] = (await readOwnerDrafts()).drafts
    expect(read.annotations).toEqual(marks)
    expect(read.created_at).toBe(newer.created_at)
    expect(Buffer.from(await read.screenshot!.blob.arrayBuffer())).toEqual(png)
    expect(await orphans()).toEqual([])
    // B learns where its work went, and its next edit continues that draft: no second copy.
    expect(await ownerDraftStatus(draft.id, newer.revision)).toEqual({
      closed: 'saved',
      keptAs: fork.id,
    })
    const again = await saveOwnerDraft(
      { ...draft, comment: 'Tab B newer still' },
      image(),
      newer.revision,
    )
    expect(again).toMatchObject({ superseded: 'saved', draft: { id: fork.id } })
    expect((await stored()).drafts.map((row) => [row.id, row.comment])).toEqual([
      [fork.id, 'Tab B newer still'],
    ])
    // Nothing a report's existence implies removes it.
    await settleOwnerDrafts(ownerFeedbackContent)
    expect(await finalizedOwnerDraftIds(ownerFeedbackContent)).toEqual(new Set())
    expect((await readOwnerDrafts()).drafts.map((row) => row.comment)).toEqual([
      'Tab B newer still',
    ])
    expect((await listOwnerFeedback()).map((entry) => entry.comment)).toEqual(['Tab A wording'])
  })

  it('an edit in B after A saved never recreates the saved ID', async () => {
    const base = await shared()
    await begin(base)
    await report()
    expect(await finishOwnerDraftSave(draft.id, await print())).toEqual({ preserved: false })
    expect(await stored()).toMatchObject({ drafts: [], attempts: [] })
    const late = await saveOwnerDraft(
      { ...draft, comment: 'Tab B later', createdAt: '2026-10-01T09:00:00.000Z' },
      null,
      base,
    )
    expect(late.superseded).toBe('saved')
    expect(late.draft).toMatchObject({
      forked_from: draft.id,
      created_at: '2026-10-01T09:00:00.000Z',
      page_path: draft.pagePath,
      module_id: 'peripheral-imaging',
    })
    expect(late.draft.id).not.toBe(draft.id)
    await settleOwnerDrafts(ownerFeedbackContent)
    expect((await readOwnerDrafts()).drafts.map((row) => row.id)).toEqual([late.draft.id])
    // A tab still holding the closed ID cannot save over the report either.
    expect(await begin(base, 'Tab B later')).toEqual({
      closed: 'saved',
      fingerprint: await print(),
    })
    expect((await stored()).attempts).toEqual([])
  })

  it('discarding in A keeps newer content B had already stored and closes the ID', async () => {
    const base = await shared(true)
    const { draft: newer } = await saveOwnerDraft(
      { ...draft, comment: 'Tab B newer' },
      image(),
      base,
    )
    expect(await discardOwnerDraft(draft.id, base)).toEqual({ preserved: true })
    const after = await stored()
    expect(after.drafts.map((row) => row.comment)).toEqual(['Tab B newer'])
    expect(after.drafts[0].id).not.toBe(draft.id)
    expect(after.finalizations[0]).toMatchObject({ id: draft.id, outcome: 'discarded' })
    expect(await orphans()).toEqual([])
    // B discarding its own copy afterwards removes that copy and nothing else.
    expect(await discardOwnerDraft(draft.id, newer.revision)).toEqual({ preserved: false })
    expect(await stored()).toMatchObject({ drafts: [], images: [] })
  })

  it('an edit in B after A discarded goes to a new ID, never the discarded one', async () => {
    const base = await shared()
    expect(await discardOwnerDraft(draft.id, base)).toEqual({ preserved: false })
    const late = await saveOwnerDraft({ ...draft, comment: 'Tab B later' }, null, base)
    expect(late.superseded).toBe('discarded')
    expect(late.draft.id).not.toBe(draft.id)
    const again = await saveOwnerDraft({ ...draft, comment: 'Tab B later 2' }, null, base)
    expect(again.draft.id).not.toBe(draft.id)
    expect((await stored()).drafts.some((row) => row.id === draft.id)).toBe(false)
    // An emptied draft removes only its own revision.
    await deleteOwnerDraft(late.draft.id, 'not-this-revision')
    expect((await stored()).drafts).toHaveLength(2)
    await deleteOwnerDraft(late.draft.id, late.draft.revision)
    expect((await stored()).drafts.map((row) => row.id)).toEqual([again.draft.id])
  })

  it('leaves no phantom draft when the other tab changed nothing', async () => {
    for (const finalize of [
      async (base: string) => {
        await begin(base)
        await report()
        await finishOwnerDraftSave(draft.id, await print())
      },
      (base: string) => discardOwnerDraft(draft.id, base),
    ]) {
      global.indexedDB = new IDBFactory()
      const base = await shared(true)
      await finalize(base)
      expect(await stored()).toMatchObject({ drafts: [], images: [] })
      expect(await ownerDraftStatus(draft.id, base)).toMatchObject({ keptAs: null })
      await settleOwnerDrafts(ownerFeedbackContent)
      expect((await readOwnerDrafts()).drafts).toEqual([])
    }
  })

  it('keeps both versions when two tabs edit before either finalizes', async () => {
    const base = await shared()
    const b = await saveOwnerDraft({ ...draft, comment: 'Tab B edit' }, null, base)
    const a = await saveOwnerDraft({ ...draft, comment: 'Tab A edit' }, null, base)
    expect(b.superseded).toBeNull()
    expect(a.superseded).toBe('edited')
    expect(a.draft.forked_from).toBe(draft.id)
    expect((await stored()).drafts.map((row) => [row.id === draft.id, row.comment]).sort()).toEqual(
      [
        [false, 'Tab A edit'],
        [true, 'Tab B edit'],
      ],
    )
    expect((await stored()).finalizations).toEqual([])
  })

  it('does not treat a report with the same ID as proof that a draft was saved', async () => {
    const { created } = await createOwnerFeedback({ ...draft, comment: 'Tab A wording' })
    expect(created).toBe(true)
    // A draft from the version without finalization records, holding different wording.
    await saveOwnerDraft({ ...draft, comment: 'Different unsent wording' })
    expect(await finalizedOwnerDraftIds(ownerFeedbackContent)).toEqual(new Set())
    await settleOwnerDrafts(ownerFeedbackContent)
    const { drafts } = await readOwnerDrafts()
    expect(drafts.map((row) => row.comment)).toEqual(['Different unsent wording'])
    expect(drafts[0].id).not.toBe(draft.id)
    expect((await stored()).finalizations[0]).toMatchObject({ id: draft.id, outcome: 'saved' })
    // The same text with nothing else attached is the saved content, and is cleared.
    await saveOwnerDraft({ ...draft, id: otherId, comment: 'Same wording' })
    await saveOwnerFeedback({ ...draft, id: otherId, comment: 'Same wording' })
    expect(await finalizedOwnerDraftIds(ownerFeedbackContent)).toEqual(new Set([otherId]))
    await settleOwnerDrafts(ownerFeedbackContent)
    expect((await readOwnerDrafts()).drafts.map((row) => row.comment)).toEqual([
      'Different unsent wording',
    ])
  })

  it('finishes a save that was interrupted after its report committed', async () => {
    const base = await shared(true)
    await begin(base)
    // Not committed yet: the draft is still an ordinary unsent draft, whatever was attempted.
    await settleOwnerDrafts(ownerFeedbackContent)
    expect(await finalizedOwnerDraftIds(ownerFeedbackContent)).toEqual(new Set())
    expect((await readOwnerDrafts()).drafts.map((row) => row.id)).toEqual([draft.id])
    await report()
    expect(await finalizedOwnerDraftIds(ownerFeedbackContent)).toEqual(new Set([draft.id]))
    await settleOwnerDrafts(ownerFeedbackContent)
    expect(await stored()).toMatchObject({
      drafts: [],
      images: [],
      attempts: [],
      finalizations: [{ id: draft.id, outcome: 'saved', revision: base }],
    })
  })

  it('a failed save withdraws only its own attempt and leaves the draft as it was', async () => {
    const base = await shared()
    await begin(base)
    await begin(base, 'Another tab')
    const [first, second] = (await stored()).attempts.map((entry) => entry.attempt_id).sort()
    await releaseOwnerDraftSave(first)
    expect((await stored()).attempts.map((entry) => entry.attempt_id)).toEqual([second])
    expect((await readOwnerDrafts()).drafts.map((row) => row.id)).toEqual([draft.id])
  })
})

describe('two tabs saving the same draft', () => {
  const comments = async () => ({
    reports: (await listOwnerFeedback()).map((entry) => entry.comment),
    drafts: (await stored()).drafts.map((row) => row.comment).sort(),
  })
  const fingerprint = (comment: string) =>
    submissionFingerprint({
      moduleId: draft.moduleId,
      pagePath: draft.pagePath,
      comment,
      selectedText: draft.selectedText,
    })
  let attempts = 0
  const begin = async (base: string, comment: string) =>
    beginOwnerDraftSave({
      attemptId: `10000000-0000-4000-8000-${String(++attempts).padStart(12, '0')}`,
      id: draft.id,
      base,
      fingerprint: await fingerprint(comment),
    })
  // A stored the draft as R1; B then stored its own, different R2 over it.
  async function diverged() {
    const { draft: a } = await saveOwnerDraft({ ...draft, comment: 'A wording' }, image())
    const { draft: b } = await saveOwnerDraft(
      { ...draft, comment: 'B wording', annotations: marks },
      image(),
      a.revision,
    )
    return { r1: a.revision, r2: b.revision }
  }
  const save = (comment: string) => createOwnerFeedback({ ...draft, comment })

  it('S1: both begin, A’s report wins, the browser stops: recovery keeps B once', async () => {
    const { r1, r2 } = await diverged()
    await begin(r1, 'A wording')
    // B's attempt is a second record. It does not replace A's.
    await begin(r2, 'B wording')
    expect((await stored()).attempts.map((entry) => entry.revision).sort()).toEqual([r1, r2].sort())
    expect((await save('A wording')).created).toBe(true)
    // Nothing else ran. Every later load must reach the same state.
    expect(await finalizedOwnerDraftIds(ownerFeedbackContent)).toEqual(new Set())
    for (let load = 0; load < 3; load++) {
      await settleOwnerDrafts(ownerFeedbackContent)
      expect(await comments()).toEqual({ reports: ['A wording'], drafts: ['B wording'] })
    }
    const after = await stored()
    expect(after.drafts[0]).toMatchObject({ forked_from: draft.id, revision: r2 })
    expect(after.drafts[0].id).not.toBe(draft.id)
    expect(after.images.map((entry) => entry.id)).toEqual([after.drafts[0].id])
    expect(after.attempts).toEqual([])
    expect(after.finalizations).toEqual([
      expect.objectContaining({
        id: draft.id,
        outcome: 'saved',
        fingerprint: await fingerprint('A wording'),
      }),
    ])
    const [read] = (await readOwnerDrafts()).drafts
    expect(read.annotations).toEqual(marks)
  })

  it('S1 mirrored: the same records with B’s report winning remove B and keep nothing extra', async () => {
    const { r1, r2 } = await diverged()
    await begin(r1, 'A wording')
    await begin(r2, 'B wording')
    expect((await save('B wording')).created).toBe(true)
    expect(await finalizedOwnerDraftIds(ownerFeedbackContent)).toEqual(new Set([draft.id]))
    await settleOwnerDrafts(ownerFeedbackContent)
    expect(await comments()).toEqual({ reports: ['B wording'], drafts: [] })
    expect((await stored()).images).toEqual([])
  })

  it('S2: the losing save finishes first, the winner later: B is kept exactly once', async () => {
    const { r1, r2 } = await diverged()
    await begin(r1, 'A wording')
    await begin(r2, 'B wording')
    expect((await save('A wording')).created).toBe(true)
    const lost = await save('B wording')
    expect(lost.created).toBe(false)
    // B finishes with what the report actually holds.
    const held = await fingerprint(lost.entry.comment)
    expect(await finishOwnerDraftSave(draft.id, held)).toEqual({ preserved: true })
    // B's own follow-up finds its stored version already kept and continues it.
    const status = await ownerDraftStatus(draft.id, r2)
    expect(status).toMatchObject({ closed: 'saved' })
    expect(status.keptAs).not.toBeNull()
    // A finishes afterwards, then everything is settled again on two more loads.
    expect(await finishOwnerDraftSave(draft.id, held)).toEqual({ preserved: false })
    for (let load = 0; load < 2; load++) await settleOwnerDrafts(ownerFeedbackContent)
    expect(await comments()).toEqual({ reports: ['A wording'], drafts: ['B wording'] })
    const after = await stored()
    expect(after.drafts.map((row) => row.id)).toEqual([status.keptAs])
    expect(after.images.map((entry) => entry.id)).toEqual([status.keptAs])
    // B writing again from its stale state still lands on that one draft.
    const again = await saveOwnerDraft({ ...draft, comment: 'B wording 2' }, image(), r2)
    expect(again.draft.id).toBe(status.keptAs)
    expect((await stored()).drafts).toHaveLength(1)
  })

  it('S5: identical submissions from two tabs give one report and no draft', async () => {
    const { draft: only } = await saveOwnerDraft({ ...draft, comment: 'Same wording' })
    await begin(only.revision, 'Same wording')
    await begin(only.revision, 'Same wording')
    expect((await save('Same wording')).created).toBe(true)
    expect((await save('Same wording')).created).toBe(false)
    const held = await fingerprint('Same wording')
    expect(await finishOwnerDraftSave(draft.id, held)).toEqual({ preserved: false })
    expect(await finishOwnerDraftSave(draft.id, held)).toEqual({ preserved: false })
    expect(await comments()).toEqual({ reports: ['Same wording'], drafts: [] })
  })

  it('never names a winner from the last attempt written or from record order', async () => {
    for (const order of [
      ['A wording', 'B wording'],
      ['B wording', 'A wording'],
    ]) {
      global.indexedDB = new IDBFactory()
      const { r1, r2 } = await diverged()
      for (const comment of order) await begin(comment === 'A wording' ? r1 : r2, comment)
      await save('A wording')
      await settleOwnerDrafts(ownerFeedbackContent)
      expect(await comments()).toEqual({ reports: ['A wording'], drafts: ['B wording'] })
    }
  })

  it('keeps the stored draft when no attempt sent what the report holds', async () => {
    const { r2 } = await diverged()
    // Only B's attempt is on record, yet the report holds A's wording.
    await begin(r2, 'B wording')
    await save('A wording')
    await settleOwnerDrafts(ownerFeedbackContent)
    expect(await comments()).toEqual({ reports: ['A wording'], drafts: ['B wording'] })
  })
})

describe('upgrade from database version 2', () => {
  it('keeps drafts, images and finalizations, and no longer trusts a `saving` mark', async () => {
    const good = {
      id: draft.id,
      host_module_id: 'peripheral-imaging',
      module_id: 'peripheral-imaging',
      page_path: draft.pagePath,
      comment: 'Newer unsent wording',
      selected_text: '',
      annotations: marks,
      image: { token, type: 'image/png', size: png.length, width: 1, height: 1 },
      created_at: '2026-10-02T10:00:00.000Z',
      updated_at: '2026-10-02T10:05:00.000Z',
      storage_mode: 'owner-local',
      record_kind: 'draft',
      revision: 'r2',
      forked_from: null,
      schema_version: 2,
    }
    const closed = {
      id: otherId,
      outcome: 'discarded',
      revision: 'r0',
      at: '2026-10-02T09:00:00.000Z',
      fork: null,
    }
    // Version 2's replaceable mark, left naming this very revision.
    const saving = {
      id: draft.id,
      outcome: 'saving',
      revision: 'r2',
      at: '2026-10-02T10:06:00.000Z',
      fork: null,
    }
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(ownerDraftDatabase, 2)
      open.onupgradeneeded = () => {
        for (const name of ['drafts', 'images', 'finalizations'])
          open.result.createObjectStore(name, { keyPath: 'id' })
      }
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const tx = open.result.transaction(['drafts', 'images', 'finalizations'], 'readwrite')
        tx.objectStore('drafts').put(good)
        tx.objectStore('images').put({ id: draft.id, ...image() })
        tx.objectStore('finalizations').put(closed)
        tx.objectStore('finalizations').put(saving)
        tx.oncomplete = () => {
          open.result.close()
          resolve()
        }
      }
    })
    const { drafts, unreadable } = await readOwnerDrafts()
    expect(unreadable).toEqual([])
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject(good)
    expect(Buffer.from(await drafts[0].screenshot!.blob.arrayBuffer())).toEqual(png)
    const after = await stored()
    expect(after.drafts).toEqual([good])
    expect(after.finalizations).toEqual(expect.arrayContaining([closed, saving]))
    expect(after.attempts).toEqual([])
    // The closed ID is still closed.
    const late = await saveOwnerDraft({ ...draft, id: otherId, comment: 'Stale tab' }, null, 'r0')
    expect(late.superseded).toBe('discarded')
    // A report with different content exists under the draft's ID. The old mark said "r2 was
    // saved"; that is not evidence, so the draft is kept.
    await saveOwnerFeedback({ ...draft, comment: 'Older saved wording' })
    expect(await finalizedOwnerDraftIds(ownerFeedbackContent)).toEqual(new Set())
    await settleOwnerDrafts(ownerFeedbackContent)
    const kept = (await readOwnerDrafts()).drafts.filter((row) => row.forked_from === draft.id)
    expect(kept.map((row) => row.comment)).toEqual(['Newer unsent wording'])
    expect(Buffer.from(await kept[0].screenshot!.blob.arrayBuffer())).toEqual(png)
  })
})
