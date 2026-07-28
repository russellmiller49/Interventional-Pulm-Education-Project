import {
  MECHANICAL_VENTILATION_REPLAY_PAYLOAD_VERSION,
  MECHANICAL_VENTILATION_SESSION_STORAGE_KEY,
  createInitialSimulationState,
  createMechanicalVentilationSession,
  parseMechanicalVentilationSession,
  replayMechanicalVentilationSession,
  ventilationSimulationReducer,
  writeMechanicalVentilationSession,
  type VentilationReplayEvent,
} from '../engine'
import {
  mechanicalVentilationCaseById,
  mechanicalVentilationCases,
  selectVentilationAssessmentCaseId,
} from '../content'

describe('mechanical ventilation semantic resume', () => {
  it('rebuilds a deterministic engine checkpoint without persisting waveform buffers', () => {
    const definition = mechanicalVentilationCaseById.get('MV-08')
    if (!definition) throw new Error('Expected MV-08')

    const events: VentilationReplayEvent[] = [
      {
        atSimulationSeconds: 0,
        action: {
          type: 'COMMIT_PREDICTION',
          mechanismId: definition.correctMechanismId,
          priorityId: definition.correctPriorityId,
          responseId: definition.correctResponseId,
        },
      },
      {
        atSimulationSeconds: 0,
        action: { type: 'PERFORM_INTERVENTION', interventionId: 'inspect-circuit' },
      },
      {
        atSimulationSeconds: 0,
        action: { type: 'PERFORM_INTERVENTION', interventionId: 'drain-condensate' },
      },
    ]

    let state = createInitialSimulationState('MV-08', 'practice', 2, 'hamilton-c6')
    state = ventilationSimulationReducer(state, events[0].action)
    state = ventilationSimulationReducer(state, events[1].action)
    state = ventilationSimulationReducer(state, { type: 'SET_PAUSED', paused: false })
    state = ventilationSimulationReducer(state, { type: 'TICK', seconds: 12 })
    state = ventilationSimulationReducer(state, { type: 'SET_PAUSED', paused: true })
    events[2] = { ...events[2], atSimulationSeconds: state.simulationTime }
    state = ventilationSimulationReducer(state, events[2].action)

    const session = createMechanicalVentilationSession({
      activityId: 'ventilation:practice:MV-08',
      state,
      activityMode: 'practice',
      activityPhase: 'act',
      attempt: 2,
      events,
      now: '2026-07-22T18:00:00.000Z',
    })
    expect(writeMechanicalVentilationSession(window.localStorage, session)).toBe(true)
    const serialized = window.localStorage.getItem(MECHANICAL_VENTILATION_SESSION_STORAGE_KEY)
    expect(serialized).not.toMatch(/waveforms|trends|alarmHistory/)
    expect(serialized).toContain(MECHANICAL_VENTILATION_REPLAY_PAYLOAD_VERSION)

    const parsed = parseMechanicalVentilationSession(serialized)
    expect(parsed).not.toBeNull()
    const restored = parsed ? replayMechanicalVentilationSession(parsed) : null
    expect(restored).not.toBeNull()
    expect(restored?.seed).toBe(state.seed)
    expect(restored?.simulationTime).toBeCloseTo(state.simulationTime, 5)
    expect(restored?.prediction).toEqual(state.prediction)
    expect(restored?.interventions.map((item) => item.interventionId)).toEqual(
      state.interventions.map((item) => item.interventionId),
    )
    expect(restored?.patient.airway).toEqual(state.patient.airway)
  })

  it('rejects reordered events and an engine seed that no longer matches the attempt', () => {
    const state = createInitialSimulationState('MV-01', 'practice', 1, 'hamilton-c6')
    const valid = createMechanicalVentilationSession({
      activityId: 'ventilation:practice:MV-01',
      state: { ...state, simulationTime: 10 },
      activityMode: 'practice',
      activityPhase: 'predict',
      attempt: 1,
      events: [
        { atSimulationSeconds: 4, action: { type: 'TOGGLE_LOCK' } },
        { atSimulationSeconds: 8, action: { type: 'TOGGLE_LOCK' } },
      ],
      now: '2026-07-22T18:00:00.000Z',
    })
    // createMechanicalVentilationSession validates writes, so form a corrupted transport payload.
    const corrupt = JSON.stringify({
      ...valid,
      events: [...valid.events].reverse(),
    })
    expect(parseMechanicalVentilationSession(corrupt)).toBeNull()

    const noEvents = createMechanicalVentilationSession({
      activityId: 'ventilation:practice:MV-01',
      state,
      activityMode: 'practice',
      activityPhase: 'recognize',
      attempt: 1,
      events: [],
      now: '2026-07-22T18:00:00.000Z',
    })
    expect(
      replayMechanicalVentilationSession({ ...noEvents, engineSeed: state.seed + 1 }),
    ).toBeNull()
  })

  it('selects a stable assessment case from the complete fifteen-case registry', () => {
    const caseIds = mechanicalVentilationCases.map((definition) => definition.id)
    expect(caseIds).toHaveLength(15)
    expect(selectVentilationAssessmentCaseId('seed-alpha', caseIds)).toBe(
      selectVentilationAssessmentCaseId('seed-alpha', caseIds),
    )
    expect(caseIds).toContain(selectVentilationAssessmentCaseId('seed-beta', caseIds))
    expect(selectVentilationAssessmentCaseId('seed-empty', [])).toBeNull()
  })
})
