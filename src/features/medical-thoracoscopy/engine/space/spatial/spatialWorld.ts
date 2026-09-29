import type { ScopeGeometry } from '../fulcrum'
import type { PortFrame } from '../portDefinition'
import { distance, type Vec3 } from '../vec'
import { capsuleClearance, indexMesh, type Capsule, type MeshIndex } from './capsuleQuery'
import type { TriangleMesh } from './proxyGlb'
import { proxyProblems } from './proxyValidation'
import { closestPointOnTriangle } from './segmentTriangle'
import { isInside } from './windingNumber'

/**
 * Everything that owns a BVH, in one place (plan, section 4.5): the space's proxy and one proxy of
 * the lung for each step, each checked closed and outward as it is loaded and indexed once. The
 * reducer never holds this; it asks it questions and commits the answers.
 *
 * The port's corridor: the sleeve crosses the chest wall at the port, so the space proxy's triangles
 * within `PORT_EXCLUSION_MM` of the pleura at the port are left out of the wall the instrument must
 * keep clear of. The tilt limits keep the sleeve inside that patch.
 */
export const CLEARANCE_SKIN_MM = 0.25
export const NUMERIC_MM = 1e-3
export const PORT_EXCLUSION_MM = 10

/** How close a part allowed to touch must come to count as touching (plan, section 4.5). */
export const TOUCH_MM = 0.3

/**
 * The skin a part allowed to touch keeps: it comes this close and no closer, which is within touching
 * distance. Keeping a skin of its own means the clearance argument holds for it as for every other
 * part: no piece of motion is longer than the least clearance of any pair, so none is carried through
 * the surface it touches, however glancing the move.
 */
export const TOUCH_SKIN_MM = TOUCH_MM / 2

export type Obstacle = 'wall' | 'lung' | 'target'
export type InstrumentPart = 'sleeve' | 'telescope' | 'tool-shaft' | 'working-element'

/** A part of the instrument as a capsule, for `contact`. */
export interface PartCapsule {
  readonly part: InstrumentPart
  readonly capsule: Capsule
}

/** Whether a part may touch a surface: from the contact table (`contactPolicy.ts`). */
export type ContactRuleFn = (part: InstrumentPart, obstacle: Obstacle) => 'refuse' | 'may-touch'

export interface ContactMeasure {
  /** The least room over every pair of part and surface: its clearance less the pair's skin. */
  readonly room: number
  /** The pair that sets the room. */
  readonly part: InstrumentPart
  readonly obstacle: Obstacle
  readonly triangle: number
  /** The least clearance over every pair: how long a piece of motion can be and cross nothing. */
  readonly leastClearance: number
  /** A pair allowed to touch is within touching distance. */
  readonly touching: boolean
}

export interface InstrumentClearance {
  readonly clearance: number
  readonly part: InstrumentPart
  readonly obstacle: Obstacle
  /** The triangle, numbered in the whole space proxy or in the lung proxy, that sets the clearance. */
  readonly triangle: number
}

export interface SpatialWorldInput {
  readonly space: TriangleMesh
  readonly lungSteps: readonly TriangleMesh[]
  readonly port: PortFrame
  /** A teaching target on the wall, for the contact spike: closed and outward like any proxy. */
  readonly target?: TriangleMesh
}

export interface SpatialWorld {
  readonly lungStepCount: number
  readonly space: TriangleMesh
  readonly lung: (step: number) => TriangleMesh
  /**
   * The telescope and sleeve's least clearance from everything, the teaching target included, with
   * the part and the obstacle that set it: nothing may touch while no tool is out.
   */
  clearance(geometry: ScopeGeometry, lungStep: number): InstrumentClearance
  /**
   * Every part against every surface under the contact table's rule: a pair that must keep clear
   * keeps the clearance skin; a pair allowed to touch keeps the touch skin, within touching distance,
   * and never goes through.
   */
  contact(parts: readonly PartCapsule[], lungStep: number, rule: ContactRuleFn): ContactMeasure
  /** The teaching target, if the scenario has one. */
  readonly targetIndex: MeshIndex | null
  /** Whether a point lies inside the space and outside the lung at a step. */
  isFree(point: Vec3, lungStep: number): boolean
  /** The wall without the port's patch, for clearance; the whole space, for what blocks a view. */
  readonly wallIndex: MeshIndex
  readonly spaceIndex: MeshIndex
  lungIndex(step: number): MeshIndex
}

