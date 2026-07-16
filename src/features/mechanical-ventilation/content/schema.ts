import { z } from 'zod'

import sourceData from './source-cases.v1.json'

const sourcePatientSchema = z.object({
  description: z.string(),
  vitals: z.record(z.string(), z.unknown()),
  abg: z.record(z.string(), z.unknown()).optional(),
})

const sourceCaseSchema = z.object({
  id: z.string().regex(/^MV-\d{2}$/),
  title: z.string(),
  category: z.string(),
  difficulty: z.string(),
  run_time_min: z.number().positive(),
  learning_objectives: z.array(z.string()).min(1),
  patient: sourcePatientSchema,
  initial_ventilator: z.record(z.string(), z.unknown()),
  hidden_model: z.record(z.string(), z.unknown()),
  visible_findings: z.array(z.string()).min(1),
  expected_actions: z.array(z.string()).min(1),
  accepted_alternatives: z.array(z.string()),
  unsafe_actions: z.array(z.string()).min(1),
  success_criteria: z.array(z.string()).min(1),
  simulation_logic: z.array(z.string()).min(1),
  hint_ladder: z.array(z.string()).min(1),
  debrief: z.string(),
  run_tips: z.string(),
  source_basis: z.array(z.number().int().positive()).min(1),
})

const sourceRootSchema = z.object({
  schema_version: z.literal('1.0'),
  title: z.string(),
  disclaimer: z.string(),
  cases: z.array(sourceCaseSchema).length(15),
  engine_recommendations: z.record(z.string(), z.unknown()),
  optional_extensions: z.array(z.string()),
  sources: z.array(
    z.object({
      id: z.number().int().positive(),
      citation: z.string(),
      use: z.string(),
    }),
  ),
})

const triggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('flow'), thresholdLMin: z.number().min(0.5).max(20) }),
  z.object({
    type: z.literal('pressure'),
    thresholdCmH2O: z.number().min(-15).max(-0.1),
  }),
])

const commonSettingsSchema = {
  oxygenPercent: z.number().min(21).max(100),
  peepCmH2O: z.number().min(0).max(50),
  trigger: triggerSchema,
  highPressureLimitCmH2O: z.number().min(15).max(120),
  trcEnabled: z.boolean(),
  trcPercent: z.number().min(0).max(100),
  tubeInnerDiameterMm: z.number().min(3).max(10),
}

export const mechanicalVentilationSettingsSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('volume-ac'),
    ...commonSettingsSchema,
    vtMl: z.number().min(20).max(2000),
    ratePerMin: z.number().min(4).max(80),
    peakFlowLMin: z.number().min(1).max(195),
    flowPattern: z.enum(['square', 'decelerating-50', 'sine', 'decelerating-100']),
    pausePercent: z.number().min(0).max(70),
  }),
  z.object({
    mode: z.literal('pressure-ac'),
    ...commonSettingsSchema,
    deltaPControlCmH2O: z.number().min(1).max(100),
    ratePerMin: z.number().min(4).max(80),
    inspiratoryTimeSeconds: z.number().min(0.1).max(12),
    pRampMs: z.number().min(0).max(2000),
  }),
  z.object({
    mode: z.literal('pressure-support'),
    ...commonSettingsSchema,
    pressureSupportCmH2O: z.number().min(0).max(100),
    pRampMs: z.number().min(0).max(2000),
    etsPercent: z.number().min(5).max(80),
    tiMaxSeconds: z.number().min(0.5).max(5),
    apneaBackupEnabled: z.boolean(),
    apneaRatePerMin: z.number().min(5).max(80),
  }),
])

