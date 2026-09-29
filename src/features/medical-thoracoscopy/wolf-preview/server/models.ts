import { createHash } from 'node:crypto'

import { createSupabaseAdmin } from '@/lib/supabase/admin'

import { wolfPreviewAssets } from './assetManifest'

/**
 * Reading a preview model from the private bucket. Only ids in the committed manifest are ever
 * asked for, the object path comes from the manifest (never from the request), and the bytes must
 * match the manifest's hash before they are served. Verified bytes are kept in this server's
 * memory, so storage is read once per model per server start.
 */
const MODEL_FILE = /^([a-z]+(?:-[a-z]+)*)\.glb$/

type ModelId = keyof typeof wolfPreviewAssets.models

export class PreviewStorageError extends Error {}

/** The model a requested file name stands for, or null for anything not on the list. */
export function modelFor(file: string): { id: ModelId; bytes: number; sha256: string } | null {
  const match = MODEL_FILE.exec(file)
  if (!match) return null
  const id = match[1]
  if (!Object.prototype.hasOwnProperty.call(wolfPreviewAssets.models, id)) return null
  const entry = wolfPreviewAssets.models[id as ModelId]
  return { id: id as ModelId, bytes: entry.bytes, sha256: entry.sha256 }
}

export function storageConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(
    (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL) && env.SUPABASE_SERVICE_ROLE_KEY,
  )
}

/** One object from the private bucket, with the service key. */
export async function fetchObject(objectPath: string): Promise<Buffer> {
  const admin = createSupabaseAdmin()
  if (!admin) throw new PreviewStorageError('Storage is not configured')
  const { data, error } = await admin.storage.from(wolfPreviewAssets.bucket).download(objectPath)
  if (error || !data) throw new PreviewStorageError('Storage did not return the model')
  return Buffer.from(await data.arrayBuffer())
}

const verified = new Map<ModelId, Buffer>()

export async function readModel(
  id: ModelId,
  fetcher: (objectPath: string) => Promise<Buffer> = fetchObject,
): Promise<Buffer> {
  const cached = verified.get(id)
  if (cached) return cached
  const entry = wolfPreviewAssets.models[id]
  const bytes = await fetcher(`${wolfPreviewAssets.prefix}/${entry.object}`)
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (bytes.length !== entry.bytes || hash !== entry.sha256) {
    throw new PreviewStorageError('The stored model does not match the manifest')
  }
  verified.set(id, bytes)
  return bytes
}

export function forgetModels(): void {
  verified.clear()
}
