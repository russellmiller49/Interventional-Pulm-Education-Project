import { crrtLearnTasks } from './content/learnTasks'
import {
  BAXTER_CRRT_LEARN_LESSON_IDS,
  type BaxterCrrtLearnLessonId,
} from './content/learnerRegistry'
import type { CrrtCaseId } from './content/schema'
import { crrtLearnRunCaseId } from './operationalModel'

/**
 * Where Learn reuses a Practice case before Practice (CRRT-FELLOW-04, X-04).
 *
 * Lessons 5, 7 and 8 run guided versions of Practice cases CRRT-04, CRRT-13, CRRT-10 and CRRT-14.
 * That is deliberate rehearsal, not a hidden repeat, so both sides say so: the Learn run names
 * the Practice case it is a guided version of, and the Practice case names the lesson tasks that
 * walked through it. Derived from the lesson task registry, so it cannot drift from the lessons.
 */
export interface CrrtCaseReuse {
  readonly caseId: CrrtCaseId
  readonly lessonId: BaxterCrrtLearnLessonId
  readonly lessonNumber: number
  /** 1-based task numbers within the lesson, in order. */
  readonly taskNumbers: readonly number[]
}

export const crrtLearnPracticeCaseReuse: readonly CrrtCaseReuse[] = Object.freeze(
  BAXTER_CRRT_LEARN_LESSON_IDS.flatMap((lessonId, lessonIndex) => {
    const tasks = crrtLearnTasks[lessonId] ?? []
    const byCase = new Map<CrrtCaseId, number[]>()
    tasks.forEach((task, taskIndex) => {
      if (!task.run) return
      const caseId = crrtLearnRunCaseId[task.run]
      byCase.set(caseId, [...(byCase.get(caseId) ?? []), taskIndex + 1])
    })
    return [...byCase.entries()].map(([caseId, taskNumbers]) =>
      Object.freeze({
        caseId,
        lessonId,
        lessonNumber: lessonIndex + 1,
        taskNumbers: Object.freeze(taskNumbers),
      }),
    )
  }),
)

function taskRange(numbers: readonly number[]): string {
  const first = numbers[0]
  const last = numbers[numbers.length - 1]
  const contiguous = numbers.every((value, index) => value === first + index)
  if (numbers.length === 1) return `task ${first}`
  return contiguous ? `tasks ${first}–${last}` : `tasks ${numbers.join(', ')}`
}

/** The lessons that walked through a guided version of this Practice case, in words. */
export function crrtCaseReuseNote(caseId: CrrtCaseId): string | null {
  const uses = crrtLearnPracticeCaseReuse.filter((use) => use.caseId === caseId)
  if (uses.length === 0) return null
  const where = uses
    .map((use) => `Lesson ${use.lessonNumber} (${taskRange(use.taskNumbers)})`)
    .join(' and ')
  return `Revisit from Learn: ${where} walked through a guided version of this case. Here you practice it on your own — you choose and sequence the actions, and the worked plan stays available.`
}
