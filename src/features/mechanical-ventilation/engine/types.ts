export type CanonicalVentilationMode = 'volume-ac' | 'pressure-ac' | 'pressure-support'
export type VentilatorModeId =
  | CanonicalVentilationMode
  | 'volume-simv'
  | 'pressure-simv'
  | 'adaptive-pressure-ac'
  | 'adaptive-pressure-simv'
  | 'aprv'
  | 'bilevel'
  | 'proportional-assist'
  | 'volume-support'
  | 'asv'
  | 'intellivent-asv'
  | 'tcpl-ac'
  | 'tcpl-simv'

export type VentilatorModeAvailability = 'simulated' | 'requires-neonatal'

export interface VentilatorModeDescriptor {
  id: VentilatorModeId
  canonicalMode: CanonicalVentilationMode
  label: string
  description: string
  availability: VentilatorModeAvailability
  availabilityNote?: string
}

export type VentilatorFeatureId = 'autoflow' | 'volume-guarantee' | 'intellisync-plus'

export interface VentilatorFeatureDescriptor {
  id: VentilatorFeatureId
  label: string
  description: string
  compatibleModes: readonly VentilatorModeId[]
  availability: VentilatorModeAvailability
  availabilityNote?: string
}
export const ventilatorDeviceIds = [
  'hamilton-c6',
  'drager-evita-v800-v600',
  'puritan-bennett-980',
  'carefusion-avea',
] as const
export type VentilatorDeviceId = (typeof ventilatorDeviceIds)[number]
export type LearningExperience = 'learn' | 'practice'
export type ChallengeMode = 'untimed' | 'timed'
export type SimulationSpeed = 1 | 5 | 30
export type VentilatorScreen = 'main' | 'modes' | 'controls' | 'alarms' | 'graphics' | 'tools'
export type AlarmPriority = 'low' | 'medium' | 'high'
export type FlowPattern = 'square' | 'decelerating-50' | 'sine' | 'decelerating-100'
export type TriggerSetting =
  | { type: 'flow'; thresholdLMin: number }
  | { type: 'pressure'; thresholdCmH2O: number }

export type ControlCommitBehavior = 'immediate' | 'rotary-confirm' | 'touch-or-accept'

export interface VentilatorControlDescriptor {
  key: VentilatorControlKey
  label: string
  unit: string
  minimum: number
  maximum: number
  step: number
  rangeNote?: string
}

export interface VentilatorDeviceProfile {
  id: VentilatorDeviceId
  displayName: string
  shortName: string
  manufacturer: string
  softwareVersion: string
  manualProfile: string
  patientGroup: string
  commitBehavior: ControlCommitBehavior
  modes: readonly VentilatorModeDescriptor[]
  features: readonly VentilatorFeatureDescriptor[]
  navigationLabels: Record<VentilatorScreen, string>
  orientationSteps: readonly string[]
  deferredModes: readonly string[]
  sourceIds: readonly string[]
  controlLabels: Partial<Record<VentilatorControlKey, string>>
  educationalUseOnly: true
}

export interface AdvancedVentilationSettings {
  targetVtMl: number
  spontaneousPressureSupportCmH2O: number
  spontaneousRampMs: number
  spontaneousCyclePercent: number
  pHighCmH2O: number
  pLowCmH2O: number
  tHighSeconds: number
  tLowSeconds: number
  proportionalSupportPercent: number
  minuteVolumePercent: number
  targetSpO2LowPercent: number
  targetPetCO2MmHg: number
  automaticVentilationController: boolean
  automaticOxygenationController: boolean
  autoFlowEnabled: boolean
  intelliSyncEnabled: boolean
}

export interface MechanicalVentilationCommonSettings {
  deviceMode: VentilatorModeId
  advanced: AdvancedVentilationSettings
  oxygenPercent: number
  peepCmH2O: number
  trigger: TriggerSetting
  highPressureLimitCmH2O: number
  trcEnabled: boolean
  trcPercent: number
  tubeInnerDiameterMm: number
}

export interface VolumeAssistControlSettings extends MechanicalVentilationCommonSettings {
  mode: 'volume-ac'
  vtMl: number
  ratePerMin: number
  peakFlowLMin: number
  flowPattern: FlowPattern
  pausePercent: number
}

