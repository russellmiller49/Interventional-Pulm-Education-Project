import { z } from 'zod'

import { CRRT_CASE_ARTIFACT_IDS } from './artifactRegistry'
import { engineFixtureNormalizationSchema } from './engineFixtureBoundary'

const finiteNumberSchema = z.number().finite()
const nonnegativeNumberSchema = finiteNumberSchema.nonnegative()
const positiveNumberSchema = finiteNumberSchema.positive()
const fractionSchema = finiteNumberSchema.min(0).max(1)
const identifierSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9]+(?:[-_.:][A-Za-z0-9]+)*$/)
const sourceIdSchema = z
  .string()
  .min(1)
  .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
const sourceIdListSchema = z.array(sourceIdSchema).min(1)

export const crrtCaseIdSchema = z.string().regex(/^CRRT-(0[1-9]|1[0-8])$/)
export const crrtReviewStatusSchema = z.enum(['pending', 'reviewed', 'approved'])
export const crrtDeviceIdSchema = z.enum(['prismax-aw8035-2xx', 'prismaflex-g5036003-6xx'])
export const crrtRoleLensSchema = z.enum(['prescriber', 'operator', 'integrated'])
export const crrtStationIdSchema = z.enum([
  'define-goal',
  'build-prescription',
  'setup-start',
  'monitor-dose-fluid',
  'pressures-troubleshooting',
  'anticoagulation-complications-liberation',
])

export const sourceReferenceSchema = z
  .object({
    id: sourceIdSchema,
    claim: z.string().min(1),
    value: z.union([finiteNumberSchema, z.string().min(1)]).optional(),
    unit: z.string().min(1).optional(),
    sourceTitle: z.string().min(1),
    sourceType: z.enum([
      'device-manual',
      'ifu',
      'guideline',
      'peer-reviewed',
      'textbook',
      'professional-standard',
      'local-protocol',
      'synthetic-calibration',
    ]),
    documentVersion: z.string().min(1).optional(),
    pageOrSection: z.string().min(1),
    market: z.string().min(1).optional(),
    implementationLocation: z.string().min(1),
    reviewer: z.string().min(1).nullable(),
    reviewStatus: crrtReviewStatusSchema,
  })
  .strict()
  .superRefine((source, context) => {
    if (typeof source.value === 'number' && source.unit === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unit'],
        message: 'A sourced value requires an explicit unit.',
      })
    }
  })

const configuredAdvancedSoluteSchema = z
  .object({
    id: identifierSchema,
    displayName: z.string().min(1),
    concentration: nonnegativeNumberSchema,
    unit: z.string().min(1),
    sourceId: sourceIdSchema,
    reviewStatus: crrtReviewStatusSchema,
  })
  .strict()

export const configuredPatientSchema = z
  .object({
    simulatedBodyWeightKg: positiveNumberSchema,
    hematocritFraction: fractionSchema,
    intravascularReserveMl: nonnegativeNumberSchema,
    totalFluidOverloadMl: nonnegativeNumberSchema,
    vascularRefillCapacityMlPerHour: nonnegativeNumberSchema,
    urineOutputMlPerHour: nonnegativeNumberSchema,
    residualRenalClearanceMlPerMin: nonnegativeNumberSchema,
    hemodynamics: z
      .object({
        heartRatePerMin: nonnegativeNumberSchema,
        systolicPressureMmHg: nonnegativeNumberSchema,
        diastolicPressureMmHg: nonnegativeNumberSchema,
        meanArterialPressureMmHg: nonnegativeNumberSchema,
        vasopressorState: z.enum(['off', 'stable', 'increasing', 'decreasing']),
      })
      .strict(),
    temperatureCelsius: finiteNumberSchema,
    solutes: z
      .object({
        sodiumMmolPerL: nonnegativeNumberSchema,
        potassiumMmolPerL: nonnegativeNumberSchema,
        bicarbonateMmolPerL: nonnegativeNumberSchema,
        pH: positiveNumberSchema,
        smallSoluteMarkerMmolPerL: nonnegativeNumberSchema,
        creatinineMgPerDl: nonnegativeNumberSchema,
        phosphateMgPerDl: nonnegativeNumberSchema,
        magnesiumMgPerDl: nonnegativeNumberSchema,
        systemicIonizedCalciumMmolPerL: nonnegativeNumberSchema,
        totalCalciumMgPerDl: nonnegativeNumberSchema.nullable(),
        glucoseMgPerDl: nonnegativeNumberSchema.nullable(),
        advanced: z.array(configuredAdvancedSoluteSchema),
      })
      .strict(),
    sourceIds: sourceIdListSchema,
  })
  .strict()

