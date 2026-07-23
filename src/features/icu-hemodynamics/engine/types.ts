import type {
  CirculationCompartmentState,
  CirculationParameters,
  HemodynamicMeasurements,
} from '@/features/hemodynamics-core'

export type {
  CirculationCompartmentState,
  CirculationParameters,
  HemodynamicMeasurements,
} from '@/features/hemodynamics-core'

export type HemodynamicLearningMode = 'learn' | 'practice'
export type HemodynamicWorkspace = 'pac-skills' | 'cases'
export type HemodynamicCasePhase =
  | 'observe'
  | 'commit'
  | 'measure'
  | 'intervene'
  | 'response'
  | 'reassess'
  | 'debrief'

export type CatheterPosition = 'introducer' | 'ra' | 'rv' | 'pa' | 'wedge'
export type PressureArtifact =
  | 'none'
  | 'overdamped'
  | 'underdamped'
  | 'catheter-whip'
  | 'wall-contact'
  | 'false-wedge'
export type DynamicResponseKind = 'acceptable' | 'overdamped' | 'underdamped'
export type FastFlushLineType = 'pulmonary-artery' | 'systemic-arterial'

export type HemodynamicSignal =
  | 'ecg'
  | 'art'
  | 'cvp'
  | 'rv'
  | 'pap'
  | 'pcwp'
  | 'pleth'
  | 'respiration'

export interface MeasurementSystemState {
  zeroed: boolean
  transducerLevelCm: number
  dampingRatio: number
  naturalFrequencyHz: number
  noiseAmplitudeMmHg: number
  artifact: PressureArtifact
  fastFlushStartedAt: number | null
  fastFlushActiveUntil: number | null
  fastFlushLineType: FastFlushLineType | null
  lastFastFlushFinding: string | null
}

export interface CatheterState {
  position: CatheterPosition
  /** Confirmed pressure-sampling position. The monitor stays on this waveform during travel. */
  targetPosition: CatheterPosition | null
  movementStartedAt: number | null
  movementCompletesAt: number | null
  insertionDepthCm: number
  /** Flow-directed balloon state used only while floating RA/RV → PA, not for PAWP sampling. */
  floatBalloonInflated: boolean
  balloonInflated: boolean
  wedgeStartedAt: number | null
  wedgeCaptureReady: boolean
  wedgeCursorTime: number | null
  storedWedgeMmHg: number | null
  storedAtEndExpiration: boolean
  forcedSafetyRecovery: boolean
}

export interface HemodynamicWaveformSample {
  time: number
  ecgMv: number
  artMmHg: number
  cvpMmHg: number
  rvMmHg: number
  papMmHg: number
  pcwpMmHg: number
  pleth: number
  respiration: number
}

export interface HemodynamicAlarm {
  id: string
  label: string
  priority: 'advisory' | 'warning' | 'critical'
  active: boolean
  acknowledged: boolean
}

export interface ParameterEffect {
  id: string
  interventionId: string
  startedAt: number
  onsetSeconds: number
  recoverySeconds: number | null
  deltas: Partial<Record<keyof CirculationParameters, number>>
}

export type HemodynamicInterventionCategory =
  | 'assessment'
  | 'preload'
  | 'vascular-tone'
  | 'inotropy'
  | 'decongestion'
  | 'pulmonary-vascular'
  | 'ventilator'
  | 'definitive'

export interface HemodynamicInterventionDefinition {
  id: string
  label: string
  shortLabel: string
  category: HemodynamicInterventionCategory
  description: string
  response: string
  onsetSeconds: number
  recoverySeconds?: number
  repeatable?: boolean
  unsafe?: boolean
  critical?: boolean
  parameterDeltas: Partial<Record<keyof CirculationParameters, number>>
}

export interface ThermodilutionTechnique {
  injectateVolumeMl: number
  injectateTemperatureC: number
  injectionDurationSeconds: number
  respiratoryPhase: 'end-expiration' | 'inspiration' | 'variable'
  smoothness: number
}

export interface ThermodilutionCurvePoint {
  timeSeconds: number
  temperatureChangeC: number
}

export interface ThermodilutionTrial {
  id: string
  sequence: number
  generatedAt: number
  technique: ThermodilutionTechnique
  estimatedCardiacOutputLMin: number
  curveArea: number
  curve: readonly ThermodilutionCurvePoint[]
  quality: 'valid' | 'questionable' | 'invalid'
  alerts: readonly string[]
  accepted: boolean | null
}

export interface ThermodilutionConfiguration {
  injectateVolumeMl: number
  injectateTemperatureC: number
  maximumTrials: number
  minimumAcceptedTrials: number
}

export interface InterpretationValue {
  value: number | null
  unit: string
  status: 'interpretable' | 'not-interpretable'
  reason?: string
}

export interface DerivedHemodynamics {
  strokeVolumeMl: InterpretationValue
  strokeVolumeIndexMlM2: InterpretationValue
  systemicVascularResistance: InterpretationValue
  systemicVascularResistanceIndex: InterpretationValue
  pulmonaryVascularResistance: InterpretationValue
  pulmonaryVascularResistanceIndex: InterpretationValue
  cardiacPowerOutputW: InterpretationValue
  pulmonaryArteryPulsatilityIndex: InterpretationValue
  pulmonaryArteryCompliance: InterpretationValue
  pulsePressureVariationPercent: InterpretationValue
}

export interface FluidResponsivenessContext {
  controlledMechanicalVentilation: boolean
  regularRhythm: boolean
  noSpontaneousEffort: boolean
  tidalVolumeMlKg: number
  closedChest: boolean
  validArterialWaveform: boolean
  rightVentricularFailure: boolean
  intraAbdominalPressureElevated: boolean
}

