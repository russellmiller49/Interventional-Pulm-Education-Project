import type { ThoracicProbeState, Vec3 } from '../types'

const degreesToRadians = Math.PI / 180

/**
 * Curvature radius of the virtual curvilinear transducer face, in mm. Shared by
 * the renderer's scan-conversion and its inverse so a screen pixel maps back to
 * the same world ray the beam marched.
 */
export const FACE_RADIUS_MM = 45

/**
 * Probe contact point in the LPS millimetre frame. This is the image apex (the
 * transducer face), which the scene renders and every beam and needle ray
 * originates from.
 */
export function probeOrigin(probe: ThoracicProbeState): Vec3 {
  return [probe.lateralMm, probe.posteriorMm, probe.craniocaudalMm]
}

/**
 * The probe's contact frame in the LPS millimetre basis, as a function of the
 * approach angle around the body's craniocaudal (S) axis.
 *
 * `outward` is the body-surface normal the probe rests against; `inward` is the
 * direction the beam fires (toward the interior); `tangent` is the
 * circumferential sweep direction. At approachDeg 0 this reproduces the legacy
 * posterior approach exactly (outward = +P, inward = -P/anterior, tangent = +L).
 */
export function approachFrame(probe: ThoracicProbeState): {
  outward: Vec3
  inward: Vec3
  tangent: Vec3
} {
  const phi = (probe.approachDeg ?? 0) * degreesToRadians
  const sin = Math.sin(phi)
  const cos = Math.cos(phi)
  return {
    outward: [sin, cos, 0],
    inward: [-sin, -cos, 0],
    tangent: [cos, -sin, 0],
  }
}

/**
 * Central beam axis: the inward approach direction rocked craniocaudally by
 * tilt. At approachDeg 0 this is [0, -cos(tilt), sin(tilt)] (the legacy value).
 */
export function probeDepthAxis(probe: ThoracicProbeState): Vec3 {
  const tiltRad = probe.tiltDeg * degreesToRadians
  const { inward } = approachFrame(probe)
  const cosT = Math.cos(tiltRad)
  return [inward[0] * cosT, inward[1] * cosT, Math.sin(tiltRad)]
}

/**
 * Sector sweep axis: the circumferential tangent rotated toward the
 * craniocaudal axis by marker rotation. At approachDeg 0 this is
 * [cos(rotation), 0, sin(rotation)] (the legacy value).
 */
export function probeLateralAxis(probe: ThoracicProbeState): Vec3 {
  const markerRad = probe.rotationDeg * degreesToRadians
  const { tangent } = approachFrame(probe)
  const cosM = Math.cos(markerRad)
  return [tangent[0] * cosM, tangent[1] * cosM, Math.sin(markerRad)]
}

/**
 * Unit beam direction for a given angle within the sector fan.
 *
 * The probe frame rotates around the body's craniocaudal axis by the approach
 * angle; marker rotation spins the sweep axis; tilt rocks the depth axis
 * cranio-caudally; the sector angle mixes sweep and depth so the returned vector
 * sweeps a fan. All axes share the same [L, P, S] basis as the meshes and
 * labelmap, so no coordinate conversion is needed downstream.
 */
export function beamDirection(probe: ThoracicProbeState, sectorAngleDeg: number): Vec3 {
  const sectorRad = sectorAngleDeg * degreesToRadians
  const lateralAxis = probeLateralAxis(probe)
  const depthAxis = probeDepthAxis(probe)
  const lateralWeight = Math.sin(sectorRad)
  const depthWeight = Math.cos(sectorRad)

  const direction: Vec3 = [
    lateralAxis[0] * lateralWeight + depthAxis[0] * depthWeight,
    lateralAxis[1] * lateralWeight + depthAxis[1] * depthWeight,
    lateralAxis[2] * lateralWeight + depthAxis[2] * depthWeight,
  ]
  const length = Math.hypot(direction[0], direction[1], direction[2]) || 1

  return [direction[0] / length, direction[1] / length, direction[2] / length]
}

