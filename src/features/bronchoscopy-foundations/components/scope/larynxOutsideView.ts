import larynxData from '../../../../../public/bronchoscopy-foundations/anatomy/larynx/larynx.json'

/**
 * Where the outside view of the larynx is looked at from.
 *
 * The model is turned about its own long axis, so it stays upright however it is turned. The
 * angles are the camera's: `yawDeg` 0 is from the front, 90 from the patient's left, 180 from
 * behind; `pitchDeg` is how far above the horizontal the camera sits.
 */
export interface LarynxOrbit {
  readonly yawDeg: number
  readonly pitchDeg: number
}

/**
 * How the outside model is drawn: `solid` as the larynx is built, bone, cartilage and membrane;
 * `inside` with the cartilages and the wall as glass, so the folds and the scope show.
 */
export type LarynxOutsideLook = 'solid' | 'inside'

type Vec3 = [number, number, number]

const LEFT = larynxData.frameLps.left as Vec3
const ANTERIOR = larynxData.frameLps.anterior as Vec3
const DOWN = larynxData.frameLps.forward as Vec3

/** The picture's up: toward the head, along the model's own long axis. */
export const LARYNX_OUTSIDE_UP: Vec3 = [-DOWN[0], -DOWN[1], -DOWN[2]]

const MIDLINE = larynxData.pathLps[
  Math.round((28 / larynxData.exitMm) * (larynxData.pathLps.length - 1))
] as Vec3
/** The middle of the picture: the middle of the framework, which lies a little behind the path. */
export const LARYNX_OUTSIDE_CENTER = MIDLINE.map((value, k) => value - ANTERIOR[k] * 2) as Vec3

/** How much of the model the picture must hold: hyoid to the third tracheal ring. */
export const LARYNX_OUTSIDE_FIT = { halfWidthMm: 33, halfHeightMm: 54 } as const

/** The view the picture opens on: from the front and the patient's left, a little above. */
export const LARYNX_ORBIT_START: LarynxOrbit = { yawDeg: 40, pitchDeg: 12 }

export const LARYNX_ORBIT_PRESETS = [
  { id: 'front', label: 'Front', orbit: { yawDeg: 0, pitchDeg: 6 } },
  { id: 'side', label: 'Side', orbit: { yawDeg: 90, pitchDeg: 6 } },
  { id: 'back', label: 'Back', orbit: { yawDeg: 180, pitchDeg: 10 } },
  { id: 'above', label: 'Above', orbit: { yawDeg: 180, pitchDeg: 72 } },
] as const satisfies readonly { id: string; label: string; orbit: LarynxOrbit }[]

/** Degrees turned per pixel dragged. */
export const LARYNX_TURN_DEG_PER_PX = 0.5
const PITCH_MIN_DEG = -25
const PITCH_MAX_DEG = 80

/**
 * The model follows the hand: dragging right brings its near side round to the right, and
 * dragging down tips its top toward the viewer.
 */
export function turnLarynxOrbit(orbit: LarynxOrbit, dxPx: number, dyPx: number): LarynxOrbit {
  const yaw = orbit.yawDeg - dxPx * LARYNX_TURN_DEG_PER_PX
  const pitch = orbit.pitchDeg + dyPx * LARYNX_TURN_DEG_PER_PX
  return {
    yawDeg: ((((yaw + 180) % 360) + 360) % 360) - 180,
    pitchDeg: Math.max(PITCH_MIN_DEG, Math.min(PITCH_MAX_DEG, pitch)),
  }
}

/** The unit direction from the middle of the picture to the camera, in patient coordinates. */
export function larynxOrbitDirection(orbit: LarynxOrbit): Vec3 {
  const yaw = (orbit.yawDeg * Math.PI) / 180
  const pitch = (orbit.pitchDeg * Math.PI) / 180
  const front = Math.cos(yaw) * Math.cos(pitch)
  const left = Math.sin(yaw) * Math.cos(pitch)
  const up = Math.sin(pitch)
  return [0, 1, 2].map(
    (k) => ANTERIOR[k] * front + LEFT[k] * left + LARYNX_OUTSIDE_UP[k] * up,
  ) as Vec3
}

/** What the picture shows, said in words for a reader who cannot see it. */
export function larynxOrbitDescription(orbit: LarynxOrbit): string {
  if (orbit.pitchDeg >= 55) return 'from above'
  const yaw = Math.abs(orbit.yawDeg)
  const side = orbit.yawDeg >= 0 ? 'the patient’s left' : 'the patient’s right'
  if (yaw <= 20) return 'from the front'
  if (yaw >= 160) return 'from behind'
  if (yaw < 70) return `from the front and ${side}`
  if (yaw <= 110) return `from ${side}`
  return `from behind and ${side}`
}
