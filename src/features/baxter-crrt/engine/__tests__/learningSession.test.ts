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

describe('CRRT learning-session reducer', () => {
  it.each(baxterCrrtLearnerCases)(
    'creates $id on the PrisMax learner runtime',
    (caseDefinition) => {
      const state = createCrrtLearningSession({
        caseDefinition,
        experience: 'practice',
        roleLens: 'integrated',
        attempt: 1,
        deviceId: 'prismax-aw8035-2xx',
      })
      expect(state.simulation.deviceId).toBe('prismax-aw8035-2xx')
      expect(state.simulation.device.adapterStatus).toBe('operational-v1')
      expect(state.persistenceEnabled).toBe(true)
      expect(state.telemetryEnabled).toBe(true)
    },
  )

  it('keeps prediction, intervention, time, reassessment, and debrief independently available', () => {
    let state = createCrrtLearningSession({
      caseDefinition: getBaxterCrrtCase('CRRT-04'),
      experience: 'practice',
      roleLens: 'integrated',
      attempt: 1,
    })
    const firstAction = state.caseDefinition.interventions[0]
    state = crrtLearningSessionReducer(state, {
      type: 'PERFORM_INTERVENTION',
      interventionId: firstAction.id,
    })
    expect(state.performedInterventionIds).toContain(firstAction.id)
    state = crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds: 60 })
    expect(state.simulation.simulationTimeSeconds).toBe(60)
    state = crrtLearningSessionReducer(state, {
      type: 'COMMIT_REASSESSMENT',
      optionIds: [state.caseDefinition.reassessmentOptions[0].id],
    })
    state = crrtLearningSessionReducer(state, { type: 'REVEAL_DEBRIEF' })
    expect(state.reassessment.committed).toBe(true)
    expect(state.debriefRevealed).toBe(true)

    const freshForPrediction = createCrrtLearningSession({
      caseDefinition: getBaxterCrrtCase('CRRT-04'),
      experience: 'practice',
      roleLens: 'integrated',
      attempt: 2,
    })
    const hidden = freshForPrediction.caseDefinition.hiddenMechanism
    const directPrediction = crrtLearningSessionReducer(freshForPrediction, {
      type: 'COMMIT_PREDICTION',
      prediction: {
        goalOptionId: hidden.correctGoalOptionId,
        mechanismOptionId: hidden.correctMechanismOptionId,
        controlOptionIds: hidden.correctControlOptionIds,
        responseOptionId: hidden.correctResponseOptionId,
        reassessmentOptionIds: hidden.correctReassessmentOptionIds,
      },
    })
    expect(directPrediction.prediction).not.toBeNull()

    const directDebrief = crrtLearningSessionReducer(
      createCrrtLearningSession({
        caseDefinition: getBaxterCrrtCase('CRRT-04'),
        experience: 'practice',
        roleLens: 'integrated',
        attempt: 3,
      }),
      { type: 'REVEAL_DEBRIEF' },
    )
    expect(directDebrief.debriefRevealed).toBe(true)
  })

  it('runs only the masked CRRT-16 capstone mapping and ignores hint actions', () => {
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
    ).toThrow(/challenge uses its content-owned capstone/i)
  })

  it('loads a clean case and role state without carrying prior attempt data', () => {
    let state = createCrrtLearningSession({
      caseDefinition: getBaxterCrrtCase('CRRT-01'),
      experience: 'practice',
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
      deviceId: 'prismax-aw8035-2xx',
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
    expect(state.simulation.deviceId).toBe('prismax-aw8035-2xx')
  })
})
