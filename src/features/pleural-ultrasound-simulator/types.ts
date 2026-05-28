import type { EffusionPattern } from '@/features/pleural-ultrasound/engine/types'

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

export type Vec3 = [number, number, number]

export interface LabelBounds {
  min: [number, number, number]
  max: [number, number, number]
  voxels: number
}

export interface PleuralVolumeGeometry {
  sizeXyz: [number, number, number]
  sourceSizeXyz: [number, number, number]
  strideXyz: [number, number, number]
  spacingXyzMm: [number, number, number]
  originLpsMm: [number, number, number]
  coordinateSystem: 'LPS'
}

export interface PleuralProbeState {
  lateralMm: number
  posteriorMm: number
  craniocaudalMm: number
  tiltDeg: number
  rotationDeg: number
  depthCm: number
  gain: number
  dynamicRangeDb: number
  sectorAngleDeg: number
  needleAngleDeg: number
}

export interface PleuralSimulatorCase {
  id: string
  name: string
  description: string
  safetyLabel: string
  meshUrl: string
  labelmapUrl: string
  labelmapFormat: 'uint8-single-label'
  labels: Record<string, PleuralTissueLabel>
  labelCounts: Record<string, number>
  labelBoundsLpsMm: Partial<Record<PleuralTissueLabel, LabelBounds>>
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
  objectives: string[]
  groundTruthPattern: EffusionPattern
}

export interface PleuralVolume {
  data: Uint8Array
  geometry: PleuralVolumeGeometry
  labels: Record<string, PleuralTissueLabel>
}

export interface UltrasoundFrameMetrics {
  maxFluidPocketMm: number
  meanFluidPocketMm: number
  fluidBeamFraction: number
  ribShadowBeamFraction: number
  diaphragmSeen: boolean
  lungSeen: boolean
  solidOrganSeen: boolean
  centralNeedle: NeedlePathAssessment
}

export interface NeedlePathAssessment {
  ribHit: boolean
  diaphragmHit: boolean
  solidOrganHit: boolean
  lungHit: boolean
  fluidRunMm: number
  firstFluidDepthMm: number | null
  safeWindow: boolean
}

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
