import { createHash } from 'node:crypto'

import { createSupabaseAdmin } from '@/lib/supabase/admin'

import { wolfPreviewDemoAssets } from './demoManifest'
import { PreviewStorageError } from './models'

/**
 * Reading a file of the hub or one of its demonstrations from the private bucket. Only published
 * paths in the committed manifest are ever asked for, the object comes from the manifest (never
 * from the request), and the bytes must match the manifest's hash before they are served.
 * Verified bytes are kept in this server's memory (about 71 MB once every file has been asked
 * for, the two videos being 40 MB of it), so storage is read once per file per server start.
 */
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const MAX_SEGMENTS = 6

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  glb: 'model/gltf-binary',
  mp4: 'video/mp4',
  jpg: 'image/jpeg',
  png: 'image/png',
}

type Groups = typeof wolfPreviewDemoAssets.groups
type Entry = { readonly object: string; readonly bytes: number; readonly sha256: string }

export interface PreviewFile extends Entry {
  readonly group: string
  readonly path: string
  readonly contentType: string
}

const own = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key)

/** The file a group and path stand for, or null for anything not on the manifest. */
export function previewFileFor(group: string, segments: readonly string[]): PreviewFile | null {
  if (!own(wolfPreviewDemoAssets.groups, group)) return null
  if (segments.length === 0 || segments.length > MAX_SEGMENTS) return null
  if (!segments.every((segment) => SEGMENT.test(segment) && !segment.includes('..'))) return null
  const files = wolfPreviewDemoAssets.groups[group as keyof Groups] as Record<string, Entry>
  const published = segments.join('/')
  if (!own(files, published)) return null
  const contentType = CONTENT_TYPES[published.slice(published.lastIndexOf('.') + 1)]
  if (!contentType) return null
  return { group, path: published, contentType, ...files[published] }
}

/** One object from the private bucket, with the service key. */
export async function fetchDemoObject(objectPath: string): Promise<Buffer> {
  const admin = createSupabaseAdmin()
  if (!admin) throw new PreviewStorageError('Storage is not configured')
  const { data, error } = await admin.storage
    .from(wolfPreviewDemoAssets.bucket)
    .download(objectPath)
  if (error || !data) throw new PreviewStorageError('Storage did not return the file')
  return Buffer.from(await data.arrayBuffer())
}

const verified = new Map<string, Buffer>()
const reading = new Map<string, Promise<Buffer>>()

export async function readPreviewFile(
  file: Entry,
  fetcher: (objectPath: string) => Promise<Buffer> = fetchDemoObject,
): Promise<Buffer> {
  const cached = verified.get(file.object)
  if (cached) return cached
  // A video asked for in several ranges at once is read from storage once.
  const pending = reading.get(file.object)
  if (pending) return pending
  const read = (async () => {
    const bytes = await fetcher(`${wolfPreviewDemoAssets.prefix}/${file.object}`)
    const hash = createHash('sha256').update(bytes).digest('hex')
    if (bytes.length !== file.bytes || hash !== file.sha256) {
      throw new PreviewStorageError('The stored file does not match the manifest')
    }
    verified.set(file.object, bytes)
    return bytes
  })()
  reading.set(file.object, read)
  try {
    return await read
  } finally {
    reading.delete(file.object)
  }
}

export function forgetPreviewFiles(): void {
  verified.clear()
  reading.clear()
}

/**
 * The byte range a `Range` header asks for: `{ start, end }` (inclusive) for one satisfiable
 * range, 'unsatisfiable' for one that starts past the end, and null to send the whole file (no
 * header, several ranges, or anything malformed).
 */
export function byteRange(
  header: string | null,
  size: number,
): { start: number; end: number } | 'unsatisfiable' | null {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || (match[1] === '' && match[2] === '')) return null
  if (match[1] === '') {
    const suffix = Number(match[2])
    if (suffix === 0) return 'unsatisfiable'
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }
  const start = Number(match[1])
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)
  if (start >= size) return 'unsatisfiable'
  if (end < start) return null
  return { start, end }
}
