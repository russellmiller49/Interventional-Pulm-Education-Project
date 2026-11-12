import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { BetaHubSections } from './BetaHubSections'
import { betaModules } from './catalog'
import { betaRollout, hubBetaModules, type BetaRollout } from './rollout'
import { betaRevisionHistory } from './revisions'
import { revisionFixture } from './test-support/revisionFixture'

jest.mock('./revisions', () => {
  const actual = jest.requireActual<typeof import('./revisions')>('./revisions')
  return { ...actual, betaRevisionHistory: jest.fn(actual.betaRevisionHistory) }
})

const allPreview = Object.fromEntries(
  betaModules.map((entry) => [entry.id, { stage: 'preview' }]),
) as BetaRollout

describe('hub module sections', () => {
  it('lists every module once, opening only in its feedback wrapper, whatever its stage', () => {
    render(<BetaHubSections locale="en" modules={betaModules} rollout={allPreview} />)
    expect(screen.getAllByRole('link', { name: /Test with feedback/ })).toHaveLength(
      betaModules.length,
    )
    // Direct module links live on Admin › Modules in development, not on the hub (2026-11-09).
    expect(screen.getAllByRole('link')).toHaveLength(betaModules.length)
    for (const link of screen.getAllByRole('link'))
      expect(link.getAttribute('href')).toMatch(/^\/en\/development-beta\/[a-z0-9-]+$/)
    for (const entry of betaModules) {
      expect(screen.getAllByRole('heading', { name: entry.title })).toHaveLength(1)
    }
  })

  it('shows each reviewer note on its card and leaves cards without one as they were', () => {
    render(<BetaHubSections locale="en" modules={hubBetaModules} rollout={betaRollout} />)
    // Nothing is marked ready yet, so every card, with or without a note, is still in development.
    expect(screen.queryByRole('heading', { name: 'Ready for review' })).not.toBeInTheDocument()
    const preview = screen.getByRole('region', { name: 'Still in development' })

    for (const entry of hubBetaModules) {
      const card = within(preview)
        .getByRole('heading', { name: entry.title })
        .closest('article') as HTMLElement
      const { note } = betaRollout[entry.id]
      if (note) {
        expect(within(card).getByText(note.summary)).toBeVisible()
        expect(within(card).getByText(note.audience)).toBeVisible()
        for (const item of [...note.lookFor, ...note.knownLimits]) {
          expect(within(card).getByText(item)).toBeVisible()
        }
        if (note.estimate) {
          const basis = `from ${note.estimate.basis}`
          expect(
            within(card).getByText(
              (_, element) =>
                element?.tagName === 'DD' && element.textContent?.endsWith(basis) === true,
            ),
          ).toBeVisible()
        } else {
          expect(within(card).queryByText('Estimated time:')).not.toBeInTheDocument()
        }
      } else {
        expect(within(card).queryByText('Where feedback helps most')).not.toBeInTheDocument()
      }
    }
    // Every listed module carries a note (owner request, 2026-11-04).
    expect(hubBetaModules.every((entry) => betaRollout[entry.id].note)).toBe(true)
  })

  it('keeps the title and feedback link on a card without a tester note', () => {
    render(<BetaHubSections locale="en" modules={betaModules} rollout={allPreview} />)
    const preview = screen.getByRole('region', { name: 'Still in development' })
    for (const entry of betaModules) {
      const card = within(preview)
        .getByRole('heading', { name: entry.title })
        .closest('article') as HTMLElement
      expect(Array.from(card.children).map((child) => child.tagName)).toEqual(['H4', 'DIV'])
      expect(within(card).getByRole('link', { name: /Test with feedback/ })).toBeVisible()
    }
  })

  it('shows fixture history, the neutral state, and only visible modules', async () => {
    const actual = jest.requireActual<typeof import('./revisions')>('./revisions')
    const withheldFixture = {
      ...revisionFixture,
      moduleId: 'dolphin-bronchoscopy',
      revisionId: 'test-withheld-first',
    } as const
    await jest.mocked(betaRevisionHistory).withImplementation(
      (id) => actual.betaRevisionHistory(id, [revisionFixture, withheldFixture]),
      async () => {
        render(<BetaHubSections locale="en" modules={betaModules} rollout={betaRollout} />)
        const crrt = screen.getByRole('heading', { name: 'Baxter CRRT' }).closest('article')!
        const ebus = screen
          .getByRole('heading', { name: 'EBUS: Guided Course' })
          .closest('article')!
        expect(within(crrt).getByText(revisionFixture.displayVersion)).toBeVisible()
        expect(within(ebus).getByText('Version history not yet available')).toBeVisible()
        expect(
          screen.queryByRole('heading', { name: 'Dolphin Bronchoscopy' }),
        ).not.toBeInTheDocument()
        const trigger = screen.getByRole('button', { name: 'What’s changed' })
        expect(crrt).toContainElement(trigger)
        await userEvent.click(trigger)
        const dialog = within(screen.getByRole('dialog', { name: 'What’s changed' }))
        expect(dialog.getByText(revisionFixture.changelog[0])).toBeVisible()
        expect(dialog.getByText('Jan 15, 2026')).toHaveAttribute(
          'datetime',
          revisionFixture.releasedOn,
        )
        expect(dialog.getByText('Clinical or educational re-review recommended')).toBeVisible()
        expect(dialog.getByRole('link', { name: /Prescription and dosing/ })).toHaveAttribute(
          'href',
          '/en/development-beta/baxter-crrt?section=crrt-prescription-dosing',
        )
        expect(dialog.getByText('Example without a navigation target')).toBeVisible()
        expect(dialog.getAllByRole('link')).toHaveLength(1)
        await userEvent.keyboard('{Escape}')
        expect(trigger).toHaveFocus()
      },
    )
  })

  it('has no ready section while nothing is ready', () => {
    render(<BetaHubSections locale="en" modules={betaModules} rollout={allPreview} />)
    expect(screen.queryByRole('heading', { name: 'Ready for review' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Still in development' })).toBeInTheDocument()
  })

  it('moves a ready module to the first section with its note and the same link', () => {
    const rollout: BetaRollout = {
      ...allPreview,
      devices: {
        stage: 'ready',
        note: {
          audience: 'Interventional pulmonology fellows',
          summary: 'A reference atlas of bronchoscopy devices.',
          estimate: { minutes: 20, basis: 'three search tasks' },
          lookFor: ['Whether a device is easy to find by type'],
          knownLimits: ['Market status is unverified for some products'],
        },
      },
    }
    render(<BetaHubSections locale="es" modules={betaModules} rollout={rollout} />)

    const ready = screen.getByRole('region', { name: 'Ready for review' })
    expect(within(ready).getByRole('heading', { name: /Device Atlas/ })).toBeInTheDocument()
    expect(within(ready).getByText(/about 20 minutes, from three search tasks/)).toBeVisible()
    expect(within(ready).getByText('A reference atlas of bronchoscopy devices.')).toBeVisible()
    expect(within(ready).getByText('Whether a device is easy to find by type')).toBeVisible()
    expect(within(ready).getByText('Market status is unverified for some products')).toBeVisible()
    // Marking a module ready changes where it is listed, not how it opens.
    expect(within(ready).getByRole('link', { name: /Test with feedback/ })).toHaveAttribute(
      'href',
      '/es/development-beta/devices',
    )
    expect(within(ready).getAllByRole('link')).toHaveLength(1)

    const preview = screen.getByRole('region', { name: 'Still in development' })
    expect(within(preview).queryByRole('heading', { name: /Device Atlas/ })).not.toBeInTheDocument()
    // Device Atlas was the only module in its group, so the group heading is not left empty.
    expect(within(preview).queryByRole('heading', { name: 'Devices' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Test with feedback/ })).toHaveLength(
      betaModules.length,
    )
  })
})
