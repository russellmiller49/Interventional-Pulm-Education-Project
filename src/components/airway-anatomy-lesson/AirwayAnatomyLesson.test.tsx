import { fireEvent, render, screen } from '@testing-library/react'

import { AirwayAnatomyLesson } from './AirwayAnatomyLesson'

// The overview is text; the media panels load video, CT and WebGL that jsdom cannot run.
jest.mock('./AirwayVideoAtlas', () => ({ AirwayVideoAtlas: () => null }))
jest.mock('./Airway3DModel', () => ({ Airway3DModel: () => null }))
jest.mock('./AirwaySurvey', () => ({ AirwaySurvey: () => null }))
jest.mock('./AirwayIdentifyQuiz', () => ({ AirwayIdentifyQuiz: () => null }))
jest.mock('./AirwayStructureMediaPanel', () => ({ AirwayStructureMediaPanel: () => null }))
jest.mock('./CtCorrelationView', () => ({ CtCorrelationView: () => null }))

describe('AirwayAnatomyLesson overview', () => {
  it('teaches the right main bronchus on the right of the scope image from the head of the bed', () => {
    render(<AirwayAnatomyLesson />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: /overview/i }), { button: 0 })

    const section = screen.getByRole('heading', {
      name: /staying oriented in the scope image/i,
    }).parentElement!
    expect(section).toHaveTextContent(/patient's right is a quarter turn clockwise from anterior/)
    expect(section).toHaveTextContent(
      /With anterior at 12 o'clock the right main bronchus opens on the right of the image/,
    )
    expect(section).not.toHaveTextContent(/patient's right is toward the left/i)
    expect(section).not.toHaveTextContent(/opens to your left/i)
  })
})
