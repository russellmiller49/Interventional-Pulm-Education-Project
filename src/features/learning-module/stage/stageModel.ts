import type { CriticalCareActivityPhase } from '../activity/types'

/**
 * The step model every lesson stage renders through.
 *
 * Promoted from the Cardiohelp ECMO module's lean shell (R4, September 2026), where a foundation
 * section and a guided drill stopped being two products with two vocabularies and became one
 * ordered list of steps, exactly one of which asks for the prediction, with everything after it
 * withheld until that prediction is committed. The interaction a step carries is the module's own
 * type — an ECMO clamp task and a ventilator setting change have nothing in common but the fact
 * that a step performs them — so the model is generic over it. Adapters build lessons from content
 * registries; nothing here is authored.
 *
 * Phase vocabulary is the critical-care activity contract's — Recognize, Predict, Act, Observe,
 * Explain, Transfer — one word per phase across every lab.
 */

export type StagePhase = CriticalCareActivityPhase

export const STAGE_PHASES: readonly StagePhase[] = [
  'recognize',
  'predict',
  'act',
  'observe',
  'explain',
  'transfer',
]

export const STAGE_PHASE_LABELS: Readonly<Record<StagePhase, string>> = {
  recognize: 'Recognize',
  predict: 'Predict',
  act: 'Act',
  observe: 'Observe',
  explain: 'Explain',
  transfer: 'Transfer',
}

export function isStagePhase(value: string | null | undefined): value is StagePhase {
  return (STAGE_PHASES as readonly string[]).includes(value ?? '')
}

export interface StageStepBase<TInteraction> {
  readonly id: string
  /** One-based position in the lesson. */
  readonly ordinal: number
  readonly phase: StagePhase
  /** Rendered only once the step is reached; unreached rows show ordinal and phase alone. */
  readonly title: string
  /** The Now card's instruction: what to do, in one or two sentences. */
  readonly instruction: string
  /** Why this step matters; disclosed on request, never in the leak-scanned default view. */
  readonly rationale?: string
  /** The single primary action's label. */
  readonly actionLabel: string
  readonly interaction: TInteraction
  /** Whether the step is reachable before the lesson's prediction is committed. */
  readonly gate: 'open' | 'after-prediction'
  /** Shown in the collapsed row once the step has been performed. */
  readonly expectedResponse?: readonly string[]
}

export interface StageLessonBase<TStep> {
  readonly sectionId: string
  readonly title: string
  readonly minutes: number
  /** Zero-based position in the canonical pathway. */
  readonly index: number
  readonly total: number
  readonly steps: readonly TStep[]
  /** The index of the step that takes the prediction, or -1 when the lesson has none. */
  readonly predictionStepIndex: number
}

/**
 * Whether a step may become the current one.
 *
 * Forward only through the step the learner has just performed, and nothing past the prediction
 * until it is committed. Backward is always allowed, as review: a performed step re-expands as a
 * read-only recap and never re-runs its action.
 */
export function canEnterStep(
  lesson: { readonly steps: readonly unknown[]; readonly predictionStepIndex: number },
  index: number,
  furthestPerformedIndex: number,
  predictionCommitted: boolean,
): boolean {
  if (index < 0 || index >= lesson.steps.length) return false
  if (index > furthestPerformedIndex + 1) return false
  if (index > lesson.predictionStepIndex && !predictionCommitted) return false
  return true
}

/** The first step carrying a phase, or -1. */
export function stepIndexForPhase(
  lesson: { readonly steps: readonly { readonly phase: StagePhase }[] },
  phase: StagePhase,
): number {
  return lesson.steps.findIndex((step) => step.phase === phase)
}

export type StepRowState = 'done' | 'current' | 'next' | 'locked'

/** The state a step-list row shows, from the same predicates the hosts gate on. */
export function stepRowState(
  step: { readonly id: string; readonly gate: 'open' | 'after-prediction' },
  index: number,
  currentIndex: number,
  furthestPerformedIndex: number,
  performedStepIds: ReadonlySet<string>,
  predictionCommitted: boolean,
): StepRowState {
  if (performedStepIds.has(step.id)) return 'done'
  if (index === currentIndex) return 'current'
  const gated = step.gate === 'after-prediction' && !predictionCommitted
  return index <= furthestPerformedIndex + 1 && !gated ? 'next' : 'locked'
}
