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
 *   - The pinned chrome is measured when the navigation happens, not assumed: every painted fixed
 *     or sticky element that is currently pinned across the top of the viewport. No fixed offset,
 *     and a hidden element's box counts for nothing.
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

/**
 * Whether an element is actually painted. A hidden fixed or sticky element — a closed drawer, a
 * dismissed banner, a measuring probe — keeps its box across the top of the viewport and covers
 * nothing, so it must not set the inset. `checkVisibility` also answers for hidden ancestors;
 * where a renderer lacks it, the element's own computed style is the test.
 */
function isPainted(element: HTMLElement, style: CSSStyleDeclaration): boolean {
  if (style.display === 'none') return false
  if (style.visibility === 'hidden' || style.visibility === 'collapse') return false
  if (Number(style.opacity) === 0) return false
  if (typeof element.checkVisibility === 'function')
    return element.checkVisibility({ visibilityProperty: true, opacityProperty: true })
  return true
}

/** Bottom edge of the chrome pinned across the top of the viewport right now, in CSS pixels. */
export function pinnedTopInset(doc: Document = document): number {
  const view = doc.defaultView
  if (!view) return 0
  const width = view.innerWidth || doc.documentElement.clientWidth
  let inset = 0
  for (const element of Array.from(doc.body?.querySelectorAll<HTMLElement>('*') ?? [])) {
    const style = view.getComputedStyle(element)
    const position = style.position
    if (position !== 'fixed' && position !== 'sticky') continue
    // Sticky with no top offset is not held at the top edge; it is content passing under it.
    if (position === 'sticky' && style.top === 'auto') continue
    if (!isPainted(element, style)) continue
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
 * for it is gone by the time the new section renders. It leaves a request naming the section it is
 * navigating to; that section's first render takes it. A reload, a link from elsewhere or the back
 * button never makes one, so an ordinary page load does not move focus.
 *
 * The request belongs to one same-tab navigation, not to "whichever section renders next":
 *
 *   - It names its destination, and only that section can take it. It used to be a bare
 *     module-global timestamp: Command-clicking "Continue to …" opened the next section in a new
 *     tab and left the request behind in this one, where the next section to render within 15
 *     seconds — any section — took focus for a navigation that had happened somewhere else
 *     (PR #290 review, R4).
 *   - An activation that does not navigate this tab (a modified click, another mouse button, a link
 *     with its own target) never makes one: `activatesThisTab`.
 *   - A navigation that settles with its origin still on screen, or that is overtaken by the
 *     browser's back or forward, withdraws it: `cancelTaskHeadingReveal` and the one-shot
 *     `popstate` listener that lives only as long as the request does.
 *   - The age limit is kept as a last bound for a navigation that never arrives and never reports
 *     it. It is no longer what identifies the request.
 *
 * No timer waits for or forces a navigation: the request is data that the destination reads.
 */
interface HeadingRevealRequest {
  readonly sectionId: string
  readonly requestedAt: number
}
let pendingReveal: HeadingRevealRequest | null = null
/* A request older than this belongs to a navigation that never arrived; it is dropped. */
const REQUEST_LIFETIME_MS = 15_000

function dropPendingReveal(): void {
  pendingReveal = null
  if (typeof window !== 'undefined') window.removeEventListener('popstate', dropPendingReveal)
}

/**
 * Whether a click navigates this tab: the primary button, no modifier key, and no target or
 * download of its own on the link. Anything else is the browser opening the destination somewhere
 * else (or saving it), and this tab stays where it is. The same rule the framework's link uses to
 * decide whether to handle a click itself.
 */
export function activatesThisTab(event: {
  readonly metaKey?: boolean
  readonly ctrlKey?: boolean
  readonly shiftKey?: boolean
  readonly altKey?: boolean
  readonly button?: number
  readonly currentTarget?: EventTarget | null
}): boolean {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  if (event.button !== undefined && event.button !== 0) return false
  const link = event.currentTarget
  if (typeof HTMLAnchorElement !== 'undefined' && link instanceof HTMLAnchorElement) {
    const target = link.getAttribute('target')
    if (target && target !== '_self') return false
    if (link.hasAttribute('download')) return false
  }
  return true
}

/** Ask the named section to reveal its first heading when this tab arrives at it. */
export function requestTaskHeadingReveal(sectionId: string): void {
  dropPendingReveal()
  pendingReveal = { sectionId, requestedAt: Date.now() }
  if (typeof window !== 'undefined') window.addEventListener('popstate', dropPendingReveal)
}

/**
 * Withdraw a request whose navigation did not happen. With a section, only a request for that
 * section is withdrawn, so a handler cannot cancel a newer navigation it did not start.
 */
export function cancelTaskHeadingReveal(sectionId?: string): void {
  if (sectionId !== undefined && pendingReveal?.sectionId !== sectionId) return
  dropPendingReveal()
}

/**
 * True, once, for the section the pending request names. A request for another section is left
 * for that section: this arrival is not the navigation that was asked for, and takes nothing.
 */
export function consumeTaskHeadingReveal(sectionId: string): boolean {
  const request = pendingReveal
  if (request === null) return false
  if (Date.now() - request.requestedAt > REQUEST_LIFETIME_MS) {
    dropPendingReveal()
    return false
  }
  if (request.sectionId !== sectionId) return false
  dropPendingReveal()
  return true
}
