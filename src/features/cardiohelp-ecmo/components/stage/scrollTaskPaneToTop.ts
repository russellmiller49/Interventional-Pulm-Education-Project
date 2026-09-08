/**
 * Put the Now card back in view when the step changes.
 *
 * Both hosts move focus to the Now card on every step change and pass `preventScroll: true`, which
 * stops the browser scrolling the document — and does nothing about the pane the card actually
 * lives in. That pane is its own scroll container, so a learner who had scrolled down to reach the
 * step list, the actions or the story problems stayed exactly there when the step advanced, looking
 * at a list of steps with the instruction for the new one off the top of the pane.
 *
 * A learner review in September 2026, on the very build that put the steps on the left: "the
 * left-most 'steps panel' doesn't re-scroll back to the top, so you're left wondering what to do
 * next… happens in several other sections."
 *
 * Deliberately not `scrollIntoView`: that scrolls every scrollable ancestor including the document,
 * which is the jump `preventScroll` was there to avoid. This walks up to the one element that is
 * actually scrolling and resets it, so nothing outside the pane moves.
 */
export function scrollTaskPaneToTop(node: HTMLElement | null): void {
  if (!node || typeof window === 'undefined') return
  for (let element = node.parentElement; element; element = element.parentElement) {
    const overflowY = window.getComputedStyle(element).overflowY
    if (overflowY !== 'auto' && overflowY !== 'scroll') continue
    if (element.scrollHeight <= element.clientHeight) continue
    element.scrollTop = 0
    return
  }
}
