export const STENT_LESSON_IDS = [
  'indication',
  'clinical-job',
  'architecture-choice',
  'fit-behavior',
  'complications-surveillance',
  'assessment',
] as const

export type StentLessonId = (typeof STENT_LESSON_IDS)[number]

export const LEGACY_STENT_LESSON_IDS = [
  'orient',
  'architectures',
  'force-lab',
  'tissue-time',
  'evidence-decisions',
  'assessment',
] as const

export type LegacyStentLessonId = (typeof LEGACY_STENT_LESSON_IDS)[number]

export const STENT_LOAD_MODES = [
  'rest',
  'radial',
  'bend',
  'ovalization',
  'breathing',
  'cough',
  'deployment',
] as const

export type StentLoadMode = (typeof STENT_LOAD_MODES)[number]

export const STENT_ARCHITECTURE_IDS = [
  'studded-silicone',
  'dynamic-d-silicone',
  'silicone-y',
  'free-crossing-braid',
  'hook-cross-covered',
  'laser-cut-covered',
  'single-wire-knit-partial-cover',
] as const

export type StentArchitectureId = (typeof STENT_ARCHITECTURE_IDS)[number]

export type StentLabExperience =
  | 'clinical-case'
  | 'complication-explainer'
  | 'architecture-explorer'
  | 'engineering-deep-dive'
  | 'guided-force'
  | 'force-practice'

export interface StentLabExperienceProgress {
  completedIds: string[]
  complete: boolean
}

export type EvidenceSourceType =
  | 'clinical-guideline'
  | 'peer-reviewed'
  | 'regulatory'
  | 'manufacturer'
  | 'textbook-chapter'

export type EvidenceApplicability =
  | 'clinical-guidance'
  | 'airway-device-mechanics'
  | 'device-topology'
  | 'transferred-engineering'
  | 'curriculum-authoring'

export type EvidenceClaimScope =
  | 'clinical-guideline'
  | 'clinical-observational'
  | 'clinical-trial'
  | 'review-mechanistic'
  | 'airway-bench'
  | 'preclinical'
  | 'transferred-engineering'
  | 'regulatory-construction'
  | 'manufacturer-construction'
  | 'secondary-chapter'

export type EvidenceSupportLevel = 'explicit' | 'association' | 'conceptual-model'

export interface EvidenceReference {
  id: string
  citation: string
  url?: string
  doi?: string
  sourceType: EvidenceSourceType
  applicability: EvidenceApplicability
  claimScope: EvidenceClaimScope
  verifiedOn: string
  supportLevel: EvidenceSupportLevel
  sourcePages?: readonly string[]
  clinicalReviewStatus: 'draft' | 'reviewed'
  clinicalReviewNote?: string
  transferLimitation: string
}

export type StentExpansionMechanism = 'molded-passive' | 'self-expanding-superelastic'

export type StentCoverage =
  | 'integral-solid-wall'
  | 'uncovered'
  | 'fully-covered'
  | 'partially-covered'

export type StentGeometryBuilderId =
  | 'studded-cylinder'
  | 'dynamic-d-cylinder'
  | 'silicone-y'
  | 'free-crossing-helices'
  | 'hook-cross-captured-helices'
  | 'laser-cut-rings'
  | 'single-wire-knitted-loops'

export interface ArchitectureCapabilities {
  supportsBraidAngleControl: boolean
  supportsCoverInspection: boolean
  supportsDiameterRetention: boolean
  supportsLengthChange: boolean
  supportsTubularControls: boolean
  isBifurcated: boolean
  hasSlidingCrossings: boolean
}

export interface StentVisualCalibration {
  /** Relative visual coupling only; this is not a force or stiffness value. */
  axialCoupling: number
  /** Relative visual response only; this is not a torsional-force value. */
  twistGain: number
  /** Relative visual response only; this is not a bending-force value. */
  bendGain: number
  /** Relative visual response only; this is not a collapse-pressure value. */
  ovalizationGain: number
}

export interface StentArchitectureProfile {
  id: StentArchitectureId
  label: string
  shortLabel: string
  family: string
  brandedExample?: string
  material: string
  expansionMechanism: StentExpansionMechanism
  coverage: StentCoverage
  topologyLabel: string
  topologyDescription: string
  loadPath: string
  geometryBuilder: StentGeometryBuilderId
  supportedLoadModes: readonly StentLoadMode[]
  capabilities: ArchitectureCapabilities
  visualCalibration: StentVisualCalibration
  teachingPoints: readonly string[]
  strengths: readonly string[]
  tradeoffs: readonly string[]
  limitations: readonly string[]
  clinicalConsiderations: ClinicalArchitectureConsiderations
  evidenceRefs: readonly string[]
}

