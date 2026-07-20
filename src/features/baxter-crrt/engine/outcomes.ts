import type { RuntimeCrrtCase } from '../content/schema'
import { BAXTER_CRRT_CONTENT_VERSION } from '../content/versions'
import type { CrrtLearningSessionState, CrrtPredictionCommitment } from './learningSession'
import {
  crrtSoluteIds,
  type CrrtFlowRates,
  type CrrtSimulationState,
  type CrrtSoluteId,
  type ExternalFluidRateKey,
} from './types'

export const CRRT_PRACTICE_HINT_PENALTY_POINTS = 5
export const CRRT_MASTERY_MINIMUM_SCORE = 80

interface CrrtMasteryRuntimeDefinition {
  readonly capstoneId: string
  readonly runtimeCaseId: RuntimeCrrtCase['id']
  readonly contentVersion: string
  readonly problemDomainIds: readonly string[]
  readonly available: true
}

const masteryIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/

function isBoundedMasteryIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    masteryIdentifierPattern.test(value)
  )
}

/**
 * Content-owned Mastery mapping. Review status is informational in the private
 * SME build and does not block execution.
 */
const crrtMasteryRuntimeDefinitions: readonly CrrtMasteryRuntimeDefinition[] = Object.freeze([
  Object.freeze({
    capstoneId: 'MASTERY-PRISMAX-01',
    runtimeCaseId: 'CRRT-16',
    contentVersion: BAXTER_CRRT_CONTENT_VERSION,
    problemDomainIds: Object.freeze([
      'pressure-trend-localization',
      'filter-delivery-history',
      'patient-and-circuit-reassessment',
    ]),
    available: true as const,
  }),
])

function isValidMasteryRuntimeDefinition(record: CrrtMasteryRuntimeDefinition): boolean {
  const distinctProblemDomains = new Set(record.problemDomainIds)
  return (
    record.available === true &&
    isBoundedMasteryIdentifier(record.capstoneId) &&
    isBoundedMasteryIdentifier(record.runtimeCaseId) &&
    isBoundedMasteryIdentifier(record.contentVersion) &&
    distinctProblemDomains.size >= 2 &&
    [...distinctProblemDomains].every(isBoundedMasteryIdentifier)
  )
}

export function isCrrtMasteryRuntimeCaseAvailable(
  caseDefinition: Pick<RuntimeCrrtCase, 'id' | 'contentVersion'>,
): boolean {
  return selectCrrtMasteryCapstoneId(caseDefinition) !== null
}

export function selectCrrtMasteryCapstoneId(
  caseDefinition: Pick<RuntimeCrrtCase, 'id' | 'contentVersion'>,
): string | null {
  return (
    crrtMasteryRuntimeDefinitions.find(
      (record) =>
        isValidMasteryRuntimeDefinition(record) &&
        record.runtimeCaseId === caseDefinition.id &&
        record.contentVersion === caseDefinition.contentVersion,
    )?.capstoneId ?? null
  )
}

export function isCrrtMasteryCapstoneAvailable(capstoneId: string): boolean {
  return crrtMasteryRuntimeDefinitions.some(
    (record) => isValidMasteryRuntimeDefinition(record) && record.capstoneId === capstoneId,
  )
}

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

export interface CrrtOutcomeIdentity {
  readonly caseId: RuntimeCrrtCase['id']
  readonly attempt: number
  readonly seed: number
  readonly engineVersion: string
  readonly engineSchemaVersion: string
  readonly simulationContentVersion: string
  readonly caseContentVersion: string
  readonly deviceProfileVersion: string
  readonly protocolProfileVersion: string | null
}

