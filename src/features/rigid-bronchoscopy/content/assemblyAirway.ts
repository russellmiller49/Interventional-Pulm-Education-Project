import {
  bronchoscopeTubeOptions,
  type AssemblyPartDefinition,
  type AssemblyVector3,
} from '@/features/rigid-bronchoscopy/content/assemblyParts'
import type {
  ProceduralPose,
  ProceduralPoseId,
} from '@/features/rigid-bronchoscopy/content/assemblyTopology'
import {
  getRigidV2AssetPath,
  getRigidV2AssetRecord,
  RIGID_V2_ASSET_IDS,
} from '@/features/rigid-bronchoscopy/content/rigidAssetManifest'
import {
  getTubeAxialLandmarks,
  millimetersToWorldUnits,
  RIGID_WORLD_UNITS_PER_MM,
} from '@/features/rigid-bronchoscopy/engine/dimensions'

export type CanonicalVentilationScopePositionId =
  | 'proximal-trachea'
  | 'mid-trachea'
  | 'at-carina'
  | 'past-carina'
  | 'right-mainstem'
  | 'left-mainstem'

/** @deprecated Both positions are canonical v2 teaching positions; retained as a source alias. */
export type LegacyVentilationScopePositionId = 'proximal-trachea' | 'past-carina'
export type VentilationScopePositionId = CanonicalVentilationScopePositionId

export const RIGID_BRONCHOSCOPY_AIRWAY_PUBLIC_PATH = getRigidV2AssetRecord(
  RIGID_V2_ASSET_IDS.airwayFull,
).path
export const RIGID_BRONCHOSCOPY_AIRWAY_ASSET_PATH = getRigidV2AssetPath(
  RIGID_V2_ASSET_IDS.airwayFull,
)
export const RIGID_BRONCHOSCOPY_AIRWAY_CUTAWAY_PUBLIC_PATH = getRigidV2AssetRecord(
  RIGID_V2_ASSET_IDS.airwayCutaway,
).path
export const RIGID_BRONCHOSCOPY_AIRWAY_CUTAWAY_ASSET_PATH = getRigidV2AssetPath(
  RIGID_V2_ASSET_IDS.airwayCutaway,
)

export const RIGID_BRONCHOSCOPY_V2_MANIFEST_PUBLIC_PATH =
  '/models/rigid-bronchoscopy/v2/asset-manifest.json'

const DEFAULT_BRONCHIAL_BEVEL_X = 1.6
const FENESTRATION_PROXIMAL_OFFSETS_MM = [62, 48, 34, 20] as const

/** Compatibility positions for the original BT2103 teaching tube. */
export const VENTILATION_FENESTRATION_LOCAL_XS = FENESTRATION_PROXIMAL_OFFSETS_MM.map(
  (offsetMm) => DEFAULT_BRONCHIAL_BEVEL_X - millimetersToWorldUnits(offsetMm),
) as readonly number[]

type QuaternionTuple = readonly [number, number, number, number]

export interface VentilationScopePose {
  positionId: VentilationScopePositionId
  localTip: AssemblyVector3
  localBevel: AssemblyVector3
  localSafetyStop: AssemblyVector3
  localTelescopeObjective: AssemblyVector3
  quaternion: QuaternionTuple
  steeringAnchor: AssemblyVector3
  worldTip: AssemblyVector3
  worldBevel: AssemblyVector3
  worldSafetyStop: AssemblyVector3
  worldTelescopeObjective: AssemblyVector3
}

export const RIGID_BRONCHOSCOPY_WORLD_UNITS_PER_MM = RIGID_WORLD_UNITS_PER_MM

const TEACHING_CARINA: AssemblyVector3 = [1.22, -0.3, 0]

/**
 * Public-safe, purpose-built central-airway centerlines in model millimeters.
 * +X runs from proximal trachea to carina; right is -Y and left is +Y.
 */
