/**
 * How much of a section's teaching a live panel is allowed to show, given where the learner is.
 *
 * The six phases are an instructional sequence; the reveal stage is what that sequence means for
 * *disclosure*. They are not the same thing, which is why this is a separate mapping rather than a
 * switch inside each panel: `predict` is two different disclosure states depending on whether the
 * learner has committed, and `act` is the same disclosure state as a committed `predict`.
 *
 * The rule the whole package turns on is the first branch below. Before a commitment a panel may
 * show what is physically on the screen — raw values, units, labels, the pathway, the model status
 * of a number, and any boundary needed to read the figure safely. It may not show the mechanism,
 * the direction the requested action is expected to move things, the causal account, or the
 * misinterpretation that names the answer. Those are withheld from the DOM, not hidden with CSS.
 */

import type { McsLearnPhase } from '../../content/sectionLearningContracts'

export const MCS_REVEAL_STAGES = [
  'orientation',
  'mechanism',
  'observation',
  'explanation',
  'transfer',
] as const

export type McsRevealStage = (typeof MCS_REVEAL_STAGES)[number]

/** The one place a phase and a commitment become a disclosure state. */
export function mcsRevealStage(phase: McsLearnPhase, predictionCommitted: boolean): McsRevealStage {
  switch (phase) {
    case 'recognize':
      return 'orientation'
    case 'predict':
      return predictionCommitted ? 'mechanism' : 'orientation'
    case 'act':
      return 'mechanism'
    case 'observe':
      return 'observation'
    case 'explain':
      return 'explanation'
    case 'transfer':
      return 'transfer'
  }
}

const order: Readonly<Record<McsRevealStage, number>> = {
  orientation: 0,
  mechanism: 1,
  observation: 2,
  explanation: 3,
  transfer: 4,
}

export function mcsRevealStageAtLeast(stage: McsRevealStage, minimum: McsRevealStage): boolean {
  return order[stage] >= order[minimum]
}

/**
 * Whether the mechanism may be named.
 *
 * Every stage except the first sits after the shared answer verdict, so this is the single predicate
 * panels use rather than each one re-deciding what "after commitment" means.
 */
export function mcsMechanismDisclosed(stage: McsRevealStage): boolean {
  return stage !== 'orientation'
}

/**
 * Whether a before-and-after comparison against the action-entry snapshot is honest here.
 *
 * Deliberately false at `transfer`. The transfer phase replaces the whole simulation with a
 * different patient, so the snapshot captured before the learner's action in the *previous* patient
 * no longer describes anything on screen. Comparing against it would print stale readings under a
 * heading that says they were captured a moment ago, which is the failure mode this predicate
 * exists to make impossible rather than to caption around.
 */
export function mcsComparesAgainstActionBaseline(stage: McsRevealStage): boolean {
  return stage === 'observation' || stage === 'explanation'
}

export const mcsRevealStageLabels: Readonly<Record<McsRevealStage, string>> = {
  orientation: 'Before you commit an answer',
  mechanism: 'After your answer is committed',
  observation: 'What changed',
  explanation: 'Why it changed',
  transfer: 'A different patient',
}
