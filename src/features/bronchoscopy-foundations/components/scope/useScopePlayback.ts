'use client'

import { useEffect, useRef, useState } from 'react'
import { ENVIRONMENT_CLOCK_SCRIPTS } from '../../engine/scope/scopeScripts'
import type { ScopeCommand, ScopeInputMode, ScopePaneProps } from './types'

/** No more simulated time than this passes in one tick, whatever the wall clock did. */
const MAX_TICK_SECONDS = 0.25
const TICK_INTERVAL_MS = 100

/**
 * A background tab, an offscreen pane and a locked step never accrue simulated time.
 *
 * `root` is the element whose place on screen decides "offscreen" — the element itself, not a ref
 * to it. The pane mounts a different element for the 3D view and for the schematic view, and an
 * observer bound once to whichever was first went on watching a node that had left the page: it
 * reported the pane as offscreen for good, the scene never drew a frame, and "Try the 3D view
 * again" stayed in loading (BF-01 finding 3). Taking the element makes the observer follow it.
 */
export function useScopePlayback(
  props: ScopePaneProps,
  root: HTMLElement | null,
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
    if (!root || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      // The last entry is the element's current state when several are delivered at once.
      const entry = entries[entries.length - 1]
      if (entry) setVisible(entry.isIntersecting)
    })
    observer.observe(root)
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
