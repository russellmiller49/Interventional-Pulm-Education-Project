import { render, screen } from '@testing-library/react'

import { PreferenceCardWizard } from '../components/PreferenceCardWizard'
import { getScenarioDefinitions } from '../data/demo-context.server'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/app/[locale]/preference-cards/new/actions', () => ({
  saveUserCardAction: jest.fn(),
}))

describe('procedure-selection coverage language', () => {
  it('shows catalog and curated-default counts without calling either readiness or mapping', () => {
    const scenario = getScenarioDefinitions()[0]
    render(<PreferenceCardWizard scenarios={[scenario]} />)

    expect(
      screen.getByText(
        `Catalog alternatives: ${scenario.requiredCatalogCoverageCount} of ${scenario.requiredSlotCount} required lines`,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        `Curated defaults: ${scenario.requiredDefaultOptionCoverageCount} of ${scenario.requiredSlotCount} required lines`,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Neither metric establishes readiness, compatibility, current orderability, local approval, or clinical suitability\./,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/required roles mapped/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/^(Blocked|Complete|Complete with warnings)$/),
    ).not.toBeInTheDocument()
  })
})
