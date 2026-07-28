import { render, screen } from '@testing-library/react'

import {
  buildDemoContext,
  defaultBuildInput,
  resolveDemoScenario,
} from '../data/demo-context.server'
import { resolveCard } from '../domain/resolve-card'
import { PreferenceCardTabs, PrintCardView } from '../components/PreferenceCardViews'
import { intentionallyFailingApcRule } from '../__fixtures__/test-compatibility-rules'

/** The failing APC rule is a test fixture, so it is injected rather than seeded. */
function cardWithBlockingApcException() {
  const context = buildDemoContext('central-airway-obstruction')
  return resolveCard(defaultBuildInput('central-airway-obstruction'), {
    ...context,
    compatibilityRules: [...context.compatibilityRules, intentionallyFailingApcRule],
  })
}

describe('preference-card output views', () => {
  it('renders emergency-pull content and the blocking APC exception', () => {
    const card = cardWithBlockingApcException()
    const { unmount } = render(<PreferenceCardTabs card={card} />)

    expect(
      screen.getByRole('heading', {
        name: /Emergency cart \/ pull list/,
      }),
    ).toBeInTheDocument()

    unmount()
    render(<PreferenceCardTabs card={card} defaultTab="exceptions" />)
    expect(
      screen.getByText(/intentionally incompatible APC probe fixture does not match/i),
    ).toBeInTheDocument()
    expect(screen.getByText('compatibility_failed')).toBeInTheDocument()
  })

  it('renders the explicit unassigned spatial group', () => {
    const card = resolveDemoScenario('ebus-rose-molecular')
    const first = card.items[0]
    first.setupZone = 'unassigned'
    render(<PreferenceCardTabs card={card} />)

    expect(
      screen.getByRole('heading', {
        name: /Unassigned — needs zone\/phase review/,
      }),
    ).toBeInTheDocument()
  })

  it('keeps setup completion marks and mode labels in print output', () => {
    const card = resolveDemoScenario('chest-tube')
    render(<PrintCardView card={card} mode="chronological" />)

    expect(screen.getByText('Chronological workflow')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Setup completion checkbox').length).toBe(card.items.length)
  })
})
