'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import styles from './FitWidthSurface.module.css'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'

/** Measures the child's real minimum and overflow widths. Reflowing consoles normally remain at
 * scale 1; fixed-size surfaces may opt into fit or an explicitly labelled scrollable region. */

export type FitWidthMode = 'fit' | 'actual'

export interface FitWidthMetrics {
  readonly availableWidth: number
  readonly intrinsicWidth: number
  readonly intrinsicHeight: number
  readonly layoutWidth: number
  readonly scale: number
}

interface FitWidthSurfaceProps {
  readonly children: ReactNode
  /** `fit` scales down to the available width. `actual` renders at design size and scrolls. */
  readonly mode?: FitWidthMode
  /**
   * Change this to force a fresh measurement for a reason a `ResizeObserver` may not report as a
   * width change — the workspace entering or leaving focused mode, for instance.
   */
  readonly remeasureKey?: string | number
  readonly label?: string
  readonly className?: string
}

/** The scale that fits `intrinsicWidth` into `availableWidth`, never magnifying. */
export function fitWidthScale(availableWidth: number, intrinsicWidth: number): number {
  if (!(intrinsicWidth > 0) || !(availableWidth > 0)) return 1
  return Math.min(1, availableWidth / intrinsicWidth)
}

const MEASUREMENT_EPSILON = 0.5

function sameMeasurement(
  current: FitWidthMetrics | null,
  next: FitWidthMetrics,
): current is FitWidthMetrics {
  if (!current) return false
  return (
    Math.abs(current.availableWidth - next.availableWidth) < MEASUREMENT_EPSILON &&
    Math.abs(current.intrinsicWidth - next.intrinsicWidth) < MEASUREMENT_EPSILON &&
    Math.abs(current.intrinsicHeight - next.intrinsicHeight) < MEASUREMENT_EPSILON &&
    current.scale === next.scale
  )
}

