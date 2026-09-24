/** Scroll only the ECMO reading surface or the nearest independently scrolling pane. */
export function ecmoScrollOwner(node: HTMLElement): HTMLElement | null {
  for (
    let element = node.parentElement;
    element && element !== document.body;
    element = element.parentElement
  ) {
    const { overflowY } = window.getComputedStyle(element)
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      element.scrollHeight > element.clientHeight
    ) {
      return element
    }
  }
  return null
}

function documentCanScroll(): boolean {
  return (
    (window.innerWidth < 1024 || window.innerHeight < 700) &&
    window.getComputedStyle(document.body).overflowY !== 'hidden'
  )
}

function siteHeaderHeight(): number {
  return (
    document.getElementById('main-content')?.previousElementSibling?.getBoundingClientRect()
      .height ?? 0
  )
}

/** Task changes restore the section header too; never scroll locked outer activity wrappers. */
export function scrollTaskPaneToTop(node: HTMLElement | null): void {
  if (!node || typeof window === 'undefined') return
  const owner = ecmoScrollOwner(node)
  if (owner) {
    owner.scrollTop = 0
  } else if (documentCanScroll()) {
    const shell = node.closest('[data-ecmo-shell]') ?? node
    window.scrollTo({
      top: Math.max(0, window.scrollY + shell.getBoundingClientRect().top - siteHeaderHeight()),
      behavior: 'instant',
    })
  }
}

/** Focus callers use preventScroll, then reveal their target through this single scroll owner. */
export function scrollEcmoTargetIntoView(
  node: HTMLElement,
  behavior: ScrollBehavior = 'auto',
): void {
  const owner = ecmoScrollOwner(node)
  const shell = node.closest('[data-ecmo-shell]')
  const strip = shell?.querySelector<HTMLElement>('[data-ecmo-context-strip]')
  const stickyStripHeight =
    strip && window.getComputedStyle(strip).position === 'sticky'
      ? strip.getBoundingClientRect().height
      : 0
  const label = owner?.querySelector<HTMLElement>(':scope > [data-pane-label]')
  const inset = stickyStripHeight + (label?.getBoundingClientRect().height ?? 0) + 16
  if (owner) {
    owner.scrollTo({
      top:
        owner.scrollTop +
        node.getBoundingClientRect().top -
        owner.getBoundingClientRect().top -
        inset,
      behavior,
    })
  } else if (documentCanScroll()) {
    window.scrollTo({
      top: window.scrollY + node.getBoundingClientRect().top - siteHeaderHeight() - inset,
      behavior,
    })
  }
}

/**
 * Bring a node into view only as far as it is not already in view, through the same scroll owner.
 *
 * For a result that appears right under the control that produced it: a node already on screen is
 * left where it is, and one that runs past the bottom edge is scrolled up just far enough to show its
 * end (or its top, when it is taller than the view) — never a jump that takes the control off screen.
 */
export function revealEcmoTargetIfNeeded(node: HTMLElement): void {
  if (typeof window === 'undefined') return
  const owner = ecmoScrollOwner(node)
  const rect = node.getBoundingClientRect()
  const top = owner ? owner.getBoundingClientRect().top : siteHeaderHeight()
  const bottom = owner ? owner.getBoundingClientRect().bottom : window.innerHeight
  const margin = 16
  let delta = 0
  if (rect.top < top + margin) delta = rect.top - top - margin
  else if (rect.bottom > bottom - margin)
    delta = Math.min(rect.bottom - bottom + margin, rect.top - top - margin)
  if (Math.abs(delta) < 1) return
  if (owner) owner.scrollTo({ top: owner.scrollTop + delta, behavior: 'auto' })
  else if (documentCanScroll()) window.scrollTo({ top: window.scrollY + delta, behavior: 'auto' })
}
