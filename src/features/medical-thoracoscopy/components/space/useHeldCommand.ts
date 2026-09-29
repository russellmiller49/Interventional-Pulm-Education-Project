'use client'

import { useCallback, useEffect, useRef } from 'react'

import type { SpaceCommand, SpaceInputMode } from './types'

export const HOLD_DELAY_MS = 260
export const HOLD_INTERVAL_MS = 120

/**
 * A control held down sends its command, waits, then sends it again at an even rate until it is let
 * go. It is let go, too, when the window loses focus or the tab is hidden, and whenever the controls
 * stop being usable, so a hold can never run on unseen. Under reduced motion a press sends one step
 * and nothing repeats.
 */
export function useHeldCommand(
  send: (command: SpaceCommand, input: SpaceInputMode) => void,
  { enabled, reducedMotion }: { readonly enabled: boolean; readonly reducedMotion: boolean },
) {
  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  })
  const timers = useRef<{ timeout: number | null; interval: number | null }>({
    timeout: null,
    interval: null,
  })

  const stop = useCallback(() => {
    if (timers.current.timeout !== null) window.clearTimeout(timers.current.timeout)
    if (timers.current.interval !== null) window.clearInterval(timers.current.interval)
    timers.current = { timeout: null, interval: null }
  }, [])

  const start = useCallback(
    (command: SpaceCommand, input: SpaceInputMode) => {
      stop()
      if (!enabled) return
      sendRef.current(command, input)
      if (reducedMotion) return
      timers.current.timeout = window.setTimeout(() => {
        timers.current.interval = window.setInterval(
          () => sendRef.current(command, input),
          HOLD_INTERVAL_MS,
        )
      }, HOLD_DELAY_MS)
    },
    [enabled, reducedMotion, stop],
  )

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop()
    }
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [stop])

  useEffect(() => {
    if (!enabled) stop()
  }, [enabled, stop])

  return { start, stop }
}
