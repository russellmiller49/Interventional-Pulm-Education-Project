'use client'

import { useEffect, type RefObject } from 'react'

/**
 * Keep the lesson's own identity out from under the site header, and keep focus out from under
 * both (EBUS-PRE-REVIEW-01, L1-1).
 *
 * The lesson host moves focus to the task heading on load and on every task change and scrolls
 * it into view. The page is the scroll container and the site header is painted over the top of
 * it, so `block: 'start'` put the heading at the top of the scrollport with everything above it —
 * "Lesson 4 of 26", the lesson title, "Task 1 of 5", the outline and Help — either off the top of
 * the viewport or behind the header. Measured at 1246×1021 on the unmodified code: the site
 * header covered 0–81 css px, the lesson eyebrow sat at −32, the title at −15 to 22 and the task
 * counter at 36 to 56. The learner could not see which lesson or which task they were in.
 *
 * The repair is the browser's own: the lesson chrome sticks below the site header, and the
 * heading reserves the room that chrome occupies through `scroll-padding-top` and
 * `scroll-margin-top`, so the browser's scrolling — native Tab scrolling included — lands it in
 * the clear. Nothing here moves focus or scrolls, and nothing touches the site header.
 *
 * The room has to be measured rather than written down. The chrome is content-sized: it is one
 * row at desktop width and normal text, and it both scales and re-wraps as text is enlarged, so
 * no single length in the stylesheet is big enough at 200% and small enough to avoid pointless
 * scrolling at 100%. The stylesheet's fallback, used before this runs and where it cannot, is
 * the site header plus this chrome at desktop width and normal text.
 *
 * Reserving the room is not enough by itself. Chrome that would hold more of the viewport than
 * the task it frames stops being pinned, the way the lesson chrome already stops being pinned on
 * a narrow viewport; the task gets the viewport back and the heading then lands just below the
 * site header, which is still not underneath anything.
 *
 * This is the same shape as the peripheral-imaging repair (PR #233) and deliberately a separate
 * copy: the two modules are worked in separate lanes and neither owns the other's files.
 */
const TOP_PROPERTY = '--ebus-focus-clear-top'
const PINNED_ATTRIBUTE = 'data-chrome-pinned'

/** Room for the focus ring, which this module draws 3 px wide, 3 px outside the control. */
const FOCUS_RING_GAP = 8

/**
 * The most of the viewport the pinned chrome may hold before it is worth more than the lesson it
 * frames. Desktop width at normal text measures near 0.14.
 */
const MAX_PINNED_SHARE = 0.35

/**
 * The most of the viewport the reservation may take, whatever is measured above the lesson.
 *
 * The site header is not this module's and grows with the text: measured at 1246x1021 it is 81
 * css px at normal text, 213 at 200%, and past that it wraps into something taller than the
 * viewport. A `scroll-padding-top` at or beyond the scrollport's own height stops the browser
 * being able to scroll anything into the remaining strip at all, so the reservation stops there
 * and the oversized site chrome is reported rather than worked around here.
 */
const MAX_CLEARANCE_SHARE = 0.5

/** The rect of a node that is actually painted over the page, or null when it scrolls away. */
function pinnedRect(node: HTMLElement | null): DOMRect | null {
  if (!node) return null
  const { position } = getComputedStyle(node)
  if (position !== 'sticky' && position !== 'fixed') return null
  return node.getBoundingClientRect()
}

/**
 * How far down a pinned node reaches once it is actually pinned, which is what the reservation
 * has to cover. A sticky node measured before the page has scrolled sits wherever the flow left
 * it, lower than the offset it will settle at, and reserving that larger number leaves a band of
 * empty page above every heading the browser scrolls to. Its resting place is its own `top`
 * offset plus its height; a fixed node is already there.
 */
function pinnedBottom(node: HTMLElement | null): number {
  const rect = pinnedRect(node)
  if (!rect || !node) return 0
  const style = getComputedStyle(node)
  if (style.position !== 'sticky') return rect.bottom
  const offset = Number.parseFloat(style.top)
  return Number.isFinite(offset) ? offset + rect.height : rect.bottom
}

/**
 * `getBoundingClientRect` reports zoomed pixels and a length in the stylesheet is scaled by the
 * same zoom again, so a measurement written back into CSS is divided by this. Browser zoom does
 * not set the property and leaves the factor at 1.
 */
function zoomFactor(root: HTMLElement): number {
  const zoom = Number.parseFloat(getComputedStyle(root).zoom)
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1
}

/**
 * How far down the viewport is covered: this lesson's chrome when it is pinned, and the site
 * chrome above the module, which pins itself over the page independently of this feature.
 * Walking the ancestors' earlier siblings finds it without naming or changing anything outside
 * the module.
 */
function topClearance(chrome: HTMLElement | null, anchor: HTMLElement | null): number {
  let covered = pinnedBottom(chrome)
  for (let node = anchor; node; node = node.parentElement) {
    for (
      let earlier = node.previousElementSibling;
      earlier;
      earlier = earlier.previousElementSibling
    ) {
      if (!(earlier instanceof HTMLElement)) continue
      const rect = pinnedRect(earlier)
      if (!rect || rect.top > 1) continue
      const bottom = pinnedBottom(earlier)
      if (bottom > covered) covered = bottom
    }
  }
  return Math.max(0, covered)
}

export function useLessonChromeClearance(
  flow: RefObject<HTMLElement | null>,
  chrome: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const flowNode = flow.current
    const chromeNode = chrome.current
    const root = document.documentElement
    const update = () => {
      // Decide what stays pinned first: the clearance below depends on what is still pinned.
      const viewport = window.innerHeight
      const height = chromeNode?.getBoundingClientRect().height ?? 0
      const fits = viewport <= 0 || height <= viewport * MAX_PINNED_SHARE
      flowNode?.setAttribute(PINNED_ATTRIBUTE, String(fits))
      const zoom = zoomFactor(root)
      const measured = topClearance(chromeNode, chromeNode ?? flowNode) + FOCUS_RING_GAP
      const capped = viewport > 0 ? Math.min(measured, viewport * MAX_CLEARANCE_SHARE) : measured
      root.style.setProperty(TOP_PROPERTY, `${capped / zoom}px`)
    }
    // The chrome re-wraps when the window, the text size or the lesson's own storage notice
    // changes. Where ResizeObserver is missing the chrome is still measured once, just not
    // re-measured on reflow.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    if (chromeNode) observer?.observe(chromeNode)
    observer?.observe(document.body)
    update()
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
      root.style.removeProperty(TOP_PROPERTY)
      flowNode?.removeAttribute(PINNED_ATTRIBUTE)
    }
  }, [flow, chrome])
}
