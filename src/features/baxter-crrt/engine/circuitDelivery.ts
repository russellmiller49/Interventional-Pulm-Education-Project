import type { CrrtPressureSignalId, CrrtPressureSignalKind } from '../content/circuitModel'
import type { CrrtSimulationState } from './types'

/**
 * Set blood flow, the blood flow the circuit model actually carries, and when a
 * PrisMax *calculated* pressure display still describes a circuit.
 *
 * Three quantities were previously collapsed into one number on every surface:
 * the blood-flow **setting** in the prescription, the blood flow the pressure
 * model is actually given, and the device's calculated displays built from the
 * resulting pressures. `engine/simulation.ts` feeds blood flow into the pressure
 * model only while the blood pump is running and both lumens are connected; at
 * every other moment it passes zero, and the raw sites collapse to their
 * authored reference pressures. Nothing published that distinction, so a stopped
 * circuit and a running one looked alike (F-14).
 *
 * This module adds no physics and changes no engine state. It restates the gate
 * the engine already applies, and names the one consequence that follows from
 * the model's own arithmetic.
 */

export type CrrtBloodFlowDeliveryStatus =
  /**
   * The pump is running, both lumens are connected, and the setting is above zero:
   * blood is moving through the circuit.
   */
  | 'delivering'
  /**
   * The circuit carries no blood. Either the pump is stopped, paused or ended, a
   * lumen is disconnected, or the pump is nominally running against a blood-flow
   * setting of zero — which the engine treats identically, because it feeds zero
   * into the pressure model in every one of those states.
   */
  | 'not-delivering'
  /** No prescription is configured, so there is no setting to deliver. */
  | 'not-set'

export interface CrrtBloodFlowState {
  readonly status: CrrtBloodFlowDeliveryStatus
  /** The entered prescription setting. Null when no prescription is configured. */
  readonly setMlMin: number | null
  /**
   * The blood flow the pressure and filter models are actually given. Zero — not
   * null — while the circuit is not delivering, because zero is what the model
   * uses; it is a computed value, not a missing one.
   */
  readonly actualMlMin: number | null
  readonly bloodPumpRunning: boolean
  readonly accessConnected: boolean
  readonly returnConnected: boolean
  readonly deliveryState: CrrtSimulationState['device']['deliveryState']
}

export const CRRT_SET_BLOOD_FLOW_LABEL = 'Blood flow set' as const
export const CRRT_ACTUAL_BLOOD_FLOW_LABEL = 'Blood flow through the circuit' as const

export function selectCrrtBloodFlowState(state: CrrtSimulationState): CrrtBloodFlowState {
  const access = state.access
  const accessConnected = access.status === 'configured' && access.accessConnected
  const returnConnected = access.status === 'configured' && access.returnConnected
  const bloodPumpRunning = state.device.bloodPumpRunning
  const configured = state.prescription.status === 'configured'
  const setMlMin = configured ? state.prescription.flows.bloodFlowMlMin : null
  const delivering = bloodPumpRunning && accessConnected && returnConnected && (setMlMin ?? 0) > 0
  return Object.freeze({
    status: !configured ? 'not-set' : delivering ? 'delivering' : 'not-delivering',
    setMlMin,
    actualMlMin: setMlMin === null ? null : delivering ? setMlMin : 0,
    bloodPumpRunning,
    accessConnected,
    returnConnected,
    deliveryState: state.device.deliveryState,
  })
}

/**
 * Whether a pressure channel still describes the circuit.
 *
 * `supported` is every directly modelled site, always: with no flow those
 * transducers legitimately report the authored reference pressure, which is a
 * real static reading and must not be blanked.
 *
 * `no-flow-through-circuit` applies only to the two PrisMax calculated
 * relationships, and only while the circuit carries no blood flow. It is not a
 * preference about stopped displays. It follows from the model: with blood flow
 * zero, `calculateSyntheticBloodCircuitPressures` returns filter pressure equal
 * to return pressure by construction, so the raw filter pressure drop is
 * identically zero and the displayed drop is exactly the device correction term
 * — and TMP reduces to the reference pressures plus its own offset. Neither
 * number carries information about the filter at that moment. The correction
 * terms themselves are unchanged and remain held for device review
 * (G01-CRRT-02).
 *
 * The rule keys on actual flow rather than on the delivery state, because a pump
 * reported as running against a zero blood-flow setting produces exactly the same
 * arithmetic — which is what CRRT-04 shows at six hours, with a −25 mmHg filter
 * drop and a 7 mmHg TMP and nothing moving.
 */
export type CrrtCalculatedPressureValidity = 'supported' | 'no-flow-through-circuit'

export interface CrrtPressureValidity {
  readonly validity: CrrtCalculatedPressureValidity
  readonly reason: string | null
}

export const CRRT_CALCULATED_PRESSURE_NO_FLOW_REASON =
  'No blood is moving through the circuit, so this calculated value carries no information about the filter: with zero blood flow the model sets filter pressure equal to return pressure, leaving only the fixed device correction term. Read the four measured pressures instead.' as const

export function selectCrrtCalculatedPressureValidity(
  kind: CrrtPressureSignalKind,
  bloodFlow: CrrtBloodFlowState,
): CrrtPressureValidity {
  if (kind !== 'calculated-relationship' || bloodFlow.status === 'delivering') {
    return Object.freeze({ validity: 'supported', reason: null })
  }
  return Object.freeze({
    validity: 'no-flow-through-circuit',
    reason: CRRT_CALCULATED_PRESSURE_NO_FLOW_REASON,
  })
}

/** The two channels the rule can apply to, for tests and for copy that names them. */
export const crrtCalculatedPressureSignalIds: readonly CrrtPressureSignalId[] = Object.freeze([
  'tmp',
  'filter-drop',
])
