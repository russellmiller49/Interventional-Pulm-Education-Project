/** MV-02 audit. Run with tsx; emits real outputs, including the adverse and invalid readings. */
import {
  measurementInputs,
  updateHoldAcquisition,
  type CapturedHold,
} from '../engine/learningMeasurements'
import { peepComparisonSnapshot } from '../engine/peepComparison'
import { ventilationSimulationReducer } from '../engine/reducer'
import { advanceSimulation, createInitialSimulationState } from '../engine/simulation'
import type { VentilationAction, VentilationSimulationState } from '../engine/types'
import { causalSnapshot } from './causal-experiment'

export function acquireExampleHold(state: VentilationSimulationState) {
  const armed = ventilationSimulationReducer(state, { type: 'PERFORM_HOLD', hold: 'inspiratory' })
  let acquisition = updateHoldAcquisition(state, armed, 0).acquisition
  let current = armed
  let captured: CapturedHold | undefined
  for (let i = 0; i < 60 && !captured; i++) {
    const next = advanceSimulation(current, 0.1)
    const update = updateHoldAcquisition(current, next, 0, acquisition)
    acquisition = update.acquisition
    captured = update.captured
    current = next
  }
  if (!captured) throw new Error('The example hold did not complete')
  return { state: current, captured }
}

function holdSummary(state: VentilationSimulationState) {
  const { captured } = acquireExampleHold(state)
  return {
    requestedAt: state.simulationTime,
    startedAt: captured.startedAt,
    capturedAt: captured.capturedAt,
    value: captured.value,
    interpretable: captured.interpretable,
    reason: captured.reason,
    minPressure: Math.min(...captured.waveforms.map((s) => s.pawCmH2O)),
    maxPressure: Math.max(...captured.waveforms.map((s) => s.pawCmH2O)),
    maximumEffort: Math.max(...captured.waveforms.map((s) => -s.pmusCmH2O)),
  }
}

export function runPeepAudit() {
  const cold = createInitialSimulationState('MV-01', 'learn', 1, 'hamilton-c6')
  const arms: Record<string, readonly VentilationAction[]> = {
    wait: [],
    noopOxygen: [{ type: 'SET_CONTROL', control: 'oxygenPercent', value: 60 }],
    changedOxygen: [{ type: 'SET_CONTROL', control: 'oxygenPercent', value: 70 }],
    ...Object.fromEntries(
      [5, 7, 8, 10, 12, 13, 14, 15, 18].map((value) => [
        `peep${value}`,
        [{ type: 'SET_CONTROL', control: 'peepCmH2O', value }],
      ]),
    ),
  }
  const samples = [0, 30].flatMap((baselineSeconds) => {
    const baseline = baselineSeconds ? advanceSimulation(cold, baselineSeconds) : cold
    return Object.entries(arms).flatMap(([arm, actions]) => {
      const changed = actions.reduce(ventilationSimulationReducer, baseline)
      return [0, 5, 30, 45, 60, 120].map((elapsed) => {
        const state = elapsed ? advanceSimulation(changed, elapsed) : changed
        return {
          baselineSeconds,
          arm,
          elapsed,
          actions,
          ...causalSnapshot(state),
          ...peepComparisonSnapshot(state),
          inputs: measurementInputs(state),
          patientDrive: state.patient.drive,
          criticalErrors: state.criticalErrors,
          alarms: state.alarms.filter((alarm) => alarm.active),
        }
      })
    })
  })
  const baseline = advanceSimulation(cold, 30)
  const holds = [5, 10, 15].map((peep) => {
    const changed = ventilationSimulationReducer(baseline, {
      type: 'SET_CONTROL',
      control: 'peepCmH2O',
      value: peep,
    })
    return { peep, ...holdSummary(advanceSimulation(changed, 45)) }
  })
  return {
    conditions: {
      caseId: cold.caseId,
      branch: cold.branch,
      device: cold.deviceId,
      experience: cold.experience,
      seed: cold.seed,
      initializationPrimeSeconds: 4,
    },
    samples,
    holds,
    passiveHoldControl: {
      caseId: 'MV-LAB',
      ...holdSummary(advanceSimulation(createInitialSimulationState('MV-LAB'), 30)),
    },
  }
}

if (process.argv[1]?.endsWith('peep-experiment.ts')) {
  process.stdout.write(`${JSON.stringify(runPeepAudit(), null, 2)}\n`)
}
