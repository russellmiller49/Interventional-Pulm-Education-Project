import { hasFault } from './simulation'
import type { EcmoSimulationState } from './types'

/**
 * One eligibility contract for resuming support after an air event, read by the reducer and by the
 * control the learner actually presses.
 *
 * Before this existed the two disagreed. `EcmoCircuitControls` enabled its Resume button from
 * `circuit.bubbleResetRequired` — the console's intervention latch — while the reducer's
 * `RESUME_SUPPORT_AFTER_BUBBLE` branch asked a different question entirely: is the air corrected
 * and clear, and was the patient ever isolated. The two answers coincide on the guided drills,
 * where correcting the source deliberately leaves the latch set, and invert on the clinical cases,
 * where the de-airing intervention clears the latch. So on both air cases the button was live while
 * air was still in the circuit and dead the moment the circuit was clear — the state the case's own
 * next required action needed it in.
 *
 * Deciding it in one place is the repair. Nothing about the safety rules moves: the two charged
 * refusals below are the reducer's existing guards, named. What is new is that a disabled control
 * can say which of them it is waiting on, and that pressing an action already completed is a no-op
 * rather than a fresh critical error.
 */
export type BubbleResumptionStatus =
  /** The circuit is isolated and the air is dealt with: the bounded resumption may be performed. */
  | 'eligible'
  /** Air is still detected, or its source has been neither corrected nor cleared. */
  | 'air-outstanding'
  /** Nothing was ever clamped, so there is no isolation to bring the patient back from. */
  | 'never-isolated'
  /** This case's resumption has already been completed; pressing again changes nothing. */
  | 'already-resumed'
  /** No air event is outstanding on this circuit at all. */
  | 'not-applicable'

export interface BubbleResumptionEligibility {
  readonly status: BubbleResumptionStatus
  readonly eligible: boolean
  /**
   * Why, in the learner's words. Rendered beside the control and read to assistive technology when
   * the control is disabled, so a refusal is never silent.
   */
  readonly reason: string
}

/**
 * Whether the air has actually been dealt with, by either of the two paths that deal with it.
 *
 * The drill corrects the source explicitly, which records the fault as corrected and clears the
 * detector while deliberately leaving the console latch set. The clinical case de-airs, which
 * clears the detector and the latch through an intervention patch without recording a corrected
 * fault. Neither is the other, so both are named rather than one being inferred from the other.
 */
export function airIsCorrectedAndClear(state: EcmoSimulationState): boolean {
  if (state.circuit.arterialBubbleDetected) return false
  return (
    state.scenario.correctedFaults.includes('arterial-bubble') || !state.circuit.bubbleResetRequired
  )
}

/** Both near-patient clamps closed: the patient is off the circuit's air column (B6-002). */
export function patientIsolated(state: EcmoSimulationState): boolean {
  return state.circuit.drainageClampClosed && state.circuit.returnClampClosed
}

/** Either near-patient clamp closed: the isolation a resumption brings the patient back from. */
function anyLimbClamped(state: EcmoSimulationState): boolean {
  return state.circuit.drainageClampClosed || state.circuit.returnClampClosed
}

/**
 * Whether this run's air event has already been carried through its bounded resumption.
 *
 * Read off the state the resumption leaves behind rather than off a new flag: the fault retired,
 * the source recorded as corrected, both limbs open and the pump turning. Nothing but the
 * resumption reaches that combination — `TOGGLE_CIRCUIT_CLAMP` refuses to open the last limb while
 * the latch holds a stopped pump — and a restart reloads the scenario, so it cannot carry across
 * cases or attempts.
 */
function resumptionAlreadyCompleted(state: EcmoSimulationState): boolean {
  return (
    state.scenario.correctedFaults.includes('arterial-bubble') &&
    !hasFault(state, 'arterial-bubble') &&
    !state.circuit.arterialBubbleDetected &&
    !state.circuit.bubbleResetRequired &&
    !anyLimbClamped(state) &&
    state.device.pumpRunning
  )
}

/** Whether an air event is in play at all, in either the drill or the clinical representation. */
function airEventInPlay(state: EcmoSimulationState): boolean {
  return (
    hasFault(state, 'arterial-bubble') ||
    state.circuit.arterialBubbleDetected ||
    state.circuit.bubbleResetRequired ||
    state.scenario.correctedFaults.includes('arterial-bubble')
  )
}

export function resolveBubbleResumption(state: EcmoSimulationState): BubbleResumptionEligibility {
  if (resumptionAlreadyCompleted(state)) {
    return {
      status: 'already-resumed',
      eligible: false,
      reason:
        'Support has already been resumed on this circuit. Both limbs are open and the pump is running; there is nothing further to resume.',
    }
  }
  // Closing a clamp on an ordinary circuit does not create an air event to resume from.
  if (!airEventInPlay(state)) {
    return {
      status: 'not-applicable',
      eligible: false,
      reason: 'No air event is outstanding on this circuit, so there is nothing to resume from.',
    }
  }
  if (!airIsCorrectedAndClear(state)) {
    return {
      status: 'air-outstanding',
      eligible: false,
      reason:
        'Not available yet: the air source has not been corrected and the circuit has not been confirmed clear. Isolate the patient with both near-patient clamps, then deal with the air.',
    }
  }
  if (!anyLimbClamped(state)) {
    return {
      status: 'never-isolated',
      eligible: false,
      reason:
        'Not available: the patient was never isolated from the air column, so there is no isolation to bring them back from. Both near-patient clamps have to be closed before the air is dealt with.',
    }
  }
  return {
    status: 'eligible',
    eligible: true,
    reason:
      'The air source is corrected, the circuit is confirmed clear and the patient is isolated. Resuming is one bounded simulated step, governed at the bedside by the current IFU and your local protocol.',
  }
}
