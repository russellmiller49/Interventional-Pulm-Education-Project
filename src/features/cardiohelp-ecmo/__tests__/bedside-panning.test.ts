import * as THREE from 'three'

import {
  BLENDER_PLACEMENT,
  CAMERA_TARGET,
  CONSOLE_PLACEMENT,
  PATIENT_POSITION,
} from '../components/ecmo-circuit/constants'
import { buildCircuitLayout } from '../components/ecmo-circuit/layout'
import {
  clampPanTarget,
  DEFAULT_CAMERA_DISTANCE,
  DEFAULT_TARGET,
  PAN_TARGET_BOUNDS,
  PAN_UNLOCK_DISTANCE,
  panEnabledAtDistance,
  retargetTowardDefault,
} from '../components/ecmo-circuit/panning'

/**
 * Pan rules for the bedside scene: locked at the default framing, unlocked
 * zoomed in, fenced to the scene, and self-restoring on zoom-out.
 */

describe('pan unlock', () => {
  it('keeps the default framing pan-locked but unlocks within the zoom range', () => {
    // The default camera must NOT pan (guided lessons reference that framing)…
    expect(panEnabledAtDistance(DEFAULT_CAMERA_DISTANCE)).toBe(false)
    // …but the threshold must be reachable inside the allowed zoom range
    // (minDistance 4.1), or the feature could never activate.
    expect(PAN_UNLOCK_DISTANCE).toBeGreaterThan(4.1)
    expect(PAN_UNLOCK_DISTANCE).toBeLessThan(DEFAULT_CAMERA_DISTANCE)
    expect(panEnabledAtDistance(4.1)).toBe(true)
  })
})

describe('pan target fence', () => {
  it('contains the default target and every labeled object in both tracks', () => {
    expect(PAN_TARGET_BOUNDS.containsPoint(new THREE.Vector3(...CAMERA_TARGET))).toBe(true)
    expect(
      PAN_TARGET_BOUNDS.containsPoint(
        new THREE.Vector3(CONSOLE_PLACEMENT.x, 0, CONSOLE_PLACEMENT.z),
      ),
    ).toBe(true)
    expect(
      PAN_TARGET_BOUNDS.containsPoint(
        new THREE.Vector3(BLENDER_PLACEMENT.x, 0, BLENDER_PLACEMENT.z),
      ),
    ).toBe(true)
    expect(PAN_TARGET_BOUNDS.containsPoint(new THREE.Vector3(...PATIENT_POSITION))).toBe(true)
    for (const mode of ['vv', 'va'] as const) {
      for (const label of buildCircuitLayout(mode).labels) {
        expect(PAN_TARGET_BOUNDS.containsPoint(label.position)).toBe(true)
      }
    }
  })

  it('clamps a target that leaves the scene and leaves one inside alone', () => {
    const outside = new THREE.Vector3(9, 4, -8)
    expect(clampPanTarget(outside)).toBe(true)
    expect(PAN_TARGET_BOUNDS.containsPoint(outside)).toBe(true)

    const inside = new THREE.Vector3(0.5, 0, 0.5)
    const before = inside.clone()
    expect(clampPanTarget(inside)).toBe(false)
    expect(inside.equals(before)).toBe(true)
  })
})

describe('return to the canonical framing', () => {
  it('glides a panned rig home, preserving the camera-target distance', () => {
    const pan = new THREE.Vector3(1.2, 0.2, -0.6)
    const target = new THREE.Vector3(...CAMERA_TARGET).add(pan)
    const camera = new THREE.Vector3(4.15, 2.6, 5.0).add(pan)
    const initialDistance = camera.distanceTo(target)
    let ticks = 0
    for (let step = 0; step < 600 && !target.equals(DEFAULT_TARGET); step += 1) {
      const shift = retargetTowardDefault(target, 1 / 60, false)
      if (!shift) break
      camera.add(shift)
      ticks += 1
    }
    expect(ticks).toBeGreaterThan(1)
    expect(target.equals(DEFAULT_TARGET)).toBe(true)
    // A pan is a rig translation; undoing it must not change the zoom. The
    // first implementation moved only the target, so the distance drifted,
    // re-crossed the unlock threshold, and the glide stalled partway.
    expect(camera.distanceTo(target)).toBeCloseTo(initialDistance, 6)
    // Settled: no further motion once home.
    expect(retargetTowardDefault(target, 1 / 60, false)).toBeNull()
  })

  it('snaps home in one step under reduced motion', () => {
    const pan = new THREE.Vector3(1.2, 0.2, -0.6)
    const target = new THREE.Vector3(...CAMERA_TARGET).add(pan)
    const shift = retargetTowardDefault(target, 1 / 60, true)
    expect(shift).not.toBeNull()
    expect(shift!.equals(pan.clone().negate())).toBe(true)
    expect(target.equals(DEFAULT_TARGET)).toBe(true)
  })
})
