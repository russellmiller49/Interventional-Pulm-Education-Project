import { fireEvent, render, screen } from '@testing-library/react'

import { EcmoSectionHeader } from '../components/shell/EcmoSectionHeader'

jest.mock('@/i18n/navigation', () => ({ Link: 'a' }))

describe('ECMO location-only exit disclosure', () => {
  it('explains the resume boundary before exit and keeps the existing exit action', () => {
    const exit = jest.fn()
    render(<EcmoSectionHeader kicker="VV track" title="Learning section" onSaveAndExit={exit} />)
    const save = screen.getByRole('button', { name: 'Save & exit' })
    expect(save).toHaveAccessibleDescription(
      'Save & exit saves your location, not the current teaching or case state. Your existing progress history is retained. Reopening starts fresh; answers, snapshots, and simulator actions from this run are not restored.',
    )
    expect(screen.getByText(/^Save & exit saves your location,/)).toBeVisible()
    fireEvent.click(save)
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('does not promise saving on a header without an exit action', () => {
    render(<EcmoSectionHeader kicker="VV track" title="Learning section" />)
    expect(screen.queryByText(/^Save & exit saves your location,/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save & exit' })).toBeNull()
  })
})
