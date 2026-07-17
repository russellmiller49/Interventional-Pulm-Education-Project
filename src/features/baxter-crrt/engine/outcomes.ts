import type { RuntimeCrrtCase } from '../content/schema'
import type { CrrtLearningSessionState, CrrtPredictionCommitment } from './learningSession'
import type { CrrtSimulationState, ExternalFluidRateKey } from './types'

export const CRRT_PRACTICE_HINT_PENALTY_POINTS = 5

export const CRRT_OUTCOME_DOMAIN_MAXIMUMS = Object.freeze({
  indicationAndTreatmentGoal: 15,
  modalityAndPrescription: 20,
  machineAndCircuitOperation: 20,
  safetyAndTroubleshooting: 20,
  monitoringAndReassessment: 15,
  communicationAndCoordination: 10,
} as const)

export interface CrrtOutcomeDomainScores {
  readonly indicationAndTreatmentGoal: number
  readonly modalityAndPrescription: number
  readonly machineAndCircuitOperation: number
  readonly safetyAndTroubleshooting: number
  readonly monitoringAndReassessment: number
  readonly communicationAndCoordination: number
}

export interface CrrtLearningOutcome {
  readonly scored: boolean
  readonly score: number | null
  readonly mastery: boolean
  readonly domains: CrrtOutcomeDomainScores | null
  readonly hintPenalty: number
  readonly matchedRequiredPath: boolean
  readonly matchedAcceptedPathIds: readonly string[]
  readonly satisfiedConditionIds: readonly string[]
  readonly criticalErrorIds: readonly string[]
  readonly reassessmentComplete: boolean
}

export interface CrrtDebriefProjection {
  readonly summary: string
  readonly causalChain: readonly string[]
  readonly transferQuestion: string
  readonly statedGoalReview: string | null
  readonly predictionReview: string | null
  readonly actionTimelineReview: string | null
  readonly trendReview: string | null
  readonly requiredActionsReview: string | null
  readonly criticalErrorsReview: string | null
  readonly acceptedAlternativesReview: string | null
  readonly machineNavigationPoint: string | null
  readonly prediction: CrrtPredictionCommitment | null
  readonly timeline: CrrtLearningSessionState['timeline']
  readonly outcome: CrrtLearningOutcome
}

const externalFluidRateKeys = new Set<ExternalFluidRateKey>([
  'maintenanceInputMlHour',
  'medicationCarrierInputMlHour',
  'nutritionInputMlHour',
  'bloodProductInputMlHour',
  'bolusInputMlHour',
  'otherInputMlHour',
  'urineOutputMlHour',
  'drainOutputMlHour',
  'otherOutputMlHour',
])

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Fail-closed metric reader for authored case conditions. Runtime content never
 * receives arbitrary object traversal privileges.
 */
export function readAllowlistedCrrtMetric(
  state: CrrtSimulationState,
  metric: string,
): number | null {
  switch (metric) {
    case 'simulationTimeSeconds':
      return finiteOrNull(state.simulationTimeSeconds)
    case 'deliveredTherapy.prescribedEffluentDoseMlKgHour':
      return finiteOrNull(state.deliveredTherapy.prescribedEffluentDoseMlKgHour)
    case 'deliveredTherapy.deliveredDoseMlKgHour':
      return finiteOrNull(state.deliveredTherapy.deliveredDoseMlKgHour)
    case 'deliveredTherapy.cumulativeWholePatientBalanceMl':
      return finiteOrNull(state.deliveredTherapy.cumulativeWholePatientBalanceMl)
    case 'deliveredTherapy.cumulativeMachinePatientFluidRemovalMl':
      return finiteOrNull(state.deliveredTherapy.cumulativeMachinePatientFluidRemovalMl)
    case 'patient.hemodynamicStressIndex':
      return state.patient.status === 'configured'
        ? finiteOrNull(state.patient.hemodynamicStressIndex)
        : null
    case 'circuit.pressures.accessPressureMmHg':
      return finiteOrNull(state.circuit.pressures.accessPressureMmHg)
    case 'access.accessResistanceMmHgPerMlMin':
      return state.access.status === 'configured'
        ? finiteOrNull(state.access.accessResistanceMmHgPerMlMin)
        : null
    default: {
      const prefix = 'scenario.externalFluidRates.'
      if (!metric.startsWith(prefix)) return null
      const key = metric.slice(prefix.length)
      if (!externalFluidRateKeys.has(key as ExternalFluidRateKey)) return null
      return finiteOrNull(state.scenario.externalFluidRates[key as ExternalFluidRateKey])
    }
  }
}

