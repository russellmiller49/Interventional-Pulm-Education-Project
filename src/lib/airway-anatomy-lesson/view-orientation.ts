import type { PatientDirection, ViewReference } from './types'

/**
 * Where patient directions land on screen in each view of the airway lesson.
 *
 * Patient space is LPS: +x toward the patient's left, +y posterior, +z superior. Every view is a
 * camera that is never mirrored, so the right edge of the picture is `looking × top`. That single
 * cross product decides which side the patient's right falls on:
 *
 * - Bronchoscope from the head of the bed, looking down an airway with anterior at 12 o'clock:
 *   the patient's right is at 3 o'clock, on the right of the image. However the scope is turned,
 *   the patient's right stays a quarter turn clockwise from anterior.
 * - Axial CT (seen from the feet), coronal CT and the 3D model (seen from the front): the patient's
 *   right is on the left of the image.
 */
export const PATIENT_AXES: Record<PatientDirection, readonly [number, number, number]> = {
  right: [-1, 0, 0],
  left: [1, 0, 0],
  anterior: [0, -1, 0],
  posterior: [0, 1, 0],
  superior: [0, 0, 1],
  inferior: [0, 0, -1],
}

/** Bronchoscope at the head of the bed, looking down an airway, cartilage rings at 12 o'clock. */
export const HEAD_OF_BED_LOOKING_DOWN: ViewReference = { looking: 'inferior', top: 'anterior' }
/** Axial CT as radiology displays it: seen from the feet, anterior at the top. */
export const CT_AXIAL_VIEW: ViewReference = { looking: 'superior', top: 'anterior' }
/** Coronal CT as radiology displays it: seen from the front, head at the top. */
export const CT_CORONAL_VIEW: ViewReference = { looking: 'posterior', top: 'superior' }
/** The 3D models open seen from the front, head at the top (orbit controls then turn them). */
export const MODEL_FRONT_VIEW: ViewReference = { looking: 'posterior', top: 'superior' }

/**
 * Both airway GLBs (`fluoroview/airway_segments_new.glb`, `airway-lesson/models/larynx.glb`) are
 * stored in glTF's Y-up frame: x toward the patient's left, y superior, z anterior. Three.js reads
 * them that way, so a camera on +z already looks at the front of the patient with the head up.
 */
export const MODEL_ROTATION: [number, number, number] = [0, 0, 0]
export const MODEL_CAMERA_POSITION: [number, number, number] = [0, 0.4, 3.4]

type Vec3 = readonly [number, number, number]

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export function directionVector(toward: PatientDirection | readonly PatientDirection[]): Vec3 {
  const parts = typeof toward === 'string' ? [toward] : toward
  const sum = parts.reduce<[number, number, number]>(
    (acc, part) => {
      const axis = PATIENT_AXES[part]
      return [acc[0] + axis[0], acc[1] + axis[1], acc[2] + axis[2]]
    },
    [0, 0, 0],
  )
  const length = Math.hypot(...sum) || 1
  return [sum[0] / length, sum[1] / length, sum[2] / length]
}

/**
 * The clock hour (12 at the top, clockwise, may be fractional) at which a patient direction sits
 * in a view; null when it runs along the line of sight (straight ahead or straight behind).
 */
export function clockOf(
  reference: ViewReference,
  toward: PatientDirection | readonly PatientDirection[],
): number | null {
  const forward = PATIENT_AXES[reference.looking]
  const up = PATIENT_AXES[reference.top]
  if (Math.abs(dot(forward, up)) > 1e-6) throw new Error('A view cannot look toward its own top')
  const right = cross(forward, up)
  const v = directionVector(toward)
  const x = dot(v, right)
  const y = dot(v, up)
  if (Math.hypot(x, y) < 0.2) return null
  const degrees = ((((Math.atan2(x, y) * 180) / Math.PI) % 360) + 360) % 360
  const hour = degrees / 30
  return hour < 0.5 ? hour + 12 : hour
}

/** Shortest distance between two clock positions, in hours (0–6). */
export function clockDistance(a: number, b: number): number {
  const d = (((a - b) % 12) + 12) % 12
  return Math.min(d, 12 - d)
}

/** Which half of the picture the patient's right falls on in a view. */
export function patientRightSide(reference: ViewReference): 'left' | 'right' | 'top' | 'bottom' {
  const hour = clockOf(reference, 'right')
  if (hour === null) throw new Error('The patient’s right runs along the line of sight')
  if (clockDistance(hour, 3) < 1.5) return 'right'
  if (clockDistance(hour, 9) < 1.5) return 'left'
  return clockDistance(hour, 12) < 1.5 ? 'top' : 'bottom'
}

const RIM_LETTERS: Record<PatientDirection, string> = {
  anterior: 'A',
  posterior: 'P',
  right: 'R',
  left: 'L',
  superior: 'S',
  inferior: 'I',
}

/** Rim letters for a schematic endoscopic view: every patient direction that has a side. */
export function rimLetters(reference: ViewReference): { clock: number; letter: string }[] {
  return (Object.keys(RIM_LETTERS) as PatientDirection[]).flatMap((direction) => {
    const clock = clockOf(reference, direction)
    return clock === null ? [] : [{ clock: Math.round(clock), letter: RIM_LETTERS[direction] }]
  })
}
