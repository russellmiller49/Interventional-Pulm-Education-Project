'use client'

import { useLayoutEffect, type RefObject } from 'react'

import { ecmoPinnedLessonBarHeight } from './useEcmoLessonBar'

/** Publish chrome sizes for native focus scrolling; never move focus or scroll from an event. */
export function useEcmoFocusClearance(
  shellRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  stage: string,
) {
  useLayoutEffect(() => {
    const shell = shellRef.current
    const siteHeader = document.getElementById('main-content')?.previousElementSibling
    const strip = shell?.querySelector<HTMLElement>('[data-ecmo-context-strip]')
    if (!enabled || !shell || !strip || !siteHeader) return

    const root = document.documentElement
    const documentToken = '--ecmo-document-focus-clearance'
    const previous = root.style.getPropertyValue(documentToken)
    const measure = () => {
      // The room under the pinned chrome: the site menu where it is shown, and the lesson bar
      // where it is pinned.
      const availableHeight =
        window.innerHeight -
        siteHeader.getBoundingClientRect().height -
        ecmoPinnedLessonBarHeight(strip)
      strip.dataset.stickyUnfits = String(
        strip.getBoundingClientRect().height > availableHeight / 3,
      )
      // Of the context strips only the operational one is sticky; ordinary context flows away.
      const stripHeight =
        getComputedStyle(strip).position === 'sticky' ? strip.getBoundingClientRect().height : 0
      shell.style.setProperty('--ecmo-sticky-strip-height', `${stripHeight}px`)
      root.style.setProperty(
        documentToken,
        `${siteHeader.getBoundingClientRect().height + stripHeight}px`,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(siteHeader)
    observer.observe(strip)
    const bar = shell.querySelector<HTMLElement>(':scope > [data-ecmo-lesson-bar]')
    if (bar) observer.observe(bar)
    // The scroll owner/sticky offset can switch without either observed element changing size.
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      delete strip.dataset.stickyUnfits
      shell.style.removeProperty('--ecmo-sticky-strip-height')
      if (previous) root.style.setProperty(documentToken, previous)
      else root.style.removeProperty(documentToken)
    }
  }, [enabled, shellRef, stage])
}
