/**
 * When a Learn step has been performed — the one rule the Now card, the task list and the
 * completion card read.
 *
 * - Reading steps (read, walk, sort, explain) are performed by being opened.
 * - A question (prediction, locate) is performed once its answer is committed.
 * - Watch one breath is performed when a new breath begins on the console after the step opened.
 * - A simulator task is performed when its result is captured. Every requested change in place is
 *   not enough on its own: it turns the Now card's primary action into "Run N s and capture".
 *
 * The lab decides every predicate underneath (`labGoalMet`, `labReadyToCompare`, the evidence
 * record); this file only says which one applies to which step.
 */
import type { LabSession } from '../engine/learningLab'
import type { WaveformSample } from '../engine/types'
import type { VentilationStageStep } from './stageLessons'

export interface VentilationStepHostState {
  /** Model time on the console when the step opened. */
  readonly enteredAtSeconds: number
}

/**
 * Whether a breath began after `after` on this record: a sample in inspiration whose previous
 * sample was in expiration, timed after the given model second.
 */
export function breathOnsetAfter(samples: readonly WaveformSample[], after: number): boolean {
  for (let index = samples.length - 1; index > 0; index -= 1) {
    const sample = samples[index]
    if (sample.time <= after) return false
    if (sample.phase === 'inspiration' && samples[index - 1].phase === 'expiration') return true
  }
  return false
}

export function ventilationStepPerformed(
  step: VentilationStageStep,
  session: LabSession,
  host: VentilationStepHostState,
): boolean {
  const interaction = step.interaction
  const round = 'round' in interaction ? interaction.round : 0
  const evidence = session.evidence[round]
  switch (interaction.kind) {
    case 'read':
    case 'walk':
    case 'sort':
    case 'explain':
    case 'interpret':
      return true
    case 'prediction':
      return session.round === round && evidence.prediction !== undefined
    case 'locate':
      return session.evidence[0].location !== undefined
    case 'advance-breath':
      return breathOnsetAfter(session.simulation.waveforms, host.enteredAtSeconds)
    case 'simulator-task':
    case 'observe':
      return session.round === round && Boolean(evidence.response)
  }
}
