import { plateauReadingValidity } from '../content/plateauValidity'
import { observedTidalVolumeMl, observedExpiratoryTimeSeconds } from './physics'
import { ventilationSimulationReducer } from './reducer'
import { advanceSimulation, createInitialSimulationState } from './simulation'
import type { VentilationSimulationState } from './types'

/** Authored replay conditions, not bedside settings or a PEEP titration protocol. */
export const peepComparisonSettings = [8, 10, 15] as const
export const peepComparisonIntervals = [5, 30, 45, 60, 120] as const
export type ComparisonPeep = (typeof peepComparisonSettings)[number]
export type ComparisonInterval = (typeof peepComparisonIntervals)[number]

export function createPeepComparisonBaseline() {
  const initial = createInitialSimulationState('MV-01', 'learn', 1, 'hamilton-c6')
  // The old Learn factory opens with a commitment flag despite having no selected answers.
  // A worked replay carries no learner response; preserve the patient and clear only that flag.
  return advanceSimulation(
    { ...initial, prediction: { ...initial.prediction, committed: false } },
    30,
  )
}

/** Both arms restart from the identical patient, clock and waveform history on every replay. */
export function runPeepComparison(peep: ComparisonPeep, seconds: ComparisonInterval) {
  const baseline = createPeepComparisonBaseline()
  const changed = ventilationSimulationReducer(baseline, {
    type: 'SET_CONTROL',
    control: 'peepCmH2O',
    value: peep,
  })
  return {
    baseline,
    unchanged: advanceSimulation(baseline, seconds),
    changed: advanceSimulation(changed, seconds),
    seconds,
    peep,
  }
}
export type PeepComparison = ReturnType<typeof runPeepComparison>

/** Keep source and validity with the value; the console's compliance field is a model input. */
export function peepComparisonSnapshot(state: VentilationSimulationState) {
  const validity = plateauReadingValidity(state)
  const holdActive =
    state.ventilator.holdType === 'inspiratory' &&
    state.ventilator.holdUntil !== null &&
    state.ventilator.holdUntil > state.simulationTime
  return {
    time: state.simulationTime,
    peep: state.ventilator.settings.peepCmH2O,
    spo2: state.patient.gasExchange.spo2Percent,
    pao2: state.patient.gasExchange.paO2MmHg,
    map: state.patient.hemodynamics.mapMmHg,
    peak: state.measurements.peakPressureCmH2O,
    plateau: state.measurements.plateauPressureCmH2O,
    plateauSource: holdActive ? 'active occlusion' : 'waveform estimate',
    passiveInterpretationSupported: validity.interpretable && validity.quietAtThisInstant,
    recentEffort: validity.recentEffortCmH2O,
    modelCompliance: state.patient.mechanics.complianceLPerCmH2O * 1000,
    modelShunt: state.patient.gasExchange.shuntFraction,
    intrinsicPeep: state.measurements.intrinsicPeepCmH2O,
    deliveredVt: observedTidalVolumeMl(state.waveforms) ?? null,
    exhaledVt: state.measurements.exhaledVtMl,
    machineTi: state.measurements.mechanicalInspiratoryTimeSeconds,
    observedTe: observedExpiratoryTimeSeconds(state.waveforms) ?? null,
    totalRate: state.measurements.totalRatePerMin,
  }
}