export const configuredAccessSchema = z
  .object({
    catheter: z
      .object({
        descriptor: z.string().min(1),
        site: z.string().min(1),
        type: z.string().min(1),
        nominalFlowCapacityMlPerMin: positiveNumberSchema,
      })
      .strict(),
    accessResistanceMmHgPerMlPerMin: nonnegativeNumberSchema,
    returnResistanceMmHgPerMlPerMin: nonnegativeNumberSchema,
    positionDependenceFraction: fractionSchema,
    recirculationFraction: fractionSchema,
    partialThrombusFraction: fractionSchema,
    accessLineState: z.enum(['open', 'kinked', 'clamped']),
    returnLineState: z.enum(['open', 'kinked', 'clamped']),
    connectionState: z.enum(['connected', 'disconnected']),
    sourceIds: sourceIdListSchema,
  })
  .strict()

export const prescriptionSchema = z
  .object({
    modality: z.enum(['SCUF', 'CVVH', 'CVVHD', 'CVVHDF']),
    bloodFlowMlPerMin: nonnegativeNumberSchema,
    preBloodPumpFlowMlPerHour: nonnegativeNumberSchema,
    dialysateFlowMlPerHour: nonnegativeNumberSchema,
    preReplacementFlowMlPerHour: nonnegativeNumberSchema,
    postReplacementFlowMlPerHour: nonnegativeNumberSchema,
    patientFluidRemovalMlPerHour: nonnegativeNumberSchema,
    syringeFlowMlPerHour: nonnegativeNumberSchema.default(0),
    makeupFlowMlPerHour: nonnegativeNumberSchema.default(0),
    anticoagulation: z
      .object({
        method: z.enum(['none', 'systemic', 'regional-citrate-calcium']),
        protocolProfileId: sourceIdSchema.nullable(),
      })
      .strict(),
    solutionProfileIds: z.array(identifierSchema),
    sourceIds: sourceIdListSchema,
  })
  .strict()
  .superRefine((prescription, context) => {
    if (
      prescription.anticoagulation.method === 'regional-citrate-calcium' &&
      prescription.anticoagulation.protocolProfileId === null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['anticoagulation', 'protocolProfileId'],
        message: 'Regional citrate-calcium requires an explicit reviewed protocol profile.',
      })
    }
    if (prescription.anticoagulation.method === 'regional-citrate-calcium') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['anticoagulation'],
        message:
          'Regional citrate-calcium is disabled until an approved local protocol registry is supplied.',
      })
    }
    if (
      prescription.anticoagulation.method === 'none' &&
      prescription.anticoagulation.protocolProfileId !== null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['anticoagulation', 'protocolProfileId'],
        message: 'A no-anticoagulation prescription cannot reference a protocol profile.',
      })
    }
    if (
      prescription.anticoagulation.method === 'systemic' &&
      prescription.anticoagulation.protocolProfileId === null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['anticoagulation', 'protocolProfileId'],
        message: 'Systemic anticoagulation requires an explicit reviewed protocol profile.',
      })
    }
  })

export const engineModelParameterSchema = z
  .object({
    id: identifierSchema,
    domain: z.enum(['patient', 'access', 'fluid', 'solute', 'pressure', 'filter', 'alarm']),
    value: finiteNumberSchema,
    unit: z.string().min(1),
    sourceId: sourceIdSchema,
    reviewStatus: crrtReviewStatusSchema,
  })
  .strict()

export const engineModelConfigurationSchema = z
  .object({
    id: identifierSchema,
    version: z.string().min(1),
    internalStepSeconds: z.literal(60),
    internalStepRationale: z.string().min(1),
    maximumTrendSamples: z.literal(288),
    enabledModelIds: z.array(identifierSchema),
    parameters: z.array(engineModelParameterSchema),
    sourceIds: sourceIdListSchema,
    reviewStatus: crrtReviewStatusSchema,
  })
  .strict()

export const statePathSchema = z
  .string()
  .min(1)
  .regex(/^(?:simulationTimeSeconds|[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9-]*)+)$/)

