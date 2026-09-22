import type { CriticalCareCurriculumStage } from '@/features/learning-module/activity/types'

export type SupportMode = 'vv' | 'va'

export type ConsoleScreen =
  | 'startup'
  | 'parameters'
  | 'blood'
  | 'transport'
  | 'interventions'
  | 'timers'
  | 'menu'
  | 'settings'
  | 'alarm-history'

export type PumpMode = 'rpm' | 'lpm'
export type SimulationMode = 'guided' | 'challenge'
export type LearningExperience = 'learn' | 'practice'
export type AlarmPriority = 'low' | 'medium' | 'high'
export type PowerSource = 'ac' | 'battery'
export type TrendParameter =
  | 'flow'
  | 'pVen'
  | 'pInt'
  | 'pArt'
  | 'deltaP'
  | 'paCO2'
  | 'spo2'
  | 'map'
  | 'lactate'
export type PredictionControl =
  | 'inspect-circuit'
  | 'assess-upper-body'
  | 'assess-lv-loading'
  | 'rpm'
  | 'sweep'
  | 'gas-fio2'
  | 'restore-gas'
  | 'correct-cause'
  | 'restore-power'
  | 'off-sweep-trial'
  | 'initiate-support'
  | 'resuscitate-preload'
  | 'transfuse-and-control'
  | 'decompress-chest'
  | 'reposition-cannula'
  | 'exchange-oxygenator'
  | 'vasopressor'
  | 'restore-distal-perfusion'
  | 'isolate-circuit'
export type PredictionDirection =
  | 'increase'
  | 'decrease'
  | 'hold'
  | 'inspect'
  | 'restore'
  | 'off'
  | 'gas-exchange'
  | 'perfusion'
  | 'drainage'
  | 'temporary'
  | 'definitive'

export type FaultId =
  | 'startup-inspection'
  | 'preload-limited'
  | 'return-obstruction'
  | 'oxygenator-resistance'
  | 'recirculation'
  | 'acute-hypercapnia'
  | 'compensated-hypercapnia'
  | 'gas-source-interruption'
  | 'arterial-bubble'
  | 'ac-power-loss'
  | 'flow-sensor-failure'
  | 'differential-hypoxemia'
  | 'lv-loading'
  | 'ecmo-not-initiated'
  | 'hemorrhagic-hypovolemia'
  | 'tension-pneumothorax'
  | 'vasoplegia'
  | 'tamponade'
  | 'distal-limb-ischemia'

export type ScenarioFamily =
  | 'orientation'
  | 'preload'
  | 'afterload'
  | 'recirculation'
  | 'sweep'
  | 'gas-source'
  | 'bubble'
  | 'transport'
  | 'differential-oxygenation'
  | 'ventricular-loading'
  | 'initiation'
  | 'patient-deterioration'
  | 'clinical-complication'
  | 'capstone'

export interface DeviceProfile {
  id: 'cardiohelp-i-us-2025'
  displayName: 'CARDIOHELP-i'
  manufacturer: 'Getinge'
  jurisdiction: 'US'
  ifuRevision: '2.3'
  ifuDate: 'January 2025'
  minimumSoftwareVersion: '03.04.10.00'
  thApp: 'Cardiopulmonary Support'
  supportedContentModes: readonly ['vv', 'va']
  educationalUseOnly: true
}

export interface AlarmEvent {
  id: string
  code: string
  message: string
  priority: AlarmPriority
  source: 'device' | 'gas-panel' | 'patient-monitor'
  parameter?: string
  startedAt: number
  acknowledgedAt?: number
  resolvedAt?: number
  active: boolean
}

export interface PressureLimits {
  pVenWarningLow: number
  pVenAlarmLow: number
  pIntWarningHigh: number
  pIntAlarmHigh: number
  pArtWarningHigh: number
  pArtAlarmHigh: number
  flowLow: number
  flowHigh: number
}

export interface DeviceState {
  poweredOn: boolean
  selfTest: 'pending' | 'passed' | 'failed'
  screen: ConsoleScreen
  locked: boolean
  pumpMode: PumpMode
  rpmSetpoint: number
  lpmSetpoint: number
  displayedSetpoint: number | null
  pumpRunning: boolean
  zeroFlowActive: boolean
  globalOverride: boolean
  pressureInterventionEnabled: boolean
  bubbleInterventionEnabled: boolean
  alarmAudioEnabled: boolean
  alarmPausedUntil: number | null
  safetyHeld: boolean
  powerSource: PowerSource
  batteryPercent: number
  limits: PressureLimits
  timers: readonly number[]
  timerRunning: readonly boolean[]
}

