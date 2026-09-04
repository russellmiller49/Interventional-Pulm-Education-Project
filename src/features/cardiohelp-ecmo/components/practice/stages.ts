import type { CriticalCareActivityPhase } from '@/features/learning-module/activity/types'

import type { EcmoSimulationState, ScenarioDefinition } from '../../engine/types'

/**
 * The five stages of a Practice case, derived from engine state.
 *
 * Nothing here is stored: the stage the learner is on is read off what the engine already knows —
 * whether the plan is committed, whether the corrective fault has been resolved, whether the
 * reassessment is submitted, whether the debrief has been revealed. The one piece of view state
 * (whether the brief has been acknowledged for this attempt) is passed in.
 */

export type EcmoPracticeStage = 'brief' | 'plan' | 'manage' | 'reassess' | 'debrief'

export const semanticPhaseByCaseStage: Readonly<
  Record<EcmoPracticeStage, CriticalCareActivityPhase>
> = {
  brief: 'recognize',
  plan: 'predict',
  manage: 'act',
  reassess: 'observe',
  debrief: 'explain',
}

export interface StageDescriptor {
  readonly id: EcmoPracticeStage
  readonly number: number
  readonly label: string
  readonly complete: boolean
  readonly summary?: string
}

export interface ObservationProgress {
  readonly anchor: number | null
  readonly elapsedSeconds: number
  readonly minimumSeconds: number
  readonly remainingSeconds: number
  readonly responseObserved: boolean
}

export function getObservationProgress(
  state: EcmoSimulationState,
  scenario: ScenarioDefinition,
): ObservationProgress {
  const correctedAt = state.scenario.causeCorrectedAt
  const lastClinicalActionAt = state.scenario.clinical?.appliedInterventions.at(-1)?.time ?? null
  const acknowledgedAt = state.alarms.reduce<number | null>(
    (latest, alarm) =>
      alarm.acknowledgedAt === undefined
        ? latest
        : Math.max(latest ?? alarm.acknowledgedAt, alarm.acknowledgedAt),
    null,
  )
  const anchor = correctedAt ?? lastClinicalActionAt ?? acknowledgedAt
  const minimumSeconds = scenario.assessmentPolicy?.minimumObservationSeconds ?? 1
  const elapsedSeconds = anchor === null ? 0 : Math.max(0, state.simulationTime - anchor)
  const remainingSeconds = Math.max(0, minimumSeconds - elapsedSeconds)
  return {
    anchor,
    elapsedSeconds,
    minimumSeconds,
    remainingSeconds,
    responseObserved: anchor !== null && remainingSeconds === 0,
  }
}

export interface PracticeStageFacts {
  readonly hasBrief: boolean
  readonly briefAcknowledged: boolean
  readonly planComplete: boolean
  readonly causeCorrected: boolean
  /**
   * Manage is done: the corrective fault is resolved and, for a clinical case, every required
   * intervention has been applied and support is running when the case starts ECMO. Correcting a
   * fault early (an initiation case's readiness check) does not end a stage the learner is still
   * working in.
   */
  readonly manageComplete: boolean
  readonly reassessmentSubmitted: boolean
  readonly debriefRevealed: boolean
  readonly currentStage: EcmoPracticeStage
  readonly stages: readonly StageDescriptor[]
  readonly observation: ObservationProgress
}

export function resolvePracticeStages(
  state: EcmoSimulationState,
  scenario: ScenarioDefinition,
  briefAcknowledged: boolean,
  committedGoalLabel?: string,
): PracticeStageFacts {
  const hasBrief = Boolean(scenario.clinicalCase)
  const planComplete = state.scenario.prediction.committed
  const causeCorrected = state.scenario.correctedFaults.includes(
    scenario.expectation.correctiveFault,
  )
  const reassessmentSubmitted = state.scenario.reassessment !== null
  const debriefRevealed = state.scenario.phase === 'complete'
  const clinicalCase = scenario.clinicalCase
  const clinical = state.scenario.clinical
  const applied = new Set(clinical?.appliedInterventions.map((record) => record.interventionId))
  const requiredApplied =
    !clinicalCase || clinicalCase.requiredInterventionIds.every((id) => applied.has(id))
  const supportEstablished =
    !clinicalCase?.initiationTargets || clinical?.supportStatus === 'on-ecmo'
  const manageComplete = causeCorrected && requiredApplied && supportEstablished
  const workflowStage: EcmoPracticeStage = !planComplete
    ? 'plan'
    : reassessmentSubmitted
      ? 'debrief'
      : manageComplete
        ? 'reassess'
        : 'manage'
  const currentStage: EcmoPracticeStage =
    hasBrief && !briefAcknowledged && !planComplete ? 'brief' : workflowStage

  const appliedCount = state.scenario.clinical?.appliedInterventions.length ?? 0
  const trajectory = state.scenario.clinical?.trajectory
  const stages: StageDescriptor[] = []
  if (hasBrief) {
    stages.push({
      id: 'brief',
      number: stages.length + 1,
      label: 'Brief',
      complete: briefAcknowledged || planComplete,
      summary: briefAcknowledged || planComplete ? 'Reviewed' : undefined,
    })
  }
  stages.push({
    id: 'plan',
    number: stages.length + 1,
    label: 'Plan',
    complete: planComplete,
    summary: planComplete ? (committedGoalLabel ?? 'Committed') : undefined,
  })
  stages.push({
    id: 'manage',
    number: stages.length + 1,
    label: 'Manage',
    complete: manageComplete,
    summary: appliedCount
      ? `${appliedCount} action${appliedCount === 1 ? '' : 's'}${trajectory ? ` · ${trajectory.replaceAll('-', ' ')}` : ''}`
      : undefined,
  })
  stages.push({
    id: 'reassess',
    number: stages.length + 1,
    label: 'Reassess',
    complete: reassessmentSubmitted,
    summary: reassessmentSubmitted ? 'Submitted' : undefined,
  })
  stages.push({
    id: 'debrief',
    number: stages.length + 1,
    label: 'Debrief',
    complete: debriefRevealed,
    summary: debriefRevealed ? 'Reviewed' : undefined,
  })

  return {
    hasBrief,
    briefAcknowledged,
    planComplete,
    causeCorrected,
    manageComplete,
    reassessmentSubmitted,
    debriefRevealed,
    currentStage,
    stages,
    observation: getObservationProgress(state, scenario),
  }
}

/** A stage the learner may open: reached stages only, so nothing later than the current one. */
export function stageReachable(
  stages: readonly StageDescriptor[],
  currentStage: EcmoPracticeStage,
  candidate: EcmoPracticeStage,
): boolean {
  const currentIndex = stages.findIndex((stage) => stage.id === currentStage)
  const candidateIndex = stages.findIndex((stage) => stage.id === candidate)
  return candidateIndex !== -1 && candidateIndex <= currentIndex
}
