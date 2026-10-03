import { z } from 'zod'
import { betaModuleById } from './catalog'
import {
  feedbackPagePathSchema,
  isFeedbackPageContext,
  isPngScreenshot,
  maxScreenshotBytes,
} from './schema'

// Unsent owner drafts live apart from saved reports. The reports database keeps its version, so
// adding drafts never upgrades, rewrites, or locks older builds out of existing reports.
//
// Two tabs can hold the same draft. Every stored draft carries a `revision` that changes on each
// write, and every draft ID that has been saved or discarded keeps a durable `finalizations`
// record. A tab writes under an ID only while that ID is open and still at the revision the tab
// last saw; otherwise its content is kept under a fresh ID instead of overwriting, reviving, or
// being dropped. Version 1 of this database had no revisions and no finalizations store.
export const ownerDraftDatabase = 'module-owner-feedback-drafts'
export const ownerDraftDatabaseVersion = 2
export const ownerDraftSchemaVersion = 2
export const maxDraftAnnotations = 500
export const maxDraftStrokePoints = 20000
const draftStore = 'drafts'
const imageStore = 'images'
const finalizationStore = 'finalizations'
// The revision every tab sees for a record written before revisions existed.
const legacyRevision = 'v1'

const coordinate = z.number().finite().min(0).max(4096)
const point = z.object({ x: coordinate, y: coordinate }).strict()
const annotationSchema = z.discriminatedUnion('tool', [
  z.object({ tool: z.literal('box'), start: point, end: point }).strict(),
  z.object({ tool: z.literal('arrow'), start: point, end: point }).strict(),
  z
    .object({ tool: z.literal('draw'), points: z.array(point).min(1).max(maxDraftStrokePoints) })
    .strict(),
  z.object({ tool: z.literal('text'), point, text: z.string().min(1).max(80) }).strict(),
])
const dimension = z.number().int().positive().max(4096)
const draftFields = {
  id: z.string().uuid(),
  // The testing page that owns the draft, and the module/page the report is about.
  host_module_id: z.string().min(1).max(100),
  module_id: z.string().min(1).max(100),
  page_path: feedbackPagePathSchema,
  comment: z.string().max(10000),
  selected_text: z.string().max(3000),
  annotations: z.array(annotationSchema).max(maxDraftAnnotations),
  image: z
    .object({
      token: z.string().uuid(),
      type: z.literal('image/png'),
      size: z.number().int().positive().max(maxScreenshotBytes),
      width: dimension,
      height: dimension,
    })
    .strict()
    .nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  storage_mode: z.literal('owner-local'),
  record_kind: z.literal('draft'),
}
const validDraft = (draft: {
  host_module_id: string
  module_id: string
  page_path: string
  image: unknown
  annotations: unknown[]
}) =>
  Boolean(betaModuleById(draft.host_module_id)) &&
  isFeedbackPageContext(draft.module_id, draft.page_path) &&
  (draft.image !== null || draft.annotations.length === 0)
const storedDraftSchema = z
  .object({
    ...draftFields,
    revision: z.string().min(1).max(100),
    // The finalized or concurrently edited draft this content was kept apart from, if any.
    forked_from: z.string().uuid().nullable(),
    schema_version: z.literal(ownerDraftSchemaVersion),
  })
  .strict()
  .refine(validDraft)
const legacyDraftSchema = z
  .object({ ...draftFields, schema_version: z.literal(1) })
  .strict()
  .refine(validDraft)
type StoredDraft = z.infer<typeof storedDraftSchema>
const storedImageSchema = z
  .object({
    id: z.string().uuid(),
    token: z.string().uuid(),
    blob: z.custom<Blob>((value) => value instanceof Blob),
  })
  .strict()
const finalizationSchema = z
  .object({
    id: z.string(),
    // `saving` is a save that has been started; `saved` and `discarded` close the ID for good.
    outcome: z.enum(['saving', 'saved', 'discarded']),
    // The stored revision that the save or discard covered; null when none is known.
    revision: z.string().nullable(),
    at: z.string(),
    // Where a different stored revision was moved when this ID was closed.
    fork: z.object({ id: z.string().uuid(), revision: z.string() }).nullable(),
  })
  .strict()
type Finalization = z.infer<typeof finalizationSchema>
type Closed = Finalization & { outcome: 'saved' | 'discarded' }