/**
 * Why a channel can or cannot be shown as a number.
 *
 * These are different provenance claims and must not collapse into one boolean:
 *
 * - `valid` — the model produced a value and the console can display it.
 * - `device-unavailable` — the CARDIOHELP itself would not show a number here: the sensor is not
 *   connected, the parameter is unsupported, or the value falls outside the documented display
 *   range. Sourced from the IFU (Rev 2.3 §3 p47 "Status of measured values"; ranges §14.8 p201).
 * - `simulation-unmodeled` — this educational model has no value to offer. Saying the device shows
 *   dashes here would be an unsourced claim about the physical device.
 */
export type EcmoReadoutStatus = 'valid' | 'device-unavailable' | 'simulation-unmodeled'

/**
 * A model quantity together with whether the console may render it as a number.
 *
 * `raw` is always the model-derived value and is never altered to fit a display range — clamping a
 * value to a display boundary and then showing it as though measured is the defect this type
 * exists to prevent. `displayed` is `null` whenever the console must fall back to the unavailable
 * convention instead.
 */
export interface EcmoChannelReadout {
  readonly status: EcmoReadoutStatus
  readonly raw: number
  readonly displayed: number | null
  /** Learner- and screen-reader-facing explanation of why a number is absent. */
  readonly reason: string
}

export interface CircuitReadouts {
  readonly pVen: EcmoChannelReadout
  readonly pInt: EcmoChannelReadout
  readonly pArt: EcmoChannelReadout
  readonly deltaP: EcmoChannelReadout
  /**
   * The console's SvO₂ tile. The CARDIOHELP venous probe measures blood in the disposable's
   * measuring cell, which sits on the venous inlet of the oxygenator pump unit — so this reads the
   * drainage limb, not a systemic mixed-venous estimate.
   */
  readonly venousLineSaturation: EcmoChannelReadout
}

export interface CircuitState {
  bloodFlow: number
  pVen: number
  pInt: number
  pArt: number
  pAux: number | null
  deltaP: number
  tVen: number
  tArt: number
  hemoglobin: number
  hematocrit: number
  /**
   * Saturation of blood in the drainage limb entering the oxygenator — the quantity the
   * CARDIOHELP venous probe measures. In VV this is systemic venous blood diluted by whatever
   * fraction of freshly oxygenated return is pulled straight back in, so it rises with
   * recirculation even as the patient does worse. Never clamped to the console's display range;
   * display eligibility is decided separately in `readouts`.
   */
  preOxygenatorSaturation: number
  postOxygenatorSaturation: number
  /**
   * Fraction of drained blood that is freshly returned circuit blood rather than systemic venous
   * return. A physical property of cannula geometry and the flow the circuit is asked for, so the
   * scenario sets the tendency — but the observable it produces (`preOxygenatorSaturation`) is
   * derived from it rather than authored beside it.
   */
  recirculationFraction: number
  /**
   * Circuit flow left after subtracting the fraction that is immediately re-drained:
   * `bloodFlow × (1 − recirculationFraction)`.
   *
   * Deliberately **not** called effective systemic flow. In VV it is the circuit flow that does
   * useful work. In VA the recirculation term is zero, so this equals displayed circuit flow and
   * says nothing about total systemic flow, which would also involve native cardiac output.
   */
  recirculationAdjustedCircuitFlowLpm: number
  /** Per-channel display eligibility. Channels can differ, so this is not one shared flag. */
  readouts: CircuitReadouts
  drainageChatter: boolean
  flowSensorConnected: boolean
  arterialBubbleDetected: boolean
  bubbleResetRequired: boolean
  circuitInspected: boolean
  backflowSeconds: number
  drainageClampClosed: boolean
  returnClampClosed: boolean
}

export interface GasState {
  sweepLpm: number
  fio2: number
  sourceConnected: boolean
}

export interface PatientState {
  spo2: number
  rightRadialSpo2: number
  femoralArterialSpo2: number
  paCO2: number
  pH: number
  bicarbonate: number
  respiratoryRate: number
  workOfBreathing: 'low' | 'moderate' | 'high'
  meanArterialPressure: number
  heartRate: number
  pulsePressure: number
  aorticValveOpening: boolean
  pulmonaryCongestion: 'none' | 'mild' | 'marked'
  nativeCardiacOutputLpm: number
  centralVenousPressure: number
  lactate: number
  urineOutputMlHr: number
  airwayPressure: number
  lungSliding: 'bilateral' | 'absent-left' | 'absent-right'
  temperature: number
  distalLimbPerfusion: 'normal' | 'threatened' | 'critical'
  distalLimbNirs: number
  /**
   * Whole-body mixed venous saturation estimated from the oxygen balance.
   *
   * **Latent and estimated, not measured.** The CARDIOHELP has no sensor for this — its venous
   * probe reads the drainage limb (see `CircuitState.preOxygenatorSaturation`), which in VV
   * recirculation diverges from this value in the opposite direction. Kept in patient physiology
   * rather than on the circuit precisely so the two cannot be confused again, and never clamped to
   * any console display range.
   */
  systemicVenousSaturationEstimate: number
}

