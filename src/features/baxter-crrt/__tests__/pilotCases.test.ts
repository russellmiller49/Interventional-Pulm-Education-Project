import { baxterCrrtLearnerCases, getBaxterCrrtCase } from '../content'
import {
  CRRT_ALL_CASE_IDS,
  runtimeCrrtCaseSchema,
  validateCrrtCaseRegistry,
  type RuntimeCrrtCase,
} from '../content/schema'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningSessionState,
} from '../engine/learningSession'
import { selectCrrtDebriefProjection, selectCrrtLearningOutcome } from '../engine/outcomes'

function advanceToPrediction(state: CrrtLearningSessionState): CrrtLearningSessionState {
  for (const phase of ['define', 'select', 'predict'] as const) {
    state = crrtLearningSessionReducer(state, {
      type: 'ENTER_PRECOMMIT_REASONING_PHASE',
      phase,
    })
  }
  return state
}

function startAttempt(
  definition: RuntimeCrrtCase,
  controlOptionIds = definition.hiddenMechanism.correctControlOptionIds,
): CrrtLearningSessionState {
  let state = createCrrtLearningSession({
    caseDefinition: definition,
    experience: 'practice',
    roleLens: 'integrated',
    attempt: 1,
  })
  state = advanceToPrediction(state)
  return crrtLearningSessionReducer(state, {
    type: 'COMMIT_PREDICTION',
    prediction: {
      goalOptionId: definition.hiddenMechanism.correctGoalOptionId,
      mechanismOptionId: definition.hiddenMechanism.correctMechanismOptionId,
      controlOptionIds,
      responseOptionId: definition.hiddenMechanism.correctResponseOptionId,
      reassessmentOptionIds: definition.hiddenMechanism.correctReassessmentOptionIds,
    },
  })
}

function performWithPrerequisites(
  state: CrrtLearningSessionState,
  actionId: string,
): CrrtLearningSessionState {
  const action = state.caseDefinition.interventions.find(({ id }) => id === actionId)
  if (!action) throw new Error(`Missing intervention ${actionId}`)
  for (const prerequisite of action.prerequisites) {
    if (!state.performedInterventionIds.includes(prerequisite)) {
      state = performWithPrerequisites(state, prerequisite)
    }
  }
  if (state.performedInterventionIds.includes(actionId)) return state
  return crrtLearningSessionReducer(state, {
    type: 'PERFORM_INTERVENTION',
    interventionId: actionId,
  })
}

function finishAttempt(
  state: CrrtLearningSessionState,
  reassessmentIds: readonly string[],
): CrrtLearningSessionState {
  state = crrtLearningSessionReducer(state, { type: 'ADVANCE_TIME', seconds: 60 })
  state = crrtLearningSessionReducer(state, {
    type: 'COMMIT_REASSESSMENT',
    optionIds: reassessmentIds,
  })
  return crrtLearningSessionReducer(state, { type: 'REVEAL_DEBRIEF' })
}

