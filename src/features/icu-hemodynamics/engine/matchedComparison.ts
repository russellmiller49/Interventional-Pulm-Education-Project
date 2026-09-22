import { icuHemodynamicsReducer } from './reducer'
import { latentPhysiologicalEstimates } from './simulation'
import type { HemodynamicInterventionDefinition, HemodynamicSimulationState } from './types'

/**
 * What the model does with and without one action, from the same state, seed and model time
 * (HD-PRE-REVIEW-02, reports P-04 and P-08).
 *
 * These are the simulation's internal values — latent model state, not anything the monitor
 * displayed or the learner acquired — and every surface that shows them says so. They answer one
 * question the learner's own run cannot: at the same moment, did this model's flow, filling
 * pressure and arterial pressure move differently because of the action? They do not say what a
 * patient would do, the response coefficients are not clinically validated, and model seconds are
 * compressed. Nothing here is recorded in the decision trace.
 */
export interface ModelOnlySnapshot {
  readonly meanArterialMmHg: number
  readonly cardiacOutputLMin: number
  readonly rightAtrialMmHg: number
  /** The model's occlusion-pressure estimate. Not a stored wedge. */
  readonly pawpMmHg: number
  readonly paDiastolicMmHg: number
  readonly spo2Percent: number
}

export interface ModelOnlyMatchedComparison {
  readonly horizonSeconds: number
  /** Model time the comparison is read at. */
  readonly atSeconds: number
  readonly atAction: ModelOnlySnapshot
  readonly withoutAction: ModelOnlySnapshot
  readonly withAction: ModelOnlySnapshot
}

function snapshot(state: HemodynamicSimulationState): ModelOnlySnapshot {
  // Physiology without this run's measurement error: an unzeroed or off-level line would otherwise
  // shift every pressure in both columns and read as part of the model's own state.
  const estimates = latentPhysiologicalEstimates(state)
  return {
    meanArterialMmHg: estimates.mapMmHg,
    cardiacOutputLMin: estimates.cardiacOutputLMin,
    rightAtrialMmHg: estimates.rapMmHg,
    pawpMmHg: estimates.pawpMmHg as number,
    paDiastolicMmHg: estimates.papDiastolicMmHg,
    spo2Percent: estimates.spo2Percent,
  }
}

/** A fixed model-time horizon so the comparison is computed once, not on every tick. */
export function modelOnlyMatchedComparison(
  before: HemodynamicSimulationState,
  intervention: HemodynamicInterventionDefinition,
  horizonSeconds: number,
): ModelOnlyMatchedComparison {
  const running = { ...before, paused: false }
  const withoutAction = icuHemodynamicsReducer(running, { type: 'TICK', seconds: horizonSeconds })
  const withAction = icuHemodynamicsReducer(
    icuHemodynamicsReducer(running, { type: 'APPLY_INTERVENTION', intervention }),
    { type: 'TICK', seconds: horizonSeconds },
  )
  return {
    horizonSeconds,
    atSeconds: before.timeSeconds + horizonSeconds,
    atAction: snapshot(before),
    withoutAction: snapshot(withoutAction),
    withAction: snapshot(withAction),
  }
}

/**
 * The horizon a comparison is read at: the authored response windows say a leg raise is read over
 * the next 10–20 seconds and a volume step equilibrates over 15–30, so 15 and 30 model seconds.
 * Model-time choices, stated on the surface; not clinical timings.
 */
export function modelOnlyHorizonSeconds(intervention: HemodynamicInterventionDefinition): number {
  return intervention.category === 'assessment' ? 15 : 30
}
