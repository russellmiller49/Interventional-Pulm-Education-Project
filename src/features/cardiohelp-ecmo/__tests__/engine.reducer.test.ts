import {
  createInitialSimulationState,
  ecmoSimulationReducer,
  selectScenarioOutcome,
  type AlarmEvent,
  type EcmoSimulationState,
  type SimulationAction,
} from '../engine'
import { TIP_TO_TIP_CHECK_ID } from '../content/scenarios'
import { cardiohelpScenarioById } from '../content/scenarios'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { resolveScenarioReassessment } from '../content/practiceSupport'

function dispatchMany(
  initial: EcmoSimulationState,
  actions: readonly SimulationAction[],
): EcmoSimulationState {
  return actions.reduce(ecmoSimulationReducer, initial)
}

function reassessmentAnswers(scenarioId: string, correct = true) {
  const definition =
    clinicalPracticeScenarioById.get(scenarioId) ?? cardiohelpScenarioById.get(scenarioId)
  if (!definition) throw new Error(`Missing scenario: ${scenarioId}`)
  const reassessment = resolveScenarioReassessment(definition)
  const answerFor = (question: typeof reassessment.device) =>
    correct
      ? question.correctOptionId
      : (question.options.find((item) => item.id !== question.correctOptionId)?.id ?? '')
  return {
    deviceOptionId: answerFor(reassessment.device),
    circuitOptionId: answerFor(reassessment.circuit),
    patientOptionId: answerFor(reassessment.patient),
  }
}

