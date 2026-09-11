import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import * as THREE from 'three'
import { makeFrame, steerFrame, rollFrame } from '../../src/lib/bronchoscopy-core/frame'
import { patientToTrainerWeb, trainerWebToPatient } from '../../src/lib/bronchoscopy-core/devices'
import { createIndexes, buildRoute } from '../web/src/route'
import { rasToIndex, indexToRas } from '../web/src/geometry'
import {
  scopeCameraBackLimitMm,
  normalizeScopeAdjustment,
} from '../web/src/components/BronchoscopeView'
import { readTrainerSession, sessionSource, type TrainerSession } from '../web/src/session'
import { residualHuAt } from '../../src/lib/bronchoscopy-core/ct-overlay'
import type { WebCase } from '../web/src/types'

const root = 'navigation_module/web/public/cases/default/'
const current = JSON.parse(fs.readFileSync(root + 'case.json', 'utf8')) as WebCase
const baseline = JSON.parse(
  execFileSync('git', ['show', `origin/main:${root}case.json`], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  }),
) as WebCase
assert.deepEqual(current.airway, baseline.airway)
assert.deepEqual(current.noduleTargets, baseline.noduleTargets)
assert.equal(
  fs.readFileSync(root + 'scope_calibration.json', 'utf8'),
  execFileSync('git', ['show', `origin/main:${root}scope_calibration.json`], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  }),
)
const indexes = createIndexes(current),
  oldIndexes = createIndexes(baseline)
let checkedRoutes = 0,
  checkedStops = 0
for (const terminal of current.airway.terminalNodeIds) {
  const route = buildRoute(terminal, indexes),
    oldRoute = buildRoute(terminal, oldIndexes)
  assert.deepEqual(route, oldRoute)
  checkedRoutes++
  for (const decision of route.decisions) {
    assert.equal(
      scopeCameraBackLimitMm(decision, indexes),
      scopeCameraBackLimitMm(decision, oldIndexes),
    )
    assert.ok(decision.options.length >= 2)
    assert.ok(decision.options.some((o) => o.isCorrect))
    checkedStops++
  }
}
const defaultRoute = buildRoute(current.initial.snappedTerminalNodeId, indexes)
assert.equal(defaultRoute.decisions.length, 6)
assert.equal(defaultRoute.decisions.at(-1)?.nodeId, 91)
assert.ok(!defaultRoute.decisions.some((d) => d.nodeId === 156))
for (const directionLps of [
  [0, -1, 0, -1, 0, 0, 0, 0, -1],
  [0.8, -0.6, 0, 0.6, 0.8, 0, 0, 0, 1],
]) {
  const ct = { ...current.ct, directionLps },
    index = { i: 12.2, j: 34.5, k: 101.1 },
    restored = rasToIndex(indexToRas(index, ct), ct)
  for (const key of ['i', 'j', 'k'] as const) assert.ok(Math.abs(index[key] - restored[key]) < 1e-7)
}
const signed = gunzipSync(fs.readFileSync(root + current.ct.signedPreview!.url))
assert.equal(createHash('sha256').update(signed).digest('hex'), current.ct.signedPreview!.sha256)
assert.equal(signed.byteLength, current.ct.sizeXyz.reduce((a, b) => a * b, 1) * 2)
const voxels = new Int16Array(signed.buffer, signed.byteOffset, signed.byteLength / 2)
assert.ok(voxels.some((v) => v < 0))
assert.ok(voxels.some((v) => v > 350))
const geometry = {
  sizeXyz: [3, 3, 3] as [number, number, number],
  spacingXyzMm: [1, 1, 1] as [number, number, number],
  originLps: [0, 0, 0] as [number, number, number],
  directionLps: [1, 0, 0, 0, 1, 0, 0, 0, 1],
}
const overlay = {
  geometry,
  residual: new Int16Array(27).fill(600),
  alpha: new Uint8Array(27).fill(255),
}
assert.equal(residualHuAt(overlay, [10.5, 20.5, 30.5], [10, 20, 30]), 600)
assert.equal(residualHuAt(overlay, [0, 0, 0], [10, 20, 30]), 0)
const target = current.noduleTargets![0]
const session: TrainerSession = {
  schema: 'trainer-session/v1',
  caseId: current.caseId,
  source: sessionSource(current),
  activeTargetId: target.id,
  locationId: 'fixture',
  targetLocationIndex: 0,
  mode: 'practice',
  selectedEndpointId: target.initialTerminalNodeId,
  selectedEdgeId: null,
  currentDecisionIndex: 1,
  driveDistanceMm: 120,
  committedPathEdgeIds: [],
  remainingCorrectTerminalIds: [target.initialTerminalNodeId],
  testAttemptResults: {},
  scopeViewProfile: 'flexible',
}
assert.deepEqual(readTrainerSession(JSON.stringify(session), current), session)
assert.equal(
  readTrainerSession(JSON.stringify({ ...session, source: 'other-case' }), current),
  null,
)
assert.equal(
  readTrainerSession(JSON.stringify({ ...session, committedPathEdgeIds: [999999] }), current),
  null,
)
assert.equal(readTrainerSession('not json', current), null)
assert.equal(
  readTrainerSession(JSON.stringify({ ...session, selectedEdgeId: 999999 }), current),
  null,
)
assert.equal(normalizeScopeAdjustment({ rollDeg: 127 }).rollDeg, 127)
const calibration = JSON.parse(fs.readFileSync(root + 'scope_calibration.json', 'utf8'))
const adjustments = Object.values(calibration.profiles)
  .flatMap((profile: any) => Object.values(profile.adjustments))
  .map((value) => normalizeScopeAdjustment(value as any))
