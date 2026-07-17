import { baxterCrrtPhase7ReviewCases } from '../content/phase7ReviewCases'
import { getBaxterCrrtPilotCase } from '../content/pilotCases'
import { collectCrrtCaseSemanticIssues, runtimeCrrtCaseSchema } from '../content/schema'
import {
  normalizeRuntimeCrrtCaseToEngineFixture,
  parseRuntimeCrrtCaseToEngineFixture,
} from '../content/runtimeCaseNormalization'
import { createCrrtLearningSession, crrtLearningSessionReducer } from '../engine/learningSession'
import {
  CRRT_OUTCOME_DOMAIN_MAXIMUMS,
  selectCrrtDebriefProjection,
  selectCrrtLearningOutcome,
} from '../engine/outcomes'
import type { RuntimeCrrtCase } from '../content/schema'
import type { CrrtLearningSessionState } from '../engine/learningSession'

const reviewCaseIds = [
  'CRRT-01',
  'CRRT-02',
  'CRRT-05',
  'CRRT-06',
  'CRRT-07',
  'CRRT-11',
  'CRRT-15',
] as const

function expectDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== 'object') return
  expect(Object.isFrozen(value)).toBe(true)
  for (const nested of Object.values(value as Record<string, unknown>)) expectDeepFrozen(nested)
}

function correctPrediction(definition: RuntimeCrrtCase) {
  const hidden = definition.hiddenMechanism
  return {
    goalOptionId: hidden.correctGoalOptionId,
    mechanismOptionId: hidden.correctMechanismOptionId,
    controlOptionIds: hidden.correctControlOptionIds,
    responseOptionId: hidden.correctResponseOptionId,
    reassessmentOptionIds: hidden.correctReassessmentOptionIds,
  }
}

