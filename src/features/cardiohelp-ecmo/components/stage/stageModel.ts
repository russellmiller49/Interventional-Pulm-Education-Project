import type { ClinicalLearningItem } from '@/features/learning-module/activity/clinicalLearningItem'
import type { CriticalCareActivityPhase } from '@/features/learning-module/activity/types'

import type { EcmoFoundationGuidedAction } from '../../content/foundationLessonRuntime'
import type { EcmoLearnPredictionCommitment } from '../../content/learnPredictionItems'
import type {
  CircuitViewPreference,
  GuidedTarget,
  SimulationAction,
  SupportMode,
} from '../../engine/types'

/**
 * The one step model every section of the pathway renders through.
 *
 * A foundation section and a guided drill used to be two products with two vocabularies, two
 * progressions, and two ways of gating what the learner may read. The stage renders both from this
 * shape: an ordered list of steps, exactly one of which asks for the prediction, with everything
 * after it withheld until that prediction is committed. The adapters in `./adapters/` build it from
 * the existing content registries; nothing here is authored.
 *
 * Phase vocabulary is the critical-care activity contract's — Recognize, Predict, Act, Observe,
 * Explain, Transfer — one word per phase across every lab, so a learner who has met it elsewhere
 * meets the same word here.
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

/** The four monitor surfaces a step can open beside the console. The console is always present. */
export type StageSurfaceId = 'circuit' | 'gas' | 'monitor' | 'trends'

export const STAGE_SURFACES: readonly StageSurfaceId[] = ['circuit', 'gas', 'monitor', 'trends']

export const STAGE_SURFACE_LABELS: Readonly<Record<StageSurfaceId, string>> = {
  circuit: 'Circuit',
  gas: 'Gas blender',
  monitor: 'Bedside monitor and blood gas',
  trends: 'Trends',
}

export type StageInteraction =
  /** Nothing to perform: the learner reads, then continues. */
  | { readonly kind: 'read' }
  /**
   * Completed by operating a control on the simulator. The stage resolves the control from the
   * action at render time and marks the step performed when the engine state satisfies it.
   */
  | {
      readonly kind: 'simulator-task'
      readonly actions: readonly SimulationAction[]
      readonly target: GuidedTarget
    }
  /** Advances the model from the task pane; nothing on the simulator can satisfy it. */
  | { readonly kind: 'model-advance'; readonly actions: readonly SimulationAction[] }
  /**
   * The commit point. `commitments` is present for drills, whose committed choice becomes the
   * engine's `COMMIT_PREDICTION` payload; foundations hold the commitment in stage state only.
   */
  | {
      readonly kind: 'prediction'
      readonly item: ClinicalLearningItem
      readonly verdict: 'answer-verdict' | 'choice-reasoning'
      readonly commitments?: Readonly<Record<string, EcmoLearnPredictionCommitment>>
    }
  /** Foundation bounded actions: restore a variant, advance the clock, or record a look. */
  | { readonly kind: 'bounded-actions'; readonly actions: readonly EcmoFoundationGuidedAction[] }
  /** Foundation transfer item; committing it is what records the section as worked. */
  | { readonly kind: 'transfer-item'; readonly item: ClinicalLearningItem }
  /** Drill transfer: a different authored scenario loaded on entry, with one action to perform. */
  | {
      readonly kind: 'transfer-scenario'
      readonly scenarioId: string
      readonly setupActions: readonly SimulationAction[]
      readonly actions: readonly SimulationAction[]
      readonly target: GuidedTarget
    }

export interface StageStep {
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
  readonly interaction: StageInteraction
  /** The simulator panel the step is performed on, or null for a task-pane step. */
  readonly focusTarget: GuidedTarget | null
  /** Surfaces opened when the step is entered; the learner may open the rest. */
  readonly surfaces: readonly StageSurfaceId[]
  readonly circuitView?: CircuitViewPreference
  /** What the teaching pane shows for this step. */
  readonly teaching: {
    readonly prose: 'none' | 'summary' | 'full'
    /** `all`, or the heading ids of the teaching blocks that belong to this step. */
    readonly blocks: 'all' | readonly string[]
  }
  readonly gate: 'open' | 'after-prediction'
  /** Shown in the collapsed row once the step has been performed. */
  readonly expectedResponse?: readonly string[]
  /** A foundation variant authored for this phase; restored when the step is entered. */
  readonly entryVariantId?: string
}

export type StageLessonKind = 'drill' | 'foundation'

export interface StageLesson {
  readonly kind: StageLessonKind
  readonly sectionId: string
  /** The scenario the engine holds while this lesson runs (the section id for drills). */
  readonly scenarioId: string
  readonly supportMode: SupportMode
  readonly title: string
  readonly minutes: number
  /** Zero-based position in the canonical pathway. */
  readonly index: number
  readonly total: number
  readonly objectives: readonly string[]
  readonly steps: readonly StageStep[]
  readonly predictionStepIndex: number
  readonly lifecycleActivityId: string
  readonly practicePairing?: { readonly caseId: string; readonly title: string }
}

/**
 * The surfaces a step opens when it declares none of its own.
 *
 * Derived from where the learner's hands go: a circuit step opens the circuit, a gas step the
 * blender, and so on. A console-only step opens nothing beyond the console, which is always
 * present. A step read on the pressure map always opens the circuit, whatever its target.
 */
export function defaultSurfacesFor(
  target: GuidedTarget | null,
  circuitView?: CircuitViewPreference,
): readonly StageSurfaceId[] {
  const surfaces: StageSurfaceId[] =
    target === 'circuit'
      ? ['circuit']
      : target === 'gas-panel'
        ? ['gas']
        : target === 'patient-monitor'
          ? ['monitor']
          : target === 'trend-panel'
            ? ['trends']
            : []
  if (circuitView && !surfaces.includes('circuit')) surfaces.unshift('circuit')
  return surfaces
}

/**
 * Whether a step may become the current one.
 *
 * Forward only through the step the learner has just performed, and nothing past the prediction
 * until it is committed. Backward is always allowed, as review: a performed step re-expands as a
 * read-only recap and never re-runs its action.
 */
export function canEnterStep(
  lesson: Pick<StageLesson, 'steps' | 'predictionStepIndex'>,
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
export function stepIndexForPhase(lesson: Pick<StageLesson, 'steps'>, phase: StagePhase): number {
  return lesson.steps.findIndex((step) => step.phase === phase)
}

/**
 * Where a lesson mounts when the URL names a phase.
 *
 * Only `recognize` and `predict` are honoured. Commitment is never persisted, so a URL into a later
 * phase cannot know whether the prediction was ever taken; the closed failure is to open at the
 * prediction and say which phase is waiting. Both kinds share this rule.
 */
export function mountStepIndex(
  lesson: Pick<StageLesson, 'steps' | 'predictionStepIndex'>,
  requestedPhase: StagePhase,
): { readonly index: number; readonly clamped: boolean } {
  if (requestedPhase === 'recognize') return { index: 0, clamped: false }
  if (requestedPhase === 'predict') {
    return { index: Math.max(0, lesson.predictionStepIndex), clamped: false }
  }
  return { index: Math.max(0, lesson.predictionStepIndex), clamped: true }
}