// `screenshot` is the unannotated source image; `annotations` stay editable marks over it.
export type OwnerFeedbackDraft = StoredDraft & { screenshot: { blob: Blob; token: string } | null }
export type OwnerDraftInput = {
  id: string
  hostModuleId: string
  moduleId: string
  pagePath: string
  comment: string
  selectedText: string
  annotations: unknown[]
  // When the tab first kept this draft, for content that has to move to a fresh ID.
  createdAt?: string
}
// Why content was kept under a different ID than the one it was written for.
export type OwnerDraftSupersededBy = 'saved' | 'discarded' | 'edited'
// What a saved report holds, for drafts left by a version that had no finalization records.
export type OwnerReportLookup = (id: string) => Promise<{
  module_id: unknown
  page_path: unknown
  comment: unknown
  selected_text: unknown
  hasScreenshot: boolean
} | null>

function parseDraft(value: unknown): StoredDraft | null {
  const current = storedDraftSchema.safeParse(value)
  if (current.success) return current.data
  const legacy = legacyDraftSchema.safeParse(value)
  return legacy.success
    ? {
        ...legacy.data,
        revision: legacyRevision,
        forked_from: null,
        schema_version: ownerDraftSchemaVersion,
      }
    : null
}
const field = (value: unknown, key: string) =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined
function revisionOf(raw: unknown) {
  const revision = field(raw, 'revision')
  return typeof revision === 'string' ? revision : legacyRevision
}
function readFinalization(raw: unknown): Finalization | null {
  if (raw === undefined) return null
  const parsed = finalizationSchema.safeParse(raw)
  // A record this version cannot read still closes its ID: never write under it again.
  return parsed.success
    ? parsed.data
    : { id: String(field(raw, 'id')), outcome: 'saved', revision: null, at: '', fork: null }
}
const isClosed = (entry: Finalization | null): entry is Closed =>
  entry !== null && entry.outcome !== 'saving'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Browser storage is unavailable, so this draft is not kept across reloads.'))
      return
    }
    const request = indexedDB.open(ownerDraftDatabase, ownerDraftDatabaseVersion)
    let blocked = false
    request.onupgradeneeded = (event) => {
      // Migrations only add stores. Existing drafts and images are never rewritten or reset;
      // version 1 records are read as they are.
      if (event.oldVersion < 1) {
        request.result.createObjectStore(draftStore, { keyPath: 'id' })
        request.result.createObjectStore(imageStore, { keyPath: 'id' })
      }
      if (event.oldVersion < 2)
        request.result.createObjectStore(finalizationStore, { keyPath: 'id' })
    }
    request.onblocked = () => {
      blocked = true
      reject(new Error('Close other tabs using owner feedback, then retry. No data was removed.'))
    }
    request.onerror = () =>
      reject(
        new Error(
          request.error?.name === 'VersionError'
            ? 'This browser has a newer feedback draft database. Open the newer app version; no data was removed.'
            : 'Local draft storage could not be opened, so this draft is not kept across reloads.',
        ),
      )
    request.onsuccess = () => {
      if (blocked) {
        request.result.close()
        return
      }
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
  })
}

type Stores = { drafts: IDBObjectStore; images: IDBObjectStore; finalizations: IDBObjectStore }
// Awaiting only these keeps the transaction active between steps.
const result = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

// One transaction over drafts, their images and the finalization records. Resolves only after
// commit, including quota/abort failures that occur after a request succeeds.
async function transaction<T>(
  mode: IDBTransactionMode,
  work: (stores: Stores) => Promise<T>,
): Promise<T> {
  const db = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction
    let value: T
    try {
      tx = db.transaction([draftStore, imageStore, finalizationStore], mode)
    } catch (error) {
      db.close()
      reject(error)
      return
    }
    tx.oncomplete = () => {
      db.close()
      resolve(value)
    }
    tx.onabort = () => {
      db.close()
      reject(
        new Error(
          'Local draft storage failed; it may be full or disabled. An open draft stays here until you reload.',
        ),
      )
    }
    // Nothing here fails on purpose: any error is storage failing, and the whole step is undone.
    const fail = () => {
      try {
        tx.abort()
      } catch {}
    }
    try {
      work({
        drafts: tx.objectStore(draftStore),
        images: tx.objectStore(imageStore),
        finalizations: tx.objectStore(finalizationStore),
      }).then((done) => {
        value = done
      }, fail)
    } catch {
      fail()
    }
  })
}

