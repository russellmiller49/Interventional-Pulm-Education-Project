import type {
  CirculationCompartmentState,
  CirculationParameters,
  MechanicalSupportEffect,
} from '@/features/hemodynamics-core'

export const ICU_ENGINE_VERSION = '1.0.0' as const
export const ICU_CONTENT_VERSION = '1.0.0' as const
export const ICU_FIXED_STEP_SECONDS = 0.02 as const
export const ICU_MAX_TREND_SAMPLES = 1_440 as const
export const ICU_MAX_EVENT_HISTORY = 512 as const
export const ICU_MAX_REPLAY_COMMANDS = 2_048 as const
export const ICU_MAX_DIAGNOSIS_COMMITMENTS = 24 as const

export const icuSimulationModes = ['learn', 'practice', 'assess', 'sandbox'] as const
export type IcuSimulationMode = (typeof icuSimulationModes)[number]

export const icuScenarioFamilies = [
  'septic-ards-aki',
  'lv-cardiogenic',
  'massive-pe-rv',
  'hemorrhagic',
  'tamponade',
  'mixed-cardiogenic-vasodilatory',
] as const
export type IcuScenarioFamily = (typeof icuScenarioFamilies)[number]

export type IcuSimulationPhase = 'orientation' | 'active' | 'debrief'
export type IcuTherapyId = 'ventilator' | 'ecmo' | 'mcs' | 'crrt'
export type IcuAlarmPriority = 'advisory' | 'warning' | 'critical'
export type IcuReviewStatus = 'pending' | 'reviewed' | 'approved'
export const icuShockClassifications = [
  'distributive',
  'lv-cardiogenic',
  'rv-obstructive',
  'hypovolemic-hemorrhagic',
  'tamponade-obstructive',
  'mixed-cardiogenic-vasodilatory',
] as const
export type IcuShockClassification = (typeof icuShockClassifications)[number]

export interface IcuDiseaseDrivers {
  vasoplegiaSeverity: number
  leftVentricularFailureSeverity: number
  rightVentricularFailureSeverity: number
  pulmonaryVascularObstructionSeverity: number
  tamponadePressureMmHg: number
  lungInjurySeverity: number
  acuteKidneyInjurySeverity: number
  bleedingRateMlHour: number
  infectionBurden: number
}

export interface IcuRespiratoryState {
  intubated: boolean
  spontaneousRatePerMin: number
  complianceMlCmH2O: number
  resistanceCmH2OPerLps: number
  shuntFraction: number
  deadSpaceFraction: number
  oxygenConsumptionMlMin: number
  co2ProductionMlMin: number
  paO2MmHg: number
  paCO2MmHg: number
  bicarbonateMmolL: number
  pH: number
  spo2Percent: number
  meanAirwayPressureCmH2O: number
  plateauPressureCmH2O: number
  minuteVentilationLMin: number
  prone: boolean
}

export interface IcuRenalState {
  creatinineMgDl: number
  bunMgDl: number
  sodiumMmolL: number
  potassiumMmolL: number
  bicarbonateMmolL: number
  urineOutputMlHour: number
  cumulativeUrineMl: number
  cumulativeCrrtRemovalMl: number
}

export interface IcuHematologyState {
  hemoglobinGdl: number
  hematocritPercent: number
  plateletCountK: number
  inr: number
  cumulativeBloodLossMl: number
  cumulativeCrystalloidMl: number
  cumulativeBloodProductMl: number
}

export interface IcuPerfusionState {
  lactateMmolL: number
  temperatureC: number
  oxygenDeliveryMlMin: number
  oxygenExtractionRatio: number
  capillaryRefillSeconds: number
  mottlingScore: number
}

export interface IcuHemodynamicState {
  heartRateBpm: number
  mapMmHg: number
  systolicMmHg: number
  diastolicMmHg: number
  cardiacOutputLMin: number
  nativeCardiacOutputLMin: number
  effectiveSystemicFlowLMin: number
  rapMmHg: number
  pawpMmHg: number
  meanPapMmHg: number
  systemicVascularResistanceDynSecCm5: number
  pulmonaryVascularResistanceWU: number
  circulatingVolumeMl: number
  leftVentricularContractility: number
  rightVentricularContractility: number
  pericardialPressureMmHg: number
}

export interface IcuMedicationState {
  vasopressorTier: 0 | 1 | 2 | 3
  inotropeTier: 0 | 1 | 2 | 3
  sedationTier: 0 | 1 | 2 | 3
}

