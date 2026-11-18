/**
 * Advance and Withdraw presses queue scope insertion here, and a frame clock feeds the queue into
 * `driveScope` at a steady speed, so a held button glides the scope instead of jumping one step
 * per repeat.
 *
 * Any frame loop may pump the queue: the page's `requestAnimationFrame` on a desktop, and the WebXR
 * session's frame loop in a headset. The second matters because a browser stops calling the page's
 * `requestAnimationFrame` while an immersive session is presenting; a queue drained only by the
 * page loop fills in VR and never moves the scope. The queue keeps its own clock, so when both loops
 * run (the VR view's desktop preview) the scope still moves at one speed.
 */

/** The most insertion a burst of presses can bank ahead of the scope, in mm. */
export const DRIVE_QUEUE_LIMIT_MM = 15
/** How fast queued insertion reaches the scope. */
export const DRIVE_SPEED_MM_PER_S = 24
/** A stalled frame (tab switch, headset hiccup) drives no further than one ordinary frame. */
export const DRIVE_MAX_FRAME_S = 0.05

export class ScopeDriveQueue {
  private pendingMm = 0
  private lastPumpMs: number | null = null

  /** Insertion still waiting to reach the scope (negative = withdrawal), in mm. */
  get pending(): number {
    return this.pendingMm
  }

  /** Queue an advance (positive) or withdrawal (negative). */
  push(deltaMm: number): void {
    if (!Number.isFinite(deltaMm)) return
    this.pendingMm = Math.min(
      DRIVE_QUEUE_LIMIT_MM,
      Math.max(-DRIVE_QUEUE_LIMIT_MM, this.pendingMm + deltaMm),
    )
  }

  /** Drop whatever is queued (reset, recenter, a new start). */
  clear(): void {
    this.pendingMm = 0
  }

  /**
   * The millimetres to drive at `nowMs`: the queue releases speed × the time since the last pump by
   * any caller. A second pump in the same instant releases nothing, so two loops never double the
   * speed.
   */
  pump(nowMs: number): number {
    const last = this.lastPumpMs
    if (last !== null && nowMs <= last) return 0
    this.lastPumpMs = nowMs
    if (last === null || this.pendingMm === 0) return 0
    const dtS = Math.min((nowMs - last) / 1000, DRIVE_MAX_FRAME_S)
    const amount =
      Math.sign(this.pendingMm) * Math.min(Math.abs(this.pendingMm), dtS * DRIVE_SPEED_MM_PER_S)
    this.pendingMm -= amount
    return amount
  }
}
