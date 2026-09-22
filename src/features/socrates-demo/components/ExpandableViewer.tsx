'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import styles from './expandable-viewer.module.css'

/** NativeCtViewer's native-first pattern, with a contained, keyboard-operable fallback.
 * The children never move or remount. OpenSeadragon keeps its image coordinates. */
export function ExpandableViewer({ children }: { children: ReactNode }) {
  const surface = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [native, setNative] = useState(false)
  const [fallback, setFallback] = useState(false)
  const expanded = native || fallback
  const close = useCallback(async () => {
    if (document.fullscreenElement === surface.current) {
      try {
        await document.exitFullscreen()
      } catch {
        /* Close remains available for a retry. */
      }
    }
    setFallback(false)
    trigger.current?.focus()
  }, [])
  useEffect(() => {
    const change = () => {
      const active = document.fullscreenElement === surface.current
      setNative(active)
      if (!active) trigger.current?.focus()
    }
    document.addEventListener('fullscreenchange', change)
    return () => document.removeEventListener('fullscreenchange', change)
  }, [])
  useEffect(() => {
    if (!expanded) return
    const bodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Inert siblings all the way to the body: keyboard focus cannot disappear behind
    // the overlay. Escape and the close control always provide a way out.
    const previous: [HTMLElement, boolean][] = []
    let node: HTMLElement | null = surface.current
    while (node && node !== document.body) {
      for (const sibling of Array.from(node.parentElement?.children ?? [])) {
        if (sibling !== node && sibling instanceof HTMLElement) {
          previous.push([sibling, sibling.inert])
          sibling.inert = true
        }
      }
      node = node.parentElement
    }
    trigger.current?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        void close()
      }
      if (event.key === 'Tab') {
        const focusable = Array.from(
          surface.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex="0"]',
          ) ?? [],
        ).filter((el) => el.getClientRects().length)
        const first = focusable[0]
        const last = focusable.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.body.style.overflow = bodyOverflow
      previous.forEach(([element, inert]) => {
        element.inert = inert
      })
      document.removeEventListener('keydown', key)
    }
  }, [expanded, close])
  async function toggle() {
    if (expanded) {
      await close()
      return
    }
    if (document.fullscreenEnabled && surface.current?.requestFullscreen) {
      try {
        await surface.current.requestFullscreen()
        return
      } catch {
        /* in-page fallback */
      }
    }
    setFallback(true)
  }
  return (
    <div
      ref={surface}
      className={styles.surface}
      data-expanded={expanded}
      data-fallback={fallback}
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded || undefined}
      aria-label={expanded ? 'Expanded slide viewer' : undefined}
    >
      <div className={styles.bar}>
        <span>
          {expanded ? 'Drag to pan · scroll or pinch to zoom · Escape to return' : 'Slide viewer'}
        </span>
        <button ref={trigger} type="button" aria-expanded={expanded} onClick={() => void toggle()}>
          {expanded ? 'Close expanded viewer' : 'Expand viewer'}
        </button>
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  )
}
