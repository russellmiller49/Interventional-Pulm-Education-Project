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

/**
 * A measurement the monitoring screen can put in a parameter field. Vendors publish these under
 * different abbreviations and in different orders, so the metric is the stable identity and the
 * label lives on the device's display profile.
 */
export type VentilatorMonitorMetric =
  | 'peakPressure'
  | 'plateauPressure'
  | 'meanAirwayPressure'
  | 'peep'
  | 'intrinsicPeep'
  | 'exhaledTidalVolume'
  | 'minuteVolume'
  | 'totalRate'
  | 'spontaneousRate'
  | 'ieRatio'
  | 'oxygenPercent'
  | 'staticCompliance'
  | 'spo2'

export interface VentilatorMonitorField {
  metric: VentilatorMonitorMetric
  /** The vendor's own abbreviation, e.g. `PIP` on Evita, `PPEAK` on the PB980. */
  label: string
  unit: string
  precision?: number
}

export type VentilatorWaveformField = 'pawCmH2O' | 'flowLMin' | 'volumeMl'

export interface VentilatorWaveformChannel {
  field: VentilatorWaveformField
  label: string
  unit: string
  minimum: number
  maximum: number
  /** Trace color, where the vendor documents one. Omitted devices draw every trace alike. */
  color?: string
}

/**
 * How a device organizes its settings. The C6 groups them by clinical purpose; the Evita prints a
 * single therapy bar. `keys` is a precedence list — keys the active mode does not expose are
 * skipped, and anything unlisted keeps its engine order at the end.
 */
export interface VentilatorControlGroup {
  label: string
  keys: readonly VentilatorControlKey[]
}

/**
 * Where the device puts its monitored numbers relative to the waveforms.
 * `right-column` — Evita: large values in a column beside the waveform fields.
 * `right-tiles`  — Hamilton/AVEA: a stack of compact labelled tiles.
 * `top-banner`   — PB980: a horizontal patient-data banner across the top of the screen.
 */
export type VentilatorMonitorLayout = 'left-column' | 'right-column' | 'right-tiles' | 'top-banner'

export type VentilatorBezelAction =
  | 'manual-breath'
  | 'inspiratory-hold'
  | 'expiratory-hold'
  | 'alarm-reset'
  | 'alarm-silence'
  | 'oxygen-enrichment'
  | 'screen-lock'

export interface VentilatorBezelKey {
  action: VentilatorBezelAction
  label: string
}

/** The vendor's abbreviations for the four pressures the console keeps on the Paw trace. */
export interface VentilatorPressureLabels {
  peak: string
  plateau: string
  mean: string
  peep: string
}

/**
 * The unit spellings the simulator authors its controls in, before a device profile renames them.
 * Pressure is deliberately absent — it is a real unit difference (mbar vs cmH₂O) carried by
 * `pressureUnit`, not a spelling one.
 */
export type VentilatorNeutralControlUnit = 'mL' | 'L/min' | '/min' | 's' | 'ms' | '%' | 'mm'

/**
 * How a vendor spells each unit on its own settings tiles. The quantities are identical across
 * devices; only the printed abbreviation differs — the C6 prints `ml` and `b/min` where the PB980
 * prints `mL` and `1/min`. An unlisted unit keeps the simulator's neutral spelling.
 */
export type VentilatorControlUnits = Readonly<Partial<Record<VentilatorNeutralControlUnit, string>>>

