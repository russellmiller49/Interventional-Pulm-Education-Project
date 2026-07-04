/**
 * Shared types for the Universal Scope Tracker input pipeline.
 * Contract: docs/scope-tracker-web-contract.md (this repo).
 *
 * This module is dependency-free and browser/SSR safe. It is the canonical copy;
 * vendored copies in the simulator repos are overwritten by `npm run sync:scope-input`.
 */

export interface GamepadButtonLike {
  pressed: boolean
}

/**
 * Structural subset of the DOM Gamepad interface. Real Gamepad objects satisfy it,
 * and tests/emulators can supply plain objects.
 */
export interface GamepadLike {
  id: string
  index: number
  connected: boolean
  axes: ReadonlyArray<number>
  buttons: ReadonlyArray<GamepadButtonLike>
  mapping?: string
}

export type ScopeButtonName = 'a' | 'b' | 'c' | 'd' | 'calibrate'

export interface ScopeButtonsState {
  a: boolean
  b: boolean
  c: boolean
  d: boolean
  calibrate: boolean
}

export interface ScopeStatusFlags {
  /** Cord present at the Module B photogate (HID button 5). */
  photogate: boolean
  /** SQUAL/dropout below threshold — prompt "replace wiper / wipe cord" (HID button 6). */
  lowQuality: boolean
  /** Firmware latched a hardware fault; details over serial (HID button 7). */
  fault: boolean
}

/** One decoded HID report, before profile shaping. */
export interface RawScopeSample {
  timestampMs: number
  deviceId: string
  /** Axis 0 as reported, clamped to [-1, 1]. +1 = tip toward image-up. */
  flexion: number
  /** Absolute insertion depth in mm since the device's last depth zero. */
  depthMm: number
  /** Wrapped roll (radians) reconstructed from the sin/cos axes; 0 when rollValid is false. */
  rollRad: number
  /** hypot(sinAxis, cosAxis) — ~1 on real hardware. */
  rollMagnitude: number
  /** False when the sin/cos pair is too small to trust (device not ready / wrong pad). */
  rollValid: boolean
  /** First 8 HID buttons as booleans (missing buttons read as false). */
  buttons: boolean[]
}

/** One profile-shaped input frame, as consumed by simulators. */
export interface ScopeInputFrame {
  timestampMs: number
  deviceId: string
  /** Flexion after trim/deadzone/expo/invert, -1..1. +1 = tip toward image-up. */
  flexion: number
  /**
   * Absolute physical insertion depth in mm. Profile gain/invert are NOT applied here —
   * they apply to deltas (see ScopeDeltaTracker), keeping this value physically meaningful.
   */
  depthMm: number
  /** Wrapped roll (-PI..PI], profile invert applied. Positive = clockwise (operator view, looking distally). */
  rollRad: number
  /** Continuous unwrapped roll in radians, profile invert applied. */
  rollContinuousRad: number
  rollValid: boolean
  /** Current level state of the user buttons. */
  buttons: ScopeButtonsState
  /** True only on the frame where the button went down. */
  pressed: ScopeButtonsState
  /** True only on the frame where the button went up. */
  released: ScopeButtonsState
  status: ScopeStatusFlags
  raw: {
    axes: ReadonlyArray<number>
    buttons: ReadonlyArray<boolean>
  }
}

/**
 * Web-side calibration profile (localStorage). Device-level calibration
 * (2x2 optical matrix, lever endpoints) lives in firmware, not here.
 */
export interface ScopeTrackerProfile {
  version: 1
  id: string
  name: string
  device: {
    /** Exact gamepad.id string when the user manually picked a device; null = auto-detect. */
    gamepadId: string | null
  }
  flexion: {
    invert: boolean
    /** 0..0.4 — normalized units around neutral treated as zero. */
    deadzone: number
    /** -0.5..0.5 — subtracted before the deadzone (neutral correction). */
    trim: number
    /** 0..1 — cubic expo blend for finer control near center. */
    expo: number
  }
  depth: {
    invert: boolean
    /** mm — changes smaller than this are held (jitter suppression). */
    noiseGateMm: number
    /** Physical-to-simulated mm multiplier applied to depth deltas. */
    gain: number
  }
  roll: {
    invert: boolean
    /** Multiplier applied to roll deltas. */
    gain: number
  }
  buttons: {
    swapAB: boolean
  }
}

/** Common interface for hardware (GamepadScopeSource) and emulated (VirtualScopeSource) input. */
export interface ScopeInputSource {
  /** Poll once per animation frame. Returns null while no scope tracker is connected. */
  sample(timestampMs?: number): ScopeInputFrame | null
  readonly connected: boolean
  readonly deviceId: string | null
  setProfile(profile: ScopeTrackerProfile): void
  /** Clear unwrap/edge accumulators (e.g. when the consumer re-homes its scope). */
  reset(): void
}