export interface IcuPatientState {
  syntheticPatientId: string
  adultAgeYears: number
  weightKg: number
  predictedBodyWeightKg: number
  bodySurfaceAreaM2: number
  drivers: IcuDiseaseDrivers
  hemodynamics: IcuHemodynamicState
  respiratory: IcuRespiratoryState
  renal: IcuRenalState
  hematology: IcuHematologyState
  perfusion: IcuPerfusionState
  medications: IcuMedicationState
  sourceControlCompleted: boolean
  reperfusionCompleted: boolean
  tamponadeDrained: boolean
  antimicrobialsAdministered: boolean
}

export interface IcuPhysiologyCalibration {
  initialDrivers: IcuDiseaseDrivers
  initialHemodynamics: IcuHemodynamicState
  initialPeepCmH2O: number
}

export type IcuVentilatorMode = 'volume-control' | 'pressure-control' | 'pressure-support'

export interface IcuVentilatorState {
  status: 'off' | 'ready' | 'running'
  mode: IcuVentilatorMode
  tidalVolumeMl: number
  ratePerMin: number
  peepCmH2O: number
  fio2: number
  inspiratoryPressureCmH2O: number
  pressureSupportCmH2O: number
  peakPressureCmH2O: number
  plateauPressureCmH2O: number
  minuteVentilationLMin: number
}

export type IcuEcmoMode = 'vv' | 'va'

export interface IcuEcmoState {
  status: 'off' | 'ready' | 'running'
  mode: IcuEcmoMode
  rpm: number
  targetBloodFlowLMin: number
  bloodFlowLMin: number
  sweepLMin: number
  gasFio2: number
  drainagePressureMmHg: number
  oxygenatorPressureDropMmHg: number
  recirculationFraction: number
  gasConnected: boolean
  drainageLimited: boolean
}

export type IcuMcsDevice = 'none' | 'iabp' | 'left-impella' | 'rp-impella'

export interface IcuMcsState {
  status: 'off' | 'ready' | 'running'
  device: IcuMcsDevice
  assistRatio: 1 | 2 | 3
  performanceLevel: number
  inflationOffsetMs: number
  deflationOffsetMs: number
  position: 'correct' | 'too-deep' | 'too-shallow'
  purgeState: 'normal' | 'high-pressure' | 'low-pressure'
  deviceFlowLMin: number
}

export interface IcuCrrtState {
  status: 'off' | 'ready' | 'running'
  modality: 'cvvhd' | 'cvvh' | 'cvvhdf'
  bloodFlowMlMin: number
  dialysateMlHour: number
  replacementMlHour: number
  patientFluidRemovalMlHour: number
  deliveredDoseMlKgHour: number
  accessPressureMmHg: number
  filterPressureMmHg: number
  returnPressureMmHg: number
  filterLifeFraction: number
}

export interface IcuDeviceStates {
  ventilator: IcuVentilatorState
  ecmo: IcuEcmoState
  mcs: IcuMcsState
  crrt: IcuCrrtState
}

export interface IcuPatientSnapshot {
  elapsedSeconds: number
  patient: Readonly<IcuPatientState>
  circulationParameters: Readonly<CirculationParameters>
  compartments: Readonly<CirculationCompartmentState>
  devices: Readonly<IcuDeviceStates>
}

export type IcuTherapyEffect =
  | {
      kind: 'mechanical-support'
      source: 'ecmo' | 'mcs'
      effect: MechanicalSupportEffect
    }
  | {
      kind: 'airway-pressure'
      source: 'ventilator'
      peepCmH2O: number
      meanAirwayPressureCmH2O: number
      plateauPressureCmH2O: number
      minuteVentilationLMin: number
      fio2: number
    }
  | {
      kind: 'gas-exchange'
      source: 'ventilator' | 'ecmo'
      oxygenationCapacity: number
      co2RemovalMlMin: number
    }
  | {
      kind: 'volume-removal'
      source: 'crrt'
      rateMlHour: number
    }
  | {
      kind: 'solute-clearance'
      source: 'crrt'
      clearanceMlMin: number
    }
  | {
      kind: 'temperature'
      source: 'ecmo' | 'crrt'
      targetTemperatureC: number
      strength: number
    }

export interface IcuDeviceAlarm {
  id: string
  subsystem: IcuTherapyId | 'patient'
  code: string
  message: string
  priority: IcuAlarmPriority | null
  mappingReviewStatus: IcuReviewStatus
  active: boolean
  startedAtSeconds: number
  acknowledgedAtSeconds: number | null
  correctedAtSeconds: number | null
}

