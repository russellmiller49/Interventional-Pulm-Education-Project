'use client'

import { useEffect, useState } from 'react'

/**
 * A drive's clock: how far through it the scope is, from 0 to 1, advanced once a frame while the
 * drive is running. `key` names the drive; a new key starts from 0. With reduced motion the drive
 * is over at once. `onDone` is called once, when the scope gets there.
 */
export function useDriveClock(
  running: boolean,
  key: string,
  durationMs: number,
  onDone: () => void,
): number {
  const [clock, setClock] = useState({ key, progress: 0 })
  useEffect(() => {
    if (!running) return
    const reduced =
      !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let started: number | null = null
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      setClock({ key, progress: 1 })
      onDone()
    }
    const tick = (now: number) => {
      if (started === null) started = now
      const progress = Math.min(1, (now - started) / Math.max(1, durationMs))
      if (progress >= 1) return finish()
      setClock({ key, progress })
      frame = window.requestAnimationFrame(tick)
    }
    if (reduced) frame = window.requestAnimationFrame(finish)
    else frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
    // The drive is named by its key; a new function for `onDone` is not a new drive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, key, durationMs])
  return clock.key === key ? clock.progress : 0
}
