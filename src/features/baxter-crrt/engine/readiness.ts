import { calculateCoupledBagDeliveryFraction } from './fluidModel'
import type { CrrtSimulationState } from './types'

export interface EngineReadiness {
  readonly readyForDraftSimulation: boolean
  readonly missing: readonly string[]
  readonly blockedCapabilities: readonly string[]
  readonly reviewStatus: 'pending'
}

/** One fail-closed readiness contract shared by selectors and every start path. */
export function evaluateEngineReadiness(state: CrrtSimulationState): EngineReadiness {
  const missing: string[] = []
  if (state.deviceId !== 'prismax-aw8035-2xx') missing.push('implemented device adapter')
  if (state.device.adapterStatus !== 'available-phase-3') missing.push('available device adapter')
  if (state.scenario.status !== 'loaded') missing.push('authored fixture')
  if (state.patient.status !== 'configured') missing.push('simulated patient state')
  if (state.access.status !== 'configured') missing.push('access model')
  if (
    state.access.status === 'configured' &&
    (!state.access.accessConnected || !state.access.returnConnected)
  ) {
    missing.push('connected access and return paths')
  }
  if (state.prescription.status !== 'configured') missing.push('prescription')
  if (!state.scenario.modelConfiguration.pressure) missing.push('pressure calibration')
  if (!state.scenario.modelConfiguration.filter) missing.push('filter calibration')
  if (
    state.prescription.status === 'configured' &&
    state.prescription.citrateRequestedButDisabled
  ) {
    missing.push('approved citrate-calcium protocol')
  }

  if (state.prescription.status === 'configured') {
    const bagReadiness = calculateCoupledBagDeliveryFraction(
      state.circuit.bags,
      state.prescription.flows,
      state.deliveredTherapy.prescribedEffluentRateMlHour ?? 0,
      1,
      true,
    )
    if (bagReadiness.invalidTerms.length > 0) missing.push('valid one-bag-per-flow topology')
    if (bagReadiness.deliveryFraction === 0) missing.push('available connected bag capacity')
  }

  return {
    readyForDraftSimulation: missing.length === 0,
    missing: [...new Set(missing)],
    blockedCapabilities:
      state.protocolProfileVersion === null ? ['regional citrate-calcium dosing'] : [],
    reviewStatus: 'pending',
  }
}

export function canEnterRunningState(state: CrrtSimulationState): boolean {
  return evaluateEngineReadiness(state).readyForDraftSimulation
}
