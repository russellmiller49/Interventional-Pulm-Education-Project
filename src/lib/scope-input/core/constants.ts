/**
 * Universal Scope Tracker HID/serial contract constants.
 * Keep in lockstep with docs/scope-tracker-web-contract.md and the RP2040 firmware.
 */

export const SCOPE_TRACKER_PROTOCOL_VERSION = 1

/** HID axis indexes (Gamepad.axes). */
export const HID_AXIS = {
  flexion: 0,
  depth: 1,
  rollSin: 2,
  rollCos: 3,
} as const

/** HID button indexes (Gamepad.buttons). Indexes 5-7 are firmware status flags, not user input. */
export const HID_BUTTON = {
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  calibrate: 4,
  photogate: 5,
  lowQuality: 6,
  fault: 7,
} as const

/** Depth axis full scale: axis -1 => 0 mm, axis +1 => 1024 mm. */
export const DEPTH_FULL_SCALE_MM = 1024

/** Below this hypot(sin, cos) the roll axes are considered not driven / untrustworthy. */
export const ROLL_VALID_MIN_MAGNITUDE = 0.5

/** Single-frame jumps beyond these are treated as re-zero/reconnect and suppressed. */
export const DEPTH_JUMP_LIMIT_MM = 200
export const ROLL_JUMP_LIMIT_RAD = Math.PI / 2

/** Device identity matching (see contract §2). */
export const SCOPE_TRACKER_ID_PATTERN = /scope[\s_-]?tracker/i
export const SCOPE_TRACKER_VENDOR_HEX = '2e8a'

/** localStorage keys + BroadcastChannel shared across same-origin consumers. */
export const PROFILES_STORAGE_KEY = 'scopeTracker.profiles.v1'
export const ACTIVE_PROFILE_STORAGE_KEY = 'scopeTracker.activeProfileId.v1'
export const PROFILE_BROADCAST_CHANNEL = 'scope-tracker'
