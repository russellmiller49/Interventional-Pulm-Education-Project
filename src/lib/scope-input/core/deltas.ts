import { DEPTH_JUMP_LIMIT_MM, ROLL_JUMP_LIMIT_RAD } from './constants'
import type { ScopeInputFrame, ScopeTrackerProfile } from './types'

export interface ScopeFrameDeltas {
  dtMs: number
  /** Simulated mm to advance this frame (profile depth gain + invert applied). */
  dDepthMm: number
  /** Radians to roll this frame (profile roll gain applied; invert already in the frame). */
  dRollRad: number
  /** True when a re-zero/reconnect discontinuity was suppressed instead of applied. */
  resynced: boolean
}

/**
 * Converts absolute frames into per-frame deltas for simulators.
 * Delta mapping is absolute tracking with a re-zeroable offset: it survives depth
 * re-zero, HID clamp saturation, and virtual paths shorter than the physical cord.
 */
export class ScopeDeltaTracker {
  private last: ScopeInputFrame | null = null

  update(frame: ScopeInputFrame, profile: ScopeTrackerProfile): ScopeFrameDeltas {
    const last = this.last
    this.last = frame
    if (!last || last.deviceId !== frame.deviceId) {
      return { dtMs: 0, dDepthMm: 0, dRollRad: 0, resynced: true }
    }
    const dtMs = Math.max(0, frame.timestampMs - last.timestampMs)
    let dDepthMm = frame.depthMm - last.depthMm
    let dRollRad = frame.rollContinuousRad - last.rollContinuousRad
    let resynced = false
    if (Math.abs(dDepthMm) > DEPTH_JUMP_LIMIT_MM) {
      dDepthMm = 0
      resynced = true
    }
    if (Math.abs(dRollRad) > ROLL_JUMP_LIMIT_RAD) {
      dRollRad = 0
      resynced = true
    }
    dDepthMm *= profile.depth.gain * (profile.depth.invert ? -1 : 1)
    dRollRad *= profile.roll.gain
    return { dtMs, dDepthMm, dRollRad, resynced }
  }

  reset(): void {
    this.last = null
  }
}
