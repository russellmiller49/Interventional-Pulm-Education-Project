import type { AssemblyVector3 } from '@/features/rigid-bronchoscopy/content/assemblyParts'
import { resolveModuleAssetPath } from '@/lib/module-assets'

export type VentilationScopePositionId = 'proximal-trachea' | 'at-carina' | 'past-carina'

export const RIGID_BRONCHOSCOPY_AIRWAY_PUBLIC_PATH =
  '/models/rigid-bronchoscopy/anatomy/central-airway.glb'
export const RIGID_BRONCHOSCOPY_AIRWAY_ASSET_PATH = resolveModuleAssetPath(
  RIGID_BRONCHOSCOPY_AIRWAY_PUBLIC_PATH,
)

export const VENTILATION_FENESTRATION_LOCAL_XS = [1.042, 1.168, 1.294, 1.42] as const

type QuaternionTuple = readonly [number, number, number, number]

export interface VentilationScopePose {
  localTip: AssemblyVector3
  quaternion: QuaternionTuple
  steeringAnchor: AssemblyVector3
  worldTip: AssemblyVector3
}

const WORLD_UNITS_PER_MM = 0.009
const TEACHING_CARINA: AssemblyVector3 = [1.22, -0.3, 0]

// Distilled central landmarks from the tracked synchronized-bronchoscopy
// centerline graph. Keeping only edges 0, 1, 2, 4, and 5 avoids shipping the
// full 8,300-point graph in this client bundle.
const SOURCE_ROOT: AssemblyVector3 = [-8.448784828186035, -180.82493591308594, -55.21790313720703]
const SOURCE_CARINA: AssemblyVector3 = [
  -11.958318710327148, -155.96243286132812, -172.42062377929688,
]
const SOURCE_RIGHT_MAINSTEM: AssemblyVector3 = [
  -33.10675048828125, -158.19485473632812, -185.75762939453125,
]

const SOURCE_TRACHEA: readonly AssemblyVector3[] = [
  SOURCE_ROOT,
  [-8.40467643737793, -180.0928497314453, -56.505592346191406],
  [-10.309097290039062, -163.3567352294922, -64.8386001586914],
  [-11.588726043701172, -160.33457946777344, -99.12882995605469],
  [-12.107720375061035, -156.9423065185547, -124.26361083984375],
  [-12.287195205688477, -154.30735778808594, -149.5109100341797],
  SOURCE_CARINA,
]

const SOURCE_INSTRUMENTED_MAINSTEM: readonly AssemblyVector3[] = [
  SOURCE_CARINA,
  [-20.941179275512695, -157.0724334716797, -177.6588897705078],
  [-25.81014633178711, -157.70396423339844, -181.14956665039062],
  [-30.533950805664062, -157.8944854736328, -183.8279266357422],
  SOURCE_RIGHT_MAINSTEM,
  [-31.836301803588867, -158.05755615234375, -194.18807983398438],
  [-34.28709411621094, -158.5131378173828, -198.82672119140625],
  [-35.47322082519531, -159.18670654296875, -201.9161376953125],
  [-37.44120788574219, -159.616943359375, -205.1513671875],
  [-39.131309509277344, -160.20150756835938, -208.1127471923828],
  [-41.3557243347168, -160.81927490234375, -210.92237854003906],
]

const SOURCE_OPPOSITE_MAINSTEM: readonly AssemblyVector3[] = [
  SOURCE_CARINA,
  [-1.3562870025634766, -155.6378173828125, -179.0387725830078],
  [4.310861110687256, -157.10655212402344, -184.1034393310547],
  [9.031033515930176, -157.88954162597656, -188.0054931640625],
  [18.7166748046875, -159.4135284423828, -193.9962158203125],
  [25.804346084594727, -161.33468627929688, -196.5807342529297],
  [32.44121551513672, -162.0923309326172, -198.90786743164062],
  [35.57036590576172, -158.89019775390625, -203.1833953857422],
  [37.72312545776367, -157.0836944580078, -205.73590087890625],
  [39.42020034790039, -154.9595947265625, -207.95469665527344],
]

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

