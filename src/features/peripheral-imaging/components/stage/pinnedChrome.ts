'use client'

/**
 * What the activity's pinned chrome leaves of the viewport.
 *
 * The activity pins a course header above the task and an Activity-navigation footer below it, and
 * the page itself is the scroll container, so the band of the viewport that is actually usable is
 * the viewport minus whatever chrome is painted over it. Both PI repairs need that band:
 * `useImagingFocusClearance` reserves it for the browser's own focus scrolling (G02-PI-01), and
 * `useImagingOutlinePlacement` lays the Course outline out inside it (G02-PI-02). This module is
 * the one definition of it, so the two cannot drift apart.
 *
 * Nothing here moves focus or scrolls; it only measures.
 */

/** The rect of a node that is actually pinned over the page, or null when it scrolls away. */
export function pinnedRect(node: HTMLElement | null): DOMRect | null {
  if (!node) return null
  const { position } = getComputedStyle(node)
  if (position !== 'sticky' && position !== 'fixed') return null
  return node.getBoundingClientRect()
}

/**
 * `getBoundingClientRect` reports zoomed pixels, and a length in the stylesheet is scaled by the
 * same zoom again, so a measurement written back into CSS is divided by this. Browser zoom does not
 * set this property and leaves the factor at 1.
 */
export function zoomFactor(root: HTMLElement): number {
  const zoom = Number.parseFloat(getComputedStyle(root).zoom)
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1
}

/**
 * How far down the viewport is covered: the course header when it is pinned, and the site chrome
 * above the module, which pins itself over the page independently of this feature. Walking the
 * ancestors' earlier siblings finds it without naming or changing anything outside the module.
 */
export function topClearance(header: HTMLElement | null, anchor: HTMLElement | null): number {
  let covered = pinnedRect(header)?.bottom ?? 0
  for (let node = anchor; node; node = node.parentElement) {
    for (
      let earlier = node.previousElementSibling;
      earlier;
      earlier = earlier.previousElementSibling
    ) {
      if (!(earlier instanceof HTMLElement)) continue
      const rect = pinnedRect(earlier)
      if (rect && rect.top <= 1 && rect.bottom > covered) covered = rect.bottom
    }
  }
  return Math.max(0, covered)
}

/** How far up from the bottom of the viewport the Activity-navigation footer covers. */
export function bottomClearance(footer: HTMLElement | null): number {
  const rect = pinnedRect(footer)
  if (!rect) return 0
  return Math.max(0, window.innerHeight - rect.top)
}
