import type { ThoracicProbeState, Vec3 } from '../types'

const degreesToRadians = Math.PI / 180

/**
 * Probe contact point in the LPS millimetre frame. This is the image apex (the
 * transducer face), which the scene renders and every beam and needle ray
 * originates from.
 */
export function probeOrigin(probe: ThoracicProbeState): Vec3 {
  return [probe.lateralMm, probe.posteriorMm, probe.craniocaudalMm]
}

/**
 * Unit beam direction for a given angle within the sector fan.
 *
 * Marker rotation spins the lateral axis in the L-S plane; tilt rocks the depth
 * axis cranio-caudally; the sector angle mixes lateral and depth so the returned
 * vector sweeps a fan. All three axes share the same [L, P, S] basis as the
 * meshes and labelmap, so no coordinate conversion is needed downstream.
 */
export function beamDirection(probe: ThoracicProbeState, sectorAngleDeg: number): Vec3 {
  const markerRad = probe.rotationDeg * degreesToRadians
  const tiltRad = probe.tiltDeg * degreesToRadians
  const sectorRad = sectorAngleDeg * degreesToRadians

  const lateralAxis: Vec3 = [Math.cos(markerRad), 0, Math.sin(markerRad)]
  const depthAxis: Vec3 = [0, -Math.cos(tiltRad), Math.sin(tiltRad)]
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