const FORWARD_BASIS = normalize(subtract(SOURCE_CARINA, SOURCE_ROOT))
const rightVector = subtract(SOURCE_RIGHT_MAINSTEM, SOURCE_CARINA)
const RIGHT_TRANSVERSE_BASIS = normalize(
  subtract(rightVector, multiply(FORWARD_BASIS, dot(rightVector, FORWARD_BASIS))),
)
const DEPTH_BASIS = normalize(cross(FORWARD_BASIS, RIGHT_TRANSVERSE_BASIS))

export function transformAirwayLpsPoint(point: AssemblyVector3): AssemblyVector3 {
  const delta = subtract(point, SOURCE_CARINA)
  return [
    TEACHING_CARINA[0] + dot(delta, FORWARD_BASIS) * WORLD_UNITS_PER_MM,
    TEACHING_CARINA[1] - dot(delta, RIGHT_TRANSVERSE_BASIS) * WORLD_UNITS_PER_MM,
    TEACHING_CARINA[2] + dot(delta, DEPTH_BASIS) * WORLD_UNITS_PER_MM,
  ]
}

const trachea = SOURCE_TRACHEA.map(transformAirwayLpsPoint)
const instrumentedMainstem = SOURCE_INSTRUMENTED_MAINSTEM.map(transformAirwayLpsPoint)
const oppositeMainstem = SOURCE_OPPOSITE_MAINSTEM.map(transformAirwayLpsPoint)

export const realisticAirwayGeometry = {
  airwayY: TEACHING_CARINA[1],
  boundsMax: [2.733055, 0.83808, 0.740827] as const satisfies AssemblyVector3,
  boundsMin: [0.130291, -1.401344, -1.14462] as const satisfies AssemblyVector3,
  carina: transformAirwayLpsPoint(SOURCE_CARINA),
  carinaX: TEACHING_CARINA[0],
  glottis: transformAirwayLpsPoint(SOURCE_ROOT),
  glottisX: transformAirwayLpsPoint(SOURCE_ROOT)[0],
  instrumentedMainstem,
  oppositeMainstem,
  trachea,
} as const

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

// Seat the bevel just inside the entered main bronchus. A deeper target would
// force the straight rigid shaft through the lateral carinal wall in this
// non-deforming anatomy model.
const PAST_CARINA_TIP = instrumentedMainstem[1]
const PAST_CARINA_STEERING_ANCHOR: AssemblyVector3 = [
  realisticAirwayGeometry.glottis[0],
  realisticAirwayGeometry.glottis[1] + 0.045,
  realisticAirwayGeometry.glottis[2] + 0.02,
]

const targetTipByPosition: Record<VentilationScopePositionId, AssemblyVector3> = {
  'proximal-trachea': [0.38, realisticAirwayGeometry.airwayY, 0],
  'at-carina': [1.15, realisticAirwayGeometry.airwayY, 0],
  'past-carina': PAST_CARINA_TIP,
}

export function getVentilationScopePose(
  tubeDistalX: number,
  position: VentilationScopePositionId,
): VentilationScopePose {
  const worldTip = targetTipByPosition[position]
  const steeringAnchor = position === 'past-carina' ? PAST_CARINA_STEERING_ANCHOR : worldTip
  const direction =
    position === 'past-carina' ? subtract(worldTip, steeringAnchor) : ([1, 0, 0] as const)
  return {
    localTip: [tubeDistalX, realisticAirwayGeometry.airwayY, 0],
    quaternion: quaternionFromXAxis(direction),
    steeringAnchor,
    worldTip,
  }
}

export function transformVentilationScopePoint(
  point: AssemblyVector3,
  pose: VentilationScopePose,
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
