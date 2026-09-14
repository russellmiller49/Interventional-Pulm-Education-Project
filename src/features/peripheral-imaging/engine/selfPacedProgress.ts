import { z } from 'zod'

/**
 * Self-paced progress for the peripheral-imaging course: where the learner was, what they have
 * opened, which sections they marked reviewed, and which they saved to review later.
 *
 * The owner's decision of 2026-09-14 (`docs/gap-remediation/self-paced/`) makes this a self-paced
 * module, not an examination, and this record is the whole of what the course now keeps. It holds
 * no answer, no correctness, no use of an explanation or of help, no performed simulation step and
 * no captured image. Opening a section or a case is a location fact. A section is reviewed only
 * because the learner finished it, and the completion card says so.
 *
 * The records the course wrote before the conversion — `ip-peripheral-imaging-v2` (completed
 * sections, first attempts, the capstone debrief) and the draft's `ip-peripheral-imaging-v1` — are
 * never read into this record and never written by it (see `learnProgress.ts`). A stored value this
 * parser cannot read is left exactly as it is, and the course then works without saving.
 */
export const IMAGING_PROGRESS_STORAGE_KEY = 'ip-peripheral-imaging-self-paced-v1'
export const IMAGING_PROGRESS_CHANGED_EVENT = 'peripheral-imaging-progress-changed'

const entryId = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9-]*$/)
const entryIds = z.array(entryId).max(64)

const locationSchema = z
  .object({
    kind: z.enum(['section', 'practice-case', 'integrated-case']),
    id: entryId,
  })
  .strict()

const progressSchema = z
  .object({
    version: z.literal(1),
    lastLocation: locationSchema.nullable(),
    visitedSectionIds: entryIds,
    reviewedSectionIds: entryIds,
    reviewLaterSectionIds: entryIds,
    openedPracticeCaseIds: entryIds,
    openedIntegratedCaseIds: entryIds,
    updatedAt: z.string().min(1).max(64),
  })
  .strict()

export type ImagingLocation = z.infer<typeof locationSchema>
export type ImagingProgress = z.infer<typeof progressSchema>

/** Saved progress, none yet, a stored value that cannot be read, or a browser that saves nothing. */
export type ImagingProgressStatus = 'empty' | 'saved' | 'unreadable' | 'unavailable'

export interface ImagingProgressSnapshot {
  readonly progress: ImagingProgress
  readonly status: ImagingProgressStatus
}

export function createEmptyImagingProgress(): ImagingProgress {
  return {
    version: 1,
    lastLocation: null,
    visitedSectionIds: [],
    reviewedSectionIds: [],
    reviewLaterSectionIds: [],
    openedPracticeCaseIds: [],
    openedIntegratedCaseIds: [],
    updatedAt: '1970-01-01T00:00:00.000Z',
  }
}

const EMPTY_PROGRESS = createEmptyImagingProgress()

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

export function parseImagingProgress(
  serialized: string | null | undefined,
): ImagingProgress | null {
  if (!serialized) return null
  try {
    const result = progressSchema.safeParse(JSON.parse(serialized))
    if (!result.success) return null
    const data = result.data
    return {
      ...data,
      visitedSectionIds: unique(data.visitedSectionIds),
      reviewedSectionIds: unique(data.reviewedSectionIds),
      reviewLaterSectionIds: unique(data.reviewLaterSectionIds),
      openedPracticeCaseIds: unique(data.openedPracticeCaseIds),
      openedIntegratedCaseIds: unique(data.openedIntegratedCaseIds),
    }
  } catch {
    return null
  }
}

/** What a stored value means. Pure, so the hook and the writer read storage the same way. */
export function snapshotFromStorage(
  raw: string | null,
  available: boolean,
): ImagingProgressSnapshot {
  if (!available) return { progress: EMPTY_PROGRESS, status: 'unavailable' }
  if (raw === null) return { progress: EMPTY_PROGRESS, status: 'empty' }
  const progress = parseImagingProgress(raw)
  return progress
    ? { progress, status: 'saved' }
    : { progress: EMPTY_PROGRESS, status: 'unreadable' }
}

const OPENED_LIST = {
  section: 'visitedSectionIds',
  'practice-case': 'openedPracticeCaseIds',
  'integrated-case': 'openedIntegratedCaseIds',
} as const satisfies Record<ImagingLocation['kind'], keyof ImagingProgress>

/** The learner is here now: the last location, and the place added to what has been opened. */
export function withLocation(
  progress: ImagingProgress,
  location: ImagingLocation,
  now = new Date().toISOString(),
): ImagingProgress {
  const listKey = OPENED_LIST[location.kind]
  const list = progress[listKey]
  const alreadyHere =
    progress.lastLocation?.kind === location.kind && progress.lastLocation.id === location.id
  if (alreadyHere && list.includes(location.id)) return progress
  const next: ImagingProgress = {
    ...progress,
    lastLocation: { kind: location.kind, id: location.id },
    updatedAt: now,
  }
  next[listKey] = list.includes(location.id) ? list : [...list, location.id]
  return next
}

/** The learner finished the section. A note for finding their place, not a claim about answers. */
export function withSectionReviewed(
  progress: ImagingProgress,
  sectionId: string,
  now = new Date().toISOString(),
): ImagingProgress {
  if (progress.reviewedSectionIds.includes(sectionId)) return progress
  return {
    ...progress,
    reviewedSectionIds: [...progress.reviewedSectionIds, sectionId],
    updatedAt: now,
  }
}

export function withReviewLater(
  progress: ImagingProgress,
  sectionId: string,
  saved: boolean,
  now = new Date().toISOString(),
): ImagingProgress {
  const listed = progress.reviewLaterSectionIds.includes(sectionId)
  if (listed === saved) return progress
  return {
    ...progress,
    reviewLaterSectionIds: saved
      ? [...progress.reviewLaterSectionIds, sectionId]
      : progress.reviewLaterSectionIds.filter((id) => id !== sectionId),
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

export function readImagingProgress(): ImagingProgressSnapshot {
  const store = storage()
  if (!store) return snapshotFromStorage(null, false)
  try {
    return snapshotFromStorage(store.getItem(IMAGING_PROGRESS_STORAGE_KEY), true)
  } catch {
    return snapshotFromStorage(null, false)
  }
}

/**
 * Apply one change and save it. Returns false when nothing was saved: storage is unavailable, the
 * change changed nothing, or the stored value could not be read — which is then left as it is
 * rather than overwritten.
 */
export function updateImagingProgress(
  change: (progress: ImagingProgress) => ImagingProgress,
): boolean {
  const store = storage()
  if (!store) return false
  try {
    const current = snapshotFromStorage(store.getItem(IMAGING_PROGRESS_STORAGE_KEY), true)
    if (current.status === 'unreadable') return false
    const next = change(current.progress)
    if (next === current.progress) return false
    store.setItem(IMAGING_PROGRESS_STORAGE_KEY, JSON.stringify(progressSchema.parse(next)))
    window.dispatchEvent(new Event(IMAGING_PROGRESS_CHANGED_EVENT))
    return true
  } catch {
    return false
  }
}

export function recordImagingLocation(location: ImagingLocation): boolean {
  return updateImagingProgress((progress) => withLocation(progress, location))
}

export function markImagingSectionReviewed(sectionId: string): boolean {
  return updateImagingProgress((progress) => withSectionReviewed(progress, sectionId))
}

export function setImagingSectionReviewLater(sectionId: string, saved: boolean): boolean {
  return updateImagingProgress((progress) => withReviewLater(progress, sectionId, saved))
}
