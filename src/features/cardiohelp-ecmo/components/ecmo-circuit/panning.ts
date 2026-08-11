import * as THREE from 'three'

import { CAMERA_POSITION, CAMERA_TARGET } from './constants'

// Pure pan rules for the bedside OrbitControls, kept out of the component so
// jest can hold them to a contract without driving WebGL.

/**
 * Camera-to-target distance below which panning unlocks.
 *
 * At the default framing the whole scene is in view and a free pan would only
 * let a learner lose it (which is why pan shipped disabled); zoomed in, pan is
 * what lets them move along the patient or across the console. The threshold
 * sits between the closest allowed zoom and the default distance, so the
 * default view never pans but one scroll click inward does.
 */
export const PAN_UNLOCK_DISTANCE = 6.2

/**
 * World box the pan target may move in: the bed and patient, the console, the
 * HLS module, and the sweep-gas blender, with working margin. Clamping the
 * target here means panning can frame any object but never leave the scene.
 */
export const PAN_TARGET_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-2.4, -0.72, -1.7),
  new THREE.Vector3(2.8, 0.7, 1.9),
)

export const DEFAULT_TARGET = new THREE.Vector3(...CAMERA_TARGET)

export function panEnabledAtDistance(distance: number): boolean {
  return distance < PAN_UNLOCK_DISTANCE
}

/** Clamp a pan target in place; returns true when it had left the bounds. */
export function clampPanTarget(target: THREE.Vector3): boolean {
  const clamped = target.clone().clamp(PAN_TARGET_BOUNDS.min, PAN_TARGET_BOUNDS.max)
  if (clamped.equals(target)) return false
  target.copy(clamped)
  return true
}

/**
 * Ease a panned target home once the user zooms back out past the unlock
 * distance, so the canonical framing every lesson references is restored
 * rather than left wherever the last pan ended. Under reduced motion the
 * return is a snap instead of a glide.
 *
 * Returns the translation applied this tick (null when already home). The
 * caller MUST apply the same translation to the camera position: a pan
 * translates camera and target together, so undoing it must too. Moving only
 * the target changes the camera-target distance, which can drop back below
 * the unlock threshold mid-glide and stall the return partway — the exact
 * failure the first implementation shipped.
 */
export function retargetTowardDefault(
  target: THREE.Vector3,
  delta: number,
  reduceMotion: boolean,
): THREE.Vector3 | null {
  if (target.equals(DEFAULT_TARGET)) return null
  const before = target.clone()
  if (reduceMotion || target.distanceTo(DEFAULT_TARGET) < 0.005) {
    target.copy(DEFAULT_TARGET)
  } else {
    target.lerp(DEFAULT_TARGET, Math.min(1, 4 * delta))
  }
  return target.clone().sub(before)
}

/** The default camera sits beyond the unlock distance (sanity anchor for tests). */
export const DEFAULT_CAMERA_DISTANCE = new THREE.Vector3(...CAMERA_POSITION).distanceTo(
  DEFAULT_TARGET,
)
