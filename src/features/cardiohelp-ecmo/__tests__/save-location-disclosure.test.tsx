import { fireEvent, render, screen } from '@testing-library/react'

import { EcmoSectionHeader } from '../components/shell/EcmoSectionHeader'

jest.mock('@/i18n/navigation', () => ({ Link: 'a' }))

describe('ECMO location-only exit disclosure', () => {
  /*
   * Revised 2026-10-23. The note was also printed across the header of every section, drill and case,
   * and a tester marked it as a redundant banner. It stays the button's description (and tooltip),
   * and is no longer drawn on screen.
   */
  it('explains the resume boundary on the exit action itself, not as a line on screen', () => {
    const exit = jest.fn()
    const note =
      'Save & exit saves your location, not the current teaching or case state. Your existing progress history is retained. Reopening starts fresh; answers, snapshots, and simulator actions from this run are not restored.'
    render(<EcmoSectionHeader kicker="VV track" title="Learning section" onSaveAndExit={exit} />)
    const save = screen.getByRole('button', { name: 'Save & exit' })
    expect(save).toHaveAccessibleDescription(note)
    expect(save).toHaveAttribute('title', note)
    expect(screen.getByText(/^Save & exit saves your location,/)).toHaveClass('sr-only')
    fireEvent.click(save)
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('does not promise saving on a header without an exit action', () => {
    render(<EcmoSectionHeader kicker="VV track" title="Learning section" />)
    expect(screen.queryByText(/^Save & exit saves your location,/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save & exit' })).toBeNull()
  })
})