export function FitWidthSurface({
  children,
  mode = 'fit',
  remeasureKey,
  label,
  className,
}: FitWidthSurfaceProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState<FitWidthMetrics | null>(null)

  const measure = useCallback(() => {
    const outer = outerRef.current
    const content = contentRef.current
    if (!outer || !content) return
    const availableWidth = outer.clientWidth
    if (!(availableWidth > 0)) return

    /*
     * The measurement pass runs against the live element with its transform and width overrides
     * removed, then puts both back. Nothing paints between the two, because this only ever runs
     * inside a layout effect or a ResizeObserver callback, and the render that follows re-applies
     * the values React owns.
     */
    const inlineWidth = content.style.width
    const inlineTransform = content.style.transform
    content.style.transform = 'none'
    content.style.width = 'min-content'
    const minContentWidth = content.getBoundingClientRect().width
    /*
     * The console is a size container (it reflows by its own width), and size containment makes an
     * element's min-content width ignore its content — so min-content alone would always say "fits".
     * Laid out at the available width, the content's scroll width is what actually overflows, if
     * anything still does after the reflow.
     */
    content.style.width = `${availableWidth}px`
    const overflowWidth = content.scrollWidth
    const intrinsicWidth = Math.max(minContentWidth, overflowWidth)
    const layoutWidth = Math.max(availableWidth, intrinsicWidth)
    content.style.width = `${layoutWidth}px`
    const intrinsicHeight = content.getBoundingClientRect().height
    content.style.width = inlineWidth
    content.style.transform = inlineTransform

    if (!(intrinsicWidth > 0)) return
    const next: FitWidthMetrics = {
      availableWidth,
      intrinsicWidth,
      intrinsicHeight,
      layoutWidth,
      scale: mode === 'actual' ? 1 : fitWidthScale(availableWidth, intrinsicWidth),
    }
    setMetrics((current) => (sameMeasurement(current, next) ? current : next))
  }, [mode])

  // Before the first paint, and again whenever the mode or the remeasure key changes.
  useIsomorphicLayoutEffect(() => {
    measure()
    /*
     * `ResizableTeachingWorkspace` sizes its panes from its own `setTimeout(…, 0)`. Until that runs
     * the panes are laid out from the percentage fallback in its stylesheet, so the width measured
     * above is a width the console will not keep — at 1600px of viewport it is 10px wider than the
     * settled pane, which is exactly enough to clip the right edge of the console for the rest of
     * the session.
     *
     * This surface is a descendant of that workspace, so React runs this effect first and a
     * `setTimeout(…, 0)` queued here still lands before the workspace has resized anything. Hence
     * three settle passes rather than one: the animation frame is the one that matters in a normal
     * browser, and the two timers are what make the settled width deterministic without depending on
     * the order two sibling deferred passes happen to run in. `ResizeObserver` below is the
     * steady-state mechanism; these only cover the first paint.
     */
    const settleTimers = [window.setTimeout(measure, 0), window.setTimeout(measure, 48)]
    const settleFrame =
      typeof requestAnimationFrame === 'undefined' ? null : requestAnimationFrame(() => measure())
    return () => {
      for (const timer of settleTimers) window.clearTimeout(timer)
      if (settleFrame !== null) cancelAnimationFrame(settleFrame)
    }
  }, [measure, remeasureKey])

  // A child can change its minimum width without resizing the fixed-width wrapper (even by 1px).
  useIsomorphicLayoutEffect(() => measure(), [children, measure])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined
    const outer = outerRef.current
    if (!outer) return undefined
    const observer = new ResizeObserver(() => measure())
    observer.observe(outer)
    if (contentRef.current) {
      observer.observe(contentRef.current)
      for (const child of contentRef.current.children) observer.observe(child)
    }
    return () => observer.disconnect()
  }, [measure])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    function onResize() {
      measure()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [measure])

  const scale = metrics?.scale ?? 1
  const scaled = scale < 1
  /*
   * An actual-size surface is a keyboard-scrollable region only while something in it is wider than
   * the box. A focus stop that scrolls nothing, labelled "scroll horizontally", is a broken promise
   * to a keyboard user — and since the console reflows to its box, that is now the ordinary case.
   */
  const scrollable =
    mode === 'actual' &&
    metrics !== null &&
    metrics.intrinsicWidth > metrics.availableWidth + MEASUREMENT_EPSILON
  const outerStyle: CSSProperties | undefined =
    metrics && scaled ? { height: `${metrics.intrinsicHeight * scale}px` } : undefined
  /*
   * Before the first measurement the child is held to the available width. That first frame is the
   * clipped console this package exists to fix, but it is only one frame and it is the size of the
   * pane; releasing the width instead would flash a console wider than the workspace.
   */
  const contentStyle: CSSProperties = metrics
    ? {
        width: `${metrics.layoutWidth}px`,
        transform: scaled ? `scale(${scale})` : undefined,
      }
    : { width: '100%' }

  return (
    <div
      ref={outerRef}
      tabIndex={scrollable ? 0 : undefined}
      role={scrollable ? 'region' : undefined}
      aria-label={
        scrollable ? 'Console viewport. Scroll horizontally to inspect all controls.' : undefined
      }
      className={[styles.fitSurface, className].filter(Boolean).join(' ')}
      style={outerStyle}
      data-fit-width-surface=""
      data-fit-mode={mode}
      data-fit-scrollable={scrollable ? 'true' : 'false'}
      data-fit-measured={metrics ? 'true' : 'false'}
      data-fit-scale={scale.toFixed(4)}
      data-intrinsic-width={Math.round(metrics?.intrinsicWidth ?? 0)}
      data-available-width={Math.round(metrics?.availableWidth ?? 0)}
    >
      <div
        ref={contentRef}
        className={styles.fitContent}
        style={contentStyle}
        data-fit-width-content=""
        aria-label={label}
        role={label ? 'group' : undefined}
      >
        {children}
      </div>
    </div>
  )
}
