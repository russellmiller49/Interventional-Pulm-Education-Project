import type { RuntimeCrrtCase } from '../../content/schema'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningSessionState,
  type CrrtPredictionCommitment,
} from '../learningSession'
import {
  CRRT_OUTCOME_DOMAIN_MAXIMUMS,
  evaluateCrrtMetricCondition,
  readAllowlistedCrrtMetric,
  selectCrrtDebriefProjection,
  selectCrrtLearningOutcome,
} from '../outcomes'
import { createSyntheticFixture } from '../testSupport/syntheticFixture'

const prediction: CrrtPredictionCommitment = {
  goalOptionId: 'goal-correct',
  mechanismOptionId: 'mechanism-correct',
  controlOptionIds: ['control-correct'],
  responseOptionId: 'response-correct',
  reassessmentOptionIds: ['reassess-correct'],
}

function option(id: string) {
  return { id, label: id, description: id, sourceIds: ['TEST-P4-002'], reviewStatus: 'pending' }
}

function intervention(id: string, category: 'assessment' | 'communication', seconds = 0) {
  return {
    id,
    label: id,
    category,
    description: id,
    response: id,
    latencySeconds: 0,
    prerequisites: [],
    repeatable: false,
    sourceIds: ['TEST-P4-002'],
    reviewStatus: 'pending',
    effects:
      seconds > 0
        ? [
            {
              target: 'simulation.advanceTimeSeconds',
              operation: 'add',
              valueType: 'number',
              value: seconds,
              unit: 's',
              sourceId: 'TEST-P4-002',
            },
          ]
        : [],
  }
}

function buildCase(): RuntimeCrrtCase {
  return {
    id: 'CRRT-10',
    goalOptions: [option('goal-correct'), option('goal-other')],
    mechanismOptions: [option('mechanism-correct'), option('mechanism-other')],
    controlOptions: [option('control-correct'), option('control-other')],
    responseOptions: [option('response-correct'), option('response-other')],
    reassessmentOptions: [option('reassess-correct'), option('reassess-other')],
    hiddenMechanism: {
      id: 'hidden',
      summary: 'Synthetic mechanism',
      causalChain: ['cause', 'effect'],
      correctGoalOptionId: 'goal-correct',
      correctMechanismOptionId: 'mechanism-correct',
      correctControlOptionIds: ['control-correct'],
      correctResponseOptionId: 'response-correct',
      correctReassessmentOptionIds: ['reassess-correct'],
      sourceIds: ['TEST-P4-002'],
      reviewStatus: 'pending',
    },
    interventions: [
      intervention('required-action', 'assessment', 60),
      intervention('alternative-action', 'assessment', 60),
      intervention('communicate-action', 'communication'),
      intervention('unsafe-action', 'assessment'),
    ],
    requiredActionIds: ['required-action'],
    requiredReassessmentIds: ['reassess-correct'],
    acceptedAlternativePaths: [
      {
        id: 'reviewed-alternative',
        label: 'Reviewed alternative',
        actionIds: ['alternative-action'],
        reassessmentIds: ['reassess-correct'],
        successConditionIds: ['elapsed-response'],
        explanation: 'Different action, same reviewed endpoint.',
        sourceIds: ['TEST-P4-002'],
        reviewStatus: 'pending',
      },
    ],
    successConditions: [
      {
        id: 'elapsed-response',
        metric: 'simulationTimeSeconds',
        comparator: 'gte',
        value: 60,
        unit: 's',
        sourceId: 'TEST-P4-002',
        reviewStatus: 'pending',
      },
    ],
    unsafeActions: [
      {
        id: 'unsafe-link',
        actionId: 'unsafe-action',
        explanation: 'Synthetic unsafe action.',
        criticalErrorId: 'critical-unsafe',
        sourceIds: ['TEST-P4-002'],
        reviewStatus: 'pending',
      },
    ],
    criticalErrors: [
      {
        id: 'critical-unsafe',
        label: 'Unsafe action',
        explanation: 'Synthetic critical trigger.',
        actionIds: ['unsafe-action'],
        conditionIds: [],
        sourceIds: ['TEST-P4-002'],
        reviewStatus: 'pending',
      },
    ],
    hintLadder: [
      {
        id: 'hint-1',
        sequence: 1,
        text: 'First',
        sourceIds: ['TEST-P4-002'],
        reviewStatus: 'pending',
      },
      {
        id: 'hint-2',
        sequence: 2,
        text: 'Second',
        sourceIds: ['TEST-P4-002'],
        reviewStatus: 'pending',
      },
    ],
    debrief: {
      summary: 'Summary',
      causalChain: ['machine response', 'delivered therapy', 'patient response'],
      statedGoalReview: 'Review the goal.',
      predictionReview: 'Review the prediction.',
      actionTimelineReview: 'Review the actions.',
      trendReview: 'Review the trends.',
      requiredActionsReview: 'Review required actions.',
      criticalErrorsReview: 'Review critical errors.',
      acceptedAlternativesReview: 'Review alternatives.',
      machineNavigationPoint: 'Review navigation.',
      transferQuestion: 'What transfers?',
      sourceIds: ['TEST-P4-002'],
      reviewStatus: 'pending',
    },
  } as unknown as RuntimeCrrtCase
}