const CENTRAL_AIRWAY_MODEL_MM = {
  trachea: [
    [-135, 0, 0],
    [-90, 0, 0],
    [-45, 0, 0],
    [0, 0, 0],
  ],
  rightMainstem: [
    [-4, 0, 0],
    [20, -8, -1],
    [40, -21, -3],
    [62, -34, -4],
  ],
  leftMainstem: [
    [-4, 0, 0],
    [20, 10, 1],
    [42, 25, 2],
    [69, 44, 3],
  ],
} as const satisfies Record<string, readonly AssemblyVector3[]>

export function transformCentralAirwayModelMmPoint(point: AssemblyVector3): AssemblyVector3 {
  return [
    TEACHING_CARINA[0] + point[0] * RIGID_WORLD_UNITS_PER_MM,
    TEACHING_CARINA[1] + point[1] * RIGID_WORLD_UNITS_PER_MM,
    TEACHING_CARINA[2] + point[2] * RIGID_WORLD_UNITS_PER_MM,
  ]
}

const trachea = CENTRAL_AIRWAY_MODEL_MM.trachea.map(transformCentralAirwayModelMmPoint)
const rightMainstem = [
  transformCentralAirwayModelMmPoint([0, 0, 0]),
  ...CENTRAL_AIRWAY_MODEL_MM.rightMainstem.slice(1).map(transformCentralAirwayModelMmPoint),
] as const
const leftMainstem = [
  transformCentralAirwayModelMmPoint([0, 0, 0]),
  ...CENTRAL_AIRWAY_MODEL_MM.leftMainstem.slice(1).map(transformCentralAirwayModelMmPoint),
] as const

export const centralAirwayGeometry = {
  airwayY: TEACHING_CARINA[1],
  boundsMax: [1.94, 0.19, 0.13] as const satisfies AssemblyVector3,
  boundsMin: [-0.08, -0.7, -0.13] as const satisfies AssemblyVector3,
  carina: transformCentralAirwayModelMmPoint([0, 0, 0]),
  carinaX: TEACHING_CARINA[0],
  glottis: transformCentralAirwayModelMmPoint([-135, 0, 0]),
  glottisX: transformCentralAirwayModelMmPoint([-135, 0, 0])[0],
  instrumentedMainstem: rightMainstem,
  leftMainstem,
  oppositeMainstem: leftMainstem,
  rightMainstem,
  trachea,
} as const

/** Compatibility export retained for the current scene component. */
export const realisticAirwayGeometry = centralAirwayGeometry

function subtract(a: AssemblyVector3, b: AssemblyVector3): AssemblyVector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function add(a: AssemblyVector3, b: AssemblyVector3): AssemblyVector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function multiply(vector: AssemblyVector3, scalar: number): AssemblyVector3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar]
}

