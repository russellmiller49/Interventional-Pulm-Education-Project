import type { AssemblyPartId, AssemblyVector3 } from './assemblyParts'

/** The four physically distinct interfaces on the EFER teaching assembly. */
export const rigidPortIds = ['mainAxial', 'accessory', 'anesthesiaCircuit', 'jet'] as const

export type RigidPortId = (typeof rigidPortIds)[number]
export type InstrumentEntryPortId = Extract<RigidPortId, 'mainAxial' | 'accessory'>
export type VentilationInletPortId = Extract<RigidPortId, 'anesthesiaCircuit' | 'jet'>

export type RigidPortRole = 'instrument' | 'ventilation'

export type RigidSemanticAnchorId =
  | 'mainAxialEntrance'
  | 'mainAxialLumen'
  | 'accessoryGateEntrance'
  | 'accessoryGateJunction'
  | 'anesthesiaCircuitConnector'
  | 'anesthesiaCircuitJunction'
  | 'jetConnector'
  | 'jetJunction'
  | 'tubeLumen'
  | 'tubeBevel'
  | 'tubeSafetyStop'
  | 'telescopeObjective'
  | 'toolEndpoint'

export interface RigidPortDefinition {
  id: RigidPortId
  label: string
  role: RigidPortRole
  connection: 'axial-cap' | 'accessory-gate' | 'anesthesia-circuit' | 'fixed-jet'
  anchorSequence: readonly RigidSemanticAnchorId[]
  accepts: readonly (
    | 'instrument'
    | 'anesthesia-circuit-gas'
    | 'jet-driving-gas'
    | 'ambient-entrainment'
  )[]
}

/**
 * Topology, not presentation copy. Labels identify the manufacturer-specific
 * interfaces for inspection and test diagnostics.
 */
export const rigidPortTopology = {
  mainAxial: {
    id: 'mainAxial',
    label: 'Main axial working lumen',
    role: 'instrument',
    connection: 'axial-cap',
    anchorSequence: ['mainAxialEntrance', 'mainAxialLumen', 'tubeLumen'],
    accepts: ['instrument', 'ambient-entrainment'],
  },
  accessory: {
    id: 'accessory',
    label: 'BB2401/BB2402 accessory gate',
    role: 'instrument',
    connection: 'accessory-gate',
    anchorSequence: ['accessoryGateEntrance', 'accessoryGateJunction', 'tubeLumen'],
    accepts: ['instrument'],
  },
  anesthesiaCircuit: {
    id: 'anesthesiaCircuit',
    label: 'Anesthesia-circuit port',
    role: 'ventilation',
    connection: 'anesthesia-circuit',
    anchorSequence: ['anesthesiaCircuitConnector', 'anesthesiaCircuitJunction', 'tubeLumen'],
    accepts: ['anesthesia-circuit-gas'],
  },
  jet: {
    id: 'jet',
    label: 'Fixed jet-ventilation port',
    role: 'ventilation',
    connection: 'fixed-jet',
    anchorSequence: ['jetConnector', 'jetJunction', 'tubeLumen'],
    accepts: ['jet-driving-gas'],
  },
} as const satisfies Record<RigidPortId, RigidPortDefinition>

export const instrumentRouteIds = [
  'optical-forceps-main-axial',
  'suction-main-axial',
  'semi-rigid-grasping-accessory',
  'semi-rigid-biopsy-accessory',
  'stent-introducer-main-axial',
] as const

export type InstrumentRouteId = (typeof instrumentRouteIds)[number]

export type RigidConfigurationInterfaceId =
  | 'open-main-axial'
  | 'bs2319-optical-forceps-cap'
  | 'bs2309-telescope-instrument-cap'
  | 'bs2311-telescope-instrument-cap'
  | 'bb2402-double-gate'

export interface InstrumentRoute {
  id: InstrumentRouteId
  selectedToolId: AssemblyPartId
  entryPort: InstrumentEntryPortId
  requiredInterface: RigidConfigurationInterfaceId
  anchorSequence: readonly RigidSemanticAnchorId[]
  insertedDiametersMm: readonly number[]
  minimumDiametricClearanceMm: number
  compatibilityNotes: readonly string[]
  dimensionsEstimated?: boolean
}

const MAIN_AXIAL_INSTRUMENT_ANCHORS = [
  'mainAxialEntrance',
  'mainAxialLumen',
  'tubeLumen',
  'tubeBevel',
  'toolEndpoint',
] as const satisfies readonly RigidSemanticAnchorId[]

const ACCESSORY_INSTRUMENT_ANCHORS = [
  'accessoryGateEntrance',
  'accessoryGateJunction',
  'tubeLumen',
  'tubeBevel',
  'toolEndpoint',
] as const satisfies readonly RigidSemanticAnchorId[]

/**
 * Configuration-specific instrument routes. The type surface intentionally
 * excludes both ventilation ports from `entryPort`.
 */
