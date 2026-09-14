import { z } from 'zod'
import nativeManifest from '../../../../public/branch-tracing/native-v1/manifest.json'
import { VERSION } from '../content/lessons'
import { ANNOTATION_VERSION } from '../content/local-exercises'
import type { CtTrace, CtViewerState } from '../content/ct-types'

export const freshRouteView = (trace: CtTrace): CtViewerState => ({
  slice: trace.anchor.slice,
  focus: 'start',
  full: false,
  magnification: 1,
  showNodule: true,
  showScope: false,
})

export const DRAFT_PREFIX = 'branch-tracing.draft.'
const recoveryRequired = new WeakMap<Storage, Map<string, string>>()
function retainForRecovery(storage: Storage, key: string, raw: string) {
  const drafts = recoveryRequired.get(storage) ?? new Map<string, string>()
  drafts.set(key, raw)
  recoveryRequired.set(storage, drafts)
}
const envelopeSchema = z.object({
  version: z.literal(1),
  signature: z.string(),
  value: z.unknown(),
})
export const orientationSchema = z.object({
  turns: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  reflected: z.boolean(),
})
export const markSchema = z.object({
  slice: z.number().int().min(239).max(478),
  pixel: z.tuple([z.number().min(0).max(511), z.number().min(0).max(511)]).nullable(),
})
export const viewerSchema = z.object({
  slice: z.number().int().min(239).max(478),
  focus: z.enum(['start', 'target', 'junction']),
  full: z.boolean(),
  magnification: z.number().min(1).max(2.5),
  showNodule: z.boolean(),
  showScope: z.boolean(),
})

/** Bind drafts to all exercise geometry, annotation metadata and the lesson revision. */
export function draftSignature(geometry: unknown) {
  const source = JSON.stringify([
    VERSION,
    ANNOTATION_VERSION,
    nativeManifest.sourceSha256,
    nativeManifest.sourceGraphSha256,
    nativeManifest.ijkToLps,
    nativeManifest.windowHu,
    geometry,
  ])
  let hash = 2166136261
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619)
  return `${VERSION}.${(hash >>> 0).toString(16)}`
}

export function readCtDraft<T>(
  storage: Storage | null,
  key: string,
  signature: string,
  parse: (value: unknown) => T | null,
  compatibleSignatures: string[] = [],
): { value: T | null; notice: string } {
  let raw: string | null = null
  try {
    if (!storage)
      return {
        value: null,
        notice: 'Browser storage is unavailable. This session cannot be saved.',
      }
    raw = storage.getItem(DRAFT_PREFIX + key)
    if (!raw) return { value: null, notice: '' }
    const envelope = envelopeSchema.safeParse(JSON.parse(raw))
    if (
      !envelope.success ||
      (envelope.data.signature !== signature &&
        !compatibleSignatures.includes(envelope.data.signature))
    ) {
      retainForRecovery(storage, key, raw)
      return {
        value: null,
        notice:
          'The saved draft belongs to different lesson content or CT annotations and cannot be resumed. A new draft starts here; earlier participation history is retained and the previous draft is kept for recovery on a successful save.',
      }
    }
    const value = parse(envelope.data.value)
    if (!value) retainForRecovery(storage, key, raw)
    return value
      ? {
          value,
          notice: 'Draft restored on this device, including your CT view and recorded attempts.',
        }
      : {
          value: null,
          notice:
            'The saved draft is incomplete or damaged and cannot be resumed. A new draft starts here; earlier participation history is retained and the previous draft is kept for recovery on a successful save.',
        }
  } catch {
    if (storage && raw) retainForRecovery(storage, key, raw)
    return {
      value: null,
      notice:
        'The saved draft could not be read. A new session starts here; recoverable prior data is retained before a replacement save.',
    }
  }
}

export function writeCtDraft(
  storage: Storage | null,
  key: string,
  signature: string,
  value: unknown,
) {
  try {
    if (!storage) return false
    const pendingRecovery = recoveryRequired.get(storage)?.get(key)
    const previous = pendingRecovery ?? storage.getItem(DRAFT_PREFIX + key)
    if (previous) {
      let oldSignature: string | null = null
      try {
        oldSignature = JSON.parse(previous).signature ?? null
      } catch {
        /* Preserve unreadable input too. */
      }
      if (pendingRecovery || oldSignature !== signature) {
        const recoveryBase = `${DRAFT_PREFIX}${key}.recovery.${oldSignature ?? 'unreadable'}`
        let recoveryKey = recoveryBase
        let suffix = 1
        while (storage.getItem(recoveryKey) && storage.getItem(recoveryKey) !== previous)
          recoveryKey = `${recoveryBase}.${suffix++}`
        // If preservation fails, do not overwrite recoverable work or claim a save.
        if (!storage.getItem(recoveryKey)) storage.setItem(recoveryKey, previous)
      }
    }
    storage.setItem(DRAFT_PREFIX + key, JSON.stringify({ version: 1, signature, value }))
    recoveryRequired.get(storage)?.delete(key)
    return true
  } catch {
    return false
  }
}