/**
 * Authored inputs to the educational physiology model.
 *
 * These are not measurements and not universal clinical assumptions — they are the knobs the
 * simulation needs in order to close its own oxygen balance. Reference profiles and scenarios may
 * author them; anything that does not inherits the defaults.
 *
 * Evidence boundary: bounded-educational-model.
 */
export interface EcmoPhysiologyModelInputs {
  /**
   * Assumed whole-body oxygen consumption, mL/min.
   *
   * The default is chosen so the module's own baseline circuit (Hb 10.2 g/dL, native output
   * 4.5 L/min, SaO₂ ≈ 92%) is self-consistent at the venous saturation it has always displayed.
   * It is a model input, not a patient measurement, and carries no claim about any real patient's
   * metabolic rate.
   */
  readonly oxygenConsumptionMlMin: number
}

export type ClinicalCaseKind = 'initiation' | 'deterioration' | 'complication'
export type ClinicalSupportStatus = 'not-on-ecmo' | 'ready-to-start' | 'on-ecmo'
export type ClinicalTrajectory =
  | 'critical'
  | 'deteriorating'
  | 'temporarily-stabilized'
  | 'improving'
export type ClinicalInterventionEffect =
  | 'diagnostic'
  | 'supportive'
  | 'temporizing'
  | 'definitive'
  | 'harmful'

export interface ClinicalStatePatch {
  device?: Partial<DeviceState>
  circuit?: Partial<CircuitState>
  gas?: Partial<GasState>
  patient?: Partial<PatientState>
}

export interface ClinicalInterventionDefinition {
  id: string
  label: string
  category: 'assessment' | 'ecmo' | 'circuit' | 'resuscitation' | 'medication' | 'procedure'
  description: string
  effect: ClinicalInterventionEffect
  response: string
  patch?: ClinicalStatePatch
  reveals?: readonly string[]
  repeatable?: boolean
  prerequisites?: readonly string[]
  penalty?: {
    id: string
    points: number
    critical: boolean
  }
  /**
   * When present, this intervention can only be completed through the simulated
   * console or gas panel. Hidden requirements detect unsafe machine choices
   * without advertising them as intervention cards.
   */
  simulatorAction?: {
    control:
      | 'rpm'
      | 'sweep'
      | 'gas-fio2'
      | 'restore-gas'
      | 'restore-power'
      | 'clamp-drainage'
      | 'clamp-return'
      | 'unclamp-drainage'
      | 'unclamp-return'
      | 'resume-after-bubble'
    targetValue?: number
    tolerance?: number
    comparison?: 'within' | 'at-least' | 'at-most'
    visibility: 'prompted' | 'hidden'
    instruction: string
    target: GuidedTarget
    controlId: GuidedControlId
  }
}

export interface ClinicalCaseDataPoint {
  label: string
  value: string
  trend?: 'stable' | 'warning' | 'critical'
}

export interface ClinicalInitiationTargets {
  rpm: number
  sweepLpm: number
  fio2: number
  rpmTolerance?: number
  sweepTolerance?: number
  fio2Tolerance?: number
}

export interface ClinicalCaseDefinition {
  kind: ClinicalCaseKind
  sourceCase: string
  setting: string
  /**
   * What the case is called before its debrief: the presentation, never the diagnosis. Optional
   * until every case has one authored (I5); `presentationTitle()` falls back to `patientLabel`.
   */
  presentationTitle?: string
  patientLabel: string
  openingNarrative: string
  decisionPrompt: string
  learningObjectives: readonly string[]
  initialSupportStatus: ClinicalSupportStatus
  initialTrajectory: ClinicalTrajectory
  data: readonly ClinicalCaseDataPoint[]
  interventions: readonly ClinicalInterventionDefinition[]
  requiredInterventionIds: readonly string[]
  initiationTargets?: ClinicalInitiationTargets
  completionResponse: string
  deteriorationResponse: string
}

/**
 * An immutable reading of the signals a debrief compares, taken at one simulation time.
 *
 * Recorded by the reducer on the transition that performed an action: `before` is the state the
 * action was taken in, `after` the state it produced at the same simulation time. Neither is ever
 * recomputed, so a later clock tick or a later action at the same second cannot rewrite what an
 * action found or did (C1-3). A pressure the console could not show is `null`, never a number.
 */