describe('Baxter CRRT v1 case registry', () => {
  it('contains exactly CRRT-01 through CRRT-18 in one immutable learner registry', () => {
    expect(baxterCrrtLearnerCases.map(({ id }) => id)).toEqual(CRRT_ALL_CASE_IDS)
    expect(baxterCrrtLearnerCases).toHaveLength(18)
    expect(
      validateCrrtCaseRegistry(baxterCrrtLearnerCases, {
        expectedCaseIds: CRRT_ALL_CASE_IDS,
        registryLabel: 'v1 acceptance',
      }),
    ).toEqual([])
    expect(Object.isFrozen(baxterCrrtLearnerCases)).toBe(true)
    for (const caseId of CRRT_ALL_CASE_IDS) expect(getBaxterCrrtCase(caseId).id).toBe(caseId)
  })

  it.each(baxterCrrtLearnerCases)(
    '$id includes prediction, safe/alternative/unsafe/critical, timed, reassessment, debrief, and sources',
    (definition) => {
      expect(runtimeCrrtCaseSchema.safeParse(definition).success).toBe(true)
      expect(definition.compatibleDevices).toEqual([
        'prismax-aw8035-2xx',
        'prismaflex-g5036003-6xx',
      ])
      expect(definition.acceptedAlternativePaths.length).toBeGreaterThanOrEqual(1)
      expect(definition.unsafeActions.length).toBeGreaterThanOrEqual(1)
      expect(definition.criticalErrors.length).toBeGreaterThanOrEqual(1)
      expect(definition.unsafeActions.some(({ criticalErrorId }) => criticalErrorId !== null)).toBe(
        true,
      )
      expect(definition.timedEvents.length).toBeGreaterThanOrEqual(1)
      expect(definition.requiredReassessmentIds.length).toBeGreaterThanOrEqual(1)
      expect(definition.debrief.causalChain.length).toBeGreaterThanOrEqual(1)
      expect(definition.sourceBasis.length).toBeGreaterThanOrEqual(1)
    },
  )

  it.each(baxterCrrtLearnerCases)(
    '$id deterministically runs every accepted path through reassessment and causal debrief',
    (definition) => {
      for (const path of definition.acceptedAlternativePaths) {
        const run = () => {
          let state = startAttempt(definition, path.predictionControlOptionIds)
          for (const actionId of path.actionIds) state = performWithPrerequisites(state, actionId)
          state = finishAttempt(state, path.reassessmentIds)
          return {
            timeline: state.timeline,
            outcome: selectCrrtLearningOutcome(state),
            debrief: selectCrrtDebriefProjection(state),
          }
        }
        const first = run()
        const replay = run()
        expect(first).toEqual(replay)
        expect(first.outcome.matchedAcceptedPathIds).toContain(path.id)
        expect(first.outcome.criticalErrorIds).toEqual([])
        expect(first.outcome.reassessmentComplete).toBe(true)
        expect(first.debrief.causalChain.length).toBeGreaterThan(0)
      }
    },
  )

  it.each(baxterCrrtLearnerCases)(
    '$id retains unsafe and critical-error paths and still requires reassessment before debrief',
    (definition) => {
      for (const unsafe of definition.unsafeActions) {
        let state = startAttempt(definition)
        state = performWithPrerequisites(state, unsafe.actionId)
        expect(state.performedInterventionIds).toContain(unsafe.actionId)
        if (unsafe.criticalErrorId) {
          expect(selectCrrtLearningOutcome(state).criticalErrorIds).toContain(
            unsafe.criticalErrorId,
          )
        }
        state = finishAttempt(state, definition.requiredReassessmentIds)
        expect(state.reassessment.committed).toBe(true)
        expect(state.debriefRevealed).toBe(true)
      }
    },
  )

  it('keeps learner-facing case copy clinical and free of implementation terminology', () => {
    const learnerCopy = baxterCrrtLearnerCases.flatMap((definition) => [
      definition.title,
      definition.patientDescription,
      ...definition.learningObjectives,
      ...definition.visibleFindings,
      ...definition.timedEvents.map(({ label }) => label),
      ...definition.goalOptions.flatMap(({ label, description }) => [label, description]),
      ...definition.mechanismOptions.flatMap(({ label, description }) => [label, description]),
      ...definition.controlOptions.flatMap(({ label, description }) => [label, description]),
      ...definition.responseOptions.flatMap(({ label, description }) => [label, description]),
      ...definition.reassessmentOptions.flatMap(({ label, description }) => [label, description]),
      ...definition.interventions.flatMap(({ label, description, response }) => [
        label,
        description,
        response,
      ]),
      ...definition.acceptedAlternativePaths.flatMap(({ label, explanation }) => [
        label,
        explanation,
      ]),
      ...definition.unsafeActions.map(({ explanation }) => explanation),
      ...definition.criticalErrors.flatMap(({ label, explanation }) => [label, explanation]),
      ...definition.hintLadder.map(({ text }) => text),
      definition.debrief.summary,
      definition.debrief.statedGoalReview,
      definition.debrief.predictionReview,
      definition.debrief.actionTimelineReview,
      ...definition.debrief.causalChain,
      definition.debrief.trendReview,
      definition.debrief.requiredActionsReview,
      definition.debrief.criticalErrorsReview,
      definition.debrief.acceptedAlternativesReview,
      definition.debrief.machineNavigationPoint,
      definition.debrief.transferQuestion,
    ])

    expect(learnerCopy.join('\n')).not.toMatch(
      /\b(?:synthetic|authored|candidate|reviewer|private learning|assessment gate|deterministic|canonical|device adapter|engine fixture|calibration|projection|source-mapped|bounded|model-derived|engine|pending SME|informational provenance)\b/i,
    )

    const firstCaseActions = getBaxterCrrtCase('CRRT-01').interventions.map(({ label }) => label)
    expect(firstCaseActions).toEqual(
      expect.arrayContaining([
        'Complete the initial clinical assessment',
        'Adjust machine fluid removal after assessment',
        'Communicate the plan and reassessment needs',
      ]),
    )
  })

  it('does not execute copied template physiology behind adapted clinical actions', () => {
    for (const caseId of [
      'CRRT-03',
      'CRRT-08',
      'CRRT-09',
      'CRRT-12',
      'CRRT-16',
      'CRRT-17',
      'CRRT-18',
    ] as const) {
      const definition = getBaxterCrrtCase(caseId)
      expect(definition.interventions.flatMap(({ effects }) => effects)).toEqual([])
      expect(
        definition.successConditions.every(
          ({ metric, comparator, value }) =>
            metric === 'simulationTimeSeconds' && comparator === 'gte' && value === 0,
        ),
      ).toBe(true)
    }
  })

  it('keeps the return-pressure case on the return path from fault through reassessment', () => {
    const definition = getBaxterCrrtCase('CRRT-14')
    const timedTargets = definition.timedEvents.flatMap(({ effects }) =>
      effects.map(({ target }) => target),
    )
    const correction = definition.interventions.find(({ id }) => id.endsWith('reposition-access'))
    const correctionTargets = correction?.effects.map(({ target }) => target) ?? []
    const successMetrics = definition.successConditions.map(({ metric }) => metric)

    expect(timedTargets).toEqual(
      expect.arrayContaining([
        'scenario.activeFaults.return-obstruction',
        'access.returnResistanceMmHgPerMlMin',
      ]),
    )
    expect(correctionTargets).toEqual(
      expect.arrayContaining([
        'scenario.activeFaults.return-obstruction',
        'access.returnResistanceMmHgPerMlMin',
      ]),
    )
    expect(successMetrics).toEqual(
      expect.arrayContaining([
        'access.returnResistanceMmHgPerMlMin',
        'circuit.pressures.returnPressureMmHg',
      ]),
    )
    expect([...timedTargets, ...correctionTargets, ...successMetrics].join(' ')).not.toMatch(
      /access-obstruction|access\.accessResistance|accessPressure/,
    )
  })

  it('treats low effective flow as a contributor to correct, not one to create', () => {
    const definition = getBaxterCrrtCase('CRRT-15')
    const correction = definition.interventions.find(({ id }) => id.endsWith('safe-candidate'))
    const lowFlowEffect = correction?.effects.find(
      ({ target }) => target === 'circuit.filter.lowEffectiveBloodFlowFraction',
    )
    const lowFlowCondition = definition.successConditions.find(
      ({ metric }) => metric === 'circuit.filter.lowEffectiveBloodFlowFraction',
    )

    expect(lowFlowEffect).toMatchObject({ operation: 'set', valueType: 'number', value: 0.1 })
    expect(lowFlowCondition).toMatchObject({ comparator: 'lte', value: 0.2 })
  })
})