// Keeps a stored draft, image included, under a fresh ID. Its revision is unchanged, so the tab
// that wrote it can find it again instead of keeping a second copy.
async function moveDraft(stores: Stores, id: string, raw: unknown) {
  const fork = crypto.randomUUID()
  const image = await result(stores.images.get(id))
  const upgraded =
    field(raw, 'schema_version') === 1
      ? { ...(raw as object), revision: legacyRevision, schema_version: ownerDraftSchemaVersion }
      : (raw as object)
  stores.drafts.put({ ...upgraded, id: fork, forked_from: id })
  if (image !== undefined) stores.images.put({ ...image, id: fork })
  stores.drafts.delete(id)
  stores.images.delete(id)
  return { id: fork, revision: revisionOf(raw) }
}

// Closes an ID for good. A stored draft at `revision` is what was saved or discarded and is
// removed; any other stored revision is newer unsent work from another tab and is moved.
async function closeDraftId(
  stores: Stores,
  id: string,
  outcome: Closed['outcome'],
  revision: string | null,
) {
  const prior = readFinalization(await result(stores.finalizations.get(id)))
  const raw = await result(stores.drafts.get(id))
  let fork = prior?.fork ?? null
  let moved = false
  if (raw !== undefined) {
    if (revision !== null && revisionOf(raw) === revision) {
      stores.drafts.delete(id)
      stores.images.delete(id)
    } else {
      fork = await moveDraft(stores, id, raw)
      moved = true
    }
  }
  stores.finalizations.put({ id, outcome, revision, at: new Date().toISOString(), fork })
  return { moved }
}

// Where the content a tab holds as `id` at revision `base` is stored now: under `id` while that
// ID is open, under the fork that closing it made of that same revision, or nowhere.
async function locate(stores: Stores, id: string, base: string) {
  const entry = readFinalization(await result(stores.finalizations.get(id)))
  if (!isClosed(entry))
    return { id, closed: null, raw: (await result(stores.drafts.get(id))) as unknown }
  if (base && entry.fork?.revision === base) {
    const raw: unknown = await result(stores.drafts.get(entry.fork.id))
    const fork = readFinalization(await result(stores.finalizations.get(entry.fork.id)))
    if (raw !== undefined && revisionOf(raw) === base && !isClosed(fork))
      return { id: entry.fork.id, closed: entry.outcome, raw }
  }
  return { id: null, closed: entry.outcome, raw: undefined }
}

async function pngDimensions(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (!isPngScreenshot(bytes)) return null
  const header = new DataView(bytes.buffer)
  return { width: header.getUint32(16), height: header.getUint32(20) }
}

/**
 * Keep an unsent draft. `image` is the unannotated source PNG; its `token` changes only when the
 * owner replaces the image, so text and annotation edits do not rewrite the stored image.
 *
 * `base` is the stored revision this tab last read or wrote ('' when it has stored nothing). The
 * draft is written under its own ID only if that ID is still open and still at `base`. If
 * another tab saved, discarded, or rewrote it, this content is kept under a different ID and
 * `superseded` says why; the returned draft carries the ID and revision to continue from.
 */
export async function saveOwnerDraft(
  input: OwnerDraftInput,
  image?: { blob: Blob; token: string } | null,
  base = '',
) {
  let meta: StoredDraft['image'] = null
  if (image) {
    if (image.blob.type !== 'image/png' || image.blob.size > maxScreenshotBytes)
      throw new Error('Only a PNG screenshot up to 3 MB can be kept in a draft.')
    const size = await pngDimensions(image.blob)
    if (!size) throw new Error('The draft screenshot could not be read.')
    meta = { token: image.token, type: 'image/png', size: image.blob.size, ...size }
  }
  const now = new Date().toISOString()
  const started = z.string().datetime().safeParse(input.createdAt)
  const parsed = storedDraftSchema.safeParse({
    id: input.id,
    host_module_id: input.hostModuleId,
    module_id: input.moduleId,
    page_path: input.pagePath,
    comment: input.comment,
    selected_text: input.selectedText,
    annotations: input.annotations,
    image: meta,
    created_at: started.success ? started.data : now,
    updated_at: now,
    storage_mode: 'owner-local',
    record_kind: 'draft',
    revision: crypto.randomUUID(),
    forked_from: null,
    schema_version: ownerDraftSchemaVersion,
  })
  if (!parsed.success)
    throw new Error('This draft cannot be kept on this browser in its current form.')
  const record = parsed.data
  return transaction<{ draft: StoredDraft; superseded: OwnerDraftSupersededBy | null }>(
    'readwrite',
    async (stores) => {
      const found = await locate(stores, record.id, base)
      let superseded: OwnerDraftSupersededBy | null = found.closed
      let target = found.id
      let existing = found.raw
      if (target && existing !== undefined && revisionOf(existing) !== base) {
        // Another tab rewrote this draft; its version stays where it is.
        superseded = 'edited'
        target = null
      }
      if (!target) {
        target = crypto.randomUUID()
        existing = undefined
      }
      const created = z.string().datetime().safeParse(field(existing, 'created_at'))
      const origin = z.string().uuid().safeParse(field(existing, 'forked_from'))
      const draft = {
        ...record,
        id: target,
        created_at: created.success ? created.data : record.created_at,
        forked_from: origin.success ? origin.data : target === record.id ? null : record.id,
      }
      const storedImage = await result(stores.images.get(target))
      stores.drafts.put(draft)
      if (!image) stores.images.delete(target)
      else if (field(storedImage, 'token') !== image.token)
        stores.images.put({ id: target, token: image.token, blob: image.blob })
      return { draft, superseded }
    },
  )
}

