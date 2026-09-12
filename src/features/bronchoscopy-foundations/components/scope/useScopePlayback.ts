'use client'

import { useEffect, useState, type RefObject } from 'react'
import type { ScopePaneProps } from './types'

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
  const scripted =
    state.script?.id === 'breathing-cords' || state.script?.id === 'assistant-interrupt'
  const manual = forceManual || reducedMotion || view.controls.includes('step')
  useEffect(() => {
    if (!ready || !controlsEnabled || !scripted || manual || !visible) return
    let previous = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const seconds = Math.min(0.25, (now - previous) / 1000)
      previous = now
      if (document.visibilityState === 'visible') onCommand({ type: 'tick', seconds }, 'scripted')
    }, 100)
    return () => window.clearInterval(timer)
  }, [ready, controlsEnabled, scripted, manual, visible, onCommand])
  return { reducedMotion, visible, needsStep: !!scripted && manual }
}
