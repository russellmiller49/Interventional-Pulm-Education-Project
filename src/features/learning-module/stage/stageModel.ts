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

/**
 * The three panes of a stage, named the way a step refers to them.
 *
 * `steps` is the instruction column (the Now card and the step list), `teaching` the reading
 * column, `simulator` the device or bedside surface. These are content roles, not positions: which
 * slot each occupies is `StageLayout`'s `paneOrder`, and a module may put its steps first or its
 * simulator first without any step's location changing.
 */
export type StagePaneId = 'steps' | 'teaching' | 'simulator'

export const STAGE_PANE_IDS: readonly StagePaneId[] = ['steps', 'teaching', 'simulator']

/**
 * What a pane is called, on the pane and in the step that points at it.
 *
 * One string per pane, used by the caption `StageLayout` prints and by the "Where to look" line
 * the Now card prints, so the word a learner reads in the instruction is the word on the pane.
 */
export const STAGE_PANE_NAMES: Readonly<Record<StagePaneId, string>> = {
  steps: 'Steps panel',
  teaching: 'Teaching panel',
  simulator: 'Simulator panel',
}

/**
 * Where a step's work is done: the pane, and the thing inside it.
 *
 * `landmark` names a heading, control group or device surface the learner can actually see at that
 * step, in the words the surface carries. A second pane is allowed only where the step is
 * genuinely worked across two; a step that would list all three has not been thought through.
 */
export interface StageStepLocation {
  readonly pane: StagePaneId
  readonly landmark: string
  /** A second pane, where the step is genuinely worked across two. */
  readonly alsoPane?: StagePaneId
  readonly alsoLandmark?: string
}

/**
 * What is wrong with a step's location, for a module's import-time registry validation.
 *
 * A missing location is an error rather than a default because a step that quietly loses its
 * location is a step that goes back to "read the middle panel" with nothing on screen called
 * that. A pane's own name is refused as a landmark — "Teaching panel" inside the Teaching panel
 * points at nothing — and a second location has to be whole.
 */
export function stageStepLocationErrors(
  where: string,
  location: StageStepLocation | undefined,
): readonly string[] {
  if (!location) return [`${where} does not say which pane its work is done in.`]
  const errors: string[] = []
  const paneNames = Object.values(STAGE_PANE_NAMES).map((name) => name.toLowerCase())
  const landmark = location.landmark.trim()
  if (!landmark) errors.push(`${where} names a pane with nothing in it to look at.`)
  if (paneNames.includes(landmark.toLowerCase())) {
    errors.push(`${where} uses a pane name as a landmark inside that pane.`)
  }
  if (location.alsoPane !== undefined || location.alsoLandmark !== undefined) {
    if (location.alsoPane === undefined || location.alsoLandmark === undefined) {
      errors.push(`${where} declares half of a second location.`)
    } else {
      if (location.alsoPane === location.pane) errors.push(`${where} names the same pane twice.`)
      const alsoLandmark = location.alsoLandmark.trim()
      if (!alsoLandmark) errors.push(`${where} names a second pane with nothing in it to look at.`)
      if (paneNames.includes(alsoLandmark.toLowerCase())) {
        errors.push(`${where} uses a pane name as a landmark inside that pane.`)
      }
    }
  }
  return errors
}

/**
 * Which pane a one-pane compact viewport should show for a step.
 *
 * Below the compact threshold exactly one pane is on screen, and the shared workspace opens on the
 * first slot. A step answered by a control in another pane is unanswerable if the view is parked
 * on the wrong one, so the hosts follow the step's authored location; a caller that has a better
 * reason (an answer given by pointing at a drawing in the simulator) overrides it before calling.
 */
export function compactPaneForLocation(
  location: StageStepLocation | undefined,
  fallback: StagePaneId = 'steps',
): StagePaneId {
  return location?.pane ?? fallback
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
  /**
   * Which pane the step is worked in, and what to look for there.
   *
   * Optional at the model level because a module adopts it deliberately, and validates it in its
   * own registry with `stageStepLocationErrors`. A learner review of the ECMO module in September
   * 2026 found four steps whose instruction named no pane on a three-pane stage whose panes had no
   * visible names, so "read the middle panel" was a guess; the location is the half of that fix
   * that lives on the step, and `StageLayout`'s pane captions are the other half.
   */
  readonly lookIn?: StageStepLocation
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