export interface EcmoObservation {
  readonly time: number
  readonly bloodFlow: number
  readonly pumpRunning: boolean
  readonly rpmSetpoint: number
  readonly sweepLpm: number
  readonly gasFio2: number
  readonly gasSourceConnected: boolean
  readonly powerSource: PowerSource
  readonly pVen: number | null
  /** VV: patient SpO₂. VA: right-arm (right-radial) SpO₂, the upper-body reading. */
  readonly spo2: number
  /** VA only: femoral arterial SpO₂. */
  readonly femoralArterialSpo2: number | null
  readonly paCO2: number
  readonly pH: number
  readonly meanArterialPressure: number
  readonly centralVenousPressure: number
  readonly lactate: number
}

/** The pair of observations bracketing one learner action at an unchanged simulation time. */
export interface EcmoActionObservation {
  readonly before: EcmoObservation
  readonly after: EcmoObservation
}

export interface ClinicalInterventionRecord {
  id: string
  /** The learner action that applied this card, for a complete ordered debrief. */
  actionHistoryId?: string
  interventionId: string
  label: string
  effect: ClinicalInterventionEffect
  response: string
  time: number
  /** Written once by the reducer on the transition that applied this record. */
  observation?: EcmoActionObservation
}

/**
 * Patient fields the engine moves toward a target by a bounded amount per modeled second.
 *
 * Everything else on `PatientState` is either algebraic (pH, respiratory rate, valve and congestion
 * flags) or authored and never modeled (heart rate, bicarbonate, temperature).
 */
export type RateLimitedPatientField =
  | 'paCO2'
  | 'spo2'
  | 'rightRadialSpo2'
  | 'femoralArterialSpo2'
  | 'nativeCardiacOutputLpm'
  | 'pulsePressure'
  | 'meanArterialPressure'
  | 'centralVenousPressure'
  | 'lactate'
  | 'urineOutputMlHr'
  | 'airwayPressure'
  | 'distalLimbNirs'

/**
 * Who set the level a patient field is held at, in a clinical case (ECMO-FELLOW-02).
 *
 * `case-authored` — the case's own opening value, captured at load.
 * `intervention` — a non-temporizing intervention's patient patch, captured when it landed.
 */
export type PatientAnchorSource = 'case-authored' | 'intervention'

export interface PatientFieldAnchor {
  /** The level the field is held at. */
  readonly level: number
  /**
   * The engine's generic target for this field at the moment the level was set. The field moves
   * only by the change in that generic target since then — the model's response to something that
   * actually changed — never toward the generic value itself.
   */
  readonly reference: number
  readonly source: PatientAnchorSource
  readonly setAt: number
  /** Faults already present when an intervention landed; its held effect may cover these. */
  readonly activeFaultsAtSet?: readonly FaultId[]
}

/**
 * The ownership record of a clinical case's patient, captured at load.
 *
 * A clinical case authors where its patient is. The engine's generic relationships — saturation
 * from flow reaching the patient, PaCO₂ from sweep, the VA model's single native output and pulse
 * pressure — describe a generic patient, and without this record they pulled every authored value
 * toward that generic patient within seconds of load, whatever the learner did (the September 2026
 * walkthrough's "the monitor moves on its own"). See `resolvePatientTargets`.
 */
export interface PatientOwnership {
  /** The case's corrective fault: the presenting problem the authored values belong to. */
  readonly presentingFault: FaultId
  readonly anchors: Readonly<Partial<Record<RateLimitedPatientField, PatientFieldAnchor>>>
  /** An authored membrane-outlet saturation, held on the same terms as the patient anchors. */
  readonly postOxygenator?: { readonly level: number; readonly reference: number }
}

export interface ClinicalRuntime {
  supportStatus: ClinicalSupportStatus
  trajectory: ClinicalTrajectory
  appliedInterventions: readonly ClinicalInterventionRecord[]
  revealedFindings: readonly string[]
  lastResponse: string | null
}

/**
 * One retained frame of the signals a reassessment reads.
 *
 * The four pressure channels are `number | null` for the same reason `EcmoChannelReadout.displayed`
 * is: a frame recorded while the circuit was not flowing has no pressure the model can stand
 * behind, and a trend that plots the zero-flow intercepts of a stopped pump would teach a shape
 * that never happened. `null` means "this frame had nothing to report", and every consumer must
 * break the line rather than interpolate across it.
 */
export interface TrendSample {
  time: number
  flow: number
  pVen: number | null
  pInt: number | null
  pArt: number | null
  deltaP: number | null
  paCO2: number
  spo2: number
  map: number
  lactate: number
}

export interface ScenarioCredit {
  goal: boolean
  control: boolean
  direction: boolean
  cause: boolean
  reassessment: boolean
}

export type ReassessmentDomain = 'device' | 'circuit' | 'patient'

export interface ReassessmentOption {
  id: string
  label: string
  /**
   * Why this option does or does not describe the modeled response. Shown only in the debrief,
   * beside the option the learner chose and the one the model expected; never before the reveal.
   * Additive: options without one render no rationale rather than a manufactured sentence.
   */
  rationale?: string
}

