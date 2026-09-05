import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import { ecmoLearnPredictionFor } from '../content/learnPredictionItems'
import { resolveScenarioReassessment } from '../content/practiceSupport'
import { cardiohelpScenarioById } from '../content/scenarios'
import {
  createInitialSimulationState,
  ecmoSimulationReducer,
  selectScenarioOutcome,
} from '../engine'
import type { EcmoSimulationState, SimulationAction, SimulationMode } from '../engine/types'

/**
 * Scoring honesty (R4 I6, owner decision D-4 lifted for B6-001/002/004/005/006/007/012/015).
 *
 * One block per lifted defect. Each drives the unsafe path end to end through the real reducer —
 * commit, act, reassess, reveal — and asserts that the run does not earn mastery and names the
 * error; a sibling positive path proves the case is still completable the honest way. A negative
 * path that silently passes is exactly the defect these blocks exist to exclude, so none of them
 * asserts the copy: they assert the state.
 */

function definitionOf(id: string) {
  const definition = clinicalPracticeScenarioById.get(id) ?? cardiohelpScenarioById.get(id)
  if (!definition) throw new Error(`No scenario ${id}`)
  return definition
}

function run(state: EcmoSimulationState, actions: readonly SimulationAction[]) {
  return actions.reduce(ecmoSimulationReducer, state)
}

function tick(state: EcmoSimulationState, seconds: number) {
  return run(state, [
    { type: 'SET_PAUSED', paused: false },
    { type: 'TICK', seconds },
    { type: 'SET_PAUSED', paused: true },
  ])
}

function commitExpectation(state: EcmoSimulationState) {
  const { expectation } = definitionOf(state.scenario.scenarioId)
  return ecmoSimulationReducer(state, {
    type: 'COMMIT_PREDICTION',
    goalId: expectation.goalId,
    control: expectation.control,
    direction: expectation.direction,
  })
}

function reassessCorrectly(state: EcmoSimulationState) {
  const reassessment = resolveScenarioReassessment(definitionOf(state.scenario.scenarioId))
  return ecmoSimulationReducer(state, {
    type: 'COMMIT_REASSESSMENT',
    answers: {
      deviceOptionId: reassessment.device.correctOptionId,
      circuitOptionId: reassessment.circuit.correctOptionId,
      patientOptionId: reassessment.patient.correctOptionId,
    },
  })
}

function reveal(state: EcmoSimulationState) {
  return ecmoSimulationReducer(state, { type: 'REVEAL_DEBRIEF' })
}

const MODES: readonly SimulationMode[] = ['guided', 'challenge']

describe('B6-005 — committed plan credit is immutable', () => {
  it('a wholly wrong capstone plan cannot master through later correct actions', () => {
    let state = createInitialSimulationState('vv-off-sweep-capstone')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'relieve-obstruction',
      control: 'rpm',
      direction: 'increase',
    })
    // The correct action, taken after the wrong plan.
    state = ecmoSimulationReducer(state, { type: 'SET_SWEEP', sweep: 0 })
    state = tick(state, 20)
    state = reveal(reassessCorrectly(state))

    expect(state.scenario.credit).toMatchObject({ goal: false, control: false, direction: false })
    expect(state.scenario.credit.cause).toBe(true)
    expect(state.scenario.execution).toEqual({ controlMatched: true, directionMatched: true })
    expect(selectScenarioOutcome(state).mastery).toBe(false)
  })

  it('the same capstone still masters when the plan was right', () => {
    let state = createInitialSimulationState('vv-off-sweep-capstone')
    state = commitExpectation(state)
    state = ecmoSimulationReducer(state, { type: 'SET_SWEEP', sweep: 0 })
    state = tick(state, 20)
    state = reveal(reassessCorrectly(state))
    expect(state.scenario.credit).toMatchObject({ goal: true, control: true, direction: true })
    expect(selectScenarioOutcome(state).mastery).toBe(true)
  })

  it('a wrong clinical plan is not rewritten by the interventions that follow it', () => {
    let state = createInitialSimulationState('clinical-vv-occult-hemorrhage', 'guided')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'relieve-obstruction',
      control: 'rpm',
      direction: 'increase',
    })
    // The case's prompted machine task is done on the console, then the bedside interventions.
    state = ecmoSimulationReducer(state, { type: 'SET_RPM', rpm: 3200 })
    for (const interventionId of definitionOf(state.scenario.scenarioId).clinicalCase!
      .requiredInterventionIds) {
      state = ecmoSimulationReducer(state, { type: 'APPLY_CLINICAL_INTERVENTION', interventionId })
    }
    expect(state.scenario.correctedFaults).toContain('hemorrhagic-hypovolemia')
    state = tick(state, 6)
    state = reveal(reassessCorrectly(state))
    expect(state.scenario.credit).toMatchObject({ goal: false, control: false, direction: false })
    expect(state.scenario.execution?.controlMatched).toBe(true)
    expect(selectScenarioOutcome(state).mastery).toBe(false)
  })
})