const patientModelSchema = z.object({
  mechanics: z.object({
    complianceLPerCmH2O: z.number().positive(),
    resistanceCmH2OPerLps: z.number().positive(),
    intrinsicPeepCmH2O: z.number().min(0),
    endExpiratoryVolumeL: z.number().min(0),
    airwayLeakFraction: z.number().min(0).max(1),
    tubeResistanceCmH2OPerLps: z.number().min(0),
  }),
  drive: z.object({
    neuralRatePerMin: z.number().min(0).max(80),
    neuralInspiratoryTimeSeconds: z.number().min(0.1).max(5),
    effortAmplitudeCmH2O: z.number().min(0).max(50),
    variability: z.number().min(0).max(1),
    reverseTriggerDelaySeconds: z.number().min(0).max(3).nullable(),
  }),
  gasExchange: z.object({
    shuntFraction: z.number().min(0).max(1),
    deadSpaceFraction: z.number().min(0).max(0.9),
    co2ProductionMlMin: z.number().positive(),
    oxygenConsumptionMlMin: z.number().positive(),
    paO2MmHg: z.number().positive(),
    paCO2MmHg: z.number().positive(),
    bicarbonateMmolL: z.number().positive(),
    pH: z.number().min(6.5).max(8),
    spo2Percent: z.number().min(0).max(100),
  }),
  hemodynamics: z.object({
    heartRatePerMin: z.number().min(0).max(250),
    systolicMmHg: z.number().min(0).max(300),
    diastolicMmHg: z.number().min(0).max(200),
    mapMmHg: z.number().min(0).max(250),
    obstructiveShock: z.boolean(),
  }),
  human: z.object({
    painScore: z.number().min(0).max(10),
    anxietyScore: z.number().min(0).max(10),
    deliriumScore: z.number().min(0).max(10),
    sedationScore: z.number().min(-5).max(5),
    dyspneaScore: z.number().min(0).max(10),
    canCommunicate: z.boolean(),
  }),
  airway: z.object({
    secretions: z.boolean(),
    hmeObstructed: z.boolean(),
    ettObstructed: z.boolean(),
    bronchospasm: z.boolean(),
    condensate: z.boolean(),
    circuitLeak: z.boolean(),
    pneumothorax: z.boolean(),
  }),
})

const optionSchema = z.object({ id: z.string(), label: z.string() })
const interventionSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.enum([
    'assessment',
    'ventilator',
    'airway-circuit',
    'medication',
    'procedure',
    'comfort-communication',
  ]),
  description: z.string(),
  response: z.string(),
  effectId: z.string(),
  latencySeconds: z.number().min(0),
  repeatable: z.boolean().optional(),
  prerequisites: z.array(z.string()).optional(),
  unsafe: z.boolean().optional(),
  critical: z.boolean().optional(),
})

const metricConditionSchema = z.object({
  metric: z.string(),
  comparator: z.enum(['lt', 'lte', 'gt', 'gte', 'between']),
  value: z.union([z.number(), z.tuple([z.number(), z.number()])]),
})

export const runtimeCaseSchema = z.object({
  id: z.string().regex(/^MV-\d{2}$/),
  sourceCaseId: z.string().regex(/^MV-\d{2}$/),
  title: z.string(),
  stationId: z.enum([
    'lung-protection-demand',
    'effort-triggering',
    'obstructive-mechanics',
    'pressure-support-timing',
    'deterioration-whole-patient',
  ]),
  category: z.string(),
  difficulty: z.string(),
  runTimeMin: z.number().positive(),
  phenotype: z.string(),
  patientSex: z.enum(['male', 'female', 'unspecified']),
  predictedBodyWeightKg: z.number().min(30).max(140),
  patientDescription: z.string(),
  learningObjectives: z.array(z.string()).min(1),
  initialSettings: mechanicalVentilationSettingsSchema,
  initialPatient: patientModelSchema,
  visibleFindings: z.array(z.string()).min(1),
  mechanismOptions: z.array(optionSchema).min(2),
  correctMechanismId: z.string(),
  priorityOptions: z.array(optionSchema).min(2),
  correctPriorityId: z.string(),
  responseOptions: z.array(optionSchema).min(2),
  correctResponseId: z.string(),
  interventions: z.array(interventionSchema).min(1),
  requiredInterventionIds: z.array(z.string()),
  requiredReassessmentIds: z.array(z.string()).min(1),
  successConditions: z.array(metricConditionSchema).min(1),
  hintLadder: z.array(z.string()).min(1),
  debrief: z.string(),
  expectedActions: z.array(z.string()).min(1),
  acceptedAlternatives: z.array(z.string()),
  unsafeActions: z.array(z.string()).min(1),
  successCriteria: z.array(z.string()).min(1),
  simulationLogic: z.array(z.string()).min(1),
  runTips: z.string(),
  sourceBasis: z.array(z.number().int().positive()),
  branchOptions: z.array(z.string()).min(1),
  baselineSeconds: z.number().min(5).max(120),
  deviceAdaptationNotes: z.array(z.string()),
})

export const mechanicalVentilationSource = sourceRootSchema.parse(sourceData)

export type SourceVentilationCase = z.infer<typeof sourceCaseSchema>

export function validateRuntimeCaseRegistry(input: unknown) {
  return z.array(runtimeCaseSchema).length(15).parse(input)
}