export interface ReassessmentQuestion {
  prompt: string
  options: readonly ReassessmentOption[]
  correctOptionId: string
}

export interface ScenarioReassessmentDefinition {
  instruction: string
  device: ReassessmentQuestion
  circuit: ReassessmentQuestion
  patient: ReassessmentQuestion
  /**
   * What the monitor cannot show in this case (ECMO-FELLOW-02).
   *
   * Some expected responses name a finding this simulation does not produce — breathing easing after
   * initiation, blood pressure recovering after decompression, pulsatility returning after a
   * tamponade is relieved. The stage asks the learner to pick the response they actually see, so it
   * says, before they choose, which of those signals this model holds still. The key is unchanged:
   * the expected clinical course is still the expected clinical course.
   */
  modelBoundary?: string
}

export interface ReassessmentSubmission {
  deviceOptionId: string
  circuitOptionId: string
  patientOptionId: string
}

export interface ScenarioHint {
  id: string
  title: string
  text: string
  penalty: number
  target?: GuidedTarget
  controlId?: GuidedControlId
  focusId?: GuidedControlId | 'practice-plan' | 'practice-treatment' | 'practice-reassessment'
}

export interface ScenarioRuntime {
  /** Explicit scenario entry; never an answer or a performed intervention. */
  activityStarted: boolean
  /** Monotonic identity for history entries, even after the visible history is truncated. */
  historySerial?: number
  /** Provenance of the bicarbonate shown on the bedside panel. */
  bicarbonateSource?: 'case-supplied' | 'calculated' | 'model-default'
  scenarioId: string
  family: ScenarioFamily
  /**
   * The pump speed this case opened on.
   *
   * Recorded so the engine can express "faster than the speed this circuit was already running at"
   * without any scenario's number being written into the engine. It is a property of the authored
   * case, captured once at load and never moved by a learner turning the rotary control.
   */
  baselineRpmSetpoint: number
  /**
   * The drainage capacity this case authored, captured at load beside the opening speed.
   *
   * `null` means the case authored none, in which case the active drainage-limited fault's own
   * default applies. Like `baselineRpmSetpoint` it is a property of the authored case and no
   * learner action moves it.
   */
  drainageCapacityLpm: number | null
  phase: 'predict' | 'act' | 'reassess' | 'debrief' | 'complete'
  activeFaults: readonly FaultId[]
  correctedFaults: readonly FaultId[]
  injectedTimedFaultIds: readonly string[]
  prediction: {
    committed: boolean
    goalId: string | null
    control: PredictionControl | null
    direction: PredictionDirection | null
  }
  /**
   * What the learner actually did, kept apart from what they committed (B6-005).
   *
   * Plan credit (`credit.goal/control/direction`) is written once, by `COMMIT_PREDICTION`, and
   * never again. Later actions that match the expected control record here instead, so the
   * debrief can say "your later actions matched the authored path" without laundering a wrong plan
   * into a right one.
   */
  execution?: { controlMatched: boolean; directionMatched: boolean }
  /**
   * Patient changes an action has earned but the clock has not yet delivered (B6-012).
   *
   * Nothing about the patient moves at an unchanged simulation time: an authored patient patch
   * from a corrected fault or a clinical intervention waits here and lands on the next second.
   */
  pendingPatientPatch?: Partial<PatientState>
  /**
   * The queued patient fields that came from a non-temporizing intervention.
   *
   * When they land, a clinical case holds them there (an `intervention` anchor) instead of letting
   * the next generic target erase them. A temporizing patch is deliberately absent from this list:
   * transient is what temporizing means in this engine, and it still fades.
   */
  pendingPersistentPatientFields?: readonly RateLimitedPatientField[]
  /** Present on clinical cases only. */
  patientOwnership?: PatientOwnership
  /**
   * The simulation time the sweep was last turned to zero, or `null` while sweep is flowing.
   *
   * The off-sweep work-of-breathing response is timed from this event. It used to be timed from
   * the case clock (`simulationTime >= 20`), so a trial started late flipped the breathing after one
   * second and one started early after the full delay.
   */
  sweepStoppedAt?: number | null
  reassessment: ReassessmentSubmission | null
  credit: ScenarioCredit
  penalties: number
  hintPenalty: number
  usedHintIds: readonly string[]
  criticalErrors: readonly string[]
  completedObjectiveIds: readonly string[]
  attempts: number
  causeCorrectedAt: number | null
  clinical: ClinicalRuntime | null
}

export interface HistoryEntry {
  id: string
  time: number
  kind: 'action' | 'alarm' | 'fault' | 'system'
  label: string
  /** Learner actions only: written once by the reducer on the transition that recorded the entry. */
  observation?: EcmoActionObservation
}

