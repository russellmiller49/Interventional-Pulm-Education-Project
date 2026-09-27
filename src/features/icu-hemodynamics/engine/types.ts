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

/**
 * The dynamic response of one line's own tubing and transducer.
 *
 * HD-PRE-REVIEW-02 (report L9-05). The measurement system used to be one object for every channel,
 * so damping the systemic arterial line damped the pulmonary-artery and central-venous traces with
 * it, and repairing the arterial line "repaired" them too. Each line has its own fluid path; this is
 * the smallest explicit contract that lets the arterial one differ. Level, zero and noise are still
 * shared — that limitation is stated wherever the arterial line is repaired on its own.
 */
export interface LineDynamicResponse {
  readonly dampingRatio: number
  readonly naturalFrequencyHz: number
  readonly artifact: 'none' | 'overdamped' | 'underdamped'
}

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
  /**
   * The systemic arterial line's own dynamic response, when it differs from the shared one.
   * Absent or `null` — every existing state — means the arterial channel shares the response the
   * other channels use, exactly as before.
   */
  arterialLine?: LineDynamicResponse | null
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
  /**
   * Where the reading cursor sits on the captured occlusion trace, who put it there, and what the
   * trace says at that point (HD-PRE-REVIEW-02, report L6-02). `wedgeCursorTime` is kept for the
   * existing consumers and always equals `wedgeCursor.time`.
   */
  wedgeCursor?: WedgeCursorReading | null
  /** What was stored, from which cursor, in which physiological episode. */
  storedWedge?: StoredWedgeRecord | null
  /**
   * How many brief occlusions have been started in this run.
   *
   * Identifies the occlusion an observation belongs to, so a confirmation that the
   * pulmonary-artery tracing came back cannot be taken before any balloon went up, or carried over
   * from an earlier wedge (report L6-05). See `paReturnEpisodeKey`.
   */
  wedgeEpisodeCount: number
}

/**
 * Who placed the wedge reading cursor.
 *
 * `manual` is the learner choosing a sample on the captured trace; `assisted` is the simulation
 * placing it at its own modeled end expiration. They are different actions and are never merged:
 * revealing the assisted placement is not the learner identifying end expiration.
 */
export type WedgeCursorPlacement = 'manual' | 'assisted'

export interface WedgeCursorReading {
  readonly placement: WedgeCursorPlacement
  /** Model time of the selected sample. */
  readonly time: number
  /** The raw sample value at that time, unrounded. */
  readonly sampleMmHg: number
  /**
   * The mean of the one cardiac cycle centred on the cursor, unrounded. This is the number a
   * stored wedge takes from this cursor — a single sample sits on an a or v wave, not on a mean.
   */
  readonly cycleMeanMmHg: number
  readonly windowStart: number
  readonly windowEnd: number
  readonly sampleCount: number
  /** The simulation's own respiratory phase at the cursor, 0 = modeled end expiration. */
  readonly modeledRespiratoryPhase: number
  /** Signed seconds from the nearest modeled end expiration (negative = before it). */
  readonly secondsFromModeledEndExpiration: number
  /**
   * Whether the cursor falls inside this simulation's modeled end-expiratory window
   * (`END_EXPIRATION_TOLERANCE_PHASE`). A model setting, not a clinical tolerance.
   */
  readonly withinModeledEndExpiratoryWindow: boolean
  /** Which occlusion this cursor was placed on (`CatheterState.wedgeEpisodeCount`). */
  readonly occlusionEpisode: number
  /** The conditions the averaged samples were acquired under, read from their own times. */
  readonly acquisition: WedgeWindowAcquisition
}

/**
 * Which session and physiological episode a cursor's averaging window belongs to (HD-PRE-REVIEW-02
 * sanity repair, blocker 1).
 *
 * It is worked out from the sample times of the window against the episode timeline when the cursor
 * is placed, and never again: pressing Store later — after the modeled physiology has changed —
 * does not move a pressure into the conditions of the moment it was stored.
 */
export interface WedgeWindowAcquisition {
  readonly sessionId: string
  /**
   * The physiological episode every averaged sample was acquired in, or `null` when the window
   * straddles an episode boundary. A mean of samples from two sets of conditions describes neither,
   * so it is never stored as a wedge.
   */
  readonly physiologicalEpisode: number | null
  /** Each episode the window's samples fall in, earliest first (one entry unless it straddles). */
  readonly windowEpisodes: readonly number[]
}

export interface StoredWedgeRecord {
  /** Unrounded; surfaces round it for display. */
  readonly valueMmHg: number
  /** When Store was pressed. Not when the pressure was acquired — that is `cursor.windowStart`–`windowEnd`. */
  readonly storedAtSeconds: number
  readonly cursor: WedgeCursorReading
  /**
   * The physiological episode the averaged samples were acquired in
   * (`cursor.acquisition.physiologicalEpisode`), not the episode current when Store was pressed.
   */
  readonly physiologicalEpisode: number
  readonly sessionId: string
}

