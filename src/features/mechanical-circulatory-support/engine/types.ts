import type { CriticalCareCurriculumStage } from '@/features/learning-module/activity/types'

import type {
  CirculationCompartmentState,
  CirculationParameters,
  MechanicalSupportEffect,
} from '@/features/hemodynamics-core'

export type McsDeviceKind = 'iabp' | 'impella' | 'lvad'
export type McsModuleSection = 'learn' | 'practice' | 'assess'
export type McsScenarioKind = 'practice' | 'capstone'
export type McsScenarioPhase = 'inspect' | 'predict' | 'adjust' | 'observe' | 'reassess' | 'debrief'
export type McsRhythm = 'sinus' | 'atrial-fibrillation' | 'paced'

export interface McsPatientState {
  heartRateBpm: number
  rhythm: McsRhythm
  preloadPercent: number
  systemicVascularResistanceDynSecCm5: number
  leftVentricularContractility: number
  rightVentricularContractility: number
  pulmonaryVascularResistanceWU: number
  peepCmH2O: number
  aorticInsufficiencySeverity: number
  tamponade: boolean
}

export interface IabpDeviceState {
  kind: 'iabp'
  running: boolean
  assistRatio: 1 | 2 | 3
  triggerSource: 'ecg' | 'pressure' | 'internal'
  inflationOffsetMs: number
  deflationOffsetMs: number
}

export type ImpellaSide = 'left' | 'right'
export type ImpellaLeftVariant = 'cp' | '55'
export type ImpellaPurgeState = 'normal' | 'high-pressure' | 'low-pressure'
export type ImpellaLeftPosition = 'correct' | 'too-deep' | 'too-shallow'
export type ImpellaRightPosition =
  | 'correct'
  | 'inlet-too-high'
  | 'outlet-too-proximal'
  | 'too-distal'

export interface ImpellaLeftPumpState {
  enabled: boolean
  variant: ImpellaLeftVariant
  running: boolean
  performanceLevel: number
  position: ImpellaLeftPosition
  purgeState: ImpellaPurgeState
}

export interface ImpellaRightPumpState {
  enabled: boolean
  variant: 'rp'
  running: boolean
  performanceLevel: number
  position: ImpellaRightPosition
  purgeState: ImpellaPurgeState
}

export interface ImpellaDeviceState {
  kind: 'impella'
  left: ImpellaLeftPumpState
  right: ImpellaRightPumpState
}

export interface LvadDeviceState {
  kind: 'lvad'
  running: boolean
  speedRpm: number
  speedChangeAuthorized: boolean
  powerConnected: boolean
  controllerFault: boolean
  suspectedPumpThrombosis: boolean
}

export type McsDeviceState = IabpDeviceState | ImpellaDeviceState | LvadDeviceState

export interface McsAlarm {
  id: string
  label: string
  priority: 'advisory' | 'warning' | 'critical'
  active: boolean
  explanation: string
}

export interface McsDerivedMetrics {
  nativeFlowLMin: number
  leftDeviceFlowLMin: number
  rightDeviceFlowLMin: number
  pumpBalanceLMin: number
  /**
   * Backward-compatible systemic pump-flow signal. For Impella this is left-pump flow only;
   * right-pump flow is deliberately not added to systemic output.
   */
  deviceFlowLMin: number
  effectiveSystemicFlowLMin: number
  recirculatingFlowLMin: number
  mapMmHg: number
  pulsePressureMmHg: number
  rapMmHg: number
  pcwpMmHg: number
  lvedpMmHg: number
  lvedvMl: number
  papSystolicMmHg: number
  papDiastolicMmHg: number
  papi: number
  cardiacPowerOutputW: number
  svo2Percent: number
  aorticValveOpening: boolean
  timingQualityPercent: number | null
  pumpPowerW: number | null
  pulsatilityIndex: number | null
}

export interface McsWaveformSample {
  time: number
  ecgMv: number
  arterialMmHg: number
  lvMmHg: number
  papMmHg: number
  cvpMmHg: number
  pcwpMmHg: number
  lvVolumeMl: number
  deviceFlowLMin: number
  assistedBeat: boolean
}

export interface McsTrendSample {
  time: number
  mapMmHg: number
  effectiveFlowLMin: number
  deviceFlowLMin: number
  leftDeviceFlowLMin: number
  rightDeviceFlowLMin: number
  pcwpMmHg: number
  rapMmHg: number
}

export interface McsDeviceProfile {
  id: string
  kind: McsDeviceKind
  displayName: string
  category: string
  jurisdiction: 'US'
  labelingRevision: string
  softwareOrModelRevision: string
  reviewedAt: string
  mechanism: string
  controlSummary: string
  controlBounds: readonly McsControlBound[]
  alarmDefinitions: readonly McsAlarmDefinition[]
  modelLimitations: readonly string[]
  sourceIds: readonly string[]
  educationalModelVersion: string
}

export interface McsControlBound {
  id: string
  label: string
  minimum?: number
  maximum?: number
  unit?: string
  allowedValues?: readonly (string | number | boolean)[]
  authorization?: string
}

export interface McsAlarmDefinition {
  id: string
  label: string
  priority: McsAlarm['priority']
  interpretation: string
}

