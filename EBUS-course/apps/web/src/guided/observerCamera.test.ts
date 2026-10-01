import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  assignColumns,
  compassDirections,
  fitDistance,
  fitSphereDistance,
  MODEL_FRAME_AXES,
  projectPoint,
  routeObserverPosition,
  spreadColumn,
} from './observerCamera'
import contract from '../../public/simulator/case-001/models/guided-v2/model-contract.json'

describe('observer camera math (EBUS-PRE-REVIEW-03)', () => {
  it('names the model frame the way devices.ts defines it: +x left, +y superior, +z anterior', () => {
    const by = Object.fromEntries(MODEL_FRAME_AXES.map((a) => [a.key, a.axis]))
    expect(by.L).toEqual([1, 0, 0])
    expect(by.R).toEqual([-1, 0, 0])
    expect(by.S).toEqual([0, 1, 0])
    expect(by.A).toEqual([0, 0, 1])
    expect(by.P).toEqual([0, 0, -1])
  })
  it('projects the compass from the camera basis', () => {
    const camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.1, 100)
    camera.position.set(0, 0, 10)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    const dirs = Object.fromEntries(compassDirections(camera).map((d) => [d.key, d]))
    expect(dirs.L.dx).toBeCloseTo(1, 6) // patient left is screen right in this view
    expect(dirs.S.dy).toBeCloseTo(-1, 6) // superior is screen up
    expect(dirs.A.toward).toBeCloseTo(-1, 6) // anterior points at the viewer
  })
  it('fits a box into the frustum with padding and never returns a degenerate distance', () => {
    const d = fitDistance({ x: 40, y: 20, z: 10 }, 38, 4 / 3)
    const halfFov = Math.tan((38 * Math.PI) / 360)
    expect(d).toBeCloseTo(Math.max(10 / halfFov, 20 / halfFov / (4 / 3)) * 1.18 + 5, 6)
    expect(fitDistance({ x: 0, y: 0, z: 0 }, 38, NaN)).toBeGreaterThanOrEqual(1)
  })
  it('fits a sphere in the narrower half-field regardless of view direction', () => {
    const d = fitSphereDistance(10, 38, 4 / 3, 1)
    expect(d).toBeCloseTo(10 / Math.sin((38 * Math.PI) / 360), 6)
    // A tall canvas is limited horizontally.
    const tall = fitSphereDistance(10, 38, 0.5, 1)
    expect(tall).toBeGreaterThan(d)
    expect(fitSphereDistance(0, 38, NaN)).toBeGreaterThanOrEqual(1)
  })
  it('keeps each existing marker in its initial column through repeated rotation and resize', () => {
    const width = 400
    const first = assignColumns(
      [
        { id: 'a', x: 100 },
        { id: 'b', x: 180 },
        { id: 'c', x: 220 },
        { id: 'd', x: 300 },
      ],
      width,
      new Map(),
    )
    expect([...first.values()]).toEqual(['left', 'left', 'right', 'right'])
    // The scope rotates: anchors drift across the midline by a little. Nothing swaps.
    const drifted = assignColumns(
      [
        { id: 'a', x: 230 },
        { id: 'b', x: 240 },
        { id: 'c', x: 170 },
        { id: 'd', x: 160 },
      ],
      width,
      first,
    )
    expect(drifted.get('a')).toBe('left')
    expect(drifted.get('c')).toBe('right')
    // Crossing the entire canvas must not swap an existing marker, even on repeated passes.
    let columns = first
    for (const resizedWidth of [400, 180, 900, 400, 180, 900]) {
      columns = assignColumns([
        { id: 'a', x: resizedWidth * 1.2 },
        { id: 'b', x: resizedWidth },
        { id: 'c', x: -resizedWidth * 0.2 },
        { id: 'd', x: 0 },
      ], resizedWidth, columns)
      expect([...columns.entries()].sort()).toEqual([...first.entries()].sort())
    }
  })
  it('assigns only new markers and preserves a returning hidden marker by canonical ID', () => {
    const remembered = new Map<string, 'left' | 'right'>([['a', 'left'], ['c', 'right']])
    const original = [...remembered.entries()]
    const next = assignColumns([
      { id: 'a', x: 390 }, { id: 'b', x: 300 }, { id: 'd', x: 100 },
    ], 400, remembered)
    expect(next.get('a')).toBe('left')
    expect(next.get('d')).toBe('left')
    expect(next.get('b')).toBe('right')
    expect(next.has('c')).toBe(false)
    expect([...remembered.entries()]).toEqual(original)
    next.forEach((side, id) => remembered.set(id, side))
    const returned = assignColumns([{ id: 'c', x: 0 }], 200, remembered)
    expect(returned.get('c')).toBe('right')
  })
  it('spreads a column with a minimum gap inside the margins', () => {
    const ys = spreadColumn(
      [
        { id: 'a', y: 150 },
        { id: 'b', y: 152 },
        { id: 'c', y: 153 },
        { id: 'd', y: 290 },
      ],
      300,
      40,
      26,
    )
    const values = ['a', 'b', 'c', 'd'].map((id) => ys.get(id)!)
    for (let i = 1; i < values.length; i++)
      expect(values[i] - values[i - 1]).toBeGreaterThanOrEqual(40 - 1e-9)
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(26)
      expect(v).toBeLessThanOrEqual(300 - 26)
    }
  })
  it('fits six clustered 34 px named labels with clearance in the route-model viewport', () => {
    const height = 412
    const labels = Array.from({ length: 6 }, (_, i) => ({ id: `label-${i}`, y: 400 + i }))
    const ys = [...spreadColumn(labels, height, 40, 18).values()]
    for (let i = 0; i < ys.length; i++) {
      expect(ys[i] - 17).toBeGreaterThanOrEqual(0)
      expect(ys[i] + 17).toBeLessThanOrEqual(height)
      if (i) expect(ys[i] - ys[i - 1] - 34).toBeGreaterThanOrEqual(6)
    }
  })
  it('places the route observer so the contract arrow is not seen end-on', () => {
    const camera = new THREE.PerspectiveCamera(38, 473.5 / 355.1, 0.1, 5000)
    for (const route of contract.routes) {
      for (const key of ['airway', 'esophageal'] as const) {
        const locator = route[key]
        if (!locator) continue
        const a = new THREE.Vector3(...(locator as [number, number, number]))
        const b = new THREE.Vector3(...(route.target as [number, number, number]))
        // The old placement: on the arrow axis, 125 mm out, 24 mm up.
        const old = b
          .clone()
          .add(a.clone().sub(b).normalize().multiplyScalar(125))
          .add(new THREE.Vector3(0, 24, 0))
        const next = routeObserverPosition(a, b)
        const view = (p: THREE.Vector3) => b.clone().sub(p).normalize()
        const arrow = a.clone().sub(b).normalize()
        const oldAngle = THREE.MathUtils.radToDeg(Math.acos(Math.abs(view(old).dot(arrow))))
        const nextAngle = THREE.MathUtils.radToDeg(Math.acos(Math.abs(view(next).dot(arrow))))
        expect(oldAngle).toBeLessThan(12)
        expect(nextAngle).toBeGreaterThan(45)
        camera.position.copy(next)
        camera.lookAt(b)
        camera.updateMatrixWorld()
        const pa = projectPoint(a, camera, 473.5, 355.1),
          pb = projectPoint(b, camera, 473.5, 355.1)
        const nextPx = Math.hypot(pa.x - pb.x, pa.y - pb.y)
        camera.position.copy(old)
        camera.lookAt(b)
        camera.updateMatrixWorld()
        const oa = projectPoint(a, camera, 473.5, 355.1),
          ob = projectPoint(b, camera, 473.5, 355.1)
        const oldPx = Math.hypot(oa.x - ob.x, oa.y - ob.y)
        // Baseline arrows measured 4.5–17.9 px on a 473 × 355 canvas; now each is legible and at
        // least three times longer than before.
        expect(nextPx).toBeGreaterThan(40)
        expect(nextPx).toBeGreaterThan(oldPx * 3)
        expect(pa.inView && pb.inView).toBe(true)
      }
    }
  })
})
