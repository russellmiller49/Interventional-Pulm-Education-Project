import { z } from 'zod'
import { LESSONS, lessonById } from '../content/curriculum'

/**
 * Where the learner is in the EUS-B guided course: the lesson they were in, the lessons they have
 * opened, and the lessons they reached the end of.
 *
 * That is all it keeps. It holds no answer, no correctness, no held image and no completed task.
 * It lives in this browser only. A stored value this parser cannot read is left exactly as it is,
 * and the course then works without saving.
 */
export const PROGRESS_STORAGE_KEY = 'ip-eus-b-guided-v1'
export const PROGRESS_CHANGED_EVENT = 'eus-b-guided-progress-changed'

const entryId = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9-]*$/)
const entryIds = z.array(entryId).max(64)

const progressSchema = z
  .object({
    version: z.literal(1),
    lastLessonId: entryId.nullable(),
    visitedLessonIds: entryIds,
    reviewedLessonIds: entryIds,
    updatedAt: z.string().min(1).max(64),
  })
  .strict()

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
    lastLessonId: null,
    visitedLessonIds: [],
    reviewedLessonIds: [],
    updatedAt: '1970-01-01T00:00:00.000Z',
  }
}

const EMPTY_PROGRESS = createEmptyProgress()
const LESSON_IDS = new Set(LESSONS.map((lesson) => lesson.id))

const known = (values: readonly string[]) => [...new Set(values.filter((id) => LESSON_IDS.has(id)))]

/** Read a stored value. Unknown ids are dropped at read time; the stored bytes are not rewritten. */
export function parseProgress(serialized: string | null | undefined): CourseProgress | null {
  if (!serialized) return null
  try {
    const result = progressSchema.safeParse(JSON.parse(serialized))
    if (!result.success) return null
    const data = result.data
    return {
      ...data,
      lastLessonId:
        data.lastLessonId && LESSON_IDS.has(data.lastLessonId) ? data.lastLessonId : null,
      visitedLessonIds: known(data.visitedLessonIds),
      reviewedLessonIds: known(data.reviewedLessonIds),
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

/** The learner is in this lesson now. */
export function withLocation(
  progress: CourseProgress,
  lessonId: string,
  now = new Date().toISOString(),
): CourseProgress {
  if (progress.lastLessonId === lessonId && progress.visitedLessonIds.includes(lessonId))
    return progress
  return {
    ...progress,
    lastLessonId: lessonId,
    visitedLessonIds: progress.visitedLessonIds.includes(lessonId)
      ? progress.visitedLessonIds
      : [...progress.visitedLessonIds, lessonId],
    updatedAt: now,
  }
}

/** The learner reached the end of a lesson. A note for finding their place, not a claim about answers. */
export function withLessonReviewed(
  progress: CourseProgress,
  lessonId: string,
  now = new Date().toISOString(),
): CourseProgress {
  if (progress.reviewedLessonIds.includes(lessonId)) return progress
  return {
    ...progress,
    reviewedLessonIds: [...progress.reviewedLessonIds, lessonId],
    updatedAt: now,
  }
}

/**
 * The next useful lesson: the one the learner was in if they have not finished it, otherwise the
 * first lesson in course order they have not reached the end of. Undefined when all are reviewed.
 */
export function recommendedLesson(progress: CourseProgress) {
  const reviewed = new Set(progress.reviewedLessonIds)
  const last = lessonById(progress.lastLessonId ?? undefined)
  if (last && !reviewed.has(last.id)) return last
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

/**
 * Apply one change and save it. Returns false when nothing was saved: storage is unavailable, the
 * change changed nothing, or the stored value could not be read, which is then left as it is.
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

export function recordLocation(lessonId: string): boolean {
  return updateProgress((progress) => withLocation(progress, lessonId))
}

export function setLessonReviewed(lessonId: string): boolean {
  return updateProgress((progress) => withLessonReviewed(progress, lessonId))
}

/**
 * Restart the course: forget the place and every mark. A value that could not be read is removed
 * too, because the learner asked for a clean start. Returns false when nothing could be cleared.
 */
export function clearProgress(): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.removeItem(PROGRESS_STORAGE_KEY)
    window.dispatchEvent(new Event(PROGRESS_CHANGED_EVENT))
    return true
  } catch {
    return false
  }
}