export interface VentilatorDisplayProfile {
  /** How this vendor prints airway pressures. Evita uses mbar; the others use cmH₂O. */
  pressureUnit: string
  /** How this vendor spells the remaining setting units. See `VentilatorControlUnits`. */
  controlUnits: VentilatorControlUnits
  /**
   * Per-setting exceptions, for a vendor that spells one quantity two ways depending on what is
   * being measured. The Evita prints its O2 concentration in `Vol%` but its inspiration-termination
   * criterion in plain `%` — one unit string, two spellings, which `controlUnits` cannot express
   * because it is keyed by the unit rather than by the setting. Takes precedence over it.
   */
  controlUnitOverrides?: Readonly<Partial<Record<VentilatorControlKey, string>>>
  pressureLabels: VentilatorPressureLabels
  monitorLayout: VentilatorMonitorLayout
  /** The vendor's name for the monitored-value region, used as its accessible name. */
  monitorLabel: string
  monitorFields: readonly VentilatorMonitorField[]
  /** A separate strip below the monitored values. The C6 puts SpO2 and its low limit there. */
  monitorFooter?: readonly VentilatorMonitorField[]
  waveforms: readonly VentilatorWaveformChannel[]
  /**
   * The flow patterns this vendor offers for a volume-controlled breath, in the order it lists
   * them. Omitted means the simulator's full set, which is the right default for a device whose
   * manual does not publish one — not a claim that the device offers all four.
   */
  flowPatterns?: readonly FlowPattern[]
  /**
   * The order this vendor presents its settings in. Empty means no documented order, so the
   * engine's mode-driven order stands. `controlGroups` additionally labels the groups on screen.
   */
  controlOrder: readonly VentilatorControlKey[]
  controlGroups?: readonly VentilatorControlGroup[]
  /** PB980 only: the C / A / S breath-phase indicator that opens its patient-data banner. */
  showBreathPhase: boolean
  /** Documented off-screen keys rendered on the bezel, in the order the vendor prints them. */
  bezelKeys: readonly VentilatorBezelKey[]
  /** How many bezel keys sit to the left of the rotary control. The PB980 straddles its knob. */
  knobPosition: number
  /** Sourcing note for everything above; surfaced on the console. */
  displayNote: string
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
  display: VentilatorDisplayProfile
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
  /**
   * A hold that has been asked for but not yet started. The occlusion has to happen at the real
   * breath boundary the simulation is computing — end-inspiration for an inspiratory hold,
   * end-expiration for an expiratory one — so the request is parked here and armed by
   * `advanceSimulation` at the next matching phase transition.
   */
  pendingHold: 'inspiratory' | 'expiratory' | null
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
  /**
   * The pressures the ventilator displays — measured at the airway, so whatever the patient is
   * doing is in them. A patient pulling against a volume-controlled breath lowers every one of
   * these without changing the lung at all. The `relaxed*` pair below is the respiratory-system
   * mechanics themselves, which is what the model reasons about and what a hold in a relaxed
   * patient would reveal.
   */
  peakPressureCmH2O: number
  plateauPressureCmH2O: number
  meanAirwayPressureCmH2O: number
  /** The same two pressures with the patient's own effort taken out. Not displayed. */
  relaxedPeakPressureCmH2O: number
  relaxedPlateauPressureCmH2O: number
  /** Magnitude of inspiratory effort at end-inspiration, read off the trace. Zero when passive. */
  endInspiratoryEffortCmH2O: number
  /**
   * False when the patient was pulling at the moment a plateau would be read. A plateau measured
   * then is not the respiratory system's elastic pressure and cannot be used as one.
   */
  plateauIsInterpretable: boolean
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
  /** True when this breath is a spontaneous one rather than a mandatory delivery. */
  spontaneous: boolean
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
  | 'normal-supported-breath'
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
  // Case criteria are about the lung, so they read the relaxed value rather than the number on
  // the screen — an actively breathing patient can make a dangerous plateau look reassuring.
  | 'measurements.relaxedPlateauPressureCmH2O'
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
  /**
   * Teaching-only multipliers on this patient's mechanics, so a Learn section can change the lung
   * and let the learner watch the consequence on the real console rather than on a drawing.
   *
   * Multipliers rather than absolute values because the point is always "compared with *this*
   * patient", and because a case's own mechanics keep meaning something. `deriveEffectivePatient`
   * applies them last, after every intervention effect — it rebuilds mechanics from the case
   * definition on every sample, so anything set directly on `patient` is gone by the next one.
   */
  teachingMechanics: TeachingMechanicsOverride
}

/** Both default to 1, which is the case exactly as authored. */
export interface TeachingMechanicsOverride {
  complianceScale: number
  resistanceScale: number
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
  /** Learn-only: scale this patient's mechanics so the console shows the consequence. */
  | { type: 'SET_TEACHING_MECHANICS'; overrides: Partial<TeachingMechanicsOverride> }
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
