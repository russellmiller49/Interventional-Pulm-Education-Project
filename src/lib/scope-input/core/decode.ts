import { DEPTH_FULL_SCALE_MM, HID_AXIS, ROLL_VALID_MIN_MAGNITUDE } from './constants'
import type { GamepadLike, RawScopeSample } from './types'

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** Wrap an angle to (-PI, PI]. */
export function wrapAngleRad(angle: number): number {
  const twoPi = Math.PI * 2
  let wrapped = angle % twoPi
  if (wrapped <= -Math.PI) wrapped += twoPi
  else if (wrapped > Math.PI) wrapped -= twoPi
  return wrapped
}

/** Browser-normalized depth axis (-1..1) to absolute mm (contract §3.1). */
export function depthAxisToMm(axisValue: number): number {
  return ((clamp(axisValue, -1, 1) + 1) / 2) * DEPTH_FULL_SCALE_MM
}

/** Inverse of depthAxisToMm — used by the emulator and firmware tests. */
export function depthMmToAxis(depthMm: number): number {
  return (clamp(depthMm, 0, DEPTH_FULL_SCALE_MM) / DEPTH_FULL_SCALE_MM) * 2 - 1
}

function axisValue(pad: GamepadLike, index: number): number {
  const value = pad.axes[index]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Decode one HID gamepad report into physical units. No profile shaping here. */
export function decodeScopeTrackerGamepad(pad: GamepadLike, timestampMs: number): RawScopeSample {
  const sinRoll = clamp(axisValue(pad, HID_AXIS.rollSin), -1, 1)
  const cosRoll = clamp(axisValue(pad, HID_AXIS.rollCos), -1, 1)
  const rollMagnitude = Math.hypot(sinRoll, cosRoll)
  const rollValid = rollMagnitude >= ROLL_VALID_MIN_MAGNITUDE

  const buttons: boolean[] = []
  for (let index = 0; index < 8; index += 1) {
    buttons.push(pad.buttons[index]?.pressed === true)
  }

  return {
    timestampMs,
    deviceId: pad.id,
    flexion: clamp(axisValue(pad, HID_AXIS.flexion), -1, 1),
    depthMm: depthAxisToMm(axisValue(pad, HID_AXIS.depth)),
    rollRad: rollValid ? Math.atan2(sinRoll, cosRoll) : 0,
    rollMagnitude,
    rollValid,
    buttons,
  }
}
