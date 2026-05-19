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
    dracoBaseUrl: string
    centerlineJson: string
    segmentMetadataJson: string
  }
  ctSlices: {
    windowPresets: CtWindowPreset[]
    axes: Record<CtAxis, CtSliceAxisConfig>
  }
  drrAtlas: {
    grid: {
      raoLaoAngles: number[]
      cranialCaudalAngles: number[]
    }
    provenance: DrrAtlasProvenance
    frames: DrrAtlasFrame[]
  }
  lessons: FluoroLesson[]
}

export interface CenterlineOverlayPolyline {
  id: string
  label: string
  points: Vec2[]
}

export interface CenterlineOverlay {
  units: string
  coordinateSystem: string
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