export interface EcmoSimulationState {
  version: 1
  supportMode: SupportMode
  simulationMode: SimulationMode
  simulationTime: number
  paused: boolean
  device: DeviceState
  circuit: CircuitState
  gas: GasState
  patient: PatientState
  /** Authored educational-model inputs. Not a learner-visible bedside measurement. */
  modelInputs: EcmoPhysiologyModelInputs
  scenario: ScenarioRuntime
  alarms: readonly AlarmEvent[]
  alarmHistory: readonly AlarmEvent[]
  trends: readonly TrendSample[]
  history: readonly HistoryEntry[]
}

export interface ScenarioObjective {
  id: string
  category: keyof ScenarioCredit | 'safety'
  label: string
  points: number
}

export interface TimedFault {
  id: string
  atSecond: number
  fault: FaultId
  cue: string
}

export interface ScenarioInitialState {
  device?: Partial<DeviceState>
  circuit?: Partial<CircuitState>
  gas?: Partial<GasState>
  patient?: Partial<PatientState>
  /** Scenarios inherit the model defaults unless they deliberately author an override. */
  modelInputs?: Partial<EcmoPhysiologyModelInputs>
  activeFaults?: readonly FaultId[]
  paused?: boolean
}

export interface ScenarioExpectation {
  goalId: string
  control: PredictionControl
  direction: PredictionDirection
  correctiveFault: FaultId
  acceptableReassessmentTerms: readonly string[]
  requiredCheckId?: string
}

export interface UnsafeActionPenalty {
  id: string
  label: string
  points: number
  critical: boolean
}

export interface ScenarioAssessmentPolicy {
  /** Deterministic simulator time required after the cause is addressed; not a clinical target. */
  minimumObservationSeconds: number
  preserveCircuitBloodFlow?: boolean
  prohibitSweepZeroWhileFlowing?: boolean
  /**
   * The reassessment counts only once support is back at the speed the case opened at (B6-004).
   * The case's own opening speed, never an invented flow target.
   */
  requireBaselineSupportRestored?: boolean
  requiredTermGroupsByDomain?: {
    device?: readonly (readonly string[])[]
    circuit?: readonly (readonly string[])[]
    patient?: readonly (readonly string[])[]
  }
  orderedPatientTermGroups?: readonly (readonly string[])[]
  reassessmentGuidance?: {
    device: string
    circuit: string
    patient: string
  }
}

export interface ScenarioDefinition {
  id: string
  family: ScenarioFamily
  stationId: 'orientation' | 'flow-pressure' | 'sweep' | 'troubleshooting' | 'assessment'
  supportMode: SupportMode
  title: string
  summary: string
  clinicalPhase: 'startup' | 'stabilization' | 'maintenance' | 'transport' | 'weaning'
  clinicalCase?: ClinicalCaseDefinition
  hiddenUntilAssessment?: boolean
  initialState: ScenarioInitialState
  /**
   * How much venous drainage this case can actually supply, in L/min.
   *
   * The drainage-limited faults model a circuit asking for more than the patient can give it, and
   * the quantity that decides "more than" belongs to the case rather than to the engine — a
   * hypovolaemic patient, a malpositioned cannula and a tamponade do not run out of drainage at the
   * same flow. Omitted, the fault's own authored default applies.
   *
   * Evidence boundary: bounded-educational-model. A teaching quantity, not a measurable one, and
   * not a clinical threshold of any kind.
   */
  drainageCapacityLpm?: number
  timedFaults: readonly TimedFault[]
  allowedActions: readonly SimulationAction['type'][]
  objectives: readonly ScenarioObjective[]
  expectation: ScenarioExpectation
  assessmentPolicy?: ScenarioAssessmentPolicy
  reassessment?: ScenarioReassessmentDefinition
  hints?: readonly ScenarioHint[]
  /** The capstones have no clinical case; this is what they are called and how they open. */
  challengeBrief?: { readonly title: string; readonly presentation: string }
  unsafeActionPenalties: readonly UnsafeActionPenalty[]
  successPredicates: readonly string[]
  terminalRules: readonly string[]
  debrief: {
    diagnosis: string
    causalChain: readonly string[]
    correctWorkflow: readonly string[]
    safetyNotes: readonly string[]
  }
  evidenceIds: readonly string[]
}

export interface EvidenceReference {
  id: string
  sourceClass:
    | 'manufacturer'
    | 'clinical-guidance'
    | 'textbook'
    | 'supplied-curriculum'
    | 'educational-model'
  title: string
  citation: string
  pages?: string
  url?: string
  /** Digital Object Identifier without a resolver prefix. Preferred over `url` for the open link. */
  doi?: string
  supports: readonly string[]
  limitations: string
}