/** The space proxy less its triangles near the port, and each kept triangle's index in the proxy. */
function withoutPort(
  space: TriangleMesh,
  port: PortFrame,
): { readonly mesh: TriangleMesh; readonly original: number[] } {
  const keep: number[] = []
  const original: number[] = []
  const { positions, indices } = space
  const vertex = (i: number): Vec3 => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]
  for (let f = 0; f < indices.length; f += 3) {
    const nearest = closestPointOnTriangle(
      port.pleura,
      vertex(indices[f]),
      vertex(indices[f + 1]),
      vertex(indices[f + 2]),
    )
    if (distance(nearest, port.pleura) >= PORT_EXCLUSION_MM) {
      keep.push(indices[f], indices[f + 1], indices[f + 2])
      original.push(f / 3)
    }
  }
  return { mesh: { positions, indices: Uint32Array.from(keep) }, original }
}

export function createSpatialWorld({
  space,
  lungSteps,
  port,
  target,
}: SpatialWorldInput): SpatialWorld {
  const problems = [
    ...proxyProblems('pleural-space proxy', space),
    ...lungSteps.flatMap((mesh, step) => proxyProblems(`lung proxy, step ${step}`, mesh)),
    ...(target ? proxyProblems('teaching target', target) : []),
  ]
  if (problems.length > 0) throw new Error(`The proxies cannot be used: ${problems.join('; ')}`)
  const wall = withoutPort(space, port)
  const wallIndex = indexMesh(wall.mesh)
  const spaceIndex = indexMesh(space)
  const lungIndexes: MeshIndex[] = lungSteps.map((mesh) => indexMesh(mesh))
  const targetIndex = target ? indexMesh(target) : null
  const lungIndex = (step: number) => {
    const index = lungIndexes[step]
    if (!index) throw new Error(`No lung proxy for step ${step}`)
    return index
  }
  return {
    lungStepCount: lungSteps.length,
    space,
    lung: (step) => lungSteps[step],
    wallIndex,
    spaceIndex,
    lungIndex,
    clearance(geometry, lungStep) {
      const parts: [InstrumentPart, ScopeGeometry['sleeve']][] = [['sleeve', geometry.sleeve]]
      if (geometry.shaft) parts.push(['telescope', geometry.shaft])
      let best: InstrumentClearance = {
        clearance: Infinity,
        part: 'telescope',
        obstacle: 'wall',
        triangle: -1,
      }
      const surfaces: [Obstacle, MeshIndex][] = [
        ['wall', wallIndex],
        ['lung', lungIndex(lungStep)],
        ...(targetIndex ? ([['target', targetIndex]] as [Obstacle, MeshIndex][]) : []),
      ]
      for (const [part, capsule] of parts) {
        for (const [obstacle, index] of surfaces) {
          // each query looks only for something nearer than the least found so far
          const found = capsuleClearance(index, capsule, -Infinity, best.clearance)
          if (found.triangle >= 0 && found.clearance < best.clearance) {
            const triangle = obstacle === 'wall' ? wall.original[found.triangle] : found.triangle
            best = { clearance: found.clearance, part, obstacle, triangle }
          }
        }
      }
      return best
    },
    targetIndex,
    contact(parts, lungStep, rule) {
      const surfaces: [Obstacle, MeshIndex][] = [
        ['wall', wallIndex],
        ['lung', lungIndex(lungStep)],
        ...(targetIndex ? ([['target', targetIndex]] as [Obstacle, MeshIndex][]) : []),
      ]
      let room = Infinity
      let leastClearance = Infinity
      let touching = false
      let limit: { part: InstrumentPart; obstacle: Obstacle; triangle: number } = {
        part: parts[0]?.part ?? 'sleeve',
        obstacle: 'wall',
        triangle: -1,
      }
      for (const { part, capsule } of parts) {
        for (const [obstacle, index] of surfaces) {
          const mayTouch = rule(part, obstacle) === 'may-touch'
          const skin = mayTouch ? TOUCH_SKIN_MM : CLEARANCE_SKIN_MM
          // look only for what could lower the room or the least clearance, or count as touching
          const below = Math.max(
            room + skin,
            leastClearance,
            mayTouch ? TOUCH_MM + NUMERIC_MM : -Infinity,
          )
          const found = capsuleClearance(index, capsule, -Infinity, below)
          if (found.triangle < 0) continue
          if (mayTouch && found.clearance <= TOUCH_MM) touching = true
          leastClearance = Math.min(leastClearance, found.clearance)
          if (found.clearance - skin < room) {
            room = found.clearance - skin
            const triangle = obstacle === 'wall' ? wall.original[found.triangle] : found.triangle
            limit = { part, obstacle, triangle }
          }
        }
      }
      return { room, leastClearance, touching, ...limit }
    },
    isFree(point, lungStep) {
      return isInside(point, space) && !isInside(point, lungSteps[lungStep])
    },
  }
}
