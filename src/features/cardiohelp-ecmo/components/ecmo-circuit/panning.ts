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

/**
 * Clamp a pan target back into the fence; returns the translation applied
 * (null when the target was already inside).
 *
 * The caller MUST apply the same translation to the camera position.
 * OrbitControls pans camera and target together, so the fence has to undo the
 * overshoot on both — the same rig-translation rule the glide-home follows.
 * Clamping only the target changes the camera-target distance and orientation
 * at the boundary, and repeated drags against it walk the camera away while
 * the target stays pinned to the wall. The camera itself is deliberately not
 * boxed: the fence constrains the point being framed, not where the camera
 * orbits from.
 */
export function clampPanTarget(target: THREE.Vector3): THREE.Vector3 | null {
  const clamped = target.clone().clamp(PAN_TARGET_BOUNDS.min, PAN_TARGET_BOUNDS.max)
  if (clamped.equals(target)) return null
  const shift = clamped.clone().sub(target)
  target.copy(clamped)
  return shift
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

/** The slice of an OrbitControls instance the pan rules read and write. */
export interface BedsidePanControls {
  enablePan: boolean
  readonly target: THREE.Vector3
  readonly object: { readonly position: THREE.Vector3 }
  update(): void
}

/**
 * Start a controls instance pan-locked — once per instance, never per render.
 *
 * The ref callback that calls this runs on every commit whose callback identity changed, and this
 * component re-renders every modeled second with the simulation clock. The first correction locked
 * unconditionally in the ref, which re-asserted `enablePan = false` on every clock tick — the very
 * split-authority defect the refactor existed to remove, reintroduced one seam over, and caught by
 * re-running the production pan probe against the rebuilt page. Tracking the last-locked instance
 * makes the lock a fact about the instance's lifetime: a new controls object starts locked before
 * its first frame, and a re-attachment of the same object changes nothing, so the frame rule stays
 * the only writer after mount.
 */
export function lockBedsidePanOnNewInstance(
  lastLocked: { current: BedsidePanControls | null },
  instance: BedsidePanControls | null,
): void {
  if (instance && lastLocked.current !== instance) {
    lastLocked.current = instance
    instance.enablePan = false
  }
}

/**
 * The whole of the bedside pan behaviour, applied to the live controls once per frame.
 *
 * This function is the single owner of `enablePan`. The scene passes no `enablePan` prop at all —
 * a declarative prop and an imperative per-frame write were two authorities over one field, and
 * whichever one you read the code from looked like it was losing. The instance starts locked when
 * it attaches (see the scene's ref callback) and this rule decides everything after: pan unlocks
 * with zoom, the target stays fenced to the scene as a rig correction, and a panned rig glides
 * home (snaps under reduced motion) once the camera is back out past the unlock distance.
 *
 * Extracted so the integration test drives the very code the frame runs, with a real
 * three-stdlib OrbitControls under real pointer events, rather than re-deriving the rules.
 */
export function applyBedsidePanFrameRules(
  controls: BedsidePanControls,
  delta: number,
  reduceMotion: boolean,
  interacting: boolean,
): void {
  const distance = controls.object.position.distanceTo(controls.target)
  controls.enablePan = panEnabledAtDistance(distance)
  const fenceShift = clampPanTarget(controls.target)
  if (fenceShift) {
    // The fence is a rig correction: camera moves with the target, exactly as during a pan and
    // the glide-home. Target-only clamping let drags against the boundary change the zoom and
    // walk the camera off-scene.
    controls.object.position.add(fenceShift)
    controls.update()
  }
  if (!controls.enablePan && !interacting) {
    const shift = retargetTowardDefault(controls.target, delta, reduceMotion)
    if (shift) {
      // Camera moves with the target — undoing a pan is a rig translation.
      controls.object.position.add(shift)
      controls.update()
    }
  }
}