export const stateEffectSchema = z.discriminatedUnion('valueType', [
  z
    .object({
      target: statePathSchema,
      operation: z.enum(['set', 'add', 'multiply', 'move-toward']),
      valueType: z.literal('number'),
      value: finiteNumberSchema,
      unit: z.string().min(1),
      sourceId: sourceIdSchema,
    })
    .strict(),
  z
    .object({
      target: statePathSchema,
      operation: z.literal('set'),
      valueType: z.literal('boolean'),
      value: z.boolean(),
      sourceId: sourceIdSchema,
    })
    .strict(),
  z
    .object({
      target: statePathSchema,
      operation: z.literal('set'),
      valueType: z.literal('enum'),
      value: identifierSchema,
      sourceId: sourceIdSchema,
    })
    .strict(),
])

export const timedEventSchema = z
  .object({
    id: identifierSchema,
    atSimulationSeconds: nonnegativeNumberSchema,
    jitterSeconds: z
      .object({ minimum: finiteNumberSchema, maximum: finiteNumberSchema })
      .strict()
      .refine((range) => range.minimum <= range.maximum, {
        message: 'Event jitter must be ordered from minimum to maximum.',
      })
      .nullable()
      .default(null),
    eventType: z.enum([
      'state-change',
      'laboratory-result',
      'treatment-interruption',
      'treatment-resumption',
    ]),
    label: z.string().min(1),
    effects: z.array(stateEffectSchema).min(1),
    sourceIds: sourceIdListSchema,
    reviewStatus: crrtReviewStatusSchema,
  })
  .strict()

export const predictionOptionSchema = z
  .object({
    id: identifierSchema,
    label: z.string().min(1),
    description: z.string().min(1),
    sourceIds: sourceIdListSchema,
    reviewStatus: crrtReviewStatusSchema,
  })
  .strict()

export const hiddenMechanismSchema = z
  .object({
    id: identifierSchema,
    summary: z.string().min(1),
    causalChain: z.array(z.string().min(1)).min(1),
    correctGoalOptionId: identifierSchema,
    correctMechanismOptionId: identifierSchema,
    correctControlOptionIds: z.array(identifierSchema).min(1),
    correctResponseOptionId: identifierSchema,
    correctReassessmentOptionIds: z.array(identifierSchema).min(1),
    sourceIds: sourceIdListSchema,
    reviewStatus: crrtReviewStatusSchema,
  })
  .strict()

export const interventionDefinitionSchema = z
  .object({
    id: identifierSchema,
    label: z.string().min(1),
    category: z.enum([
      'assessment',
      'prescription',
      'device',
      'access-circuit',
      'fluid',
      'medication',
      'communication',
    ]),
    description: z.string().min(1),
    response: z.string().min(1),
    latencySeconds: nonnegativeNumberSchema,
    effects: z.array(stateEffectSchema),
    prerequisites: z.array(identifierSchema),
    repeatable: z.boolean(),
    sourceIds: sourceIdListSchema,
    reviewStatus: crrtReviewStatusSchema,
  })
  .strict()

export const metricConditionSchema = z
  .object({
    id: identifierSchema,
    metric: statePathSchema,
    comparator: z.enum(['lt', 'lte', 'eq', 'gte', 'gt', 'between']),
    value: z.union([finiteNumberSchema, z.tuple([finiteNumberSchema, finiteNumberSchema])]),
    unit: z.string().min(1),
    sourceId: sourceIdSchema,
    reviewStatus: crrtReviewStatusSchema,
  })
  .strict()
  .superRefine((condition, context) => {
    if (condition.comparator === 'between' && !Array.isArray(condition.value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'The between comparator requires a two-value interval.',
      })
    }
    if (Array.isArray(condition.value)) {
      if (condition.comparator !== 'between') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'Only the between comparator accepts a two-value interval.',
        })
      }
      if (condition.value[0] > condition.value[1]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'A metric interval must be ordered from lower to upper value.',
        })
      }
    }
  })

export const acceptedPathSchema = z
  .object({
    id: identifierSchema,
    label: z.string().min(1),
    predictionControlOptionIds: z.array(identifierSchema).min(1),
    actionIds: z.array(identifierSchema).min(1),
    reassessmentIds: z.array(identifierSchema).min(1),
    successConditionIds: z.array(identifierSchema).min(1),
    explanation: z.string().min(1),
    sourceIds: sourceIdListSchema,
    reviewStatus: crrtReviewStatusSchema,
  })
  .strict()

export const unsafeActionSchema = z
  .object({
    id: identifierSchema,
    actionId: identifierSchema,
    explanation: z.string().min(1),
    criticalErrorId: identifierSchema.nullable(),
    sourceIds: sourceIdListSchema,
    reviewStatus: crrtReviewStatusSchema,
  })
  .strict()

