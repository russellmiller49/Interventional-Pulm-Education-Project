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
  activeGroups: Set<string>
}

export interface RenderStats {
  visibleSegments: number
}
