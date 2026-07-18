import { baxterCrrtLearnerCases, getBaxterCrrtCase } from '../../content'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningSessionState,
} from '../learningSession'

function reachPrediction(state: CrrtLearningSessionState): CrrtLearningSessionState {
  for (const phase of ['define', 'select', 'predict'] as const) {
    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase,
    })
  }
  return state
}

function commitCorrectPrediction(state: CrrtLearningSessionState): CrrtLearningSessionState {
  const hidden = state.caseDefinition.hiddenMechanism
  return crrtLearningSessionReducer(reachPrediction(state), {
    type: 'COMMIT_PREDICTION',
    prediction: {
      goalOptionId: hidden.correctGoalOptionId,
      mechanismOptionId: hidden.correctMechanismOptionId,
      controlOptionIds: hidden.correctControlOptionIds,
      responseOptionId: hidden.correctResponseOptionId,
      reassessmentOptionIds: hidden.correctReassessmentOptionIds,
    },
  })
}

describe('CRRT v1 learning-session reducer', () => {
  it.each(baxterCrrtLearnerCases)(
    'creates $id on both operational device adapters',
    (caseDefinition) => {
      for (const deviceId of ['prismax-aw8035-2xx', 'prismaflex-g5036003-6xx'] as const) {
        const state = createCrrtLearningSession({
          caseDefinition,
          experience: 'learn',
          roleLens: 'integrated',
          attempt: 1,
          deviceId,
        })
        expect(state.simulation.deviceId).toBe(deviceId)
        expect(state.simulation.device.adapterStatus).toBe('operational-v1')
        expect(state.persistenceEnabled).toBe(true)
        expect(state.telemetryEnabled).toBe(true)
      }
    },
  )

  it('keeps review-preview fully functional while disabling persistence and telemetry', () => {
    const state = createCrrtLearningSession({
      caseDefinition: getBaxterCrrtCase('CRRT-01'),
      experience: 'practice',
      roleLens: 'integrated',
      attempt: 1,
      mode: 'review-preview',
    })
    expect(state).toMatchObject({
      mode: 'review-preview',
      audience: 'reviewer',
      persistenceEnabled: false,
      telemetryEnabled: false,
    })
    expect(commitCorrectPrediction(state).prediction).not.toBeNull()
  })

  it('enforces prediction, intervention, time, reassessment, and debrief order', () => {
    let state = createCrrtLearningSession({
      caseDefinition: getBaxterCrrtCase('CRRT-04'),
      experience: 'practice',
      roleLens: 'integrated',
      attempt: 1,
    })
    const firstAction = state.caseDefinition.interventions[0]
    expect(
      crrtLearningSessionReducer(state, {
        type: 'PERFORM_INTERVENTION',
        interventionId: firstAction.id,
      }),
    ).toBe(state)

    state = commitCorrectPrediction(state)
    const accepted = state.caseDefinition.acceptedAlternativePaths[0]
    for (const actionId of accepted.actionIds) {
      state = crrtLearningSessionReducer(state, {
        type: 'PERFORM_INTERVENTION',
        interventionId: actionId,
      })
    }
    expect(
      crrtLearningSessionReducer(state, {
        type: 'COMMIT_REASSESSMENT',
        optionIds: accepted.reassessmentIds,
      }),
    ).toBe(state)
    state = crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds: 60 })
    state = crrtLearningSessionReducer(state, {
      type: 'COMMIT_REASSESSMENT',
      optionIds: accepted.reassessmentIds,
    })
    state = crrtLearningSessionReducer(state, { type: 'REVEAL_DEBRIEF' })
    expect(state.reassessment.committed).toBe(true)
    expect(state.debriefRevealed).toBe(true)
  })

  it('runs only the masked CRRT-16 Mastery mapping and ignores hint actions', () => {
    const mastery = createCrrtLearningSession({
      caseDefinition: getBaxterCrrtCase('CRRT-16'),
      experience: 'mastery',
      roleLens: 'integrated',
      attempt: 1,
    })
    expect(mastery.masteryCapstoneId).toBe('MASTERY-PRISMAX-01')
    expect(crrtLearningSessionReducer(mastery, { type: 'USE_HINT' })).toBe(mastery)
    expect(() =>
      createCrrtLearningSession({
        caseDefinition: getBaxterCrrtCase('CRRT-04'),
        experience: 'mastery',
        roleLens: 'integrated',
        attempt: 1,
      }),
    ).toThrow(/Mastery is locked/i)
  })

  it('loads a clean case/device/mode state without carrying prior attempt data', () => {
    let state = createCrrtLearningSession({
      caseDefinition: getBaxterCrrtCase('CRRT-01'),
      experience: 'learn',
      roleLens: 'integrated',
      attempt: 1,
    })
    state = commitCorrectPrediction(state)
    state = crrtLearningSessionReducer(state, {
      type: 'LOAD_CASE',
      caseDefinition: getBaxterCrrtCase('CRRT-18'),
      experience: 'practice',
      roleLens: 'operator',
      attempt: 2,
      deviceId: 'prismaflex-g5036003-6xx',
      mode: 'learner',
    })
    expect(state).toMatchObject({
      experience: 'practice',
      roleLens: 'operator',
      attempt: 2,
      prediction: null,
      performedInterventionIds: [],
      usedHintIds: [],
      debriefRevealed: false,
    })
    expect(state.caseDefinition.id).toBe('CRRT-18')
    expect(state.simulation.deviceId).toBe('prismaflex-g5036003-6xx')
  })
})
