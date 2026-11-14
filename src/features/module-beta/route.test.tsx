import { render, screen, within } from '@testing-library/react'

import { BetaHubSections } from './BetaHubSections'
import { betaModules } from './catalog'
import { betaRollout, hubBetaModules, type BetaRollout } from './rollout'
import {
  betaRouteErrors,
  betaRouteForGroup,
  betaRoutePlace,
  criticalCareRoute,
  inRouteOrder,
} from './route'

/**
 * The critical care route on the reviewer hub.
 *
 * The five critical care modules were listed in the order they were built, and nothing said which
 * to open first. The hub now lists them in the order the critical care plan settled, numbers
 * them, and gives each one line on why it sits there. It is a suggestion: every module still
 * opens on its own.
 */
describe('the critical care route', () => {
  it('is hemodynamics, ventilation, CRRT, MCS, ECMO (owner, 2026-11-10)', () => {
    expect(criticalCareRoute.steps.map((step) => step.moduleId)).toEqual([
      'icu-hemodynamics',
      'mechanical-ventilation',
      'baxter-crrt',
      'mechanical-circulatory-support',
      'cardiohelp-ecmo',
    ])
    expect(betaRouteErrors()).toEqual([])
  })

  it('covers every critical care module on the hub, and no other', () => {
    const onHub = hubBetaModules
      .filter((entry) => entry.group === 'Critical care')
      .map((entry) => entry.id)
      .sort()
    expect([...criticalCareRoute.steps.map((step) => step.moduleId)].sort()).toEqual(onHub)
    for (const entry of betaModules.filter((item) => item.group !== 'Critical care'))
      expect(betaRoutePlace(entry.id)).toBeNull()
    expect(betaRouteForGroup('Bronchoscopy')).toBeNull()
  })

  it('gives each module one sentence, with no builder words and no promise of a lock', () => {
    for (const step of criticalCareRoute.steps) {
      expect(step.why).toMatch(/^(First|Second|Third|Fourth|Last): .+\.$/)
      expect(step.why.length).toBeLessThanOrEqual(130)
      expect(step.why).not.toMatch(/prerequisite|unlock|required|must|simulat|model\b/i)
    }
    expect(criticalCareRoute.intro).toMatch(/can be reviewed on its own/)
  })

  it('orders a group by the route and leaves any other module after it, as it was', () => {
    const entries = [
      { id: 'cardiohelp-ecmo' },
      { id: 'something-new' },
      { id: 'baxter-crrt' },
      { id: 'icu-hemodynamics' },
    ]
    expect(inRouteOrder(entries, criticalCareRoute).map((entry) => entry.id)).toEqual([
      'icu-hemodynamics',
      'baxter-crrt',
      'cardiohelp-ecmo',
      'something-new',
    ])
    expect(inRouteOrder(entries, null)).toBe(entries)
  })
})

describe('the hub, with the route', () => {
  const critical = () => {
    const heading = screen.getByRole('heading', { name: 'Critical care', level: 3 })
    return heading.parentElement as HTMLElement
  }

  it('lists the five in route order under one line that says it is a suggestion', () => {
    render(<BetaHubSections locale="en" modules={hubBetaModules} rollout={betaRollout} />)
    const group = critical()
    expect(group.querySelector('[data-route-intro]')!.textContent).toBe(criticalCareRoute.intro)
    expect(
      within(group)
        .getAllByRole('heading', { level: 4 })
        .map((heading) => heading.textContent),
    ).toEqual([
      'ICU Hemodynamics',
      'Mechanical Ventilation',
      'Baxter CRRT',
      'Mechanical Circulatory Support',
      'Cardiohelp ECMO',
    ])
  })

  it('numbers each card and says why it sits there, above the module’s own note', () => {
    render(<BetaHubSections locale="en" modules={hubBetaModules} rollout={betaRollout} />)
    criticalCareRoute.steps.forEach((step, index) => {
      const entry = hubBetaModules.find((item) => item.id === step.moduleId)!
      const card = within(critical())
        .getByRole('heading', { name: entry.title })
        .closest('article') as HTMLElement
      const place = card.querySelector('[data-route-step]')!
      expect(place).toHaveAttribute('data-route-step', String(index + 1))
      expect(place.textContent).toBe(`Critical care route · ${index + 1} of 5. ${step.why}`)
      const note = betaRollout[entry.id].note!
      expect(
        place.compareDocumentPosition(within(card).getByText(note.summary)) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      // The card still opens the module the one way a hub card does.
      expect(within(card).getAllByRole('link')).toHaveLength(1)
    })
  })

  it('says nothing about a route on any other card', () => {
    render(<BetaHubSections locale="en" modules={hubBetaModules} rollout={betaRollout} />)
    expect(document.querySelectorAll('[data-route-step]')).toHaveLength(5)
    expect(document.querySelectorAll('[data-route-intro]')).toHaveLength(1)
  })

  it('keeps a module’s place in the route when it moves to Ready for review', () => {
    const rollout: BetaRollout = {
      ...betaRollout,
      'mechanical-ventilation': {
        stage: 'ready',
        note: betaRollout['mechanical-ventilation'].note!,
      },
    }
    render(<BetaHubSections locale="en" modules={hubBetaModules} rollout={rollout} />)
    const ready = screen.getByRole('region', { name: 'Ready for review' })
    expect(ready.querySelector('[data-route-step]')!.textContent).toMatch(
      /^Critical care route · 2 of 5\. Second: /,
    )
    // The four still in development keep their own numbers.
    expect(
      [...critical().querySelectorAll('[data-route-step]')].map((place) =>
        place.getAttribute('data-route-step'),
      ),
    ).toEqual(['1', '3', '4', '5'])
  })
})
