import { getBaxterCrrtPilotCase, getBaxterCrrtPilotFixture } from '../content'
import { CRRT_PILOT_CASE_IDS } from '../content/schema'
import {
  createCrrtLearningSession,
  crrtLearningSessionReducer,
  type CrrtLearningSessionState,
} from '../engine/learningSession'
import {
  evaluateCrrtMetricCondition,
  selectCrrtDebriefProjection,
  selectCrrtLearningOutcome,
} from '../engine/outcomes'

type PilotCaseId = (typeof CRRT_PILOT_CASE_IDS)[number]

type AuthoredUnsafeEffect =
  | 'blocked-start'
  | 'no-engine-change'
  | 'unsafe-pfr-increase'
  | 'unsafe-bfr-increase'
  | 'unresolved-access-no-effect'

interface PilotUnsafePathScenario {
  readonly caseId: PilotCaseId
  readonly unsafeActionId: string
  readonly criticalErrorId: string
  readonly setupActionIds: readonly string[]
  readonly authoredEffect: AuthoredUnsafeEffect
}

const pilotUnsafePathScenarios: readonly PilotUnsafePathScenario[] = [
  {
    caseId: 'CRRT-04',
    unsafeActionId: 'crrt04-start-before-review',
    criticalErrorId: 'crrt04-critical-start-before-review',
    setupActionIds: [],
    authoredEffect: 'blocked-start',
  },
  {
    caseId: 'CRRT-04',
    unsafeActionId: 'crrt04-equate-prescribed-delivered',
    criticalErrorId: 'crrt04-critical-ignore-downtime',
    setupActionIds: [
      'crrt04-assess-goal',
      'crrt04-enter-blood-flow',
      'crrt04-enter-dialysate-primary',
      'crrt04-enter-machine-pfr',
      'crrt04-complete-prime-review',
      'crrt04-start-reviewed-treatment',
      'crrt04-advance-six-hours',
    ],
    authoredEffect: 'no-engine-change',
  },
  {
    caseId: 'CRRT-10',
    unsafeActionId: 'crrt10-increase-pfr-without-reassessment',
    criticalErrorId: 'crrt10-critical-unreassessed-pfr-increase',
    setupActionIds: [],
    authoredEffect: 'unsafe-pfr-increase',
  },
  {
    caseId: 'CRRT-10',
    unsafeActionId: 'crrt10-ignore-external-balance',
    criticalErrorId: 'crrt10-critical-ignore-whole-balance',
    setupActionIds: [],
    authoredEffect: 'no-engine-change',
  },
  {
    caseId: 'CRRT-13',
    unsafeActionId: 'crrt13-increase-bfr-through-obstruction',
    criticalErrorId: 'crrt13-critical-increase-bfr',
    setupActionIds: ['crrt13-assess-patient-device', 'crrt13-advance-to-pattern'],
    authoredEffect: 'unsafe-bfr-increase',
  },
  {
    caseId: 'CRRT-13',
    unsafeActionId: 'crrt13-declare-resolved-after-ack',
    criticalErrorId: 'crrt13-critical-acknowledgement-only',
    setupActionIds: [
      'crrt13-assess-patient-device',
      'crrt13-advance-to-pattern',
      'crrt13-acknowledge-alert',
    ],
    authoredEffect: 'unresolved-access-no-effect',
  },
  {
    caseId: 'CRRT-13',
    unsafeActionId: 'crrt13-escalate-anticoagulation-first',
    criticalErrorId: 'crrt13-critical-anticoagulation-first',
    setupActionIds: [
      'crrt13-assess-patient-device',
      'crrt13-advance-to-pattern',
      'crrt13-inspect-access-path',
    ],
    authoredEffect: 'unresolved-access-no-effect',
  },
] as const

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

