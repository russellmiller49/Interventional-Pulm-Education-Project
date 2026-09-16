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