export interface PressureAssistControlSettings extends MechanicalVentilationCommonSettings {
  mode: 'pressure-ac'
  deltaPControlCmH2O: number
  ratePerMin: number
  inspiratoryTimeSeconds: number
  pRampMs: number
}

export interface PressureSupportSettings extends MechanicalVentilationCommonSettings {
  mode: 'pressure-support'
  pressureSupportCmH2O: number
  pRampMs: number
  etsPercent: number
  tiMaxSeconds: number
  apneaBackupEnabled: boolean
  apneaRatePerMin: number
}

export type MechanicalVentilationSettings =
  | VolumeAssistControlSettings
  | PressureAssistControlSettings
  | PressureSupportSettings

export interface MechanicalVentilatorState {
  screen: VentilatorScreen
  settings: MechanicalVentilationSettings
  pendingMode: VentilatorModeId | null
  locked: boolean
  frozen: boolean
  alarmAudioEnabled: boolean
  audioPausedUntil: number | null
  oxygenEnrichmentUntil: number | null
  holdType: 'inspiratory' | 'expiratory' | null
  holdUntil: number | null
  manualBreathUntil: number | null
}

export interface PatientModelState {
  mechanics: {
    complianceLPerCmH2O: number
    resistanceCmH2OPerLps: number
    intrinsicPeepCmH2O: number
    endExpiratoryVolumeL: number
    airwayLeakFraction: number
    tubeResistanceCmH2OPerLps: number
  }
  drive: {
    neuralRatePerMin: number
    neuralInspiratoryTimeSeconds: number
    effortAmplitudeCmH2O: number
    variability: number
    reverseTriggerDelaySeconds: number | null
  }
  gasExchange: {
    shuntFraction: number
    deadSpaceFraction: number
    co2ProductionMlMin: number
    oxygenConsumptionMlMin: number
    paO2MmHg: number
    paCO2MmHg: number
    bicarbonateMmolL: number
    pH: number
    spo2Percent: number
  }
  hemodynamics: {
    heartRatePerMin: number
    systolicMmHg: number
    diastolicMmHg: number
    mapMmHg: number
    obstructiveShock: boolean
  }
  human: {
    painScore: number
    anxietyScore: number
    deliriumScore: number
    sedationScore: number
    dyspneaScore: number
    canCommunicate: boolean
  }
  airway: {
    secretions: boolean
    hmeObstructed: boolean
    ettObstructed: boolean
    bronchospasm: boolean
    condensate: boolean
    circuitLeak: boolean
    pneumothorax: boolean
  }
}

export interface VentilatorMeasurements {
  peakPressureCmH2O: number
  plateauPressureCmH2O: number
  meanAirwayPressureCmH2O: number
  exhaledVtMl: number
  minuteVentilationLMin: number
  totalRatePerMin: number
  observedPatientRatePerMin: number
  staticComplianceMlCmH2O: number
  intrinsicPeepCmH2O: number
  expiratoryFlowAtNextBreathLMin: number
  triggerDelayMs: number
  mechanicalInspiratoryTimeSeconds: number
  stackedVolumeMl: number
  ineffectiveEffortFraction: number
  autotriggerFraction: number
  pressureOvershootCmH2O: number
}

export interface WaveformSample {
  time: number
  pawCmH2O: number
  flowLMin: number
  volumeMl: number
  pmusCmH2O: number
  phase: 'inspiration' | 'expiration'
  triggered: boolean
}

export interface TrendSample {
  time: number
  spo2Percent: number
  paCO2MmHg: number
  mapMmHg: number
  peakPressureCmH2O: number
  plateauPressureCmH2O: number
  intrinsicPeepCmH2O: number
  dyspneaScore: number
}

export interface AlarmEvent {
  id: string
  code: string
  message: string
  priority: AlarmPriority
  startedAt: number
  acknowledgedAt?: number
  active: boolean
}

export interface RiskState {
  highPlateau: number
  stackedVolume: number
  dynamicHyperinflation: number
  hypoxemia: number
  hypotension: number
  excessiveSedation: number
}

export type StationId =
  | 'lung-protection-demand'
  | 'effort-triggering'
  | 'obstructive-mechanics'
  | 'pressure-support-timing'
  | 'deterioration-whole-patient'

