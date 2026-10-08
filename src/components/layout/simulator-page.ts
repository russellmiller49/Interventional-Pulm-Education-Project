/**
 * Layout for a page whose subject is one embedded simulator.
 *
 * These pages used to open with a full hero — badge, display title, description, a "What's
 * inside" card — above a frame with an 820–900 px minimum height. At 1707 × 900 the frame started
 * 550–700 px down the page and could never be seen whole, so its controls and what they change
 * were on different screens. The simulator now starts directly under a one-line title row and is
 * sized to the viewport beneath the site header; the description and highlights follow it.
 *
 * Class names rather than a component: each page keeps its own JSX inside `HandoffContent`, which
 * localizes the text it finds in that tree.
 */
export const simulatorPage = {
  root: 'space-y-10 pb-16 pt-3',
  /** Spans the window: the simulator, not a reading column, is the content. */
  stage: 'mx-auto w-full max-w-[2400px] space-y-2 px-3 sm:px-4',
  header: 'flex flex-wrap items-center gap-x-4 gap-y-2',
  identity: 'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1',
  title: 'text-xl font-bold tracking-tight md:text-2xl',
  actions: 'ms-auto flex flex-wrap items-center gap-2',
  aboutLink: 'text-sm font-semibold text-primary underline-offset-4 hover:underline',
  frame: 'overflow-hidden rounded-xl border border-border/70 bg-card/70 shadow-sm',
  /**
   * The viewport, less the site header and the title row above the frame (about 4.25rem with its
   * margins). The floor keeps a short window usable; the page scrolls a little there instead.
   */
  iframe: 'h-[calc(100dvh-var(--site-header-height)-4.25rem)] min-h-[600px] w-full',
  about: 'container scroll-mt-24 space-y-6',
} as const

/** Target of the title row's "What's inside" link: the description and highlights under the frame. */
export const SIMULATOR_ABOUT_ID = 'about-this-module'
