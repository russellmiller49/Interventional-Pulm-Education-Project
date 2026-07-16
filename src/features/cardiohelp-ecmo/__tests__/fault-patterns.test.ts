import {
  createInitialSimulationState,
  ecmoSimulationReducer,
  type EcmoSimulationState,
  type PredictionControl,
  type PredictionDirection,
  type SimulationAction,
} from '../engine'
import { cardiohelpScenarioById } from '../content/scenarios'

function predictedState(scenarioId: string): EcmoSimulationState {
  const definition = cardiohelpScenarioById.get(scenarioId)!
  return ecmoSimulationReducer(createInitialSimulationState(scenarioId), {
    type: 'COMMIT_PREDICTION',
    goalId: definition.expectation.goalId,
    control: definition.expectation.control as PredictionControl,
    direction: definition.expectation.direction as PredictionDirection,
  })
}

function run(state: EcmoSimulationState, actions: readonly SimulationAction[]) {
  return actions.reduce(ecmoSimulationReducer, state)
}

describe('CARDIOHELP ECMO injected fault observability', () => {
  it('creates the expected preload-limited pattern and clears after cause correction', () => {
    let state = run(predictedState('preload-drainage-collapse'), [{ type: 'STEP' }])
    expect(state.circuit.pVen).toBeLessThan(-75)
    expect(state.circuit.drainageChatter).toBe(true)
    expect(state.circuit.bloodFlow).toBeLessThan(3.5)

    state = run(state, [
      { type: 'SET_RPM', rpm: 3000 },
      { type: 'CORRECT_FAULT', fault: 'preload-limited' },
      { type: 'STEP' },
    ])
    expect(state.circuit.drainageChatter).toBe(false)
    expect(state.circuit.pVen).toBeGreaterThan(-75)
  })

  it('differentiates return obstruction from oxygenator resistance', () => {
    const returnState = run(predictedState('afterload-return-obstruction'), [{ type: 'STEP' }])
    const oxygenatorState = run(predictedState('afterload-oxygenator-resistance'), [
      { type: 'STEP' },
    ])

    expect(returnState.circuit.pArt).toBeGreaterThan(280)
    expect(returnState.circuit.deltaP).toBeLessThan(80)
    expect(oxygenatorState.circuit.pInt).toBeGreaterThan(oxygenatorState.circuit.pArt)
    expect(oxygenatorState.circuit.deltaP).toBeGreaterThan(120)
  })

  it('shows ineffective support during recirculation despite preserved displayed flow', () => {
    const state = run(predictedState('vv-recirculation'), [
      { type: 'SET_PAUSED', paused: false },
      { type: 'TICK', seconds: 8 },
    ])
    expect(state.circuit.bloodFlow).toBeGreaterThan(4)
    expect(state.circuit.preOxygenatorSaturation).toBeGreaterThan(80)
    expect(state.patient.spo2).toBeLessThan(93)
  })

  it('changes PaCO2 with sweep while keeping sweep-gas FiO2 a separate action', () => {
    const initial = predictedState('acute-hypercapnia')
    const afterSweep = run(initial, [
      { type: 'SET_SWEEP', sweep: 6 },
      { type: 'SET_PAUSED', paused: false },
      { type: 'TICK', seconds: 12 },
    ])
    const afterFio2 = run(initial, [
      { type: 'SET_GAS_FIO2', fio2: 0.5 },
      { type: 'SET_PAUSED', paused: false },
      { type: 'TICK', seconds: 12 },
    ])
    expect(afterSweep.patient.paCO2).toBeLessThan(afterFio2.patient.paCO2)
  })

  it('keeps blood flow present during gas-source loss while gas exchange deteriorates', () => {
    let state = predictedState('gas-source-interruption')
    state = run(state, [
      { type: 'SET_PAUSED', paused: false },
      { type: 'TICK', seconds: 14 },
    ])
    expect(state.gas.sourceConnected).toBe(false)
    expect(state.circuit.bloodFlow).toBeGreaterThan(3)
    expect(state.patient.paCO2).toBeGreaterThan(50)
    expect(state.alarms.some((alarm) => alarm.code === 'GAS_SOURCE')).toBe(true)

    state = run(state, [{ type: 'RESTORE_GAS_SOURCE' }, { type: 'TICK', seconds: 6 }])
    expect(state.gas.sourceConnected).toBe(true)
    expect(state.scenario.activeFaults).not.toContain('gas-source-interruption')
  })

  it('stops for the scenario bubble event without encoding bubble size', () => {
    const state = run(predictedState('arterial-bubble-stop'), [
      { type: 'SET_PAUSED', paused: false },
      { type: 'TICK', seconds: 5 },
    ])
    expect(state.circuit.arterialBubbleDetected).toBe(true)
    expect(state.device.pumpRunning).toBe(false)
    expect(state.alarms[0]).toMatchObject({ code: 'ART_BUBBLE', priority: 'high' })
  })

  it('escalates transport battery state and recovers after verified power restoration', () => {
    let state = run(predictedState('transport-power-loss'), [
      { type: 'SET_PAUSED', paused: false },
      { type: 'TICK', seconds: 20 },
    ])
    expect(state.device.powerSource).toBe('battery')
    expect(state.device.batteryPercent).toBeLessThan(20)
    expect(state.alarms.some((alarm) => alarm.code === 'BATTERY_MODE')).toBe(true)

    state = ecmoSimulationReducer(state, { type: 'RESTORE_AC_POWER' })
    expect(state.device.powerSource).toBe('ac')
    expect(state.scenario.activeFaults).not.toContain('ac-power-loss')
  })

  it('maintains circuit blood flow during the VV off-sweep capstone', () => {
    const initial = predictedState('vv-off-sweep-capstone')
    const flowBefore = initial.circuit.bloodFlow
    const state = run(initial, [
      { type: 'SET_SWEEP', sweep: 0 },
      { type: 'SET_PAUSED', paused: false },
      { type: 'TICK', seconds: 25 },
    ])
    expect(state.gas.sweepLpm).toBe(0)
    expect(state.circuit.bloodFlow).toBeCloseTo(flowBefore, 1)
    expect(state.patient.workOfBreathing).not.toBe('low')
  })
})