export interface IcuTherapyStepResult<State> {
  state: State
  effects: readonly IcuTherapyEffect[]
  alarms: readonly Omit<
    IcuDeviceAlarm,
    'startedAtSeconds' | 'acknowledgedAtSeconds' | 'correctedAtSeconds'
  >[]
  telemetry: Readonly<Record<string, number | string | boolean | null>>
}

export interface IcuTherapyAdapter<State, Action> {
  readonly id: IcuTherapyId
  createInitialState(): State
  reduce(state: State, action: Action, snapshot: IcuPatientSnapshot): State
  step(
    state: State,
    snapshot: IcuPatientSnapshot,
    deltaSeconds: number,
  ): IcuTherapyStepResult<State>
}

export const icuAssessmentIds = [
  'bedside-exam',
  'abg',
  'core-labs',
  'lactate',
  'coagulation',
  'focused-echo',
  'chest-imaging',
  'pac',
] as const
export type IcuAssessmentId = (typeof icuAssessmentIds)[number]

export const icuCareInterventionIds = [
  'fluid-bolus',
  'blood-products',
  'vasopressor-up',
  'vasopressor-down',
  'inotrope-up',
  'inotrope-down',
  'sedation-up',
  'sedation-down',
  'prone',
  'supine',
  'antimicrobials',
  'source-control',
  'reperfusion',
  'tamponade-drainage',
  'communicate-plan',
] as const
export type IcuCareInterventionId = (typeof icuCareInterventionIds)[number]

export type IcuTherapyControl =
  | 'mode'
  | 'tidal-volume-ml'
  | 'rate-per-min'
  | 'peep-cmh2o'
  | 'fio2'
  | 'inspiratory-pressure-cmh2o'
  | 'pressure-support-cmh2o'
  | 'rpm'
  | 'blood-flow-l-min'
  | 'sweep-l-min'
  | 'gas-fio2'
  | 'assist-ratio'
  | 'performance-level'
  | 'inflation-offset-ms'
  | 'deflation-offset-ms'
  | 'position'
  | 'purge-state'
  | 'blood-flow-ml-min'
  | 'dialysate-ml-hour'
  | 'replacement-ml-hour'
  | 'patient-fluid-removal-ml-hour'

export type IcuControlValue = number | string | boolean

/** Semantic learner intent only. No command can patch patient truth directly. */
export type IcuCommand =
  | { type: 'assessment.order'; assessmentId: IcuAssessmentId }
  | { type: 'diagnosis.commit'; classification: IcuShockClassification }
  | { type: 'therapy.prepare'; therapy: IcuTherapyId; configuration?: string }
  | { type: 'therapy.start'; therapy: IcuTherapyId }
  | { type: 'therapy.stop'; therapy: IcuTherapyId }
  | {
      type: 'therapy.adjust'
      therapy: IcuTherapyId
      control: IcuTherapyControl
      value: IcuControlValue
    }
  | { type: 'care.perform'; interventionId: IcuCareInterventionId }
  | { type: 'alarm.acknowledge'; alarmId: string }
  | { type: 'patient.reassess'; domains: readonly IcuReassessmentDomain[] }
  | {
      type: 'sandbox.adjust'
      driver: keyof IcuDiseaseDrivers
      value: number
    }
  | { type: 'time.advance'; seconds: number }
  | { type: 'session.complete' }

export type IcuReassessmentDomain =
  | 'hemodynamics'
  | 'respiratory'
  | 'renal'
  | 'perfusion'
  | 'devices'

export interface IcuObservation {
  id: string
  assessmentId: IcuAssessmentId | 'continuous-monitor'
  observedAtSeconds: number
  availableAtSeconds: number
  values: Readonly<Record<string, number | string | boolean | null>>
  interpretation?: string
}

export interface IcuTrendSample {
  elapsedSeconds: number
  mapMmHg: number
  cardiacOutputLMin: number
  spo2Percent: number
  paCO2MmHg: number
  pH: number
  lactateMmolL: number
  hemoglobinGdl: number
  potassiumMmolL: number
  creatinineMgDl: number
  urineOutputMlHour: number
  netFluidBalanceMl: number
  ecmoFlowLMin: number
  mcsFlowLMin: number
  crrtRemovalMlHour: number
}

