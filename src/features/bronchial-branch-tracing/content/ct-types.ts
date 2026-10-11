import type { DisplayPreset, Vec3 } from '../geometry/coordinates'

export interface AirwayLabel {
  code: string
  name: string
  shortName: string
}
export interface CtBranchOption {
  sourceEdgeId: number
  airway: AirwayLabel
  label: string
  direction: string
  slice: number
  pixel: [number, number]
  lps: Vec3
}
export interface CtCheckpoint {
  id: string
  slice: number
  pixel: [number, number]
  lps: Vec3
  /** Present only when the source exporter sampled this exact location. */
  sourceHu?: number
  sourceEdgeId: number
  airway: AirwayLabel
  landmark: string
  visibilityNote?: string
  cropCenter?: [number, number]
  cropSize?: number
  decision?: {
    nodeId: number
    junctionLps: Vec3
    parent: {
      sourceEdgeId: number
      airway: AirwayLabel
      slice: number
      pixel: [number, number]
      lps: Vec3
    }
    options: CtBranchOption[]
  }
}
export interface CtTrace {
  id: string
  targetId: string
  sourceEdgeIds: number[]
  region: string
  focusAirway?: AirwayLabel
  preset: DisplayPreset
  range: [number, number]
  cropCenter: [number, number]
  cropSize: number
  airwayPath: AirwayLabel[]
  anchor: { slice: number; pixel: [number, number]; sourceEdgeId: number; airway: AirwayLabel }
  checkpoints: CtCheckpoint[]
  scopePositionLps: Vec3
  scopeDirectionLps: Vec3
}
export interface CtNoduleTarget {
  id: string
  segment: { code: string; name: string; bronchusCode: string }
  approachCode: string
  centerLps: Vec3
  pixel: [number, number]
  slice: number
  /** The last point of the airway model on the route to this lesion. */
  approach?: { slice: number; pixel: [number, number]; lps: Vec3; sourceEdgeId: number }
  patch: {
    originPixel: [number, number]
    size: [number, number]
    frames: { slice: number; path: string; changedPixels: number }[]
  }
}
export interface CtMark {
  slice: number
  pixel: [number, number] | null
}
