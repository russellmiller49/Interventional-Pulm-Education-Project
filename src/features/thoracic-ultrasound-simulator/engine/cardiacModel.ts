import type {
  CardiacChamberSpec,
  CardiacModelSpec,
  CardiacValveSpec,
  ThoracicProbeState,
  ThoracicStructureLabel,
  ThoracicVolume,
  Vec3,
} from '../types'

import { beamDirection, probeOrigin } from './sectorGeometry'
import { sampleLabel } from './sampleVolume'

export const DEFAULT_CARDIAC_CINE_FPS = 12

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function fract(value: number) {
  return value - Math.floor(value)
}

function smoothstep01(value: number) {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function mix(a: number, b: number, amount: number) {
  return a + (b - a) * amount
}

/** Cardiac cycle phase in [0, 1), with time zero at ventricular end diastole. */
export function cardiacPhaseAtTime(timeSec: number, heartRateBpm: number) {
  return fract(Math.max(0, timeSec) * (Math.max(1, heartRateBpm) / 60))
}

/**
 * Smooth, asymmetric ventricular contraction: brisk systole followed by a
 * longer diastolic rest. The function is periodic and exactly zero at phase 0.
 */
export function cardiacContraction(phase: number) {
  const p = fract(phase)
  if (p < 0.08) return 0
  if (p < 0.3) return smoothstep01((p - 0.08) / 0.22)
  if (p < 0.5) return 1 - smoothstep01((p - 0.3) / 0.2)
  return 0
}

export interface CardiacRenderState {
  spec: CardiacModelSpec
  phase: number
  contraction: number
  respiratoryOffsetMm: number
  chambers: Array<CardiacChamberSpec & { radiiMm: Vec3 }>
}

export function createCardiacRenderState(
  spec: CardiacModelSpec | undefined,
  timeSec = 0,
): CardiacRenderState | null {
  if (!spec) {
    return null
  }

  const phase = cardiacPhaseAtTime(timeSec, spec.defaultHeartRateBpm)
  const contraction = cardiacContraction(phase)
  const respiratoryPhase = fract(Math.max(0, timeSec) * (spec.respiratoryRateBpm / 60))
  const respiratoryOffsetMm = spec.respiratoryExcursionMm * Math.sin(respiratoryPhase * Math.PI * 2)

  return {
    spec,
    phase,
    contraction,
    respiratoryOffsetMm,
    chambers: spec.chambers.map((chamber) => ({
      ...chamber,
      radiiMm: chamber.endDiastolicRadiiMm.map((radius, index) =>
        mix(radius, chamber.endSystolicRadiiMm[index], contraction),
      ) as Vec3,
    })),
  }
}

/** Transform an LPS point into the model's [left, anterior, base] frame. */
export function worldToCardiacLocal(world: Vec3, state: CardiacRenderState): Vec3 {
  const { spec, respiratoryOffsetMm } = state
  const respiratoryShift: Vec3 = [
    spec.basis.baseAxis[0] * respiratoryOffsetMm,
    spec.basis.baseAxis[1] * respiratoryOffsetMm,
    spec.basis.baseAxis[2] * respiratoryOffsetMm,
  ]
  const relative: Vec3 = [
    world[0] - spec.centerLpsMm[0] - respiratoryShift[0],
    world[1] - spec.centerLpsMm[1] - respiratoryShift[1],
    world[2] - spec.centerLpsMm[2] - respiratoryShift[2],
  ]

  return [
    dot(relative, spec.basis.leftAxis),
    dot(relative, spec.basis.anteriorAxis),
    dot(relative, spec.basis.baseAxis),
  ]
}

function cardiacLocalToWorld(local: Vec3, state: CardiacRenderState): Vec3 {
  const { spec, respiratoryOffsetMm } = state
  return [
    spec.centerLpsMm[0] +
      spec.basis.leftAxis[0] * local[0] +
      spec.basis.anteriorAxis[0] * local[1] +
      spec.basis.baseAxis[0] * (local[2] + respiratoryOffsetMm),
    spec.centerLpsMm[1] +
      spec.basis.leftAxis[1] * local[0] +
      spec.basis.anteriorAxis[1] * local[1] +
      spec.basis.baseAxis[1] * (local[2] + respiratoryOffsetMm),
    spec.centerLpsMm[2] +
      spec.basis.leftAxis[2] * local[0] +
      spec.basis.anteriorAxis[2] * local[1] +
      spec.basis.baseAxis[2] * (local[2] + respiratoryOffsetMm),
  ]
}

function ellipsoidScore(local: Vec3, center: Vec3, radii: Vec3) {
  const x = (local[0] - center[0]) / Math.max(0.5, radii[0])
  const y = (local[1] - center[1]) / Math.max(0.5, radii[1])
  const z = (local[2] - center[2]) / Math.max(0.5, radii[2])
  return x * x + y * y + z * z
}

function insideChamber(local: Vec3, chamber: CardiacRenderState['chambers'][number]) {
  if (ellipsoidScore(local, chamber.centerLocalMm, chamber.radiiMm) > 1) {
    return false
  }

  const crescent = clamp01(chamber.crescent ?? 0)
  if (crescent <= 0.01) {
    return true
  }

  // RV-like crescent: subtract an overlapping ellipsoid displaced toward the
  // septum. `crescent` controls how much of the otherwise ellipsoidal pool is
  // removed while retaining a continuous outer rim.
  const cutoutCenter: Vec3 = [
    chamber.centerLocalMm[0] + chamber.radiiMm[0] * mix(1.35, 0.78, crescent),
    chamber.centerLocalMm[1] - chamber.radiiMm[1] * 0.08,
    chamber.centerLocalMm[2],
  ]
  const cutoutRadii: Vec3 = [
    chamber.radiiMm[0] * mix(0.55, 0.82, crescent),
    chamber.radiiMm[1] * 0.9,
    chamber.radiiMm[2] * 1.04,
  ]
  return ellipsoidScore(local, cutoutCenter, cutoutRadii) > 1
}

function valveLeafletHit(local: Vec3, valve: CardiacValveSpec, contraction: number) {
  const normal = normalize(valve.normalLocal)
  const helper: Vec3 = Math.abs(normal[2]) < 0.88 ? [0, 0, 1] : [1, 0, 0]
  const tangentA = normalize(cross(normal, helper))
  const tangentB = normalize(cross(normal, tangentA))
  const relative: Vec3 = [
    local[0] - valve.centerLocalMm[0],
    local[1] - valve.centerLocalMm[1],
    local[2] - valve.centerLocalMm[2],
  ]
  const a = dot(relative, tangentA)
  const b = dot(relative, tangentB)
  if (a * a + b * b > valve.radiusMm * valve.radiusMm) {
    return false
  }

  const opening = valve.timing === 'atrioventricular' ? 1 - contraction : contraction
  // Two thin leaflets form a shallow V while open and meet in a bright plane
  // while closed. The finite radius avoids an unphysical line across the heart.
  const leafletSlope = Math.tan((opening * 24 * Math.PI) / 180)
  const leafletPlane = Math.sign(a || 1) * Math.abs(a) * leafletSlope * 0.42
  return Math.abs(dot(relative, normal) - leafletPlane) <= valve.thicknessMm / 2
}

export interface CardiacAcousticSample {
  label: ThoracicStructureLabel
  /** Reference point used to advect myocardial speckle with wall motion. */
  textureWorld: Vec3
}

/**
 * Resolve procedural cardiac substructure inside a case's original whole-heart
 * segmentation. Outside `heart`, the source label and point pass through.
 */
export function sampleCardiacAnatomy(
  sourceLabel: ThoracicStructureLabel,
  world: Vec3,
  state: CardiacRenderState | null,
): CardiacAcousticSample {
  if (!state || sourceLabel !== state.spec.sourceLabel) {
    return { label: sourceLabel, textureWorld: world }
  }

  const local = worldToCardiacLocal(world, state)

  if (state.spec.valves.some((valve) => valveLeafletHit(local, valve, state.contraction))) {
    return { label: 'cardiacValve', textureWorld: world }
  }

  if (state.chambers.some((chamber) => insideChamber(local, chamber))) {
    return { label: 'cardiacBlood', textureWorld: world }
  }

  // Evaluate wall speckle at an approximately undeformed reference point so
  // the grain translates with the myocardium instead of boiling each frame.
  const wallScale = 1 - state.contraction * 0.055
  const referenceLocal: Vec3 = [local[0] / wallScale, local[1] / wallScale, local[2] / wallScale]
  return { label: 'myocardium', textureWorld: cardiacLocalToWorld(referenceLocal, state) }
}

/** Cheap gate that prevents the cine clock from rendering when no heart is in the fan. */
export function probeIntersectsCardiacModel(
  volume: ThoracicVolume | null,
  probe: ThoracicProbeState | null,
  beamCount = 28,
  sampleCount = 96,
) {
  if (!volume?.cardiacModel || !probe) {
    return false
  }

  const origin = probeOrigin(probe)
  const maxDepthMm = probe.depthCm * 10
  const requiredHitBeams = Math.max(2, Math.ceil(beamCount * 0.08))
  let hitBeams = 0
  for (let beam = 0; beam < beamCount; beam += 1) {
    const angle = probe.sectorAngleDeg * (beam / Math.max(1, beamCount - 1) - 0.5)
    const direction = beamDirection(probe, angle)
    for (let sample = 0; sample < sampleCount; sample += 1) {
      const depthMm = (maxDepthMm * sample) / Math.max(1, sampleCount - 1)
      if (
        sampleLabel(volume, [
          origin[0] + direction[0] * depthMm,
          origin[1] + direction[1] * depthMm,
          origin[2] + direction[2] * depthMm,
        ]) === volume.cardiacModel.sourceLabel
      ) {
        hitBeams += 1
        if (hitBeams >= requiredHitBeams) {
          return true
        }
        break
      }
    }
  }

  return false
}
