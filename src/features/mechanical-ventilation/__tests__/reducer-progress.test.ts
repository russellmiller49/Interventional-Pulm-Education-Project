import { mechanicalVentilationCaseById } from '../content'
import {
  advanceSimulation,
  createDefaultProgress,
  createInitialSimulationState,
  deviceCaseAttemptKey,
  hasCaseMastery,
  LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY,
  MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY,
  nextCaseAttempt,
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

describe('mechanical ventilation reducer and progress boundary', () => {
  beforeEach(() => window.localStorage.clear())

  it('keeps ventilator and bedside therapy open before a Practice prediction is committed', () => {
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
    expect(blockedControl.ventilator.settings.peepCmH2O).toBe(10)
    expect(blockedIntervention.interventions).toHaveLength(1)
    expect(blockedIntervention.lastResponse).not.toMatch(/commit/i)

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
    expect(practice.ventilator.settings.mode).toBe('pressure-support')
    if (practice.ventilator.settings.mode === 'pressure-support') {
      expect(practice.ventilator.settings.pRampMs).toBe(200)
    }
  })

  it('reloads the same case and pathway at time zero when the device changes', () => {
    const definition = mechanicalVentilationCaseById.get('MV-11')!
    let state = createInitialSimulationState('MV-11', 'practice')
    state = ventilationSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      mechanismId: definition.correctMechanismId,
      priorityId: definition.correctPriorityId,
      responseId: definition.correctResponseId,
    })
    state = ventilationSimulationReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: 'review-waveforms',
    })
    state = ventilationSimulationReducer(state, {
      type: 'SELECT_MODE',
      mode: 'volume-ac',
    })
    const staleAlarm = {
      id: 'stale-device-alarm',
      code: 'STALE',
      message: 'Must not cross device boundary',
      priority: 'high' as const,
      startedAt: 99,
      active: true,
    }
    state = { ...state, alarms: [staleAlarm], alarmHistory: [staleAlarm] }
    const previousWaveforms = state.waveforms

    const changed = ventilationSimulationReducer(state, {
      type: 'CHANGE_DEVICE',
      deviceId: 'drager-evita-v800-v600',
      attempt: 2,
    })
    expect(changed.deviceId).toBe('drager-evita-v800-v600')
    expect(changed.caseId).toBe('MV-11')
    expect(changed.experience).toBe('practice')
    expect(changed.simulationTime).toBe(0)
    expect(changed.interventions).toEqual([])
    expect(changed.prediction).toEqual({
      committed: false,
      mechanismId: null,
      priorityId: null,
      responseId: null,
    })
    expect(changed.reassessment).toEqual({ committed: false, actionIds: [] })
    expect(changed.alarms.some((alarm) => alarm.id === staleAlarm.id)).toBe(false)
    expect(changed.alarmHistory.some((alarm) => alarm.id === staleAlarm.id)).toBe(false)
    expect(changed.ventilator.pendingMode).toBeNull()
    expect(changed.criticalErrors).toEqual([])
    expect(changed.lastResponse).toBeNull()
    expect(changed.waveforms).not.toBe(previousWaveforms)
    expect(Math.max(...changed.waveforms.map((sample) => sample.time))).toBeCloseTo(0, 6)
    expect(changed.ventilator.settings.mode).toBe('pressure-support')
    if (changed.ventilator.settings.mode === 'pressure-support') {
      expect(changed.ventilator.settings.pRampMs).toBe(600)
    }
  })

  it('clamps controls to the locked C6 range and supports flow/pressure triggers', () => {
    let state = createInitialSimulationState('MV-11', 'learn')
    state = dispatchMany(state, [
      { type: 'SET_CONTROL', control: 'pRampMs', value: 900 },
      { type: 'SET_CONTROL', control: 'triggerType', value: 'pressure' },
      { type: 'SET_CONTROL', control: 'triggerThreshold', value: -99 },
    ])
    expect(state.ventilator.settings.mode).toBe('pressure-support')
    if (state.ventilator.settings.mode === 'pressure-support') {
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
      { type: 'SELECT_MODE', mode: 'pressure-ac' },
      { type: 'CONFIRM_MODE' },
      { type: 'SET_CONTROL', control: 'deltaPControlCmH2O', value: 0 },
      { type: 'SET_CONTROL', control: 'inspiratoryTimeSeconds', value: 0.3 },
      { type: 'SET_CONTROL', control: 'pRampMs', value: 1000 },
    ])
    expect(state.ventilator.settings.mode).toBe('pressure-ac')
    if (state.ventilator.settings.mode === 'pressure-ac') {
      expect(state.ventilator.settings.deltaPControlCmH2O).toBe(5)
      expect(state.ventilator.settings.pRampMs).toBe(100)
    }

    state = dispatchMany(state, [
      { type: 'SELECT_MODE', mode: 'pressure-support' },
      { type: 'CONFIRM_MODE' },
      { type: 'SET_CONTROL', control: 'triggerThreshold', value: 0 },
      { type: 'SET_CONTROL', control: 'apneaRatePerMin', value: 0 },
      { type: 'SET_CONTROL', control: 'tubeInnerDiameterMm', value: 0 },
    ])
    expect(state.ventilator.settings.mode).toBe('pressure-support')
    if (state.ventilator.settings.mode === 'pressure-support') {
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
    state = ventilationSimulationReducer(state, { type: 'SELECT_MODE', mode: 'pressure-support' })
    expect(state.ventilator.settings.mode).toBe('volume-ac')
    expect(state.ventilator.pendingMode).toBe('pressure-support')
    state = ventilationSimulationReducer(state, { type: 'CONFIRM_MODE' })
    expect(state.ventilator.pendingMode).toBeNull()
    expect(state.ventilator.settings.mode).toBe('pressure-support')
    expect(state.ventilator.settings.oxygenPercent).toBe(55)
    expect(state.lastResponse).toMatch(/breath boundary/i)
  })

  it('confirms advanced native modes while retaining a canonical physiology base', () => {
    let state = createInitialSimulationState('MV-01', 'learn', 1, 'puritan-bennett-980')
    state = ventilationSimulationReducer(state, {
      type: 'SELECT_MODE',
      mode: 'adaptive-pressure-simv',
    })
    expect(state.ventilator.pendingMode).toBe('adaptive-pressure-simv')
    expect(state.ventilator.settings.deviceMode).toBe('volume-ac')

    state = ventilationSimulationReducer(state, { type: 'CONFIRM_MODE' })
    expect(state.ventilator.pendingMode).toBeNull()
    expect(state.ventilator.settings.deviceMode).toBe('adaptive-pressure-simv')
    expect(state.ventilator.settings.mode).toBe('pressure-ac')
    expect(state.ventilator.settings.advanced.targetVtMl).toBeGreaterThan(0)

    state = dispatchMany(state, [
      { type: 'SET_CONTROL', control: 'targetVtMl', value: 5000 },
      { type: 'SET_CONTROL', control: 'spontaneousPressureSupportCmH2O', value: -20 },
      { type: 'SET_CONTROL', control: 'spontaneousCyclePercent', value: 200 },
    ])
    expect(state.ventilator.settings.advanced.targetVtMl).toBe(1000)
    expect(state.ventilator.settings.advanced.spontaneousPressureSupportCmH2O).toBe(0)
    expect(state.ventilator.settings.advanced.spontaneousCyclePercent).toBe(80)
  })

  it('rejects device-incompatible and neonatal-only mode activation', () => {
    let avea = createInitialSimulationState('MV-01', 'learn', 1, 'carefusion-avea')
    avea = ventilationSimulationReducer(avea, { type: 'SELECT_MODE', mode: 'tcpl-ac' })
    expect(avea.ventilator.pendingMode).toBeNull()
    expect(avea.ventilator.settings.deviceMode).toBe('volume-ac')
    expect(avea.lastResponse).toMatch(/Neonatal-only/i)

    let pb980 = createInitialSimulationState('MV-01', 'learn', 1, 'puritan-bennett-980')
    pb980 = ventilationSimulationReducer(pb980, {
      type: 'SELECT_MODE',
      mode: 'intellivent-asv',
    })
    expect(pb980.ventilator.pendingMode).toBeNull()
    expect(pb980.lastResponse).toMatch(/not available/i)
  })

  it('applies the C6 spontaneous P-ramp cap to SIMV support breaths', () => {
    let state = createInitialSimulationState('MV-01', 'learn', 1, 'hamilton-c6')
    state = dispatchMany(state, [
      { type: 'SELECT_MODE', mode: 'volume-simv' },
      { type: 'CONFIRM_MODE' },
      { type: 'SET_CONTROL', control: 'spontaneousRampMs', value: 900 },
    ])
    expect(state.ventilator.settings.advanced.spontaneousRampMs).toBe(200)
  })

  it('keeps two-level pressure controls ordered while clamping them', () => {
    let state = createInitialSimulationState('MV-01', 'learn', 1, 'puritan-bennett-980')
    state = dispatchMany(state, [
      { type: 'SELECT_MODE', mode: 'bilevel' },
      { type: 'CONFIRM_MODE' },
      { type: 'SET_CONTROL', control: 'pLowCmH2O', value: 50 },
      { type: 'SET_CONTROL', control: 'pHighCmH2O', value: 5 },
    ])
    expect(state.ventilator.settings.advanced.pLowCmH2O).toBe(20)
    expect(state.ventilator.settings.advanced.pHighCmH2O).toBe(21)
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
    const progress = recordCaseResult(createDefaultProgress(), {
      caseId: 'MV-01',
      deviceId: 'hamilton-c6',
      outcome,
    })
    writeProgress(progress)
    const raw = window.localStorage.getItem(MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY)
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

  it('migrates v1 C6 progress non-destructively and defaults the learner to C6', () => {
    const legacy = {
      version: 1,
      lastStation: 'pressure-support-timing',
      completedCases: ['MV-01', 'MV-11'],
      attempts: { 'MV-01': 3, 'MV-11': 1 },
      bestScores: { 'MV-01': 91, 'MV-11': 78 },
      criticalErrorStatus: { 'MV-01': false, 'MV-11': true },
    }
    const serialized = JSON.stringify(legacy)
    window.localStorage.setItem(LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY, serialized)

    const migrated = readProgress()
    expect(migrated).toEqual({
      version: 2,
      lastStation: 'pressure-support-timing',
      lastDeviceId: 'hamilton-c6',
      completedCases: ['MV-01', 'MV-11'],
      attemptsByDeviceCase: {
        [deviceCaseAttemptKey('hamilton-c6', 'MV-01')]: 3,
        [deviceCaseAttemptKey('hamilton-c6', 'MV-11')]: 1,
      },
      bestScores: { 'MV-01': 91, 'MV-11': 78 },
      criticalErrorStatus: { 'MV-01': false, 'MV-11': true },
    })
    expect(window.localStorage.getItem(LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY)).toBe(serialized)
    expect(window.localStorage.getItem(MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY)).not.toBeNull()
    expect(nextCaseAttempt(migrated, 'MV-01', 'hamilton-c6')).toBe(4)
    expect(nextCaseAttempt(migrated, 'MV-01', 'puritan-bennett-980')).toBe(1)
  })

  it('shares mastery while counting attempts independently by device and case', () => {
    const outcome = {
      score: 90,
      mastery: true,
      resolved: true,
      criticalErrors: [],
      domains: {
        safety: 20,
        mechanism: 20,
        correctiveActions: 20,
        reassessment: 20,
        communicationComfort: 10,
      },
    }
    let progress = recordCaseResult(createDefaultProgress(), {
      caseId: 'MV-01',
      deviceId: 'hamilton-c6',
      outcome,
    })
    progress = recordCaseResult(progress, {
      caseId: 'MV-01',
      deviceId: 'carefusion-avea',
      outcome: { ...outcome, score: 84 },
    })
    expect(progress.completedCases).toEqual(['MV-01'])
    expect(progress.bestScores['MV-01']).toBe(90)
    expect(hasCaseMastery(progress, 'MV-01')).toBe(true)
    expect(progress.attemptsByDeviceCase).toEqual({
      [deviceCaseAttemptKey('hamilton-c6', 'MV-01')]: 1,
      [deviceCaseAttemptKey('carefusion-avea', 'MV-01')]: 1,
    })
  })
})
