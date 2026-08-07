/**
 * The module boundaries jsdom cannot provide, and deliberately nothing else.
 *
 * These four stubs stand in for navigation, WebGL rendering, and the two lazy visual previews. The
 * reducer, the progress functions, the learning contracts, the scenario definitions, the pathway
 * cards, the derived-value guides, the section-completion logic and the M4 reveal-stage function are
 * all left real, because every one of them is behaviour this package exists to prove.
 *
 * They live in their own module so the five M5 suites register identical boundaries rather than
 * five slightly different ones. Each suite reaches them through `jest.requireActual`, which is
 * legal inside a `jest.mock` factory where a top-level import is not:
 *
 *   jest.mock('../components/McsAnatomy3D', () =>
 *     jest.requireActual<typeof import('../test-support/mcsWorkbenchStubs')>(
 *       '../test-support/mcsWorkbenchStubs',
 *     ).anatomyModule(),
 *   )
 *
 * They sit beside `__tests__` rather than inside it because every file under a `__tests__`
 * directory is collected as a suite, and a helper module with no `it()` in it fails the run.
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import type { McsAnatomyPathwaySummary } from '../components/McsAnatomyPathwaySummary'

/** Captures every `router.push`, so save-and-exit and the launch gate can be asserted. */
export const mockRouterPush = jest.fn()

type HrefObject = { pathname: string; query?: Record<string, string | number | undefined> }

/**
 * Renders the same href a Next `Link` would.
 *
 * The workbench passes object hrefs for its "Next recommended" links. Stringifying them as
 * `[object Object]` would make the one assertion those links exist for — that the query names the
 * right activity — impossible to write.
 */
export function hrefToString(href: string | HrefObject): string {
  if (typeof href === 'string') return href
  const entries = Object.entries(href.query ?? {}).filter(([, value]) => value !== undefined)
  if (entries.length === 0) return href.pathname
  const query = entries.map(([key, value]) => `${key}=${String(value)}`).join('&')
  return `${href.pathname}?${query}`
}

export function navigationModule() {
  return {
    Link: ({
      href,
      children,
      ...rest
    }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
      href: string | HrefObject
      children: ReactNode
    }) => (
      <a href={hrefToString(href)} {...rest}>
        {children}
      </a>
    ),
    useRouter: () => ({ push: mockRouterPush }),
  }
}

/**
 * The 3D canvas is stubbed; the authored pathway summary underneath it is not.
 *
 * The summary carries the anatomy highlight targets a Learn section points at, so stubbing it away
 * would let a section point at a region that never renders and no test would notice.
 */
export function anatomyModule() {
  const { McsAnatomyPathwaySummary: Summary } = jest.requireActual<
    typeof import('../components/McsAnatomyPathwaySummary')
  >('../components/McsAnatomyPathwaySummary')
  return {
    McsAnatomy3D: ({
      revealCausality = true,
      state,
      highlightTarget,
    }: {
      revealCausality?: boolean
      state: Parameters<typeof McsAnatomyPathwaySummary>[0]['state']
      highlightTarget?: Parameters<typeof McsAnatomyPathwaySummary>[0]['highlightTarget']
    }) => (
      <section aria-label="Animated mechanical-support anatomy">
        3D mechanism · coaching {revealCausality ? 'visible' : 'withheld'}
        <Summary state={state} highlightTarget={highlightTarget} />
      </section>
    ),
  }
}

export function ecmoPreviewModule() {
  return { EcmoCannulationPreview: () => <div>ECMO preview</div> }
}

export function impellaPreviewModule() {
  return { ImpellaVariantPreview: () => <div>Impella preview</div> }
}