describe('B6-002 — isolation before air correction', () => {
  const bubbleDrills = ['arterial-bubble-stop', 'va-arterial-bubble-stop'] as const

  it.each(bubbleDrills.flatMap((id) => MODES.map((mode) => [id, mode] as const)))(
    '%s (%s): correcting, resuming and reassessing without ever clamping earns no cause credit and no mastery',
    (scenarioId, mode) => {
      let state = commitExpectation(createInitialSimulationState(scenarioId, mode))
      state = tick(state, 4)
      expect(state.scenario.activeFaults).toContain('arterial-bubble')
      expect(state.device.pumpRunning).toBe(false)

      state = run(state, [
        { type: 'CORRECT_FAULT', fault: 'arterial-bubble' },
        { type: 'RESET_BUBBLE' },
        { type: 'RESUME_SUPPORT_AFTER_BUBBLE' },
      ])
      state = tick(state, 6)
      state = reveal(reassessCorrectly(state))

      expect(state.scenario.criticalErrors).toContain('air-correction-before-isolation')
      expect(state.scenario.credit.cause).toBe(false)
      expect(state.scenario.correctedFaults).not.toContain('arterial-bubble')
      expect(selectScenarioOutcome(state).mastery).toBe(false)
    },
  )

  it.each(bubbleDrills)('%s: isolating first still completes cleanly', (scenarioId) => {
    let state = commitExpectation(createInitialSimulationState(scenarioId, 'guided'))
    state = tick(state, 4)
    state = run(state, [
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true },
      { type: 'CORRECT_FAULT', fault: 'arterial-bubble' },
      { type: 'RESUME_SUPPORT_AFTER_BUBBLE' },
    ])
    expect(state.scenario.criticalErrors).toEqual([])
    expect(state.scenario.credit.cause).toBe(true)
    expect(state.circuit.drainageClampClosed).toBe(false)
    expect(state.circuit.returnClampClosed).toBe(false)
    expect(state.device.pumpRunning).toBe(true)
    state = tick(state, 6)
    state = reveal(reassessCorrectly(state))
    expect(selectScenarioOutcome(state).mastery).toBe(true)
  })

  it('the clinical air case refuses de-airing while the patient is on the air column', () => {
    let state = commitExpectation(
      createInitialSimulationState('clinical-vv-circuit-air-embolism', 'guided'),
    )
    state = tick(state, 4)
    expect(state.circuit.arterialBubbleDetected).toBe(true)
    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: 'air-deair',
    })
    expect(state.circuit.arterialBubbleDetected).toBe(true)
    expect(state.scenario.criticalErrors).toContain('air-correction-before-isolation')
    expect(selectScenarioOutcome(state).mastery).toBe(false)
  })
})

