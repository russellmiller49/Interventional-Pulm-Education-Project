import { z } from 'zod'

import {
  icuAssessmentIds,
  icuCareInterventionIds,
  icuScenarioFamilies,
  icuScoreDomains,
  icuSimulationModes,
  type IcuScenarioDefinition,
} from '../engine/types'

const finite = z.number().finite()
const nonnegative = finite.nonnegative()
const fraction = finite.min(0).max(1)
const stableId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9._:-]*$/)
const evidenceId = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Z0-9][A-Z0-9._:-]*$/)

const driversSchema = z
  .object({
    vasoplegiaSeverity: fraction,
    leftVentricularFailureSeverity: fraction,
    rightVentricularFailureSeverity: fraction,
    pulmonaryVascularObstructionSeverity: fraction,
    tamponadePressureMmHg: finite.min(0).max(35),
    lungInjurySeverity: fraction,
    acuteKidneyInjurySeverity: fraction,
    bleedingRateMlHour: finite.min(0).max(5_000),
    infectionBurden: fraction,
  })
  .strict()

const hemodynamicsSchema = z
  .object({
    heartRateBpm: finite.min(20).max(240),
    mapMmHg: finite.min(10).max(250),
    systolicMmHg: finite.min(10).max(300),
    diastolicMmHg: finite.min(0).max(200),
    cardiacOutputLMin: finite.min(0).max(20),
    nativeCardiacOutputLMin: finite.min(0).max(20),
    effectiveSystemicFlowLMin: finite.min(0).max(20),
    rapMmHg: finite.min(-5).max(50),
    pawpMmHg: finite.min(0).max(60),
    meanPapMmHg: finite.min(0).max(120),
    systemicVascularResistanceDynSecCm5: finite.min(100).max(4_000),
    pulmonaryVascularResistanceWU: finite.min(0.1).max(20),
    circulatingVolumeMl: finite.min(1_500).max(8_000),
    leftVentricularContractility: finite.min(0.1).max(2),
    rightVentricularContractility: finite.min(0.1).max(2),
    pericardialPressureMmHg: finite.min(0).max(40),
  })
  .strict()

const respiratorySchema = z
  .object({
    intubated: z.boolean(),
    spontaneousRatePerMin: finite.min(0).max(80),
    complianceMlCmH2O: finite.min(5).max(200),
    resistanceCmH2OPerLps: finite.min(1).max(100),
    shuntFraction: fraction,
    deadSpaceFraction: fraction,
    oxygenConsumptionMlMin: finite.min(50).max(1_000),
    co2ProductionMlMin: finite.min(50).max(1_000),
    paO2MmHg: finite.min(15).max(700),
    paCO2MmHg: finite.min(10).max(200),
    bicarbonateMmolL: finite.min(2).max(60),
    pH: finite.min(6.5).max(8),
    spo2Percent: finite.min(30).max(100),
    meanAirwayPressureCmH2O: finite.min(0).max(60),
    plateauPressureCmH2O: finite.min(0).max(80),
    minuteVentilationLMin: finite.min(0).max(40),
    prone: z.boolean(),
  })
  .strict()

const renalSchema = z
  .object({
    creatinineMgDl: finite.min(0.1).max(30),
    bunMgDl: finite.min(1).max(300),
    sodiumMmolL: finite.min(90).max(190),
    potassiumMmolL: finite.min(1).max(10),
    bicarbonateMmolL: finite.min(2).max(60),
    urineOutputMlHour: nonnegative.max(1_500),
    cumulativeUrineMl: nonnegative,
    cumulativeCrrtRemovalMl: nonnegative,
  })
  .strict()

const hematologySchema = z
  .object({
    hemoglobinGdl: finite.min(2).max(25),
    hematocritPercent: finite.min(5).max(70),
    plateletCountK: finite.min(1).max(1_500),
    inr: finite.min(0.5).max(15),
    cumulativeBloodLossMl: nonnegative,
    cumulativeCrystalloidMl: nonnegative,
    cumulativeBloodProductMl: nonnegative,
  })
  .strict()

const perfusionSchema = z
  .object({
    lactateMmolL: finite.min(0).max(30),
    temperatureC: finite.min(25).max(44),
    oxygenDeliveryMlMin: nonnegative.max(5_000),
    oxygenExtractionRatio: fraction,
    capillaryRefillSeconds: finite.min(0).max(20),
    mottlingScore: finite.min(0).max(5),
  })
  .strict()