let checkedCameraAdjustments = 0
for (const adjustment of adjustments)
  for (const live of [
    { rollDeg: 0, pitchDeg: 0 },
    { rollDeg: 123, pitchDeg: 27 },
  ]) {
    // Preserve the old calibrated yaw/pitch/roll semantics while using the shared LPS frame.
    const start = makeFrame([0, 0, 0], [0.24, -0.17, -1], [0, -1, 0])
    let shared = rollFrame(
      steerFrame(start, -adjustment.yawDeg, adjustment.pitchDeg),
      adjustment.rollDeg,
    )
    shared = steerFrame(rollFrame(shared, live.rollDeg), 0, live.pitchDeg)
    const forward = new THREE.Vector3(...patientToTrainerWeb(start.forward)),
      upHint = new THREE.Vector3(0, 0, -1)
    const right = new THREE.Vector3().crossVectors(forward, upHint).normalize(),
      up = new THREE.Vector3().crossVectors(right, forward).normalize()
    const yaw = new THREE.Quaternion().setFromAxisAngle(
      up,
      THREE.MathUtils.degToRad(adjustment.yawDeg),
    )
    forward.applyQuaternion(yaw).normalize()
    right.applyQuaternion(yaw).normalize()
    const pitch = new THREE.Quaternion().setFromAxisAngle(
      right,
      THREE.MathUtils.degToRad(adjustment.pitchDeg),
    )
    forward.applyQuaternion(pitch).normalize()
    up.applyQuaternion(pitch).normalize()
    const camera = new THREE.PerspectiveCamera()
    camera.up.copy(up)
    camera.lookAt(forward)
    camera.rotateZ(THREE.MathUtils.degToRad(adjustment.rollDeg))
    camera.rotateZ(THREE.MathUtils.degToRad(live.rollDeg))
    camera.rotateX(THREE.MathUtils.degToRad(live.pitchDeg))
    camera.updateMatrixWorld(true)
    const oldForward = trainerWebToPatient(camera.getWorldDirection(new THREE.Vector3()).toArray()),
      oldUp = trainerWebToPatient(
        new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).toArray(),
      )
    assert.ok(Math.hypot(...oldForward.map((v, i) => v - shared.forward[i])) < 1e-6)
    assert.ok(Math.hypot(...oldUp.map((v, i) => v - shared.up[i])) < 1e-6)
    checkedCameraAdjustments++
  }
console.log(
  JSON.stringify(
    {
      checkedRoutes,
      checkedStops,
      checkedCameraAdjustments,
      defaultDecisions: defaultRoute.decisions.length,
      lastDecision: defaultRoute.decisions.at(-1)?.nodeId,
      savedCalibrationsUnchanged: true,
      signedHu: true,
      obliqueTransforms: true,
      noduleResidual: true,
      sessionValidation: true,
    },
    null,
    2,
  ),
)
