import type { AssemblyPartDefinition, AssemblyVector3 } from '../content/assemblyParts'
import { rigidBronchoscopyV2Manifest } from '../content/rigidAssetManifest'
import type { InstrumentRoute, LumenClearanceResult } from '../content/assemblyTopology'
import { Euler, Vector3 } from 'three'

export const RIGID_PRESENTATION_WORLD_UNITS_PER_METER = 9
export const RIGID_WORLD_UNITS_PER_MM = RIGID_PRESENTATION_WORLD_UNITS_PER_METER / 1000
export const DEFAULT_SAFETY_STOP_PROXIMAL_OFFSET_MM = 10.4
export const DEFAULT_TELESCOPE_OBJECTIVE_RELATIVE_TO_BEVEL_MM = -1
export const DEFAULT_MINIMUM_DIAMETRIC_CLEARANCE_MM = 0.5

const telescopeObjectiveAnchorMm = rigidBronchoscopyV2Manifest.semanticAnchors.telescopeObjective
  .positionMm as readonly number[]

export const RIGID_TELESCOPE_OBJECTIVE_ASSET_ANCHOR_MM: AssemblyVector3 = [
  telescopeObjectiveAnchorMm[0],
  telescopeObjectiveAnchorMm[1],
  telescopeObjectiveAnchorMm[2],
]

export interface TubeAxialLandmarks {
  proximalTubeAnchor: AssemblyVector3
  bevel: AssemblyVector3
  safetyStop: AssemblyVector3
  telescopeObjective: AssemblyVector3
}

function getUniformPresentationScale(part: AssemblyPartDefinition): number {
  const { scale } = part.target
  if (typeof scale === 'number') return scale
  if (!scale) return RIGID_PRESENTATION_WORLD_UNITS_PER_METER

  const [x, y, z] = scale
  if (Math.abs(x - y) > 1e-9 || Math.abs(x - z) > 1e-9) {
    throw new Error(`Tube ${part.id} requires a uniform presentation scale`)
  }
  return x
}

export function millimetersToWorldUnits(
  millimeters: number,
  presentationScale = RIGID_PRESENTATION_WORLD_UNITS_PER_METER,
): number {
  return (millimeters / 1000) * presentationScale
}

export function worldUnitsToMillimeters(
  worldUnits: number,
  presentationScale = RIGID_PRESENTATION_WORLD_UNITS_PER_METER,
): number {
  return (worldUnits / presentationScale) * 1000
}

/**
 * Resolve independent distal landmarks. The bevel is the physical tube end;
 * the safety stop is deliberately represented as a separate proximal anchor.
 */
export function getTubeAxialLandmarks(
  tube: AssemblyPartDefinition,
  options: {
    safetyStopProximalOffsetMm?: number
    telescopeObjectiveRelativeToBevelMm?: number
  } = {},
): TubeAxialLandmarks {
  if (!tube.workingLengthMm || tube.workingLengthMm <= 0) {
    throw new Error(`Tube ${tube.id} is missing a positive working length`)
  }

  const presentationScale = getUniformPresentationScale(tube)
  const bevelX =
    tube.target.position[0] + millimetersToWorldUnits(tube.workingLengthMm, presentationScale)
  const safetyStopOffset = millimetersToWorldUnits(
    options.safetyStopProximalOffsetMm ?? DEFAULT_SAFETY_STOP_PROXIMAL_OFFSET_MM,
    presentationScale,
  )
  const objectiveRelativeToBevel = millimetersToWorldUnits(
    options.telescopeObjectiveRelativeToBevelMm ?? DEFAULT_TELESCOPE_OBJECTIVE_RELATIVE_TO_BEVEL_MM,
    presentationScale,
  )
  const axisY = tube.target.position[1]
  const axisZ = tube.target.position[2]

  return {
    proximalTubeAnchor: tube.target.position,
    bevel: [bevelX, axisY, axisZ],
    safetyStop: [bevelX - safetyStopOffset, axisY, axisZ],
    telescopeObjective: [bevelX + objectiveRelativeToBevel, axisY, axisZ],
  }
}

