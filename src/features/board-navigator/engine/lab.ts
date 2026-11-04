import type { Task } from '../content/types'
import type { Confidence, Evidence, EvidenceOutcome, EvidencePhase } from './record'

/**
 * The lab session, as a pure reducer: Diagnose → Explain → Manipulate → Verify → Close. Grading is
 * done here, once, for every task kind, so a renderer cannot disagree with the record about what
 * counts as success. A hint is free to the learner and recorded on the observation.
 */
export type LabStage = 'diagnose' | 'explain' | 'manipulate' | 'verify' | 'close'

export const LAB_STAGE_LABELS: Readonly<Record<LabStage, string>> = {
  diagnose: 'Diagnose',
  explain: 'Explain',
  manipulate: 'Manipulate',
  verify: 'Apply to a new case',
  close: 'Close the loop',
}

/** What the learner submitted for a task, in the shape that task takes. */
export type TaskResponse =
  | { readonly kind: 'choice'; readonly optionId: string }
  | { readonly kind: 'predict'; readonly optionId: string }
  | { readonly kind: 'sequence'; readonly order: readonly string[] }
  | { readonly kind: 'sort'; readonly placements: Readonly<Record<string, string>> }
  | { readonly kind: 'hotspot'; readonly regionId: string }

export interface GradedResponse {
  readonly correct: boolean
  /** The documented wrong model the response matched, when it matched one. */
  readonly misconceptionId: string | null
  /** For sort and sequence: which items were out of place. */
  readonly misplaced: readonly string[]
}

export function gradeResponse(task: Task, response: TaskResponse): GradedResponse {
  switch (task.kind) {
    case 'choice':
    case 'predict': {
      if (response.kind !== 'choice' && response.kind !== 'predict') return mismatch()
      const option = task.options.find((entry) => entry.id === response.optionId)
      const correct = response.optionId === task.answerId
      return {
        correct,
        misconceptionId: correct ? null : (option?.misconceptionId ?? null),
        misplaced: [],
      }
    }
    case 'sequence': {
      if (response.kind !== 'sequence') return mismatch()
      const misplaced = task.order.filter((id, index) => response.order[index] !== id)
      let misconceptionId: string | null = null
      if (misplaced.length > 0 && task.earlyMisconceptions) {
        // The first step that landed earlier than it should have names the wrong model.
        for (const [stepId, id] of Object.entries(task.earlyMisconceptions)) {
          if (response.order.indexOf(stepId) < task.order.indexOf(stepId)) {
            misconceptionId = id
            break
          }
        }
      }
      return { correct: misplaced.length === 0, misconceptionId, misplaced }
    }
    case 'sort': {
      if (response.kind !== 'sort') return mismatch()
      const misplaced = task.items
        .filter((item) => response.placements[item.id] !== item.bucketId)
        .map((item) => item.id)
      const first = task.items.find((item) => misplaced.includes(item.id) && item.misconceptionId)
      return {
        correct: misplaced.length === 0,
        misconceptionId: first?.misconceptionId ?? null,
        misplaced,
      }
    }
    case 'hotspot': {
      if (response.kind !== 'hotspot') return mismatch()
      const correct = response.regionId === task.answerRegionId
      return {
        correct,
        misconceptionId: correct ? null : (task.regionMisconceptions?.[response.regionId] ?? null),
        misplaced: [],
      }
    }
  }
}

function mismatch(): GradedResponse {
  return { correct: false, misconceptionId: null, misplaced: [] }
}

export function outcomeFor(graded: GradedResponse, usedHint: boolean): EvidenceOutcome {
  if (!graded.correct) return 'missed'
  return usedHint ? 'with-hint' : 'independent'
}

export function evidenceFrom(
  objectiveId: string,
  task: Task,
  phase: EvidencePhase,
  graded: GradedResponse,
  usedHint: boolean,
  confidence: Confidence | null,
  at: string,
): Evidence {
  return {
    objectiveId,
    taskId: task.id,
    taskKind: task.kind,
    phase,
    outcome: outcomeFor(graded, usedHint),
    confidence,
    misconceptionId: graded.misconceptionId,
    at,
  }
}

/** Whether a response is complete enough to commit. */
export function responseComplete(task: Task, response: TaskResponse | null): boolean {
  if (!response) return false
  switch (task.kind) {
    case 'choice':
    case 'predict':
      return (response.kind === 'choice' || response.kind === 'predict') && response.optionId !== ''
    case 'sequence':
      return response.kind === 'sequence' && response.order.length === task.steps.length
    case 'sort':
      return (
        response.kind === 'sort' &&
        task.items.every((item) => typeof response.placements[item.id] === 'string')
      )
    case 'hotspot':
      return response.kind === 'hotspot' && response.regionId !== ''
  }
}

/** The stages a lab runs through, given whether the repair step has a manipulation. */
export function labStages(hasManipulate: boolean, mode: 'repair' | 'review'): readonly LabStage[] {
  if (mode === 'review') return ['verify', 'close']
  return hasManipulate
    ? ['diagnose', 'explain', 'manipulate', 'verify', 'close']
    : ['diagnose', 'explain', 'verify', 'close']
}

/**
 * The sentence that closes the loop: what improved, what remains uncertain, and when the review is.
 * Built from the two graded observations so the copy can never disagree with the record.
 */
export function closingSummary(args: {
  readonly diagnose: GradedResponse | null
  readonly verify: GradedResponse
  readonly distinction: string
  readonly misconceptionLabel: string | null
}): { readonly headline: string; readonly detail: string } {
  const { diagnose, verify, distinction, misconceptionLabel } = args
  if (verify.correct && diagnose && !diagnose.correct) {
    return {
      headline: 'You repaired the idea and carried it into a new case.',
      detail: misconceptionLabel
        ? `You started from "${misconceptionLabel}" and left with this: ${distinction}`
        : `You left with this: ${distinction}`,
    }
  }
  if (verify.correct && (diagnose === null || diagnose.correct)) {
    return {
      headline: 'Demonstrated on two different tasks.',
      detail: `The idea held in a new scenario. ${distinction}`,
    }
  }
  if (!verify.correct && diagnose && diagnose.correct) {
    return {
      headline: 'The first task went well; the transfer did not.',
      detail: `The idea did not carry into the new case yet. Read the distinction once more: ${distinction}`,
    }
  }
  return {
    headline: 'This one needs focus.',
    detail: misconceptionLabel
      ? `The same wrong model appeared twice: "${misconceptionLabel}" The Navigator will bring you back to the explanation before another task. ${distinction}`
      : `Both tasks were missed. The Navigator will bring you back to the explanation before another task. ${distinction}`,
  }
}
