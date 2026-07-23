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

export interface CircuitState {
  bloodFlow: number
  pVen: number
  pInt: number
  pArt: number
  pAux: number | null
  deltaP: number
  tVen: number
  tArt: number
  svo2: number
  hemoglobin: number
  hematocrit: number
  preOxygenatorSaturation: number
  postOxygenatorSaturation: number
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

export interface ClinicalInterventionRecord {
  id: string
  interventionId: string
  label: string
  effect: ClinicalInterventionEffect
  response: string
  time: number
}

export interface ClinicalRuntime {
  supportStatus: ClinicalSupportStatus
  trajectory: ClinicalTrajectory
  appliedInterventions: readonly ClinicalInterventionRecord[]
  revealedFindings: readonly string[]
  lastResponse: string | null
}

export interface TrendSample {
  time: number
  flow: number
  pVen: number
  pInt: number
  pArt: number
  deltaP: number
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
  scenarioId: string
  family: ScenarioFamily
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
  timedFaults: readonly TimedFault[]
  allowedActions: readonly SimulationAction['type'][]
  objectives: readonly ScenarioObjective[]
  expectation: ScenarioExpectation
  assessmentPolicy?: ScenarioAssessmentPolicy
  reassessment?: ScenarioReassessmentDefinition
  hints?: readonly ScenarioHint[]
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
  sourceClass: 'manufacturer' | 'clinical-guidance' | 'textbook' | 'educational-model'
  title: string
  citation: string
  pages?: string
  url?: string
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
}

export type SimulationAction =
  | { type: 'LOAD_SCENARIO'; scenarioId: string; mode?: SimulationMode }
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
  | 'cardiohelp-clamp-drainage'
  | 'cardiohelp-clamp-return'

export type GuidedStepPhase =
  | 'orient'
  | 'observe'
  | 'interpret'
  | 'respond'
  | 'reassess'
  | 'transfer'

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
}
