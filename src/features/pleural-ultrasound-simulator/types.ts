/**
 * Pleural-typed view over the shared thoracic ultrasound simulator engine.
 *
 * The pleural feature was the prototype the shared engine was extracted from;
 * these aliases keep every historical type name stable (and the existing test
 * suite unchanged) while the implementations live in
 * `@/features/thoracic-ultrasound-simulator`.
 */
import type { EffusionPattern } from '@/features/pleural-ultrasound/engine/types'
import type {
  FrameAtlasTolerance,
  FrameGeneratorSource,
  FrameReviewStatus,
  LabelBounds,
  NeedlePathAssessment as ThoracicNeedlePathAssessment,
  ThoracicFrameMetrics,
  ThoracicProbeState,
  VolumeGeometry,
} from '@/features/thoracic-ultrasound-simulator/types'

export type { Vec3, LabelBounds } from '@/features/thoracic-ultrasound-simulator/types'

export type PleuralTissueLabel =
  | 'background'
  | 'skin'
  | 'subcutaneousTissue'
  | 'intercostalMuscle'
  | 'rib'
  | 'lung'
  | 'atelectaticLung'
  | 'pleuralFluid'
  | 'septation'
  | 'debris'
  | 'diaphragm'
  | 'liver'
  | 'spleen'

export type PleuralLabelCode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export type PleuralVolumeGeometry = VolumeGeometry

export type PleuralProbeState = ThoracicProbeState

export type PleuralAtlasGeneratorSource = FrameGeneratorSource

export type PleuralAtlasReviewStatus = FrameReviewStatus

export type PleuralFrameAtlasTolerance = FrameAtlasTolerance

export interface PleuralFrameAtlasEntry {
  id: string
  label: string
  description: string
  imageUrl: string
  maskUrl?: string
  probe: PleuralProbeState
  metrics: UltrasoundFrameMetrics
  groundTruthPattern: EffusionPattern
  generator: {
    source: PleuralAtlasGeneratorSource
    name: string
    version?: string
    createdAt?: string
    sourceUrls?: string[]
    notes?: string[]
  }
  reviewStatus: PleuralAtlasReviewStatus
  reviewer?: string
  reviewedAt?: string
  educationalUse: string
  tags: string[]
}

export interface PleuralFrameAtlas {
  selectionTolerance: Partial<PleuralFrameAtlasTolerance>
  entries: PleuralFrameAtlasEntry[]
  notes?: string[]
}

export interface PleuralSimulatorCase {
  id: string
  name: string
  description: string
  safetyLabel: string
  meshUrl: string
  probeModelUrl?: string
  labelmapUrl: string
  labelmapFormat: 'uint8-single-label'
  labels: Record<string, PleuralTissueLabel>
  labelCounts: Record<string, number>
  labelBoundsLpsMm: Partial<Record<PleuralTissueLabel, LabelBounds>>
  plusToolkit?: PlusToolkitIntegrationPlan
  source: {
    segmentationFileName: string
    meshFileName: string
    originalSegmentationFormat: string
    sourceSizeXyz: [number, number, number]
    sourceLayerCount: number
    sourceSpace: string
    sourcePolicy: string
  }
  volume: PleuralVolumeGeometry
  probeDefaults: PleuralProbeState
  frameAtlas?: PleuralFrameAtlas
  objectives: string[]
  groundTruthPattern: EffusionPattern
}

export interface PlusToolkitIntegrationPlan {
  status: 'planned-offline-frame-generation'
  simulatorDevice: 'UsSimulator'
  recommendedMode: 'offline-frame-cache'
  sourceUrls: string[]
  requiredSurfaceModels: string[]
  notes: string[]
}

export interface PleuralVolume {
  data: Uint8Array
  geometry: PleuralVolumeGeometry
  labels: Record<string, PleuralTissueLabel>
}

export type UltrasoundFrameMetrics = ThoracicFrameMetrics

export type NeedlePathAssessment = ThoracicNeedlePathAssessment

export interface ProbeScore {
  safeWindow: boolean
  largestPocketFound: boolean
  avoidsRibShadow: boolean
  avoidsDiaphragm: boolean
  avoidsSolidOrgan: boolean
  patternClassificationCorrect: boolean | null
  needleTrajectorySafe: boolean
  summary: string
}