export interface IcuEventRecord {
  id: string
  elapsedSeconds: number
  kind: 'system' | 'assessment' | 'therapy' | 'care' | 'alarm' | 'scenario' | 'reassessment'
  code: string
  label: string
}

export interface IcuPerformedActionRecord {
  actionId: string
  sequence: number
  elapsedSeconds: number
}

export const icuScoreDomains = [
  'assessment',
  'prioritization',
  'therapy',
  'device',
  'reassessment',
  'safety',
] as const
export type IcuScoreDomain = (typeof icuScoreDomains)[number]

export const ICU_SCORE_WEIGHTS: Readonly<Record<IcuScoreDomain, number>> = Object.freeze({
  assessment: 15,
  prioritization: 15,
  therapy: 20,
  device: 20,
  reassessment: 20,
  safety: 10,
})

export interface IcuScoreBreakdown extends Record<IcuScoreDomain, number> {
  total: number
}

export const icuResponseNumericMetrics = [
  'map-mm-hg',
  'native-cardiac-output-l-min',
  'effective-systemic-flow-l-min',
  'rap-mm-hg',
  'pawp-mm-hg',
  'svr-dyn-sec-cm5',
  'pvr-wu',
  'pericardial-pressure-mm-hg',
  'circulating-volume-ml',
  'spo2-percent',
  'potassium-mmol-l',
  'hemoglobin-g-dl',
  'lactate-mmol-l',
  'infection-burden',
  'pulmonary-obstruction-severity',
] as const
export type IcuResponseNumericMetric = (typeof icuResponseNumericMetrics)[number]

export const icuResponseBooleanMetrics = [
  'antimicrobials-administered',
  'source-control-completed',
  'reperfusion-completed',
  'tamponade-drained',
] as const
export type IcuResponseBooleanMetric = (typeof icuResponseBooleanMetrics)[number]

export type IcuResponseTarget =
  | { kind: 'absolute'; value: number }
  | { kind: 'initial-delta'; delta: number }
  | { kind: 'initial-ratio'; ratio: number }

export type IcuResponsePredicate =
  | {
      id: string
      label: string
      kind: 'numeric'
      metric: IcuResponseNumericMetric
      comparison: 'gte' | 'lte'
      target: IcuResponseTarget
      evidenceIds: readonly string[]
    }
  | {
      id: string
      label: string
      kind: 'boolean'
      metric: IcuResponseBooleanMetric
      expected: boolean
      evidenceIds: readonly string[]
    }
  | {
      id: string
      label: string
      kind: 'therapy-running'
      therapy: IcuTherapyId
      expected: boolean
      evidenceIds: readonly string[]
    }
  | {
      id: string
      label: string
      kind: 'therapy-never-started'
      therapy: IcuTherapyId
      evidenceIds: readonly string[]
    }
  | {
      id: string
      label: string
      /** Blocks mastery on unresolved device limitations without assigning alarm severity. */
      kind: 'no-active-device-limitation'
      subsystems: readonly IcuTherapyId[]
      evidenceIds: readonly string[]
    }
  | {
      id: string
      label: string
      kind: 'no-active-critical-alarm'
      subsystems: readonly (IcuTherapyId | 'patient')[]
      evidenceIds: readonly string[]
    }

export interface IcuResponsePathDefinition {
  id: string
  label: string
  predicates: readonly IcuResponsePredicate[]
  /** Domain-score substitution only. These IDs never enter action history or replay. */
  substitutesForActionIds: readonly string[]
}

export interface IcuMasteryResponseDefinition {
  educationalModelOnly: true
  reviewStatus: IcuReviewStatus
  required: readonly IcuResponsePredicate[]
  /** When present, at least one complete authored path must pass. */
  oneOf?: readonly IcuResponsePathDefinition[]
}

export interface IcuResponseCriterionEvaluation {
  id: string
  label: string
  pathId: string | null
  passed: boolean
  actual: number | boolean | string
  target: string
  unit: string | null
}

export interface IcuResponseEvaluation {
  evaluated: boolean
  passed: boolean
  passedPathIds: readonly string[]
  substitutedActionIds: readonly string[]
  criteria: readonly IcuResponseCriterionEvaluation[]
}

export interface IcuOutcomeState {
  completed: boolean
  score: IcuScoreBreakdown
  criticalErrorIds: readonly string[]
  mastery: boolean
  checkpointIdsCompleted: readonly string[]
  response: IcuResponseEvaluation
}

