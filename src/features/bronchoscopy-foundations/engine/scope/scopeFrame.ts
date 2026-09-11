import {
  minus,
  rollFrame,
  scalar,
  steerFrame,
  unit,
  type OpticalFrame,
  type Point3,
} from '@/lib/bronchoscopy-core/frame'

import type { ScopeInputs } from '../../components/scope/types'
import { clampDeflectionDeg, normalizeRotationDeg } from './scopeInputs'

/**
 * The five controls become one optical frame (drill D02).
 *
 * Control-section rotation rolls the camera and the bending plane together; the thumb lever then
 * bends the tip within that rolled plane. There is one bending plane and no sideways bend, so a
 * branch at the side of the image is reached by rotating first — which is the lesson.
 *
 * `base` is the transported centerline frame at the tip: the shaft is assumed to lie along the
 * centerline, with rotation reaching the tip one to one (no loops, torque loss or friction — a
 * simplification each view's boundary sentence discloses).
 *
 * Sign: `rotationDeg` is clockwise as the operator sees the control section. Rolling the camera
 * clockwise turns the image counterclockwise, so a branch at three o'clock comes to twelve, into
 * the plane the lever bends toward. `rollFrame` turns the camera counterclockwise for a positive
 * angle, hence the minus.
 */
export function scopeFrame(
  base: OpticalFrame,
  inputs: Pick<ScopeInputs, 'rotationDeg' | 'deflectionDeg'>,
): OpticalFrame {
  const rolled = rollFrame(base, -inputs.rotationDeg)
  return inputs.deflectionDeg ? steerFrame(rolled, 0, inputs.deflectionDeg) : rolled
}

/** The angle, in degrees, between the tip's optical axis and the airway's own direction. */
export function aimAngleDeg(base: OpticalFrame, frame: OpticalFrame): number {
  const cos = Math.max(-1, Math.min(1, scalar(base.forward, frame.forward)))
  return (Math.acos(cos) * 180) / Math.PI
}

/**
 * The rotation and deflection that point the optical axis at a target (the align-to-branch
 * assist): rotate the target's direction into the bending plane, then bend toward it.
 */
export function aimAt(
  base: OpticalFrame,
  target: Point3,
): { readonly rotationDeg: number; readonly deflectionDeg: number } {
  const direction = unit(minus(target, base.position), base.forward)
  const along = scalar(direction, base.forward)
  const perpendicular: Point3 = [
    direction[0] - along * base.forward[0],
    direction[1] - along * base.forward[1],
    direction[2] - along * base.forward[2],
  ]
  const across = Math.hypot(...perpendicular)
  if (across < 1e-6) return { rotationDeg: 0, deflectionDeg: 0 }
  const rotationDeg =
    (Math.atan2(scalar(perpendicular, base.right), scalar(perpendicular, base.up)) * 180) / Math.PI
  const deflectionDeg = (Math.atan2(across, along) * 180) / Math.PI
  return {
    rotationDeg: normalizeRotationDeg(rotationDeg),
    deflectionDeg: clampDeflectionDeg(deflectionDeg),
  }
}