function dot(a: AssemblyVector3, b: AssemblyVector3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross(a: AssemblyVector3, b: AssemblyVector3): AssemblyVector3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function length(vector: AssemblyVector3) {
  return Math.sqrt(dot(vector, vector))
}

function normalize(vector: AssemblyVector3): AssemblyVector3 {
  const magnitude = length(vector)
  if (magnitude <= 1e-9) return [1, 0, 0]
  return multiply(vector, 1 / magnitude)
}

function quaternionFromXAxis(direction: AssemblyVector3): QuaternionTuple {
  const unit = normalize(direction)
  const raw: QuaternionTuple = [0, -unit[2], unit[1], 1 + unit[0]]
  const magnitude = Math.hypot(raw[0], raw[1], raw[2], raw[3])
  if (magnitude <= 1e-9) return [0, 0, 0, 1]
  return [raw[0] / magnitude, raw[1] / magnitude, raw[2] / magnitude, raw[3] / magnitude]
}

function rotateByQuaternion(vector: AssemblyVector3, quaternion: QuaternionTuple): AssemblyVector3 {
  const [qx, qy, qz, qw] = quaternion
  const qVector: AssemblyVector3 = [qx, qy, qz]
  const firstCross = cross(qVector, vector)
  const secondCross = cross(qVector, firstCross)
  return add(vector, add(multiply(firstCross, 2 * qw), multiply(secondCross, 2)))
}

interface AuthoredScopeTarget {
  positionId: VentilationScopePositionId
  worldBevel: AssemblyVector3
  steeringAnchor: AssemblyVector3
  axis: AssemblyVector3
}

const AXIAL_STEERING_ANCHOR: AssemblyVector3 = [centralAirwayGeometry.glottisX, -0.3, 0]

/** Discrete poses prevent a straight rigid tube from being bent along a centerline. */
const AUTHORED_SCOPE_TARGETS: Record<VentilationScopePositionId, AuthoredScopeTarget> = {
  'proximal-trachea': {
    positionId: 'proximal-trachea',
    worldBevel: [0.28, -0.3, 0],
    steeringAnchor: AXIAL_STEERING_ANCHOR,
    axis: [1, 0, 0],
  },
  'mid-trachea': {
    positionId: 'mid-trachea',
    worldBevel: transformCentralAirwayModelMmPoint([-50, 0, 0]),
    steeringAnchor: transformCentralAirwayModelMmPoint([-120, 0, 0]),
    axis: [1, 0, 0],
  },
  'at-carina': {
    positionId: 'at-carina',
    worldBevel: transformCentralAirwayModelMmPoint([-8, 0, 0]),
    steeringAnchor: transformCentralAirwayModelMmPoint([-110, 0, 0]),
    axis: [1, 0, 0],
  },
  'right-mainstem': {
    positionId: 'right-mainstem',
    worldBevel: transformCentralAirwayModelMmPoint([28, -9, -1.5]),
    steeringAnchor: transformCentralAirwayModelMmPoint([-55, 0, 0]),
    axis: [0.9939, -0.1078, -0.018],
  },
  'left-mainstem': {
    positionId: 'left-mainstem',
    worldBevel: transformCentralAirwayModelMmPoint([23, 9, 1]),
    steeringAnchor: transformCentralAirwayModelMmPoint([-50, 0, 0]),
    axis: [0.9924, 0.1223, 0.0136],
  },
  'past-carina': {
    positionId: 'past-carina',
    worldBevel: transformCentralAirwayModelMmPoint([28, -9, -1.5]),
    steeringAnchor: transformCentralAirwayModelMmPoint([-55, 0, 0]),
    axis: [0.9939, -0.1078, -0.018],
  },
}

export function getVentilationFenestrationLocalXs(tube: AssemblyPartDefinition): readonly number[] {
  if (!tube.hasDistalFenestrations) return []
  const { bevel } = getTubeAxialLandmarks(tube)
  const numericScale = typeof tube.target.scale === 'number' ? tube.target.scale : 9
  return FENESTRATION_PROXIMAL_OFFSETS_MM.map(
    (offsetMm) => bevel[0] - millimetersToWorldUnits(offsetMm, numericScale),
  )
}

export function getVentilationScopePose(
  tubeBevelX: number,
  position: VentilationScopePositionId,
): VentilationScopePose {
  const target = AUTHORED_SCOPE_TARGETS[position]
  const localBevel: AssemblyVector3 = [tubeBevelX, centralAirwayGeometry.airwayY, 0]
  const localSafetyStop: AssemblyVector3 = [
    tubeBevelX - millimetersToWorldUnits(10.4),
    centralAirwayGeometry.airwayY,
    0,
  ]
  const localTelescopeObjective: AssemblyVector3 = [
    tubeBevelX - millimetersToWorldUnits(1),
    centralAirwayGeometry.airwayY,
    0,
  ]
  const quaternion = quaternionFromXAxis(target.axis)
  const partialPose = {
    localTip: localBevel,
    localBevel,
    localSafetyStop,
    localTelescopeObjective,
    positionId: position,
    quaternion,
    steeringAnchor: target.steeringAnchor,
    worldTip: target.worldBevel,
    worldBevel: target.worldBevel,
  }

  return {
    ...partialPose,
    worldSafetyStop: transformVentilationScopePoint(localSafetyStop, partialPose),
    worldTelescopeObjective: transformVentilationScopePoint(localTelescopeObjective, partialPose),
  }
}

export function transformVentilationScopePoint(
  point: AssemblyVector3,
  pose: Pick<VentilationScopePose, 'localTip' | 'quaternion' | 'worldTip'>,
): AssemblyVector3 {
  return add(pose.worldTip, rotateByQuaternion(subtract(point, pose.localTip), pose.quaternion))
}

export function getVentilationScopeAngleDegrees(pose: VentilationScopePose) {
  const direction = rotateByQuaternion([1, 0, 0], pose.quaternion)
  return {
    pitch: (Math.atan2(direction[2], Math.hypot(direction[0], direction[1])) * 180) / Math.PI,
    yaw: (Math.atan2(direction[1], direction[0]) * 180) / Math.PI,
  }
}

const poseTubeId: Record<ProceduralPoseId, string> = {
  midTrachea: 'tube-bt2203-3',
  carina: 'tube-bt2203-3',
  rightMainstem: 'tube-bt2105-3',
  leftMainstem: 'tube-bt2105-3',
}

const proceduralToScopePosition: Record<ProceduralPoseId, CanonicalVentilationScopePositionId> = {
  midTrachea: 'mid-trachea',
  carina: 'at-carina',
  rightMainstem: 'right-mainstem',
  leftMainstem: 'left-mainstem',
}

const proceduralAnatomyPose: Record<ProceduralPoseId, ProceduralPose['anatomyPose']> = {
  midTrachea: 'tracheal',
  carina: 'carinal',
  rightMainstem: 'right-mainstem',
  leftMainstem: 'left-mainstem',
}

const validatedPoseRadialClearanceMm: Record<ProceduralPoseId, number> = {
  midTrachea: 4.997,
  carina: 4.997,
  rightMainstem: 0.828,
  leftMainstem: 0.81,
}

const POSE_CLEARANCE_VALIDATION_METHOD =
  '80 longitudinal x 32 radial swept-surface samples against the authored lumen mesh'

function requiredTube(id: string): AssemblyPartDefinition {
  const tube = bronchoscopeTubeOptions.find((candidate) => candidate.id === id)
  if (!tube) throw new Error(`Missing procedural-pose tube: ${id}`)
  return tube
}

export function createProceduralPose(id: ProceduralPoseId): ProceduralPose {
  const tube = requiredTube(poseTubeId[id])
  const landmarks = getTubeAxialLandmarks(tube)
  const scopePose = getVentilationScopePose(landmarks.bevel[0], proceduralToScopePosition[id])
  const radialClearanceMm = validatedPoseRadialClearanceMm[id]
  const tubeOuterDiameterMm = tube.outerDiameterMm ?? 0
  const clearance = {
    allowed: radialClearanceMm >= 0.5,
    availableDiameterMm: tubeOuterDiameterMm + radialClearanceMm * 2,
    occupiedDiameterMm: tubeOuterDiameterMm,
    diametricClearanceMm: radialClearanceMm * 2,
    minimumClearanceMm: 0.5,
    reason: radialClearanceMm >= 0.5 ? ('fits' as const) : ('insufficient-clearance' as const),
    measurement: 'radial-swept-mesh' as const,
    radialClearanceMm,
    validationMethod: POSE_CLEARANCE_VALIDATION_METHOD,
  }
  const mainstem = id === 'rightMainstem' || id === 'leftMainstem'
  const target = mainstem ? scopePose.worldBevel : centralAirwayGeometry.carina

  return {
    id,
    tubeId: tube.id,
    anatomyPose: proceduralAnatomyPose[id],
    tubeBevelPosition: scopePose.worldBevel,
    safetyStopPosition: scopePose.worldSafetyStop,
    telescopeObjectivePosition: scopePose.worldTelescopeObjective,
    lumenClearance: clearance,
    cameraPreset: {
      id: mainstem ? 'selectedMainstem' : id === 'carina' ? 'carina' : 'trueScale',
      target,
      position: [target[0], target[1] + 1.7, target[2] + 4.8],
      magnified: false,
    },
  }
}

export const proceduralPoses = {
  midTrachea: createProceduralPose('midTrachea'),
  carina: createProceduralPose('carina'),
  rightMainstem: createProceduralPose('rightMainstem'),
  leftMainstem: createProceduralPose('leftMainstem'),
} as const satisfies Record<ProceduralPoseId, ProceduralPose>
