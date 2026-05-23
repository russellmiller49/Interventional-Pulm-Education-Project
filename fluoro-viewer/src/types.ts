import type { Object3D } from 'three'

export type Vec2 = [number, number]
export type Vec3 = [number, number, number]
export type Mat3 = [Vec3, Vec3, Vec3]

export interface FluoroConfig {
  units: 'mm'
  coordinateSystem: 'LPS'
  isocenter_mm: Vec3
  source_to_isocenter_mm: number
  source_to_detector_mm: number
  detector_pixels: [number, number]
  pixel_pitch_mm: number
  asset_base_url?: string
  default_view: {
    rao_lao_deg: number
    cranial_caudal_deg: number
  }
  overlay_calibration?: OverlayCalibration
}

export interface OverlayCalibration {
  method: 'centerline-carina'
  carina_lps_mm: Vec3
  target_detector_percent: Vec2
  source_curves?: string[]
  reference_translation_mm?: Vec3
  note?: string
}

export interface PreparedSegment {
  label: string
  displayLabel: string
  color: string
  colorRgb: [number, number, number]
  groupKey: string
  anchor: Vec3
  meshSamplePointsLps?: Float32Array
  object: Object3D
}

export interface AppState {
  raoLao: number
  cranialCaudal: number
  useDts: boolean
  useWireframe: boolean
  showLabels: boolean
  overlayMode: OverlayMode
  overlayOpacity: number
  activeGroups: Set<string>
}

export interface RenderStats {
  visibleSegments: number
}

export type OverlayMode = 'off' | 'surface' | 'wireframe' | 'centerline' | 'labels'

export type CtAxis = 'axial' | 'coronal' | 'sagittal'

export interface DrrAtlasFrame {
  id: string
  raoLaoDeg: number
  cranialCaudalDeg: number
  imageUrl: string
  thicknessProxy: number
  backend?: string
  imageOrientation?: string
  toneMap?: string
}

export interface DrrBlendFrame {
  frame: DrrAtlasFrame
  weight: number
}

export interface DrrAtlasProvenance {
  backend: string
  sourceBackendReported?: string
  detectorPixels: [number, number]
  pixelValueRange?: [number, number]
  imageOrientation?: string
  toneMap?: string
  ingestManifest?: string
  publicPngChecksums?: string
  vmExportChecksums?: string | null
  note?: string
}

export interface CtSliceFrame {
  index: number
  positionMm: number
  imageUrl: string
}

export interface CtSliceAxisConfig {
  label: string
  defaultIndex: number
  frames: CtSliceFrame[]
}

export interface CtWindowPreset {
  id: string
  label: string
  low: number
  high: number
}

export interface FluoroLesson {
  id: string
  title: string
  objective: string
  task: string
}

export interface FluoroCaseManifest {
  id: string
  title: string
  version: string
  safetyLabel: string
  description: string
  sourcePolicy: string
  assetBaseUrl: string
  geometry: FluoroConfig
  assets: {
    airwayGlb: string
    airwayFullGlb?: string
    airwaySegmentsGlb?: string
    airwayGraphJson?: string
    scopePathGlb?: string
    ctVolumePreview?: string
    virtualCathLabManifest?: string
    virtualCathLabSceneManifest?: string
    virtualCathLabFrontalImage?: string | null
    assetTransforms?: {
      airway?: AssetTransform
    }
    dracoBaseUrl: string
    centerlineJson: string
    segmentMetadataJson: string
  }
  ctVolume?: CtVolumePreview
  interaction?: FluoroInteractionDefaults
  virtualCathLab?: VirtualCathLabReference
  ctSlices: {
    windowPresets: CtWindowPreset[]
    axes: Record<CtAxis, CtSliceAxisConfig>
  }
  drrAtlas?: {
    grid: {
      raoLaoAngles: number[]
      cranialCaudalAngles: number[]
    }
    provenance: DrrAtlasProvenance
    frames: DrrAtlasFrame[]
  }
  volumeDrr?: VolumeDrrAsset
  cArm?: CArmManifest
  scopeAnimation?: ScopeAnimationAsset
  lessons: FluoroLesson[]
}

export interface VolumeDrrAsset {
  volumeUri: string
  format: 'uint8-r8'
  sizeXyz: [number, number, number]
  spacingXyzMm: Vec3
  originLps: Vec3
  directionLps: number[]
  huRange: [number, number]
  sampleDomain: 'normalized-r8'
  baselineMas?: number
  recommendedSteps?: {
    interactive: number
    full: number
  }
  recommendedRenderScale?: {
    interactive: number
    full: number
  }
  huScale?: { slope: number; offset: number }
  calibrationProjection?: SlicerFrontalProjection
  transferFunction?: {
    scalarOpacity: Array<{ x: number; y: number }>
    rgbTransferFunction: Array<{ x: number; color: [number, number, number] }>
  }
}

