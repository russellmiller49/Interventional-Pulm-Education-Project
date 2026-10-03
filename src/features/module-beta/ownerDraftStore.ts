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
export const ownerDraftDatabase = 'module-owner-feedback-drafts'
export const ownerDraftDatabaseVersion = 1
export const ownerDraftSchemaVersion = 1
export const maxDraftAnnotations = 500
export const maxDraftStrokePoints = 20000
const draftStore = 'drafts'
const imageStore = 'images'

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
const storedDraftSchema = z
  .object({
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
    schema_version: z.literal(ownerDraftSchemaVersion),
  })
  .strict()
  .refine(
    (draft) =>
      Boolean(betaModuleById(draft.host_module_id)) &&
      isFeedbackPageContext(draft.module_id, draft.page_path) &&
      (draft.image !== null || draft.annotations.length === 0),
  )
type StoredDraft = z.infer<typeof storedDraftSchema>
const storedImageSchema = z
  .object({
    id: z.string().uuid(),
    token: z.string().uuid(),
    blob: z.custom<Blob>((value) => value instanceof Blob),
  })
  .strict()

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
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Browser storage is unavailable, so this draft is not kept across reloads.'))
      return
    }
    const request = indexedDB.open(ownerDraftDatabase, ownerDraftDatabaseVersion)
    let blocked = false
    request.onupgradeneeded = (event) => {
      // Future migrations must preserve existing drafts; never reset a database on upgrade.
      if (event.oldVersion === 0) {
        request.result.createObjectStore(draftStore, { keyPath: 'id' })
        request.result.createObjectStore(imageStore, { keyPath: 'id' })
      }
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

// Resolve only after commit, including quota/abort failures that occur after a request succeeds.
async function transaction<T>(
  mode: IDBTransactionMode,
  work: (
    drafts: IDBObjectStore,
    images: IDBObjectStore,
    finish: (value: T) => void,
    fail: (error: Error) => void,
  ) => void,
): Promise<T> {
  const db = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction
    let value: T
    let failure: Error | undefined
    try {
      tx = db.transaction([draftStore, imageStore], mode)
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
        failure ??
          new Error(
            'Local draft storage failed; it may be full or disabled. An open draft stays here until you reload.',
          ),
      )
    }
    const fail = (error: Error) => {
      failure = error
      tx.abort()
    }
    try {
      work(
        tx.objectStore(draftStore),
        tx.objectStore(imageStore),
        (result) => {
          value = result
        },
        fail,
      )
    } catch (error) {
      fail(error instanceof Error ? error : new Error('Local draft operation failed.'))
    }
  })
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
 */
export async function saveOwnerDraft(
  input: OwnerDraftInput,
  image?: { blob: Blob; token: string } | null,
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
  const parsed = storedDraftSchema.safeParse({
    id: input.id,
    host_module_id: input.hostModuleId,
    module_id: input.moduleId,
    page_path: input.pagePath,
    comment: input.comment,
    selected_text: input.selectedText,
    annotations: input.annotations,
    image: meta,
    created_at: now,
    updated_at: now,
    storage_mode: 'owner-local',
    record_kind: 'draft',
    schema_version: ownerDraftSchemaVersion,
  })
  if (!parsed.success)
    throw new Error('This draft cannot be kept on this browser in its current form.')
  const record = parsed.data
  return transaction<StoredDraft>('readwrite', (drafts, images, finish) => {
    const existing = drafts.get(record.id)
    const storedImage = images.get(record.id)
    storedImage.onsuccess = () => {
      const created = z.string().datetime().safeParse(existing.result?.created_at)
      const next = { ...record, created_at: created.success ? created.data : record.created_at }
      drafts.put(next)
      if (!image) images.delete(record.id)
      else if (storedImage.result?.token !== image.token)
        images.put({ id: record.id, token: image.token, blob: image.blob })
      finish(next)
    }
  })
}

/**
 * Every stored draft, newest first. Records this version cannot read are reported by key rather
 * than hidden, replaced, or removed.
 */
export async function readOwnerDrafts() {
  const rows = await transaction<{ keys: IDBValidKey[]; drafts: unknown[]; images: unknown[] }>(
    'readonly',
    (drafts, images, finish) => {
      const keys = drafts.getAllKeys()
      const values = drafts.getAll()
      const blobs = images.getAll()
      blobs.onsuccess = () =>
        finish({ keys: keys.result, drafts: values.result, images: blobs.result })
    },
  )
  const drafts: OwnerFeedbackDraft[] = []
  const unreadable: IDBValidKey[] = []
  for (const [index, value] of rows.drafts.entries()) {
    const parsed = storedDraftSchema.safeParse(value)
    if (!parsed.success) {
      unreadable.push(rows.keys[index])
      continue
    }
    const draft = parsed.data
    if (!draft.image) {
      drafts.push({ ...draft, screenshot: null })
      continue
    }
    const stored = storedImageSchema.safeParse(
      rows.images.find((entry) => (entry as { id?: unknown } | undefined)?.id === draft.id),
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

// Removes one unsent draft and its image. Saved reports are in another database.
export function deleteOwnerDraft(id: string) {
  return transaction<void>('readwrite', (drafts, images, finish) => {
    drafts.delete(id)
    images.delete(id)
    finish()
  })
}

// An explicit owner action for records `readOwnerDrafts` reported as unreadable.
export function deleteUnreadableOwnerDrafts(keys: IDBValidKey[]) {
  return transaction<void>('readwrite', (drafts, images, finish) => {
    for (const key of keys) {
      drafts.delete(key)
      images.delete(key)
    }
    finish()
  })
}
