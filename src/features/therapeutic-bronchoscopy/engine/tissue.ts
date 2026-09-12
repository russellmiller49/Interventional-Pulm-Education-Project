import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import type { Point3 } from '@/lib/bronchoscopy-core/frame'

export interface MeshData {
  positions: Float32Array
  colors: Float32Array
  indices?: Uint32Array
}
export type TissueCut =
  | { kind: 'bite'; center: Point3; radius: number; thermal?: boolean }
  | { kind: 'snare'; origin: Point3; normal: Point3 }
export interface TissueResult extends MeshData {
  remainingFraction: number
  removedMm3: number
  spacingMm: number
}
export function serializeGeometry(geometry: THREE.BufferGeometry): MeshData {
  return {
    positions: new Float32Array(geometry.getAttribute('position').array),
    colors: new Float32Array(geometry.getAttribute('color').array),
    indices: geometry.index ? new Uint32Array(geometry.index.array) : undefined,
  }
}
export function geometryFromData(data: MeshData) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3))
  if (data.indices) geometry.setIndex(new THREE.BufferAttribute(data.indices, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  if (data.positions.length) geometry.computeBoundingSphere()
  else geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0)
  return geometry
}

const corners = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
]
// Matching diagonals on adjacent cube faces avoid cracks between tetrahedra.
const tetrahedra = [
  [0, 5, 1, 6],
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6],
]
const tetraEdges = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
]

/** A local mesh-derived solid. Grid spacing is an authored rendering tolerance, not tissue biology. */
export class TissueVolume {
  readonly origin: Point3
  readonly size: Point3
  readonly spacing: number
  private readonly baseline: Float32Array
  private readonly values: Float32Array
  private readonly colors: Float32Array
  private readonly originalCount: number
  private currentCount: number
  private readonly heat: Float32Array

