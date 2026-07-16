import { mechanicalVentilationCaseById } from '../content'
import {
  advanceSimulation,
  createDefaultProgress,
  createInitialSimulationState,
  hasCaseMastery,
  HAMILTON_C6_PROGRESS_STORAGE_KEY,
  parseProgress,
  readProgress,
  recordCaseResult,
  selectCaseOutcome,
  ventilationSimulationReducer,
  writeProgress,
  type VentilationAction,
  type VentilationSimulationState,
} from '../engine'

function dispatchMany(
  state: VentilationSimulationState,
  actions: readonly VentilationAction[],
): VentilationSimulationState {
  return actions.reduce(ventilationSimulationReducer, state)
}

function commitCorrect(state: VentilationSimulationState): VentilationSimulationState {
  const definition = mechanicalVentilationCaseById.get(state.caseId)!
  return ventilationSimulationReducer(state, {
    type: 'COMMIT_PREDICTION',
    mechanismId: definition.correctMechanismId,
    priorityId: definition.correctPriorityId,
    responseId: definition.correctResponseId,
  })
}

describe('HAMILTON-C6 reducer and progress boundary', () => {
  beforeEach(() => window.localStorage.clear())

  it('blocks ventilator and bedside therapy until a Practice prediction is committed', () => {
    const initial = createInitialSimulationState('MV-01', 'practice')
    const blockedControl = ventilationSimulationReducer(initial, {
      type: 'SET_CONTROL',
      control: 'peepCmH2O',
      value: 10,
    })
    const blockedIntervention = ventilationSimulationReducer(initial, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'inspiratory-hold',
    })
    expect(blockedControl.ventilator.settings.peepCmH2O).toBe(initial.ventilator.settings.peepCmH2O)
    expect(blockedIntervention.interventions).toHaveLength(0)
    expect(blockedIntervention.lastResponse).toMatch(/commit/i)

    const committed = commitCorrect(initial)
    const changed = ventilationSimulationReducer(committed, {
      type: 'SET_CONTROL',
      control: 'peepCmH2O',
      value: 10,
    })
    expect(changed.ventilator.settings.peepCmH2O).toBe(10)
  })

  it('keeps Learn and Practice clean and isolated', () => {
    let learn = createInitialSimulationState('MV-11', 'learn')
    learn = ventilationSimulationReducer(learn, {
      type: 'SET_CONTROL',
      control: 'pRampMs',
      value: 100,
    })
    learn = ventilationSimulationReducer(learn, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'assess-patient',
    })
    const practice = ventilationSimulationReducer(learn, {
      type: 'LOAD_CASE',
      caseId: 'MV-11',
      experience: 'practice',
      attempt: 2,
    })
    expect(practice.experience).toBe('practice')
    expect(practice.prediction.committed).toBe(false)
    expect(practice.interventions).toHaveLength(0)
    expect(practice.ventilator.settings.mode).toBe('spont')
    if (practice.ventilator.settings.mode === 'spont') {
      expect(practice.ventilator.settings.pRampMs).toBe(200)
    }
  })

  it('clamps controls to the locked C6 range and supports flow/pressure triggers', () => {
    let state = createInitialSimulationState('MV-11', 'learn')
    state = dispatchMany(state, [
      { type: 'SET_CONTROL', control: 'pRampMs', value: 900 },
      { type: 'SET_CONTROL', control: 'triggerType', value: 'pressure' },
      { type: 'SET_CONTROL', control: 'triggerThreshold', value: -99 },
    ])
    expect(state.ventilator.settings.mode).toBe('spont')
    if (state.ventilator.settings.mode === 'spont') {
      expect(state.ventilator.settings.pRampMs).toBe(200)
      expect(state.ventilator.settings.trigger).toEqual({
        type: 'pressure',
        thresholdCmH2O: -15,
      })
    }
  })

  it('enforces Adult/Ped mode-specific trigger and pressure-control limits', () => {
    let state = createInitialSimulationState('MV-01', 'learn')
    state = ventilationSimulationReducer(state, {
      type: 'SET_CONTROL',
      control: 'triggerThreshold',
      value: 0,
    })
    expect(state.ventilator.settings.trigger).toEqual({ type: 'flow', thresholdLMin: 1 })

    state = dispatchMany(state, [
      { type: 'SELECT_MODE', mode: 'pcv-plus' },
      { type: 'CONFIRM_MODE' },
      { type: 'SET_CONTROL', control: 'deltaPControlCmH2O', value: 0 },
      { type: 'SET_CONTROL', control: 'inspiratoryTimeSeconds', value: 0.3 },
      { type: 'SET_CONTROL', control: 'pRampMs', value: 1000 },
    ])
    expect(state.ventilator.settings.mode).toBe('pcv-plus')
    if (state.ventilator.settings.mode === 'pcv-plus') {
      expect(state.ventilator.settings.deltaPControlCmH2O).toBe(5)
      expect(state.ventilator.settings.pRampMs).toBe(100)
    }

    state = dispatchMany(state, [
      { type: 'SELECT_MODE', mode: 'spont' },
      { type: 'CONFIRM_MODE' },
      { type: 'SET_CONTROL', control: 'triggerThreshold', value: 0 },
      { type: 'SET_CONTROL', control: 'apneaRatePerMin', value: 0 },
      { type: 'SET_CONTROL', control: 'tubeInnerDiameterMm', value: 0 },
    ])
    expect(state.ventilator.settings.mode).toBe('spont')
    if (state.ventilator.settings.mode === 'spont') {
      expect(state.ventilator.settings.trigger).toEqual({ type: 'flow', thresholdLMin: 0.5 })
      expect(state.ventilator.settings.apneaRatePerMin).toBe(5)
      expect(state.ventilator.settings.tubeInnerDiameterMm).toBe(3)
    }
  })

  it('selects a mode, confirms it at a breath boundary, and preserves common controls', () => {
    let state = createInitialSimulationState('MV-01', 'learn')
    state = ventilationSimulationReducer(state, {
      type: 'SET_CONTROL',
      control: 'oxygenPercent',
      value: 55,
    })
    state = ventilationSimulationReducer(state, { type: 'SELECT_MODE', mode: 'spont' })
    expect(state.ventilator.settings.mode).toBe('scmv')
    expect(state.ventilator.pendingMode).toBe('spont')
    state = ventilationSimulationReducer(state, { type: 'CONFIRM_MODE' })
    expect(state.ventilator.pendingMode).toBeNull()
    expect(state.ventilator.settings.mode).toBe('spont')
    expect(state.ventilator.settings.oxygenPercent).toBe(55)
    expect(state.lastResponse).toMatch(/breath boundary/i)
  })

  it('supports pause, one-breath stepping, 1x/5x/30x speed, and freeze', () => {
    let state = createInitialSimulationState('MV-01', 'learn')
    const before = state.simulationTime
    state = ventilationSimulationReducer(state, { type: 'STEP_BREATH' })
    expect(state.simulationTime).toBeGreaterThan(before)
    state = dispatchMany(state, [
      { type: 'SET_SPEED', speed: 30 },
      { type: 'SET_PAUSED', paused: false },
      { type: 'TICK', seconds: 0.1 },
    ])
    expect(state.simulationTime).toBeGreaterThan(before + 3)
    state = ventilationSimulationReducer(state, { type: 'TOGGLE_FREEZE' })
    const frozenLength = state.waveforms.length
    state = ventilationSimulationReducer(state, { type: 'TICK', seconds: 0.1 })
    expect(state.waveforms).toHaveLength(frozenLength)
  })

  it('runs holds, manual breath, O₂ enrichment, screen lock, and alarm acknowledgement', () => {
    let state = createInitialSimulationState('MV-14', 'learn')
    state = dispatchMany(state, [
      { type: 'PERFORM_HOLD', hold: 'inspiratory' },
      { type: 'MANUAL_BREATH' },
      { type: 'OXYGEN_ENRICHMENT' },
    ])
    expect(state.ventilator.holdType).toBe('inspiratory')
    expect(state.ventilator.manualBreathUntil).toBeGreaterThan(state.simulationTime)
    expect(state.ventilator.oxygenEnrichmentUntil).toBeGreaterThan(state.simulationTime)
    state = advanceSimulation(state, 1)
    expect(state.alarms.some((alarm) => alarm.priority === 'high')).toBe(true)
    state = ventilationSimulationReducer(state, { type: 'ACK_ALARM' })
    expect(state.alarms.every((alarm) => alarm.acknowledgedAt !== undefined)).toBe(true)
    state = ventilationSimulationReducer(state, { type: 'TOGGLE_LOCK' })
    const lockedPeep = state.ventilator.settings.peepCmH2O
    state = ventilationSimulationReducer(state, {
      type: 'SET_CONTROL',
      control: 'peepCmH2O',
      value: lockedPeep + 4,
    })
    expect(state.ventilator.settings.peepCmH2O).toBe(lockedPeep)
  })

  it('honors delayed medication effects and immediate setting response', () => {
    let state = commitCorrect(createInitialSimulationState('MV-13', 'practice', 1))
    state = ventilationSimulationReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'inspect-circuit',
    })
    const resistanceBefore = state.patient.mechanics.resistanceCmH2OPerLps
    const branchAction =
      state.branch === 'secretions'
        ? 'suction-airway'
        : state.branch === 'hme-or-ett'
          ? 'remove-hme'
          : 'bronchodilator'
    state = ventilationSimulationReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: branchAction,
    })
    expect(state.patient.mechanics.resistanceCmH2OPerLps).toBe(resistanceBefore)
    const effectiveAt = state.interventions.at(-1)!.effectiveAt
    state = advanceSimulation(state, effectiveAt - state.simulationTime + 1)
    expect(state.patient.mechanics.resistanceCmH2OPerLps).toBeLessThan(resistanceBefore)
  })

  it('unlocks hints after 60 simulated seconds, charges Practice, and hides them when timed', () => {
    let state = commitCorrect(createInitialSimulationState('MV-01', 'practice'))
    const early = ventilationSimulationReducer(state, { type: 'USE_HINT' })
    expect(early.hintsUsed).toBe(0)
    state = advanceSimulation(state, 60)
    state = ventilationSimulationReducer(state, { type: 'USE_HINT' })
    expect(state.hintsUsed).toBe(1)
    state = ventilationSimulationReducer(state, {
      type: 'SET_CHALLENGE_MODE',
      challengeMode: 'timed',
    })
    state = ventilationSimulationReducer(state, { type: 'USE_HINT' })
    expect(state.hintsUsed).toBe(1)
  })

  it('scores the declared 20/20/30/20/10 domains and blocks mastery after a critical error', () => {
    const definition = mechanicalVentilationCaseById.get('MV-11')!
    let state = commitCorrect(createInitialSimulationState('MV-11', 'practice'))
    state = dispatchMany(state, [
      { type: 'SET_CONTROL', control: 'pRampMs', value: 100 },
      { type: 'PERFORM_INTERVENTION', interventionId: 'communicate-plan' },
      { type: 'PERFORM_INTERVENTION', interventionId: 'review-waveforms' },
      { type: 'PERFORM_INTERVENTION', interventionId: 'assess-patient' },
      { type: 'COMMIT_REASSESSMENT' },
    ])
    const outcome = selectCaseOutcome(state, definition)
    expect(outcome.domains).toEqual({
      safety: 20,
      mechanism: 20,
      correctiveActions: 30,
      reassessment: 20,
      communicationComfort: 10,
    })
    expect(outcome).toMatchObject({ score: 100, mastery: true, resolved: true })
    const unsafeOutcome = selectCaseOutcome(
      { ...state, criticalErrors: ['Synthetic safety regression'] },
      definition,
    )
    expect(unsafeOutcome.mastery).toBe(false)
  })

  it('parses and stores only versioned non-PHI aggregate progress', () => {
    const outcome = {
      score: 86,
      mastery: true,
      resolved: true,
      criticalErrors: [],
      domains: {
        safety: 20,
        mechanism: 20,
        correctiveActions: 26,
        reassessment: 20,
        communicationComfort: 10,
      },
    }
    const progress = recordCaseResult(createDefaultProgress(), { caseId: 'MV-01', outcome })
    writeProgress(progress)
    const raw = window.localStorage.getItem(HAMILTON_C6_PROGRESS_STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(raw).not.toMatch(/waveform|physiology|patient|freeText/i)
    expect(readProgress()).toEqual(progress)
    expect(hasCaseMastery(progress, 'MV-01')).toBe(true)

    const withForbiddenExtras = JSON.stringify({
      ...progress,
      waveforms: [{ time: 1 }],
      patient: { name: 'not allowed' },
    })
    expect(parseProgress(withForbiddenExtras)).toEqual(progress)
    expect(parseProgress('{"version":2}')).toBeNull()
    expect(parseProgress('not json')).toBeNull()
  })
})
