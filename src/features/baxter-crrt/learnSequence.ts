import {
  BAXTER_CRRT_LEARN_LESSON_IDS,
  type BaxterCrrtLearnLessonId,
} from './content/learnerRegistry'

/**
 * The one authored Learn order (F-10), read from `BAXTER_CRRT_LEARN_LESSON_IDS`.
 *
 * The hub map, the lesson picker, previous/next, the end-of-lesson "Continue" and the hub's
 * resume link all number and step through lessons with this helper, so there is no second
 * sequence to disagree with. Stations on the hub group lessons and cases by topic; they are not
 * an order. Lesson IDs, stored progress and deep links are untouched — the number is derived
 * from position, never stored.
 */
export interface CrrtLessonSequencePosition {
  readonly lessonId: BaxterCrrtLearnLessonId
  /** One-based lesson number in the recommended sequence. */
  readonly number: number
  readonly total: number
  readonly previousLessonId: BaxterCrrtLearnLessonId | null
  readonly nextLessonId: BaxterCrrtLearnLessonId | null
}

export function selectCrrtLessonSequence(
  lessonId: BaxterCrrtLearnLessonId,
): CrrtLessonSequencePosition {
  const index = BAXTER_CRRT_LEARN_LESSON_IDS.indexOf(lessonId)
  if (index < 0) throw new Error(`${lessonId} is not a CRRT Learn lesson.`)
  return {
    lessonId,
    number: index + 1,
    total: BAXTER_CRRT_LEARN_LESSON_IDS.length,
    previousLessonId: BAXTER_CRRT_LEARN_LESSON_IDS[index - 1] ?? null,
    nextLessonId: BAXTER_CRRT_LEARN_LESSON_IDS[index + 1] ?? null,
  }
}

export function crrtLessonNumber(lessonId: BaxterCrrtLearnLessonId): number {
  return selectCrrtLessonSequence(lessonId).number
}

/**
 * An optional in-lesson outline for the longest lesson (X-03). Lesson 5 runs a machine set-up and
 * a normal operating reference, then a separate alarm run, in one lesson of ten tasks. The parts
 * only label that existing sequence: every task keeps its ID, its place and its content, the
 * lesson keeps its ID and position, and nothing is split or gated. A test holds each outline to
 * the authored task order, so it cannot drift from the lesson it describes.
 */
export interface CrrtLessonOutlinePart {
  readonly title: string
  readonly taskIds: readonly string[]
}

export const crrtLessonOutlineParts: Partial<
  Record<BaxterCrrtLearnLessonId, readonly CrrtLessonOutlinePart[]>
> = Object.freeze({
  'crrt-alarms-troubleshooting': Object.freeze([
    Object.freeze({
      title: 'Part 1 · Set up and read a normal run',
      taskIds: Object.freeze([
        'machine-orientation',
        'machine-setup',
        'normal-delivery',
        'delivery-interpretation',
      ]),
    }),
    Object.freeze({
      title: 'Part 2 · A new run with an alert, cause first',
      taskIds: Object.freeze([
        'alarm-arrival',
        'alarm-localize',
        'alarm-repair',
        'alarm-continuation',
        'alarm-verify',
        'alarm-transfer',
      ]),
    }),
  ]),
})