/**
 * Every stored draft, newest first. Records this version cannot read are reported by key rather
 * than hidden, replaced, or removed.
 */
export async function readOwnerDrafts() {
  const rows = await transaction('readonly', async (stores) => {
    const keys = stores.drafts.getAllKeys()
    const drafts = stores.drafts.getAll()
    const images = await result(stores.images.getAll())
    return { keys: keys.result, drafts: drafts.result as unknown[], images: images as unknown[] }
  })
  const drafts: OwnerFeedbackDraft[] = []
  const unreadable: IDBValidKey[] = []
  for (const [index, value] of rows.drafts.entries()) {
    const draft = parseDraft(value)
    if (!draft) {
      unreadable.push(rows.keys[index])
      continue
    }
    if (!draft.image) {
      drafts.push({ ...draft, screenshot: null })
      continue
    }
    const stored = storedImageSchema.safeParse(
      rows.images.find((entry) => field(entry, 'id') === draft.id),
    )
    const size =
      stored.success &&
      stored.data.token === draft.image.token &&
      stored.data.blob.type === 'image/png' &&
      stored.data.blob.size === draft.image.size
        ? await pngDimensions(stored.data.blob)
        : null
    if (
      !stored.success ||
      size?.width !== draft.image.width ||
      size?.height !== draft.image.height
    ) {
      unreadable.push(rows.keys[index])
      continue
    }
    drafts.push({ ...draft, screenshot: { blob: stored.data.blob, token: stored.data.token } })
  }
  drafts.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))
  return { drafts, unreadable }
}

/**
 * Removes a draft whose content this tab emptied, without closing its ID. Given `base`, only the
 * tab's own revision is removed: a version another tab stored since is left alone.
 */
export function deleteOwnerDraft(id: string, base?: string) {
  return transaction<void>('readwrite', async (stores) => {
    let target: string | null = id
    if (base !== undefined) {
      const found = await locate(stores, id, base)
      target = found.raw !== undefined && revisionOf(found.raw) === base ? found.id : null
    }
    if (!target) return
    stores.drafts.delete(target)
    stores.images.delete(target)
  })
}

/**
 * Discard: closes the ID so no tab can store under it again. Returns whether a newer version that
 * another tab had stored was kept under a fresh ID.
 */
export function discardOwnerDraft(id: string, base: string) {
  return transaction<{ preserved: boolean }>('readwrite', async (stores) => {
    const found = await locate(stores, id, base)
    // Already closed elsewhere: only this tab's own kept copy, if any, is left to discard.
    if (found.closed) {
      if (found.id) await closeDraftId(stores, found.id, 'discarded', base)
      return { preserved: false }
    }
    return { preserved: (await closeDraftId(stores, id, 'discarded', base || null)).moved }
  })
}

/**
 * First step of Save, before the report is written. Records which stored revision the save
 * covers, so a save interrupted after the report commits can still be finished correctly.
 * Reports an ID that another tab already closed instead of saving over it.
 */
export function beginOwnerDraftSave(id: string, base: string) {
  return transaction<{ closed: Closed['outcome'] | null }>('readwrite', async (stores) => {
    const entry = readFinalization(await result(stores.finalizations.get(id)))
    if (isClosed(entry)) return { closed: entry.outcome }
    stores.finalizations.put({
      id,
      outcome: 'saving',
      revision: base || null,
      at: new Date().toISOString(),
      fork: null,
    })
    return { closed: null }
  })
}

/**
 * Last step of Save, after the report transaction. `created` is whether this tab's save wrote
 * the report. If it did, the ID is closed as saved: the covered revision is removed and a newer
 * one from another tab is kept under a fresh ID (`preserved`). If the report already existed,
 * this tab's content is not in it; the ID is closed and `closed` tells the tab to keep its work.
 */