export interface McsSource {
  id: string
  title: string
  citation: string
  sourceType:
    | 'guideline'
    | 'manufacturer'
    | 'fda-labeling'
    | 'fda-safety-notice'
    | 'reference-package'
    | 'educational-model'
  year: number
  url?: string
  suppliedFilename?: string
  intendedUse: string
  limitation?: string
}

export interface McsLessonStep {
  id: string
  title: string
  instruction: string
  rationale: string
  targetActionId?: string
}

export interface McsLessonDefinition {
  id: string
  version: string
  device: McsDeviceKind | 'shared'
  /** Teaching-arc position, mirroring the activity catalog's `curriculumStage`. */
  curriculumStage: CriticalCareCurriculumStage
  title: string
  summary: string
  objectives: readonly string[]
  steps: readonly McsLessonStep[]
  sourceIds: readonly string[]
}

export interface McsPredictionOption {
  id: string
  label: string
}

export interface McsMetricCriterion {
  metric: keyof McsDerivedMetrics
  operator: 'at-least' | 'at-most' | 'equals'
  value: number | boolean
  label: string
}

export interface McsScenarioDefinition {
  id: string
  version: string
  kind: McsScenarioKind
  device: McsDeviceKind
  title: string
  shortTitle: string
  presentation: string
  learningObjectives: readonly string[]
  initialPatient: McsPatientState
  initialDevice: McsDeviceState
  hiddenFaultIds: readonly string[]
  permittedActionIds: readonly string[]
  criticalErrorIds: readonly string[]
  predictionPrompt: string
  predictionOptions: readonly McsPredictionOption[]
  correctPredictionId: string
  requiredActionIds: readonly string[]
  successCriteria: readonly McsMetricCriterion[]
  guidedPrompt: string
  debrief: readonly string[]
  sourceIds: readonly string[]
  evidenceSourceIds: readonly string[]
}

export interface McsScoreBreakdown {
  inspection: number
  prediction: number
  management: number
  response: number
  reassessment: number
  total: number
}

export interface McsSimulationState {
  section: McsModuleSection
  deviceKind: McsDeviceKind
  scenario: McsScenarioDefinition | null
  scenarioPhase: McsScenarioPhase
  patient: McsPatientState
  device: McsDeviceState
  parameters: CirculationParameters
  compartments: CirculationCompartmentState
  supportEffect: MechanicalSupportEffect
  metrics: McsDerivedMetrics
  alarms: readonly McsAlarm[]
  waveforms: readonly McsWaveformSample[]
  trends: readonly McsTrendSample[]
  timeSeconds: number
  seed: number
  inspectedIds: readonly string[]
  actionIds: readonly string[]
  selectedPredictionId: string | null
  predictionCommitted: boolean
  reassessed: boolean
  escalated: boolean
  criticalErrors: readonly string[]
  responseMessage: string
  causalExplanation: string
  score: McsScoreBreakdown | null
  completed: boolean
}

export type McsPatientControl =
  | 'heartRateBpm'
  | 'preloadPercent'
  | 'systemicVascularResistanceDynSecCm5'
  | 'leftVentricularContractility'
  | 'rightVentricularContractility'
  | 'pulmonaryVascularResistanceWU'
  | 'peepCmH2O'
  | 'aorticInsufficiencySeverity'

export type McsAction =
  | { type: 'TICK'; seconds: number }
  | { type: 'SELECT_DEVICE'; device: McsDeviceKind }
  | { type: 'OPEN_STUDIO'; device: McsDeviceKind }
  | { type: 'LOAD_SCENARIO'; scenario: McsScenarioDefinition }
  | { type: 'RESET'; seed?: number }
  | { type: 'INSPECT'; id: string }
  | { type: 'SELECT_PREDICTION'; id: string }
  | { type: 'COMMIT_PREDICTION' }
  | { type: 'SET_RHYTHM'; rhythm: McsRhythm }
  | { type: 'SET_PATIENT_CONTROL'; control: McsPatientControl; value: number }
  | { type: 'SET_TAMPONADE'; active: boolean }
  | {
      type: 'SET_IABP_CONTROL'
      control:
        | 'running'
        | 'assistRatio'
        | 'triggerSource'
        | 'inflationOffsetMs'
        | 'deflationOffsetMs'
      value: boolean | number | string
    }
  | {
      type: 'SET_IMPELLA_CONTROL'
      side?: ImpellaSide
      control: 'running' | 'performanceLevel' | 'position' | 'purgeState'
      value: boolean | number | string
    }
  | {
      type: 'SET_IMPELLA_CONFIGURATION'
      control: 'leftEnabled' | 'leftVariant' | 'rightEnabled'
      value: boolean | ImpellaLeftVariant
    }
  | {
      type: 'SET_LVAD_CONTROL'
      control:
        | 'running'
        | 'speedRpm'
        | 'speedChangeAuthorized'
        | 'powerConnected'
        | 'controllerFault'
        | 'suspectedPumpThrombosis'
      value: boolean | number
    }
  | { type: 'ESCALATE' }
  | { type: 'REASSESS' }
  | { type: 'COMPLETE' }
  /**
   * Forget which actions have been taken, and nothing else. A lesson's transfer patient is built
   * with the same controls the learner is then asked to move, so the record of the build must not
   * count as the learner's work. Learn-only; no scored surface dispatches it.
   */
  | { type: 'CLEAR_ACTION_LOG' }
