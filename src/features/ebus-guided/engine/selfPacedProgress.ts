import { z } from 'zod'
import { FINAL_CASES, PRACTICE_CASES } from '../content/cases'
import { LESSONS } from '../content/curriculum'
import { STORAGE_KEY as LEGACY_STORAGE_KEY } from './progress'

/**
 * Self-paced progress for the EBUS guided course: where the learner was, which lessons they have
 * opened, which they finished and so marked reviewed, which they saved for later, and which cases
 * they opened.
 *
 * The owner's decision of 2026-09-14 (`docs/gap-remediation/self-paced/`) makes this course
 * self-paced learning rather than an examination, and this record is the whole of what it now
 * keeps. It holds no answer, no correctness, no help request, no held image, no acquisition and no
 * completed task. Opening a lesson or a case is a location fact. A lesson is reviewed only because
 * the learner finished it, and the finish card says so.
 *
 * The record the course wrote before the conversion — `ip-ebus-guided-v1`, with completed lessons,
 * first attempts, support requests and linked skill observations — is never read into this record
 * and never written by it (see `progress.ts`). Its presence is the only thing this module looks at,
 * so the Overview can say that an earlier record exists and is not used. A stored self-paced value
 * this parser cannot read is left exactly as it is, and the course then works without saving.
 */
export const PROGRESS_STORAGE_KEY = 'ip-ebus-guided-self-paced-v1'
export const PROGRESS_CHANGED_EVENT = 'ebus-guided-progress-changed'

const entryId = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9-]*$/)
const entryIds = z.array(entryId).max(64)

const locationSchema = z
  .object({
    kind: z.enum(['lesson', 'practice-case', 'practice-lab', 'integrated-case']),
    id: entryId,
  })
  .strict()

const progressSchema = z
  .object({
    version: z.literal(1),
    lastLocation: locationSchema.nullable(),
    visitedLessonIds: entryIds,
    reviewedLessonIds: entryIds,
    reviewLaterLessonIds: entryIds,
    openedPracticeCaseIds: entryIds,
    openedIntegratedCaseIds: entryIds,
    updatedAt: z.string().min(1).max(64),
  })
  .strict()

export type CourseLocation = z.infer<typeof locationSchema>
export type CourseProgress = z.infer<typeof progressSchema>

/** Saved progress, none yet, a stored value that cannot be read, or a browser that saves nothing. */
export type CourseProgressStatus = 'empty' | 'saved' | 'unreadable' | 'unavailable'

export interface CourseProgressSnapshot {
  readonly progress: CourseProgress
  readonly status: CourseProgressStatus
}

export function createEmptyProgress(): CourseProgress {
  return {
    version: 1,
    lastLocation: null,
    visitedLessonIds: [],
    reviewedLessonIds: [],
    reviewLaterLessonIds: [],
    openedPracticeCaseIds: [],
    openedIntegratedCaseIds: [],
    updatedAt: '1970-01-01T00:00:00.000Z',
  }
}

const EMPTY_PROGRESS = createEmptyProgress()
const LESSON_IDS = new Set(LESSONS.map((lesson) => lesson.id))
const PRACTICE_IDS = new Set(PRACTICE_CASES.map((item) => item.id))
const INTEGRATED_IDS = new Set(FINAL_CASES.map((item) => item.id))

function known(values: readonly string[], ids: ReadonlySet<string>): string[] {
  return [...new Set(values.filter((id) => ids.has(id)))]
}

/** Read a stored value. Unknown ids are dropped at read time; the stored bytes are not rewritten. */
export function parseProgress(serialized: string | null | undefined): CourseProgress | null {
  if (!serialized) return null
  try {
    const result = progressSchema.safeParse(JSON.parse(serialized))
    if (!result.success) return null
    const data = result.data
    const location = data.lastLocation
    const locationKnown =
      !location ||
      (location.kind === 'lesson' && LESSON_IDS.has(location.id)) ||
      (location.kind === 'practice-lab' && LESSON_IDS.has(location.id)) ||
      (location.kind === 'practice-case' && PRACTICE_IDS.has(location.id)) ||
      (location.kind === 'integrated-case' && INTEGRATED_IDS.has(location.id))
    return {
      ...data,
      lastLocation: locationKnown ? location : null,
      visitedLessonIds: known(data.visitedLessonIds, LESSON_IDS),
      reviewedLessonIds: known(data.reviewedLessonIds, LESSON_IDS),
      reviewLaterLessonIds: known(data.reviewLaterLessonIds, LESSON_IDS),
      openedPracticeCaseIds: known(data.openedPracticeCaseIds, PRACTICE_IDS),
      openedIntegratedCaseIds: known(data.openedIntegratedCaseIds, INTEGRATED_IDS),
    }
  } catch {
    return null
  }
}

