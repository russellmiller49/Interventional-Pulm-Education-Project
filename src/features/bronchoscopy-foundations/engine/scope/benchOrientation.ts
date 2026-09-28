import { projectOptical, scalar, type OpticalFrame } from '@/lib/bronchoscopy-core/frame'
import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'
import type { Vec3 } from '@/lib/airway-anatomy/types'

import type { ScopeState } from '../../components/scope/types'
import { scopeFrame } from './scopeFrame'
import { MODEL_DEFLECTION_LIMIT_DEG } from './scopeInputs'
import { OPTICAL_ASPECT, OPTICAL_FOV_DEG } from './scopeOstia'

/**
 * Where the tip points on the five-controls bench, read from the engine's own optical frame
 * (fellow walkthrough A21, A22).
 *
 * Past about thirty degrees of deflection the bench card leaves the optical field and the scope
 * view is dark whichever way the tip bent, and with the control section turned a quarter the side
 * view of the bending section looks straight because the bend points at the viewer. Neither is a
 * fault of the model: the tip still points somewhere definite. This module reads that direction off
 * the same frame the renderer draws — it never re-derives a motion from the slider values — and
 * expresses it in the bench's own frame, end-on: looking along the shaft toward the card, with the
 * card's top up and its right to the right. That is the camera's own view at zero rotation.
 *
 * `U` is the model's own convention: a positive deflection is "Lever toward U" on the control-head
 * close-up and bends the tip toward the top of the image. Nothing here states a device's or a
 * clinical clock convention.
 */

/** The bench frame the tip starts in (`authoredScopePose`): straight ahead, the card's top, its right. */
export const BENCH_FRAME: OpticalFrame = {
  position: [0, 0, 0],
  forward: [0, 0, 1],
  up: [0, 1, 0],
  right: [-1, 0, 0],
}

/** The bench card's centre: where `ScopeOpticalView` places the bench model. */
export const BENCH_CARD_CENTER: Vec3 = [0, 0, 65]

export interface EndOnDirection {
  /** Toward the card's right, in the end-on view. */
  readonly x: number
  /** Toward the card's top, in the end-on view. */
  readonly y: number
}

export interface BenchTipOrientation {
  /** Angle between the optical axis and straight ahead, in degrees (0 to 180). */
  readonly angleDeg: number
  /** Which way the tip points, end-on; null when it points straight ahead. */
  readonly toward: EndOnDirection | null
  /** The U side of the bending plane, end-on. The image's top edge faces the same way. */
  readonly bendUp: EndOnDirection
  /** Whether the card's centre is inside the round optical field. */
  readonly cardInView: boolean
}

function endOn(vector: readonly number[]): EndOnDirection {
  return { x: scalar(vector as Vec3, BENCH_FRAME.right), y: scalar(vector as Vec3, BENCH_FRAME.up) }
}

export function benchTipOrientation(
  state: Pick<ScopeState, 'pose' | 'place' | 'inputs'>,
): BenchTipOrientation | null {
  if (!state.pose || state.place !== 'bench') return null
  const frame = scopeOpticalFrame(state.pose)
  const along = scalar(frame.forward, BENCH_FRAME.forward)
  const across = endOn(frame.forward)
  const acrossLength = Math.hypot(across.x, across.y)
  const angleDeg = (Math.atan2(acrossLength, along) * 180) / Math.PI
  // The bending plane turns with the control section only; deflection bends within it.
  const rolled = scopeFrame(BENCH_FRAME, {
    rotationDeg: state.inputs.rotationDeg,
    deflectionDeg: 0,
  })
  const projected = projectOptical(BENCH_CARD_CENTER, frame, OPTICAL_ASPECT, OPTICAL_FOV_DEG)
  return {
    angleDeg,
    toward: acrossLength < 1e-6 ? null : { x: across.x / acrossLength, y: across.y / acrossLength },
    bendUp: endOn(rolled.up),
    cardInView: projected !== null && Math.hypot(projected.x * OPTICAL_ASPECT, projected.y) < 1,
  }
}

/** The compass radius for an angle: the model's full deflection range reaches the rim. */
export function compassRadius(angleDeg: number): number {
  return Math.min(1, Math.max(0, angleDeg / MODEL_DEFLECTION_LIMIT_DEG))
}

/** "the card's top", "the card's lower right" — one of eight, from an end-on direction. */
export function cardSideWords(direction: EndOnDirection): string {
  const sector = Math.round((Math.atan2(direction.y, direction.x) * 4) / Math.PI)
  const words: Readonly<Record<string, string>> = {
    '0': 'right',
    '1': 'upper right',
    '2': 'top',
    '3': 'upper left',
    '4': 'left',
    '-4': 'left',
    '-3': 'lower left',
    '-2': 'bottom',
    '-1': 'lower right',
  }
  return `the card’s ${words[String(sector)]}`
}

/** What the end-on view shows, in words: the tip, the bending plane, and the image's turn. */
export function benchOrientationLines(
  orientation: BenchTipOrientation,
  rotationDeg: number,
): readonly string[] {
  const angle = Math.round(orientation.angleDeg)
  const tip =
    orientation.toward === null || angle === 0
      ? 'Tip: straight ahead, at the card’s centre.'
      : `Tip: ${angle}° from straight ahead, toward ${cardSideWords(orientation.toward)}.`
  const bend = `Bending plane: U toward ${cardSideWords(orientation.bendUp)}, D opposite.`
  const turn = Math.round(Math.abs(rotationDeg))
  const way = rotationDeg > 0 ? 'clockwise' : 'counterclockwise'
  const opposite = rotationDeg > 0 ? 'counterclockwise' : 'clockwise'
  // The model's sign rule (`scopeFrame`): the operator's clockwise turn rolls the camera clockwise,
  // which turns the picture counterclockwise. Worded for this model, not as a device convention.
  const image =
    turn === 0
      ? 'Control section not turned: U is toward the card’s top, as on the image.'
      : turn === 180
        ? 'Control section turned 180°: U has turned to the card’s bottom, and the scope view is upside down.'
        : `Control section turned ${turn}° ${way}, as the operator sees it: U has turned ${turn}° ${way} with it, and the scope view turns ${turn}° ${opposite}.`
  return [tip, bend, image]
}
