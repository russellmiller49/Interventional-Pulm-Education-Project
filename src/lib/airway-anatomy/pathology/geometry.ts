import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import {
  magnitude,
  minus,
  plus,
  times,
  unit,
  vector,
  sweepClearance,
  type LumenCollider,
  type OpticalFrame,
  type Point3,
} from '@/lib/bronchoscopy-core/frame'
import type { TransportFrames } from '../transport-frames'
import { morphologyFor, siteFor, type PathologySettings } from './model'

export interface PathologyPlacement {
  matrix: THREE.Matrix4
  frame: OpticalFrame
  wallPoint: Point3
  inward: Point3
  projectionMm: number
  radiusMm: number
}

/** Find the first wall of the reviewed lumen, never a guessed centerline radius. */
export function wallDistance(lumen: LumenCollider, center: Point3, direction: Point3) {
  if (lumen.clearance(center) <= 0)
    throw new Error('The lesion anchor is outside the reviewed airway.')
  let inside = 0
  let outside = 0.3
  while (outside < 35 && lumen.clearance(plus(center, times(direction, outside))) > 0) {
    inside = outside
    outside += 0.35
  }
  if (outside >= 35) throw new Error('No local airway wall was found for this lesion.')
  for (let i = 0; i < 14; i++) {
    const mid = (inside + outside) / 2
    if (lumen.clearance(plus(center, times(direction, mid))) > 0) inside = mid
    else outside = mid
  }
  return inside
}

export function placePathology(
  settings: PathologySettings,
  frames: TransportFrames,
  lumen: LumenCollider,
): PathologyPlacement {
  const site = siteFor(settings.site)
  const frame = frames.at(site.edgeId, site.distanceMm)
  const angle = (settings.wallAngleDeg * Math.PI) / 180
  const outward = unit(plus(times(frame.right, Math.cos(angle)), times(frame.up, Math.sin(angle))))
  const inward = times(outward, -1)
  const circumferential = unit(vector(frame.forward, inward))
  const radiusMm = wallDistance(lumen, frame.position, outward)
  const wallPoint = plus(frame.position, times(outward, radiusMm - 0.025))
  const dimensions = morphologyFor(settings.morphology).scale
  const size = Math.max(0.55, Math.min(1.2, settings.size))
  const matrix = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...circumferential),
    new THREE.Vector3(...frame.forward),
    new THREE.Vector3(...inward),
  )
  matrix.scale(new THREE.Vector3(...dimensions.map((v) => v * radiusMm * size)))
  matrix.setPosition(...wallPoint)
  return {
    matrix,
    frame,
    wallPoint,
    inward,
    radiusMm,
    projectionMm: dimensions[2] * radiusMm * size,
  }
}

/** Positive outside a closed lesion, negative inside; shares the displayed triangles exactly. */
export function createLesionCollider(geometry: THREE.BufferGeometry): LumenCollider {
  const bvh = new MeshBVH(geometry, { maxLeafTris: 8 })
  const probe = new THREE.Vector3(),
    ray = new THREE.Ray()
  const direction = new THREE.Vector3(0.743, 0.352, 0.567).normalize()
  const nearest = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 }
  const clearance = (point: Point3) => {
    probe.set(...point)
    if (!bvh.closestPointToPoint(probe, nearest)) return Infinity
    ray.origin.copy(probe)
    ray.direction.copy(direction)
    const hit = bvh.raycastFirst(ray, THREE.DoubleSide)
    const inside = Boolean(hit?.face && hit.face.normal.dot(direction) > 0)
    return nearest.distance * (inside ? -1 : 1)
  }
  return {
    clearance,
    sweep: (a, b, r) => sweepClearance(clearance, a, b, r),
    visible: (a, b) => {
      ray.origin.set(...a)
      ray.direction.set(...b).sub(ray.origin)
      const distance = ray.direction.length()
      ray.direction.normalize()
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide)
      return !hit || hit.distance >= distance - 0.03
    },
  }
}