export interface ClinicalArchitectureConsiderations {
  commonRoles: readonly string[]
  deploymentConsiderations: readonly string[]
  removalConsiderations: readonly string[]
  tissueInterfaceConsiderations: readonly string[]
  secretionConsiderations: readonly string[]
  fitConsiderations: readonly string[]
  failureModesToAnticipate: readonly string[]
  caseExclusions?: readonly string[]
  teachingOnly?: boolean
}

export type ClinicalDecisionDomain =
  | 'indication'
  | 'mechanical-job'
  | 'architecture'
  | 'fit'
  | 'complication'
  | 'surveillance'

export type PhysicsLensPreset =
  | 'residual-extrinsic-load'
  | 'curve-end-loading'
  | 'eccentric-ovalization'
  | 'bifurcation-mismatch'
  | 'cough-micromotion'
  | 'coverage-interface'

export interface ClinicalCaseFinding {
  id: string
  label: string
  value: string
  emphasis?: 'normal' | 'important' | 'warning'
}

export interface ClinicalDecisionOption {
  id: string
  label: string
  rationale: string
  domains: readonly ClinicalDecisionDomain[]
}

export interface ClinicalDecisionPrompt {
  id: string
  question: string
  instruction?: string
  options: readonly ClinicalDecisionOption[]
  correctChoiceId: string
  evidenceRefs: readonly string[]
}

export interface PhysicsLensConfig {
  preset: PhysicsLensPreset
  architectureIds: readonly StentArchitectureId[]
  loadMode: StentLoadMode
  clinicalQuestion: string
  observationPrompts: readonly string[]
  debrief: string
  evidenceBoundary: string
  evidenceRefs: readonly string[]
}

export interface StentClinicalCase {
  id: string
  lessonId: StentLessonId
  title: string
  stem: string
  findings: readonly ClinicalCaseFinding[]
  decisions: readonly ClinicalDecisionPrompt[]
  physicsLens?: PhysicsLensConfig
  finalTakeaway: string
  evidenceRefs: readonly string[]
  clinicalReviewStatus: 'draft' | 'reviewed'
  /** Defaults to true. Optional contrast cases must opt out explicitly. */
  requiredForLesson?: boolean
  /** No-device cases use a disease-reassessment plan instead of device surveillance. */
  surveillancePlanMode?: 'device' | 'no-device'
}

export interface ComplicationPathway {
  id:
    | 'granulation'
    | 'mucus'
    | 'migration'
    | 'ingrowth'
    | 'infection'
    | 'structural'
    | 'cover-failure'
    | 'malposition'
    | 'recurrent-obstruction'
  label: string
  recognitionPatterns: readonly string[]
  plausibleContributors: readonly string[]
  contributorDomains: readonly ('mechanical' | 'infectious-secretory' | 'biologic-time')[]
  reassessmentQuestions: readonly string[]
  responseDomains: readonly string[]
  evidenceRefs: readonly string[]
}

export interface LoadFrame {
  mode: StentLoadMode
  /** Normalized animation position after clamping to 0..1. */
  progress: number
  radialScaleX: number
  radialScaleZ: number
  axialScale: number
  bendRadians: number
  twistRadians: number
  axialOffset: number
  /** Relative to the unloaded schematic, or null when the topology does not support this metric. */
  normalizedDiameterRetention: number | null
  /** Fractional length change from the unloaded schematic, or null when not meaningful. */
  normalizedLengthChange: number | null
  caption: string
}

export interface BraidKinematicsInput {
  initialDiameter: number
  initialLength: number
  initialBraidAngleDeg: number
  targetDiameter: number
}

export interface BraidKinematicsResult {
  targetDiameter: number
  targetLength: number
  targetBraidAngleDeg: number
  normalizedDiameterRetention: number
  normalizedLengthChange: number
  wirePathLength: number
  turnCount: number
}

export interface AnimationProgressInput {
  currentProgress: number
  deltaSeconds: number
  isPlaying: boolean
  speed?: number
  reducedMotion?: boolean
}

export interface LearningChoice {
  id: string
  label: string
  rationale?: string
}

export interface GuidedForceScene {
  id: string
  title: string
  shortLabel: string
  prompt: string
  mode: StentLoadMode
  teachingCue: string
  evidenceRefs: readonly string[]
}

export interface ForceLabMission {
  id: string
  title: string
  stem: string
  task: string
  correctLoadMode: StentLoadMode
  requiredArchitectureIds: readonly StentArchitectureId[]
  choices: readonly Required<LearningChoice>[]
  correctChoiceId: string
  explanation: string
  evidenceRefs: readonly string[]
}

export interface PredictionPrompt {
  id: string
  prompt: string
  choices: readonly LearningChoice[]
  correctChoiceId: string
  revealTitle: string
  reveal: string
  evidenceRefs: readonly string[]
}

export interface CheckpointPrompt {
  id: string
  prompt: string
  choices: readonly Required<LearningChoice>[]
  correctChoiceId: string
  explanation: string
  evidenceRefs: readonly string[]
}