export interface CrrtLearningOutcome {
  /** Ephemeral replay identity; never included in progress or analytics payloads. */
  readonly resultIdentity: CrrtOutcomeIdentity
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
  readonly statedGoalReview: string
  readonly predictionReview: string
  readonly actionTimelineReview: string
  readonly trendReview: string
  readonly requiredActionsReview: string
  readonly criticalErrorsReview: string
  readonly acceptedAlternativesReview: string
  readonly machineNavigationPoint: string
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

const prescriptionFlowKeys = new Set<keyof CrrtFlowRates>([
  'bloodFlowMlMin',
  'dialysateFlowMlHour',
  'pbpFlowMlHour',
  'preReplacementFlowMlHour',
  'postReplacementFlowMlHour',
  'patientFluidRemovalMlHour',
  'syringeFlowMlHour',
  'makeupFlowMlHour',
])

const soluteIds = new Set<CrrtSoluteId>(crrtSoluteIds)

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
    case 'deliveredTherapy.filtrationFraction':
      return finiteOrNull(state.deliveredTherapy.filtrationFraction)
    case 'deliveredTherapy.cumulativeDowntimeSeconds':
      return finiteOrNull(state.deliveredTherapy.cumulativeDowntimeSeconds)
    case 'deliveredTherapy.treatmentTimeSeconds':
      return finiteOrNull(state.deliveredTherapy.treatmentTimeSeconds)
    case 'patient.hemodynamicStressIndex':
      return state.patient.status === 'configured'
        ? finiteOrNull(state.patient.hemodynamicStressIndex)
        : null
    case 'patient.bodyWeightKg':
      return state.patient.status === 'configured' ? finiteOrNull(state.patient.bodyWeightKg) : null
    case 'patient.hematocritFraction':
      return state.patient.status === 'configured'
        ? finiteOrNull(state.patient.hematocritFraction)
        : null
    case 'patient.meanArterialPressureMmHg':
      return state.patient.status === 'configured'
        ? finiteOrNull(state.patient.meanArterialPressureMmHg)
        : null
    case 'patient.temperatureCelsius':
      return state.patient.status === 'configured'
        ? finiteOrNull(state.patient.temperatureCelsius)
        : null
    case 'patient.pH':
      return state.patient.status === 'configured' ? finiteOrNull(state.patient.pH) : null
    case 'circuit.pressures.accessPressureMmHg':
      return finiteOrNull(state.circuit.pressures.accessPressureMmHg)
    case 'circuit.pressures.filterPressureMmHg':
      return finiteOrNull(state.circuit.pressures.filterPressureMmHg)
    case 'circuit.pressures.returnPressureMmHg':
      return finiteOrNull(state.circuit.pressures.returnPressureMmHg)
    case 'circuit.pressures.effluentPressureMmHg':
      return finiteOrNull(state.circuit.pressures.effluentPressureMmHg)
    case 'circuit.pressures.prismaxTransmembranePressureMmHg':
      return finiteOrNull(state.circuit.pressures.prismaxTransmembranePressureMmHg)
    case 'circuit.pressures.prismaxFilterPressureDropMmHg':
      return finiteOrNull(state.circuit.pressures.prismaxFilterPressureDropMmHg)
    case 'circuit.filter.foulingBurdenFraction':
      return finiteOrNull(state.circuit.filter.foulingBurdenFraction)
    case 'circuit.filter.clotBurdenFraction':
      return finiteOrNull(state.circuit.filter.clotBurdenFraction)
    case 'circuit.filter.lowEffectiveBloodFlowFraction':
      return finiteOrNull(state.circuit.filter.lowEffectiveBloodFlowFraction)
    case 'circuit.filter.procoagulantBurdenFraction':
      return finiteOrNull(state.circuit.filter.procoagulantBurdenFraction)
    case 'access.accessResistanceMmHgPerMlMin':
      return state.access.status === 'configured'
        ? finiteOrNull(state.access.accessResistanceMmHgPerMlMin)
        : null
    case 'access.returnResistanceMmHgPerMlMin':
      return state.access.status === 'configured'
        ? finiteOrNull(state.access.returnResistanceMmHgPerMlMin)
        : null
    default: {
      const externalPrefix = 'scenario.externalFluidRates.'
      if (metric.startsWith(externalPrefix)) {
        const key = metric.slice(externalPrefix.length)
        if (!externalFluidRateKeys.has(key as ExternalFluidRateKey)) return null
        return finiteOrNull(state.scenario.externalFluidRates[key as ExternalFluidRateKey])
      }

      const flowPrefix = 'prescription.flows.'
      if (metric.startsWith(flowPrefix)) {
        if (state.prescription.status !== 'configured') return null
        const key = metric.slice(flowPrefix.length)
        if (!prescriptionFlowKeys.has(key as keyof CrrtFlowRates)) return null
        return finiteOrNull(state.prescription.flows[key as keyof CrrtFlowRates])
      }

      const solutePrefix = 'patient.solutes.'
      const concentrationSuffix = '.concentrationPerLiter'
      if (
        metric.startsWith(solutePrefix) &&
        metric.endsWith(concentrationSuffix) &&
        state.patient.status === 'configured'
      ) {
        const id = metric.slice(solutePrefix.length, -concentrationSuffix.length)
        if (!soluteIds.has(id as CrrtSoluteId)) return null
        return finiteOrNull(state.patient.solutes[id as CrrtSoluteId]?.concentrationPerLiter)
      }

      return null
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

function hasCorrectPrediction(
  session: CrrtLearningSessionState,
  matchedRequiredPath: boolean,
  matchedAcceptedPathIds: readonly string[],
): boolean {
  const prediction = session.prediction
  if (!prediction) return false
  const hidden = session.caseDefinition.hiddenMechanism
  const selectedControls = new Set(prediction.controlOptionIds)
  if (
    prediction.mechanismOptionId !== hidden.correctMechanismOptionId ||
    prediction.responseOptionId !== hidden.correctResponseOptionId
  ) {
    return false
  }

  if (matchedRequiredPath && allIncluded(hidden.correctControlOptionIds, selectedControls)) {
    return true
  }

  const matchedPathIds = new Set(matchedAcceptedPathIds)
  if (matchedPathIds.size > 0) {
    return session.caseDefinition.acceptedAlternativePaths.some(
      (path) =>
        matchedPathIds.has(path.id) &&
        allIncluded(path.predictionControlOptionIds, selectedControls),
    )
  }

  return allIncluded(hidden.correctControlOptionIds, selectedControls)
}

function hasCompleteReassessment(session: CrrtLearningSessionState): boolean {
  if (!session.reassessment.committed) return false
  const selected = new Set(session.reassessment.optionIds)
  return allIncluded(session.caseDefinition.requiredReassessmentIds, selected)
}

export function selectCrrtLearningOutcome(session: CrrtLearningSessionState): CrrtLearningOutcome {
  const resultIdentity: CrrtOutcomeIdentity = {
    caseId: session.caseDefinition.id,
    attempt: session.attempt,
    seed: session.simulation.seed,
    engineVersion: session.simulation.engineVersion,
    engineSchemaVersion: session.simulation.schemaVersion,
    simulationContentVersion: session.simulation.contentVersion,
    caseContentVersion: session.caseDefinition.contentVersion,
    deviceProfileVersion: session.simulation.deviceProfileVersion,
    protocolProfileVersion: session.simulation.protocolProfileVersion,
  }
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

  const activatedMasteryCapstoneId = selectCrrtMasteryCapstoneId(session.caseDefinition)
  if (
    session.experience === 'mastery' &&
    (activatedMasteryCapstoneId === null ||
      activatedMasteryCapstoneId !== session.masteryCapstoneId)
  ) {
    return {
      resultIdentity,
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
    modalityAndPrescription: hasCorrectPrediction(
      session,
      matchedRequiredPath,
      matchedAcceptedPathIds,
    )
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
  const hintPenalty =
    session.experience === 'practice'
      ? Math.min(100, session.usedHintIds.length * CRRT_PRACTICE_HINT_PENALTY_POINTS)
      : 0
  const score = Math.max(0, rawScore - hintPenalty)

  return {
    resultIdentity,
    scored: true,
    score,
    mastery:
      session.experience === 'mastery' &&
      score >= CRRT_MASTERY_MINIMUM_SCORE &&
      criticalErrorIds.length === 0 &&
      session.usedHintIds.length === 0 &&
      reassessmentComplete,
    domains,
    hintPenalty,
    matchedRequiredPath,
    matchedAcceptedPathIds,
    satisfiedConditionIds,
    criticalErrorIds,
    reassessmentComplete,
  }
}

export function selectCrrtDebriefProjection(
  session: CrrtLearningSessionState,
): CrrtDebriefProjection {
  const debrief = session.caseDefinition.debrief
  return {
    summary: debrief.summary,
    causalChain: [...debrief.causalChain],
    transferQuestion: debrief.transferQuestion,
    statedGoalReview: debrief.statedGoalReview,
    predictionReview: debrief.predictionReview,
    actionTimelineReview: debrief.actionTimelineReview,
    trendReview: debrief.trendReview,
    requiredActionsReview: debrief.requiredActionsReview,
    criticalErrorsReview: debrief.criticalErrorsReview,
    acceptedAlternativesReview: debrief.acceptedAlternativesReview,
    machineNavigationPoint: debrief.machineNavigationPoint,
    prediction: session.prediction,
    timeline: session.timeline,
    outcome: selectCrrtLearningOutcome(session),
  }
}
