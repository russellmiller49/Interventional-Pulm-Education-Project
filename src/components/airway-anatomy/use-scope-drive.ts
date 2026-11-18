'use client'

import { useCallback, useEffect, useRef } from 'react'

import type { ScopeDriveQueue } from '@/lib/airway-anatomy/drive-queue'

/**
 * Feeds queued Advance/Withdraw insertion into `advance` from the page's animation frames, and
 * returns the same pump for a WebXR scene to call from its own frame loop: the page's frames stop
 * while a headset session is presenting, so without the scene's pump the queue fills in VR and the
 * scope never moves. The queue's own clock keeps the speed single when both loops run.
 */
export function useScopeDriveClock(
  queue: ScopeDriveQueue,
  advance: (deltaMm: number) => void,
): () => void {
  const advanceRef = useRef(advance)
  useEffect(() => {
    advanceRef.current = advance
  })

  const pump = useCallback(() => {
    const amount = queue.pump(performance.now())
    if (amount) advanceRef.current(amount)
  }, [queue])

  useEffect(() => {
    let handle = 0
    const tick = () => {
      pump()
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [pump])

  return pump
}
