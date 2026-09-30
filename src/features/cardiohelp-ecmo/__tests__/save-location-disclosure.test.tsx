import { fireEvent, render, screen } from '@testing-library/react'

import { EcmoSectionHeader } from '../components/shell/EcmoSectionHeader'

jest.mock('@/i18n/navigation', () => ({ Link: 'a' }))

describe('ECMO location-only exit disclosure', () => {
  it('explains the resume boundary before exit and keeps the existing exit action', () => {
    const exit = jest.fn()
    render(<EcmoSectionHeader kicker="VV track" title="Learning section" onSaveAndExit={exit} />)
    const save = screen.getByRole('button', { name: 'Save & exit' })
    expect(save).toHaveAccessibleDescription(
      'Only your location is saved. Reopening starts a fresh teaching or case state; answers, snapshots and simulator actions are not restored.',
    )
    expect(screen.getByText(/^Only your location is saved\./)).toBeVisible()
    fireEvent.click(save)
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('does not promise saving on a header without an exit action', () => {
    render(<EcmoSectionHeader kicker="VV track" title="Learning section" />)
    expect(screen.queryByText(/^Only your location is saved\./)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save & exit' })).toBeNull()
  })
})