export type ModuleSection = 'learn' | 'practice' | 'assess'

export interface LastVisitedActivity {
  section: ModuleSection
  scenarioId: string
  supportMode: SupportMode
}

export interface ProgressV2 {
  /** Self-paced topic visits; independent of all legacy completion/score fields. */
  visitedTopicIds?: readonly string[]
  version: 2
  lastStation: ScenarioDefinition['stationId']
  completedLabs: readonly string[]
  scenarioAttempts: Readonly<Record<string, number>>
  bestScores: Readonly<Record<string, number>>
  criticalErrorStatus: Readonly<Record<string, boolean>>
  /** Legacy VV-only mastery flag retained from v1; per-track mastery is derived. */
  mastery: boolean
  /** Drill scenario ids whose guided Learn lesson has been completed. */
  completedLearnLessonIds: readonly string[]
  lastLessonScenarioIdByMode: Readonly<Partial<Record<SupportMode, string>>>
  lastCaseScenarioIdByMode: Readonly<Partial<Record<SupportMode, string>>>
  lastVisited?: LastVisitedActivity
  /**
   * Foundation section ids the learner has worked, recorded when they commit that section's
   * transfer answer.
   *
   * Worked, not mastered. It exists so the seven foundation sections in each track's pathway can
   * take part in "what comes next", which they could not while they persisted nothing at all — a
   * resolver walking the seventeen-section order would otherwise stall on section one forever. It
   * feeds navigation and nothing else: no score, no mastery, no credit, no Practice progress, and
   * nothing in the shared critical-care envelope.
   *
   * Optional on purpose, and shaped exactly like `lastVisited`: envelopes written before this
   * field existed stay valid and load unchanged, so the storage key and `version: 2` did not have
   * to move.
   */
  completedFoundationSectionIds?: readonly string[]
}

export type SimulationAction =
  | { type: 'LOAD_SCENARIO'; scenarioId: string; mode?: SimulationMode }
  | { type: 'START_ACTIVITY' }
  | { type: 'TICK'; seconds?: number }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'STEP' }
  | { type: 'SET_SCREEN'; screen: ConsoleScreen }
  | { type: 'TOGGLE_LOCK' }
  | { type: 'SET_PUMP_MODE'; mode: PumpMode }
  | { type: 'ROTARY_DELTA'; delta: number }
  | { type: 'SET_RPM'; rpm: number }
  | { type: 'SET_FLOW_TARGET'; flow: number }
  | { type: 'SET_SWEEP'; sweep: number }
  | { type: 'SET_GAS_FIO2'; fio2: number }
  | { type: 'RESTORE_GAS_SOURCE' }
  | { type: 'RESTORE_AC_POWER' }
  | { type: 'TOGGLE_ZERO_FLOW' }
  | { type: 'TOGGLE_GLOBAL_OVERRIDE' }
  | { type: 'PRESS_SAFETY' }
  | { type: 'RELEASE_SAFETY' }
  | { type: 'ADJUST_LIMIT'; parameter: keyof PressureLimits; delta: number }
  | { type: 'TOGGLE_TIMER'; timerIndex: number }
  | { type: 'RESET_TIMER'; timerIndex: number }
  | { type: 'ACK_ALARM'; alarmId?: string }
  | { type: 'RESET_BUBBLE' }
  /**
   * Resume support after an air event, as one bounded transition.
   *
   * Deliberately not a clamp action and not the console reset. Past isolation, source correction
   * and de-airing, this module does not teach where clamp opening, pump restart and console reset
   * fall relative to one another: that choreography is device- and program-specific, and the order
   * this module used to teach walked the learner through both limbs open on a stopped centrifugal
   * pump. This bounded action stands in for the device- and program-specific resumption sequence;
   * it does not reproduce or teach that sequence. It moves the circuit from corrected-and-isolated
   * to safely running in one step, so that intermediate state is never rendered.
   */
  | { type: 'RESUME_SUPPORT_AFTER_BUBBLE' }
  | { type: 'TOGGLE_CIRCUIT_CLAMP'; limb: 'drainage' | 'return'; closed?: boolean }
  | { type: 'CORRECT_FAULT'; fault: FaultId }
  | { type: 'PERFORM_CHECK'; checkId: string }
  | { type: 'APPLY_CLINICAL_INTERVENTION'; interventionId: string }
  | { type: 'START_ECMO' }
  | {
      type: 'COMMIT_PREDICTION'
      goalId: string
      control: PredictionControl
      direction: PredictionDirection
    }
  | { type: 'COMMIT_REASSESSMENT'; answers: ReassessmentSubmission }
  | { type: 'REQUEST_HINT'; hintId: string }
  | { type: 'REVEAL_DEBRIEF' }
  | { type: 'TOGGLE_ALARM_AUDIO' }
  | { type: 'INJECT_FAULT'; fault: FaultId; eventId?: string }
  | { type: 'DISCONNECT_FLOW_SENSOR' }

