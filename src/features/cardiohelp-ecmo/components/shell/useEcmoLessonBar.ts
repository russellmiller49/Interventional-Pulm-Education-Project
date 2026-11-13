'use client'

import { useLayoutEffect, type RefObject } from 'react'

/** A bar taller than this share of the window is not pinned; it scrolls with the task. */
const PINNED_BAR_MAX_SHARE = 0.25

/**
 * The height of the lesson bar while it is pinned, published on the shell.
 *
 * The stylesheet pins the bar on a desktop window (`EcmoActivityShell.module.css`). Whatever is
 * pinned under it, and wherever keyboard focus is scrolled to, has to start below it, so its
 * measured height is published as `--ecmo-lesson-bar-height`: zero whenever the bar is not pinned.
 *
 * At enlarged text the bar wraps to several rows. Past a quarter of the window it is marked
 * `data-bar-unfits` and the stylesheet lets it scroll away with the task, as the context strip and
 * the pinned action row already do when they grow too tall.
 */
export function useEcmoLessonBar(
  shellRef: RefObject<HTMLElement | null>,
  barRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useLayoutEffect(() => {
    const shell = shellRef.current
    const bar = barRef.current
    if (!enabled || !shell || !bar) return undefined

    const measure = () => {
      const height = bar.getBoundingClientRect().height
      bar.dataset.barUnfits = String(height > window.innerHeight * PINNED_BAR_MAX_SHARE)
      const pinned = getComputedStyle(bar).position === 'sticky'
      shell.style.setProperty('--ecmo-lesson-bar-height', `${pinned ? height : 0}px`)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(bar)
    // The bar pins and unpins at the fixed-workspace threshold without changing size.
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      delete bar.dataset.barUnfits
      shell.style.removeProperty('--ecmo-lesson-bar-height')
    }
  }, [enabled, shellRef, barRef])
}

/** The pinned lesson bar's height for a node inside an ECMO activity; zero when it is not pinned. */
export function ecmoPinnedLessonBarHeight(node: Element | null | undefined): number {
  const bar = node
    ?.closest('[data-ecmo-shell]')
    ?.querySelector<HTMLElement>(':scope > [data-ecmo-lesson-bar]')
  return bar && getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().height : 0
}