export const criticalErrorSchema = z
  .object({
    id: identifierSchema,
    label: z.string().min(1),
    explanation: z.string().min(1),
    actionIds: z.array(identifierSchema),
    conditionIds: z.array(identifierSchema),
    sourceIds: sourceIdListSchema,
    reviewStatus: crrtReviewStatusSchema,
  })
  .strict()

export const hintSchema = z
  .object({
    id: identifierSchema,
    sequence: z.number().int().positive(),
    text: z.string().min(1),
    sourceIds: sourceIdListSchema,
    reviewStatus: crrtReviewStatusSchema,
  })
  .strict()

export const causalDebriefSchema = z
  .object({
    summary: z.string().min(1),
    statedGoalReview: z.string().min(1),
    predictionReview: z.string().min(1),
    actionTimelineReview: z.string().min(1),
    causalChain: z.array(z.string().min(1)).min(1),
    trendReview: z.string().min(1),
    requiredActionsReview: z.string().min(1),
    criticalErrorsReview: z.string().min(1),
    acceptedAlternativesReview: z.string().min(1),
    machineNavigationPoint: z.string().min(1),
    transferQuestion: z.string().min(1),
    sourceIds: sourceIdListSchema,
    reviewStatus: crrtReviewStatusSchema,
  })
  .strict()

export const configuredDeviceOverridesSchema = z
  .object({
    workflowPhase: z
      .enum(['new-patient', 'setup', 'prime', 'review', 'connect', 'operations', 'stop'])
      .optional(),
    treatmentState: z.enum(['not-started', 'running', 'paused', 'stopped']).optional(),
    connectedToPatient: z.boolean().optional(),
    pumpsPaused: z.boolean().optional(),
    activeAlarmIds: z.array(identifierSchema).optional(),
  })
  .strict()

const authoredCrrtCaseBaseSchema = z
  .object({
    id: crrtCaseIdSchema,
    title: z.string().min(1),
    stationId: crrtStationIdSchema,
    difficulty: z.enum(['introductory', 'intermediate', 'advanced']),
    roleLenses: z.array(crrtRoleLensSchema).min(1),
    compatibleDevices: z.array(crrtDeviceIdSchema).min(1),
    patientDescription: z.string().min(1),
    learningObjectives: z.array(z.string().min(1)).min(1),
    initialPatient: configuredPatientSchema,
    initialAccess: configuredAccessSchema,
    initialPrescription: prescriptionSchema,
    initialDeviceOverrides: configuredDeviceOverridesSchema.optional(),
    hiddenMechanism: hiddenMechanismSchema,
    visibleFindings: z.array(z.string().min(1)).min(1),
    timedEvents: z.array(timedEventSchema),
    goalOptions: z.array(predictionOptionSchema).min(2),
    mechanismOptions: z.array(predictionOptionSchema).min(2),
    controlOptions: z.array(predictionOptionSchema).min(2),
    responseOptions: z.array(predictionOptionSchema).min(2),
    reassessmentOptions: z.array(predictionOptionSchema).min(2),
    interventions: z.array(interventionDefinitionSchema).min(1),
    requiredActionIds: z.array(identifierSchema).min(1),
    acceptedAlternativePaths: z.array(acceptedPathSchema),
    requiredReassessmentIds: z.array(identifierSchema).min(1),
    successConditions: z.array(metricConditionSchema).min(1),
    unsafeActions: z.array(unsafeActionSchema).min(1),
    criticalErrors: z.array(criticalErrorSchema).min(1),
    hintLadder: z.array(hintSchema).min(1),
    debrief: causalDebriefSchema,
    sourceBasis: z.array(sourceReferenceSchema).min(1),
    reviewStatus: crrtReviewStatusSchema,
  })
  .strict()

const runtimeCrrtCaseBaseSchema = authoredCrrtCaseBaseSchema
  .extend({
    sourceCaseId: crrtCaseIdSchema,
    contentVersion: z.string().min(1),
    engineModelConfiguration: engineModelConfigurationSchema,
    engineFixtureConfiguration: engineFixtureNormalizationSchema,
  })
  .strict()

type AuthoredCrrtCaseBase = z.infer<typeof authoredCrrtCaseBaseSchema>
type RuntimeCrrtCaseBase = z.infer<typeof runtimeCrrtCaseBaseSchema>
type SemanticCase = AuthoredCrrtCaseBase &
  Partial<
    Pick<
      RuntimeCrrtCaseBase,
      'sourceCaseId' | 'engineModelConfiguration' | 'engineFixtureConfiguration'
    >
  >

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

