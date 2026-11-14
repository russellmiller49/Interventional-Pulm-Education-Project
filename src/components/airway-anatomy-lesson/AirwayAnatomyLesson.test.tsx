import { fireEvent, render, screen } from '@testing-library/react'

import { AirwayAnatomyLesson } from './AirwayAnatomyLesson'

// The overview is text; the media panels load video, CT and WebGL that jsdom cannot run.
jest.mock('./AirwayVideoAtlas', () => ({ AirwayVideoAtlas: () => null }))
jest.mock('./Airway3DModel', () => ({ Airway3DModel: () => null }))
// The survey stands in as one of its "open in the explorer" links.
jest.mock('./AirwaySurvey', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react')
  return {
    AirwaySurvey: ({ onOpenStructure }: { onOpenStructure: (id: string) => void }) =>
      createElement(
        'button',
        { type: 'button', onClick: () => onOpenStructure('rb6') },
        'Open RB6 in the explorer',
      ),
  }
})
jest.mock('./AirwayIdentifyQuiz', () => ({ AirwayIdentifyQuiz: () => null }))
jest.mock('./AirwayStructureMediaPanel', () => ({ AirwayStructureMediaPanel: () => null }))
jest.mock('./CtCorrelationView', () => ({ CtCorrelationView: () => null }))

const lessonPath = '/en/development-beta/live-anatomy/lesson'
const tabs = [
  ['video', /real bronchoscopy/i],
  ['overview', /overview/i],
  ['survey', /guided survey/i],
  ['explore', /explore the tree/i],
  ['assess', /test yourself/i],
] as const

const tabParam = () => new URLSearchParams(window.location.search).get('tab')
const tab = (name: RegExp) => screen.getByRole('tab', { name })
const selectTab = (name: RegExp) => fireEvent.mouseDown(tab(name), { button: 0 })
function openAt(search: string) {
  window.history.replaceState(null, '', `${lessonPath}${search}`)
  return render(<AirwayAnatomyLesson />)
}

beforeEach(() => {
  window.history.replaceState(null, '', lessonPath)
})

describe('AirwayAnatomyLesson overview', () => {
  it('teaches the right main bronchus on the right of the scope image from the head of the bed', () => {
    render(<AirwayAnatomyLesson />)
    selectTab(/overview/i)

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

describe('AirwayAnatomyLesson tab in the URL', () => {
  it('records a tab click in ?tab= without adding a Back entry', () => {
    openAt('')
    expect(tab(/real bronchoscopy/i)).toHaveAttribute('aria-selected', 'true')
    expect(tabParam()).toBe('video')
    const entries = window.history.length

    selectTab(/guided survey/i)
    expect(tab(/guided survey/i)).toHaveAttribute('aria-selected', 'true')
    expect(tabParam()).toBe('survey')

    selectTab(/test yourself/i)
    expect(tabParam()).toBe('assess')
    expect(window.location.pathname).toBe(lessonPath)
    expect(window.history.length).toBe(entries)
  })

  it.each(tabs)('opens a deep link to ?tab=%s on that tab', (key, name) => {
    openAt(`?tab=${key}`)
    expect(tab(name)).toHaveAttribute('aria-selected', 'true')
    for (const [other, otherName] of tabs)
      if (other !== key) expect(tab(otherName)).toHaveAttribute('aria-selected', 'false')
    expect(tabParam()).toBe(key)
  })

  it.each(['bogus', '', 'SURVEY', 'survey.'])(
    'falls back to the video tab for ?tab=%s and records the tab shown',
    (value) => {
      openAt(`?tab=${encodeURIComponent(value)}`)
      expect(tab(/real bronchoscopy/i)).toHaveAttribute('aria-selected', 'true')
      expect(tabParam()).toBe('video')
    },
  )

  it('keeps the rest of the address when it writes the tab', () => {
    openAt('?tab=overview&from=hub#asymmetry')
    selectTab(/explore the tree/i)
    expect(window.location.pathname).toBe(lessonPath)
    expect(window.location.search).toBe('?tab=explore&from=hub')
    expect(window.location.hash).toBe('#asymmetry')
  })

  it('moves the URL with the overview links and with open-in-explorer', () => {
    openAt('?tab=overview')
    fireEvent.click(screen.getByRole('button', { name: 'the guided survey' }))
    expect(tab(/guided survey/i)).toHaveAttribute('aria-selected', 'true')
    expect(tabParam()).toBe('survey')

    fireEvent.click(screen.getByRole('button', { name: 'Open RB6 in the explorer' }))
    expect(tab(/explore the tree/i)).toHaveAttribute('aria-selected', 'true')
    expect(tabParam()).toBe('explore')

    selectTab(/overview/i)
    expect(tabParam()).toBe('overview')
    fireEvent.click(screen.getByRole('button', { name: 'explore the 3D model' }))
    expect(tab(/explore the tree/i)).toHaveAttribute('aria-selected', 'true')
    expect(tabParam()).toBe('explore')
  })
})