/**
 * Why the patient's physiology is now different from what it was.
 *
 * An episode boundary follows an accepted intervention that changes the model, or a change the
 * model itself schedules (a transient effect beginning to wane). Navigation, hints, references,
 * opening a panel, measurement-system changes and ordinary ticks never start one.
 */
export type PhysiologicalEpisodeCause =
  | { readonly kind: 'case-opened' }
  | { readonly kind: 'intervention'; readonly interventionId: string; readonly label: string }
  | { readonly kind: 'effect-waning'; readonly interventionId: string; readonly label: string }

export interface PhysiologicalEpisode {
  /** 0 is the state the case opened in. */
  readonly index: number
  readonly startedAtSeconds: number
  readonly cause: PhysiologicalEpisodeCause
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

/**
 * Which thermodilution acquisitions belong together (HD-PRE-REVIEW-02, report P-05).
 *
 * Two curves may be averaged only when they share this identity: the same session of the same
 * case, the same method, the same configured injectate computation constants, and the same
 * physiological episode. The identity is fixed when a curve is acquired and is never rewritten —
 * a later intervention starts a new series rather than relabelling an old one.
 *
 * `unrecorded` is a curve built without acquisition context (a directly constructed or legacy
 * trial). It is kept honest rather than guessed: it never pools with a recorded series.
 */
export interface ThermodilutionSeriesIdentity {
  readonly key: string
  readonly origin: 'learner-acquired' | 'authored-example' | 'unrecorded'
  readonly method: 'bolus-thermodilution'
  readonly sessionId: string | null
  readonly caseId: string | null
  readonly episode: PhysiologicalEpisode | null
  /** The configured computation constants, not the delivered injectate of one trial. */
  readonly injectate: { readonly volumeMl: number; readonly temperatureC: number } | null
  /** For an authored teaching example: which one. */
  readonly exampleId?: string
}

export interface ThermodilutionAcquisition {
  readonly series: ThermodilutionSeriesIdentity
  readonly acquiredAtSeconds: number
  readonly catheterPosition: CatheterPosition | null
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
  /**
   * H4 §7. Whether the raw temperature-time curve was inspected before the trial was accepted or
   * excluded. A trial that has never been reviewed cannot enter the accepted series, which is what
   * stops "a number appeared" from being the same thing as "a measurement was made".
   */
  reviewed: boolean
  /**
   * The technical reason a trial was excluded, from `thermodilutionExclusionReasons`. Exclusion
   * without one is refused: dropping the trial that disagrees is not a reason.
   */
  exclusionReasonId: string | null
  /**
   * The immutable acquisition context. Absent on a trial built without one; see
   * `ThermodilutionSeriesIdentity`.
   */
  readonly acquisition?: ThermodilutionAcquisition | null
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
  interpretation?: string
}

export interface DerivedHemodynamics {
  cardiacIndexLMinM2: InterpretationValue
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
  /**
   * Which run of the case this is. A reset or a new case is a new session, so nothing acquired in
   * one can be read as belonging to another.
   */
  sessionId: string
  /** The physiological conditions measurements are currently acquired under. */
  physiologicalEpisode: PhysiologicalEpisode
  /** Every episode this session has had, oldest first; the last one is the current one. */
  physiologicalEpisodes: readonly PhysiologicalEpisode[]
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
  | {
      type: 'SET_DAMPING'
      dampingRatio: number
      /** Only this line's own response; omitted, the shared response every line uses. */
      line?: 'systemic-arterial'
    }
  | { type: 'SET_ARTIFACT'; artifact: PressureArtifact; line?: 'systemic-arterial' }
  | { type: 'FAST_FLUSH'; lineType: FastFlushLineType }
  | { type: 'VALIDATE_SIGNAL'; check: string }
  | { type: 'START_WEDGE' }
  | {
      type: 'PLACE_WEDGE_CURSOR'
      /**
       * `manual` places the cursor on the captured sample nearest `time`. Omitted, the placement is
       * `assisted`: the simulation's own modeled end expiration, recorded as such.
       */
      placement?: WedgeCursorPlacement
      time?: number
    }
  | { type: 'STORE_WEDGE' }
  | { type: 'DEFLATE_WEDGE' }
  | { type: 'GENERATE_THERMODILUTION_TRIAL'; technique: ThermodilutionTechnique }
  | { type: 'REVIEW_THERMODILUTION_CURVE'; trialId: string }
  | {
      type: 'SET_THERMODILUTION_ACCEPTED'
      trialId: string
      accepted: boolean
      /** Required when excluding a trial; ignored when accepting one. */
      exclusionReasonId?: string
    }
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
  /** Where and under which conditions this curve is acquired. */
  acquisition?: ThermodilutionAcquisition | null
}