function unresolvedValues(references: readonly string[], available: ReadonlySet<string>): string[] {
  return [...new Set(references.filter((reference) => !available.has(reference)))]
}

export function collectCrrtCaseSemanticIssues(definition: SemanticCase): string[] {
  const issues: string[] = []
  if (definition.sourceCaseId !== undefined && definition.sourceCaseId !== definition.id) {
    issues.push(
      `Runtime sourceCaseId ${definition.sourceCaseId} does not match case ID ${definition.id}`,
    )
  }

  if (definition.engineFixtureConfiguration) {
    const fixtureConfiguration = definition.engineFixtureConfiguration
    const authoredEventIds = definition.timedEvents.map((event) => event.id)
    const mappedEventIds = fixtureConfiguration.timedEventMappings.map(
      (mapping) => mapping.timedEventId,
    )
    for (const eventId of unresolvedValues(authoredEventIds, new Set(mappedEventIds))) {
      issues.push(`Timed event ${eventId} is missing an engine mapping`)
    }
    for (const eventId of unresolvedValues(mappedEventIds, new Set(authoredEventIds))) {
      issues.push(`Engine mapping references unknown timed event ID: ${eventId}`)
    }
    if (definition.timedEvents.some((event) => event.effects.length !== 1)) {
      issues.push(
        'Every runtime timed event must contain exactly one effect for Phase 2 normalization',
      )
    }
    // Canonical patient, circuit, fluid, solute, filter, and outcome state is
    // device-neutral. Device compatibility is declared by the case and the
    // selected adapter owns navigation, vocabulary, displays, alarms, and
    // controls; review metadata never narrows runtime availability.
    const deviceOverrides = definition.initialDeviceOverrides
    if (deviceOverrides) {
      if (
        deviceOverrides.activeAlarmIds !== undefined &&
        deviceOverrides.activeAlarmIds.length > 0
      ) {
        issues.push(
          'Initial device alarm IDs remain disabled until device alarm mapping is reviewed',
        )
      }
      if (
        deviceOverrides.workflowPhase === 'operations' &&
        deviceOverrides.treatmentState !== 'running' &&
        deviceOverrides.treatmentState !== 'paused'
      ) {
        issues.push('An Operations start requires an explicit running or paused treatment state')
      }
      if (
        deviceOverrides.treatmentState === 'running' &&
        (deviceOverrides.connectedToPatient !== true || deviceOverrides.pumpsPaused !== false)
      ) {
        issues.push(
          'A running case start requires a simulated connection and explicitly unpaused pumps',
        )
      }
      if (
        (deviceOverrides.workflowPhase === 'new-patient' ||
          deviceOverrides.workflowPhase === 'setup') &&
        deviceOverrides.treatmentState !== undefined &&
        deviceOverrides.treatmentState !== 'not-started'
      ) {
        issues.push('A new-patient or setup start must use the not-started treatment state')
      }
    }
    if (definition.initialPatient.solutes.advanced.length > 0) {
      issues.push('Advanced solutes cannot be normalized by the Phase 2 engine')
    }
    if (
      definition.initialAccess.accessLineState === 'clamped' ||
      definition.initialAccess.returnLineState === 'clamped'
    ) {
      issues.push('Clamped line state cannot be normalized by the Phase 2 access model')
    }
    if (definition.initialPrescription.anticoagulation.method !== 'none') {
      issues.push(
        'Anticoagulation cannot be normalized without an approved protocol registry and version',
      )
    }
    if (definition.initialPrescription.solutionProfileIds.length > 0) {
      issues.push(
        'Solution profiles cannot be normalized before a reviewed solution registry exists',
      )
    }
    const authoredTotalCalcium = definition.initialPatient.solutes.totalCalciumMgPerDl
    const normalizedTotalCalcium = fixtureConfiguration.patient.totalCalciumMmolL
    if ((authoredTotalCalcium === null) !== (normalizedTotalCalcium === null)) {
      issues.push(
        'Authored and normalized total-calcium values must both be present or both be explicitly null',
      )
    }
  }

  const optionGroups = [
    definition.goalOptions,
    definition.mechanismOptions,
    definition.controlOptions,
    definition.responseOptions,
    definition.reassessmentOptions,
  ]
  const optionIds = optionGroups.flatMap((group) => group.map((option) => option.id))
  for (const id of duplicateValues(optionIds)) issues.push(`Duplicate option ID: ${id}`)

  const reassessmentIds = new Set(definition.reassessmentOptions.map((option) => option.id))
  for (const id of duplicateValues(definition.requiredReassessmentIds)) {
    issues.push(`Duplicate required reassessment ID: ${id}`)
  }

  const interventionIds = definition.interventions.map((intervention) => intervention.id)
  const interventionIdSet = new Set(interventionIds)
  for (const id of duplicateValues(interventionIds)) issues.push(`Duplicate intervention ID: ${id}`)

  const sourceIds = definition.sourceBasis.map((source) => source.id)
  const sourceIdSet = new Set(sourceIds)
  for (const id of duplicateValues(sourceIds)) issues.push(`Duplicate source ID: ${id}`)

  const goalIds = new Set(definition.goalOptions.map((option) => option.id))
  const mechanismIds = new Set(definition.mechanismOptions.map((option) => option.id))
  const controlIds = new Set(definition.controlOptions.map((option) => option.id))
  const responseIds = new Set(definition.responseOptions.map((option) => option.id))
  const hiddenReferences = [
    [definition.hiddenMechanism.correctGoalOptionId, goalIds, 'goal option'],
    [definition.hiddenMechanism.correctMechanismOptionId, mechanismIds, 'mechanism option'],
    [definition.hiddenMechanism.correctResponseOptionId, responseIds, 'response option'],
  ] as const
  for (const [id, available, label] of hiddenReferences) {
    if (!available.has(id)) issues.push(`Unresolved ${label} ID: ${id}`)
  }
  for (const id of unresolvedValues(
    definition.hiddenMechanism.correctControlOptionIds,
    controlIds,
  )) {
    issues.push(`Unresolved control option ID: ${id}`)
  }
  for (const id of unresolvedValues(
    definition.hiddenMechanism.correctReassessmentOptionIds,
    reassessmentIds,
  )) {
    issues.push(`Unresolved reassessment option ID: ${id}`)
  }
  for (const id of unresolvedValues(definition.requiredReassessmentIds, reassessmentIds)) {
    issues.push(`Unresolved required reassessment ID: ${id}`)
  }
  for (const id of unresolvedValues(definition.requiredActionIds, interventionIdSet)) {
    issues.push(`Unresolved required intervention ID: ${id}`)
  }
  for (const intervention of definition.interventions) {
    for (const id of unresolvedValues(intervention.prerequisites, interventionIdSet)) {
      issues.push(`Intervention ${intervention.id} has unresolved prerequisite ID: ${id}`)
    }
  }

  const successConditionIds = definition.successConditions.map((condition) => condition.id)
  const successConditionIdSet = new Set(successConditionIds)
  for (const id of duplicateValues(successConditionIds)) {
    issues.push(`Duplicate success-condition ID: ${id}`)
  }
  for (const path of definition.acceptedAlternativePaths) {
    for (const id of duplicateValues(path.predictionControlOptionIds)) {
      issues.push(`Accepted path ${path.id} has duplicate prediction control option ID: ${id}`)
    }
    for (const id of unresolvedValues(path.predictionControlOptionIds, controlIds)) {
      issues.push(`Accepted path ${path.id} has unresolved prediction control option ID: ${id}`)
    }
    for (const id of unresolvedValues(path.actionIds, interventionIdSet)) {
      issues.push(`Accepted path ${path.id} has unresolved intervention ID: ${id}`)
    }
    for (const id of unresolvedValues(path.reassessmentIds, reassessmentIds)) {
      issues.push(`Accepted path ${path.id} has unresolved reassessment ID: ${id}`)
    }
    for (const id of unresolvedValues(path.successConditionIds, successConditionIdSet)) {
      issues.push(`Accepted path ${path.id} has unresolved success-condition ID: ${id}`)
    }
  }

  const criticalErrorIds = definition.criticalErrors.map((error) => error.id)
  const criticalErrorIdSet = new Set(criticalErrorIds)
  for (const id of duplicateValues(criticalErrorIds))
    issues.push(`Duplicate critical-error ID: ${id}`)
  for (const unsafeAction of definition.unsafeActions) {
    if (!interventionIdSet.has(unsafeAction.actionId)) {
      issues.push(
        `Unsafe action ${unsafeAction.id} has unresolved intervention ID: ${unsafeAction.actionId}`,
      )
    }
    if (
      unsafeAction.criticalErrorId !== null &&
      !criticalErrorIdSet.has(unsafeAction.criticalErrorId)
    ) {
      issues.push(
        `Unsafe action ${unsafeAction.id} has unresolved critical-error ID: ${unsafeAction.criticalErrorId}`,
      )
    }
  }
  for (const criticalError of definition.criticalErrors) {
    for (const id of unresolvedValues(criticalError.actionIds, interventionIdSet)) {
      issues.push(`Critical error ${criticalError.id} has unresolved intervention ID: ${id}`)
    }
    for (const id of unresolvedValues(criticalError.conditionIds, successConditionIdSet)) {
      issues.push(`Critical error ${criticalError.id} has unresolved condition ID: ${id}`)
    }
  }

  const referencedSources: { id: string; location: string }[] = []
  const addSources = (ids: readonly string[], location: string) => {
    for (const id of duplicateValues(ids)) {
      issues.push(`Duplicate source ID ${id} at ${location}`)
    }
    for (const id of ids) referencedSources.push({ id, location })
  }
  addSources(definition.initialPatient.sourceIds, 'initialPatient')
  for (const solute of definition.initialPatient.solutes.advanced) {
    addSources([solute.sourceId], `advanced solute ${solute.id}`)
  }
  addSources(definition.initialAccess.sourceIds, 'initialAccess')
  addSources(definition.initialPrescription.sourceIds, 'initialPrescription')
  addSources(definition.hiddenMechanism.sourceIds, 'hiddenMechanism')
  for (const option of optionGroups.flat()) addSources(option.sourceIds, `option ${option.id}`)
  for (const event of definition.timedEvents) {
    addSources(event.sourceIds, `timed event ${event.id}`)
    for (const effect of event.effects) addSources([effect.sourceId], `timed event ${event.id}`)
  }
  for (const intervention of definition.interventions) {
    addSources(intervention.sourceIds, `intervention ${intervention.id}`)
    for (const effect of intervention.effects) {
      addSources([effect.sourceId], `intervention ${intervention.id}`)
    }
  }
  for (const condition of definition.successConditions) {
    addSources([condition.sourceId], `success condition ${condition.id}`)
  }
  for (const path of definition.acceptedAlternativePaths) {
    addSources(path.sourceIds, `accepted path ${path.id}`)
  }
  for (const unsafeAction of definition.unsafeActions) {
    addSources(unsafeAction.sourceIds, `unsafe action ${unsafeAction.id}`)
  }
  for (const criticalError of definition.criticalErrors) {
    addSources(criticalError.sourceIds, `critical error ${criticalError.id}`)
  }
  for (const hint of definition.hintLadder) addSources(hint.sourceIds, `hint ${hint.id}`)
  addSources(definition.debrief.sourceIds, 'debrief')
  if (definition.engineModelConfiguration) {
    addSources(definition.engineModelConfiguration.sourceIds, 'engineModelConfiguration')
    for (const parameter of definition.engineModelConfiguration.parameters) {
      addSources([parameter.sourceId], `engine parameter ${parameter.id}`)
    }
  }
  if (definition.engineFixtureConfiguration) {
    const fixtureConfiguration = definition.engineFixtureConfiguration
    addSources(fixtureConfiguration.sourceIds, 'engineFixtureConfiguration')
    for (const [soluteId, solute] of Object.entries(fixtureConfiguration.patient.solutes)) {
      addSources(solute.sourceIds, `engine solute ${soluteId}`)
    }
    for (const bag of fixtureConfiguration.bags) {
      addSources(bag.sourceIds, `engine bag ${bag.id}`)
    }
    addSources(
      fixtureConfiguration.modelConfiguration.sourceIds,
      'engineFixtureConfiguration.modelConfiguration',
    )
    addSources(
      fixtureConfiguration.modelConfiguration.pressure.sourceIds,
      'engineFixtureConfiguration.modelConfiguration.pressure',
    )
    addSources(
      fixtureConfiguration.modelConfiguration.filter.sourceIds,
      'engineFixtureConfiguration.modelConfiguration.filter',
    )
    addSources(
      fixtureConfiguration.modelConfiguration.hemodynamic.sourceIds,
      'engineFixtureConfiguration.modelConfiguration.hemodynamic',
    )
  }
  for (const reference of referencedSources) {
    if (!sourceIdSet.has(reference.id)) {
      issues.push(`Unresolved source ID ${reference.id} at ${reference.location}`)
    }
  }
  const referencedSourceIdSet = new Set(referencedSources.map((reference) => reference.id))
  for (const id of sourceIds) {
    if (!referencedSourceIdSet.has(id)) {
      issues.push(`Unreferenced source basis ID: ${id}`)
    }
  }

  return [...new Set(issues)]
}

