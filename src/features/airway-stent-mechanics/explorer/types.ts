import type { EvidenceReferenceId } from '../content/evidenceRegistry'
import type { StentGeometryBuilderId } from '../engine/learningLabTypes'

export const STENT_EXPLORER_STATION_IDS = [
  'architecture-lumen',
  'metal-architecture',
  'cough-motion',
  'curve-buckle',
  'migration',
  'mucus-obstruction',
  'granulation',
  'tumor-ingrowth-overgrowth',
  'fracture-cover-failure',
  'y-stent',
  'deploy-rescue',
] as const

export type StentExplorerStationId = (typeof STENT_EXPLORER_STATION_IDS)[number]

export type StentExplorerArchitectureId =
  | 'solid-silicone'
  | 'free-crossing-braid'
  | 'hook-cross-covered'
  | 'laser-cut-covered'
  | 'single-wire-knit-partial-cover'
  | 'balloon-expanded-metal'
  | 'silicone-y'
  | 'dynamic-y'
  | 'metallic-y'

export type StentExplorerViewMode = 'external' | 'cutaway' | 'endoscopic' | 'cross-section'

export interface StentExplorerArchitectureOption {
  coverage: 'solid-wall' | 'uncovered' | 'fully-covered' | 'partially-covered'
  expansionMechanism:
    | 'molded-passive'
    | 'self-expanding-superelastic'
    | 'balloon-expanded'
    | 'bifurcated-schematic'
  geometryBuilder?: StentGeometryBuilderId
  id: StentExplorerArchitectureId
  label: string
  construction: string
  loadPath: string
  material: string
  materialBehavior: 'elastomeric' | 'superelastic' | 'balloon-set' | 'bifurcated'
  topology: string
  visualCalibration: {
    axialCoupling: number
    bendGain: number
    ovalizationGain: number
    twistGain: number
  }
}

export interface StentExplorerPhase {
  id: string
  label: string
  instruction: string
  textEquivalent: string
}

export interface StentExplorerHotspot {
  id: string
  label: string
  description: string
}

export interface StentExplorerPredictionChoice {
  id: string
  label: string
  rationale: string
}

export interface StentExplorerPrediction {
  question: string
  instruction: string
  choices: readonly StentExplorerPredictionChoice[]
  bestChoiceId: string
}

export const STENT_MECHANICS_MODIFIER_IDS = [
  'wallOccupancy',
  'comparisonReveal',
  'motionAmplitude',
  'curvature',
  'endTracking',
  'airwayCompression',
  'branchProximity',
  'focalContact',
  'appositionLoss',
  'proximalDisplacement',
  'distalDisplacement',
  'landmarkTracking',
  'secretionBurden',
  'retentionPocket',
  'obstructionExtent',
  'endContact',
  'relativeMotion',
  'secretoryInfectiousContext',
  'biologicContext',
  'tumorIngrowth',
  'exposedEndIngrowth',
  'tumorOvergrowth',
  'coverFailure',
  'repeatedLoading',
  'fracture',
  'structuralHotspot',
  'saddleMismatch',
  'branchAngleMismatch',
  'distalOrificeCompromise',
  'posteriorMotion',
  'deployment',
  'incompleteExpansion',
  'inspectionReveal',
  'repositioningConstraint',
  'radialConstraint',
  'bendConstraint',
  'ovalConstraint',
  'constraintAmplitude',
  'coverInspection',
] as const

export type StentMechanicsModifierId = (typeof STENT_MECHANICS_MODIFIER_IDS)[number]

export type StentMechanicsModifiers = Readonly<Record<StentMechanicsModifierId, number>>

export interface StentExplorerModifierBinding {
  id: StentMechanicsModifierId
  /** Multiplies a normalized 0–1 control value before it is applied. */
  scale?: number
  /** Adds a normalized baseline before the scaled control value is applied. */
  baseline?: number
}

interface StentExplorerControlBase {
  architectureIds?: readonly StentExplorerArchitectureId[]
  id: string
  label: string
  description: string
}

export interface StentExplorerRangeControl extends StentExplorerControlBase {
  kind: 'range'
  defaultValue: number
  min: number
  max: number
  step: number
  minLabel: string
  maxLabel: string
  valueLabels: readonly {
    value: number
    label: string
  }[]
  modifiers: readonly StentExplorerModifierBinding[]
}

export interface StentExplorerToggleControl extends StentExplorerControlBase {
  kind: 'toggle'
  defaultValue: boolean
  offLabel: string
  onLabel: string
  modifiers: readonly StentExplorerModifierBinding[]
}

export interface StentExplorerPresetOption {
  architectureIds?: readonly StentExplorerArchitectureId[]
  id: string
  label: string
  description: string
  modifiers: Partial<Record<StentMechanicsModifierId, number>>
}

export interface StentExplorerPresetControl extends StentExplorerControlBase {
  kind: 'preset'
  defaultValue: string
  options: readonly StentExplorerPresetOption[]
}

export type StentExplorerControl =
  | StentExplorerRangeControl
  | StentExplorerToggleControl
  | StentExplorerPresetControl

export type StentExplorerControlValue = number | boolean | string

export type StentExplorerControlState = Readonly<Record<string, StentExplorerControlValue>>

export interface StentExplorerStation {
  id: StentExplorerStationId
  number: number
  category: 'foundation' | 'failure' | 'carina' | 'procedure'
  shortLabel: string
  title: string
  summary: string
  clinicalHook: string
  architectureOptions: readonly StentExplorerArchitectureOption[]
  defaultArchitectureId: StentExplorerArchitectureId
  controls: readonly StentExplorerControl[]
  phases: readonly StentExplorerPhase[]
  hotspots: readonly StentExplorerHotspot[]
  prediction: StentExplorerPrediction
  whatChanged: readonly string[]
  whyItMatters: readonly string[]
  inspect: readonly string[]
  conceptualResponse: readonly string[]
  evidenceRefs: readonly EvidenceReferenceId[]
  evidenceNote: string
  evidenceBoundary: string
  reducedMotionSummary: string
  clinicalReviewStatus: 'draft' | 'reviewed'
}

export interface StentExplorerCasePreset {
  id: string
  label: string
  summary: string
  stationIds: readonly StentExplorerStationId[]
  initialStationId: StentExplorerStationId
}

export interface StentExplorerPose {
  airwayCompression: number
  axialExcursion: number
  axialScale: number
  bend: number
  branchCompromise: number
  coverFailure: number
  deployment: number
  fracture: number
  granulation: number
  kink: number
  migration: number
  mucus: number
  posteriorMotion: number
  radialCompression: number
  tumorIngrowth: number
  tumorOvergrowth: number
}
