'use client'

import { useEffect, useState, type RefObject } from 'react'

export interface RenderedMetrics {
  /** The element's rendered width in CSS pixels. */
  readonly widthPx: number
  /** One rem in CSS pixels: the reader's root text size. */
  readonly remPx: number
}

/** What a figure assumes before it has been measured, and wherever it cannot be (a test's DOM). */
export const DEFAULT_RENDERED_METRICS: RenderedMetrics = { widthPx: 825, remPx: 16 }

/**
 * The size a figure is actually drawn at, and the size of the reader's text.
 *
 * A figure that lays its labels out in pixels has to know both. The width comes from a
 * `ResizeObserver` on the figure; the text size from a second observer on a one-rem probe, because
 * enlarging the root text changes no element's width and would otherwise never be noticed.
 */
export function useRenderedMetrics(ref: RefObject<HTMLElement | null>): RenderedMetrics {
  const [metrics, setMetrics] = useState<RenderedMetrics>(DEFAULT_RENDERED_METRICS)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const probe = document.createElement('span')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText =
      'position:absolute;visibility:hidden;pointer-events:none;width:1rem;height:1rem;left:0;top:0'
    element.appendChild(probe)
    const measure = () => {
      const widthPx = element.getBoundingClientRect().width
      const remPx = probe.getBoundingClientRect().width
      if (!(widthPx > 0) || !(remPx > 0)) return
      setMetrics((current) =>
        Math.abs(current.widthPx - widthPx) < 0.5 && Math.abs(current.remPx - remPx) < 0.05
          ? current
          : { widthPx, remPx },
      )
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    observer.observe(probe)
    measure()
    return () => {
      observer.disconnect()
      probe.remove()
    }
  }, [ref])
  return metrics
}
