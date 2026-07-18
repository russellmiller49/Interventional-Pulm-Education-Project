import { getBaxterCrrtCase } from '../../content'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningSessionState,
} from '../learningSession'
import {
  CRRT_MASTERY_MINIMUM_SCORE,
  CRRT_OUTCOME_DOMAIN_MAXIMUMS,
  isCrrtMasteryCapstoneAvailable,
  isCrrtMasteryRuntimeCaseAvailable,
  selectCrrtDebriefProjection,
  selectCrrtLearningOutcome,
} from '../outcomes'

function commitPrediction(state: CrrtLearningSessionState): CrrtLearningSessionState {
  for (const phase of ['define', 'select', 'predict'] as const) {
    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase,
    })
  }
  const hidden = state.caseDefinition.hiddenMechanism
  return crrtLearningSessionReducer(state, {
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

function perform(state: CrrtLearningSessionState, actionId: string): CrrtLearningSessionState {
  const action = state.caseDefinition.interventions.find(({ id }) => id === actionId)
  if (!action) throw new Error(`Missing ${actionId}`)
  for (const prerequisite of action.prerequisites) {
    if (!state.performedInterventionIds.includes(prerequisite)) state = perform(state, prerequisite)
  }
  return state.performedInterventionIds.includes(actionId)
    ? state
    : crrtLearningSessionReducer(state, { type: 'PERFORM_INTERVENTION', interventionId: actionId })
}

function completeCase(experience: 'learn' | 'practice' | 'mastery'): CrrtLearningSessionState {
  const definition = getBaxterCrrtCase(experience === 'mastery' ? 'CRRT-16' : 'CRRT-04')
  let state = createCrrtLearningSession({
    caseDefinition: definition,
    experience,
    roleLens: 'integrated',
    attempt: 1,
  })
  state = commitPrediction(state)
  const path = definition.acceptedAlternativePaths[0]
  for (const actionId of path.actionIds) state = perform(state, actionId)
  state = crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds: 60 })
  state = crrtLearningSessionReducer(state, {
    type: 'COMMIT_REASSESSMENT',
    optionIds: path.reassessmentIds,
  })
  return crrtLearningSessionReducer(state, { type: 'REVEAL_DEBRIEF' })
}

describe('CRRT v1 outcomes', () => {
  it('keeps the six scoring domains at 100 points with an 80-point Mastery rule', () => {
    expect(Object.values(CRRT_OUTCOME_DOMAIN_MAXIMUMS).reduce((sum, value) => sum + value, 0)).toBe(
      100,
    )
    expect(CRRT_MASTERY_MINIMUM_SCORE).toBe(80)
  })

  it('keeps Learn unscored and Practice scored', () => {
    expect(selectCrrtLearningOutcome(completeCase('learn'))).toMatchObject({
      scored: false,
      score: null,
      mastery: false,
      reassessmentComplete: true,
    })
    const practice = selectCrrtLearningOutcome(completeCase('practice'))
    expect(practice.scored).toBe(true)
    expect(practice.score).not.toBeNull()
    expect(practice.mastery).toBe(false)
  })

  it('uses the content-owned masked PrisMax Mastery mapping without review activation records', () => {
    expect(isCrrtMasteryRuntimeCaseAvailable(getBaxterCrrtCase('CRRT-16'))).toBe(true)
    expect(isCrrtMasteryRuntimeCaseAvailable(getBaxterCrrtCase('CRRT-04'))).toBe(false)
    expect(isCrrtMasteryCapstoneAvailable('MASTERY-PRISMAX-01')).toBe(true)
    expect(isCrrtMasteryCapstoneAvailable('unknown')).toBe(false)
  })

  it('requires score, no critical error, no hints, and reassessment for Mastery', () => {
    const complete = completeCase('mastery')
    const outcome = selectCrrtLearningOutcome(complete)
    expect(outcome.scored).toBe(true)
    expect(outcome.score).toBeGreaterThanOrEqual(80)
    expect(outcome.criticalErrorIds).toEqual([])
    expect(outcome.reassessmentComplete).toBe(true)
    expect(outcome.mastery).toBe(true)

    const withForgedHint = { ...complete, usedHintIds: ['forged-hint'] }
    expect(selectCrrtLearningOutcome(withForgedHint).mastery).toBe(false)
  })

  it('projects deterministic causal debrief identity and sources', () => {
    const state = completeCase('practice')
    const first = selectCrrtDebriefProjection(state)
    const second = selectCrrtDebriefProjection(state)
    expect(first).toEqual(second)
    expect(first.outcome.resultIdentity.caseId).toBe('CRRT-04')
    expect(first.causalChain.length).toBeGreaterThan(0)
    expect(first.machineNavigationPoint).toMatch(/clinical reasoning.*screen order/i)
  })
})
