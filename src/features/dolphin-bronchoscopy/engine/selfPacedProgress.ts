import { z } from 'zod'

/**
 * Self-paced progress for the Dolphin Bronchoscopy module: where the learner was, what they have
 * opened, which sections they marked reviewed, and which they saved to review later.
 *
 * A copy of the peripheral-imaging record (the self-paced rules, `docs/gap-remediation/self-paced/`)
 * with one more list, the frame drills opened. It holds no answer, no correctness, no use of an
 * explanation or of help, no scope arrival, no ledger total and no report contents. Opening a
 * section, case or drill is a location fact. A section is reviewed only because the learner
 * finished it. A stored value this parser cannot read is left exactly as it is, and the module then
 * works without saving.
 */
export const DOLPHIN_PROGRESS_STORAGE_KEY = 'ip-dolphin-bronchoscopy-self-paced-v1'
export const DOLPHIN_PROGRESS_CHANGED_EVENT = 'dolphin-bronchoscopy-progress-changed'

const entryId = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9-]*$/)
const entryIds = z.array(entryId).max(64)

const locationSchema = z
  .object({
    kind: z.enum(['section', 'practice-case', 'integrated-case', 'frame-drill']),
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
    openedFrameDrillIds: entryIds,
    updatedAt: z.string().min(1).max(64),
  })
  .strict()

export type DolphinLocation = z.infer<typeof locationSchema>
export type DolphinProgress = z.infer<typeof progressSchema>

/** Saved progress, none yet, a stored value that cannot be read, or a browser that saves nothing. */
export type DolphinProgressStatus = 'empty' | 'saved' | 'unreadable' | 'unavailable'

export interface DolphinProgressSnapshot {
  readonly progress: DolphinProgress
  readonly status: DolphinProgressStatus
}

export function createEmptyDolphinProgress(): DolphinProgress {
  return {
    version: 1,
    lastLocation: null,
    visitedSectionIds: [],
    reviewedSectionIds: [],
    reviewLaterSectionIds: [],
    openedPracticeCaseIds: [],
    openedIntegratedCaseIds: [],
    openedFrameDrillIds: [],
    updatedAt: '1970-01-01T00:00:00.000Z',
  }
}

const EMPTY_PROGRESS = createEmptyDolphinProgress()

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

export function parseDolphinProgress(
  serialized: string | null | undefined,
): DolphinProgress | null {
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
      openedFrameDrillIds: unique(data.openedFrameDrillIds),
    }
  } catch {
    return null
  }
}

/** What a stored value means. Pure, so the hook and the writer read storage the same way. */
export function snapshotFromStorage(
  raw: string | null,
  available: boolean,
): DolphinProgressSnapshot {
  if (!available) return { progress: EMPTY_PROGRESS, status: 'unavailable' }
  if (raw === null) return { progress: EMPTY_PROGRESS, status: 'empty' }
  const progress = parseDolphinProgress(raw)
  return progress
    ? { progress, status: 'saved' }
    : { progress: EMPTY_PROGRESS, status: 'unreadable' }
}

const OPENED_LIST = {
  section: 'visitedSectionIds',
  'practice-case': 'openedPracticeCaseIds',
  'integrated-case': 'openedIntegratedCaseIds',
  'frame-drill': 'openedFrameDrillIds',
} as const satisfies Record<DolphinLocation['kind'], keyof DolphinProgress>

/** The learner is here now: the last location, and the place added to what has been opened. */
export function withLocation(
  progress: DolphinProgress,
  location: DolphinLocation,
  now = new Date().toISOString(),
): DolphinProgress {
  const listKey = OPENED_LIST[location.kind]
  const list = progress[listKey]
  const alreadyHere =
    progress.lastLocation?.kind === location.kind && progress.lastLocation.id === location.id
  if (alreadyHere && list.includes(location.id)) return progress
  const next: DolphinProgress = {
    ...progress,
    lastLocation: { kind: location.kind, id: location.id },
    updatedAt: now,
  }
  next[listKey] = list.includes(location.id) ? list : [...list, location.id]
  return next
}

/** The learner finished the section. A note for finding their place, not a claim about answers. */
export function withSectionReviewed(
  progress: DolphinProgress,
  sectionId: string,
  now = new Date().toISOString(),
): DolphinProgress {
  if (progress.reviewedSectionIds.includes(sectionId)) return progress
  return {
    ...progress,
    reviewedSectionIds: [...progress.reviewedSectionIds, sectionId],
    updatedAt: now,
  }
}

export function withReviewLater(
  progress: DolphinProgress,
  sectionId: string,
  saved: boolean,
  now = new Date().toISOString(),
): DolphinProgress {
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

export function readDolphinProgress(): DolphinProgressSnapshot {
  const store = storage()
  if (!store) return snapshotFromStorage(null, false)
  try {
    return snapshotFromStorage(store.getItem(DOLPHIN_PROGRESS_STORAGE_KEY), true)
  } catch {
    return snapshotFromStorage(null, false)
  }
}

/**
 * Apply one change and save it. Returns false when nothing was saved: storage is unavailable, the
 * change changed nothing, or the stored value could not be read — which is then left as it is
 * rather than overwritten.
 */
export function updateDolphinProgress(
  change: (progress: DolphinProgress) => DolphinProgress,
): boolean {
  const store = storage()
  if (!store) return false
  try {
    const current = snapshotFromStorage(store.getItem(DOLPHIN_PROGRESS_STORAGE_KEY), true)
    if (current.status === 'unreadable') return false
    const next = change(current.progress)
    if (next === current.progress) return false
    store.setItem(DOLPHIN_PROGRESS_STORAGE_KEY, JSON.stringify(progressSchema.parse(next)))
    window.dispatchEvent(new Event(DOLPHIN_PROGRESS_CHANGED_EVENT))
    return true
  } catch {
    return false
  }
}

export function recordDolphinLocation(location: DolphinLocation): boolean {
  return updateDolphinProgress((progress) => withLocation(progress, location))
}

export function markDolphinSectionReviewed(sectionId: string): boolean {
  return updateDolphinProgress((progress) => withSectionReviewed(progress, sectionId))
}

export function setDolphinSectionReviewLater(sectionId: string, saved: boolean): boolean {
  return updateDolphinProgress((progress) => withReviewLater(progress, sectionId, saved))
}
