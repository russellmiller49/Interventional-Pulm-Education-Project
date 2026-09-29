/** @jest-environment node */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { capsuleClearance, indexMesh } from '../engine/space/spatial/capsuleQuery'
import { readProxyGlb, type TriangleMesh } from '../engine/space/spatial/proxyGlb'
import { proxyProblems } from '../engine/space/spatial/proxyValidation'
import {
  segmentBoxDistance,
  segmentTriangleDistance,
} from '../engine/space/spatial/segmentTriangle'
import { isInside, windingNumber } from '../engine/space/spatial/windingNumber'
import type { Vec3 } from '../engine/space/vec'
import { anatomyManifest } from '../content/data/generated/anatomy'
import {
  boxMesh,
  halfSpaceMesh,
  judgeClearance,
  judgeSegmentTriangle,
  seededRandom,
  sphereMesh,
  thinPlateMesh,
  torusSegmentMesh,
} from '../test-support/spaceFixtures'

/**
 * The space engine's spatial primitives (slice 10), each against an independent judge that shares
 * no code with it, on analytic scenes.
 */

type Point = [number, number, number]
const TOLERANCE = 1e-6

describe('the segment and triangle distance', () => {
  it('is zero for a segment that passes straight through a triangle, which the library gets wrong', () => {
    const a: Vec3 = [0, 0, 0]
    const b: Vec3 = [10, 0, 0]
    const c: Vec3 = [0, 10, 0]
    expect(segmentTriangleDistance([2, 2, -5], [2, 2, 5], a, b, c)).toBe(0)
    expect(segmentTriangleDistance([2, 2, 1], [2, 2, 5], a, b, c)).toBeCloseTo(1, 12)
    expect(segmentTriangleDistance([-3, -4, 0], [-3, -4, 9], a, b, c)).toBeCloseTo(5, 12)
    expect(segmentTriangleDistance([20, 20, 3], [30, 30, 3], a, b, c)).toBeCloseTo(
      Math.hypot(15, 15, 3),
      12,
    )
  })

  it('agrees with the judge on random segments and triangles', () => {
    const random = seededRandom(7)
    const point = (): Point => [random() * 40 - 20, random() * 40 - 20, random() * 40 - 20]
    for (let n = 0; n < 2000; n += 1) {
      const [p0, p1, a, b, c] = [point(), point(), point(), point(), point()]
      expect(
        Math.abs(segmentTriangleDistance(p0, p1, a, b, c) - judgeSegmentTriangle(p0, p1, a, b, c)),
      ).toBeLessThan(TOLERANCE)
    }
  })

  it('agrees with the judge for a segment and a box', () => {
    const random = seededRandom(11)
    const min: Vec3 = [-5, -3, -2]
    const max: Vec3 = [4, 6, 3]
    const box = boxMesh([...min] as Point, [...max] as Point)
    for (let n = 0; n < 500; n += 1) {
      const p0: Point = [random() * 40 - 20, random() * 40 - 20, random() * 40 - 20]
      const p1: Point = [random() * 40 - 20, random() * 40 - 20, random() * 40 - 20]
      const judged = Math.max(0, judgeClearance(box, p0, p1, 0))
      // Inside the solid box the judge measures to the surface; the box distance is zero there.
      const inside = isInside(p0, box) || isInside(p1, box)
      const d = segmentBoxDistance(p0, p1, min, max)
      if (inside) expect(d).toBe(0)
      else expect(Math.abs(d - judged)).toBeLessThan(TOLERANCE)
    }
  })
})

