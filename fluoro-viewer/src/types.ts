export type Vec2 = [number, number]
export type Vec3 = [number, number, number]
export type Mat3 = [Vec3, Vec3, Vec3]

export interface Branch {
  label: string
  color: [number, number, number]
  polylines: Vec3[][]
}

export interface CenterlinesFile {
  units: 'mm'
  coordinateSystem: 'LPS'
  branches: Branch[]
}

export interface FluoroConfig {
  units: 'mm'
  coordinateSystem: 'LPS'
  isocenter_mm: Vec3
  source_to_isocenter_mm: number
  source_to_detector_mm: number
  detector_pixels: [number, number]
  pixel_pitch_mm: number
  default_view: {
    rao_lao_deg: number
    cranial_caudal_deg: number
  }
}

export interface RadiusMapEntry {
  medianRadiusMm: number
}

export type RadiusMap = Record<string, RadiusMapEntry>

export interface PreparedBranch {
  label: string
  color: string
  colorRgb: [number, number, number]
  polylines: Vec3[][]
  anchorPoint: Vec3
  groupKey: string
  medianRadiusMm?: number
}

export interface AppState {
  raoLao: number
  cranialCaudal: number
  useDts: boolean
  useRadiusWidths: boolean
  showLabels: boolean
  activeGroups: Set<string>
}

export interface RenderOptions {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  branches: PreparedBranch[]
  frame: FrameContext
  state: AppState
  goldenOrder: string[]
}

export interface RenderStats {
  segmentsDrawn: number
}

export interface FrameContext {
  rotation: Mat3
  sid: number
  sdd: number
  odd: number
  isocenter: Vec3
  pixelPitch: number
  pxPerMm: number
  detectorSize: [number, number]
  canvasSize: [number, number]
  smoothstepRange: [number, number]
  maxT: number
}
