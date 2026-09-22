import * as THREE from 'three'
import baseline from './fixtures/parent-camera-baseline.json'
import { CT_TRACES, traceById } from '../geometry/native-ct'
import { parentMap } from '../geometry/parent-map'
import { pairedScope, bookScopeUp } from '../geometry/paired-scope'
import {
  orientationFor,
  STANDARD_ORIENTATION,
  turnCt,
  type CtOrientation,
} from '../geometry/orientation'
import {
  axisName,
  cameraBasis,
  ctDisplayCaption,
  lookingDirection,
  parentCameraCaption,
  patientAxesInView,
  projectDirection,
  projectToParentView,
} from '../geometry/reference-frames'
import type { Vec3 } from '../geometry/coordinates'

/**
 * BBT-PRE-REVIEW-03, section A. Three reference frames stay separate: native CT / patient space,
 * the learner's CT display, and the modelled parent camera. The camera is a function of the route
 * and the regional preset only, and every caption names the declared convention for its region
 * rather than a universal rule.
 */
const EVERY_ORIENTATION: CtOrientation[] = []
for (const reflected of [false, true])
  for (const turns of [0, 1, 2, 3] as const) EVERY_ORIENTATION.push({ turns, reflected })
const round = (v: number) => Number(v.toFixed(9))

test('the parent camera and the schematic projections are byte-for-byte those of the base SHA', () => {
  const cameras = baseline.cameras as Record<
    string,
    {
      position: number[]
      direction: number[]
      up: number[]
      atJunction: boolean
      points: {
        edgeId: number
        sourceIndex: number
        number: number
        point: number[]
        x: number
        y: number
      }[]
      axes: { label: string; point: number[] }[]
    }
  >
  let compared = 0
  for (const trace of CT_TRACES)
    trace.checkpoints.forEach((cp, i) => {
      if (!cp.decision) return
      const expected = cameras[`${trace.id}/${cp.id}`]
      expect(expected).toBeDefined()
      const pose = pairedScope(trace, cp.slice, i, false)
      expect(pose.position.map(round)).toEqual(expected.position)
      expect(pose.direction.map(round)).toEqual(expected.direction)
      expect(pose.up.map(round)).toEqual(expected.up)
      expect(pose.atJunction).toBe(expected.atJunction)
      const map = parentMap(trace, i)!
      expect(
        map.points.map((p) => ({
          edgeId: p.edgeId,
          sourceIndex: p.sourceIndex,
          number: p.number,
          point: p.point.map(round),
          x: round(p.x),
          y: round(p.y),
        })),
      ).toEqual(expected.points)
      expect(map.axes.map((a) => ({ label: a.label, point: a.point.map(round) }))).toEqual(
        expected.axes,
      )
      // The added letter is the CT answer order, never the spatial number.
      for (const p of map.points) expect(p.letter).toBe(String.fromCharCode(65 + p.sourceIndex))
      compared++
    })
  expect(compared).toBe(Object.keys(cameras).length)
})

test('the parent camera never reads the CT display: every orientation yields the same pose', () => {
  for (const trace of CT_TRACES)
    trace.checkpoints.forEach((cp, i) => {
      const reference = pairedScope(trace, cp.slice, i, false)
      for (const orientation of EVERY_ORIENTATION) {
        // The display is a screen-only operation; nothing about the pose can depend on it.
        void orientation
        const pose = pairedScope(trace, cp.slice, i, false)
        expect(pose.position).toEqual(reference.position)
        expect(pose.direction).toEqual(reference.direction)
        expect(pose.up).toEqual(reference.up)
      }
      expect(bookScopeUp(trace.preset, reference.direction)).toEqual(reference.up)
    })
})

test('projected patient directions match the schematic basis and never assign an arrow to an axis along the view', () => {
  for (const trace of CT_TRACES)
    trace.checkpoints.forEach((cp, i) => {
      const map = parentMap(trace, i)
      if (!map) return
      const { inPlane, alongView } = patientAxesInView(map.basis)
      expect(inPlane.length + alongView.length * 2).toBe(6)
      // Each historical axis (R, A, S) that is drawn appears in the in-plane set with the same point.
      for (const axis of map.axes) {
        const match = inPlane.find((a) => a.label === axis.label)!
        expect(match.point[0]).toBeCloseTo(axis.point[0], 10)
        expect(match.point[1]).toBeCloseTo(axis.point[1], 10)
        // Its opposite end projects to the negated point.
        const opposite = inPlane.find(
          (a) =>
            (a.point[0] === -match.point[0] && a.point[1] === -match.point[1]) ||
            (Math.abs(a.point[0] + match.point[0]) < 1e-9 &&
              Math.abs(a.point[1] + match.point[1]) < 1e-9),
        )
        expect(opposite).toBeDefined()
      }
      for (const along of alongView) {
        // The axis really does run along the line of sight.
        expect(
          Math.abs(Math.hypot(...projectDirection(map.basis, along.into.vector))),
        ).toBeLessThanOrEqual(0.3)
        expect(
          along.into.vector.map((v, k) => v * map.basis.forward[k]).reduce((a, b) => a + b, 0),
        ).toBeGreaterThan(0)
      }
    })
  // The first division: the camera looks caudally, so the S–I axis runs along the view.
  const map = parentMap(traceById('central-right'), 0)!
  expect(map.alongView.map((a) => a.pair)).toEqual(['S–I'])
  expect(map.alongView[0].into.label).toBe('I')
  expect(map.inPlane.map((a) => a.label).sort()).toEqual(['A', 'L', 'P', 'R'])
})

