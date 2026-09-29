import { DoubleSide, Ray, Vector3 } from 'three'

import type { PleuralZoneId } from '../../../content/pleuralZones'
import { isPleuralZoneId } from '../../../content/pleuralZones'
import type { ScopeGeometry } from '../fulcrum'
import type { Instrument } from '../instrument'
import { cross, dot, normalize, radians, sub, type Vec3 } from '../vec'
import type { ProxyFile, TriangleMesh } from './proxyGlb'
import type { SpatialWorld } from './spatialWorld'

/**
 * What the telescope can see of each survey region (plan, section 4.5; owner decisions, T12): a
 * sample point is in view when it lies within the round field, within range, facing the telescope
 * and with nothing between, neither the wall of the space nor the lung. Samples come from the space
 * proxy's file, lifted just inside it so that the proxy never hides its own region.
 */
export interface ZoneSamples {
  readonly zones: readonly PleuralZoneId[]
  readonly points: Float32Array
  /** The space's outward normal where each sample lies. */
  readonly normals: Float32Array
}

export const VIEW = { out: 0, inView: 1, hidden: 2 } as const

/** How far short of a sample a surface must be to hide it, so the sample's own wall never does. */
export const OCCLUSION_TOLERANCE_MM = 1e-3
export type SampleView = (typeof VIEW)[keyof typeof VIEW]

export function zoneSamplesFrom(file: ProxyFile, world: SpatialWorld): ZoneSamples {
  const zones: PleuralZoneId[] = []
  const points: number[] = []
  for (const node of file.nodes) {
    if (!node.points) continue
    const zone = node.name.replace(/^samples:/, '')
    if (!isPleuralZoneId(zone)) throw new Error(`Unknown zone in the samples: ${zone}`)
    for (let i = 0; i < node.points.length; i += 3) {
      zones.push(zone)
      points.push(node.points[i], node.points[i + 1], node.points[i + 2])
    }
  }
  const normals = new Float32Array(points.length)
  const space: TriangleMesh = world.space
  const target = { point: new Vector3(), distance: 0, faceIndex: 0 }
  for (let s = 0; s < zones.length; s += 1) {
    const found = world.spaceIndex.bvh.closestPointToPoint(
      new Vector3(points[s * 3], points[s * 3 + 1], points[s * 3 + 2]),
      target,
    )
    if (!found) throw new Error('A sample has no nearest wall')
    const f = world.spaceIndex.original[found.faceIndex] * 3
    const vertex = (i: number): Vec3 => [
      space.positions[i * 3],
      space.positions[i * 3 + 1],
      space.positions[i * 3 + 2],
    ]
    const a = vertex(space.indices[f])
    const n = normalize(
      cross(sub(vertex(space.indices[f + 1]), a), sub(vertex(space.indices[f + 2]), a)),
    )
    normals.set(n, s * 3)
  }
  return { zones, points: Float32Array.from(points), normals }
}

/** Each sample's view from the camera at a lung step: out of view, in view, or in the field but hidden. */
export function viewSamples(
  world: SpatialWorld,
  samples: ZoneSamples,
  camera: ScopeGeometry['camera'],
  device: Instrument,
  lungStep: number,
): Uint8Array {
  const out = new Uint8Array(samples.zones.length)
  const cosHalf = Math.cos(radians(device.fieldOfViewDeg / 2))
  const origin = new Vector3(...camera.origin)
  const ray = new Ray()
  const lung = world.lungIndex(lungStep).bvh
  for (let s = 0; s < samples.zones.length; s += 1) {
    const p: Vec3 = [samples.points[s * 3], samples.points[s * 3 + 1], samples.points[s * 3 + 2]]
    const toSample = sub(p, camera.origin)
    const range = Math.hypot(...toSample)
    if (range === 0 || range > device.viewRangeMm) continue
    if (dot(toSample, camera.forward) / range < cosHalf) continue
    const normal: Vec3 = [
      samples.normals[s * 3],
      samples.normals[s * 3 + 1],
      samples.normals[s * 3 + 2],
    ]
    if (dot(toSample, normal) <= 0) continue // seen from behind the wall's surface
    ray.origin.copy(origin)
    ray.direction.set(toSample[0] / range, toSample[1] / range, toSample[2] / range)
    const far = range - OCCLUSION_TOLERANCE_MM
    const blocked =
      world.spaceIndex.bvh.raycastFirst(ray, DoubleSide, 0, far) ||
      lung.raycastFirst(ray, DoubleSide, 0, far)
    out[s] = blocked ? VIEW.hidden : VIEW.inView
  }
  return out
}
