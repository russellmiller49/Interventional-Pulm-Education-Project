/**
 * Bring a new task's heading into view and move focus to it — for explicit navigation only.
 *
 * The walkthrough (N4) pressed the bottom Continue at 1280×900 and was left looking at the old
 * console with the new step's heading about 870 px above the viewport; nothing seemed to happen.
 * The Learn task flow scrolls the document, and the site header is pinned over its top.
 *
 * Callers are the explicit navigation handlers (Continue, Back, the step and section choosers,
 * Restart). Nothing here listens for focus or state: simulation ticks, Run/Pause, captures,
 * control changes and disclosures never reach it.
 *
 *   - The pinned chrome is measured when the navigation happens, not assumed: every fixed or
 *     sticky element that is currently pinned across the top of the viewport. No fixed offset.
 *   - A step change puts the heading just under that chrome, so the instruction, the experiment
 *     panel, the control and the readings that follow it start at the top of the view: measured
 *     at 1280×900, a heading left where the top Continue happened to be put the requested control
 *     below the fold. A section change (`'if-needed'`) scrolls only when the heading is not
 *     comfortably visible — under the chrome, below the fold, or in the lower half of what is
 *     left — so the new section's title is not scrolled away on arrival. `scrollIntoView` moves
 *     whichever ancestor actually scrolls, and the measured inset rides on `scroll-margin-top`, so
 *     the owner is never guessed either.
 *   - Instant, never smooth — explicitly `'instant'`, not `'auto'`: the site sets
 *     `html:focus-within { scroll-behavior: smooth }`, so `'auto'` became a smooth scroll that the
 *     step's own re-render cancelled, leaving the page where it was. Instant also respects a
 *     reduced-motion preference by construction, and the focus move below does not race it.
 *   - Focus moves with `preventScroll`, after the scroll, so the browser does not re-scroll it.
 */

const COMFORT_MARGIN_PX = 12

/** Bottom edge of the chrome pinned across the top of the viewport right now, in CSS pixels. */
export function pinnedTopInset(doc: Document = document): number {
  const view = doc.defaultView
  if (!view) return 0
  const width = view.innerWidth || doc.documentElement.clientWidth
  let inset = 0
  for (const element of Array.from(doc.body?.querySelectorAll<HTMLElement>('*') ?? [])) {
    const position = view.getComputedStyle(element).position
    if (position !== 'fixed' && position !== 'sticky') continue
    const rect = element.getBoundingClientRect()
    if (rect.height <= 0 || rect.top > 1 || rect.bottom <= 0) continue
    // Chrome across the page, not a floating button or a small badge in a corner.
    if (rect.width < width * 0.5) continue
    // A pinned element taller than half the viewport is a panel, not chrome.
    if (rect.height > view.innerHeight * 0.5) continue
    inset = Math.max(inset, rect.bottom)
  }
  return Math.round(inset)
}

/** Whether the heading sits under the chrome, below the fold, or low in the remaining view. */
export function headingNeedsReveal(
  rect: DOMRect | { top: number; bottom: number },
  inset: number,
  viewportHeight: number,
): boolean {
  const available = viewportHeight - inset
  if (rect.top < inset) return true
  if (rect.bottom > viewportHeight) return true
  return rect.top > inset + available / 2
}

export function revealTaskHeading(
  heading: HTMLElement,
  align: 'always' | 'if-needed' = 'always',
): void {
  const view = heading.ownerDocument.defaultView
  if (!view) return
  const inset = pinnedTopInset(heading.ownerDocument)
  const target = inset + COMFORT_MARGIN_PX
  heading.style.scrollMarginTop = `${target}px`
  const rect = heading.getBoundingClientRect()
  const needed =
    align === 'always'
      ? Math.abs(rect.top - target) > 2
      : headingNeedsReveal(rect, inset, view.innerHeight)
  // `scrollIntoView` is absent in some non-browser renderers (jsdom); focus still moves there.
  if (needed && typeof heading.scrollIntoView === 'function') {
    heading.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' })
  }
  heading.focus({ preventScroll: true })
}

/*
 * A section change goes through the router and remounts the Learn host, so the handler that asked
 * for it is gone by the time the new section renders. It leaves this one-shot flag; the new
 * section's first render reads and clears it. A reload, a link from elsewhere, or the back button
 * never sets it, so an ordinary page load does not move focus.
 */
let headingRevealRequestedAt: number | null = null
/* A request older than this belongs to a navigation that never arrived; it is dropped. */
const REQUEST_LIFETIME_MS = 15_000

export function requestTaskHeadingReveal(): void {
  headingRevealRequestedAt = Date.now()
}

export function consumeTaskHeadingReveal(): boolean {
  const requestedAt = headingRevealRequestedAt
  headingRevealRequestedAt = null
  return requestedAt !== null && Date.now() - requestedAt <= REQUEST_LIFETIME_MS
}
