import {
  isBaxterCrrtLearnerLessonId,
  type BaxterCrrtLearnLessonId,
} from './content/learnerRegistry'

/** This versions Learn tasks only. Do not bump engine/content versions and invalidate case history. */
export const CRRT_FOUNDATION_VERSION = 'crrt-foundations-2026-09-13-v1'

export interface CrrtLearnIdentity {
  readonly lessonId: BaxterCrrtLearnLessonId
  readonly taskId: string
  readonly attemptId: string
  readonly exampleId: string
  readonly contentVersion: string
}

export interface CrrtLearnEvidence extends CrrtLearnIdentity {
  readonly mode: 'guided' | 'independent'
  readonly response: string
  readonly correct: boolean | null
  readonly feedbackDisplayed: boolean
  readonly reviewed: boolean
  /** Structured task context: entered assumptions or recorded engine observations,
   * identified by the task/example/version. Never bedside measurements. */
  readonly inputs?: Readonly<Record<string, number>>
}

export function sameCrrtLearnIdentity(a: CrrtLearnIdentity, b: CrrtLearnIdentity): boolean {
  return (
    a.lessonId === b.lessonId &&
    a.taskId === b.taskId &&
    a.attemptId === b.attemptId &&
    a.exampleId === b.exampleId &&
    a.contentVersion === b.contentVersion
  )
}

/** Allowlisted structured answers only; no free text, PHI, or imported completion flags. */
export function parseCrrtLearnEvidence(value: unknown): CrrtLearnEvidence | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  const identifier = (v: unknown) =>
    typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:,-]{0,159}$/.test(v)
  if (
    !isBaxterCrrtLearnerLessonId(String(item.lessonId)) ||
    !['taskId', 'attemptId', 'exampleId', 'contentVersion', 'response'].every((key) =>
      identifier(item[key]),
    ) ||
    !['guided', 'independent'].includes(String(item.mode)) ||
    (item.correct !== null && typeof item.correct !== 'boolean') ||
    typeof item.feedbackDisplayed !== 'boolean' ||
    typeof item.reviewed !== 'boolean' ||
    (item.reviewed && !item.feedbackDisplayed)
  )
    return null
  let inputs: Record<string, number> | undefined
  if (item.inputs !== undefined) {
    if (!item.inputs || typeof item.inputs !== 'object' || Array.isArray(item.inputs)) return null
    const entries = Object.entries(item.inputs)
    if (
      entries.length > 20 ||
      entries.some(([key, v]) => !identifier(key) || typeof v !== 'number' || !Number.isFinite(v))
    )
      return null
    inputs = Object.fromEntries(entries)
  }
  return {
    lessonId: item.lessonId as BaxterCrrtLearnLessonId,
    taskId: item.taskId as string,
    attemptId: item.attemptId as string,
    exampleId: item.exampleId as string,
    contentVersion: item.contentVersion as string,
    mode: item.mode as CrrtLearnEvidence['mode'],
    response: item.response as string,
    correct: item.correct as boolean | null,
    feedbackDisplayed: item.feedbackDisplayed,
    reviewed: item.reviewed,
    ...(inputs ? { inputs } : {}),
  }
}

/** Preserve the first response; later events may only add display/review evidence. */
export function mergeCrrtLearnEvidence(
  history: readonly CrrtLearnEvidence[],
  incoming: CrrtLearnEvidence,
): readonly CrrtLearnEvidence[] {
  const item = parseCrrtLearnEvidence(incoming)
  if (!item) return history
  const previous = history.find((record) => sameCrrtLearnIdentity(record, item))
  if (!previous) return [...history, item]
  return history.map((record) =>
    record === previous
      ? {
          ...record,
          feedbackDisplayed: record.feedbackDisplayed || item.feedbackDisplayed,
          reviewed: record.reviewed || (item.reviewed && item.feedbackDisplayed),
        }
      : record,
  )
}