describe('B6-004 — reducing support on reserve power', () => {
  const transports = ['transport-power-loss', 'va-transport-power-loss'] as const

  it.each(transports)('%s: slowing the pump on battery is a critical error', (scenarioId) => {
    let state = commitExpectation(createInitialSimulationState(scenarioId, 'guided'))
    state = tick(state, 3)
    expect(state.device.powerSource).toBe('battery')
    const before = state.circuit.bloodFlow
    state = ecmoSimulationReducer(state, { type: 'SET_RPM', rpm: state.device.rpmSetpoint - 1000 })
    state = tick(state, 3)
    expect(state.circuit.bloodFlow).toBeLessThan(before)
    expect(state.scenario.criticalErrors).toContain('support-reduction-on-battery')
    state = ecmoSimulationReducer(state, { type: 'RESTORE_AC_POWER' })
    state = tick(state, 6)
    state = reveal(reassessCorrectly(state))
    expect(selectScenarioOutcome(state).mastery).toBe(false)
  })

  it.each(transports)('%s: restoring power with support untouched still masters', (scenarioId) => {
    let state = commitExpectation(createInitialSimulationState(scenarioId, 'guided'))
    state = tick(state, 3)
    state = ecmoSimulationReducer(state, { type: 'RESTORE_AC_POWER' })
    expect(state.scenario.criticalErrors).toEqual([])
    state = tick(state, 6)
    state = reveal(reassessCorrectly(state))
    expect(selectScenarioOutcome(state).mastery).toBe(true)
  })

  it.each(transports)(
    '%s: the reassessment counts only with support back at the speed the case opened at',
    (scenarioId) => {
      let state = commitExpectation(createInitialSimulationState(scenarioId, 'guided'))
      const opening = state.device.rpmSetpoint
      state = tick(state, 3)
      // A learner who slowed the pump before restoring power is charged, and the case also
      // withholds the reassessment until support is back where the case began (B6-004).
      state = ecmoSimulationReducer(state, { type: 'SET_RPM', rpm: opening - 400 })
      state = ecmoSimulationReducer(state, { type: 'RESTORE_AC_POWER' })
      state = tick(state, 6)
      const lowered = reassessCorrectly(state)
      expect(lowered.scenario.credit.reassessment).toBe(false)
      const restored = reassessCorrectly(
        tick(ecmoSimulationReducer(state, { type: 'SET_RPM', rpm: opening }), 6),
      )
      expect(restored.scenario.credit.reassessment).toBe(true)
      // The earlier reduction still stands against mastery.
      expect(selectScenarioOutcome(reveal(restored)).mastery).toBe(false)
    },
  )

  it('the lower flow target and zero flow are charged the same way on battery', () => {
    let state = commitExpectation(createInitialSimulationState('transport-power-loss', 'guided'))
    state = tick(state, 3)
    const zero = run(state, [{ type: 'PRESS_SAFETY' }, { type: 'TOGGLE_ZERO_FLOW' }])
    expect(zero.scenario.criticalErrors).toContain('support-reduction-on-battery')
  })
})

describe('every safety event the model can raise has an authored label', () => {
  it.each([
    ['arterial-bubble-stop', 'air-correction-before-isolation'],
    ['va-arterial-bubble-stop', 'air-correction-before-isolation'],
    ['clinical-vv-circuit-air-embolism', 'air-correction-before-isolation'],
    ['va-clinical-circuit-air-embolism', 'air-correction-before-isolation'],
    ['transport-power-loss', 'support-reduction-on-battery'],
    ['va-transport-power-loss', 'support-reduction-on-battery'],
  ])('%s registers %s so the debrief never prints an identifier', (scenarioId, penaltyId) => {
    const penalty = definitionOf(scenarioId).unsafeActionPenalties.find(
      (item) => item.id === penaltyId,
    )
    expect(penalty).toBeDefined()
    expect(penalty?.critical).toBe(true)
    // A sentence, not the key: the label is what `describeSafetyEvent` puts in front of the learner.
    expect(penalty?.label).not.toBe(penaltyId)
    expect(penalty?.label).toMatch(/\s/)
  })
})

describe('B6-012 — the patient does not move at an unchanged clock', () => {
  it('clamps, correction and resumption leave the patient exactly as it was until the clock moves', () => {
    let state = commitExpectation(createInitialSimulationState('arterial-bubble-stop', 'guided'))
    state = tick(state, 4)
    const frozenPatient = state.patient
    const trendCount = state.trends.length
    const sequence: readonly SimulationAction[] = [
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return', closed: true },
      { type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage', closed: true },
      { type: 'CORRECT_FAULT', fault: 'arterial-bubble' },
      { type: 'RESUME_SUPPORT_AFTER_BUBBLE' },
    ]
    for (const action of sequence) {
      state = ecmoSimulationReducer(state, action)
      expect(state.patient).toEqual(frozenPatient)
      // One sample per second: the same-time recomputation replaces, it does not append.
      expect(state.trends.length).toBe(trendCount)
    }
    state = ecmoSimulationReducer(state, { type: 'STEP' })
    expect(state.trends.length).toBe(trendCount + 1)
    expect(state.patient).not.toEqual(frozenPatient)
  })

  it('an authored patient change from an intervention lands on the next second, not at once', () => {
    let state = commitExpectation(
      createInitialSimulationState('clinical-vv-tension-pneumothorax', 'guided'),
    )
    const before = state.patient
    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: 'tension-decompress',
    })
    expect(state.scenario.correctedFaults).toContain('tension-pneumothorax')
    expect(state.patient).toEqual(before)
    state = ecmoSimulationReducer(state, { type: 'STEP' })
    expect(state.patient.lungSliding).toBe('bilateral')
  })
})