export const instrumentRoutes = [
  {
    id: 'optical-forceps-main-axial',
    selectedToolId: 'tool-optical-grasping-forceps',
    entryPort: 'mainAxial',
    requiredInterface: 'bs2319-optical-forceps-cap',
    anchorSequence: MAIN_AXIAL_INSTRUMENT_ANCHORS,
    insertedDiametersMm: [5.5, 3],
    minimumDiametricClearanceMm: 0.5,
    compatibilityNotes: [
      'The optical forceps and telescope enter through the axial cap configuration.',
      'Confirm the exact forceps, telescope, cap, and tube combination against the manufacturer instructions.',
    ],
  },
  {
    id: 'suction-main-axial',
    selectedToolId: 'tool-suction-catheter-3mm',
    entryPort: 'mainAxial',
    requiredInterface: 'bs2311-telescope-instrument-cap',
    anchorSequence: MAIN_AXIAL_INSTRUMENT_ANCHORS,
    insertedDiametersMm: [5.5, 3],
    minimumDiametricClearanceMm: 0.5,
    compatibilityNotes: [
      'The 3 mm catheter uses the compatible 4 mm axial telescope-plus-instrument cap.',
      'Available suction depends on residual lumen area, secretions, and the exact device setup.',
    ],
  },
  {
    id: 'semi-rigid-grasping-accessory',
    selectedToolId: 'tool-semi-rigid-grasping-forceps',
    entryPort: 'accessory',
    requiredInterface: 'bb2402-double-gate',
    anchorSequence: ACCESSORY_INSTRUMENT_ANCHORS,
    insertedDiametersMm: [1.5],
    minimumDiametricClearanceMm: 0.5,
    compatibilityNotes: [
      'The slender shaft enters through a labeled gate on the BB2402 accessory adapter.',
      'Gate sealing and accessory compatibility remain device- and configuration-specific.',
    ],
  },
  {
    id: 'semi-rigid-biopsy-accessory',
    selectedToolId: 'tool-semi-rigid-biopsy-forceps',
    entryPort: 'accessory',
    requiredInterface: 'bb2402-double-gate',
    anchorSequence: ACCESSORY_INSTRUMENT_ANCHORS,
    insertedDiametersMm: [1.5],
    minimumDiametricClearanceMm: 0.5,
    compatibilityNotes: [
      'The slender shaft enters through a labeled gate on the BB2402 accessory adapter.',
      'The route is a topology demonstration and does not guarantee clinical reach or suitability.',
    ],
  },
  {
    id: 'stent-introducer-main-axial',
    selectedToolId: 'tool-stent-introducer',
    entryPort: 'mainAxial',
    requiredInterface: 'open-main-axial',
    anchorSequence: MAIN_AXIAL_INSTRUMENT_ANCHORS,
    insertedDiametersMm: [7.5],
    minimumDiametricClearanceMm: 0.5,
    compatibilityNotes: [
      'The introducer follows the main axial lumen after the telescope and capped configuration are removed.',
      'The estimated 7.5 mm introducer shaft is modeled alone in the open main axial lumen.',
    ],
    dimensionsEstimated: true,
  },
] as const satisfies readonly InstrumentRoute[]

const instrumentRouteById = new Map(instrumentRoutes.map((route) => [route.id, route] as const))

export function getInstrumentRoute(id: InstrumentRouteId): InstrumentRoute {
  const route = instrumentRouteById.get(id)
  if (!route) throw new Error(`Unknown rigid bronchoscopy instrument route: ${id}`)
  return route
}

export function getInstrumentRouteForTool(toolId: AssemblyPartId): InstrumentRoute | undefined {
  return instrumentRoutes.find((route) => route.selectedToolId === toolId)
}

export function isInstrumentEntryPort(portId: RigidPortId): portId is InstrumentEntryPortId {
  return rigidPortTopology[portId].role === 'instrument'
}

export type VentilationModeId =
  | 'conventional'
  | 'spontaneous-assist'
  | 'low-frequency-jet'
  | 'high-frequency-jet'

export const respiratoryPhaseIds = [
  'controlled-inspiration',
  'patient-inspiration',
  'assisted-inspiration',
  'jet-pulse',
  'pause',
  'expiration',
] as const

export type RespiratoryPhaseId = (typeof respiratoryPhaseIds)[number]
export type RespiratoryFlowDirection = 'inward' | 'outward' | 'none'
export type VentilationObstructionState = 'open' | 'fixed-complete' | 'ball-valve'

export interface RespiratoryPhaseDefinition {
  id: RespiratoryPhaseId
  durationFraction: number
  flowDirection: RespiratoryFlowDirection
  activePort: RigidPortId | null
  distalInspirationPermitted: boolean
  distalExpirationPermitted: boolean
  accumulationDelta: number
}

export type VentilationProximalPortState = 'connected' | 'sealed' | 'open' | 'gated' | 'unused'
export type VentilationExpiratoryOutlet = 'anesthesiaCircuit' | 'openSystem'
export type VentilationLeakBehavior = 'circuit-limited' | 'open-system-expected'