function addSemanticIssues(definition: SemanticCase, context: z.RefinementCtx): void {
  for (const message of collectCrrtCaseSemanticIssues(definition)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message })
  }
}

export const authoredCrrtCaseSchema = authoredCrrtCaseBaseSchema.superRefine(addSemanticIssues)
export const runtimeCrrtCaseSchema = runtimeCrrtCaseBaseSchema.superRefine(addSemanticIssues)
export const runtimeCrrtCaseRegistrySchema = z.array(runtimeCrrtCaseSchema)

export const CRRT_PILOT_CASE_IDS = ['CRRT-04', 'CRRT-10', 'CRRT-13'] as const
export const CRRT_PROTOCOL_GATED_CASE_IDS = ['CRRT-09', 'CRRT-17'] as const
export const CRRT_PHASE_7_DRAFT_CASE_IDS = [
  'CRRT-01',
  'CRRT-02',
  'CRRT-03',
  'CRRT-05',
  'CRRT-06',
  'CRRT-07',
  'CRRT-08',
  'CRRT-11',
  'CRRT-12',
  'CRRT-14',
  'CRRT-15',
  'CRRT-16',
  'CRRT-18',
] as const
export const CRRT_ALL_CASE_IDS = CRRT_CASE_ARTIFACT_IDS