  constructor(data: MeshData, requestedSpacing = 0.5) {
    const geometry = geometryFromData(data)
    const box = geometry.boundingBox!
    const extent = box.getSize(new THREE.Vector3())
    this.spacing = Math.max(requestedSpacing, Math.max(extent.x, extent.y, extent.z) / 52)
    box.expandByScalar(this.spacing * 2)
    this.origin = box.min.toArray()
    this.size = box
      .getSize(new THREE.Vector3())
      .toArray()
      .map((v) => Math.ceil(v / this.spacing) + 1) as Point3
    const count = this.size[0] * this.size[1] * this.size[2]
    this.baseline = new Float32Array(count)
    this.colors = new Float32Array(count * 3)
    this.heat = new Float32Array(count)
    const bvh = new MeshBVH(geometry, { maxLeafTris: 8 })
    const point = new THREE.Vector3(),
      ray = new THREE.Ray()
    ray.direction.set(0.743, 0.352, 0.567).normalize()
    const nearest = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 }
    const sourceColors = geometry.getAttribute('color')
    let solid = 0
    for (let z = 0; z < this.size[2]; z++)
      for (let y = 0; y < this.size[1]; y++)
        for (let x = 0; x < this.size[0]; x++) {
          const i = this.index(x, y, z)
          point.set(
            this.origin[0] + x * this.spacing,
            this.origin[1] + y * this.spacing,
            this.origin[2] + z * this.spacing,
          )
          bvh.closestPointToPoint(point, nearest)
          ray.origin.copy(point)
          const hit = bvh.raycastFirst(ray, THREE.DoubleSide)
          const inside = Boolean(hit?.face && hit.face.normal.dot(ray.direction) > 0)
          this.baseline[i] = Math.max(nearest.distance, this.spacing * 0.001) * (inside ? -1 : 1)
          if (inside) solid++
          const vertex = geometry.index
            ? geometry.index.getX(nearest.faceIndex * 3)
            : nearest.faceIndex * 3
          this.colors.set(
            [sourceColors.getX(vertex), sourceColors.getY(vertex), sourceColors.getZ(vertex)],
            i * 3,
          )
        }
    this.values = this.baseline.slice()
    this.originalCount = solid
    this.currentCount = solid
    geometry.dispose()
    if (!solid) throw new Error('No closed tissue volume was found.')
  }
  private index(x: number, y: number, z: number) {
    return x + this.size[0] * (y + this.size[1] * z)
  }

  cut(cut: TissueCut): TissueResult {
    if (cut.kind === 'bite' && (!Number.isFinite(cut.radius) || cut.radius <= 0))
      throw new Error('Invalid bite size')
    if (cut.kind === 'snare' && Math.abs(Math.hypot(...cut.normal) - 1) > 0.01)
      throw new Error('Invalid snare plane')
    const before = this.currentCount
    let solid = 0
    for (let z = 0; z < this.size[2]; z++)
      for (let y = 0; y < this.size[1]; y++)
        for (let x = 0; x < this.size[0]; x++) {
          const i = this.index(x, y, z)
          const p = [
            this.origin[0] + x * this.spacing,
            this.origin[1] + y * this.spacing,
            this.origin[2] + z * this.spacing,
          ]
          const subtraction =
            cut.kind === 'bite'
              ? cut.radius -
                Math.hypot(p[0] - cut.center[0], p[1] - cut.center[1], p[2] - cut.center[2])
              : p.reduce((sum, v, axis) => sum + (v - cut.origin[axis]) * cut.normal[axis], 0)
          if (subtraction > this.values[i])
            this.heat[i] = cut.kind === 'snare' || cut.thermal ? 1 : 0
          const value = Math.max(this.values[i], subtraction)
          this.values[i] =
            Math.abs(value) < this.spacing * 0.001
              ? (value < 0 ? -1 : 1) * this.spacing * 0.001
              : value
          if (this.values[i] < 0) solid++
        }
    this.currentCount = solid
    return {
      ...this.surface(),
      remainingFraction: solid / this.originalCount,
      removedMm3: (before - solid) * this.spacing ** 3,
      spacingMm: this.spacing,
    }
  }

  /** Closed, consistently outward-wound triangles, including the fresh interior of each bite. */
  surface(): MeshData {
    const positions: number[] = [],
      colors: number[] = [],
      indices: number[] = []
    const intersections = new Map<string, number>()
    const point = (id: number): THREE.Vector3 => {
      const x = id % this.size[0],
        y = Math.floor(id / this.size[0]) % this.size[1],
        z = Math.floor(id / (this.size[0] * this.size[1]))
      return new THREE.Vector3(
        this.origin[0] + x * this.spacing,
        this.origin[1] + y * this.spacing,
        this.origin[2] + z * this.spacing,
      )
    }
    for (let z = 0; z < this.size[2] - 1; z++)
      for (let y = 0; y < this.size[1] - 1; y++)
        for (let x = 0; x < this.size[0] - 1; x++) {
          const ids = corners.map((c) => this.index(x + c[0], y + c[1], z + c[2]))
          if (ids.every((i) => this.values[i] < 0) || ids.every((i) => this.values[i] >= 0))
            continue
          for (const tet of tetrahedra) {
            const vertices = tet.map((k) => ids[k])
            const inside = vertices.filter((i) => this.values[i] < 0),
              outside = vertices.filter((i) => this.values[i] >= 0)
            if (!inside.length || !outside.length) continue
            const normal = outside
              .map(point)
              .reduce((a, p) => a.add(p), new THREE.Vector3())
              .divideScalar(outside.length)
              .sub(
                inside
                  .map(point)
                  .reduce((a, p) => a.add(p), new THREE.Vector3())
                  .divideScalar(inside.length),
              )
              .normalize()
            const polygon: { p: THREE.Vector3; index: number }[] = []
            for (const [a, b] of tetraEdges) {
              const ia = vertices[a],
                ib = vertices[b],
                va = this.values[ia],
                vb = this.values[ib]
              if (va < 0 === vb < 0) continue
              const t = va / (va - vb),
                p = point(ia).lerp(point(ib), t)
              const baseline = this.baseline[ia] * (1 - t) + this.baseline[ib] * t
              const fresh = baseline < -this.spacing * 0.55
              const color = fresh
                ? this.heat[ia] * (1 - t) + this.heat[ib] * t > 0.5
                  ? [0.31, 0.18, 0.1]
                  : [0.38, 0.035, 0.028]
                : [0, 1, 2].map(
                    (c) => this.colors[ia * 3 + c] * (1 - t) + this.colors[ib * 3 + c] * t,
                  )
              const key = ia < ib ? `${ia}:${ib}` : `${ib}:${ia}`
              let index = intersections.get(key)
              if (index === undefined) {
                index = positions.length / 3
                positions.push(...p.toArray())
                colors.push(...color)
                intersections.set(key, index)
              }
              polygon.push({ p, index })
            }
            const center = polygon
              .reduce((a, v) => a.add(v.p), new THREE.Vector3())
              .divideScalar(polygon.length)
            const u = polygon[0].p.clone().sub(center).normalize(),
              v = new THREE.Vector3().crossVectors(normal, u).normalize()
            polygon.sort(
              (a, b) =>
                Math.atan2(a.p.clone().sub(center).dot(v), a.p.clone().sub(center).dot(u)) -
                Math.atan2(b.p.clone().sub(center).dot(v), b.p.clone().sub(center).dot(u)),
            )
            for (let i = 1; i < polygon.length - 1; i++) {
              const tri = [polygon[0], polygon[i], polygon[i + 1]]
              const winding = tri[1].p.clone().sub(tri[0].p).cross(tri[2].p.clone().sub(tri[0].p))
              if (winding.lengthSq() === 0) continue
              if (winding.dot(normal) < 0) [tri[1], tri[2]] = [tri[2], tri[1]]
              for (const vertex of tri) indices.push(vertex.index)
            }
          }
        }
    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
      indices: new Uint32Array(indices),
    }
  }
}
