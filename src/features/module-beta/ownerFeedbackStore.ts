import { z } from 'zod'
import { feedbackSchema, isPngScreenshot, maxScreenshotBytes, reviewSchema } from './schema'

export const ownerFeedbackDatabase = 'module-owner-feedback'
export const ownerFeedbackVersion = 1
const storeName = 'reports'

const storedSchema = z.object({
  id: z.string().uuid(),
  module_id: z.string(),
  page_path: z.string(),
  comment: z.string(),
  selected_text: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  status: reviewSchema.shape.status,
  reviewer_notes: z.string().max(10000),
  storage_mode: z.literal('owner-local'),
  schema_version: z.literal(ownerFeedbackVersion),
  screenshot: z
    .object({
      blob: z.custom<Blob>((value) => value instanceof Blob),
      type: z.literal('image/png'),
      size: z.number().int().positive().max(maxScreenshotBytes),
      width: z.number().int().positive().max(4096),
      height: z.number().int().positive().max(4096),
    })
    .nullable(),
})
export type OwnerFeedbackEntry = z.infer<typeof storedSchema>
export type OwnerFeedbackFilter = { moduleId?: string; status?: string }

function readRecord(value: unknown): OwnerFeedbackEntry {
  const parsed = storedSchema.safeParse(value)
  if (!parsed.success)
    throw new Error('Unsupported or damaged local feedback record. No data was removed.')
  const record = parsed.data
  feedbackSchema.parse({
    id: record.id,
    moduleId: record.module_id,
    pagePath: record.page_path,
    comment: record.comment,
    selectedText: record.selected_text,
  })
  return record
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(
        new Error('Browser storage is unavailable. Keep this draft open and enable IndexedDB.'),
      )
      return
    }
    const request = indexedDB.open(ownerFeedbackDatabase, ownerFeedbackVersion)
    let blocked = false
    request.onupgradeneeded = (event) => {
      // Future migrations must preserve existing records; never reset a database on upgrade.
      if (event.oldVersion === 0) request.result.createObjectStore(storeName, { keyPath: 'id' })
    }
    request.onblocked = () => {
      blocked = true
      reject(new Error('Close other tabs using owner feedback, then retry. No data was removed.'))
    }
    request.onerror = () =>
      reject(
        new Error(
          request.error?.name === 'VersionError'
            ? 'This browser has a newer feedback database. Open the newer app version; no data was removed.'
            : 'Local feedback storage could not be opened. Keep your draft and retry.',
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
  work: (store: IDBObjectStore, finish: (value: T) => void, fail: (error: Error) => void) => void,
): Promise<T> {
  const db = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction
    let value: T
    let failure: Error | undefined
    try {
      tx = db.transaction(storeName, mode)
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
            'Local feedback could not be saved or read. Browser storage may be full or disabled. Keep your draft and retry.',
          ),
      )
    }
    const fail = (error: Error) => {
      failure = error
      tx.abort()
    }
    try {
      work(
        tx.objectStore(storeName),
        (result) => {
          value = result
        },
        fail,
      )
    } catch (error) {
      fail(error instanceof Error ? error : new Error('Local feedback operation failed.'))
    }
  })
}

export async function saveOwnerFeedback(
  input: z.input<typeof feedbackSchema>,
  image?: Blob | null,
) {
  if (input.comment.length > 10000) throw new Error('Keep comments within 10,000 characters.')
  const parsed = feedbackSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)
  let screenshot: OwnerFeedbackEntry['screenshot'] = null
  if (image) {
    if (image.type !== 'image/png' || image.size > maxScreenshotBytes)
      throw new Error('Attach a PNG screenshot up to 3 MB.')
    const bytes = new Uint8Array(await image.arrayBuffer())
    if (!isPngScreenshot(bytes)) throw new Error('The screenshot could not be read.')
    const header = new DataView(bytes.buffer)
    screenshot = {
      blob: image,
      type: 'image/png',
      size: image.size,
      width: header.getUint32(16),
      height: header.getUint32(20),
    }
  }
  const now = new Date().toISOString()
  const record: OwnerFeedbackEntry = {
    id: parsed.data.id,
    module_id: parsed.data.moduleId,
    page_path: parsed.data.pagePath,
    // Validate with the shared schema, but preserve the owner's wording/whitespace verbatim.
    comment: input.comment,
    selected_text: parsed.data.selectedText,
    created_at: now,
    updated_at: now,
    status: 'new',
    reviewer_notes: '',
    storage_mode: 'owner-local',
    schema_version: ownerFeedbackVersion,
    screenshot,
  }
  return transaction<OwnerFeedbackEntry>('readwrite', (store, finish, fail) => {
    const request = store.get(record.id)
    request.onsuccess = () => {
      try {
        // The same ID is a retry, never an overwrite (including existing review notes).
        if (request.result) finish(readRecord(request.result))
        else {
          store.add(record)
          finish(record)
        }
      } catch (error) {
        fail(error as Error)
      }
    }
  })
}

export async function listOwnerFeedback(filter: OwnerFeedbackFilter = {}) {
  return transaction<OwnerFeedbackEntry[]>('readonly', (store, finish, fail) => {
    const request = store.getAll()
    request.onsuccess = () => {
      try {
        finish(
          request.result
            .map(readRecord)
            .filter(
              (entry) =>
                (!filter.moduleId || entry.module_id === filter.moduleId) &&
                (!filter.status || entry.status === filter.status),
            )
            .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)),
        )
      } catch (error) {
        fail(error as Error)
      }
    }
  })
}

export async function updateOwnerFeedback(id: string, input: z.input<typeof reviewSchema>) {
  if (input.reviewerNotes.length > 10000) throw new Error('Keep notes within 10,000 characters.')
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) throw new Error('Choose a valid status and notes up to 10,000 characters.')
  return transaction<void>('readwrite', (store, finish, fail) => {
    const request = store.get(id)
    request.onsuccess = () => {
      try {
        if (!request.result) throw new Error('Local feedback was not found. Refresh to try again.')
        const record = readRecord(request.result)
        store.put({
          ...record,
          status: parsed.data.status,
          reviewer_notes: input.reviewerNotes,
          updated_at: new Date().toISOString(),
        })
        finish()
      } catch (error) {
        fail(error as Error)
      }
    }
  })
}

export function deleteOwnerFeedback(id: string) {
  return transaction<void>('readwrite', (store, finish) => {
    store.delete(id)
    finish()
  })
}

export function clearOwnerFeedback() {
  return transaction<void>('readwrite', (store, finish) => {
    store.clear()
    finish()
  })
}