function create(experience: 'learn' | 'practice' = 'practice') {
  const caseDefinition = buildCase()
  return createCrrtLearningSession({
    caseDefinition,
    fixture: { ...createSyntheticFixture(), id: caseDefinition.id },
    experience,
    roleLens: 'integrated',
    attempt: 1,
  })
}

function commit(state: CrrtLearningSessionState) {
  return crrtLearningSessionReducer(state, { type: 'COMMIT_PREDICTION', prediction })
}

function perform(state: CrrtLearningSessionState, interventionId: string) {
  return crrtLearningSessionReducer(state, { type: 'PERFORM_INTERVENTION', interventionId })
}

function reassess(state: CrrtLearningSessionState) {
  return crrtLearningSessionReducer(state, {
    type: 'COMMIT_REASSESSMENT',
    optionIds: ['reassess-correct'],
  })
}

describe('CRRT Phase 4 outcomes', () => {
  it('keeps the fixed six-domain rubric at 100 and scores endpoints plus required actions', () => {
    expect(Object.values(CRRT_OUTCOME_DOMAIN_MAXIMUMS).reduce((sum, value) => sum + value, 0)).toBe(
      100,
    )
    let state = commit(create())
    state = perform(state, 'required-action')
    state = perform(state, 'communicate-action')
    state = reassess(state)

    expect(selectCrrtLearningOutcome(state)).toEqual(
      expect.objectContaining({
        scored: true,
        score: 100,
        mastery: true,
        matchedRequiredPath: true,
        criticalErrorIds: [],
      }),
    )
  })

  it('gives a reviewed alternative full path credit without exact-action matching', () => {
    let state = commit(create())
    state = perform(state, 'alternative-action')
    state = perform(state, 'communicate-action')
    state = reassess(state)
    const outcome = selectCrrtLearningOutcome(state)

    expect(outcome.matchedRequiredPath).toBe(false)
    expect(outcome.matchedAcceptedPathIds).toEqual(['reviewed-alternative'])
    expect(outcome.score).toBe(100)
  })

  it('caps the hint ladder, penalizes Practice only, and leaves Learn unscored', () => {
    let practice = commit(create())
    practice = perform(practice, 'required-action')
    practice = perform(practice, 'communicate-action')
    practice = reassess(practice)
    practice = crrtLearningSessionReducer(practice, { type: 'USE_HINT' })
    practice = crrtLearningSessionReducer(practice, { type: 'USE_HINT' })
    practice = crrtLearningSessionReducer(practice, { type: 'USE_HINT' })
    expect(practice.usedHintIds).toEqual(['hint-1', 'hint-2'])
    expect(selectCrrtLearningOutcome(practice)).toMatchObject({ score: 90, hintPenalty: 10 })

    let learn = commit(create('learn'))
    learn = perform(learn, 'required-action')
    learn = crrtLearningSessionReducer(learn, { type: 'USE_HINT' })
    expect(selectCrrtLearningOutcome(learn)).toMatchObject({
      scored: false,
      score: null,
      mastery: false,
      hintPenalty: 0,
    })
  })

  it('triggers draft critical rules and blocks mastery', () => {
    let state = commit(create())
    state = perform(state, 'required-action')
    state = perform(state, 'communicate-action')
    state = perform(state, 'unsafe-action')
    state = reassess(state)
    const outcome = selectCrrtLearningOutcome(state)

    expect(outcome.criticalErrorIds).toEqual(['critical-unsafe'])
    expect(outcome.domains?.safetyAndTroubleshooting).toBe(0)
    expect(outcome.mastery).toBe(false)
  })

  it('fails closed for unsupported condition paths and projects the causal debrief', () => {
    const state = create()
    expect(readAllowlistedCrrtMetric(state.simulation, 'patient.unreviewedValue')).toBeNull()
    expect(
      evaluateCrrtMetricCondition(state.simulation, {
        ...state.caseDefinition.successConditions[0],
        metric: 'patient.unreviewedValue',
      }),
    ).toBe(false)

    const debrief = selectCrrtDebriefProjection(state)
    expect(debrief).toMatchObject({
      summary: 'Summary',
      statedGoalReview: 'Review the goal.',
      machineNavigationPoint: 'Review navigation.',
      transferQuestion: 'What transfers?',
    })
  })
})