export interface IcuDiagnosisState {
  committed: boolean
  classification: IcuShockClassification | null
  committedAtSeconds: number | null
  commitments: readonly {
    sequence: number
    classification: IcuShockClassification
    committedAtSeconds: number
  }[]
}

export interface IcuClockState {
  elapsedSeconds: number
  speed: 1 | 5 | 30
  paused: boolean
  hemodynamicAccumulatorSeconds: number
  slowAccumulatorSeconds: number
  nextTrendAtSeconds: number
}

export interface IcuReplayCommand {
  sequence: number
  issuedAtSeconds: number
  command: IcuCommand
}

export interface IcuReplayRecord {
  version: 1
  engineVersion: typeof ICU_ENGINE_VERSION
  contentVersion: typeof ICU_CONTENT_VERSION
  scenarioId: string
  scenarioVersion: string
  mode: IcuSimulationMode
  seed: number
  commands: readonly IcuReplayCommand[]
}

export interface IcuSimulationState {
  version: 1
  engineVersion: typeof ICU_ENGINE_VERSION
  contentVersion: typeof ICU_CONTENT_VERSION
  scenarioId: string
  scenarioVersion: string
  scenarioFamily: IcuScenarioFamily
  mode: IcuSimulationMode
  phase: IcuSimulationPhase
  seed: number
  randomState: number
  clock: IcuClockState
  patient: IcuPatientState
  circulationParameters: CirculationParameters
  compartments: CirculationCompartmentState
  calibration: IcuPhysiologyCalibration
  devices: IcuDeviceStates
  /** Learner commitment only; correctness is intentionally not exposed during a run. */
  diagnosis: IcuDiagnosisState
  observations: readonly IcuObservation[]
  alarms: readonly IcuDeviceAlarm[]
  trends: readonly IcuTrendSample[]
  history: readonly IcuEventRecord[]
  performedActionIds: readonly string[]
  actionHistory: readonly IcuPerformedActionRecord[]
  completedScheduledEventIds: readonly string[]
  reassessedDomains: readonly IcuReassessmentDomain[]
  outcome: IcuOutcomeState
  replay: IcuReplayRecord
}

export type IcuScenarioEventEffect =
  | {
      kind: 'driver-delta'
      driver: keyof IcuDiseaseDrivers
      delta: number
    }
  | { kind: 'bleeding-rate'; rateMlHour: number }

export interface IcuScheduledEventDefinition {
  id: string
  atSeconds: number
  jitterSeconds: { minimum: number; maximum: number } | null
  label: string
  effect: IcuScenarioEventEffect
  evidenceIds: readonly string[]
}

export interface IcuScenarioInterventionDefinition {
  actionId: string
  label: string
  kind: 'assessment' | 'therapy' | 'device' | 'care' | 'reassessment' | 'safety'
  scoringDomains: readonly IcuScoreDomain[]
  criticalErrorId: string | null
  evidenceIds: readonly string[]
}

export interface IcuScenarioCheckpointDefinition {
  id: string
  label: string
  requiredActionIds: readonly string[]
  acceptedAlternativeActionIdGroups: readonly (readonly string[])[]
  evidenceIds: readonly string[]
}

export interface IcuScenarioDefinition {
  id: string
  version: string
  family: IcuScenarioFamily
  title: string
  shortTitle: string
  summary: string
  openingNarrative: string
  durationHours: number
  minimumMasteryElapsedSeconds: number
  expectedClassification: IcuShockClassification
  allowedModes: readonly IcuSimulationMode[]
  initialPatient: IcuPatientState
  capabilities: {
    assessments: readonly IcuAssessmentId[]
    therapies: readonly IcuTherapyId[]
    interventions: readonly IcuCareInterventionId[]
    mcsDevices: readonly Exclude<IcuMcsDevice, 'none'>[]
    ecmoModes: readonly IcuEcmoMode[]
  }
  initialDevices?: Partial<IcuDeviceStates>
  scheduledEvents: readonly IcuScheduledEventDefinition[]
  interventions: readonly IcuScenarioInterventionDefinition[]
  checkpoints: readonly IcuScenarioCheckpointDefinition[]
  scoring: Readonly<Record<IcuScoreDomain, readonly string[]>>
  masteryResponse: IcuMasteryResponseDefinition
  criticalErrors: readonly { id: string; actionId: string; message: string }[]
  learningObjectives: readonly string[]
  debrief: readonly string[]
  evidenceIds: readonly string[]
  reviewStatus: IcuReviewStatus
  educationalUseOnly: true
}
