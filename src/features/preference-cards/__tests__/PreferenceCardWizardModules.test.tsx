import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PreferenceCardWizard } from '../components/PreferenceCardWizard'
import { buildDemoContext, getScenarioDefinition } from '../data/demo-context.server'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/app/[locale]/preference-cards/new/actions', () => ({
  saveUserCardAction: jest.fn(),
}))

/**
 * The builder has to make the composition visible and controllable: a required core is
 * shown as locked rather than as an unchecked clinical choice, and removing an optional
 * module removes only what that module contributed.
 */

function renderEbusWizard() {
  const definition = getScenarioDefinition('ebus-rose-molecular')!
  const context = buildDemoContext('ebus-rose-molecular')
  return render(
    <PreferenceCardWizard
      scenarios={[definition]}
      bundle={{
        definition,
        context,
        availableModifierCodes: definition.availableModifierCodes,
        releaseBundleId: null,
      }}
    />,
  )
}

describe('included setup modules', () => {
  it('shows EBUS-TBNA assembled from the flexible bronchoscopy core plus its own module', () => {
    renderEbusWizard()

    expect(screen.getByText('Flexible Bronchoscopy Core')).toBeInTheDocument()
    expect(screen.getByText('EBUS-TBNA specific requirements')).toBeInTheDocument()
    expect(screen.getByText('Procedural Fluoroscopy')).toBeInTheDocument()
  })

  it('locks a required module instead of offering it as a choice', () => {
    renderEbusWizard()

    const core = screen
      .getByRole('heading', { name: 'Flexible Bronchoscopy Core' })
      .closest('article')!
    expect(
      within(core).getByText('Required by this procedure and cannot be removed.'),
    ).toBeInTheDocument()
    expect(within(core).queryByRole('button', { name: 'Remove module' })).not.toBeInTheDocument()
  })

  it('lets a default-on module be removed and added back', async () => {
    const user = userEvent.setup()
    renderEbusWizard()

    const imaging = screen
      .getByRole('heading', { name: 'Procedural Fluoroscopy' })
      .closest('article')!
    const remove = within(imaging).getByRole('button', { name: 'Remove module' })
    expect(remove).toHaveAttribute('aria-pressed', 'true')

    await user.click(remove)
    expect(within(imaging).getByRole('button', { name: 'Add module' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    await user.click(within(imaging).getByRole('button', { name: 'Add module' }))
    expect(within(imaging).getByRole('button', { name: 'Remove module' })).toBeInTheDocument()
  })

  it('previews exactly the requirements a module contributes', () => {
    // The count itself is an ICU plural; jest.setup.ts's next-intl mock does not format
    // those, so the formatting is covered by catalog-messages.test.ts under the real
    // formatter and the contributed list is what is asserted here.
    renderEbusWizard()

    const core = screen
      .getByRole('heading', { name: 'Flexible Bronchoscopy Core' })
      .closest('article')!
    expect(within(core).getByText('Compatible video processor/light source')).toBeInTheDocument()
    expect(within(core).getByText('Suction source/tubing/syringes')).toBeInTheDocument()
    expect(within(core).queryByText('Linear EBUS bronchoscope')).not.toBeInTheDocument()
  })

  it('badges each requirement with the module that contributed it', async () => {
    const user = userEvent.setup()
    renderEbusWizard()

    await user.click(screen.getByRole('button', { name: /Step 4 of 5/ }))

    const videoProcessor = screen
      .getByRole('heading', { name: 'Compatible video processor/light source' })
      .closest('article')!
    expect(within(videoProcessor).getByText('Flexible Bronchoscopy Core')).toBeInTheDocument()

    const scope = screen
      .getByRole('heading', { name: 'Linear EBUS bronchoscope' })
      .closest('article')!
    expect(within(scope).getByText('EBUS-TBNA specific requirements')).toBeInTheDocument()
  })

  it('filters the requirement list down to one source module', async () => {
    const user = userEvent.setup()
    renderEbusWizard()

    await user.click(screen.getByRole('button', { name: /Step 4 of 5/ }))
    expect(screen.getByRole('heading', { name: 'Linear EBUS bronchoscope' })).toBeInTheDocument()

    await user.selectOptions(
      screen.getByLabelText('Filter by source module'),
      'module-flex-bronch-core-v1-1',
    )
    expect(
      screen.getByRole('heading', { name: 'Compatible video processor/light source' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Linear EBUS bronchoscope' }),
    ).not.toBeInTheDocument()
  })

  it('summarises the composition on the review step', async () => {
    const user = userEvent.setup()
    renderEbusWizard()

    await user.click(screen.getByRole('button', { name: /Step 5 of 5/ }))
    const summary = screen.getByRole('heading', { name: 'Composed from' }).closest('section')!
    expect(within(summary).getByText('Flexible Bronchoscopy Core')).toBeInTheDocument()
    expect(within(summary).getByText('EBUS-TBNA specific requirements')).toBeInTheDocument()
    expect(within(summary).getAllByText('Version 1.0').length).toBeGreaterThan(0)
  })

  it('offers the custom composition entry point without recommending anything', () => {
    const definition = getScenarioDefinition('ebus-rose-molecular')!
    render(<PreferenceCardWizard scenarios={[definition]} />)

    expect(screen.getByText('Build a custom card from modules')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This is a card-building tool. Nothing is recommended for you — only the module descriptions the reviewers wrote are shown.',
      ),
    ).toBeInTheDocument()
  })
})
