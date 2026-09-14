/** Matched MV-01 investigation; run with tsx. No storage or learner records. */
import { resolveVentilationSimulationCase } from '../content/learningPatient'
import {
  deriveMeasurements,
  observedEndExpiratoryVolumeMl,
  observedExpiratoryTimeSeconds,
  observedTidalVolumeMl,
  unmodeledIntrinsicPeepCmH2O,
} from '../engine/physics'
import { ventilationSimulationReducer } from '../engine/reducer'
import { advanceSimulation, createInitialSimulationState } from '../engine/simulation'
import type { VentilationAction, VentilationSimulationState } from '../engine/types'

export function causalSnapshot(state: VentilationSimulationState) {
  const definition = resolveVentilationSimulationCase(state.caseId)
  const m = state.measurements
  const compliance = state.patient.mechanics.complianceLPerCmH2O
  const waveformTrappedMl = observedEndExpiratoryVolumeMl(state.waveforms)
  // Keep the actual phase/timing history but zero its volume contribution to isolate the
  // analytic term in deriveMeasurements. This is diagnostic only, never a simulation state.
  const analytic = deriveMeasurements(
    { ...state, waveforms: state.waveforms.map((s) => ({ ...s, volumeMl: 0 })) },
    definition,
  ).intrinsicPeepCmH2O
  const last = state.waveforms.at(-1)
  let observedTi: number | null = null
  for (let end = state.waveforms.length - 1; end > 0; end--) {
    if (
      state.waveforms[end].phase !== 'expiration' ||
      state.waveforms[end - 1].phase !== 'inspiration'
    )
      continue
    for (let start = end - 1; start > 0; start--) {
      if (state.waveforms[start - 1].phase === 'expiration') {
        observedTi = state.waveforms[end].time - state.waveforms[start].time
        break
      }
    }
    break
  }
  return {
    time: Number(state.simulationTime.toFixed(4)),
    caseId: state.caseId,
    branch: state.branch,
    device: state.deviceId,
    intrinsicPeep: m.intrinsicPeepCmH2O,
    analyticIntrinsicPeep: analytic,
    analyticEquivalentTrappedMl: analytic * compliance * 1000,
    waveformTrappedMl,
    waveformRecoil: waveformTrappedMl === undefined ? null : waveformTrappedMl / 1000 / compliance,
    residualIntrinsicPeep: unmodeledIntrinsicPeepCmH2O(
      m.intrinsicPeepCmH2O,
      (waveformTrappedMl ?? 0) / 1000,
      compliance,
    ),
    instantaneousVolumeMl: state.patient.mechanics.endExpiratoryVolumeL * 1000,
    peak: m.peakPressureCmH2O,
    plateau: m.plateauPressureCmH2O,
    plateauInterpretable: m.plateauIsInterpretable,
    plateauSource: state.ventilator.holdType === 'inspiratory' ? 'hold' : 'trace estimate',
    hold: state.ventilator.holdType,
    lastSamplePhase: last?.phase,
    lastSampleFlow: last?.flowLMin,
    deliveredVtMl: observedTidalVolumeMl(state.waveforms),
    exhaledVtMl: m.exhaledVtMl,
    mechanicalTi: m.mechanicalInspiratoryTimeSeconds,
    observedTi,
    observedTe: observedExpiratoryTimeSeconds(state.waveforms),
    totalRate: m.totalRatePerMin,
    setRate:
      state.ventilator.settings.mode === 'pressure-support'
        ? null
        : state.ventilator.settings.ratePerMin,
    oxygenPercent: state.ventilator.settings.oxygenPercent,
  }
}

export const causalArms: Readonly<Record<string, readonly VentilationAction[]>> = {
  wait: [],
  noopOxygen: [{ type: 'SET_CONTROL', control: 'oxygenPercent', value: 50 }],
  changedOxygen: [{ type: 'SET_CONTROL', control: 'oxygenPercent', value: 70 }],
  lowerSetRate: [{ type: 'SET_CONTROL', control: 'ratePerMin', value: 14 }],
  longerInspiration: [{ type: 'SET_CONTROL', control: 'peakFlowLMin', value: 22 }],
}

export function runCausalExperiment(baselineSeconds = 0) {
  const cold = createInitialSimulationState('MV-03', 'learn', 1, 'hamilton-c6')
  const initial = baselineSeconds ? advanceSimulation(cold, baselineSeconds) : cold
  return Object.fromEntries(
    Object.entries(causalArms).map(([name, actions]) => {
      const state = actions.reduce(ventilationSimulationReducer, initial)
      // Each endpoint starts from the same state; sampling does not change integration chunking.
      const samples = [0, 5, 30, 60, 120].map((elapsed) => ({
        elapsed,
        ...causalSnapshot(elapsed ? advanceSimulation(state, elapsed) : state),
      }))
      return [name, samples]
    }),
  )
}

if (process.argv[1]?.endsWith('causal-experiment.ts')) {
  process.stdout.write(
    `${JSON.stringify({ cold: runCausalExperiment(), after30SecondBaseline: runCausalExperiment(30) }, null, 2)}\n`,
  )
}
