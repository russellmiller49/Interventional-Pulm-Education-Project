import { wrapAngleRad } from './decode'

/**
 * Accumulates a continuous (unbounded) roll angle from wrapped samples.
 * Assumes < PI of physical rotation between consecutive samples, which holds
 * comfortably at HID report rates vs. hand roll speeds.
 */
export class RollUnwrapper {
  private lastWrapped: number | null = null
  private accumulated = 0

  update(wrappedRad: number): number {
    if (this.lastWrapped === null) {
      this.lastWrapped = wrappedRad
      this.accumulated = wrappedRad
      return this.accumulated
    }
    this.accumulated += wrapAngleRad(wrappedRad - this.lastWrapped)
    this.lastWrapped = wrappedRad
    return this.accumulated
  }

  get value(): number {
    return this.accumulated
  }

  reset(): void {
    this.lastWrapped = null
    this.accumulated = 0
  }
}
