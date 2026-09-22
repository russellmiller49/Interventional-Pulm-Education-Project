'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { ENVIRONMENT_CLOCK_SCRIPTS } from '../../engine/scope/scopeScripts'
import type { ScopeCommand, ScopeInputMode, ScopePaneProps } from './types'

/** No more simulated time than this passes in one tick, whatever the wall clock did. */
const MAX_TICK_SECONDS = 0.25
const TICK_INTERVAL_MS = 100

/** A background tab, an offscreen pane and a locked step never accrue simulated time. */
export function useScopePlayback(
  props: ScopePaneProps,
  root: RefObject<HTMLElement | null>,
  ready: boolean,
  forceManual = false,
) {
  const [reducedMotion, setReducedMotion] = useState(true)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => setReducedMotion(media.matches)
    changed()
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])
  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [root])
  const { onCommand, controlsEnabled, state, view } = props
  /**
   * The host rebuilds `onCommand` on every render, and every tick causes one. Holding it in a ref
   * keeps the interval out of the effect's dependencies: one interval per run of scripted time,
   * and an elapsed base that is not reset by the render the previous tick caused.
   */
  const send = useRef<(command: ScopeCommand, inputMode: ScopeInputMode) => void>(onCommand)
  useEffect(() => {
    send.current = onCommand
  }, [onCommand])
  const scripted = !!state.script && ENVIRONMENT_CLOCK_SCRIPTS.has(state.script.id)
  const manual = forceManual || reducedMotion || view.controls.includes('step')
  useEffect(() => {
    if (!ready || !controlsEnabled || !scripted || manual || !visible) return
    let previous = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const seconds = Math.min(MAX_TICK_SECONDS, (now - previous) / 1000)
      previous = now
      if (document.visibilityState === 'visible')
        send.current({ type: 'tick', seconds }, 'scripted')
    }, TICK_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [ready, controlsEnabled, scripted, manual, visible])
  return { reducedMotion, visible, needsStep: scripted && manual }
}