test('captions name the region’s declared roll and the looking direction, and never a universal rule', () => {
  const forbidden = /always|every (view|region|airway)|universal/i
  let named = 0
  for (const trace of CT_TRACES)
    trace.checkpoints.forEach((cp, i) => {
      const pose = pairedScope(trace, cp.slice, i, false)
      const caption = parentCameraCaption(pose, cp.decision?.parent.airway.code ?? cp.airway.code)
      expect(caption).not.toMatch(forbidden)
      expect(axisName(pose.up)).not.toBeNull()
      expect(caption).toMatch(
        /Reference roll for this region: (anterior|posterior|patient left|patient right|superior|inferior) at the top of the view\./,
      )
      named++
    })
  expect(named).toBeGreaterThan(0)
  // The declared conventions by preset, as the module documents them.
  expect(axisName(bookScopeUp('mirror', [0, 0, -1]))!.name).toBe('anterior')
  expect(axisName(bookScopeUp('rul', [0, 0, 1]))!.name).toBe('patient left')
  expect(axisName(bookScopeUp('upper-division', [0, 0, 1]))!.name).toBe('patient right')
  expect(axisName(bookScopeUp('mirror', [0, -1, 0]))!.name).toBe('superior')
  expect(lookingDirection([0, 0, -1])).toBe('caudally')
  expect(lookingDirection([0, 0, 1])).toBe('cranially')
  expect(lookingDirection([0.6, 0, -0.8])).toBe('mainly caudally')
  expect(lookingDirection([0, -1, 0])).toBe('anteriorly')
  const trachea = pairedScope(traceById('central-right'), 387, 0, false)
  expect(parentCameraCaption(trachea, 'Trachea')).toBe(
    'Model parent view: looking caudally along Trachea toward its division. Reference roll for this region: anterior at the top of the view.',
  )
  for (const orientation of EVERY_ORIENTATION) {
    const caption = ctDisplayCaption(orientation)
    expect(caption).toMatch(/^CT display: /)
    expect(caption).toMatch(/does not move the parent camera/)
  }
  expect(ctDisplayCaption(STANDARD_ORIENTATION)).toContain('Standard axial (A up, R screen-left)')
  expect(ctDisplayCaption(orientationFor('mirror'))).toContain('(A up, L screen-left)')
  expect(ctDisplayCaption(turnCt(STANDARD_ORIENTATION, 'right'))).toContain('(R up, P screen-left)')
})

test('the perspective projection agrees with the rendered three.js camera and the schematic sign convention', () => {
  const fov = 80
  for (const trace of CT_TRACES)
    trace.checkpoints.forEach((cp, i) => {
      if (!cp.decision) return
      const pose = pairedScope(trace, cp.slice, i, false)
      const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 2000)
      const forward = new THREE.Vector3(...pose.direction).normalize()
      camera.position.set(...pose.position)
      camera.up.copy(new THREE.Vector3(...pose.up))
      camera.lookAt(new THREE.Vector3(...pose.position).add(forward))
      camera.updateMatrixWorld()
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
      camera.updateProjectionMatrix()
      const map = parentMap(trace, i)!
      for (const option of cp.decision.options) {
        const ours = projectToParentView(pose, option.lps as Vec3, fov)
        const ndc = new THREE.Vector3(...option.lps).project(camera)
        expect(ours.x).toBeCloseTo(((ndc.x + 1) / 2) * 100, 6)
        expect(ours.y).toBeCloseTo(((1 - ndc.y) / 2) * 100, 6)
        expect(ours.depthMm).toBeGreaterThan(0)
        // The camera looks at the fork; a daughter's point lies on the same side of centre as its
        // orthographic schematic direction, so the letters cannot swap between the two views.
        const schematic = map.points.find((p) => p.edgeId === option.sourceEdgeId)!
        if (Math.abs(schematic.point[0]) > 0.15)
          expect(Math.sign(ours.x - 50)).toBe(Math.sign(schematic.point[0]))
      }
      // The look-at point itself projects to the centre.
      const centre = projectToParentView(pose, cp.decision.junctionLps as Vec3, fov)
      expect(centre.x).toBeCloseTo(50, 6)
      expect(centre.y).toBeCloseTo(50, 6)
    })
  // A point behind the camera is reported as not drawable, not placed on screen.
  const pose = pairedScope(traceById('central-right'), 387, 0, false)
  const behind: Vec3 = [
    pose.position[0] - pose.direction[0] * 20,
    pose.position[1] - pose.direction[1] * 20,
    pose.position[2] - pose.direction[2] * 20,
  ]
  expect(projectToParentView(pose, behind).inFront).toBe(false)
  const basis = cameraBasis(pose.direction, pose.up)
  expect(Math.hypot(...basis.forward)).toBeCloseTo(1, 12)
  expect(basis.forward.reduce((n, v, k) => n + v * basis.up[k], 0)).toBeCloseTo(0, 12)
  expect(basis.right.reduce((n, v, k) => n + v * basis.up[k], 0)).toBeCloseTo(0, 12)
})
