import { criticalCareProgressEnvelopeSchema, parseProgressEnvelope } from './schema'
import type {
  CriticalCareActivityProgress,
  CriticalCareActivityStatus,
  CriticalCareProgressEnvelope,
  CriticalCareResumePointer,
} from './types'

export const CRITICAL_CARE_PROGRESS_STORAGE_KEY = 'critical-care-activity-progress-v1'
export const CRITICAL_CARE_PROGRESS_VERSION = 1 as const
export const CRITICAL_CARE_PROGRESS_CHANGED_EVENT = 'critical-care-progress-changed'

export interface CriticalCareStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const statusRank: Readonly<Record<CriticalCareActivityStatus, number>> = {
  'not-started': 0,
  'in-progress': 1,
  completed: 2,
  mastered: 3,
}

function newestTimestamp(left: string, right: string): string {
  return Date.parse(right) > Date.parse(left) ? right : left
}

export function createEmptyCriticalCareProgress(
  now = new Date().toISOString(),
): CriticalCareProgressEnvelope {
  return {
    version: CRITICAL_CARE_PROGRESS_VERSION,
    activities: [],
    updatedAt: now,
  }
}

export function parseSerializedCriticalCareProgress(
  serialized: string | null | undefined,
): CriticalCareProgressEnvelope | null {
  if (!serialized) return null
  try {
    return parseProgressEnvelope(JSON.parse(serialized) as unknown)
  } catch {
    return null
  }
}

export function serializeCriticalCareProgress(progress: CriticalCareProgressEnvelope): string {
  return JSON.stringify(criticalCareProgressEnvelopeSchema.parse(progress))
}

export function readCriticalCareProgress(
  storage: CriticalCareStorageLike | null,
): CriticalCareProgressEnvelope {
  if (!storage) return createEmptyCriticalCareProgress()
  try {
    return (
      parseSerializedCriticalCareProgress(storage.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY)) ??
      createEmptyCriticalCareProgress()
    )
  } catch {
    return createEmptyCriticalCareProgress()
  }
}

export function writeCriticalCareProgress(
  storage: CriticalCareStorageLike | null,
  progress: CriticalCareProgressEnvelope,
): boolean {
  if (!storage) return false
  try {
    storage.setItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY, serializeCriticalCareProgress(progress))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(CRITICAL_CARE_PROGRESS_CHANGED_EVENT))
    }
    return true
  } catch {
    return false
  }
}

export function upsertCriticalCareActivityProgress(
  envelope: CriticalCareProgressEnvelope,
  incoming: CriticalCareActivityProgress,
  resume?: CriticalCareResumePointer,
): CriticalCareProgressEnvelope {
  const existing = envelope.activities.find(
    (activity) => activity.activityId === incoming.activityId,
  )
  const incomingIsNewest =
    !existing || Date.parse(incoming.updatedAt) >= Date.parse(existing.updatedAt)
  const latest = incomingIsNewest ? incoming : existing
  const status =
    existing && statusRank[existing.status] > statusRank[incoming.status]
      ? existing.status
      : incoming.status
  const merged: CriticalCareActivityProgress = {
    ...existing,
    ...latest,
    status,
    attempts: Math.max(existing?.attempts ?? 0, incoming.attempts),
    ...(existing?.bestScore !== undefined || incoming.bestScore !== undefined
      ? { bestScore: Math.max(existing?.bestScore ?? 0, incoming.bestScore ?? 0) }
      : {}),
    ...(existing?.hintCount !== undefined || incoming.hintCount !== undefined
      ? { hintCount: Math.max(existing?.hintCount ?? 0, incoming.hintCount ?? 0) }
      : {}),
    competencyEvidenceIds: [
      ...new Set([...(existing?.competencyEvidenceIds ?? []), ...incoming.competencyEvidenceIds]),
    ],
    updatedAt: latest.updatedAt,
  }
  const activities = existing
    ? envelope.activities.map((activity) =>
        activity.activityId === incoming.activityId ? merged : activity,
      )
    : [...envelope.activities, merged]
  const nextResume =
    resume &&
    (!envelope.resume || Date.parse(resume.updatedAt) >= Date.parse(envelope.resume.updatedAt))
      ? resume
      : envelope.resume
  const updatedAt = newestTimestamp(
    envelope.updatedAt,
    nextResume ? newestTimestamp(merged.updatedAt, nextResume.updatedAt) : merged.updatedAt,
  )
  return criticalCareProgressEnvelopeSchema.parse({
    version: CRITICAL_CARE_PROGRESS_VERSION,
    activities,
    ...(nextResume ? { resume: nextResume } : {}),
    updatedAt,
  }) as CriticalCareProgressEnvelope
}

export function withCriticalCareResumePointer(
  envelope: CriticalCareProgressEnvelope,
  resume: CriticalCareResumePointer,
): CriticalCareProgressEnvelope {
  const nextResume =
    envelope.resume && Date.parse(envelope.resume.updatedAt) > Date.parse(resume.updatedAt)
      ? envelope.resume
      : resume
  return criticalCareProgressEnvelopeSchema.parse({
    ...envelope,
    resume: nextResume,
    updatedAt: newestTimestamp(envelope.updatedAt, nextResume.updatedAt),
  }) as CriticalCareProgressEnvelope
}

export function withoutCriticalCareResumePointer(
  envelope: CriticalCareProgressEnvelope,
  activityId?: string,
): CriticalCareProgressEnvelope {
  if (!envelope.resume || (activityId && envelope.resume.activityId !== activityId)) return envelope
  return criticalCareProgressEnvelopeSchema.parse({
    version: envelope.version,
    activities: envelope.activities,
    updatedAt: envelope.updatedAt,
  }) as CriticalCareProgressEnvelope
}
