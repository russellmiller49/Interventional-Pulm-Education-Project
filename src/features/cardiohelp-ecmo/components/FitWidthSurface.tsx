'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import styles from './FitWidthSurface.module.css'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'

/**
 * A surface that shows its child at whatever scale makes the child's full width visible.
 *
 * The CARDIOHELP console cannot lay out narrower than about 820px: its device grid is
 * `58px minmax(500px, 1fr) 190px` plus gaps, shell padding and section padding. The primary pane of
 * a three-pane workspace is around 620px at 1600px of viewport and less below that, so the console
 * was clipped at every laptop width and no amount of dragging the separators could reveal it.
 *
 * Scaling the rendered console is the only fix that keeps the device intact. The alternatives were
 * to delete controls until the remainder fits, which stops being a facsimile of the device, or to
 * let the pane scroll horizontally, which hides half of a console whose whole teaching point is that
 * the numbers are read together.
 *
 * The scale is measured, never assumed:
 *
 *   intrinsic width = the child's `min-content` width, its narrowest real layout
 *   scale           = min(1, available width / intrinsic width)
 *
 * The child is laid out at `max(available, intrinsic)` so a pane wider than the console still gets a
 * console that fills it at scale 1, and is never upscaled past its own design size.
 */

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
    const intrinsicWidth = content.getBoundingClientRect().width
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

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined
    const outer = outerRef.current
    if (!outer) return undefined
    const observer = new ResizeObserver(() => measure())
    observer.observe(outer)
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
      className={[styles.fitSurface, className].filter(Boolean).join(' ')}
      style={outerStyle}
      data-fit-width-surface=""
      data-fit-mode={mode}
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
