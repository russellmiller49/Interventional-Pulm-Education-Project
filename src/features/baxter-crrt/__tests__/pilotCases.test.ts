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
})