export type PhenotypeId =
  | 'ards-recruitment'
  | 'flow-starvation'
  | 'double-triggering'
  | 'reverse-triggering'
  | 'copd-ineffective-efforts'
  | 'asthma-obstructive-shock'
  | 'weak-trigger'
  | 'autotriggering'
  | 'premature-cycling'
  | 'delayed-cycling'
  | 'rise-time-mismatch'
  | 'over-assistance'
  | 'high-resistance'
  | 'tension-pneumothorax'
  | 'dyspnea-human-factors'

export type InterventionCategory =
  | 'assessment'
  | 'ventilator'
  | 'airway-circuit'
  | 'medication'
  | 'procedure'
  | 'comfort-communication'

export type InterventionEffectId =
  | 'assess-patient'
  | 'review-waveforms'
  | 'inspiratory-hold'
  | 'expiratory-hold'
  | 'order-abg'
  | 'communicate-plan'
  | 'disconnect-bag'
  | 'treat-drive'
  | 'reduce-sedation'
  | 'deepen-sedation'
  | 'neuromuscular-blockade'
  | 'bronchodilator'
  | 'suction-airway'
  | 'inspect-circuit'
  | 'drain-condensate'
  | 'correct-leak'
  | 'remove-hme'
  | 'reposition-ett'
  | 'decompress-pneumothorax'
  | 'pleural-drainage'
  | 'communication-board'
  | 'treat-pain'
  | 'relieve-bladder'
  | 'reorient'
  | 'reduce-noise'
  | 'assess-strength'
  | 'prone-plan'

export interface InterventionDefinition {
  id: string
  label: string
  category: InterventionCategory
  description: string
  response: string
  effectId: InterventionEffectId
  latencySeconds: number
  repeatable?: boolean
  prerequisites?: readonly string[]
  unsafe?: boolean
  critical?: boolean
}

export interface PredictionOption {
  id: string
  label: string
}

export type MetricKey =
  | 'measurements.plateauPressureCmH2O'
  | 'measurements.intrinsicPeepCmH2O'
  | 'measurements.expiratoryFlowAtNextBreathLMin'
  | 'measurements.ineffectiveEffortFraction'
  | 'measurements.autotriggerFraction'
  | 'measurements.pressureOvershootCmH2O'
  | 'measurements.stackedVolumeMl'
  | 'patient.gasExchange.spo2Percent'
  | 'patient.gasExchange.paCO2MmHg'
  | 'patient.hemodynamics.mapMmHg'
  | 'patient.human.dyspneaScore'

export type MetricComparator = 'lt' | 'lte' | 'gt' | 'gte' | 'between'

export interface MetricCondition {
  metric: MetricKey
  comparator: MetricComparator
  value: number | readonly [number, number]
}

export interface MetricEffect {
  target: MetricKey
  operation: 'set' | 'add' | 'multiply' | 'move-toward'
  value: number
  durationSeconds?: number
}

export interface VentilationCaseDefinition {
  id: string
  sourceCaseId: string
  title: string
  stationId: StationId
  category: string
  difficulty: string
  runTimeMin: number
  phenotype: PhenotypeId
  patientSex: 'male' | 'female' | 'unspecified'
  predictedBodyWeightKg: number
  patientDescription: string
  learningObjectives: readonly string[]
  initialSettings: MechanicalVentilationSettings
  initialPatient: PatientModelState
  visibleFindings: readonly string[]
  mechanismOptions: readonly PredictionOption[]
  correctMechanismId: string
  priorityOptions: readonly PredictionOption[]
  correctPriorityId: string
  responseOptions: readonly PredictionOption[]
  correctResponseId: string
  interventions: readonly InterventionDefinition[]
  requiredInterventionIds: readonly string[]
  requiredReassessmentIds: readonly string[]
  successConditions: readonly MetricCondition[]
  hintLadder: readonly string[]
  debrief: string
  expectedActions: readonly string[]
  acceptedAlternatives: readonly string[]
  unsafeActions: readonly string[]
  successCriteria: readonly string[]
  simulationLogic: readonly string[]
  runTips: string
  sourceBasis: readonly number[]
  branchOptions: readonly string[]
  baselineSeconds: number
  deviceAdaptationNotes: readonly string[]
}

export interface InterventionRecord {
  id: string
  interventionId: string
  label: string
  response: string
  time: number
  effectiveAt: number
}

export interface PredictionState {
  committed: boolean
  mechanismId: string | null
  priorityId: string | null
  responseId: string | null
}

export interface ReassessmentState {
  committed: boolean
  actionIds: readonly string[]
}

