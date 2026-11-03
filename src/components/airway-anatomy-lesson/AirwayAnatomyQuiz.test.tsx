import { fireEvent, render, screen, within } from '@testing-library/react'

import {
  HEAD_OF_BED_LOOKING_DOWN,
  patientRightSide,
} from '@/lib/airway-anatomy-lesson/view-orientation'

import { AirwayAnatomyQuiz } from './AirwayAnatomyQuiz'

describe('AirwayAnatomyQuiz', () => {
  it('keys the carina question on the side the scope shows the right main bronchus', () => {
    render(<AirwayAnatomyQuiz />)
    const answer = screen.getByRole('button', { name: 'The right' })
    const question = answer.closest('li')!
    expect(question).toHaveTextContent(/right main bronchus/)
    expect(patientRightSide(HEAD_OF_BED_LOOKING_DOWN)).toBe('right')

    fireEvent.click(answer)

    expect(within(question).getByText(/^Correct\./)).toBeInTheDocument()
    expect(question).toHaveTextContent(
      /patient's right is a quarter turn clockwise from anterior: with anterior at 12 o'clock it is at 3 o'clock/,
    )
  })

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
