import { SCOPE_TRACKER_ID_PATTERN, SCOPE_TRACKER_VENDOR_HEX } from './constants'
import type { GamepadLike } from './types'

/**
 * Device matching precedence (contract §2):
 * 1. exact gamepad.id saved in the active profile,
 * 2. "scope tracker" in the id string,
 * 3. Raspberry Pi vendor (2e8a) with the expected axis/button counts.
 */
export function isScopeTrackerGamepad(
  pad: GamepadLike | null | undefined,
  preferredGamepadId?: string | null,
): boolean {
  if (!pad || !pad.connected) return false
  if (preferredGamepadId && pad.id === preferredGamepadId) return true
  if (SCOPE_TRACKER_ID_PATTERN.test(pad.id)) return true
  return (
    pad.id.toLowerCase().includes(SCOPE_TRACKER_VENDOR_HEX) &&
    pad.axes.length >= 4 &&
    pad.buttons.length >= 8
  )
}

export function findScopeTrackerGamepad(
  pads: ReadonlyArray<GamepadLike | null | undefined>,
  preferredGamepadId?: string | null,
): GamepadLike | null {
  if (preferredGamepadId) {
    for (const pad of pads) {
      if (pad && pad.connected && pad.id === preferredGamepadId) return pad
    }
  }
  for (const pad of pads) {
    if (pad && isScopeTrackerGamepad(pad)) return pad
  }
  return null
}