function createReviewerSession(definition: RuntimeCrrtCase, attempt = 1) {
  return createCrrtLearningSession({
    caseDefinition: definition,
    experience: 'practice',
    roleLens: 'integrated',
    attempt,
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

function commitPrediction(
  state: CrrtLearningSessionState,
  controlOptionIds: readonly string[] = state.caseDefinition.hiddenMechanism
    .correctControlOptionIds,
) {
  state = advanceToPrediction(state)
  return crrtLearningSessionReducer(state, {
    type: 'COMMIT_PREDICTION',
    prediction: {
      ...correctPrediction(state.caseDefinition),
      controlOptionIds,
    },
  })
}

function perform(state: CrrtLearningSessionState, interventionId: string) {
  return crrtLearningSessionReducer(state, {
    type: 'PERFORM_INTERVENTION',
    interventionId,
  })
}

function finishReassessment(state: CrrtLearningSessionState, optionIds: readonly string[]) {
  state = crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds: 60 })
  state = crrtLearningSessionReducer(state, {
    type: 'COMMIT_REASSESSMENT',
    optionIds,
  })
  return crrtLearningSessionReducer(state, { type: 'REVEAL_DEBRIEF' })
}

describe('Phase 7 reviewer-only runtime candidates', () => {
  it('rejects cloned or rebranded definitions at the learner-session boundary', () => {
    const clonedPilot = { ...getBaxterCrrtPilotCase('CRRT-04') } as RuntimeCrrtCase
    const rebrandedReviewer = {
      ...baxterCrrtPhase7ReviewCases.cases[0],
      id: 'CRRT-04',
    } as RuntimeCrrtCase

    for (const caseDefinition of [clonedPilot, rebrandedReviewer]) {
      expect(() =>
        createCrrtLearningSession({
          caseDefinition,
          experience: 'practice',
          roleLens: 'integrated',
          attempt: 1,
        }),
      ).toThrow(/exact candidate/i)
    }
  })

  it('exports exactly seven deeply frozen, explicitly non-activating candidates', () => {
    expect(baxterCrrtPhase7ReviewCases).toMatchObject({
      kind: 'crrt-phase7-reviewer-only-runtime-candidates',
      audience: 'reviewer-only',
      activationAllowed: false,
      learnerSelectionAllowed: false,
      progressPersistenceAllowed: false,
      competencyClaimAllowed: false,
      reviewStatus: 'pending',
    })
    expect(baxterCrrtPhase7ReviewCases.cases.map(({ id }) => id)).toEqual(reviewCaseIds)
    expectDeepFrozen(baxterCrrtPhase7ReviewCases)
  })

  it('keeps every reviewer runtime in its canonical curriculum station', () => {
    expect(
      baxterCrrtPhase7ReviewCases.cases.map(({ id, stationId }) => ({ id, stationId })),
    ).toEqual([
      { id: 'CRRT-01', stationId: 'define-goal' },
      { id: 'CRRT-02', stationId: 'define-goal' },
      { id: 'CRRT-05', stationId: 'build-prescription' },
      { id: 'CRRT-06', stationId: 'build-prescription' },
      { id: 'CRRT-07', stationId: 'setup-start' },
      { id: 'CRRT-11', stationId: 'monitor-dose-fluid' },
      { id: 'CRRT-15', stationId: 'pressures-troubleshooting' },
    ])
  })

  it('passes structural and semantic validation and normalizes deterministically', () => {
    for (const definition of baxterCrrtPhase7ReviewCases.cases) {
      expect(runtimeCrrtCaseSchema.safeParse(definition).success).toBe(true)
      expect(collectCrrtCaseSemanticIssues(definition)).toEqual([])

      const first = normalizeRuntimeCrrtCaseToEngineFixture(definition)
      const second = parseRuntimeCrrtCaseToEngineFixture(definition)
      expect(first).toEqual(second)
      expect(first).not.toBe(second)
      expect(first.id).toBe(definition.id)
      expect(first.reviewStatus).toBe('pending')
      expect(first.patient.synthetic).toBe(true)
      expect(first.prescription.anticoagulation).toBe('none')
      expect(definition.initialPrescription.solutionProfileIds).toEqual([])
    }
  })

  it('cites each exact authored calibration to its matching pending synthetic record', () => {
    for (const definition of baxterCrrtPhase7ReviewCases.cases) {
      const syntheticId = `SYNTH-${definition.id}`
      expect(definition.reviewStatus).toBe('pending')
      expect(definition.sourceBasis).toContainEqual(
        expect.objectContaining({ id: syntheticId, reviewStatus: 'pending' }),
      )
      expect(definition.initialPatient.sourceIds).toContain(syntheticId)
      expect(definition.initialAccess.sourceIds).toContain(syntheticId)
      expect(definition.initialPrescription.sourceIds).toContain(syntheticId)
      expect(
        definition.engineModelConfiguration.parameters.every(
          (parameter) => parameter.sourceId === syntheticId && parameter.reviewStatus === 'pending',
        ),
      ).toBe(true)
      expect(definition.engineFixtureConfiguration.modelConfiguration.sourceIds).toContain(
        syntheticId,
      )

      for (const event of definition.timedEvents) {
        expect(event.sourceIds).toContain(syntheticId)
        expect(event.reviewStatus).toBe('pending')
        expect(event.effects.every((effect) => effect.sourceId === syntheticId)).toBe(true)
      }
      for (const intervention of definition.interventions) {
        expect(intervention.sourceIds).toContain(syntheticId)
        expect(intervention.reviewStatus).toBe('pending')
        expect(intervention.effects.every((effect) => effect.sourceId === syntheticId)).toBe(true)
      }
      for (const condition of definition.successConditions) {
        expect(condition).toMatchObject({ sourceId: syntheticId, reviewStatus: 'pending' })
      }
      for (const unsafe of definition.unsafeActions) {
        expect(unsafe.sourceIds).toContain(syntheticId)
        expect(unsafe.reviewStatus).toBe('pending')
      }
      for (const critical of definition.criticalErrors) {
        expect(critical.sourceIds).toContain(syntheticId)
        expect(critical.reviewStatus).toBe('pending')
      }
    }
  })

  it('gives CRRT-06 a source bag for every active CVVHDF supply flow', () => {
    const definition = baxterCrrtPhase7ReviewCases.cases.find(({ id }) => id === 'CRRT-06')
    expect(definition).toBeDefined()
    if (!definition) return

    expect(definition.initialPrescription.modality).toBe('CVVHDF')
    const sourceFlowTerms = definition.engineFixtureConfiguration.bags
      .filter(({ direction }) => direction === 'source')
      .map(({ flowTerm }) => flowTerm)
      .sort()
    expect(sourceFlowTerms).toEqual(['dialysate', 'post-replacement', 'pre-replacement'])
    expect(
      definition.engineFixtureConfiguration.bags.every(({ sourceIds }) =>
        sourceIds.includes('SYNTH-CRRT-06'),
      ),
    ).toBe(true)
  })

  it('preserves the CRRT-05 total replacement flow while changing only the authored split', () => {
    const definition = baxterCrrtPhase7ReviewCases.cases.find(({ id }) => id === 'CRRT-05')
    expect(definition).toBeDefined()
    if (!definition) return

    let session = commitPrediction(createReviewerSession(definition))
    const beforeTotal =
      session.simulation.prescription.status === 'configured'
        ? session.simulation.prescription.flows.preReplacementFlowMlHour +
          session.simulation.prescription.flows.postReplacementFlowMlHour
        : null
    for (const actionId of definition.requiredActionIds) session = perform(session, actionId)

    expect(session.simulation.prescription.status).toBe('configured')
    if (session.simulation.prescription.status !== 'configured') return
    expect(session.simulation.prescription.flows.preReplacementFlowMlHour).toBe(900)
    expect(session.simulation.prescription.flows.postReplacementFlowMlHour).toBe(300)
    expect(
      session.simulation.prescription.flows.preReplacementFlowMlHour +
        session.simulation.prescription.flows.postReplacementFlowMlHour,
    ).toBe(beforeTotal)
  })

  it('recomputes the CRRT-07 weight-normalized display after correcting authored inputs', () => {
    const definition = baxterCrrtPhase7ReviewCases.cases.find(({ id }) => id === 'CRRT-07')
    expect(definition).toBeDefined()
    if (!definition) return

    let session = commitPrediction(createReviewerSession(definition))
    const beforeDose = session.simulation.deliveredTherapy.prescribedEffluentDoseMlKgHour
    for (const actionId of definition.requiredActionIds) session = perform(session, actionId)

    expect(session.simulation.patient.status).toBe('configured')
    if (session.simulation.patient.status !== 'configured') return
    expect(session.simulation.patient.bodyWeightKg).toBe(75)
    expect(session.simulation.patient.hematocritFraction).toBe(0.3)
    expect(session.simulation.deliveredTherapy.prescribedEffluentDoseMlKgHour).toBeGreaterThan(
      beforeDose ?? 0,
    )
  })

  it('advances the CRRT-15 bounded filter-risk trend without adding an alarm threshold', () => {
    const definition = baxterCrrtPhase7ReviewCases.cases.find(({ id }) => id === 'CRRT-15')
    expect(definition).toBeDefined()
    if (!definition) return

    let session = commitPrediction(createReviewerSession(definition))
    for (const actionId of definition.requiredActionIds) session = perform(session, actionId)

    expect(session.simulation.simulationTimeSeconds).toBe(3_600)
    expect(session.simulation.circuit.filter.lowEffectiveBloodFlowFraction).toBe(0.6)
    expect(session.simulation.circuit.filter.foulingBurdenFraction).toBeGreaterThan(0)
    expect(session.simulation.circuit.filter.clotBurdenFraction).toBeGreaterThan(0)
    expect(definition.visibleFindings.join(' ')).toMatch(/no local .* alarm threshold/i)
  })

  it('creates deterministic reviewer sessions and rejects learner sessions', () => {
    for (const definition of baxterCrrtPhase7ReviewCases.cases) {
      const first = createReviewerSession(definition)
      const second = createReviewerSession(definition)
      expect(first.audience).toBe('reviewer')
      expect(first.masteryCapstoneId).toBeNull()
      expect(first.simulation).toEqual(second.simulation)
      expect(first.interfaceState).toEqual(second.interfaceState)
      expect(first.interfaceState.screen).toBe('operations')

      expect(() =>
        createCrrtLearningSession({
          caseDefinition: definition,
          experience: 'practice',
          roleLens: 'integrated',
          attempt: 1,
        }),
      ).toThrow(/reviewer-only/i)
    }
  })

  it('runs each required safe path through reassessment and causal debrief', () => {
    for (const definition of baxterCrrtPhase7ReviewCases.cases) {
      let session = commitPrediction(createReviewerSession(definition))
      for (const actionId of definition.requiredActionIds) session = perform(session, actionId)
      session = finishReassessment(session, definition.requiredReassessmentIds)

      const outcome = selectCrrtLearningOutcome(session)
      const debrief = selectCrrtDebriefProjection(session)
      expect(outcome.matchedRequiredPath).toBe(true)
      expect(outcome.criticalErrorIds).toEqual([])
      expect(outcome.reassessmentComplete).toBe(true)
      expect(session.debriefRevealed).toBe(true)
      expect(debrief.summary).toMatch(/reviewer-only/i)
      expect(debrief.criticalErrorsReview).toMatch(/pending synthetic/i)
    }
  })

  it('runs each accepted alternative without triggering a critical candidate', () => {
    for (const [caseIndex, definition] of baxterCrrtPhase7ReviewCases.cases.entries()) {
      for (const [pathIndex, path] of definition.acceptedAlternativePaths.entries()) {
        const availableControlIds = new Set(definition.controlOptions.map(({ id }) => id))
        expect(path.predictionControlOptionIds.every((id) => availableControlIds.has(id))).toBe(
          true,
        )

        let session = commitPrediction(
          createReviewerSession(definition, caseIndex + pathIndex + 1),
          path.predictionControlOptionIds,
        )
        for (const actionId of path.actionIds) session = perform(session, actionId)
        session = finishReassessment(session, path.reassessmentIds)

        const outcome = selectCrrtLearningOutcome(session)
        expect(outcome.matchedAcceptedPathIds).toContain(path.id)
        expect(outcome.domains?.modalityAndPrescription).toBe(
          CRRT_OUTCOME_DOMAIN_MAXIMUMS.modalityAndPrescription,
        )
        expect(outcome.criticalErrorIds).toEqual([])
        expect(outcome.reassessmentComplete).toBe(true)
        expect(session.debriefRevealed).toBe(true)
      }
    }
  })

  it('records every authored unsafe action as a pending critical-error candidate', () => {
    for (const definition of baxterCrrtPhase7ReviewCases.cases) {
      let session = commitPrediction(createReviewerSession(definition))
      const unsafe = definition.unsafeActions[0]
      session = perform(session, unsafe.actionId)

      const outcome = selectCrrtLearningOutcome(session)
      expect(outcome.criticalErrorIds).toContain(unsafe.criticalErrorId)
      expect(session.criticalErrorIds).toContain(unsafe.criticalErrorId)
      expect(
        definition.criticalErrors.find(({ id }) => id === unsafe.criticalErrorId),
      ).toMatchObject({ reviewStatus: 'pending' })
    }
  })
})
