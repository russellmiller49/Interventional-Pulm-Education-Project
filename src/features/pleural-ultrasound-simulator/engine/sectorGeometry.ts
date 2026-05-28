import type { PleuralProbeState, Vec3 } from '../types'

const degreesToRadians = Math.PI / 180

export function probeOrigin(probe: PleuralProbeState): Vec3 {
  return [probe.lateralMm, probe.posteriorMm, probe.craniocaudalMm]
}

export function beamDirection(probe: PleuralProbeState, sectorAngleDeg: number): Vec3 {
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
  probe: PleuralProbeState,
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

export function needleDirection(probe: PleuralProbeState): Vec3 {
  return beamDirection(probe, probe.needleAngleDeg)
}

export function needleEndpoint(probe: PleuralProbeState, depthMm: number): Vec3 {
  const origin = probeOrigin(probe)
  const direction = needleDirection(probe)
  return [
    origin[0] + direction[0] * depthMm,
    origin[1] + direction[1] * depthMm,
    origin[2] + direction[2] * depthMm,
  ]
}
