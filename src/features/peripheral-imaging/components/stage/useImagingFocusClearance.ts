'use client'

import { useEffect, type RefObject } from 'react'

import { bottomClearance, topClearance, zoomFactor } from './pinnedChrome'

/**
 * Keep keyboard focus out from under the activity's pinned chrome (G02-PI-01).
 *
 * The activity pins a course header above the task and an Activity-navigation footer below it,
 * and the page itself is the scroll container. When the browser moves focus with Tab it scrolls
 * the focused control into the scrollport, which it measures with no knowledge of what is painted
 * over that scrollport, so a control can be focused and operable while it sits behind the header
 * or the footer.
 *
 * `scroll-padding` on the scroll container is the declarative repair for exactly this, but the
 * chrome is content-sized: measured on this activity the header runs from about 180 css px at
 * desktop width and normal text to about 640 css px at 200% text, because enlarged text both
 * scales and re-wraps it. No fixed length in the stylesheet is large enough when text is enlarged
 * and small enough to avoid pointless scrolling at normal size, so the height has to be measured.
 *
 * Reserving that room is not enough on its own. Measured on this activity the header and footer
 * together take about 17% of the viewport at desktop width and normal text, but 65% to 79% once
 * text is enlarged, which leaves a clear strip of only about 44 to 58 css px: a control scrolled
 * into it is uncovered but has nothing around it. Chrome that no longer fits therefore stops
 * being pinned, the way the header already stops being pinned on a narrow viewport, and the task
 * gets the viewport back.
 *
 * This publishes the measured heights as custom properties and marks whether the chrome is still
 * pinned; `imaging-flow.module.css` reads them into `scroll-padding` and `position`, and the
 * browser does the scrolling. Nothing here moves focus or scrolls.
 */
const TOP_PROPERTY = '--imaging-focus-clear-top'
const BOTTOM_PROPERTY = '--imaging-focus-clear-bottom'

const PINNED_ATTRIBUTE = 'data-chrome-pinned'

/** Room for the focus ring, which the activity draws up to 6 px outside the control it marks. */
const FOCUS_RING_GAP = 8

/**
 * The most of the viewport the pinned header and footer may hold between them before they are
 * worth more than the task they frame. Desktop width at normal text sits near 0.17.
 */
const MAX_PINNED_SHARE = 0.4

/** Whether the chrome still leaves the task most of the viewport, measured however it is placed. */
function chromeFits(header: HTMLElement | null, footer: HTMLElement | null): boolean {
  const viewport = window.innerHeight
  if (viewport <= 0) return true
  const height = (node: HTMLElement | null) => node?.getBoundingClientRect().height ?? 0
  return height(header) + height(footer) <= viewport * MAX_PINNED_SHARE
}

export function useImagingFocusClearance(
  shell: RefObject<HTMLElement | null>,
  header: RefObject<HTMLElement | null>,
  footer: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const shellNode = shell.current
    const headerNode = header.current
    const footerNode = footer.current
    const root = document.documentElement
    const update = () => {
      // Decide what stays pinned first: the clearance below depends on what is still pinned.
      shellNode?.setAttribute(PINNED_ATTRIBUTE, String(chromeFits(headerNode, footerNode)))
      const zoom = zoomFactor(root)
      const top = (topClearance(headerNode, headerNode ?? footerNode) + FOCUS_RING_GAP) / zoom
      const bottom = (bottomClearance(footerNode) + FOCUS_RING_GAP) / zoom
      root.style.setProperty(TOP_PROPERTY, `${top}px`)
      root.style.setProperty(BOTTOM_PROPERTY, `${bottom}px`)
    }
    // The chrome re-wraps when the window, the text size or the step's own status line changes.
    // Where ResizeObserver is missing the chrome is still measured, just not re-measured on reflow.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    if (headerNode) observer?.observe(headerNode)
    if (footerNode) observer?.observe(footerNode)
    observer?.observe(document.body)
    update()
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
      root.style.removeProperty(TOP_PROPERTY)
      root.style.removeProperty(BOTTOM_PROPERTY)
      shellNode?.removeAttribute(PINNED_ATTRIBUTE)
    }
  }, [shell, header, footer])
}