type MetricCondition = RuntimeCrrtCase['successConditions'][number]

export function evaluateCrrtMetricCondition(
  state: CrrtSimulationState,
  condition: MetricCondition,
): boolean {
  const actual = readAllowlistedCrrtMetric(state, condition.metric)
  if (actual === null) return false

  if (condition.comparator === 'between') {
    return (
      Array.isArray(condition.value) && actual >= condition.value[0] && actual <= condition.value[1]
    )
  }
  if (Array.isArray(condition.value)) return false

  switch (condition.comparator) {
    case 'lt':
      return actual < condition.value
    case 'lte':
      return actual <= condition.value
    case 'eq':
      return Math.abs(actual - condition.value) <= 1e-9
    case 'gte':
      return actual >= condition.value
    case 'gt':
      return actual > condition.value
    default:
      return false
  }
}

function conditionResults(session: CrrtLearningSessionState): ReadonlyMap<string, boolean> {
  return new Map(
    session.caseDefinition.successConditions.map((condition) => [
      condition.id,
      evaluateCrrtMetricCondition(session.simulation, condition),
    ]),
  )
}

function allIncluded(required: readonly string[], actual: ReadonlySet<string>): boolean {
  return required.every((id) => actual.has(id))
}

export function selectMatchedAcceptedPathIds(session: CrrtLearningSessionState): readonly string[] {
  const actions = new Set(session.performedInterventionIds)
  const reassessments = new Set(session.reassessment.optionIds)
  const conditions = conditionResults(session)

  return session.caseDefinition.acceptedAlternativePaths
    .filter(
      (path) =>
        allIncluded(path.actionIds, actions) &&
        allIncluded(path.reassessmentIds, reassessments) &&
        path.successConditionIds.every((id) => conditions.get(id) === true),
    )
    .map((path) => path.id)
}

function matchesRequiredPath(session: CrrtLearningSessionState): boolean {
  const actions = new Set(session.performedInterventionIds)
  const reassessments = new Set(session.reassessment.optionIds)
  return (
    allIncluded(session.caseDefinition.requiredActionIds, actions) &&
    allIncluded(session.caseDefinition.requiredReassessmentIds, reassessments) &&
    session.caseDefinition.successConditions.every((condition) =>
      evaluateCrrtMetricCondition(session.simulation, condition),
    )
  )
}

/** Draft critical-trigger contract: unsafe-action links trigger directly. A
 * critical rule with both action and condition requirements triggers only when
 * both groups match; multiple conditions form a conjunction. */
export function selectTriggeredCriticalErrorIds(
  session: Pick<
    CrrtLearningSessionState,
    'caseDefinition' | 'performedInterventionIds' | 'simulation'
  >,
): readonly string[] {
  const actions = new Set(session.performedInterventionIds)
  const conditions = new Map(
    session.caseDefinition.successConditions.map((condition) => [
      condition.id,
      evaluateCrrtMetricCondition(session.simulation, condition),
    ]),
  )
  const triggered = new Set<string>()

  for (const unsafeAction of session.caseDefinition.unsafeActions) {
    if (unsafeAction.criticalErrorId && actions.has(unsafeAction.actionId)) {
      triggered.add(unsafeAction.criticalErrorId)
    }
  }

  for (const criticalError of session.caseDefinition.criticalErrors) {
    const hasActionTrigger = criticalError.actionIds.length > 0
    const hasConditionTrigger = criticalError.conditionIds.length > 0
    if (!hasActionTrigger && !hasConditionTrigger) continue
    const actionsMatch =
      !hasActionTrigger || criticalError.actionIds.some((actionId) => actions.has(actionId))
    const conditionsMatch =
      !hasConditionTrigger ||
      criticalError.conditionIds.every((conditionId) => conditions.get(conditionId) === true)
    if (actionsMatch && conditionsMatch) triggered.add(criticalError.id)
  }

  return [...triggered].sort()
}

function hasCorrectPrediction(session: CrrtLearningSessionState): boolean {
  const prediction = session.prediction
  if (!prediction) return false
  const hidden = session.caseDefinition.hiddenMechanism
  const selectedControls = new Set(prediction.controlOptionIds)
  return (
    prediction.mechanismOptionId === hidden.correctMechanismOptionId &&
    prediction.responseOptionId === hidden.correctResponseOptionId &&
    allIncluded(hidden.correctControlOptionIds, selectedControls)
  )
}

function hasCompleteReassessment(session: CrrtLearningSessionState): boolean {
  if (!session.reassessment.committed) return false
  const selected = new Set(session.reassessment.optionIds)
  return allIncluded(session.caseDefinition.requiredReassessmentIds, selected)
}

