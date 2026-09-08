import { fireEvent, render } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { clinicalPracticeScenarios } from '../content/clinicalCases'
import { createInitialSimulationState, selectScenarioOutcome } from '../engine'
import { EcmoCaseDebrief } from '../components/practice/EcmoCaseDebrief'

/**
 * Advancing to the next case loads it; it does not navigate to it.
 *
 * The next-case target is the practice route with a different `case` query, and the session hydrates
 * from `window.location.search` in an effect keyed on `section` — read once, on mount. So a
 * client-side push to the same route moved the address bar and left the case exactly where it was.
 * The learner report was simply "I can't advance to the next case", and from the outside that is
 * indistinguishable from a dead button.
 *
 * Pinned at the debrief rather than through a whole worked case, because the defect is entirely in
 * how the control is wired: the fix is that a same-route target carries an `onSelect` which loads
 * the scenario in place, and the control calls it instead of following its own href.
 */

const mockRouterPush = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
    return (
      <a href={resolved} {...rest}>
        {children}
      </a>
    )
  },
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/practice',
}))

function renderDebrief(nextLink: Parameters<typeof EcmoCaseDebrief>[0]['nextLink']) {
  const scenario = clinicalPracticeScenarios[0]
  const state = createInitialSimulationState(scenario.id, 'guided')
  return render(
    <EcmoCaseDebrief
      state={state}
      scenario={scenario}
      outcome={selectScenarioOutcome(state)}
      supportMode={scenario.supportMode}
      nextLink={nextLink}
      onReplay={jest.fn()}
    />,
  )
}

describe('advancing from the debrief', () => {
  beforeEach(() => {
    mockRouterPush.mockClear()
  })

  it('loads the next case in place rather than following the link', () => {
    const onSelect = jest.fn()
    renderDebrief({
      label: 'Case · the next one',
      href: { pathname: '/cardiohelp-ecmo/practice', query: { case: 'next-case', track: 'vv' } },
      onSelect,
    })

    const next = document.querySelector<HTMLAnchorElement>('[data-debrief-next]')
    expect(next).not.toBeNull()
    // The href stays: the control is still a real link to open in a new tab.
    expect(next).toHaveAttribute(
      'href',
      expect.stringContaining('case=next-case') as unknown as string,
    )

    const clicked = fireEvent.click(next!)
    expect(onSelect).toHaveBeenCalledTimes(1)
    // `fireEvent.click` returns false when a handler called preventDefault, which is what stops the
    // same-route navigation that did nothing.
    expect(clicked).toBe(false)
  })

  it('still navigates when the target is a different route', () => {
    renderDebrief({
      label: 'Lesson · the next section',
      href: { pathname: '/cardiohelp-ecmo/learn', query: { lesson: 'a-lesson', track: 'vv' } },
    })

    const next = document.querySelector<HTMLAnchorElement>('[data-debrief-next]')
    expect(next).not.toBeNull()
    // No handler, so the anchor is left to do what an anchor does.
    expect(fireEvent.click(next!)).toBe(true)
  })
})
