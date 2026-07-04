import { HID_BUTTON } from './constants'
import { decodeScopeTrackerGamepad, wrapAngleRad } from './decode'
import { findScopeTrackerGamepad } from './detect'
import { normalizeScopeTrackerProfile, shapeFlexion } from './profile'
import { RollUnwrapper } from './roll-unwrap'
import type {
  GamepadLike,
  ScopeButtonsState,
  ScopeInputFrame,
  ScopeInputSource,
  ScopeTrackerProfile,
} from './types'

export interface GamepadScopeSourceOptions {
  profile?: ScopeTrackerProfile
  /** Injectable for tests/emulation; defaults to navigator.getGamepads(). */
  getGamepads?: () => ReadonlyArray<GamepadLike | null | undefined>
  now?: () => number
}

function emptyButtons(): ScopeButtonsState {
  return { a: false, b: false, c: false, d: false, calibrate: false }
}

function defaultGetGamepads(): ReadonlyArray<GamepadLike | null> {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return []
  }
  try {
    return navigator.getGamepads()
  } catch {
    return []
  }
}

function defaultNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/**
 * Polls the Gamepad API for a scope tracker and turns reports into shaped
 * ScopeInputFrames (roll unwrapping, depth noise gating, button edges).
 * Call sample() once per animation frame.
 */
export class GamepadScopeSource implements ScopeInputSource {
  private profile: ScopeTrackerProfile
  private readonly getGamepads: () => ReadonlyArray<GamepadLike | null | undefined>
  private readonly now: () => number
  private readonly unwrapper = new RollUnwrapper()
  private currentDeviceId: string | null = null
  private lastButtons: ScopeButtonsState = emptyButtons()
  private lastWrappedRoll = 0
  private lastContinuousRoll = 0
  private gatedDepthMm: number | null = null

  constructor(options: GamepadScopeSourceOptions = {}) {
    this.profile = options.profile ?? normalizeScopeTrackerProfile()
    this.getGamepads = options.getGamepads ?? defaultGetGamepads
    this.now = options.now ?? defaultNow
  }

  get connected(): boolean {
    return this.currentDeviceId !== null
  }

  get deviceId(): string | null {
    return this.currentDeviceId
  }

  setProfile(profile: ScopeTrackerProfile): void {
    this.profile = profile
  }

  reset(): void {
    this.unwrapper.reset()
    this.currentDeviceId = null
    this.lastButtons = emptyButtons()
    this.lastWrappedRoll = 0
    this.lastContinuousRoll = 0
    this.gatedDepthMm = null
  }

  sample(timestampMs?: number): ScopeInputFrame | null {
    const pad = findScopeTrackerGamepad(this.getGamepads(), this.profile.device.gamepadId)
    if (!pad) {
      if (this.currentDeviceId !== null) this.reset()
      return null
    }
    if (pad.id !== this.currentDeviceId) {
      this.reset()
      this.currentDeviceId = pad.id
    }

    const raw = decodeScopeTrackerGamepad(pad, timestampMs ?? this.now())

    // Depth noise gate: hold the previous value for sub-threshold jitter so
    // downstream deltas stay clean while the cord is at rest.
    let depthMm = raw.depthMm
    if (
      this.gatedDepthMm !== null &&
      Math.abs(depthMm - this.gatedDepthMm) < this.profile.depth.noiseGateMm
    ) {
      depthMm = this.gatedDepthMm
    } else {
      this.gatedDepthMm = depthMm
    }

    // Roll: hold the last good value while the sin/cos pair is invalid.
    let rollRad = this.lastWrappedRoll
    let rollContinuousRad = this.lastContinuousRoll
    if (raw.rollValid) {
      rollRad = this.profile.roll.invert ? wrapAngleRad(-raw.rollRad) : raw.rollRad
      rollContinuousRad = this.unwrapper.update(rollRad)
      this.lastWrappedRoll = rollRad
      this.lastContinuousRoll = rollContinuousRad
    }

    const swapAB = this.profile.buttons.swapAB
    const buttons: ScopeButtonsState = {
      a: raw.buttons[swapAB ? HID_BUTTON.b : HID_BUTTON.a],
      b: raw.buttons[swapAB ? HID_BUTTON.a : HID_BUTTON.b],
      c: raw.buttons[HID_BUTTON.c],
      d: raw.buttons[HID_BUTTON.d],
      calibrate: raw.buttons[HID_BUTTON.calibrate],
    }
    const pressed: ScopeButtonsState = {
      a: buttons.a && !this.lastButtons.a,
      b: buttons.b && !this.lastButtons.b,
      c: buttons.c && !this.lastButtons.c,
      d: buttons.d && !this.lastButtons.d,
      calibrate: buttons.calibrate && !this.lastButtons.calibrate,
    }
    const released: ScopeButtonsState = {
      a: !buttons.a && this.lastButtons.a,
      b: !buttons.b && this.lastButtons.b,
      c: !buttons.c && this.lastButtons.c,
      d: !buttons.d && this.lastButtons.d,
      calibrate: !buttons.calibrate && this.lastButtons.calibrate,
    }
    this.lastButtons = buttons

    return {
      timestampMs: raw.timestampMs,
      deviceId: raw.deviceId,
      flexion: shapeFlexion(raw.flexion, this.profile.flexion),
      depthMm,
      rollRad,
      rollContinuousRad,
      rollValid: raw.rollValid,
      buttons,
      pressed,
      released,
      status: {
        photogate: raw.buttons[HID_BUTTON.photogate],
        lowQuality: raw.buttons[HID_BUTTON.lowQuality],
        fault: raw.buttons[HID_BUTTON.fault],
      },
      raw: {
        axes: Array.from(pad.axes),
        buttons: raw.buttons,
      },
    }
  }
}
