/**
 * The model's clock as animation frames drive it (plan, section 4.6; independent review, R1). The
 * engine's clock is whole milliseconds that move only on a tick, and every lung event is stamped at
 * the time it fell due, so how the time is split into ticks never changes what happens. What this
 * decides is how much time a frame may hand the engine:
 *
 * - no frame adds more than `MAX_FRAME_MS`, so a long stall, a slow first frame or a tab that was
 *   hidden (and had no frames) moves the lung by at most one frame's worth, never several steps at
 *   once;
 * - when the page is shown again the clock resumes from then, and the time away counts for nothing;
 * - for frames no longer than the cap, the model's time equals the wall-clock time, however many
 *   frames there were, so no rule depends on how often the renderer calls back. A frame longer than
 *   the cap slows the model rather than letting it leap.
 */
export const MAX_FRAME_MS = 100

export interface FrameClock {
  /** The whole milliseconds a frame at `now` hands the engine. */
  advance(now: number): number
  /** Start again from `now`, as when the page is shown after being hidden. */
  resume(now: number): void
}

export function frameClock(start: number): FrameClock {
  let last = start
  let carried = 0
  return {
    advance(now) {
      const gap = Math.max(0, now - last)
      last = now
      carried += Math.min(gap, MAX_FRAME_MS)
      const ms = Math.floor(carried)
      carried -= ms
      return ms
    },
    resume(now) {
      last = now
      carried = 0
    },
  }
}