function getTransformScaleAxes(scale: AssemblyPartDefinition['target']['scale']): AssemblyVector3 {
  if (typeof scale === 'number') return [scale, scale, scale]
  return scale ?? [1, 1, 1]
}

/** Resolve a millimeter-space GLB anchor through an authored assembly transform. */
export function transformAssetAnchorToAssemblyPoint(
  anchorMm: AssemblyVector3,
  transform: AssemblyPartDefinition['target'],
): AssemblyVector3 {
  const [scaleX, scaleY, scaleZ] = getTransformScaleAxes(transform.scale)
  const point = new Vector3(
    millimetersToWorldUnits(anchorMm[0], scaleX),
    millimetersToWorldUnits(anchorMm[1], scaleY),
    millimetersToWorldUnits(anchorMm[2], scaleZ),
  )
  point.applyEuler(new Euler(...transform.rotation, 'XYZ'))
  point.add(new Vector3(...transform.position))
  return [point.x, point.y, point.z]
}

/**
 * Seat the physical telescope objective 1 mm proximal to the selected tube bevel.
 * The telescope GLB is 545 mm long, so a single static transform cannot fit both
 * 260 mm tracheoscopes and 360 mm bronchial tubes.
 */
export function getTelescopePlacementTransform(
  tube: AssemblyPartDefinition,
  telescope: AssemblyPartDefinition,
): AssemblyPartDefinition['target'] {
  const objectiveTarget = getTubeAxialLandmarks(tube).telescopeObjective
  const objectiveAtOrigin = transformAssetAnchorToAssemblyPoint(
    RIGID_TELESCOPE_OBJECTIVE_ASSET_ANCHOR_MM,
    {
      ...telescope.target,
      position: [0, 0, 0],
    },
  )

  return {
    ...telescope.target,
    position: [
      objectiveTarget[0] - objectiveAtOrigin[0],
      objectiveTarget[1] - objectiveAtOrigin[1],
      objectiveTarget[2] - objectiveAtOrigin[2],
    ],
  }
}

/**
 * Conservative diameter-budget check for parallel shafts in one lumen. It is
 * a teaching compatibility guard, not a substitute for a manufacturer table.
 */
export function calculateLumenClearance(
  availableDiameterMm: number | undefined,
  insertedDiametersMm: readonly number[],
  minimumClearanceMm = DEFAULT_MINIMUM_DIAMETRIC_CLEARANCE_MM,
): LumenClearanceResult {
  const occupiedDiameterMm = insertedDiametersMm.reduce(
    (total, diameter) => total + Math.max(0, diameter),
    0,
  )

  if (availableDiameterMm === undefined || availableDiameterMm <= 0) {
    return {
      allowed: false,
      availableDiameterMm: availableDiameterMm ?? 0,
      occupiedDiameterMm,
      diametricClearanceMm: 0,
      minimumClearanceMm,
      reason: 'missing-dimension',
      measurement: 'diametric-budget',
    }
  }

  const diametricClearanceMm = availableDiameterMm - occupiedDiameterMm
  const allowed = diametricClearanceMm >= minimumClearanceMm
  return {
    allowed,
    availableDiameterMm,
    occupiedDiameterMm,
    diametricClearanceMm,
    minimumClearanceMm,
    reason: allowed ? 'fits' : 'insufficient-clearance',
    measurement: 'diametric-budget',
  }
}

export function getInstrumentRouteClearance(
  route: InstrumentRoute,
  tube: AssemblyPartDefinition,
): LumenClearanceResult {
  return calculateLumenClearance(
    tube.innerDiameterMm,
    route.insertedDiametersMm,
    route.minimumDiametricClearanceMm,
  )
}

export function isDimensionWithinTolerance(
  actualMm: number,
  expectedMm: number,
  toleranceMm = 0.1,
): boolean {
  return Math.abs(actualMm - expectedMm) <= toleranceMm
}

export function distanceBetweenAnchorsMm(
  first: AssemblyVector3,
  second: AssemblyVector3,
  presentationScale = RIGID_PRESENTATION_WORLD_UNITS_PER_METER,
): number {
  const distanceWorld = Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2])
  return worldUnitsToMillimeters(distanceWorld, presentationScale)
}