export interface LearningCard {
  id: string
  title: string
  body: string
  takeaway?: string
  evidenceRefs?: readonly string[]
}

export interface LearningSection {
  id: string
  title: string
  lead?: string
  body: readonly string[]
  cards?: readonly LearningCard[]
  evidenceRefs?: readonly string[]
}

interface StentLessonBase {
  id: LegacyStentLessonId
  step: number
  eyebrow: string
  title: string
  summary: string
  objectives: readonly string[]
  sections: readonly LearningSection[]
}

export interface InstructionalLessonCopy extends StentLessonBase {
  kind: 'instructional'
  id: Exclude<LegacyStentLessonId, 'assessment'>
  prediction: PredictionPrompt
  checkpoint: CheckpointPrompt
}

export type AssessmentChoice = Required<LearningChoice>

export interface AssessmentItem {
  id: string
  stem: string
  prompt: string
  choices: readonly AssessmentChoice[]
  correctChoiceId: string
  explanation: string
  evidenceRefs: readonly string[]
}

export interface AssessmentLessonCopy extends StentLessonBase {
  kind: 'assessment'
  id: 'assessment'
  masteryThreshold: number
  items: readonly AssessmentItem[]
}

export type StentLessonCopy = InstructionalLessonCopy | AssessmentLessonCopy

export interface StentModuleCopy {
  title: string
  subtitle: string
  audience: string
  estimatedMinutes: number
  disclaimer: string
  comparisonModelNote: string
  evidenceLimitations: readonly string[]
  lessons: readonly StentLessonCopy[]
}

export interface ObstructionMorphology {
  id: 'intrinsic' | 'extrinsic' | 'mixed' | 'dynamic'
  label: string
  visualCue: string
  mechanicalProblem: string
  decisionQuestion: string
  evidenceRefs: readonly string[]
}

export interface TissueMechanism {
  id: 'pressure' | 'edge' | 'shear' | 'ingrowth' | 'mucus' | 'fatigue'
  label: string
  mechanism: string
  consequence: string
  inspectionQuestion: string
  evidenceRefs: readonly string[]
}

export interface ForceTaxonomyItem {
  id: 'cof' | 'rrf' | 'radial-stiffness' | 'contact-pressure' | 'hysteresis'
  term: string
  definition: string
  interpretationLimit: string
  evidenceRefs: readonly string[]
}

export interface GinaDumonBenchDatum {
  id: 'migration' | 'compression' | 'flexibility'
  metric: string
  dumon: string
  gina: string
  method: string
  evidenceRefs: readonly string[]
}

export interface StentAssessmentProgress {
  attempts: number
  lastScore: number | null
  lastTotal: number | null
  bestPercent: number | null
  mastery: boolean
}

export interface StentCaseProgress {
  caseId: string
  committedDecisionIds: string[]
  revisedDecisionIds: string[]
  completedInteractionIds: string[]
  observationCommitmentIds: string[]
  complicationSelectionIds: string[]
  outcomeStateIds: string[]
  surveillancePlanCommitted: boolean
  complete: boolean
}

export interface StentProgressState {
  version: 3
  lastLessonId: StentLessonId
  lastCaseId: string | null
  completedLessonIds: StentLessonId[]
  completedOptionalLabIds: string[]
  caseProgress: Record<string, StentCaseProgress>
  assessment: StentAssessmentProgress
  migratedFromV1?: boolean
  migratedFromV2?: boolean
}

export interface LegacyStentProgressStateV2 {
  version: 2
  lastLessonId: StentLessonId
  completedLessonIds: StentLessonId[]
  completedOptionalLabIds: string[]
  assessment: StentAssessmentProgress
  migratedFromV1?: boolean
}

export interface LegacyStentProgressStateV1 {
  version: 1
  lastLessonId: LegacyStentLessonId
  completedLessonIds: LegacyStentLessonId[]
  assessment: {
    attempts: number
    lastScore: number | null
    bestScore: number | null
    mastery: boolean
  }
}

export interface StentProgressStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function isStentLessonId(value: unknown): value is StentLessonId {
  return typeof value === 'string' && (STENT_LESSON_IDS as readonly string[]).includes(value)
}

export function isLegacyStentLessonId(value: unknown): value is LegacyStentLessonId {
  return typeof value === 'string' && (LEGACY_STENT_LESSON_IDS as readonly string[]).includes(value)
}

export function isStentLoadMode(value: unknown): value is StentLoadMode {
  return typeof value === 'string' && (STENT_LOAD_MODES as readonly string[]).includes(value)
}

export function isStentArchitectureId(value: unknown): value is StentArchitectureId {
  return typeof value === 'string' && (STENT_ARCHITECTURE_IDS as readonly string[]).includes(value)
}