describe('B6-006 — recognition is not treatment', () => {
  it('reviewing the upper body on VA earns the case, but the right arm does not recover by itself', () => {
    let state = commitExpectation(createInitialSimulationState('va-differential-hypoxemia'))
    const before = state.patient.rightRadialSpo2
    expect(before).toBeLessThan(88)
    state = ecmoSimulationReducer(state, { type: 'CORRECT_FAULT', fault: 'differential-hypoxemia' })
    expect(state.scenario.credit.cause).toBe(true)
    state = tick(state, 30)
    expect(state.patient.rightRadialSpo2).toBeLessThanOrEqual(before + 0.5)
    expect(state.alarms.some((alarm) => alarm.code === 'RIGHT_RADIAL_LOW' && alarm.active)).toBe(
      true,
    )
    // Still completable: recognition plus an honest reassessment is what the case asks for.
    state = reveal(reassessCorrectly(state))
    expect(selectScenarioOutcome(state).mastery).toBe(true)
  })

  it('recognising a loading left ventricle does not open the valve or restore the pulse', () => {
    let state = commitExpectation(createInitialSimulationState('va-lv-loading'))
    const pulseBefore = state.patient.pulsePressure
    expect(state.patient.aorticValveOpening).toBe(false)
    state = ecmoSimulationReducer(state, { type: 'CORRECT_FAULT', fault: 'lv-loading' })
    state = tick(state, 30)
    expect(state.patient.aorticValveOpening).toBe(false)
    expect(state.patient.pulsePressure).toBeLessThanOrEqual(pulseBefore + 0.5)
    expect(state.patient.pulmonaryCongestion).toBe('marked')
    state = reveal(reassessCorrectly(state))
    expect(selectScenarioOutcome(state).mastery).toBe(true)
  })
})

describe('B6-007 — no oxygen is added by a membrane that gets no gas', () => {
  it('with sweep at zero the post-oxygenator saturation falls toward the venous estimate', () => {
    let state = commitExpectation(createInitialSimulationState('vv-off-sweep-capstone'))
    state = ecmoSimulationReducer(state, { type: 'SET_SWEEP', sweep: 0 })
    const start = state.circuit.postOxygenatorSaturation
    let previous = start
    for (let second = 0; second < 20; second += 1) {
      state = ecmoSimulationReducer(state, { type: 'STEP' })
      expect(state.circuit.postOxygenatorSaturation).toBeLessThanOrEqual(previous)
      previous = state.circuit.postOxygenatorSaturation
    }
    expect(previous).toBeLessThan(start - 5)
    expect(previous).toBeGreaterThanOrEqual(state.patient.systemicVenousSaturationEstimate - 0.1)
  })

  it('an interrupted gas source lowers it and a restored one raises it again', () => {
    let state = commitExpectation(createInitialSimulationState('gas-source-interruption'))
    state = tick(state, 5)
    expect(state.gas.sourceConnected).toBe(false)
    const atInterruption = state.circuit.postOxygenatorSaturation
    state = tick(state, 8)
    const interrupted = state.circuit.postOxygenatorSaturation
    expect(interrupted).toBeLessThan(atInterruption)
    state = ecmoSimulationReducer(state, { type: 'RESTORE_GAS_SOURCE' })
    state = tick(state, 8)
    expect(state.circuit.postOxygenatorSaturation).toBeGreaterThan(interrupted)
  })
})

describe('B6-001 — the VA preload verdict agrees with the engine', () => {
  function settled(rpm: number) {
    let state = createInitialSimulationState('va-preload-drainage-collapse', 'guided')
    state = ecmoSimulationReducer(state, { type: 'SET_RPM', rpm })
    for (let second = 0; second < 12; second += 1) {
      state = ecmoSimulationReducer(state, { type: 'STEP' })
    }
    return state
  }

  it('asking the pump for more does not raise the flow once drainage is the limit', () => {
    const opening = createInitialSimulationState('va-preload-drainage-collapse', 'guided').device
      .rpmSetpoint
    const flows = [0, 300, 600, 900].map((extra) => settled(opening + extra).circuit.bloodFlow)
    for (let index = 1; index < flows.length; index += 1) {
      expect(flows[index]).toBeLessThanOrEqual(flows[index - 1]! + 0.01)
    }
  })

  it('and the item no longer says the flow creeps upward', () => {
    const prediction = ecmoLearnPredictionFor('va-preload-drainage-collapse')
    if (!prediction) throw new Error('missing VA preload prediction')
    const text = [prediction.item.explanation, ...prediction.item.choices.map((c) => c.rationale)]
      .join(' ')
      .toLowerCase()
    expect(text).not.toMatch(/creeps? upward/)
    expect(text).toMatch(/no longer rises|falls a little/)
  })
})
