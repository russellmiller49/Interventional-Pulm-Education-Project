import type { ScopePose } from '../../components/space/types'
import type { Instrument } from './instrument'
import type { PortFrame } from './portDefinition'
import { add, cross, dot, normalize, radians, rotate, scale, sub, type Vec3 } from './vec'

/**
 * The fulcrum: a pose in the port's frame (two tilts, a depth and a roll) made into the telescope's
 * axis, its tip, the parts that can collide and the optical frame (plan, section 4.5).
 *
 * The axis starts along the corridor and turns about the pivot: across the ribs toward the head for
 * a positive tilt across, and along the ribs for a positive tilt along. The tip sits `depthMm` from
 * the pivot along the axis. Ribs are rigid; no yielding of the chest wall is modelled.
 */
export interface ScopeGeometry {
  readonly axis: Vec3
  readonly tip: Vec3
  /** The sleeve inside the pleural space: from where the axis crosses the pleura to its tip. */
  readonly sleeve: { readonly start: Vec3; readonly end: Vec3; readonly radius: number }
  /** The telescope beyond the sleeve, or null while its tip is inside the sleeve. */
  readonly shaft: { readonly start: Vec3; readonly end: Vec3; readonly radius: number } | null
  /** Where the axis crosses the plane of the chest-wall patch, and how far that is from its centre. */
  readonly patchOffsetMm: number
  readonly camera: { readonly origin: Vec3; readonly forward: Vec3; readonly up: Vec3 }
}

/** How far along the axis from the pivot the sleeve's tip lies. */
export function sleeveTipDepth(port: PortFrame, device: Instrument): number {
  return port.pleuraDepthMm + device.sleeveBeyondPleuraMm
}

/**
 * The largest tilt across the ribs: the sleeve, `2r` wide, touches a rib when its width across the
 * gap plus the rib's depth times the tilt's tangent fills the gap. The gap and the depth are
 * measured on the scan; the ribs are rigid slabs.
 */
export function acrossRibsLimitDeg(port: PortFrame, device: Instrument): number {
  const width = 2 * device.sleeveRadiusMm
  let lo = 0
  let hi = Math.PI / 2 - 1e-6
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2
    if (width / Math.cos(mid) + port.ribDepthMm * Math.tan(mid) > port.ribGapMm) hi = mid
    else lo = mid
  }
  return (lo * 180) / Math.PI
}

/** Whether the two tilts lie inside the ellipse the port allows. */
export function tiltAllowed(pose: ScopePose, port: PortFrame, device: Instrument): boolean {
  const across = pose.tiltAcrossRibsDeg / acrossRibsLimitDeg(port, device)
  const along = pose.tiltAlongRibsDeg / device.alongRibsLimitDeg
  return across * across + along * along <= 1 + 1e-12
}

export function scopeAxis(pose: ScopePose, port: PortFrame): Vec3 {
  // Tilt across the ribs turns the axis toward acrossRibs, about alongRibs (alongRibs × inward is
  // acrossRibs); then the tilt along the ribs turns it toward alongRibs, about the tilted acrossRibs
  // (acrossRibs × inward is −alongRibs, hence the minus).
  const first = rotate(port.inward, port.alongRibs, radians(pose.tiltAcrossRibsDeg))
  const turnedAcross = rotate(port.acrossRibs, port.alongRibs, radians(pose.tiltAcrossRibsDeg))
  return normalize(rotate(first, turnedAcross, -radians(pose.tiltAlongRibsDeg)))
}

export function scopeGeometry(pose: ScopePose, port: PortFrame, device: Instrument): ScopeGeometry {
  const axis = scopeAxis(pose, port)
  const at = (depth: number) => add(port.pivot, scale(axis, depth))
  const tip = at(pose.depthMm)
  // where the axis crosses the pleura's plane at the port
  const crossing = port.pleuraDepthMm / Math.max(dot(axis, port.inward), 1e-6)
  const sleeveEnd = sleeveTipDepth(port, device)
  const radial = sub(at(crossing), port.pleura)
  const patchOffsetMm = Math.sqrt(Math.max(0, dot(radial, radial) - dot(radial, port.inward) ** 2))
  // the picture's up at roll zero is toward the head, then turned with the roll
  const headward = sub(port.acrossRibs, scale(axis, dot(port.acrossRibs, axis)))
  const up = rotate(normalize(headward), axis, radians(pose.rollDeg))
  return {
    axis,
    tip,
    sleeve: {
      start: at(crossing),
      end: at(Math.min(sleeveEnd, Math.max(crossing, pose.depthMm))),
      radius: device.sleeveRadiusMm,
    },
    shaft:
      pose.depthMm > sleeveEnd
        ? { start: at(sleeveEnd), end: tip, radius: device.shaftRadiusMm }
        : null,
    patchOffsetMm,
    camera: { origin: add(tip, scale(up, device.opticOffsetMm)), forward: axis, up },
  }
}

/** The telescope's right, for the picture: forward × up. */
export function cameraRight(camera: ScopeGeometry['camera']): Vec3 {
  return cross(camera.forward, camera.up)
}
