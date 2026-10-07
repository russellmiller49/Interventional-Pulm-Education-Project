import { render, screen, within } from '@testing-library/react'

import { BetaHubSections } from './BetaHubSections'
import { betaModules } from './catalog'
import { betaRollout, type BetaRollout } from './rollout'

const allPreview = Object.fromEntries(
  betaModules.map((entry) => [entry.id, { stage: 'preview' }]),
) as BetaRollout

describe('hub module sections', () => {
  it('lists every module once with both of its links, whatever its stage', () => {
    render(<BetaHubSections locale="en" modules={betaModules} rollout={betaRollout} />)
    expect(screen.getAllByRole('link', { name: /Test with feedback/ })).toHaveLength(
      betaModules.length,
    )
    expect(screen.getAllByRole('link', { name: 'Standard module' })).toHaveLength(
      betaModules.length,
    )
    for (const entry of betaModules) {
      expect(screen.getAllByRole('heading', { name: entry.title })).toHaveLength(1)
    }
  })

  it('has no ready section while nothing is ready', () => {
    render(<BetaHubSections locale="en" modules={betaModules} rollout={allPreview} />)
    expect(screen.queryByRole('heading', { name: 'Ready for review' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Still in development' })).toBeInTheDocument()
  })

  it('moves a ready module to the first section with its note and the same two links', () => {
    const rollout: BetaRollout = {
      ...allPreview,
      devices: {
        stage: 'ready',
        note: {
          summary: 'A reference atlas of bronchoscopy devices.',
          minutes: 20,
          lookFor: ['Whether a device is easy to find by type'],
          knownLimits: ['Market status is unverified for some products'],
        },
      },
    }
    render(<BetaHubSections locale="es" modules={betaModules} rollout={rollout} />)

    const ready = screen.getByRole('region', { name: 'Ready for review' })
    expect(within(ready).getByRole('heading', { name: /Device Atlas/ })).toBeInTheDocument()
    expect(within(ready).getByText(/about 20 minutes/)).toBeInTheDocument()
    expect(within(ready).getByText('A reference atlas of bronchoscopy devices.')).toBeVisible()
    expect(within(ready).getByText('Whether a device is easy to find by type')).toBeVisible()
    expect(within(ready).getByText('Market status is unverified for some products')).toBeVisible()
    // Marking a module ready changes where it is listed, not how it opens.
    expect(within(ready).getByRole('link', { name: /Test with feedback/ })).toHaveAttribute(
      'href',
      '/es/development-beta/devices',
    )
    expect(within(ready).getByRole('link', { name: 'Standard module' })).toHaveAttribute(
      'href',
      '/es/devices',
    )

    const preview = screen.getByRole('region', { name: 'Still in development' })
    expect(within(preview).queryByRole('heading', { name: /Device Atlas/ })).not.toBeInTheDocument()
    // Device Atlas was the only module in its group, so the group heading is not left empty.
    expect(within(preview).queryByRole('heading', { name: 'Devices' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Test with feedback/ })).toHaveLength(
      betaModules.length,
    )
  })
})