export interface VentilationSimulationState {
  version: 1
  deviceId: VentilatorDeviceId
  caseId: string
  experience: LearningExperience
  challengeMode: ChallengeMode
  phase: 'observe' | 'act' | 'reassess' | 'debrief'
  simulationTime: number
  speed: SimulationSpeed
  paused: boolean
  seed: number
  branch: string
  showEducatorOverlay: boolean
  ventilator: MechanicalVentilatorState
  patient: PatientModelState
  measurements: VentilatorMeasurements
  waveforms: readonly WaveformSample[]
  trends: readonly TrendSample[]
  alarms: readonly AlarmEvent[]
  alarmHistory: readonly AlarmEvent[]
  interventions: readonly InterventionRecord[]
  prediction: PredictionState
  reassessment: ReassessmentState
  hintsUsed: number
  risk: RiskState
  criticalErrors: readonly string[]
  lastResponse: string | null
  lastAbgAt: number | null
}

export interface CaseOutcome {
  score: number
  mastery: boolean
  domains: {
    safety: number
    mechanism: number
    correctiveActions: number
    reassessment: number
    communicationComfort: number
  }
  criticalErrors: readonly string[]
  resolved: boolean
}

export type VentilatorControlKey =
  | 'oxygenPercent'
  | 'peepCmH2O'
  | 'highPressureLimitCmH2O'
  | 'triggerType'
  | 'triggerThreshold'
  | 'vtMl'
  | 'ratePerMin'
  | 'peakFlowLMin'
  | 'pausePercent'
  | 'flowPattern'
  | 'deltaPControlCmH2O'
  | 'inspiratoryTimeSeconds'
  | 'pressureSupportCmH2O'
  | 'pRampMs'
  | 'etsPercent'
  | 'tiMaxSeconds'
  | 'apneaBackupEnabled'
  | 'apneaRatePerMin'
  | 'trcEnabled'
  | 'trcPercent'
  | 'tubeInnerDiameterMm'
  | 'targetVtMl'
  | 'spontaneousPressureSupportCmH2O'
  | 'spontaneousRampMs'
  | 'spontaneousCyclePercent'
  | 'pHighCmH2O'
  | 'pLowCmH2O'
  | 'tHighSeconds'
  | 'tLowSeconds'
  | 'proportionalSupportPercent'
  | 'minuteVolumePercent'
  | 'targetSpO2LowPercent'
  | 'targetPetCO2MmHg'
  | 'automaticVentilationController'
  | 'automaticOxygenationController'
  | 'autoFlowEnabled'
  | 'intelliSyncEnabled'

export type VentilationAction =
  | {
      type: 'LOAD_CASE'
      caseId: string
      experience: LearningExperience
      attempt?: number
      deviceId?: VentilatorDeviceId
    }
  | { type: 'CHANGE_DEVICE'; deviceId: VentilatorDeviceId; attempt?: number }
  | { type: 'TICK'; seconds?: number }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'SET_SPEED'; speed: SimulationSpeed }
  | { type: 'SET_CHALLENGE_MODE'; challengeMode: ChallengeMode }
  | { type: 'STEP_BREATH' }
  | { type: 'SET_SCREEN'; screen: VentilatorScreen }
  | { type: 'SELECT_MODE'; mode: VentilatorModeId }
  | { type: 'CONFIRM_MODE' }
  | { type: 'SET_CONTROL'; control: VentilatorControlKey; value: number | string | boolean }
  | { type: 'TOGGLE_LOCK' }
  | { type: 'TOGGLE_FREEZE' }
  | { type: 'TOGGLE_ALARM_AUDIO' }
  | { type: 'ACK_ALARM'; alarmId?: string }
  | { type: 'OXYGEN_ENRICHMENT' }
  | { type: 'MANUAL_BREATH' }
  | { type: 'PERFORM_HOLD'; hold: 'inspiratory' | 'expiratory' }
  | {
      type: 'COMMIT_PREDICTION'
      mechanismId: string
      priorityId: string
      responseId: string
    }
  | { type: 'PERFORM_INTERVENTION'; interventionId: string }
  | { type: 'USE_HINT' }
  | { type: 'COMMIT_REASSESSMENT' }
  | { type: 'REVEAL_DEBRIEF' }
  | { type: 'TOGGLE_EDUCATOR_OVERLAY' }