const medicationsSchema = z
  .object({
    vasopressorTier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    inotropeTier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    sedationTier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict()

export const icuPatientSchema = z
  .object({
    syntheticPatientId: stableId,
    adultAgeYears: finite.int().min(18).max(100),
    weightKg: finite.min(30).max(250),
    predictedBodyWeightKg: finite.min(30).max(150),
    bodySurfaceAreaM2: finite.min(1).max(3),
    drivers: driversSchema,
    hemodynamics: hemodynamicsSchema,
    respiratory: respiratorySchema,
    renal: renalSchema,
    hematology: hematologySchema,
    perfusion: perfusionSchema,
    medications: medicationsSchema,
    sourceControlCompleted: z.boolean(),
    reperfusionCompleted: z.boolean(),
    tamponadeDrained: z.boolean(),
    antimicrobialsAdministered: z.boolean(),
  })
  .strict()

const ventilatorSchema = z
  .object({
    status: z.enum(['off', 'ready', 'running']),
    mode: z.enum(['volume-control', 'pressure-control', 'pressure-support']),
    tidalVolumeMl: finite,
    ratePerMin: finite,
    peepCmH2O: finite,
    fio2: finite,
    inspiratoryPressureCmH2O: finite,
    pressureSupportCmH2O: finite,
    peakPressureCmH2O: finite,
    plateauPressureCmH2O: finite,
    minuteVentilationLMin: finite,
  })
  .strict()

const ecmoSchema = z
  .object({
    status: z.enum(['off', 'ready', 'running']),
    mode: z.enum(['vv', 'va']),
    rpm: finite,
    bloodFlowLMin: finite,
    sweepLMin: finite,
    gasFio2: finite,
    drainagePressureMmHg: finite,
    oxygenatorPressureDropMmHg: finite,
    recirculationFraction: fraction,
    gasConnected: z.boolean(),
    drainageLimited: z.boolean(),
  })
  .strict()

const mcsSchema = z
  .object({
    status: z.enum(['off', 'ready', 'running']),
    device: z.enum(['none', 'iabp', 'left-impella', 'rp-impella']),
    assistRatio: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    performanceLevel: finite,
    inflationOffsetMs: finite,
    deflationOffsetMs: finite,
    position: z.enum(['correct', 'too-deep', 'too-shallow']),
    purgeState: z.enum(['normal', 'high-pressure', 'low-pressure']),
    deviceFlowLMin: finite,
  })
  .strict()

const crrtSchema = z
  .object({
    status: z.enum(['off', 'ready', 'running']),
    modality: z.enum(['cvvhd', 'cvvh', 'cvvhdf']),
    bloodFlowMlMin: finite,
    dialysateMlHour: finite,
    replacementMlHour: finite,
    patientFluidRemovalMlHour: finite,
    deliveredDoseMlKgHour: finite,
    accessPressureMmHg: finite,
    filterPressureMmHg: finite,
    returnPressureMmHg: finite,
    filterLifeFraction: fraction,
  })
  .strict()

const initialDevicesSchema = z
  .object({
    ventilator: ventilatorSchema.optional(),
    ecmo: ecmoSchema.optional(),
    mcs: mcsSchema.optional(),
    crrt: crrtSchema.optional(),
  })
  .strict()

const scheduledEventSchema = z
  .object({
    id: stableId,
    atSeconds: nonnegative,
    jitterSeconds: z
      .object({ minimum: finite, maximum: finite })
      .strict()
      .refine((range) => range.minimum <= range.maximum, 'minimum must not exceed maximum')
      .nullable(),
    label: z.string().min(1).max(180),
    effect: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('driver-delta'),
          driver: z.enum([
            'vasoplegiaSeverity',
            'leftVentricularFailureSeverity',
            'rightVentricularFailureSeverity',
            'pulmonaryVascularObstructionSeverity',
            'tamponadePressureMmHg',
            'lungInjurySeverity',
            'acuteKidneyInjurySeverity',
            'bleedingRateMlHour',
            'infectionBurden',
          ]),
          delta: finite,
        })
        .strict(),
      z.object({ kind: z.literal('bleeding-rate'), rateMlHour: nonnegative }).strict(),
    ]),
    evidenceIds: z.array(evidenceId).min(1),
  })
  .strict()