describe('the capsule clearance, through the BVH', () => {
  const scenes: [string, TriangleMesh][] = [
    ['sphere', sphereMesh(30)],
    ['box', boxMesh([-20, -10, -5], [20, 10, 5])],
    ['half-space', halfSpaceMesh()],
    ['thin plate', thinPlateMesh()],
    ['torus segment', torusSegmentMesh()],
  ]

  it.each(scenes)('is a closed, outward scene: the %s', (name, mesh) => {
    expect(proxyProblems(name, mesh)).toEqual([])
  })

  it.each(scenes)('agrees with the judge over every triangle, for the %s', (_, mesh) => {
    const index = indexMesh(mesh)
    const random = seededRandom(mesh.indices.length)
    for (let n = 0; n < 60; n += 1) {
      const start: Point = [random() * 160 - 80, random() * 160 - 80, random() * 80 - 40]
      const direction: Point = [random() - 0.5, random() - 0.5, random() - 0.5]
      const reach = random() * 60
      const norm = Math.hypot(...direction) || 1
      const end: Point = [
        start[0] + (direction[0] / norm) * reach,
        start[1] + (direction[1] / norm) * reach,
        start[2] + (direction[2] / norm) * reach,
      ]
      const radius = random() * 4
      const { clearance } = capsuleClearance(index, { start, end, radius })
      expect(Math.abs(clearance - judgeClearance(mesh, start, end, radius))).toBeLessThan(TOLERANCE)
    }
  })

  it.each(scenes)(
    'names the triangle that sets the clearance as the mesh numbers it, and leaves the mesh as it was, for the %s',
    (_, mesh) => {
      const before = Uint32Array.from(mesh.indices)
      const index = indexMesh(mesh)
      expect(mesh.indices).toEqual(before)
      const random = seededRandom(mesh.indices.length + 1)
      const vertex = (i: number): Point => [
        mesh.positions[i * 3],
        mesh.positions[i * 3 + 1],
        mesh.positions[i * 3 + 2],
      ]
      for (let n = 0; n < 40; n += 1) {
        const start: Point = [random() * 160 - 80, random() * 160 - 80, random() * 80 - 40]
        const end: Point = [
          start[0] + random() * 30,
          start[1] + random() * 30,
          start[2] + random() * 30,
        ]
        const { clearance, triangle } = capsuleClearance(index, { start, end, radius: 1 })
        const f = triangle * 3
        const own = judgeSegmentTriangle(
          start,
          end,
          vertex(mesh.indices[f]),
          vertex(mesh.indices[f + 1]),
          vertex(mesh.indices[f + 2]),
        )
        expect(Math.abs(own - 1 - clearance)).toBeLessThan(TOLERANCE)
      }
    },
  )

  it('finds a capsule crossing a plate thinner than any step', () => {
    const index = indexMesh(thinPlateMesh())
    expect(
      capsuleClearance(index, { start: [5, 5, -30], end: [5, 5, 30], radius: 1 }).clearance,
    ).toBe(-1)
    expect(
      capsuleClearance(index, { start: [5, 5, 3], end: [5, 5, 30], radius: 1 }).clearance,
    ).toBeCloseTo(1.75, 6)
  })
})

describe('inside and outside', () => {
  it('is decided by winding number, on closed scenes', () => {
    const sphere = sphereMesh(30)
    expect(windingNumber([0, 0, 0], sphere)).toBeCloseTo(1, 9)
    expect(windingNumber([0, 0, 40], sphere)).toBeCloseTo(0, 9)
    const torus = torusSegmentMesh()
    expect(isInside([60, 0.5, 0], torus)).toBe(true)
    expect(isInside([0, 0, 0], torus)).toBe(false)
    expect(isInside([60, -5, 0], torus)).toBe(false)
  })

  it('uses a proxy only if it is closed, outward and finite', () => {
    const sphere = sphereMesh(10)
    expect(proxyProblems('sphere', sphere)).toEqual([])
    const flipped: TriangleMesh = {
      positions: sphere.positions,
      indices: Uint32Array.from(sphere.indices).map((value, i, all) =>
        i % 3 === 1 ? all[i + 1] : i % 3 === 2 ? all[i - 1] : value,
      ),
    }
    expect(proxyProblems('flipped', flipped).join()).toMatch(/not turned outward/)
    const holed: TriangleMesh = { positions: sphere.positions, indices: sphere.indices.subarray(3) }
    expect(proxyProblems('holed', holed).join()).toMatch(/not closed/)
  })
})

describe('the real proxies, where the owner’s local data holds them', () => {
  const root =
    process.env.IP_LOCAL_DATA?.trim() ||
    '/Users/russellmiller/Projects/Interventional-Pulm-Local-Data'
  const packaged = join(root, 'raw-assets/medical-thoracoscopy/anatomy/packaged')
  const available = existsSync(packaged)
  const read = (id: string) => {
    const entry = anatomyManifest.files.find((file) => file.id === id)
    return readProxyGlb(readFileSync(join(packaged, entry?.file ?? '')))
  }

  ;(available ? it : it.skip)(
    'reads both proxy files, every mesh closed and outward, one lung proxy a step',
    () => {
      const space = read('proxy-pleural-space')
      expect(space.nodes[0].name).toBe('proxy:pleural-space')
      expect(proxyProblems('space', space.nodes[0].mesh as TriangleMesh)).toEqual([])
      expect(
        space.nodes.slice(1).every((node) => node.points !== null && node.points.length > 0),
      ).toBe(true)
      const lung = read('proxy-lung')
      expect(lung.nodes.map((node) => node.name)).toEqual(
        Array.from({ length: lung.nodes.length }, (_, k) => `proxy:lung:step ${k}`),
      )
      for (const node of lung.nodes)
        expect(proxyProblems(node.name, node.mesh as TriangleMesh)).toEqual([])
    },
  )
})
