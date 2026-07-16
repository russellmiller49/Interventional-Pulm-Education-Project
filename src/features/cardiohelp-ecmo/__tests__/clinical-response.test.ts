import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import {
  createInitialSimulationState,
  ecmoSimulationReducer,
  selectScenarioOutcome,
  type EcmoSimulationState,
  type SimulationAction,
} from '../engine'

function dispatchMany(
  initial: EcmoSimulationState,
  actions: readonly SimulationAction[],
): EcmoSimulationState {
  return actions.reduce(ecmoSimulationReducer, initial)
}

function commitExpectedPrediction(scenarioId: string): EcmoSimulationState {
  const definition = clinicalPracticeScenarioById.get(scenarioId)
  if (!definition) throw new Error(`Missing clinical Practice case: ${scenarioId}`)

  return ecmoSimulationReducer(createInitialSimulationState(scenarioId, 'challenge'), {
    type: 'COMMIT_PREDICTION',
    goalId: definition.expectation.goalId,
    control: definition.expectation.control,
    direction: definition.expectation.direction,
  })
}

describe('CARDIOHELP clinical Practice response engine', () => {
  it('requires readiness, connection, and the supplied settings before starting VV ECMO', () => {
    let state = commitExpectedPrediction('clinical-vv-initiation-ards')

    state = ecmoSimulationReducer(state, { type: 'START_ECMO' })
    expect(state.device.pumpRunning).toBe(false)
    expect(state.scenario.clinical?.supportStatus).toBe('not-on-ecmo')
    expect(state.scenario.clinical?.lastResponse).toMatch(/readiness and connection/i)
    expect(state.scenario.activeFaults).toContain('ecmo-not-initiated')

    state = dispatchMany(state, [
      { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: 'vv-readiness-check' },
      { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: 'vv-connect-circuit' },
      { type: 'START_ECMO' },
    ])
    expect(state.device.pumpRunning).toBe(false)
    expect(state.scenario.clinical?.supportStatus).toBe('ready-to-start')
    expect(state.scenario.clinical?.lastResponse).toMatch(/do not match/i)

    state = dispatchMany(state, [
      { type: 'SET_RPM', rpm: 3200 },
      { type: 'SET_SWEEP', sweep: 4 },
      { type: 'SET_GAS_FIO2', fio2: 1 },
      { type: 'START_ECMO' },
    ])

    expect(state.device.pumpRunning).toBe(true)
    expect(state.scenario.clinical?.supportStatus).toBe('on-ecmo')
    expect(state.scenario.clinical?.trajectory).toBe('improving')
    expect(state.scenario.activeFaults).not.toContain('ecmo-not-initiated')
    expect(state.scenario.correctedFaults).toContain('ecmo-not-initiated')
    expect(state.scenario.clinical?.appliedInterventions.at(-1)).toMatchObject({
      interventionId: 'start-ecmo',
      effect: 'definitive',
    })
  })

  it('does not resolve occult hemorrhage until assessment, blood support, and source control are complete', () => {
    let state = commitExpectedPrediction('clinical-vv-occult-hemorrhage')

    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: 'hemorrhage-crystalloid',
    })
    expect(state.scenario.activeFaults).toContain('hemorrhagic-hypovolemia')
    expect(state.scenario.clinical?.trajectory).toBe('temporarily-stabilized')

    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: 'hemorrhage-source-control',
    })
    expect(state.scenario.clinical?.lastResponse).toMatch(/complete first/i)
    expect(
      state.scenario.clinical?.appliedInterventions.some(
        (record) => record.interventionId === 'hemorrhage-source-control',
      ),
    ).toBe(false)
    expect(state.scenario.activeFaults).toContain('hemorrhagic-hypovolemia')

    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: 'hemorrhage-reduce-rpm',
    })
    expect(state.device.rpmSetpoint).toBe(3600)
    expect(state.scenario.clinical?.lastResponse).toMatch(/completed on the simulator/i)
    expect(
      state.scenario.clinical?.appliedInterventions.some(
        (record) => record.interventionId === 'hemorrhage-reduce-rpm',
      ),
    ).toBe(false)

    state = dispatchMany(state, [
      { type: 'SET_RPM', rpm: 3200 },
      { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: 'hemorrhage-search' },
      { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: 'hemorrhage-prbc' },
    ])
    expect(state.scenario.activeFaults).toContain('hemorrhagic-hypovolemia')
    expect(state.circuit.hemoglobin).toBeGreaterThanOrEqual(8.7)

    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: 'hemorrhage-source-control',
    })
    expect(state.scenario.activeFaults).not.toContain('hemorrhagic-hypovolemia')
    expect(state.scenario.correctedFaults).toContain('hemorrhagic-hypovolemia')
    expect(state.scenario.clinical?.trajectory).toBe('improving')
    expect(state.patient.meanArterialPressure).toBeGreaterThanOrEqual(65)
    expect(state.patient.centralVenousPressure).toBeGreaterThanOrEqual(7)
    expect(state.circuit.drainageChatter).toBe(false)
    expect(state.circuit.pVen).toBeGreaterThan(-75)
  })

  it('requires gas-source and sweep corrections through the external simulator controls', () => {
    let state = commitExpectedPrediction('clinical-vv-gas-disconnection')

    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: 'gas-inspect-path',
    })
    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: 'gas-reconnect',
    })
    expect(state.gas.sourceConnected).toBe(false)
    expect(state.scenario.clinical?.lastResponse).toMatch(/completed on the simulator/i)

    state = ecmoSimulationReducer(state, { type: 'RESTORE_GAS_SOURCE' })
    expect(state.gas.sourceConnected).toBe(true)
    expect(
      state.scenario.clinical?.appliedInterventions.some(
        (record) => record.interventionId === 'gas-reconnect',
      ),
    ).toBe(true)
    expect(state.scenario.activeFaults).toContain('gas-source-interruption')

    state = ecmoSimulationReducer(state, { type: 'SET_SWEEP', sweep: 4 })
    expect(
      state.scenario.clinical?.appliedInterventions.some(
        (record) => record.interventionId === 'gas-set-sweep',
      ),
    ).toBe(true)
    expect(state.scenario.activeFaults).not.toContain('gas-source-interruption')
    expect(state.scenario.clinical?.trajectory).toBe('improving')
  })

  it('keeps tension physiology active after temporizing volume and clears it after decompression', () => {
    let state = commitExpectedPrediction('clinical-vv-tension-pneumothorax')

    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: 'tension-volume',
    })
    expect(state.scenario.activeFaults).toContain('tension-pneumothorax')
    expect(state.scenario.clinical?.trajectory).toBe('temporarily-stabilized')
    expect(state.scenario.penalties).toBe(20)
    expect(state.patient.lungSliding).toBe('absent-right')

    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: 'tension-decompress',
    })
    expect(state.scenario.activeFaults).not.toContain('tension-pneumothorax')
    expect(state.scenario.correctedFaults).toContain('tension-pneumothorax')
    expect(state.scenario.clinical?.trajectory).toBe('improving')
    expect(state.patient.lungSliding).toBe('bilateral')
    expect(state.patient.airwayPressure).toBeLessThanOrEqual(25)
    expect(state.patient.centralVenousPressure).toBeLessThanOrEqual(10)
  })

  it('lets a temporary response fade into renewed deterioration while the cause remains active', () => {
    let state = commitExpectedPrediction('clinical-vv-tension-pneumothorax')

    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: 'tension-volume',
    })
    expect(state.scenario.clinical?.trajectory).toBe('temporarily-stabilized')

    state = dispatchMany(state, [{ type: 'STEP' }, { type: 'STEP' }, { type: 'STEP' }])

    expect(state.scenario.clinical?.trajectory).toBe('deteriorating')
    expect(state.scenario.clinical?.lastResponse).toMatch(/untreated tension/i)
    expect(state.patient.meanArterialPressure).toBeLessThan(51)
    expect(state.scenario.activeFaults).toContain('tension-pneumothorax')
  })

  it('penalizes blind RPM escalation during recirculation without resolving the cause', () => {
    let state = commitExpectedPrediction('clinical-vv-recirculation-migration')

    state = ecmoSimulationReducer(state, { type: 'SET_RPM', rpm: 3900 })

    expect(state.device.rpmSetpoint).toBe(3900)
    expect(state.patient.spo2).toBe(74)
    expect(state.scenario.activeFaults).toContain('recirculation')
    expect(state.scenario.correctedFaults).not.toContain('recirculation')
    expect(state.scenario.clinical?.trajectory).toBe('deteriorating')
    expect(state.scenario.criticalErrors).toContain('unsafe-clinical-shortcut')
    expect(state.scenario.penalties).toBe(40)
    expect(selectScenarioOutcome(state).mastery).toBe(false)
  })

  it('keeps the corrected trajectory and refreshed circuit after a later temporizing action', () => {
    let state = commitExpectedPrediction('clinical-vv-occult-hemorrhage')

    state = dispatchMany(state, [
      { type: 'SET_RPM', rpm: 3200 },
      { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: 'hemorrhage-search' },
      { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: 'hemorrhage-prbc' },
      { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: 'hemorrhage-source-control' },
      { type: 'APPLY_CLINICAL_INTERVENTION', interventionId: 'hemorrhage-vasopressor' },
    ])

    expect(state.scenario.activeFaults).not.toContain('hemorrhagic-hypovolemia')
    expect(state.scenario.clinical?.trajectory).toBe('improving')
    expect(state.scenario.clinical?.lastResponse).toMatch(/hemorrhage is controlled/i)
    expect(state.circuit.drainageChatter).toBe(false)
  })
})