const interventionSchema = z
  .object({
    actionId: stableId,
    label: z.string().min(1).max(180),
    kind: z.enum(['assessment', 'therapy', 'device', 'care', 'reassessment', 'safety']),
    scoringDomains: z.array(z.enum(icuScoreDomains)).min(1),
    criticalErrorId: stableId.nullable(),
    evidenceIds: z.array(evidenceId).min(1),
  })
  .strict()

const checkpointSchema = z
  .object({
    id: stableId,
    label: z.string().min(1).max(180),
    requiredActionIds: z.array(stableId),
    acceptedAlternativeActionIdGroups: z.array(z.array(stableId).min(1)),
  })
  .strict()

const criticalErrorSchema = z
  .object({
    id: stableId,
    actionId: stableId,
    message: z.string().min(1).max(240),
  })
  .strict()

export const icuScenarioDefinitionSchema = z
  .object({
    id: z.enum(icuScenarioFamilies),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    family: z.enum(icuScenarioFamilies),
    title: z.string().min(1).max(100),
    shortTitle: z.string().min(1).max(60),
    summary: z.string().min(1).max(400),
    openingNarrative: z.string().min(1).max(600),
    durationHours: finite.min(1).max(24),
    allowedModes: z.array(z.enum(icuSimulationModes)).min(1),
    initialPatient: icuPatientSchema,
    capabilities: z
      .object({
        assessments: z.array(z.enum(icuAssessmentIds)),
        therapies: z.array(z.enum(['ventilator', 'ecmo', 'mcs', 'crrt'])),
        interventions: z.array(z.enum(icuCareInterventionIds)),
        mcsDevices: z.array(z.enum(['iabp', 'left-impella', 'rp-impella'])),
        ecmoModes: z.array(z.enum(['vv', 'va'])),
      })
      .strict(),
    initialDevices: initialDevicesSchema.optional(),
    scheduledEvents: z.array(scheduledEventSchema),
    interventions: z.array(interventionSchema).min(1),
    checkpoints: z.array(checkpointSchema).min(1),
    scoring: z
      .object({
        assessment: z.array(stableId),
        prioritization: z.array(stableId),
        therapy: z.array(stableId),
        device: z.array(stableId),
        reassessment: z.array(stableId),
        safety: z.array(stableId),
      })
      .strict(),
    criticalErrors: z.array(criticalErrorSchema),
    learningObjectives: z.array(z.string().min(1).max(240)).min(1),
    debrief: z.array(z.string().min(1).max(400)).min(1),
    evidenceIds: z.array(evidenceId).min(1),
    reviewStatus: z.enum(['pending', 'reviewed', 'approved']),
    educationalUseOnly: z.literal(true),
  })
  .strict()
  .superRefine((scenario, context) => {
    if (scenario.id !== scenario.family) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Scenario id and family must match.',
      })
    }
    const interventionIds = new Set(scenario.interventions.map((item) => item.actionId))
    const criticalIds = new Set(scenario.criticalErrors.map((item) => item.id))
    const duplicate = (values: readonly string[]) => new Set(values).size !== values.length
    if (duplicate([...interventionIds])) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Intervention IDs must be unique.' })
    }
    if (duplicate(scenario.scheduledEvents.map((item) => item.id))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Scheduled event IDs must be unique.',
      })
    }
    for (const domain of icuScoreDomains) {
      if (scenario.scoring[domain].length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Scoring domain ${domain} must have at least one required action.`,
        })
      }
      for (const id of scenario.scoring[domain]) {
        if (!interventionIds.has(id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Scoring action ${id} has no intervention definition.`,
          })
        }
      }
    }
    for (const intervention of scenario.interventions) {
      if (intervention.criticalErrorId && !criticalIds.has(intervention.criticalErrorId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown critical error ${intervention.criticalErrorId}.`,
        })
      }
    }
  })

export function parseIcuScenarioDefinition(value: unknown): IcuScenarioDefinition {
  return icuScenarioDefinitionSchema.parse(value) as IcuScenarioDefinition
}

export function safeParseIcuScenarioDefinition(value: unknown) {
  return icuScenarioDefinitionSchema.safeParse(value)
}