export function projectBeamToWorld(
  probe: ThoracicProbeState,
  sectorAngleDeg: number,
  depthMm: number,
): Vec3 {
  const origin = probeOrigin(probe)
  const direction = beamDirection(probe, sectorAngleDeg)

  return [
    origin[0] + direction[0] * depthMm,
    origin[1] + direction[1] * depthMm,
    origin[2] + direction[2] * depthMm,
  ]
}

/**
 * Unit normal of the ultrasound imaging plane (the plane the fan sweeps). The
 * fan is spanned by the lateral sweep axis and the central beam axis, so the
 * normal is their cross product. Used to slice the 3D anatomy along the exact
 * plane the B-mode is imaging.
 */
export function scanPlaneNormal(probe: ThoracicProbeState): Vec3 {
  const lateralAxis = probeLateralAxis(probe)
  const depthAxis = probeDepthAxis(probe)

  const normal: Vec3 = [
    lateralAxis[1] * depthAxis[2] - lateralAxis[2] * depthAxis[1],
    lateralAxis[2] * depthAxis[0] - lateralAxis[0] * depthAxis[2],
    lateralAxis[0] * depthAxis[1] - lateralAxis[1] * depthAxis[0],
  ]
  const length = Math.hypot(normal[0], normal[1], normal[2]) || 1
  return [normal[0] / length, normal[1] / length, normal[2] / length]
}

/**
 * Inverse of the renderer's scan conversion: map a pixel in the rendered
 * B-mode image (intrinsic width x height) back to the world point that beam
 * sampled, or null when the pixel lies outside the sector. Mirrors the geometry
 * in `simulateBMode`'s `scanConvert`.
 *
 * `contactDepthMm` is the air standoff the renderer crops before the fan starts
 * (`probeContactDepthMm`): the render samples display depth d at ray depth
 * `contactDepthMm + d`, so the inverse must add it back or identification is
 * shallow by that amount whenever the probe hovers off the skin.
 */
export function sectorImageToWorld(
  probe: ThoracicProbeState,
  width: number,
  height: number,
  imageX: number,
  imageY: number,
  contactDepthMm = 0,
): Vec3 | null {
  const maxDepthMm = probe.depthCm * 10
  const halfRad = (probe.sectorAngleDeg / 2) * degreesToRadians
  const sinHalf = Math.sin(halfRad)
  const cosHalf = Math.cos(halfRad)

  const scale = Math.min(
    (height - 14) / (maxDepthMm + FACE_RADIUS_MM * (1 - cosHalf)),
    (width / 2 - 4) / ((FACE_RADIUS_MM + maxDepthMm) * sinHalf),
  )
  const apexY = 8 - FACE_RADIUS_MM * scale * cosHalf
  const centerX = width / 2

  const dx = imageX - centerX
  const dy = imageY - apexY
  const radiusMm = Math.hypot(dx, dy) / scale
  const angleRad = Math.atan2(dx, dy)

  if (Math.abs(angleRad) > halfRad) {
    return null
  }
  if (radiusMm < FACE_RADIUS_MM || radiusMm > FACE_RADIUS_MM + maxDepthMm) {
    return null
  }

  return projectBeamToWorld(
    probe,
    angleRad / degreesToRadians,
    contactDepthMm + (radiusMm - FACE_RADIUS_MM),
  )
}

export function needleDirection(probe: ThoracicProbeState): Vec3 {
  return beamDirection(probe, probe.needleAngleDeg)
}

export function needleEndpoint(probe: ThoracicProbeState, depthMm: number): Vec3 {
  const origin = probeOrigin(probe)
  const direction = needleDirection(probe)
  return [
    origin[0] + direction[0] * depthMm,
    origin[1] + direction[1] * depthMm,
    origin[2] + direction[2] * depthMm,
  ]
}