export function finishOwnerDraftSave(id: string, base: string, created: boolean) {
  return transaction<{ closed: Closed['outcome'] | null; preserved: boolean }>(
    'readwrite',
    async (stores) => {
      if (created)
        return {
          closed: null,
          preserved: (await closeDraftId(stores, id, 'saved', base || null)).moved,
        }
      const entry = readFinalization(await result(stores.finalizations.get(id)))
      if (isClosed(entry)) return { closed: entry.outcome, preserved: false }
      stores.finalizations.put({
        id,
        outcome: 'saved',
        revision: null,
        at: new Date().toISOString(),
        fork: null,
      })
      return { closed: 'saved', preserved: false }
    },
  )
}

/**
 * Whether another tab closed this draft, and if so the ID under which this tab's stored revision
 * was kept (null when the closed draft was not newer than what was saved or discarded).
 */
export function ownerDraftStatus(id: string, base: string) {
  return transaction<{ closed: Closed['outcome'] | null; keptAs: string | null }>(
    'readonly',
    async (stores) => {
      const found = await locate(stores, id, base)
      return { closed: found.closed, keptAs: found.closed ? found.id : null }
    },
  )
}

type Settlement = {
  id: string
  seen: string
  marker: string
  outcome: Closed['outcome']
  revision: string | null
}
const text = (value: unknown) => (typeof value === 'string' ? value : '')

// Stored drafts whose ID is closed, or whose report committed before the save could finish.
async function unsettledOwnerDrafts(report: OwnerReportLookup) {
  const rows = await transaction('readonly', async (stores) => {
    const drafts = stores.drafts.getAll()
    const entries = await result(stores.finalizations.getAll())
    return { drafts: drafts.result as unknown[], entries: entries as unknown[] }
  })
  const settlements: Settlement[] = []
  for (const raw of rows.drafts) {
    const id = field(raw, 'id')
    if (typeof id !== 'string') continue
    const stored = rows.entries.find((entry) => field(entry, 'id') === id)
    const entry = readFinalization(stored)
    const seen = revisionOf(raw)
    const marker = JSON.stringify(stored ?? null)
    if (isClosed(entry)) {
      settlements.push({ id, seen, marker, outcome: entry.outcome, revision: entry.revision })
      continue
    }
    const saved = await report(id).catch(() => null)
    if (!saved) continue
    // A started save names the revision it covered. A draft from before those records existed
    // is only known to be the saved content when it is text-only and matches the report.
    const same =
      !saved.hasScreenshot &&
      field(raw, 'image') === null &&
      saved.module_id === field(raw, 'module_id') &&
      saved.page_path === field(raw, 'page_path') &&
      saved.comment === field(raw, 'comment') &&
      text(saved.selected_text) === text(field(raw, 'selected_text'))
    settlements.push({
      id,
      seen,
      marker,
      outcome: 'saved',
      revision: entry ? entry.revision : same ? seen : null,
    })
  }
  return settlements
}

/**
 * Brings stored drafts in line with what was saved or discarded, before any is offered again.
 * The finalized revision is removed; a different one is kept under a fresh ID. Nothing is
 * decided from the mere existence of a report.
 */
export async function settleOwnerDrafts(report: OwnerReportLookup) {
  const settlements = await unsettledOwnerDrafts(report)
  if (!settlements.length) return
  await transaction<void>('readwrite', async (stores) => {
    for (const settlement of settlements) {
      const raw = await result(stores.drafts.get(settlement.id))
      const stored = await result(stores.finalizations.get(settlement.id))
      // Another tab acted since this was read; the next load settles what remains.
      if (
        raw === undefined ||
        revisionOf(raw) !== settlement.seen ||
        JSON.stringify(stored ?? null) !== settlement.marker
      )
        continue
      await closeDraftId(stores, settlement.id, settlement.outcome, settlement.revision)
    }
  })
}

// IDs of stored drafts that are exactly what was already saved or discarded. Read-only.
export async function finalizedOwnerDraftIds(report: OwnerReportLookup) {
  return new Set(
    (await unsettledOwnerDrafts(report))
      .filter((settlement) => settlement.revision === settlement.seen)
      .map((settlement) => settlement.id),
  )
}

// An explicit owner action for records `readOwnerDrafts` reported as unreadable.
export function deleteUnreadableOwnerDrafts(keys: IDBValidKey[]) {
  return transaction<void>('readwrite', async (stores) => {
    for (const key of keys) {
      stores.drafts.delete(key)
      stores.images.delete(key)
    }
  })
}