function createCommittedPracticeSession(
  caseId: PilotCaseId,
  attempt: number,
): CrrtLearningSessionState {
  const definition = getBaxterCrrtPilotCase(caseId)
  const hidden = definition.hiddenMechanism
  let initial = createCrrtLearningSession({
    caseDefinition: definition,
    fixture: getBaxterCrrtPilotFixture(caseId),
    experience: 'practice',
    roleLens: 'integrated',
    attempt,
  })
  initial = advanceToPrediction(initial)

  return crrtLearningSessionReducer(initial, {
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

function performIntervention(
  state: CrrtLearningSessionState,
  interventionId: string,
): CrrtLearningSessionState {
  return crrtLearningSessionReducer(state, {
    type: 'PERFORM_INTERVENTION',
    interventionId,
  })
}

function exerciseUnsafePath(
  scenario: PilotUnsafePathScenario,
  attempt: number,
): {
  readonly beforeUnsafeAction: CrrtLearningSessionState
  readonly afterUnsafeAction: CrrtLearningSessionState
  readonly completed: CrrtLearningSessionState
} {
  let state = createCommittedPracticeSession(scenario.caseId, attempt)
  const unsafeIntervention = state.caseDefinition.interventions.find(
    ({ id }) => id === scenario.unsafeActionId,
  )
  if (!unsafeIntervention) throw new Error(`Missing unsafe intervention ${scenario.unsafeActionId}`)

  if (unsafeIntervention.prerequisites.length > 0) {
    const blocked = performIntervention(state, scenario.unsafeActionId)
    expect(blocked).toBe(state)
    expect(blocked.performedInterventionIds).not.toContain(scenario.unsafeActionId)
    expect(blocked.criticalErrorIds).toEqual([])
  }

  for (const setupActionId of scenario.setupActionIds) {
    const previous = state
    state = performIntervention(state, setupActionId)
    expect(state).not.toBe(previous)
    expect(state.performedInterventionIds).toContain(setupActionId)
  }

  expect(
    unsafeIntervention.prerequisites.every((prerequisiteId) =>
      state.performedInterventionIds.includes(prerequisiteId),
    ),
  ).toBe(true)

  const beforeUnsafeAction = state
  const afterUnsafeAction = performIntervention(beforeUnsafeAction, scenario.unsafeActionId)
  expect(afterUnsafeAction).not.toBe(beforeUnsafeAction)
  expect(afterUnsafeAction.performedInterventionIds).toContain(scenario.unsafeActionId)

  const criticalError = afterUnsafeAction.caseDefinition.criticalErrors.find(
    ({ id }) => id === scenario.criticalErrorId,
  )
  if (!criticalError) throw new Error(`Missing critical error ${scenario.criticalErrorId}`)
  expect(criticalError.actionIds).toContain(scenario.unsafeActionId)
  for (const conditionId of criticalError.conditionIds) {
    const condition = afterUnsafeAction.caseDefinition.successConditions.find(
      ({ id }) => id === conditionId,
    )
    if (!condition) throw new Error(`Missing critical trigger condition ${conditionId}`)
    expect(evaluateCrrtMetricCondition(afterUnsafeAction.simulation, condition)).toBe(true)
  }

  let completed = crrtLearningSessionReducer(afterUnsafeAction, {
    type: 'ADVANCE_TIME',
    seconds: 60,
  })
  completed = crrtLearningSessionReducer(completed, {
    type: 'COMMIT_REASSESSMENT',
    optionIds: afterUnsafeAction.caseDefinition.requiredReassessmentIds,
  })
  completed = crrtLearningSessionReducer(completed, { type: 'REVEAL_DEBRIEF' })
  expect(completed.debriefRevealed).toBe(true)

  return { beforeUnsafeAction, afterUnsafeAction, completed }
}

function expectAuthoredUnsafeEffect(
  effect: AuthoredUnsafeEffect,
  before: CrrtLearningSessionState,
  after: CrrtLearningSessionState,
): void {
  switch (effect) {
    case 'blocked-start':
      expect(before.simulation.device.deliveryState).toBe('idle')
      expect(before.interfaceState).toMatchObject({
        screen: 'start',
        treatmentState: 'idle',
      })
      expect(after.simulation).toEqual(before.simulation)
      expect(after.interfaceState).toEqual(before.interfaceState)
      break
    case 'no-engine-change':
      expect(after.simulation).toEqual(before.simulation)
      expect(after.interfaceState).toEqual(before.interfaceState)
      break
    case 'unsafe-pfr-increase':
      expect(before.simulation.prescription.status).toBe('configured')
      expect(after.simulation.prescription.status).toBe('configured')
      if (after.simulation.prescription.status === 'configured') {
        expect(after.simulation.prescription.flows.patientFluidRemovalMlHour).toBe(700)
      }
      expect(after.simulation.device.deliveryState).toBe('running')
      expect(after.interfaceState.treatmentState).toBe('running')
      break
    case 'unsafe-bfr-increase': {
      expect(before.simulation.prescription.status).toBe('configured')
      expect(after.simulation.prescription.status).toBe('configured')
      if (after.simulation.prescription.status === 'configured') {
        expect(after.simulation.prescription.flows.bloodFlowMlMin).toBe(180)
      }
      expect(after.simulation.circuit.pressures.accessPressureMmHg).toBeLessThan(
        before.simulation.circuit.pressures.accessPressureMmHg ?? Number.POSITIVE_INFINITY,
      )
      expect(after.simulation.scenario.activeFaults).toContain('access-obstruction')
      expect(after.simulation.access).toMatchObject({
        status: 'configured',
        accessResistanceMmHgPerMlMin: 1.2,
      })
      break
    }
    case 'unresolved-access-no-effect':
      expect(after.simulation).toEqual(before.simulation)
      expect(after.interfaceState).toEqual(before.interfaceState)
      expect(after.simulation.scenario.activeFaults).toContain('access-obstruction')
      expect(after.simulation.access).toMatchObject({
        status: 'configured',
        accessResistanceMmHgPerMlMin: 1.2,
      })
      break
    default: {
      const exhaustive: never = effect
      throw new Error(`Unhandled authored unsafe effect: ${exhaustive}`)
    }
  }
}

describe('Baxter CRRT pilot unsafe and critical paths', () => {
  it('enumerates every declared pilot unsafe action and every declared critical error', () => {
    const declaredUnsafeActions = CRRT_PILOT_CASE_IDS.flatMap((caseId) =>
      getBaxterCrrtPilotCase(caseId).unsafeActions.map(({ actionId }) => `${caseId}:${actionId}`),
    ).sort()
    const exercisedUnsafeActions = pilotUnsafePathScenarios
      .map(({ caseId, unsafeActionId }) => `${caseId}:${unsafeActionId}`)
      .sort()
    const declaredCriticalErrors = CRRT_PILOT_CASE_IDS.flatMap((caseId) =>
      getBaxterCrrtPilotCase(caseId).criticalErrors.map(({ id }) => `${caseId}:${id}`),
    ).sort()
    const exercisedCriticalErrors = pilotUnsafePathScenarios
      .map(({ caseId, criticalErrorId }) => `${caseId}:${criticalErrorId}`)
      .sort()

    expect(exercisedUnsafeActions).toEqual(declaredUnsafeActions)
    expect(exercisedCriticalErrors).toEqual(declaredCriticalErrors)
  })

  it.each(pilotUnsafePathScenarios)(
    '$caseId · $unsafeActionId triggers only $criticalErrorId and cannot complete safely',
    (scenario) => {
      const first = exerciseUnsafePath(scenario, 17)
      const second = exerciseUnsafePath(scenario, 17)

      expect(first.afterUnsafeAction.criticalErrorIds).toEqual([scenario.criticalErrorId])
      expectAuthoredUnsafeEffect(
        scenario.authoredEffect,
        first.beforeUnsafeAction,
        first.afterUnsafeAction,
      )

      const outcome = selectCrrtLearningOutcome(first.completed)
      expect(outcome).toMatchObject({
        matchedRequiredPath: false,
        matchedAcceptedPathIds: [],
        criticalErrorIds: [scenario.criticalErrorId],
        reassessmentComplete: true,
        mastery: false,
      })
      expect(outcome.domains?.safetyAndTroubleshooting).toBe(0)

      const firstDebrief = selectCrrtDebriefProjection(first.completed)
      const secondDebrief = selectCrrtDebriefProjection(second.completed)
      expect(firstDebrief).toEqual(secondDebrief)
      expect(firstDebrief.causalChain).toEqual(first.completed.caseDefinition.debrief.causalChain)
      expect(firstDebrief.outcome.criticalErrorIds).toEqual([scenario.criticalErrorId])
      expect(firstDebrief.timeline).toContainEqual(
        expect.objectContaining({
          type: 'intervention-performed',
          referenceId: scenario.unsafeActionId,
        }),
      )
      expect(firstDebrief.timeline.at(-1)).toMatchObject({
        type: 'debrief-revealed',
        referenceId: null,
      })
    },
  )
})
