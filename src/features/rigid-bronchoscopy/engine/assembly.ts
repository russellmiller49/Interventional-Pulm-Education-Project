import type {
  AssemblyPartDefinition,
  AssemblyPartId,
  AssemblyTransform,
  AssemblyVector3,
} from '../content/assemblyParts'
import {
  ANY_TUBE_PREREQUISITE_ID,
  ASSEMBLY_BASE_PART_ID,
  getAssemblyPart,
  isBronchoscopeTubePartId,
} from '../content/assemblyParts'
import { getTelescopePlacementTransform } from './dimensions'

export interface AssemblyPlacementCheck {
  allowed: boolean
  missing: readonly AssemblyPartId[]
}

const DEFAULT_SNAP_DISTANCE = 0.6
const RIGID_TELESCOPE_PART_ID = 'rigid-telescope-bx5500-fa'
const TELESCOPE_MOUNTED_PART_IDS = new Set<AssemblyPartId>([
  RIGID_TELESCOPE_PART_ID,
  'generic-camera-head',
  'light-guide-adapter-c1',
  'light-guide-adapter-c2',
  'generic-fiberoptic-light-cable',
])

function hasPrerequisite(
  prerequisiteId: AssemblyPartId,
  placedIds: readonly AssemblyPartId[],
): boolean {
  if (prerequisiteId === ANY_TUBE_PREREQUISITE_ID) {
    return placedIds.some(isBronchoscopeTubePartId)
  }

  return placedIds.includes(prerequisiteId)
}

/** Check authored prerequisites without mutating learner state. */
export function canPlacePart(
  part: AssemblyPartDefinition,
  placedIds: readonly AssemblyPartId[],
): AssemblyPlacementCheck {
  const missing = (part.prerequisites ?? []).filter(
    (prerequisiteId) => !hasPrerequisite(prerequisiteId, placedIds),
  )

  return {
    allowed: missing.length === 0,
    missing,
  }
}

export function isAssemblyPartPlaced(
  part: AssemblyPartDefinition,
  placedIds: readonly AssemblyPartId[],
): boolean {
  if (part.category === 'tube') {
    return placedIds.some(isBronchoscopeTubePartId)
  }

  return placedIds.includes(part.id)
}

/** Return every puzzle piece still available on the assembly field. */
export function getRemainingAssemblyParts(
  placedIds: readonly AssemblyPartId[],
  steps: readonly AssemblyPartDefinition[],
): AssemblyPartDefinition[] {
  return steps.filter((step) => !isAssemblyPartPlaced(step, placedIds))
}

/** Return the first incomplete authored step, or null when assembly is complete. */
export function getNextAssemblyStep(
  placedIds: readonly AssemblyPartId[],
  steps: readonly AssemblyPartDefinition[],
): AssemblyPartDefinition | null {
  return getRemainingAssemblyParts(placedIds, steps)[0] ?? null
}

/** The transform used after a successful snap. */
export function getPlacedTransform(
  part: AssemblyPartDefinition,
  tube?: AssemblyPartDefinition,
): AssemblyTransform {
  if (!tube || !TELESCOPE_MOUNTED_PART_IDS.has(part.id)) return part.target

  const telescope = getAssemblyPart(RIGID_TELESCOPE_PART_ID)
  if (!telescope) return part.target
  const correctedTelescope = getTelescopePlacementTransform(tube, telescope)
  const translation: AssemblyVector3 = [
    correctedTelescope.position[0] - telescope.target.position[0],
    correctedTelescope.position[1] - telescope.target.position[1],
    correctedTelescope.position[2] - telescope.target.position[2],
  ]

  return {
    ...part.target,
    position: [
      part.target.position[0] + translation[0],
      part.target.position[1] + translation[1],
      part.target.position[2] + translation[2],
    ],
  }
}

/** Euclidean snap check in assembly-scene coordinates. */
export function isWithinSnapDistance(
  position: AssemblyVector3,
  part: AssemblyPartDefinition,
  tube?: AssemblyPartDefinition,
): boolean {
  const [x, y, z] = position
  const [targetX, targetY, targetZ] = getPlacedTransform(part, tube).position
  const distance = Math.hypot(x - targetX, y - targetY, z - targetZ)

  return distance <= (part.snapDistance ?? DEFAULT_SNAP_DISTANCE)
}

/**
 * Remove the most recently placed movable part while preserving array order and
 * the fixed universal base. The input array is never mutated.
 */
export function removeLastPlacedPart(placedIds: readonly AssemblyPartId[]): AssemblyPartId[] {
  const lastMovableIndex = placedIds.findLastIndex((id) => id !== ASSEMBLY_BASE_PART_ID)

  if (lastMovableIndex === -1) {
    return [...placedIds]
  }

  return placedIds.filter((_id, index) => index !== lastMovableIndex)
}