export type CrrtCaseId = (typeof CRRT_ALL_CASE_IDS)[number]

export interface PilotRegistryValidationOptions {
  readonly requireExactPilotCases?: boolean
}

export interface CrrtRegistryValidationOptions {
  readonly expectedCaseIds?: readonly CrrtCaseId[]
  readonly registryLabel?: string
}

/**
 * Validates a runtime registry without silently treating protocol-gated case
 * plans as executable content. Callers choose the exact expected IDs for the
 * registry they are assembling.
 */
export function validateCrrtCaseRegistry(
  input: unknown,
  options: CrrtRegistryValidationOptions = {},
): string[] {
  const parsed = runtimeCrrtCaseRegistrySchema.safeParse(input)
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => {
      const location = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
      return `${location}${issue.message}`
    })
  }

  const issues: string[] = []
  const caseIds = parsed.data.map((definition) => definition.id)
  for (const id of duplicateValues(caseIds)) issues.push(`Duplicate case ID: ${id}`)

  const expectedIds = options.expectedCaseIds
  if (!expectedIds) return issues

  const label = options.registryLabel ?? 'CRRT runtime'
  const expected = new Set<string>(expectedIds)
  const actual = new Set(caseIds)
  const missing = expectedIds.filter((id) => !actual.has(id))
  const unexpected = [...actual].filter((id) => !expected.has(id))
  if (missing.length > 0) issues.push(`Missing ${label} case IDs: ${missing.join(', ')}`)
  if (unexpected.length > 0) issues.push(`Unexpected ${label} case IDs: ${unexpected.join(', ')}`)
  if (caseIds.length !== expectedIds.length && missing.length === 0 && unexpected.length === 0) {
    issues.push(`${label} registry must contain each required case exactly once.`)
  }

  return issues
}

export function validatePilotCrrtCaseRegistry(
  input: unknown,
  options: PilotRegistryValidationOptions = {},
): string[] {
  return validateCrrtCaseRegistry(input, {
    ...(options.requireExactPilotCases ? { expectedCaseIds: CRRT_PILOT_CASE_IDS } : {}),
    registryLabel: 'pilot',
  })
}

export type SourceReference = Readonly<z.infer<typeof sourceReferenceSchema>>
export type ConfiguredPatient = Readonly<z.infer<typeof configuredPatientSchema>>
export type ConfiguredAccess = Readonly<z.infer<typeof configuredAccessSchema>>
export type CrrtPrescription = Readonly<z.infer<typeof prescriptionSchema>>
export type EngineModelConfiguration = Readonly<z.infer<typeof engineModelConfigurationSchema>>
export type TimedEventDefinition = Readonly<z.infer<typeof timedEventSchema>>
export type AuthoredCrrtCase = Readonly<z.infer<typeof authoredCrrtCaseSchema>>
export type RuntimeCrrtCase = Readonly<z.infer<typeof runtimeCrrtCaseSchema>>