export interface VentilationSetup {
  mode: VentilationModeId
  inlet: VentilationInletPortId
  proximalPortStates: Readonly<Record<RigidPortId, VentilationProximalPortState>>
  expiratoryOutlet: VentilationExpiratoryOutlet
  leakBehavior: VentilationLeakBehavior
  timingProfileId: VentilationModeId
}

export type ProceduralPoseId = 'midTrachea' | 'carina' | 'rightMainstem' | 'leftMainstem'

export interface RigidCameraPreset {
  id: 'trueScale' | 'carina' | 'selectedMainstem'
  target: AssemblyVector3
  position: AssemblyVector3
  magnified: boolean
}

export interface LumenClearanceResult {
  allowed: boolean
  availableDiameterMm: number
  occupiedDiameterMm: number
  diametricClearanceMm: number
  minimumClearanceMm: number
  reason: 'fits' | 'insufficient-clearance' | 'missing-dimension'
  measurement?: 'diametric-budget' | 'radial-swept-mesh'
  radialClearanceMm?: number
  validationMethod?: string
}

export interface ProceduralPose {
  id: ProceduralPoseId
  tubeId: AssemblyPartId
  anatomyPose: 'tracheal' | 'carinal' | 'right-mainstem' | 'left-mainstem'
  tubeBevelPosition: AssemblyVector3
  safetyStopPosition: AssemblyVector3
  telescopeObjectivePosition: AssemblyVector3
  lumenClearance: LumenClearanceResult
  cameraPreset: RigidCameraPreset
}

export type RigidAssetKind =
  | 'ventilationAccessory'
  | 'toolOrAccessory'
  | 'anatomyCutaway'
  | 'anatomyFull'
  | 'capProxy'
  | 'eferComponent'
  | 'assemblyPack'
  | 'instrumentProxy'

export interface RigidAssetGeometryStats {
  meshCount: number
  triangleCount: number
  boundsMm: {
    min: AssemblyVector3
    max: AssemblyVector3
    size: AssemblyVector3
  }
  semanticNodes: readonly string[]
  materialNames: readonly string[]
  allWindingConsistent: boolean
  allFinite: boolean
}

export interface RigidAssetRecord {
  id: string
  kind: RigidAssetKind
  runtime: boolean
  path: string
  sha256: string
  sizeBytes: number
  geometry: RigidAssetGeometryStats
  dimensionsMm?: Readonly<Record<string, number>>
  anchors?: Readonly<Record<string, unknown>>
  provenance: Readonly<Record<string, unknown>> & { sourceType: string }
  estimatedFields: readonly string[]
}

export interface RigidManifestAnchor {
  assetId?: string
  positionMm: AssemblyVector3
  direction?: AssemblyVector3
  source?: string
  estimated?: boolean
}

/** JSON contract emitted by the Blender-backed v2 asset pipeline. */
export interface RigidAssetManifest {
  schema: 'rigid_bronchoscopy_asset_manifest/v2'
  version: 2
  buildId: string
  generatedOn: string
  generatedWith: {
    python: string
    trimesh: string
    generator: string
    validator: string
  }
  educationalUseOnly: true
  disclaimer: string
  units: {
    authoredDimensions: 'millimeters'
    glbGeometry: 'meters'
    metersPerMillimeter: 0.001
  }
  coordinateSystem: {
    glb: string
    longitudinalAxis: string
    lateralityAxis: string
    anteriorAxis: string
  }
  presentation: {
    worldUnitsPerMillimeter: number
    assetScaleWorldUnitsPerMeter: number
    carinaWorld: AssemblyVector3
    policy: string
  }
  assets: readonly RigidAssetRecord[]
  sources: readonly {
    id: string
    type: string
    url: string
    supports: string
  }[]
  airwayModel: Readonly<Record<string, unknown>>
  semanticAnchors: {
    ports: Readonly<Record<RigidPortId, RigidManifestAnchor>>
    tubeFeatures: Readonly<Record<string, RigidManifestAnchor>>
    telescopeObjective: RigidManifestAnchor
    toolEndpoints: Readonly<Record<string, RigidManifestAnchor>>
    anatomy: Readonly<Record<string, RigidManifestAnchor>>
  }
  proceduralPoses: readonly {
    id: 'tracheal' | 'carinal' | 'rightMainstem' | 'leftMainstem'
    label: string
    tubeAssetId: string
    tubeOuterDiameterMm: number
    visibleSweepStartMm: AssemblyVector3
    bevelMm: AssemblyVector3
    telescopeObjectiveMm: AssemblyVector3
    axis: AssemblyVector3
    anatomyTarget: 'trachea' | 'carina' | 'rightMainstem' | 'leftMainstem'
    cameraPreset: 'trueScale' | 'carina' | 'selectedMainstem'
    validatedMinimumRadialClearanceMm: number
    validationMethod: string
  }[]
  assemblyStates: Readonly<Record<string, { mainAxialCapAssetId: string | null }>>
  validationRequirements: {
    contentHashFilenamePrefixCharacters: number
    criticalDimensionToleranceMm: number
    anchorToleranceMm: number
    minimumPoseRadialClearanceMm: number
    requiredAirwaySemanticNodes: readonly string[]
  }
}
