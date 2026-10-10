import * as THREE from 'three'
import { CT_TRACES, traceById } from '../geometry/native-ct'
import {
  AXIS_IN_PLANE_THRESHOLD,
  PATIENT_AXES,
  cameraBasis,
  lookingDirection,
  patientAxesInView,
  projectDirection,
  projectToParentView,
} from '../geometry/reference-frames'
import { SCOPE_FOV_DEG, stationCamera } from '../geometry/route-stations'
import { dot, type Vec3 } from '../geometry/coordinates'

/**
 * The scope's frame is patient space (LPS millimetres): a position, a forward vector and a roll.
 * It is a function of the route only. These tests hold the projection of patient directions and
 * points into that frame, on synthetic cameras and on the scope waiting at every fork.
 */
const stations = CT_TRACES.flatMap((trace) =>
  trace.checkpoints.flatMap((checkpoint, index) =>
    checkpoint.decision ? [{ trace, index, checkpoint, camera: stationCamera(trace, index)! }] : [],
  ),
)

test('a camera basis is right-handed and orthonormal, and holds the reference direction at the top', () => {
  // Looking down the trachea with anterior at the top: the ordinary bronchoscopic view.
  const down = cameraBasis([0, 0, -2], [0, -1, 0])
  expect(down.forward).toEqual([0, 0, -1])
  expect(down.up.map((v) => v + 0)).toEqual([0, -1, 0])
  // The patient's right (−x) is on the viewer's right: the mirror image of a standard axial CT.
  expect(down.right.map((v) => v + 0)).toEqual([-1, 0, 0])
  // A reference that is not perpendicular to the view is squared up, not used as given.
  const tilted = cameraBasis([0, 0.6, -0.8], [0, -1, 0])
  for (const basis of [down, tilted, ...stations.map((s) => s.camera.basis)]) {
    for (const axis of [basis.forward, basis.right, basis.up])
      expect(Math.hypot(...axis)).toBeCloseTo(1, 12)
    expect(dot(basis.forward, basis.right)).toBeCloseTo(0, 12)
    expect(dot(basis.forward, basis.up)).toBeCloseTo(0, 12)
    expect(dot(basis.right, basis.up)).toBeCloseTo(0, 12)
    // right × up points back at the viewer: screen x to the right, screen y up.
    const back = new THREE.Vector3(...basis.right).cross(new THREE.Vector3(...basis.up))
    expect(back.x).toBeCloseTo(-basis.forward[0], 12)
    expect(back.y).toBeCloseTo(-basis.forward[1], 12)
    expect(back.z).toBeCloseTo(-basis.forward[2], 12)
  }
  expect(dot(tilted.up, [0, -1, 0])).toBeGreaterThan(0.7)
})

test('patient directions project to [right, down] on the screen', () => {
  const down = cameraBasis([0, 0, -1], [0, -1, 0])
  const at = (v: Vec3) => projectDirection(down, v).map((n) => n + 0)
  expect(at([1, 0, 0])).toEqual([-1, 0]) // patient-left on screen-left
  expect(at([-1, 0, 0])).toEqual([1, 0])
  expect(at([0, -1, 0])).toEqual([0, -1]) // anterior at the top
  expect(at([0, 1, 0])).toEqual([0, 1])
  expect(at([0, 0, -1])).toEqual([0, 0]) // along the line of sight: no side
  // Looking toward the head with anterior at the top: a standard axial CT.
  const up = cameraBasis([0, 0, 1], [0, -1, 0])
  expect(projectDirection(up, [1, 0, 0]).map((n) => n + 0)).toEqual([1, 0])
  expect(projectDirection(up, [0, 1, 0]).map((n) => n + 0)).toEqual([0, 1])
  // Opposite directions always project to opposite points.
  for (const { camera } of stations)
    for (const axis of PATIENT_AXES) {
      const [x, y] = projectDirection(camera.basis, axis.vector)
      const [ox, oy] = projectDirection(camera.basis, axis.vector.map((v) => -v) as Vec3)
      expect(ox).toBeCloseTo(-x, 12)
      expect(oy).toBeCloseTo(-y, 12)
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(1 + 1e-12)
    }
})

