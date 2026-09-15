import { z } from 'zod'
import { LESSONS } from '../content/lessons'
import { TRACING_PRESETS, type TaughtPreset } from './local-session'

/**
 * Self-paced course state (BBT-01), the only BBT writer of learning progress.
 *
 * It keeps where the learner was, which lessons they opened, which they finished and so marked
 * reviewed, which they saved for review, and which display-convention explanations this device
 * has shown. It holds no marks, branch choices, answers, correctness, hints, attempts or support
 * labels. The learner's own working marks stay in the resumable drafts of `ct-draft.ts`. Legacy
 * participation records in the shared activity envelope are never written or read here.
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
    displayExplanationsShown: z.array(z.enum(TRACING_PRESETS)),
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
  displayExplanationsShown: [],
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

/** The explanation was displayed on this device. It is not a comprehension claim. */
export const recordDisplayExplanationShown = (preset: TaughtPreset, storage?: Storage | null) =>
  updateSelfPacedRecord(
    (record) => ({
      ...record,
      displayExplanationsShown: withItem(record.displayExplanationsShown, preset, true),
    }),
    storage,
  )

/** Resume the last lesson left open, otherwise the first lesson not yet marked reviewed. */
export function recommendedLesson(record: SelfPacedRecord) {
  const last = LESSONS.find((lesson) => lesson.id === record.lastLessonId)
  if (last && !record.reviewedLessonIds.includes(last.id))
    return { lesson: last, kind: 'resume' as const }
  const next = LESSONS.find((lesson) => !record.reviewedLessonIds.includes(lesson.id))
  if (!next) return null
  return { lesson: next, kind: record.visitedLessonIds.length ? 'continue' : 'start' } as const
}