export function selectCrrtLearningOutcome(session: CrrtLearningSessionState): CrrtLearningOutcome {
  const matchedRequiredPath = matchesRequiredPath(session)
  const matchedAcceptedPathIds = selectMatchedAcceptedPathIds(session)
  const acceptedEndpoint = matchedRequiredPath || matchedAcceptedPathIds.length > 0
  const triggeredCriticalErrors = selectTriggeredCriticalErrorIds(session)
  const criticalErrorIds = [
    ...new Set([...session.criticalErrorIds, ...triggeredCriticalErrors]),
  ].sort()
  const reassessmentComplete = hasCompleteReassessment(session)
  const satisfiedConditionIds = session.caseDefinition.successConditions
    .filter((condition) => evaluateCrrtMetricCondition(session.simulation, condition))
    .map((condition) => condition.id)

  if (session.experience === 'learn') {
    return {
      scored: false,
      score: null,
      mastery: false,
      domains: null,
      hintPenalty: 0,
      matchedRequiredPath,
      matchedAcceptedPathIds,
      satisfiedConditionIds,
      criticalErrorIds,
      reassessmentComplete,
    }
  }

  const prediction = session.prediction
  const performed = new Set(session.performedInterventionIds)
  const communicationComplete = session.caseDefinition.interventions.some(
    (intervention) => intervention.category === 'communication' && performed.has(intervention.id),
  )
  const domains: CrrtOutcomeDomainScores = {
    indicationAndTreatmentGoal:
      prediction?.goalOptionId === session.caseDefinition.hiddenMechanism.correctGoalOptionId
        ? CRRT_OUTCOME_DOMAIN_MAXIMUMS.indicationAndTreatmentGoal
        : 0,
    modalityAndPrescription: hasCorrectPrediction(session)
      ? CRRT_OUTCOME_DOMAIN_MAXIMUMS.modalityAndPrescription
      : 0,
    machineAndCircuitOperation: acceptedEndpoint
      ? CRRT_OUTCOME_DOMAIN_MAXIMUMS.machineAndCircuitOperation
      : 0,
    safetyAndTroubleshooting:
      criticalErrorIds.length === 0 ? CRRT_OUTCOME_DOMAIN_MAXIMUMS.safetyAndTroubleshooting : 0,
    monitoringAndReassessment: reassessmentComplete
      ? CRRT_OUTCOME_DOMAIN_MAXIMUMS.monitoringAndReassessment
      : 0,
    communicationAndCoordination: communicationComplete
      ? CRRT_OUTCOME_DOMAIN_MAXIMUMS.communicationAndCoordination
      : 0,
  }
  const rawScore = Object.values(domains).reduce((sum, value) => sum + value, 0)
  const hintPenalty = Math.min(100, session.usedHintIds.length * CRRT_PRACTICE_HINT_PENALTY_POINTS)
  const score = Math.max(0, rawScore - hintPenalty)

  return {
    scored: true,
    score,
    mastery: score >= 80 && criticalErrorIds.length === 0 && reassessmentComplete,
    domains,
    hintPenalty,
    matchedRequiredPath,
    matchedAcceptedPathIds,
    satisfiedConditionIds,
    criticalErrorIds,
    reassessmentComplete,
  }
}

function optionalDebriefField(debrief: RuntimeCrrtCase['debrief'], field: string): string | null {
  const value = (debrief as unknown as Readonly<Record<string, unknown>>)[field]
  return typeof value === 'string' ? value : null
}

export function selectCrrtDebriefProjection(
  session: CrrtLearningSessionState,
): CrrtDebriefProjection {
  const debrief = session.caseDefinition.debrief
  return {
    summary: debrief.summary,
    causalChain: [...debrief.causalChain],
    transferQuestion: debrief.transferQuestion,
    statedGoalReview: optionalDebriefField(debrief, 'statedGoalReview'),
    predictionReview: optionalDebriefField(debrief, 'predictionReview'),
    actionTimelineReview: optionalDebriefField(debrief, 'actionTimelineReview'),
    trendReview: optionalDebriefField(debrief, 'trendReview'),
    requiredActionsReview: optionalDebriefField(debrief, 'requiredActionsReview'),
    criticalErrorsReview: optionalDebriefField(debrief, 'criticalErrorsReview'),
    acceptedAlternativesReview: optionalDebriefField(debrief, 'acceptedAlternativesReview'),
    machineNavigationPoint: optionalDebriefField(debrief, 'machineNavigationPoint'),
    prediction: session.prediction,
    timeline: session.timeline,
    outcome: selectCrrtLearningOutcome(session),
  }
}
