import { BufferAttribute, BufferGeometry } from 'three'
import { INTERSECTED, MeshBVH, NOT_INTERSECTED } from 'three-mesh-bvh'

import type { Vec3 } from '../vec'
import type { TriangleMesh } from './proxyGlb'
import { segmentBoxLowerBound, segmentTriangleDistance } from './segmentTriangle'

/**
 * A capsule is a segment with a radius: the sleeve, the telescope's shaft, a tool's shaft and its
 * working element are each one (plan, section 4.5). Its clearance from a surface is the exact
 * distance from its segment to the nearest triangle, less its radius: negative means the two
 * overlap.
 *
 * `three-mesh-bvh` finds the triangles near the segment (`shapecast`, which behaves correctly); the
 * distance to each is this module's own exact test, since the library's is wrong for a segment that
 * passes through a triangle. Boxes are visited in the order of a cheap lower bound on their
 * distance, and skipped once that bound lies further than the best distance found.
 */
export interface Capsule {
  readonly start: Vec3
  readonly end: Vec3
  readonly radius: number
}

export interface Clearance {
  /** Distance from the capsule's surface to the mesh; negative where they overlap. */
  readonly clearance: number
  /** The triangle that holds the nearest point, numbered as in the mesh, or -1 if there is none. */
  readonly triangle: number
}

export interface MeshIndex {
  readonly bvh: MeshBVH
  readonly mesh: TriangleMesh
  /** The BVH's own order of triangles, each as its number in `mesh`. */
  readonly original: Uint32Array
}

/**
 * A BVH over the mesh. `three-mesh-bvh` reorders the index buffer it is given, so it is given a
 * copy: the mesh is never changed, and every triangle the index reports is numbered as in the mesh.
 */
export function indexMesh(mesh: TriangleMesh): MeshIndex {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3))
  geometry.setIndex(new BufferAttribute(Uint32Array.from(mesh.indices), 1))
  const bvh = new MeshBVH(geometry)
  const numbered = new Map<string, number>()
  for (let f = 0; f < mesh.indices.length; f += 3) {
    numbered.set(`${mesh.indices[f]},${mesh.indices[f + 1]},${mesh.indices[f + 2]}`, f / 3)
  }
  const reordered = geometry.index?.array ?? mesh.indices
  const original = new Uint32Array(reordered.length / 3)
  for (let f = 0; f < reordered.length; f += 3) {
    const found = numbered.get(`${reordered[f]},${reordered[f + 1]},${reordered[f + 2]}`)
    if (found === undefined) throw new Error('The BVH holds a triangle the mesh does not')
    original[f / 3] = found
  }
  return { bvh, mesh, original }
}

/**
 * The capsule's clearance from the mesh, and the triangle that sets it. With `below`, only a
 * clearance less than it is looked for: boxes further away are passed by, and if nothing is nearer
 * the answer is `below` itself with no triangle, so several queries can share one running least.
 */
export function capsuleClearance(
  index: MeshIndex,
  capsule: Capsule,
  stopBelow = -Infinity,
  below = Infinity,
): Clearance {
  const { start, end, radius } = capsule
  let best = below + radius
  let bestTriangle = -1
  const lowerBound = (box: {
    min: { x: number; y: number; z: number }
    max: { x: number; y: number; z: number }
  }) =>
    segmentBoxLowerBound(
      start,
      end,
      box.min.x,
      box.min.y,
      box.min.z,
      box.max.x,
      box.max.y,
      box.max.z,
    )
  index.bvh.shapecast({
    boundsTraverseOrder: lowerBound,
    intersectsBounds: (box, _isLeaf, score) =>
      (score ?? lowerBound(box)) > best ? NOT_INTERSECTED : INTERSECTED,
    intersectsTriangle: (triangle, triangleIndex) => {
      // skip a triangle whose bounding sphere already lies further than the best so far
      const { a, b, c } = triangle
      const cx = (a.x + b.x + c.x) / 3
      const cy = (a.y + b.y + c.y) / 3
      const cz = (a.z + b.z + c.z) / 3
      const reach = Math.sqrt(
        Math.max(
          (a.x - cx) ** 2 + (a.y - cy) ** 2 + (a.z - cz) ** 2,
          (b.x - cx) ** 2 + (b.y - cy) ** 2 + (b.z - cz) ** 2,
          (c.x - cx) ** 2 + (c.y - cy) ** 2 + (c.z - cz) ** 2,
        ),
      )
      if (pointSegmentDistance(cx, cy, cz, start, end) - reach >= best) return false
      const d = segmentTriangleDistance(
        start,
        end,
        [triangle.a.x, triangle.a.y, triangle.a.z],
        [triangle.b.x, triangle.b.y, triangle.b.z],
        [triangle.c.x, triangle.c.y, triangle.c.z],
      )
      if (d < best) {
        best = d
        bestTriangle = triangleIndex
      }
      return best - radius < stopBelow
    },
  })
  return bestTriangle < 0
    ? { clearance: below, triangle: -1 }
    : { clearance: best - radius, triangle: index.original[bestTriangle] }
}

function pointSegmentDistance(x: number, y: number, z: number, p0: Vec3, p1: Vec3): number {
  const dx = p1[0] - p0[0]
  const dy = p1[1] - p0[1]
  const dz = p1[2] - p0[2]
  const length2 = dx * dx + dy * dy + dz * dz
  let t = length2 > 0 ? ((x - p0[0]) * dx + (y - p0[1]) * dy + (z - p0[2]) * dz) / length2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  return Math.hypot(p0[0] + t * dx - x, p0[1] + t * dy - y, p0[2] + t * dz - z)
}
