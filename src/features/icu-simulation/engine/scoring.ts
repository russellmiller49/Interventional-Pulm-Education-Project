import { ICU_SCORE_WEIGHTS, icuScoreDomains } from './types'
import { createEmptyIcuResponseEvaluation, evaluateIcuMasteryResponse } from './response'
import type {
  IcuOutcomeState,
  IcuScenarioCheckpointDefinition,
  IcuScenarioDefinition,
  IcuScoreBreakdown,
  IcuSimulationState,
} from './types'

function checkpointCompleted(
  checkpoint: IcuScenarioCheckpointDefinition,
  state: Pick<IcuSimulationState, 'performedActionIds' | 'actionHistory'>,
): boolean {
  const actions = new Set(state.performedActionIds)
  let afterSequence = -1
  for (const requiredId of checkpoint.requiredActionIds) {
    const record = state.actionHistory.find(
      (item) => item.actionId === requiredId && item.sequence > afterSequence,
    )
    if (!record) return false
    afterSequence = record.sequence
  }
  return checkpoint.acceptedAlternativeActionIdGroups.every((group) =>
    group.some((id) => actions.has(id)),
  )
}

export function scoreIcuSimulation(
  state: Pick<
    IcuSimulationState,
    | 'performedActionIds'
    | 'actionHistory'
    | 'outcome'
    | 'clock'
    | 'mode'
    | 'patient'
    | 'devices'
    | 'alarms'
  >,
  scenario: IcuScenarioDefinition,
  completed = state.outcome.completed,
): IcuOutcomeState {
  const response = completed
    ? evaluateIcuMasteryResponse(state, scenario)
    : createEmptyIcuResponseEvaluation()
  if (state.mode === 'sandbox') {
    return {
      ...createEmptyIcuOutcome(),
      completed,
      criticalErrorIds: [...state.outcome.criticalErrorIds],
      response,
    }
  }
  const actions = new Set([...state.performedActionIds, ...response.substitutedActionIds])
  const domainScores = Object.fromEntries(
    icuScoreDomains.map((domain) => {
      const required = scenario.scoring[domain]
      const achieved = required.filter((id) => actions.has(id)).length
      const score = required.length
        ? Math.round((achieved / required.length) * ICU_SCORE_WEIGHTS[domain])
        : 0
      return [domain, score]
    }),
  ) as Record<(typeof icuScoreDomains)[number], number>
  const total = icuScoreDomains.reduce((sum, domain) => sum + domainScores[domain], 0)
  const criticalErrorIds = [...state.outcome.criticalErrorIds]
  const score: IcuScoreBreakdown = { ...domainScores, total }
  const checkpointIdsCompleted = scenario.checkpoints
    .filter((checkpoint) => checkpointCompleted(checkpoint, state))
    .map((checkpoint) => checkpoint.id)
  const reassessmentTimes = [
    ...new Set(
      state.actionHistory
        .filter((record) => record.actionId.startsWith('reassess:'))
        .map((record) => record.elapsedSeconds),
    ),
  ].sort((left, right) => left - right)
  const serialReassessment =
    reassessmentTimes.length >= 2 &&
    reassessmentTimes[reassessmentTimes.length - 1] - reassessmentTimes[0] >= 300
  return {
    completed,
    score,
    criticalErrorIds,
    mastery:
      completed &&
      total >= 80 &&
      criticalErrorIds.length === 0 &&
      state.clock.elapsedSeconds >= scenario.minimumMasteryElapsedSeconds &&
      serialReassessment &&
      checkpointIdsCompleted.length === scenario.checkpoints.length &&
      response.passed,
    checkpointIdsCompleted,
    response,
  }
}

export function createEmptyIcuOutcome(): IcuOutcomeState {
  return {
    completed: false,
    score: {
      assessment: 0,
      prioritization: 0,
      therapy: 0,
      device: 0,
      reassessment: 0,
      safety: 0,
      total: 0,
    },
    criticalErrorIds: [],
    mastery: false,
    checkpointIdsCompleted: [],
    response: createEmptyIcuResponseEvaluation(),
  }
}
