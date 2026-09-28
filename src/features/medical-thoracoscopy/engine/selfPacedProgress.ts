import { z } from 'zod'

import { curriculumSections, integratedCases, practiceScenarios } from '../content/curriculum'

/**
 * Self-paced progress for Medical Thoracoscopy: where the learner is, which sections they have
 * visited, and which sections they have chosen to mark reviewed. Nothing else (learning contract,
 * "What is stored").
 *
 * The course is self-paced, not an examination, and this record is all it keeps. It holds no
 * answer, no correctness, no use of help and no simulation step. Opening a section is a location
 * fact; a section is reviewed only because the learner said so, and they can take it back. Being in
 * a practice scenario or a case moves the place and adds nothing else.
 *
 * This module is the only writer. It writes one key and never any other: the earlier pleuroscopy
 * module's record (`ip-pleural-module-progress-v1`) is never read, written or removed. A stored
 * value this parser cannot read is left exactly as it is, and the course then works without saving.
 * Only a section, scenario or case a learner can open is ever recorded.
 */
export const THORACOSCOPY_PROGRESS_STORAGE_KEY = 'ip-medical-thoracoscopy-self-paced-v1'
export const THORACOSCOPY_PROGRESS_CHANGED_EVENT = 'medical-thoracoscopy-progress-changed'

const entryId = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/)
const entryIds = z.array(entryId).max(64)

const locationSchema = z
  .object({
    kind: z.enum(['section', 'practice-scenario', 'case']),
    id: entryId,
  })
  .strict()

const progressSchema = z
  .object({
    version: z.literal(1),
    lastLocation: locationSchema.nullable(),
    visitedSectionIds: entryIds,
    reviewedSectionIds: entryIds,
    updatedAt: z.string().min(1).max(64),
  })
  .strict()

export type ThoracoscopyLocation = z.infer<typeof locationSchema>
export type ThoracoscopyProgress = z.infer<typeof progressSchema>

/** Saved progress, none yet, a stored value that cannot be read, or a browser that saves nothing. */
export type ThoracoscopyProgressStatus = 'empty' | 'saved' | 'unreadable' | 'unavailable'

export interface ThoracoscopyProgressSnapshot {
  readonly progress: ThoracoscopyProgress
  readonly status: ThoracoscopyProgressStatus
}

export function createEmptyProgress(): ThoracoscopyProgress {
  return {
    version: 1,
    lastLocation: null,
    visitedSectionIds: [],
    reviewedSectionIds: [],
    updatedAt: '1970-01-01T00:00:00.000Z',
  }
}

const EMPTY_PROGRESS = createEmptyProgress()

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

export function parseProgress(serialized: string | null | undefined): ThoracoscopyProgress | null {
  if (!serialized) return null
  try {
    const result = progressSchema.safeParse(JSON.parse(serialized))
    if (!result.success) return null
    const data = result.data
    return {
      ...data,
      visitedSectionIds: unique(data.visitedSectionIds),
      reviewedSectionIds: unique(data.reviewedSectionIds),
    }
  } catch {
    return null
  }
}

/** What a stored value means. Pure, so the hook and the writer read storage the same way. */
export function snapshotFromStorage(
  raw: string | null,
  available: boolean,
): ThoracoscopyProgressSnapshot {
  if (!available) return { progress: EMPTY_PROGRESS, status: 'unavailable' }
  if (raw === null) return { progress: EMPTY_PROGRESS, status: 'empty' }
  const progress = parseProgress(raw)
  return progress
    ? { progress, status: 'saved' }
    : { progress: EMPTY_PROGRESS, status: 'unreadable' }
}

/** Whether a learner can open this place. Nothing else is ever recorded. */
export function isRecordable(location: ThoracoscopyLocation): boolean {
  const available = (entry: { readonly id: string; readonly state: string }) =>
    entry.id === location.id && entry.state === 'available'
  switch (location.kind) {
    case 'section':
      return curriculumSections.some(available)
    case 'practice-scenario':
      return practiceScenarios.some(available)
    case 'case':
      return integratedCases.some(available)
  }
}

/** The learner is here now. A section is also added to the sections visited. */
export function withLocation(
  progress: ThoracoscopyProgress,
  location: ThoracoscopyLocation,
  now = new Date().toISOString(),
): ThoracoscopyProgress {
  if (!isRecordable(location)) return progress
  const alreadyHere =
    progress.lastLocation?.kind === location.kind && progress.lastLocation.id === location.id
  const firstVisit =
    location.kind === 'section' && !progress.visitedSectionIds.includes(location.id)
  if (alreadyHere && !firstVisit) return progress
  return {
    ...progress,
    lastLocation: { kind: location.kind, id: location.id },
    visitedSectionIds: firstVisit
      ? [...progress.visitedSectionIds, location.id]
      : progress.visitedSectionIds,
    updatedAt: now,
  }
}

/** The learner finished the section and says so, or takes it back. */
export function withSectionReviewed(
  progress: ThoracoscopyProgress,
  sectionId: string,
  reviewed: boolean,
  now = new Date().toISOString(),
): ThoracoscopyProgress {
  if (!isRecordable({ kind: 'section', id: sectionId })) return progress
  const listed = progress.reviewedSectionIds.includes(sectionId)
  if (listed === reviewed) return progress
  return {
    ...progress,
    reviewedSectionIds: reviewed
      ? [...progress.reviewedSectionIds, sectionId]
      : progress.reviewedSectionIds.filter((id) => id !== sectionId),
    updatedAt: now,
  }
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readProgress(): ThoracoscopyProgressSnapshot {
  const store = storage()
  if (!store) return snapshotFromStorage(null, false)
  try {
    return snapshotFromStorage(store.getItem(THORACOSCOPY_PROGRESS_STORAGE_KEY), true)
  } catch {
    return snapshotFromStorage(null, false)
  }
}

/**
 * Apply one change and save it. Returns false when nothing was saved: storage is unavailable, the
 * change changed nothing, or the stored value could not be read, which is then left as it is.
 */
export function updateProgress(
  change: (progress: ThoracoscopyProgress) => ThoracoscopyProgress,
): boolean {
  const store = storage()
  if (!store) return false
  try {
    const current = snapshotFromStorage(store.getItem(THORACOSCOPY_PROGRESS_STORAGE_KEY), true)
    if (current.status === 'unreadable') return false
    const next = change(current.progress)
    if (next === current.progress) return false
    store.setItem(THORACOSCOPY_PROGRESS_STORAGE_KEY, JSON.stringify(progressSchema.parse(next)))
    window.dispatchEvent(new Event(THORACOSCOPY_PROGRESS_CHANGED_EVENT))
    return true
  } catch {
    return false
  }
}

export function recordLocation(location: ThoracoscopyLocation): boolean {
  return updateProgress((progress) => withLocation(progress, location))
}

export function setSectionReviewed(sectionId: string, reviewed: boolean): boolean {
  return updateProgress((progress) => withSectionReviewed(progress, sectionId, reviewed))
}
