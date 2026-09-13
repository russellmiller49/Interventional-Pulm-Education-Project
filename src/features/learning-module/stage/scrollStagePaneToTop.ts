/**
 * Put a stage pane back at its top when the step changes.
 *
 * Every host moves focus to the Now card on a step change and passes `preventScroll: true`, which
 * stops the browser scrolling the document — and does nothing about the pane the card actually
 * lives in. Each pane is its own scroll container, so a learner who had scrolled down to reach the
 * step list, the actions or the story problems stayed exactly there when the step advanced, looking
 * at a list of steps with the instruction for the new one off the top of the pane. The teaching
 * pane has the same defect in the other direction: its blocks re-scope to the new phase, and the
 * block that is now the focus can sit well above the fold a learner had scrolled to.
 *
 * A learner review in September 2026, on the very build that put the steps on the left: "the
 * left-most 'steps panel' doesn't re-scroll back to the top, so you're left wondering what to do
 * next… happens in several other sections." ECMO fixed it for its steps pane in R6 (R6-OD-1) with a
 * module-local copy of this function; the shared stage now owns it, for both panes, so the four
 * adopters and ECMO's own stage copy run one implementation.
 *
 * Deliberately not `scrollIntoView`: that scrolls every scrollable ancestor including the document,
 * which is the jump `preventScroll` was there to avoid. This walks up to the one element that is
 * actually scrolling and resets it, so nothing outside the pane moves — and it stops at the
 * document, which it never scrolls: below the fixed-workspace viewport the panes stack and the
 * document is the scroller, and a step change must not yank the page to the top there.
 */
export function scrollStagePaneToTop(node: HTMLElement | null): void {
  if (!node || typeof window === 'undefined') return
  const { body, documentElement } = document
  for (
    let element = node.parentElement;
    element && element !== body && element !== documentElement;
    element = element.parentElement
  ) {
    const overflowY = window.getComputedStyle(element).overflowY
    if (overflowY !== 'auto' && overflowY !== 'scroll') continue
    if (element.scrollHeight <= element.clientHeight) continue
    element.scrollTop = 0
    return
  }
}