export type ScenarioLookup = (scenarioId: string) => ScenarioDefinition | undefined

export type GuidedTarget = 'console' | 'circuit' | 'gas-panel' | 'patient-monitor' | 'trend-panel'

export type GuidedControlId =
  | 'cardiohelp-console'
  | 'cardiohelp-circuit-panel'
  | 'cardiohelp-gas-panel'
  | 'cardiohelp-patient-monitor'
  | 'cardiohelp-trend-panel'
  | 'cardiohelp-home-button'
  | 'cardiohelp-menu-button'
  | 'cardiohelp-alarm-list-button'
  | 'cardiohelp-screen-startup'
  | 'cardiohelp-screen-parameters'
  | 'cardiohelp-screen-blood'
  | 'cardiohelp-screen-transport'
  | 'cardiohelp-screen-interventions'
  | 'cardiohelp-screen-timers'
  | 'cardiohelp-pump-mode-rpm'
  | 'cardiohelp-pump-mode-lpm'
  | 'cardiohelp-rpm-control'
  | 'cardiohelp-sweep-control'
  | 'cardiohelp-fio2-control'
  | 'cardiohelp-circuit-check'
  | 'cardiohelp-restore-gas-source'
  | 'cardiohelp-reset-bubble'
  | 'cardiohelp-restore-ac-power'
  | 'cardiohelp-resume-support'
  | 'cardiohelp-clamp-drainage'
  | 'cardiohelp-clamp-return'

export type GuidedStepPhase =
  | 'orient'
  | 'observe'
  | 'interpret'
  | 'respond'
  | 'reassess'
  | 'transfer'

/**
 * Where the learner's hands go for a step.
 *
 * `simulator` — the step is completed by operating a control that exists on the simulated device,
 * circuit, gas panel, monitor or trend surface. The player focuses that panel and can highlight the
 * control on request.
 *
 * `task-pane` — the step is completed in the lesson pane itself, because what it does is a
 * statement about the *model* rather than about the device: advancing the simulation, loading a
 * scenario, finishing a walkthrough. Nothing on the simulator can satisfy it, so publishing a focus
 * target or offering to point at a control tells the learner to look for something that is not
 * there.
 */
export type GuidedStepInteraction = 'simulator' | 'task-pane'

/** The circuit surface a guided step reads its evidence from, when it has a preference. */
export type CircuitViewPreference = 'bedside' | 'diagnostic'

export interface GuidedWalkthroughStep {
  id: string
  phase: GuidedStepPhase
  target: GuidedTarget
  title: string
  instruction: string
  rationale: string
  actionLabel: string
  actions: readonly SimulationAction[]
  expectedResponse: readonly string[]
  /**
   * Defaults to `simulator`. Authored rather than inferred from the action list: two steps can
   * carry the same `STEP` action and still differ in whether the learner is meant to touch the
   * device, and only the author knows which.
   */
  interaction?: GuidedStepInteraction
  /**
   * The circuit view this step is read on, applied when the step is entered.
   *
   * A pressure-localization step is answered by comparing pVen, pInt, pArt and Δp, which the
   * pressure-zone map lays out side by side and the bedside 3D scene does not. Authored per step so
   * the circuit component never has to know a scenario id. Omitted means "leave the learner's
   * current view alone".
   */
  preferredCircuitView?: CircuitViewPreference
  /**
   * Marks this step as one the learner answers rather than performs, and names the scenario whose
   * authored prediction supplies the options.
   *
   * The step carries no `actions` of its own: the `COMMIT_PREDICTION` payload comes from whichever
   * authored choice the learner selects. A prepopulated action here would be the defect this field
   * replaces — a single button that submitted the scenario's own expectation whatever the learner
   * believed.
   */
  predictionScenarioId?: string
  /** A distinct authored scenario loaded when this transfer step becomes active. */
  transferScenarioId?: string
  /** Stable identifier used to audit that this is a real transfer variant. */
  transferVariantId?: string
  /** Scenario setup applied before the learner performs the transfer action. */
  transferSetupActions?: readonly SimulationAction[]
}

export interface GuidedLessonDefinition {
  id: string
  scenarioId: string
  supportMode: SupportMode
  title: string
  learningObjectives: readonly string[]
  steps: readonly GuidedWalkthroughStep[]
  /**
   * Teaching-arc position. An `integration` lesson is the track's capstone lesson and is the one
   * case where a Learn lesson may wrap a registered capstone scenario; the unseen assessment
   * capstone that uses the same scenario is unaffected.
   */
  curriculumStage?: CriticalCareCurriculumStage
}
