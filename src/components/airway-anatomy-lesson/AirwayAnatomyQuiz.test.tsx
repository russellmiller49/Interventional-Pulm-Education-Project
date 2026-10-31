import { fireEvent, render, screen } from '@testing-library/react'

import { AirwayAnatomyQuiz } from './AirwayAnatomyQuiz'

describe('AirwayAnatomyQuiz', () => {
  it('teaches the RUL origin as a right-sided distinction', () => {
    render(<AirwayAnatomyQuiz />)

    expect(
      screen.getByText(/arises directly from the right main bronchus rather than/i),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'The right upper lobe' }))

    expect(
      screen.getByText(
        /only right lobar bronchus that comes directly off the right main bronchus/i,
      ),
    ).toHaveTextContent(/on the left, both lobar bronchi come off the left main bronchus/i)
  })
})
