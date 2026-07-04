/**
 * Frame scheduling for input polling loops.
 *
 * requestAnimationFrame is fully suspended in hidden/backgrounded tabs, which would
 * park a poll loop until the tab is foregrounded again. Racing rAF against a timer
 * keeps polling alive when hidden (browsers throttle it to ~1 Hz, which is plenty for
 * reconnect/telemetry) while the visible path stays rAF-paced.
 */

export const HIDDEN_TAB_FALLBACK_INTERVAL_MS = 250

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/**
 * Invoke `callback` on the next frame (or after the hidden-tab fallback interval,
 * whichever fires first). Returns a cancel function. No-ops on the server.
 */
export function scheduleInputFrame(callback: (timestampMs: number) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }
  let settled = false
  let rafId: number | null = null
  let timerId: ReturnType<typeof setTimeout> | null = null
  const cancel = () => {
    settled = true
    if (rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (timerId !== null) {
      clearTimeout(timerId)
      timerId = null
    }
  }
  const fire = () => {
    if (settled) return
    cancel()
    callback(nowMs())
  }
  if (typeof requestAnimationFrame !== 'undefined') {
    rafId = requestAnimationFrame(() => fire())
  }
  timerId = setTimeout(fire, HIDDEN_TAB_FALLBACK_INTERVAL_MS)
  return cancel
}

/**
 * Run `tick` repeatedly (one scheduleInputFrame per tick) until the returned stop
 * function is called.
 */
export function startInputFrameLoop(tick: (timestampMs: number) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }
  let stopped = false
  let cancelPending: () => void = () => {}
  const step = (timestampMs: number) => {
    if (stopped) return
    tick(timestampMs)
    if (!stopped) {
      cancelPending = scheduleInputFrame(step)
    }
  }
  cancelPending = scheduleInputFrame(step)
  return () => {
    stopped = true
    cancelPending()
  }
}