export interface ValidityResult {
  valid: boolean
  reasons: readonly string[]
}

export interface HemodynamicCaseDefinition {
  id: string
  version: string
  station: string
  title: string
  shortTitle: string
  presentation: string
  learningObjectives: readonly string[]
  initialParameters: CirculationParameters
  initialMeasurementSystem?: Partial<MeasurementSystemState>
  initialCatheterPosition?: CatheterPosition
  thermodilution: ThermodilutionConfiguration
  mechanismOptions: readonly { id: string; label: string }[]
  priorityOptions: readonly { id: string; label: string }[]
  correctMechanismId: string
  correctPriorityId: string
  interventions: readonly HemodynamicInterventionDefinition[]
  requiredInterventionIds: readonly string[]
  unsafeInterventionIds: readonly string[]
  successCriteria: readonly {
    metric: keyof HemodynamicMeasurements
    operator: 'at-least' | 'at-most'
    value: number
    label: string
  }[]
  guidedPrompt: string
  debrief: readonly string[]
  sourceIds: readonly string[]
  safetyCriticalErrorIds: readonly string[]
}

export interface HemodynamicScoreBreakdown {
  signalValidity: number
  mechanism: number
  management: number
  thermodilutionAndDerived: number
  reassessmentAndSafety: number
  total: number
}

export interface HemodynamicSimulationState {
  schemaVersion: 1
  caseDefinition: HemodynamicCaseDefinition
  caseId: string
  mode: HemodynamicLearningMode
  workspace: HemodynamicWorkspace
  phase: HemodynamicCasePhase
  seed: number
  timeSeconds: number
  paused: boolean
  frozen: boolean
  sweepSeconds: 4 | 6 | 8 | 12
  pressureScaleMmHg: 40 | 80 | 160 | 240
  showPressureVolumeLoops: boolean
  baselineParameters: CirculationParameters
  parameters: CirculationParameters
  compartments: CirculationCompartmentState
  measurementSystem: MeasurementSystemState
  catheter: CatheterState
  measurements: HemodynamicMeasurements
  waveforms: readonly HemodynamicWaveformSample[]
  activeEffects: readonly ParameterEffect[]
  completedInterventionIds: readonly string[]
  selectedMechanismId: string
  selectedPriorityId: string
  predictionCommitted: boolean
  reassessed: boolean
  thermodilutionTrials: readonly ThermodilutionTrial[]
  alarms: readonly HemodynamicAlarm[]
  criticalErrors: readonly string[]
  signalValidationChecks: readonly string[]
  responseMessage: string | null
  score: HemodynamicScoreBreakdown | null
  completed: boolean
}

export type HemodynamicAction =
  | { type: 'TICK'; seconds: number }
  | {
      type: 'RESET_CASE'
      definition: HemodynamicCaseDefinition
      mode?: HemodynamicLearningMode
      seed?: number
    }
  | { type: 'SET_MODE'; mode: HemodynamicLearningMode }
  | { type: 'SET_WORKSPACE'; workspace: HemodynamicWorkspace }
  | { type: 'SET_PHASE'; phase: HemodynamicCasePhase }
  | { type: 'SELECT_MECHANISM'; id: string }
  | { type: 'SELECT_PRIORITY'; id: string }
  | { type: 'COMMIT_PREDICTION' }
  | { type: 'SET_CATHETER_POSITION'; position: CatheterPosition }
  | { type: 'ADVANCE_CATHETER'; instant?: boolean }
  | { type: 'RETRACT_CATHETER'; instant?: boolean }
  | { type: 'SET_TRANSDUCER_LEVEL'; levelCm: number }
  | { type: 'ZERO_TRANSDUCER' }
  | { type: 'SET_DAMPING'; dampingRatio: number }
  | { type: 'SET_ARTIFACT'; artifact: PressureArtifact }
  | { type: 'FAST_FLUSH'; lineType: FastFlushLineType }
  | { type: 'VALIDATE_SIGNAL'; check: string }
  | { type: 'START_WEDGE' }
  | { type: 'PLACE_WEDGE_CURSOR' }
  | { type: 'STORE_WEDGE' }
  | { type: 'DEFLATE_WEDGE' }
  | { type: 'GENERATE_THERMODILUTION_TRIAL'; technique: ThermodilutionTechnique }
  | { type: 'SET_THERMODILUTION_ACCEPTED'; trialId: string; accepted: boolean }
  | { type: 'APPLY_INTERVENTION'; intervention: HemodynamicInterventionDefinition }
  | { type: 'REASSESS' }
  | { type: 'COMPLETE_CASE' }
  | { type: 'TOGGLE_FREEZE' }
  | { type: 'SET_SWEEP'; seconds: 4 | 6 | 8 | 12 }
  | { type: 'SET_PRESSURE_SCALE'; maximum: 40 | 80 | 160 | 240 }
  | { type: 'TOGGLE_PV_LOOPS' }
  | { type: 'ACKNOWLEDGE_ALARMS' }

export interface DerivedHemodynamicsInput {
  measurements: Partial<HemodynamicMeasurements>
  bodySurfaceAreaM2?: number | null
  ppvContext?: FluidResponsivenessContext
  inputsStale?: boolean
}

export interface ThermodilutionGenerationInput {
  trueCardiacOutputLMin: number
  technique: ThermodilutionTechnique
  configuration: ThermodilutionConfiguration
  modifiers?: {
    tricuspidRegurgitationSeverity?: number
    shuntFraction?: number
    lowFlowFraction?: number
    rhythmRegularity?: number
    catheterPosition?: CatheterPosition
  }
  seed: number
  sequence?: number
  generatedAt?: number
}