/** What a stored value means. Pure, so the hook and the writer read storage the same way. */
export function snapshotFromStorage(
  raw: string | null,
  available: boolean,
): CourseProgressSnapshot {
  if (!available) return { progress: EMPTY_PROGRESS, status: 'unavailable' }
  if (raw === null) return { progress: EMPTY_PROGRESS, status: 'empty' }
  const progress = parseProgress(raw)
  return progress
    ? { progress, status: 'saved' }
    : { progress: EMPTY_PROGRESS, status: 'unreadable' }
}

const OPENED_LIST = {
  lesson: 'visitedLessonIds',
  'practice-lab': 'visitedLessonIds',
  'practice-case': 'openedPracticeCaseIds',
  'integrated-case': 'openedIntegratedCaseIds',
} as const satisfies Record<CourseLocation['kind'], keyof CourseProgress>

/** The learner is here now: the last location, and the place added to what has been opened. */
export function withLocation(
  progress: CourseProgress,
  location: CourseLocation,
  now = new Date().toISOString(),
): CourseProgress {
  const listKey = OPENED_LIST[location.kind]
  const list = progress[listKey]
  const alreadyHere =
    progress.lastLocation?.kind === location.kind && progress.lastLocation.id === location.id
  if (alreadyHere && list.includes(location.id)) return progress
  const next: CourseProgress = {
    ...progress,
    lastLocation: { kind: location.kind, id: location.id },
    updatedAt: now,
  }
  next[listKey] = list.includes(location.id) ? list : [...list, location.id]
  return next
}

/** The learner finished (or un-finished) a lesson. A note for finding their place, not a claim about answers. */
export function withLessonReviewed(
  progress: CourseProgress,
  lessonId: string,
  reviewed: boolean,
  now = new Date().toISOString(),
): CourseProgress {
  const listed = progress.reviewedLessonIds.includes(lessonId)
  if (listed === reviewed) return progress
  return {
    ...progress,
    reviewedLessonIds: reviewed
      ? [...progress.reviewedLessonIds, lessonId]
      : progress.reviewedLessonIds.filter((id) => id !== lessonId),
    updatedAt: now,
  }
}

export function withReviewLater(
  progress: CourseProgress,
  lessonId: string,
  saved: boolean,
  now = new Date().toISOString(),
): CourseProgress {
  const listed = progress.reviewLaterLessonIds.includes(lessonId)
  if (listed === saved) return progress
  return {
    ...progress,
    reviewLaterLessonIds: saved
      ? [...progress.reviewLaterLessonIds, lessonId]
      : progress.reviewLaterLessonIds.filter((id) => id !== lessonId),
    updatedAt: now,
  }
}

/**
 * The next useful lesson: the one the learner was in if they have not finished it, otherwise the
 * first lesson in course order they have not marked reviewed. Undefined when every lesson is
 * reviewed. Answers, cases and saved-for-later marks play no part.
 */
export function recommendedLesson(progress: CourseProgress) {
  const reviewed = new Set(progress.reviewedLessonIds)
  const last = progress.lastLocation
  if (last && (last.kind === 'lesson' || last.kind === 'practice-lab') && !reviewed.has(last.id)) {
    const lesson = LESSONS.find((entry) => entry.id === last.id)
    if (lesson) return lesson
  }
  return LESSONS.find((lesson) => !reviewed.has(lesson.id))
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readProgress(): CourseProgressSnapshot {
  const store = storage()
  if (!store) return snapshotFromStorage(null, false)
  try {
    return snapshotFromStorage(store.getItem(PROGRESS_STORAGE_KEY), true)
  } catch {
    return snapshotFromStorage(null, false)
  }
}

/** Whether the pre-conversion record exists in this browser. Its bytes are neither read nor changed. */
export function legacyRecordPresent(): boolean {
  const store = storage()
  if (!store) return false
  try {
    return store.getItem(LEGACY_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

/**
 * Apply one change and save it. Returns false when nothing was saved: storage is unavailable, the
 * change changed nothing, or the stored value could not be read — which is then left as it is
 * rather than overwritten.
 */
export function updateProgress(change: (progress: CourseProgress) => CourseProgress): boolean {
  const store = storage()
  if (!store) return false
  try {
    const current = snapshotFromStorage(store.getItem(PROGRESS_STORAGE_KEY), true)
    if (current.status === 'unreadable') return false
    const next = change(current.progress)
    if (next === current.progress) return false
    store.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progressSchema.parse(next)))
    window.dispatchEvent(new Event(PROGRESS_CHANGED_EVENT))
    return true
  } catch {
    return false
  }
}

export function recordLocation(location: CourseLocation): boolean {
  return updateProgress((progress) => withLocation(progress, location))
}

export function setLessonReviewed(lessonId: string, reviewed: boolean): boolean {
  return updateProgress((progress) => withLessonReviewed(progress, lessonId, reviewed))
}

export function setLessonReviewLater(lessonId: string, saved: boolean): boolean {
  return updateProgress((progress) => withReviewLater(progress, lessonId, saved))
}