export interface CArmManifest {
  gantryGlbUri?: string
  animationGlbUri?: string
  coordinateSystem: 'LPS' | string
  sadMm?: number
  sidMm?: number
  detectorPixelPitchMm?: number
  detectorPixels?: [number, number]
  detectorSizeMm?: Vec2
  rest?: {
    armLDeg?: number
    armPDeg?: number
    armCDeg?: number
    detectorRotationDeg?: number
    tableShiftMm?: Vec3
  }
  transforms?: Array<{
    id: string
    parentId?: string
    matrixLpsFromParent: number[]
  }>
  sad?: number
  sid?: number
}

export interface ScopeAnimationAsset {
  polylineJsonUri: string
  defaultRouteId: 'bezier-demo'
  tubeRadiusMm?: number
  tubeColor?: string
}

export interface ScopePathPolyline {
  schema: 'fluoroview_scope_path/v1' | string
  coordinateSystem: 'LPS' | string
  units: 'mm' | string
  source: string
  defaultRouteId: 'bezier-demo' | string
  pointsLps: Vec3[]
  lengthMm: number
  polyline?: Vec3[]
}

export interface VirtualCathLabReference {
  source: string
  status: 'reference-export' | string
  manifestUrl: string
  sceneManifestUrl?: string
  frontalImageUrl?: string | null
  frontalDetectorPixels?: [number, number] | null
  frontalDetectorSizeMm?: Vec2 | null
  frontalPixelSpacingMm?: Vec2 | null
  coordinateSystem?: 'RAS' | string
  sourceImageIncludesModel?: boolean
  cArm?: VirtualCathLabCArm
  frontalProjection?: SlicerFrontalProjection
  renderingPreset?: {
    sourceFileName?: string
    effectiveRange?: Vec2
    scalarOpacity?: unknown[]
    rgbTransferFunction?: unknown[]
  } | null
  note?: string
}

export interface VirtualCathLabCArm {
  deviceClassId?: string
  detectorPixelSizeMm?: number
  sourceToImageDistanceMm?: number
  frontalArmAngleLDeg?: number
  frontalArmAnglePDeg?: number
  frontalArmAngleCDeg?: number
  frontalArmDetectorRotationDeg?: number
  patientSpinDeg?: number
  tableShiftLateralMm?: number
  tableShiftLongitudinalMm?: number
  tableShiftVerticalMm?: number
  volumeRenderingPreset?: string
}

export interface SlicerFrontalProjection {
  coordinateSystem: 'RAS' | string
  positionRasMm: Vec3
  focalPointRasMm: Vec3
  viewUpRas: Vec3
  sourceToImageDistanceMm: number
  detectorPixels: [number, number]
  detectorSizeMm: Vec2
  pixelSpacingMm?: Vec2
  viewAngleDeg?: number | null
  imageOrientation?: string
}

export interface AssetTransform {
  sceneScale?: number
  rotationDeg?: Vec3
  positionOffsetMm?: Vec3
  note?: string
}

export interface CtVolumePreview {
  raw?: string
  rawUrl: string
  sizeXyz: [number, number, number]
  originalSizeXyz: [number, number, number]
  stride: number | [number, number, number]
  spacingXyzMm: Vec3
  originLps: Vec3
  directionLps: number[]
  windowHu: [number, number]
  huScale?: { slope: number; offset: number }
  source?: string
}

export interface FluoroInteractionDefaults {
  noduleRadiusMm: number
  snapRadiusMm: number
  defaultScopeProgress: number
  defaultRouteTerminalNodeId: number
  source?: string
}

export interface AirwayGraphNode {
  id: number
  lps: Vec3
  kind: 'root' | 'carina' | 'bifurcation' | 'terminal' | 'internal' | string
  degree: number
  rootDistanceMm: number
  parentNodeId: number | null
  parentEdgeId: number | null
  childEdgeIds: number[]
}

export interface AirwayGraphEdge {
  id: number
  sourceCurve: string
  startNodeId: number
  endNodeId: number
  lengthMm: number
  radiusMm: number | null
  pointsLps: Vec3[]
}

export interface AirwayGraph {
  schema: 'fluoroview_airway_graph/v1' | string
  units: 'mm' | string
  coordinateSystem: 'LPS' | string
  source?: Record<string, unknown>
  rootNodeId: number
  carinaNodeId: number
  carinaLpsMm: Vec3
  terminalNodeIds: number[]
  nodes: AirwayGraphNode[]
  edges: AirwayGraphEdge[]
}

export interface CenterlineOverlayPolyline {
  id: string
  label: string
  points?: Vec2[]
  pointsLps?: Vec3[]
  lengthMm?: number
}

export interface CenterlineOverlay {
  schema?: string
  units: string
  coordinateSystem: string
  source?: string
  sourceRole?: string
  boundsLpsMm?: [Vec3, Vec3]
  polylines: CenterlineOverlayPolyline[]
}

export interface SegmentMetadataEntry {
  id: string
  label: string
  groupKey: string
  medianRadiusMm: number
}

export interface SegmentMetadata {
  source: string
  segments: SegmentMetadataEntry[]
}
