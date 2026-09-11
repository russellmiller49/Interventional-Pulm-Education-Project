import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { sweepClearance, type LumenCollider, type Point3 } from '../bronchoscopy-core/frame'

const cache = new WeakMap<THREE.BufferGeometry, LumenCollider>()
/** Geometry is immutable patient LPS millimeters and must have passed the case topology check. */
export function createLumenCollider(geometry: THREE.BufferGeometry): LumenCollider {
  const cached = cache.get(geometry)
  if (cached) return cached
  const bvh = new MeshBVH(geometry, { maxLeafTris: 8 })
  const probe = new THREE.Vector3(),
    ray = new THREE.Ray()
  const direction = new THREE.Vector3(0.743, 0.352, 0.567).normalize()
  const nearest = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 }
  const clearance = (point: Point3) => {
    probe.set(...point)
    if (!bvh.closestPointToPoint(probe, nearest)) return -Infinity
    ray.origin.copy(probe)
    ray.direction.copy(direction)
    const hit = bvh.raycastFirst(ray, THREE.DoubleSide)
    const inside = Boolean(hit?.face && hit.face.normal.dot(direction) > 0)
    return nearest.distance * (inside ? 1 : -1)
  }
  const collider: LumenCollider = {
    clearance,
    sweep: (from, to, radius) => sweepClearance(clearance, from, to, radius),
    visible: (from, to) => {
      ray.origin.set(...from)
      ray.direction.set(...to).sub(ray.origin)
      const distance = ray.direction.length()
      ray.direction.normalize()
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide)
      return !hit || hit.distance >= distance - 0.15
    },
  }
  cache.set(geometry, collider)
  return collider
}
