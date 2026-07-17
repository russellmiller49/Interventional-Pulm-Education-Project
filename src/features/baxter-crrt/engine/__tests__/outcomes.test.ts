import type { RuntimeCrrtCase } from '../../content/schema'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningExperience,
  type CrrtLearningSessionState,
  type CrrtPredictionCommitment,
} from '../learningSession'
import {
  CRRT_OUTCOME_DOMAIN_MAXIMUMS,
  CRRT_MASTERY_MINIMUM_SCORE,
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
    contentVersion: 'test-mastery.1',
    goalOptions: [option('goal-correct'), option('goal-other')],
    mechanismOptions: [option('mechanism-correct'), option('mechanism-other')],
    controlOptions: [
      option('control-correct'),
      option('control-alternative'),
      option('control-other'),
    ],
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
        predictionControlOptionIds: ['control-alternative'],
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

function create(experience: CrrtLearningExperience = 'practice') {
  const caseDefinition = buildCase()
  return createCrrtLearningSession({
    caseDefinition,
    fixture: { ...createSyntheticFixture(), id: caseDefinition.id },
    experience,
    roleLens: 'integrated',
    attempt: 1,
    audience: 'reviewer',
  })
}

function advanceToPrediction(state: CrrtLearningSessionState) {
  if (state.reasoningPhase === 'read') {
    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase: 'define',
    })
  }
  if (state.reasoningPhase === 'define') {
    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase: 'select',
    })
  }
  if (state.reasoningPhase === 'select') {
    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase: 'predict',
    })
  }
  return state
}

function commit(
  state: CrrtLearningSessionState,
  committedPrediction: CrrtPredictionCommitment = prediction,
) {
  state = advanceToPrediction(state)
  return crrtLearningSessionReducer(state, {
    type: 'COMMIT_PREDICTION',
    prediction: committedPrediction,
  })
}

function perform(state: CrrtLearningSessionState, interventionId: string) {
  return crrtLearningSessionReducer(state, { type: 'PERFORM_INTERVENTION', interventionId })
}

function reassess(state: CrrtLearningSessionState) {
  state = crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds: 60 })
  return crrtLearningSessionReducer(state, {
    type: 'COMMIT_REASSESSMENT',
    optionIds: ['reassess-correct'],
  })
}

describe('CRRT Phase 4 outcomes', () => {
  it('carries deterministic replay identity without expanding persisted progress', () => {
    const session = create()
    const outcome = selectCrrtLearningOutcome(session)

    expect(outcome.resultIdentity).toEqual({
      caseId: session.caseDefinition.id,
      attempt: session.attempt,
      seed: session.simulation.seed,
      engineVersion: session.simulation.engineVersion,
      engineSchemaVersion: session.simulation.schemaVersion,
      simulationContentVersion: session.simulation.contentVersion,
      caseContentVersion: session.caseDefinition.contentVersion,
      deviceProfileVersion: session.simulation.deviceProfileVersion,
      protocolProfileVersion: session.simulation.protocolProfileVersion,
    })
  })

  it('keeps the fixed six-domain rubric at 100 and scores Practice without awarding Mastery', () => {
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
        mastery: false,
        matchedRequiredPath: true,
        criticalErrorIds: [],
      }),
    )
  })

  it('keeps the Mastery threshold defined but rejects creation while no capstone is active', () => {
    expect(CRRT_MASTERY_MINIMUM_SCORE).toBe(80)
    expect(() => create('mastery')).toThrow(/Mastery is locked/i)
  })

  it('refuses to score a forged Mastery projection of a Practice session', () => {
    const practice = create('practice')
    const forged = {
      ...practice,
      experience: 'mastery' as const,
      masteryCapstoneId: 'MASTERY-PRISMAX-01',
    }
    expect(selectCrrtLearningOutcome(forged)).toMatchObject({
      scored: false,
      score: null,
      mastery: false,
      domains: null,
    })
  })

  it('requires the planned control to match the reviewed alternative that was performed', () => {
    const completeAlternative = (state: CrrtLearningSessionState) => {
      state = perform(state, 'alternative-action')
      state = perform(state, 'communicate-action')
      return reassess(state)
    }

    const primaryPlan = selectCrrtLearningOutcome(completeAlternative(commit(create())))
    expect(primaryPlan.matchedRequiredPath).toBe(false)
    expect(primaryPlan.matchedAcceptedPathIds).toEqual(['reviewed-alternative'])
    expect(primaryPlan.domains?.modalityAndPrescription).toBe(0)
    expect(primaryPlan.score).toBe(80)

    const alternativePlan = selectCrrtLearningOutcome(
      completeAlternative(
        commit(create(), {
          ...prediction,
          controlOptionIds: ['control-alternative'],
        }),
      ),
    )
    expect(alternativePlan.domains?.modalityAndPrescription).toBe(
      CRRT_OUTCOME_DOMAIN_MAXIMUMS.modalityAndPrescription,
    )
    expect(alternativePlan.score).toBe(100)
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

  it('triggers draft critical rules and blocks Mastery promotion from Practice', () => {
    let state = commit(create('practice'))
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
    const simulation = state.simulation
    expect(readAllowlistedCrrtMetric(simulation, 'prescription.flows.dialysateFlowMlHour')).toBe(
      simulation.prescription.flows.dialysateFlowMlHour,
    )
    expect(
      readAllowlistedCrrtMetric(simulation, 'patient.solutes.potassium.concentrationPerLiter'),
    ).toBe(
      simulation.patient.status === 'configured'
        ? simulation.patient.solutes.potassium?.concentrationPerLiter
        : undefined,
    )
    expect(readAllowlistedCrrtMetric(simulation, 'circuit.pressures.returnPressureMmHg')).toBe(
      simulation.circuit.pressures.returnPressureMmHg,
    )
    expect(readAllowlistedCrrtMetric(simulation, 'circuit.filter.procoagulantBurdenFraction')).toBe(
      simulation.circuit.filter.procoagulantBurdenFraction,
    )
    expect(readAllowlistedCrrtMetric(simulation, 'access.returnResistanceMmHgPerMlMin')).toBe(
      simulation.access.status === 'configured'
        ? simulation.access.returnResistanceMmHgPerMlMin
        : null,
    )
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