/** Shallow mucosal disease follows the branch curvature rather than floating on a plane. */
export function createPlacedLesionGeometry(
  source: THREE.BufferGeometry,
  settings: PathologySettings,
  placement: PathologyPlacement,
  frames: TransportFrames,
  lumen: LumenCollider,
  edgeLength: number,
) {
  const geometry = source.clone()
  if (settings.morphology !== 'mucosal') return geometry.applyMatrix4(placement.matrix)
  const site = siteFor(settings.site)
  const positions = geometry.getAttribute('position')
  const halfLength = Math.min(
    placement.radiusMm * 1.6 * settings.size,
    (site.distanceMm - 0.5) * 0.85,
    (edgeLength - site.distanceMm - 0.5) * 0.85,
  )
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i)
    const frame = frames.at(site.edgeId, site.distanceMm + y * halfLength)
    const angle = (settings.wallAngleDeg * Math.PI) / 180 + x * 0.7 * settings.size
    const outward = unit(
      plus(times(frame.right, Math.cos(angle)), times(frame.up, Math.sin(angle))),
    )
    const r = wallDistance(lumen, frame.position, outward)
    const p = plus(frame.position, times(outward, r - z * placement.projectionMm - 0.03))
    positions.setXYZ(i, ...p)
  }
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export function combinePathologyCollider(
  lumen: LumenCollider,
  lesion: LumenCollider,
): LumenCollider {
  const clearance = (p: Point3) => Math.min(lumen.clearance(p), lesion.clearance(p))
  return {
    clearance,
    sweep: (a, b, r) => sweepClearance(clearance, a, b, r),
    visible: (a, b) => lumen.visible(a, b) && lesion.visible(a, b),
  }
}

/** A wall-conforming film, starting at the configured site and extending within that branch.
 * Its finite strip is an authored visual effect, not a gravity/flow or blood-volume model.
 */
export function createBloodFilm(
  settings: Pick<PathologySettings, 'site' | 'wallAngleDeg'>,
  frames: TransportFrames,
  lumen: LumenCollider,
  edgeLength: number,
) {
  const site = siteFor(settings.site)
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = []
  const rows = 32,
    columns = 16
  for (let y = 0; y <= rows; y++) {
    const t = y / rows
    const d = site.distanceMm - t * Math.min(22, site.distanceMm - 0.5, edgeLength - 0.5)
    const frame = frames.at(site.edgeId, d)
    for (let x = 0; x <= columns; x++) {
      const u = x / columns
      const angle = (settings.wallAngleDeg * Math.PI) / 180 + (u - 0.5) * 2.25
      const outward = unit(
        plus(times(frame.right, Math.cos(angle)), times(frame.up, Math.sin(angle))),
      )
      const r = wallDistance(lumen, frame.position, outward)
      positions.push(...plus(frame.position, times(outward, r - 0.06)))
      uv.push(u, t)
      if (x < columns && y < rows) {
        const a = y * (columns + 1) + x,
          b = a + columns + 1
        indices.push(a, b, a + 1, a + 1, b, b + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Only a source in the forward field, on the same visible lumen, can obscure the lens. */
export function sourceVisibility(
  frame: OpticalFrame,
  placement: PathologyPlacement,
  lumen: LumenCollider,
) {
  const source = plus(
    placement.wallPoint,
    times(placement.inward, Math.max(0.12, placement.projectionMm * 0.6)),
  )
  const offset = minus(source, frame.position)
  const distance = magnitude(offset)
  const alignment = unit(offset).reduce((sum, v, i) => sum + v * frame.forward[i], 0)
  if (alignment < 0.2 || distance > 32 || !lumen.visible(frame.position, source)) return 0
  return Math.min(1, Math.max(0, (32 - distance) / 22)) * Math.min(1, (alignment - 0.2) / 0.45)
}
