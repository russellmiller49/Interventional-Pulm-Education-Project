export type Vec3 = [number, number, number]

export type CtAxis = 'axial' | 'coronal' | 'sagittal'

export interface AirwayAnatomyCaseManifest {
  schema: 'airway_anatomy_case/v1' | string
  id: string
  title: string
  version: string
  coordinateSystem: 'LPS' | string
  units: 'mm' | string
  safetyLabel: string
  sourcePolicy: string
  assetBaseUrl: string
  assets: {
    airwayGlb: string
    airwayStl?: string
    airwayGraphJson: string
    centerlineLabelsJson: string
    ctPreviewRaw: string
  }
  airwayTransform: AirwaySurfaceTransform
  airwaySurfaceTransform?: AirwaySurfaceTransform
  ct: CtPreviewAsset
  interaction: {
    rootNodeId: number
    carinaNodeId: number
    defaultEdgeId: number
    initialDistanceMm?: number
    stepMm: number
    lookAheadMm: number
    trailMaxPoints: number
  }
}

export interface AirwaySurfaceTransform {
  sceneScale: number
  rotationDeg: Vec3
  positionOffsetMm: Vec3
  note?: string
}

export interface CtPreviewAsset {
  sourceNrrd: string
  sourceSha256?: string
  previewRaw: string
  previewRawUrl: string
  format: 'int16-raw' | string
  sizeXyz: Vec3
  originalSizeXyz: Vec3
  strideXyz: Vec3
  spacingXyzMm: Vec3
  originalSpacingXyzMm: Vec3
  originLps: Vec3
  directionLps: number[]
  space: string
  windowPresets: Array<{
    id: 'lung' | 'mediastinal' | string
    label: string
    low: number
    high: number
  }>
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
  sourceCellId: number
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
  rootNodeId: number
  carinaNodeId: number
  carinaLpsMm: Vec3
  terminalNodeIds: number[]
  nodes: AirwayGraphNode[]
  edges: AirwayGraphEdge[]
}

export interface CenterlineLabelPolyline {
  id: string
  sourceCellId: number
  sourceCurve: string
  abbreviatedLabel: string
  fullLabel: string
  pointsLps: Vec3[]
  anchorLps: Vec3
  matchedEdgeId?: number
  matchedDistanceMm?: number
}

export interface CenterlineLabels {
  schema: 'airway_anatomy_centerline_labels/v1' | string
  units: 'mm' | string
  coordinateSystem: 'LPS' | string
  source: string
  edgeLabels: Record<
    string,
    | {
        abbreviatedLabel: string
        fullLabel: string
        matchedDistanceMm?: number
        sourceCellIds?: number[]
      }
    | undefined
  >
  polylines: CenterlineLabelPolyline[]
}

export interface BranchOption {
  edgeId: number
  toNodeId: number
  label: string
  anatomicalLabel?: string
}

export interface ScopePoseSnapshot {
  edgeId: number
  distanceMm: number
  edgeLengthMm: number
  tipLps: Vec3
  tangentLps: Vec3
  lookAtLps: Vec3
  branchNodeId: number | null
  branchOptions: BranchOption[]
  trailLps: Vec3[]
  yawDeg: number
  pitchDeg: number
  rollDeg: number
}