describe('CARDIOHELP ECMO simulation reducer', () => {
  it('is deterministic for an identical one-second action sequence', () => {
    const actions: SimulationAction[] = [
      {
        type: 'COMMIT_PREDICTION',
        goalId: 'improve-acidemia',
        control: 'sweep',
        direction: 'increase',
      },
      { type: 'SET_SWEEP', sweep: 5 },
      { type: 'SET_PAUSED', paused: false },
      { type: 'TICK', seconds: 12 },
    ]
    const first = dispatchMany(createInitialSimulationState('acute-hypercapnia'), actions)
    const second = dispatchMany(createInitialSimulationState('acute-hypercapnia'), actions)

    expect(first).toEqual(second)
    expect(first.simulationTime).toBe(12)
    expect(first.patient.paCO2).toBeLessThan(68)
  })

  it('loads support mode from the scenario and resets cleanly between VA and VV', () => {
    let state = createInitialSimulationState('va-differential-hypoxemia')
    expect(state.supportMode).toBe('va')
    state = ecmoSimulationReducer(state, { type: 'STEP' })
    expect(state.simulationTime).toBe(1)

    state = ecmoSimulationReducer(state, {
      type: 'LOAD_SCENARIO',
      scenarioId: 'startup-sensor-orientation',
      mode: 'guided',
    })
    expect(state.supportMode).toBe('vv')
    expect(state.simulationTime).toBe(0)
    expect(state.scenario.prediction.committed).toBe(false)
    expect(state.scenario.activeFaults).toEqual(['startup-inspection'])
  })

  it('models bounded VA differential oxygenation and clears only after reviewed escalation', () => {
    let state = createInitialSimulationState('va-differential-hypoxemia')
    expect(state.patient.rightRadialSpo2).toBeLessThan(88)
    expect(state.patient.femoralArterialSpo2).toBeGreaterThan(95)
    expect(state.trends.at(-1)?.spo2).toBe(state.patient.rightRadialSpo2)
    expect(state.alarms.some((alarm) => alarm.code === 'RIGHT_RADIAL_LOW')).toBe(true)

    state = dispatchMany(state, [
      {
        type: 'COMMIT_PREDICTION',
        goalId: 'protect-upper-body',
        control: 'assess-upper-body',
        direction: 'inspect',
      },
      { type: 'CORRECT_FAULT', fault: 'differential-hypoxemia' },
      { type: 'SET_PAUSED', paused: false },
      { type: 'TICK', seconds: 12 },
    ])
    expect(state.scenario.activeFaults).not.toContain('differential-hypoxemia')
    expect(state.patient.rightRadialSpo2).toBeGreaterThan(88)
    expect(state.patient.femoralArterialSpo2).toBeLessThanOrEqual(100)
    expect(state.trends.at(-1)?.spo2).toBe(state.patient.rightRadialSpo2)
  })

  it('makes VA LV-loading cues independently observable without changing console flow into a diagnosis', () => {
    let state = createInitialSimulationState('va-lv-loading')
    expect(state.circuit.bloodFlow).toBeGreaterThan(3)
    expect(state.patient.pulsePressure).toBeLessThan(10)
    expect(state.patient.aorticValveOpening).toBe(false)
    expect(state.patient.pulmonaryCongestion).toBe('marked')

    state = dispatchMany(state, [
      {
        type: 'COMMIT_PREDICTION',
        goalId: 'protect-left-heart',
        control: 'assess-lv-loading',
        direction: 'inspect',
      },
      { type: 'CORRECT_FAULT', fault: 'lv-loading' },
      { type: 'STEP' },
    ])
    expect(state.patient.aorticValveOpening).toBe(true)
    expect(state.patient.pulmonaryCongestion).toBe('mild')
    expect(state.patient.pulsePressure).toBeGreaterThan(5)
  })

  it('does not transfer the VV off-sweep work-of-breathing rule into VA', () => {
    let state = createInitialSimulationState('va-startup-sensor-orientation')
    state = dispatchMany(state, [
      {
        type: 'COMMIT_PREDICTION',
        goalId: 'safe-startup',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      { type: 'SET_SWEEP', sweep: 0 },
      { type: 'SET_PAUSED', paused: false },
      { type: 'TICK', seconds: 25 },
    ])
    expect(state.supportMode).toBe('va')
    expect(state.patient.workOfBreathing).toBe('low')
  })

  it('holds corrective controls until a prediction is committed', () => {
    const initial = createInitialSimulationState('preload-drainage-collapse')
    const blocked = ecmoSimulationReducer(initial, { type: 'SET_RPM', rpm: 2800 })

    expect(blocked.device.rpmSetpoint).toBe(initial.device.rpmSetpoint)
    expect(blocked.history.at(-1)?.label).toContain('commit a prediction')
  })

  it('keeps simulated values within documented display bounds', () => {
    let state = createInitialSimulationState('preload-drainage-collapse')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'restore-drainage',
      control: 'rpm',
      direction: 'decrease',
    })
    state = ecmoSimulationReducer(state, { type: 'SET_RPM', rpm: 99_999 })
    state = ecmoSimulationReducer(state, { type: 'STEP' })

    expect(state.device.rpmSetpoint).toBeLessThanOrEqual(5000)
    expect(state.circuit.bloodFlow).toBeGreaterThanOrEqual(-9.99)
    expect(state.circuit.bloodFlow).toBeLessThanOrEqual(9.99)
    expect(state.circuit.pVen).toBeGreaterThanOrEqual(-500)
    expect(state.circuit.pInt).toBeLessThanOrEqual(900)
    expect(state.patient.pH).toBeGreaterThanOrEqual(6.8)
    expect(state.patient.pH).toBeLessThanOrEqual(7.7)
  })

  it('switches from LPM to RPM while preserving RPM when the flow sensor fails', () => {
    let state = createInitialSimulationState('startup-sensor-orientation')
    state = ecmoSimulationReducer(state, { type: 'SET_PUMP_MODE', mode: 'lpm' })
    const rpmBefore = state.device.rpmSetpoint
    state = ecmoSimulationReducer(state, { type: 'DISCONNECT_FLOW_SENSOR' })

    expect(state.device.pumpMode).toBe('rpm')
    expect(state.device.rpmSetpoint).toBe(rpmBefore)
    expect(state.circuit.flowSensorConnected).toBe(false)
    expect(state.alarms.some((alarm) => alarm.code === 'FLOW_SENSOR')).toBe(true)
  })

  it('applies pressure intervention and pump stop beyond the modeled intervention band', () => {
    let state = createInitialSimulationState('preload-drainage-collapse')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'restore-drainage',
      control: 'rpm',
      direction: 'decrease',
    })
    state = {
      ...state,
      device: {
        ...state.device,
        limits: { ...state.device.limits, pVenAlarmLow: -140 },
      },
    }
    state = ecmoSimulationReducer(state, { type: 'SET_RPM', rpm: 5000 })
    state = ecmoSimulationReducer(state, { type: 'STEP' })

    expect(state.circuit.pVen).toBeLessThan(state.device.limits.pVenAlarmLow - 10)
    expect(state.device.pumpRunning).toBe(false)
    expect(state.alarms[0]?.priority).toBe('high')
  })

  it('models independent drainage and return clamps as immediate flow isolation', () => {
    let state = createInitialSimulationState('acute-hypercapnia')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'improve-acidemia',
      control: 'sweep',
      direction: 'increase',
    })

    state = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'drainage',
    })
    expect(state.circuit.drainageClampClosed).toBe(true)
    expect(state.circuit.bloodFlow).toBe(0)
    expect(state.device.pumpRunning).toBe(false)
    expect(state.alarms.some((alarm) => alarm.code === 'CIRCUIT_CLAMP')).toBe(true)

    state = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'drainage',
    })
    expect(state.circuit.drainageClampClosed).toBe(false)
    expect(state.device.pumpRunning).toBe(true)
    expect(state.circuit.bloodFlow).toBeGreaterThan(0)

    state = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'return',
    })
    expect(state.circuit.returnClampClosed).toBe(true)
    expect(state.circuit.bloodFlow).toBe(0)
    expect(state.circuit.pArt).toBeGreaterThan(state.device.limits.pArtAlarmHigh)
  })

  it('retains only the latest six alarm-history events', () => {
    const initial = createInitialSimulationState('startup-sensor-orientation')
    const alarm = (index: number): AlarmEvent => ({
      id: `alarm-${index}`,
      code: `CODE_${index}`,
      message: `Alarm ${index}`,
      priority: 'low',
      source: 'device',
      startedAt: index,
      active: false,
    })
    const withHistory: EcmoSimulationState = {
      ...initial,
      alarmHistory: Array.from({ length: 9 }, (_, index) => alarm(index)),
    }
    const advanced = ecmoSimulationReducer(withHistory, { type: 'STEP' })

    expect(advanced.alarmHistory).toHaveLength(6)
  })

  it('auto-locks after three simulated minutes without a learner action', () => {
    let state = createInitialSimulationState('acute-hypercapnia')
    state = ecmoSimulationReducer(state, { type: 'SET_PAUSED', paused: false })
    state = ecmoSimulationReducer(state, { type: 'TICK', seconds: 60 })
    state = ecmoSimulationReducer(state, { type: 'TICK', seconds: 60 })
    state = ecmoSimulationReducer(state, { type: 'TICK', seconds: 60 })

    expect(state.simulationTime).toBe(180)
    expect(state.device.locked).toBe(true)
  })

  it('requires the separate safety control for zero flow and Global Override', () => {
    let state = createInitialSimulationState('acute-hypercapnia')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'improve-acidemia',
      control: 'sweep',
      direction: 'increase',
    })

    state = ecmoSimulationReducer(state, { type: 'TOGGLE_ZERO_FLOW' })
    expect(state.device.zeroFlowActive).toBe(false)
    expect(state.history.at(-1)?.label).toContain('requires Safety')

    state = ecmoSimulationReducer(state, { type: 'PRESS_SAFETY' })
    state = ecmoSimulationReducer(state, { type: 'TOGGLE_ZERO_FLOW' })
    expect(state.device.zeroFlowActive).toBe(true)
    expect(state.device.pumpRunning).toBe(true)
    expect(state.device.safetyHeld).toBe(false)

    state = ecmoSimulationReducer(state, { type: 'TOGGLE_GLOBAL_OVERRIDE' })
    expect(state.device.globalOverride).toBe(false)
    state = ecmoSimulationReducer(state, { type: 'PRESS_SAFETY' })
    state = ecmoSimulationReducer(state, { type: 'TOGGLE_GLOBAL_OVERRIDE' })
    expect(state.device.globalOverride).toBe(true)
    expect(state.scenario.criticalErrors).toContain('global-override')
  })

  it('keeps editable alarm limits bounded and in safe warning/alarm order', () => {
    let state = createInitialSimulationState('startup-sensor-orientation')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'safe-startup',
      control: 'inspect-circuit',
      direction: 'inspect',
    })
    state = ecmoSimulationReducer(state, {
      type: 'ADJUST_LIMIT',
      parameter: 'pVenAlarmLow',
      delta: 1000,
    })
    state = ecmoSimulationReducer(state, {
      type: 'ADJUST_LIMIT',
      parameter: 'flowLow',
      delta: 100,
    })

    expect(state.device.limits.pVenAlarmLow).toBeLessThanOrEqual(state.device.limits.pVenWarningLow)
    expect(state.device.limits.flowLow).toBeLessThanOrEqual(state.device.limits.flowHigh)
    expect(state.device.limits.flowLow).toBeLessThanOrEqual(9.9)
  })

  it('pauses an alarm without resolving its cause and penalizes failure to correct it', () => {
    let state = createInitialSimulationState('gas-source-interruption')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'restore-gas-transfer',
      control: 'restore-gas',
      direction: 'restore',
    })
    state = ecmoSimulationReducer(state, { type: 'INJECT_FAULT', fault: 'gas-source-interruption' })
    state = ecmoSimulationReducer(state, { type: 'STEP' })
    state = ecmoSimulationReducer(state, { type: 'ACK_ALARM' })

    expect(state.gas.sourceConnected).toBe(false)
    expect(state.scenario.activeFaults).toContain('gas-source-interruption')
    expect(state.scenario.criticalErrors).not.toContain('ack-without-correction')

    state = ecmoSimulationReducer(state, { type: 'SET_PAUSED', paused: false })
    state = ecmoSimulationReducer(state, { type: 'TICK', seconds: 60 })
    expect(state.scenario.criticalErrors).not.toContain('ack-without-correction')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_REASSESSMENT',
      answers: reassessmentAnswers('gas-source-interruption'),
    })
    expect(state.scenario.criticalErrors).toContain('ack-without-correction')
    expect(state.scenario.credit.cause).toBe(false)
  })

  it('models pInt high-pressure intervention and truthful bypass alarm copy', () => {
    let state = createInitialSimulationState('afterload-oxygenator-resistance')
    state = {
      ...state,
      device: {
        ...state.device,
        limits: { ...state.device.limits, pIntAlarmHigh: 250, pIntWarningHigh: 200 },
      },
    }
    state = ecmoSimulationReducer(state, { type: 'STEP' })
    expect(state.device.pumpRunning).toBe(false)
    expect(state.alarms.some((alarm) => alarm.code === 'PINT_STOP')).toBe(true)

    const bypassed = ecmoSimulationReducer(
      {
        ...state,
        device: { ...state.device, pumpRunning: true, globalOverride: true },
      },
      { type: 'STEP' },
    )
    expect(bypassed.device.pumpRunning).toBe(true)
    expect(bypassed.alarms.find((alarm) => alarm.code === 'PINT_STOP')?.message).toContain(
      'bypassed',
    )
    expect(bypassed.alarms.find((alarm) => alarm.code === 'PINT_STOP')?.priority).toBe('low')
  })

  it('uses low-priority alarms when bubble intervention is disabled', () => {
    let state = createInitialSimulationState('arterial-bubble-stop')
    state = {
      ...state,
      device: { ...state.device, bubbleInterventionEnabled: false },
    }
    state = ecmoSimulationReducer(state, { type: 'INJECT_FAULT', fault: 'arterial-bubble' })
    state = ecmoSimulationReducer(state, { type: 'STEP' })

    expect(state.device.pumpRunning).toBe(true)
    expect(state.alarms.find((alarm) => alarm.code === 'ART_BUBBLE')).toMatchObject({
      priority: 'low',
      message: expect.stringContaining('bypassed'),
    })
  })

  it('activates zero-flow protection after sustained backflow', () => {
    let state = createInitialSimulationState('preload-drainage-collapse')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'restore-drainage',
      control: 'rpm',
      direction: 'decrease',
    })
    state = ecmoSimulationReducer(state, { type: 'SET_RPM', rpm: 100 })
    state = ecmoSimulationReducer(state, { type: 'STEP' })
    expect(state.device.zeroFlowActive).toBe(false)
    expect(state.alarms.find((alarm) => alarm.code === 'BACKFLOW')?.priority).toBe('medium')
    for (let second = 0; second < 5; second += 1) {
      state = ecmoSimulationReducer(state, { type: 'STEP' })
    }

    expect(state.device.zeroFlowActive).toBe(true)
    expect(state.device.pumpRunning).toBe(true)
    expect(state.circuit.bloodFlow).toBe(0)
    expect(state.alarms.some((alarm) => alarm.code === 'BACKFLOW')).toBe(true)
    expect(state.alarms.find((alarm) => alarm.code === 'BACKFLOW')?.priority).toBe('high')
  })

  it('keeps sustained backflow alarm-only during Global Override', () => {
    let state = createInitialSimulationState('preload-drainage-collapse')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'restore-drainage',
      control: 'rpm',
      direction: 'decrease',
    })
    state = { ...state, device: { ...state.device, globalOverride: true } }
    state = ecmoSimulationReducer(state, { type: 'SET_RPM', rpm: 100 })
    for (let second = 0; second < 6; second += 1) {
      state = ecmoSimulationReducer(state, { type: 'STEP' })
    }

    expect(state.device.zeroFlowActive).toBe(false)
    expect(state.alarms.find((alarm) => alarm.code === 'BACKFLOW')).toMatchObject({
      priority: 'high',
      message: expect.stringContaining('bypassed'),
    })
  })

  it('restarts the six-second backflow timer after zero-flow protection is released', () => {
    let state = createInitialSimulationState('preload-drainage-collapse')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'restore-drainage',
      control: 'rpm',
      direction: 'decrease',
    })
    state = ecmoSimulationReducer(state, { type: 'SET_RPM', rpm: 100 })
    for (let second = 0; second < 6; second += 1) {
      state = ecmoSimulationReducer(state, { type: 'STEP' })
    }
    expect(state.device.zeroFlowActive).toBe(true)

    state = ecmoSimulationReducer(state, { type: 'PRESS_SAFETY' })
    state = ecmoSimulationReducer(state, { type: 'TOGGLE_ZERO_FLOW' })
    expect(state.device.zeroFlowActive).toBe(false)
    expect(state.circuit.backflowSeconds).toBe(0)
    state = ecmoSimulationReducer(state, { type: 'STEP' })
    expect(state.device.zeroFlowActive).toBe(false)
    expect(state.circuit.backflowSeconds).toBe(1)
  })

  it('starts, stops, and resets console timers explicitly', () => {
    let state = createInitialSimulationState('startup-sensor-orientation')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'safe-startup',
      control: 'inspect-circuit',
      direction: 'inspect',
    })
    state = ecmoSimulationReducer(state, { type: 'TOGGLE_TIMER', timerIndex: 0 })
    state = ecmoSimulationReducer(state, { type: 'STEP' })
    expect(state.device.timers[0]).toBe(1)
    state = ecmoSimulationReducer(state, { type: 'TOGGLE_TIMER', timerIndex: 0 })
    state = ecmoSimulationReducer(state, { type: 'STEP' })
    expect(state.device.timers[0]).toBe(1)
    state = ecmoSimulationReducer(state, { type: 'RESET_TIMER', timerIndex: 0 })
    expect(state.device.timers[0]).toBe(0)
  })

  it('requires bubble cause correction before reset', () => {
    let state = createInitialSimulationState('arterial-bubble-stop')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'prevent-air-return',
      control: 'correct-cause',
      direction: 'inspect',
    })
    state = ecmoSimulationReducer(state, { type: 'INJECT_FAULT', fault: 'arterial-bubble' })
    state = ecmoSimulationReducer(state, { type: 'RESET_BUBBLE' })

    expect(state.circuit.bubbleResetRequired).toBe(true)
    expect(state.scenario.criticalErrors).toContain('premature-bubble-reset')

    state = ecmoSimulationReducer(state, { type: 'CORRECT_FAULT', fault: 'arterial-bubble' })
    state = ecmoSimulationReducer(state, { type: 'RESET_BUBBLE' })
    expect(state.circuit.bubbleResetRequired).toBe(false)
    expect(state.device.pumpRunning).toBe(true)
  })

  it('treats targeted clamp actions as idempotent and blocks unsafe unclamping before de-air', () => {
    let state = createInitialSimulationState('arterial-bubble-stop')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'prevent-air-return',
      control: 'correct-cause',
      direction: 'inspect',
    })
    state = ecmoSimulationReducer(state, { type: 'INJECT_FAULT', fault: 'arterial-bubble' })
    expect(state.device.pumpRunning).toBe(false)

    state = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'return',
      closed: true,
    })
    // Re-dispatching the same target is a no-op rather than a toggle.
    const afterRepeat = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'return',
      closed: true,
    })
    expect(afterRepeat).toBe(state)
    expect(state.circuit.returnClampClosed).toBe(true)

    state = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'drainage',
      closed: true,
    })

    // Opening a clamp while uncorrected circuit air is present is a critical error.
    const unsafeOpen = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'return',
      closed: false,
    })
    expect(unsafeOpen.scenario.criticalErrors).toContain('unsafe-unclamp-before-deair')

    // The safe path: correct the source first, then unclamp in order.
    state = ecmoSimulationReducer(state, { type: 'CORRECT_FAULT', fault: 'arterial-bubble' })
    state = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'drainage',
      closed: false,
    })
    state = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'return',
      closed: false,
    })
    expect(state.scenario.criticalErrors).not.toContain('unsafe-unclamp-before-deair')
    // The bubble latch still holds the pump until the console reset.
    expect(state.device.pumpRunning).toBe(false)
    state = ecmoSimulationReducer(state, { type: 'RESET_BUBBLE' })
    expect(state.device.pumpRunning).toBe(true)
    state = ecmoSimulationReducer(state, { type: 'STEP' })
    expect(state.circuit.bloodFlow).toBeGreaterThan(0)
  })

  it('drives the circuit-air case through prompted clamp interventions to auto-resumed support', () => {
    let state = createInitialSimulationState('clinical-vv-circuit-air-embolism')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'prevent-air-return',
      control: 'isolate-circuit',
      direction: 'definitive',
    })
    expect(state.device.pumpRunning).toBe(false)

    // Out-of-order clamp is not credited: drainage requires the return clamp first.
    const outOfOrder = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'drainage',
      closed: true,
    })
    expect(
      outOfOrder.scenario.clinical?.appliedInterventions.some(
        (record) => record.interventionId === 'air-clamp-drainage',
      ),
    ).toBe(false)

    state = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'return',
      closed: true,
    })
    state = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'drainage',
      closed: true,
    })
    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: 'air-deair',
    })
    state = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'drainage',
      closed: false,
    })
    state = ecmoSimulationReducer(state, {
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'return',
      closed: false,
    })

    const appliedIds = state.scenario.clinical?.appliedInterventions.map(
      (record) => record.interventionId,
    )
    expect(appliedIds).toEqual([
      'air-clamp-return',
      'air-clamp-drainage',
      'air-deair',
      'air-unclamp-drainage',
      'air-unclamp-return',
    ])
    expect(state.scenario.correctedFaults).toContain('arterial-bubble')
    expect(state.scenario.criticalErrors).toHaveLength(0)
    expect(state.device.pumpRunning).toBe(true)
    state = ecmoSimulationReducer(state, { type: 'STEP' })
    expect(state.circuit.bloodFlow).toBeGreaterThan(0)
  })

  it('does not let an unrelated inspection silently correct the scenario cause', () => {
    let state = createInitialSimulationState('startup-sensor-orientation')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'safe-startup',
      control: 'inspect-circuit',
      direction: 'inspect',
    })
    state = ecmoSimulationReducer(state, {
      type: 'PERFORM_CHECK',
      checkId: 'unrelated-check',
    })

    expect(state.scenario.activeFaults).toContain('startup-inspection')
    expect(state.scenario.credit.cause).toBe(false)
    expect(state.circuit.circuitInspected).toBe(true)
  })

  it('enforces maintained blood flow and ordered delayed reassessment in the capstone', () => {
    let safe = createInitialSimulationState('vv-off-sweep-capstone')
    safe = ecmoSimulationReducer(safe, {
      type: 'COMMIT_PREDICTION',
      goalId: 'test-native-lung',
      control: 'off-sweep-trial',
      direction: 'off',
    })
    safe = ecmoSimulationReducer(safe, { type: 'SET_SWEEP', sweep: 0 })
    safe = ecmoSimulationReducer(safe, {
      type: 'COMMIT_REASSESSMENT',
      answers: reassessmentAnswers('vv-off-sweep-capstone'),
    })
    expect(safe.scenario.credit.reassessment).toBe(false)

    safe = ecmoSimulationReducer(safe, { type: 'SET_PAUSED', paused: false })
    safe = ecmoSimulationReducer(safe, { type: 'TICK', seconds: 20 })
    safe = ecmoSimulationReducer(safe, {
      type: 'COMMIT_REASSESSMENT',
      answers: reassessmentAnswers('vv-off-sweep-capstone'),
    })
    expect(safe.scenario.credit.reassessment).toBe(true)
    expect(selectScenarioOutcome(safe).mastery).toBe(true)

    let unsafe = createInitialSimulationState('vv-off-sweep-capstone')
    unsafe = ecmoSimulationReducer(unsafe, {
      type: 'COMMIT_PREDICTION',
      goalId: 'test-native-lung',
      control: 'off-sweep-trial',
      direction: 'off',
    })
    unsafe = ecmoSimulationReducer(unsafe, { type: 'SET_RPM', rpm: 2500 })
    expect(unsafe.scenario.criticalErrors).toContain('capstone-flow-reduction')
  })

  it('enforces VA capstone sweep safety and a delayed multi-domain reassessment', () => {
    let safe = createInitialSimulationState('va-mixed-circulation-capstone')
    safe = ecmoSimulationReducer(safe, {
      type: 'COMMIT_PREDICTION',
      goalId: 'protect-upper-body',
      control: 'assess-upper-body',
      direction: 'inspect',
    })
    safe = ecmoSimulationReducer(safe, {
      type: 'CORRECT_FAULT',
      fault: 'differential-hypoxemia',
    })
    safe = ecmoSimulationReducer(safe, { type: 'SET_PAUSED', paused: false })
    safe = ecmoSimulationReducer(safe, { type: 'TICK', seconds: 10 })
    safe = ecmoSimulationReducer(safe, {
      type: 'COMMIT_REASSESSMENT',
      answers: reassessmentAnswers('va-mixed-circulation-capstone'),
    })
    expect(safe.scenario.credit.reassessment).toBe(true)
    expect(selectScenarioOutcome(safe).mastery).toBe(true)

    let unsafe = createInitialSimulationState('va-mixed-circulation-capstone')
    unsafe = ecmoSimulationReducer(unsafe, {
      type: 'COMMIT_PREDICTION',
      goalId: 'protect-upper-body',
      control: 'assess-upper-body',
      direction: 'inspect',
    })
    unsafe = ecmoSimulationReducer(unsafe, { type: 'SET_SWEEP', sweep: 0 })
    expect(unsafe.scenario.criticalErrors).toContain('va-sweep-off')

    unsafe = ecmoSimulationReducer(unsafe, {
      type: 'CORRECT_FAULT',
      fault: 'differential-hypoxemia',
    })
    unsafe = ecmoSimulationReducer(unsafe, { type: 'SET_PAUSED', paused: false })
    unsafe = ecmoSimulationReducer(unsafe, { type: 'TICK', seconds: 10 })
    unsafe = ecmoSimulationReducer(unsafe, {
      type: 'COMMIT_REASSESSMENT',
      answers: reassessmentAnswers('va-mixed-circulation-capstone', false),
    })
    expect(unsafe.scenario.credit.reassessment).toBe(false)
    expect(selectScenarioOutcome(unsafe).mastery).toBe(false)
  })

  it('records a complete reassessment submission even when its content does not earn credit', () => {
    let state = createInitialSimulationState('va-clinical-differential-hypoxemia')
    state = dispatchMany(state, [
      {
        type: 'COMMIT_PREDICTION',
        goalId: 'protect-upper-body',
        control: 'assess-upper-body',
        direction: 'gas-exchange',
      },
      { type: 'CORRECT_FAULT', fault: 'differential-hypoxemia' },
      { type: 'SET_PAUSED', paused: false },
      { type: 'TICK', seconds: 4 },
      {
        type: 'COMMIT_REASSESSMENT',
        answers: reassessmentAnswers('va-clinical-differential-hypoxemia', false),
      },
    ])

    expect(state.scenario.reassessment).toEqual(
      reassessmentAnswers('va-clinical-differential-hypoxemia', false),
    )
    expect(state.scenario.phase).toBe('debrief')
    expect(state.scenario.credit.reassessment).toBe(false)

    state = ecmoSimulationReducer(state, { type: 'REVEAL_DEBRIEF' })
    expect(state.scenario.phase).toBe('complete')
    expect(selectScenarioOutcome(state).mastery).toBe(false)
  })

  it('deducts scored clues once and reports the reduced maximum score', () => {
    const definition = clinicalPracticeScenarioById.get('clinical-vv-occult-hemorrhage')!
    let state = createInitialSimulationState(definition.id)
    state = {
      ...state,
      scenario: {
        ...state.scenario,
        credit: { goal: true, control: true, direction: true, cause: true, reassessment: true },
      },
    }
    const firstHint = definition.hints![0]
    const secondHint = definition.hints![1]

    state = ecmoSimulationReducer(state, { type: 'REQUEST_HINT', hintId: firstHint.id })
    state = ecmoSimulationReducer(state, { type: 'REQUEST_HINT', hintId: firstHint.id })
    expect(state.scenario.usedHintIds).toEqual([firstHint.id])
    expect(state.scenario.hintPenalty).toBe(5)
    expect(selectScenarioOutcome(state)).toMatchObject({
      score: 95,
      hintPenalty: 5,
      maximumScoreAfterHints: 95,
    })

    state = ecmoSimulationReducer(state, { type: 'REQUEST_HINT', hintId: secondHint.id })
    expect(selectScenarioOutcome(state)).toMatchObject({
      score: 85,
      hintPenalty: 15,
      maximumScoreAfterHints: 85,
      mastery: true,
    })
  })

  it('scores all five objectives and blocks mastery after a critical error', () => {
    let safe = createInitialSimulationState('startup-sensor-orientation')
    safe = dispatchMany(safe, [
      {
        type: 'COMMIT_PREDICTION',
        goalId: 'safe-startup',
        control: 'inspect-circuit',
        direction: 'inspect',
      },
      { type: 'PERFORM_CHECK', checkId: 'tip-to-tip' },
      { type: 'PERFORM_CHECK', checkId: TIP_TO_TIP_CHECK_ID },
      { type: 'STEP' },
      {
        type: 'COMMIT_REASSESSMENT',
        answers: reassessmentAnswers('startup-sensor-orientation'),
      },
      { type: 'REVEAL_DEBRIEF' },
    ])
    expect(selectScenarioOutcome(safe)).toMatchObject({ score: 100, mastery: true })

    let unsafe = createInitialSimulationState('preload-drainage-collapse')
    unsafe = dispatchMany(unsafe, [
      {
        type: 'COMMIT_PREDICTION',
        goalId: 'restore-drainage',
        control: 'rpm',
        direction: 'decrease',
      },
      { type: 'SET_RPM', rpm: 3900 },
    ])
    expect(selectScenarioOutcome(unsafe).mastery).toBe(false)
    expect(selectScenarioOutcome(unsafe).criticalErrors).toContain('rpm-during-collapse')
  })
})
