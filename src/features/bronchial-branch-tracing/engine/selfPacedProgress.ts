import { z } from 'zod'
import { NAV_LESSONS } from '../content/nav-lessons'

/**
 * Self-paced course state: where the learner was, which lessons they opened, which they reached
 * the end of, and which they saved for later. It holds no marks, choices or results. The place
 * within a trip is kept separately (`nav-storage.ts`).
 */
export const SELF_PACED_STORAGE_KEY = 'branch-tracing.self-paced-v1'
export const SELF_PACED_CHANGED_EVENT = 'branch-tracing-self-paced-changed'

const lessonId = z.string().min(1).max(120)
const recordSchema = z
  .object({
    version: z.literal(1),
    lastLessonId: lessonId.nullable(),
    visitedLessonIds: z.array(lessonId),
    reviewedLessonIds: z.array(lessonId),
    reviewLaterLessonIds: z.array(lessonId),
    // Written by an earlier version of the course; kept so those records still read.
    displayExplanationsShown: z.array(z.string()).optional(),
    updatedAt: z.string(),
  })
  .strict()
export type SelfPacedRecord = z.infer<typeof recordSchema>
export type SelfPacedStatus = 'unavailable' | 'empty' | 'saved' | 'unreadable'

export function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export const emptySelfPacedRecord = (): SelfPacedRecord => ({
  version: 1,
  lastLessonId: null,
  visitedLessonIds: [],
  reviewedLessonIds: [],
  reviewLaterLessonIds: [],
  updatedAt: '',
})

export function parseSelfPacedRecord(raw: string | null): {
  status: Exclude<SelfPacedStatus, 'unavailable'>
  record: SelfPacedRecord
} {
  if (raw === null) return { status: 'empty', record: emptySelfPacedRecord() }
  try {
    const parsed = recordSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return { status: 'saved', record: parsed.data }
  } catch {
    /* An unreadable value is reported, never repaired. */
  }
  return { status: 'unreadable', record: emptySelfPacedRecord() }
}

export function readSelfPacedRecord(storage: Storage | null = browserStorage()): {
  status: SelfPacedStatus
  record: SelfPacedRecord
} {
  if (!storage) return { status: 'unavailable', record: emptySelfPacedRecord() }
  try {
    return parseSelfPacedRecord(storage.getItem(SELF_PACED_STORAGE_KEY))
  } catch {
    return { status: 'unavailable', record: emptySelfPacedRecord() }
  }
}

function withItem<T extends string>(list: T[], item: T, present: boolean) {
  if (present) return list.includes(item) ? list : [...list, item]
  return list.includes(item) ? list.filter((value) => value !== item) : list
}

/** Applies one change. Unchanged state is not rewritten; an unreadable value is never overwritten. */
export function updateSelfPacedRecord(
  change: (record: SelfPacedRecord) => SelfPacedRecord,
  storage: Storage | null = browserStorage(),
) {
  const current = readSelfPacedRecord(storage)
  if (!storage || current.status === 'unavailable' || current.status === 'unreadable') return false
  const next = change(current.record)
  if (JSON.stringify(next) === JSON.stringify(current.record)) return true
  try {
    storage.setItem(
      SELF_PACED_STORAGE_KEY,
      JSON.stringify({ ...next, updatedAt: new Date().toISOString() }),
    )
  } catch {
    return false
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SELF_PACED_CHANGED_EVENT))
  return true
}

export const recordLessonOpened = (id: string, storage?: Storage | null) =>
  updateSelfPacedRecord(
    (record) => ({
      ...record,
      lastLessonId: id,
      visitedLessonIds: withItem(record.visitedLessonIds, id, true),
    }),
    storage,
  )

/** The learner's own note for finding their place: reached the end of a lesson, not a result. */
export const setLessonReviewed = (id: string, reviewed: boolean, storage?: Storage | null) =>
  updateSelfPacedRecord(
    (record) => ({
      ...record,
      reviewedLessonIds: withItem(record.reviewedLessonIds, id, reviewed),
    }),
    storage,
  )

export const setLessonReviewLater = (id: string, saved: boolean, storage?: Storage | null) =>
  updateSelfPacedRecord(
    (record) => ({
      ...record,
      reviewLaterLessonIds: withItem(record.reviewLaterLessonIds, id, saved),
    }),
    storage,
  )

/** Resume the last lesson left open, otherwise the first lesson not yet marked reviewed. */
export function recommendedLesson(record: SelfPacedRecord) {
  const last = NAV_LESSONS.find((lesson) => lesson.id === record.lastLessonId)
  if (last && !record.reviewedLessonIds.includes(last.id))
    return { lesson: last, kind: 'resume' as const }
  const next = NAV_LESSONS.find((lesson) => !record.reviewedLessonIds.includes(lesson.id))
  if (!next) return null
  return { lesson: next, kind: record.visitedLessonIds.length ? 'continue' : 'start' } as const
}