test('an axis along the line of sight is reported as such and never given a screen arrow', () => {
  expect(AXIS_IN_PLANE_THRESHOLD).toBe(0.3)
  expect(stations).toHaveLength(128)
  for (const { camera } of stations) {
    const { inPlane, alongView } = patientAxesInView(camera.basis)
    expect(inPlane.length + alongView.length * 2).toBe(6)
    // Both ends of a drawn axis are drawn, at opposite points.
    for (const axis of inPlane) {
      expect(Math.hypot(...axis.point)).toBeGreaterThan(AXIS_IN_PLANE_THRESHOLD)
      const opposite = inPlane.find(
        (other) =>
          Math.abs(other.point[0] + axis.point[0]) < 1e-9 &&
          Math.abs(other.point[1] + axis.point[1]) < 1e-9,
      )
      expect(opposite).toBeDefined()
      expect(axis.point).toEqual(projectDirection(camera.basis, axis.vector))
    }
    for (const along of alongView) {
      // The axis really does run along the line of sight, and `into` is the far end.
      expect(Math.hypot(...projectDirection(camera.basis, along.into.vector))).toBeLessThanOrEqual(
        AXIS_IN_PLANE_THRESHOLD,
      )
      expect(dot(along.into.vector, camera.basis.forward)).toBeGreaterThan(0)
      expect(dot(along.toward.vector, camera.basis.forward)).toBeLessThan(0)
      expect(along.pair).toBe(
        [along.into.label, along.toward.label]
          .sort((a, b) => 'RLAPSI'.indexOf(a) - 'RLAPSI'.indexOf(b))
          .join('–'),
      )
    }
  }
  // The tracheal fork: the scope looks caudally, so the S–I axis runs along the view.
  const carina = patientAxesInView(stationCamera(traceById('central-right'), 0)!.basis)
  expect(carina.alongView.map((a) => a.pair)).toEqual(['S–I'])
  expect(carina.alongView[0].into.label).toBe('I')
  expect(carina.inPlane.map((a) => a.label).sort()).toEqual(['A', 'L', 'P', 'R'])
  // A synthetic level look to the patient's right: R–L runs along the view, with R the far end.
  const level = patientAxesInView(cameraBasis([-1, 0, 0], [0, 0, 1]))
  expect(level.alongView.map((a) => [a.pair, a.into.label, a.toward.label])).toEqual([
    ['R–L', 'R', 'L'],
  ])
  expect(level.inPlane.map((a) => a.label).sort()).toEqual(['A', 'I', 'P', 'S'])
})

test('the looking direction is said in patient words, "mainly" when it is oblique', () => {
  expect(lookingDirection([0, 0, -1])).toBe('caudally')
  expect(lookingDirection([0, 0, 1])).toBe('cranially')
  expect(lookingDirection([0.6, 0, -0.8])).toBe('mainly caudally')
  expect(lookingDirection([0, -1, 0])).toBe('anteriorly')
  expect(lookingDirection([0, 3, 0])).toBe('posteriorly')
  expect(lookingDirection([-1, 0, 0])).toBe("toward the patient's right")
  expect(lookingDirection([1, 0.2, 0])).toBe("toward the patient's left")
  // At the tracheal fork of every route the scope looks down the trachea.
  for (const trace of CT_TRACES)
    expect([trace.id, lookingDirection(stationCamera(trace, 0)!.direction)]).toEqual([
      trace.id,
      'caudally',
    ])
})

test('the perspective projection agrees with a three.js camera at every fork of every route', () => {
  for (const { checkpoint, camera: pose } of stations) {
    const camera = new THREE.PerspectiveCamera(SCOPE_FOV_DEG, 1, 0.1, 2000)
    const forward = new THREE.Vector3(...pose.direction).normalize()
    camera.position.set(...pose.position)
    camera.up.copy(new THREE.Vector3(...pose.up))
    camera.lookAt(new THREE.Vector3(...pose.position).add(forward))
    camera.updateMatrixWorld()
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
    camera.updateProjectionMatrix()
    for (const option of checkpoint.decision!.options) {
      const ours = projectToParentView(pose, option.lps as Vec3, SCOPE_FOV_DEG)
      const ndc = new THREE.Vector3(...option.lps).project(camera)
      expect(ours.x).toBeCloseTo(((ndc.x + 1) / 2) * 100, 6)
      expect(ours.y).toBeCloseTo(((1 - ndc.y) / 2) * 100, 6)
      expect(ours.depthMm).toBeGreaterThan(0)
      expect(ours.inFront).toBe(ours.x >= 0 && ours.x <= 100 && ours.y >= 0 && ours.y <= 100)
    }
    // A point straight ahead projects to the centre, at its own depth.
    const ahead = pose.position.map((v, axis) => v + pose.direction[axis] * 12) as Vec3
    const centre = projectToParentView(pose, ahead, SCOPE_FOV_DEG)
    expect(centre.x).toBeCloseTo(50, 9)
    expect(centre.y).toBeCloseTo(50, 9)
    expect(centre.depthMm).toBeCloseTo(12, 9)
    expect(centre.inFront).toBe(true)
  }
})

test('a point beside or behind the camera is reported as not drawable, and the field of view scales the picture', () => {
  const pose = stationCamera(traceById('central-right'), 0)!
  const behind = pose.position.map((v, axis) => v - pose.direction[axis] * 20) as Vec3
  const projected = projectToParentView(pose, behind)
  expect(projected.inFront).toBe(false)
  expect(Number.isNaN(projected.x) && Number.isNaN(projected.y)).toBe(true)
  expect(projected.depthMm).toBeCloseTo(-20, 9)
  // 45° off axis sits on the rim at a 90° field of view, and inside it at a wider one.
  const camera = {
    position: [0, 0, 0] as Vec3,
    direction: [0, 0, -1] as Vec3,
    up: [0, -1, 0] as Vec3,
  }
  const offAxis: Vec3 = [-10, 0, -10]
  expect(projectToParentView(camera, offAxis, 90).x).toBeCloseTo(100, 9)
  expect(projectToParentView(camera, offAxis, 90).y).toBeCloseTo(50, 9)
  expect(projectToParentView(camera, offAxis, SCOPE_FOV_DEG).x).toBeLessThan(100)
  // Anterior is up: a point in front of the patient projects above the centre.
  expect(projectToParentView(camera, [0, -5, -10], 90).y).toBeCloseTo(25, 9)
  // Outside the square view: in front of the camera, but not drawable.
  expect(projectToParentView(camera, [-30, 0, -10], 90).inFront).toBe(false)
})
