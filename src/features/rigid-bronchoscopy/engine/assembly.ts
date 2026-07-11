import type {
  AssemblyPartDefinition,
  AssemblyPartId,
  AssemblyTransform,
  AssemblyVector3,
} from '../content/assemblyParts'
import {
  ANY_TUBE_PREREQUISITE_ID,
  ASSEMBLY_BASE_PART_ID,
  isBronchoscopeTubePartId,
} from '../content/assemblyParts'

export interface AssemblyPlacementCheck {
  allowed: boolean
  missing: readonly AssemblyPartId[]
}

const DEFAULT_SNAP_DISTANCE = 0.6

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
export function getPlacedTransform(part: AssemblyPartDefinition): AssemblyTransform {
  return part.target
}

/** Euclidean snap check in assembly-scene coordinates. */
export function isWithinSnapDistance(
  position: AssemblyVector3,
  part: AssemblyPartDefinition,
): boolean {
  const [x, y, z] = position
  const [targetX, targetY, targetZ] = part.target.position
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
