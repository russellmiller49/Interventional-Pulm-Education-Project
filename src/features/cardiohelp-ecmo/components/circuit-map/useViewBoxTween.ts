'use client'

import { useEffect, useState } from 'react'

import { viewBoxString, type CircuitMapRect } from './circuitMapGeometry'

/**
 * A viewBox that moves to its target rather than cutting to it.
 *
 * The map's window follows the lesson: from the drainage limb to the pump to the membrane as the
 * walk moves. `viewBox` is not a CSS property, so a change of window would otherwise be a jump cut
 * — the drawing the learner was reading replaced by a different crop of it, with nothing to say
 * how the two relate. A short eased pan says it: the pump was over there, and now it is here.
 *
 * The first window is taken as it is, because there is nothing to pan from. A change under reduced
 * motion, or where the browser cannot animate, is a cut — the drawing is never left mid-pan. The
 * tween lives in animation-frame callbacks, never in the effect body, so a frame is drawn between
 * each state and the compiler's rules about effects hold.
 *
 * Settledness is decided from what is shown, not from a second piece of state. A first version
 * tracked "the last target a pan finished on" and skipped the effect when the new target equalled
 * it — so a pan interrupted by a return to its starting window (Next, then Back within half a
 * second) left the drawing frozen on a crop that was neither. Comparing the shown rect to the
 * target has no such hole: if they differ, it pans; if they match, there is nothing to do.
 */
const TWEEN_MS = 480

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined'
    ? (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
    : false
}

export function useViewBoxTween(target: CircuitMapRect): string {
  const targetKey = viewBoxString(target)
  const [shown, setShown] = useState<CircuitMapRect>(target)
  const shownKey = viewBoxString(shown)

  useEffect(() => {
    if (shownKey === targetKey) return
    if (reducedMotion() || typeof window.requestAnimationFrame !== 'function') {
      // A cut, taken in a timer callback for the same reason the tween is: not in the effect body.
      const cut = window.setTimeout(() => setShown(target), 0)
      return () => window.clearTimeout(cut)
    }
    const from = shown
    let started: number | null = null
    let handle = 0
    const step = (now: number) => {
      if (started === null) started = now
      const t = Math.min(1, (now - started) / TWEEN_MS)
      const k = easeInOut(t)
      setShown(
        t >= 1
          ? target
          : {
              x: from.x + (target.x - from.x) * k,
              y: from.y + (target.y - from.y) * k,
              width: from.width + (target.width - from.width) * k,
              height: from.height + (target.height - from.height) * k,
            },
      )
      if (t < 1) handle = window.requestAnimationFrame(step)
    }
    handle = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(handle)
    // `shown` is the pan's starting point, captured when the target changes. Re-running on every
    // intermediate frame would restart the pan from itself; the effect keys on the two endpoints.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, shownKey === targetKey])

  return shownKey
}
