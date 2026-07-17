import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import BaxterCrrtLab from '../components/BaxterCrrtLab'
import { CrrtReferenceDrawer } from '../components/CrrtReferenceDrawer'
import { getBaxterCrrtPilotCase } from '../content'
import {
  advanceCrrtSimulation,
  createCrrtLearningSession,
  selectPrescriptionSummary,
} from '../engine'

jest.mock('@/lib/analytics', () => ({
  recordSiteModuleEvent: jest.fn(),
}))

function buildSession() {
  return createCrrtLearningSession({
    caseDefinition: getBaxterCrrtPilotCase('CRRT-04'),
    experience: 'learn',
    roleLens: 'integrated',
    attempt: 1,
  })
}

function buildSessionWithTrends() {
  const session = buildSession()
  return {
    ...session,
    simulation: advanceCrrtSimulation(session.simulation, 300),
  }
}

describe('CRRT learner reference drawer', () => {
  it('is absent from case-free Orientation and collapsed by default in a learner pathway', async () => {
    const user = userEvent.setup()
    render(<BaxterCrrtLab />)

    expect(screen.queryByTestId('crrt-reference-drawer')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /^Learn/ }))

    const drawer = screen.getByTestId('crrt-reference-drawer')
    const summary = within(drawer).getByText('Attempt reference drawer').closest('summary')
    expect(drawer).not.toHaveAttribute('open')
    expect(summary).toHaveAttribute('aria-expanded', 'false')
    expect(summary).not.toBeNull()
    expect(
      within(drawer).queryByRole('tablist', { name: 'Attempt reference sections' }),
    ).not.toBeInTheDocument()

    if (!summary) throw new Error('Expected the native reference drawer summary.')
    await user.click(summary)

    expect(drawer).toHaveAttribute('open')
    expect(summary).toHaveAttribute('aria-expanded', 'true')
    expect(
      within(drawer).getByRole('tablist', { name: 'Attempt reference sections' }),
    ).toBeVisible()
  })

  it('provides complete tab semantics and keyboard navigation', async () => {
    const user = userEvent.setup()
    render(<CrrtReferenceDrawer session={buildSession()} />)

    const drawer = screen.getByTestId('crrt-reference-drawer')
    const summary = within(drawer).getByText('Attempt reference drawer').closest('summary')
    if (!summary) throw new Error('Expected the native reference drawer summary.')
    await user.click(summary)

    const tabList = within(drawer).getByRole('tablist', { name: 'Attempt reference sections' })
    const tabs = within(tabList).getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Prescription',
      'History',
      'Events',
      'Trends',
      'Equations',
    ])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('tabindex', '0')
    expect(tabs.slice(1).every((tab) => tab.getAttribute('tabindex') === '-1')).toBe(true)

    for (const tab of tabs) {
      const panelId = tab.getAttribute('aria-controls')
      expect(panelId).not.toBeNull()
      const panel = panelId ? document.getElementById(panelId) : null
      expect(panel).toHaveAttribute('role', 'tabpanel')
      expect(panel).toHaveAttribute('aria-labelledby', tab.id)
    }

    tabs[0].focus()
    await user.keyboard('{ArrowRight}')
    expect(tabs[1]).toHaveFocus()
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(within(drawer).getByRole('tabpanel')).toHaveAccessibleName('History')

    await user.keyboard('{End}')
    expect(tabs[4]).toHaveFocus()
    expect(tabs[4]).toHaveAttribute('aria-selected', 'true')
    expect(within(drawer).getByRole('tabpanel')).toHaveAccessibleName('Equations')

    await user.keyboard('{Home}')
    expect(tabs[0]).toHaveFocus()
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('contains reference navigation only and fails closed for unavailable sections', async () => {
    const user = userEvent.setup()
    const { container } = render(<CrrtReferenceDrawer session={buildSession()} />)
    const drawer = screen.getByTestId('crrt-reference-drawer')
    const summary = within(drawer).getByText('Attempt reference drawer').closest('summary')
    if (!summary) throw new Error('Expected the native reference drawer summary.')
    await user.click(summary)

    expect(drawer.querySelectorAll('button')).toHaveLength(5)
    expect(drawer.querySelectorAll('form, input, select, textarea')).toHaveLength(0)
    expect(
      within(drawer).queryByRole('button', {
        name: /perform|advance|commit|apply|start|stop|acknowledge|correct/i,
      }),
    ).not.toBeInTheDocument()

    await user.click(within(drawer).getByRole('tab', { name: 'Events' }))
    expect(within(drawer).getByRole('tabpanel')).toHaveTextContent(
      'No seeded engine events have occurred yet.',
    )
    expect(container).not.toHaveTextContent('scheduled at')

    await user.click(within(drawer).getByRole('tab', { name: 'Equations' }))
    expect(
      within(drawer).getByRole('note', { name: 'Equation reference unavailable' }),
    ).toHaveTextContent(/educator-only in development/i)
    expect(drawer).toHaveTextContent('no operational controls')
  })

  it('renders deterministic prescription and trend content from the supplied session only', async () => {
    const user = userEvent.setup()
    const session = buildSessionWithTrends()
    const expectedPrescription = selectPrescriptionSummary(session.simulation)
    const firstRender = render(<CrrtReferenceDrawer session={session} />)
    const firstText = firstRender.container.textContent

    firstRender.unmount()
    render(<CrrtReferenceDrawer session={buildSessionWithTrends()} />)
    expect(screen.getByTestId('crrt-reference-drawer').textContent).toBe(firstText)

    const drawer = screen.getByTestId('crrt-reference-drawer')
    const summary = within(drawer).getByText('Attempt reference drawer').closest('summary')
    if (!summary) throw new Error('Expected the native reference drawer summary.')
    await user.click(summary)

    const prescriptionPanel = within(drawer).getByRole('tabpanel')
    expect(prescriptionPanel).toHaveAccessibleName('Prescription')
    expect(prescriptionPanel).toHaveTextContent(
      `${expectedPrescription.flows.bloodFlowMlMin.toFixed(0)} mL/min`,
    )
    expect(prescriptionPanel).toHaveTextContent(
      `${expectedPrescription.flows.dialysateFlowMlHour.toFixed(0)} mL/h`,
    )

    await user.click(within(drawer).getByRole('tab', { name: 'Trends' }))
    const trendPanel = within(drawer).getByRole('tabpanel')
    expect(trendPanel).toHaveAccessibleName('Trends')
    expect(within(trendPanel).getByRole('table')).toHaveTextContent('Prescribed dose')
    expect(
      within(trendPanel).getByRole('region', {
        name: /Reference pressure and dose trends/i,
      }),
    ).toHaveAttribute('tabindex', '0')
  })
})
