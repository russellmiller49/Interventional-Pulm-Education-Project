import { plus, times, type Point3 } from '@/lib/bronchoscopy-core/frame'
import { scopeFrame } from '../../engine/scope/scopeFrame'

/** Presentation dimensions only. Neither a device specification nor a second scope engine. */
export const BENDING_SECTION_LENGTH = 32
export const BENCH_TRANSITION_MS = 220
export interface BenchMotion {
  depth: number
  rotation: number
  deflection: number
  suction: number
}

export function interpolateBenchMotion(from: BenchMotion, to: BenchMotion, fraction: number) {
  const t = Math.max(0, Math.min(1, fraction))
  const eased = t * t * (3 - 2 * t)
  const mix = (a: number, b: number) => a + (b - a) * eased
  // A/D across the wrapped readout must not make the physical handle spin a full revolution.
  const rotationDelta = ((((to.rotation - from.rotation + 180) % 360) + 360) % 360) - 180
  return {
    depth: mix(from.depth, to.depth),
    rotation: from.rotation + rotationDelta * eased,
    deflection: mix(from.deflection, to.deflection),
    suction: mix(from.suction, to.suction),
  }
}

const base = {
  position: [0, 0, 0] as Point3,
  forward: [0, 0, 1] as Point3,
  right: [-1, 0, 0] as Point3,
  up: [0, 1, 0] as Point3,
}

/** Enlarged close-up: fixed proximal attachment, constant-length bend, same engine directions.
 * The inset is not a world-space camera or a representation of the bench's measured depth.
 */
export function bendingSectionSample(rotationDeg: number, deflectionDeg: number, t: number) {
  const rolled = scopeFrame(base, { rotationDeg, deflectionDeg: 0 })
  const theta = (deflectionDeg * Math.PI) / 180
  const fraction = Math.max(0, Math.min(1, t))
  const along =
    Math.abs(theta) < 1e-7
      ? BENDING_SECTION_LENGTH * fraction
      : (BENDING_SECTION_LENGTH * Math.sin(theta * fraction)) / theta
  const across =
    Math.abs(theta) < 1e-7 ? 0 : (BENDING_SECTION_LENGTH * (1 - Math.cos(theta * fraction))) / theta
  return {
    position: plus(times(base.forward, along), times(rolled.up, across)),
    frame: scopeFrame(base, { rotationDeg, deflectionDeg: deflectionDeg * fraction }),
  }
}
