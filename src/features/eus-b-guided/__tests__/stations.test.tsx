import { cleanup, fireEvent, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { CoursePage } from '../components/CoursePage'
import { STATIONS } from '../content/stations'
import { setLessonReviewed } from '../engine/progress'

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
jest.mock('../components/ModuleFrame', () => ({
  EusbModuleFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

const openRows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-station-row][data-open="true"]')).map((row) =>
    row.getAttribute('data-station-row'),
  )

describe('the station table on the course page', () => {
  it('lists every station and fills none in before its lesson has been reviewed', () => {
    const { container } = render(<CoursePage />)
    const section = container.querySelector('[data-course-stations]')!
    expect(section.querySelectorAll('[data-station-row]')).toHaveLength(STATIONS.length)
    expect(openRows(container)).toEqual([])
    for (const station of STATIONS)
      for (const landmark of station.landmarks)
        expect(section).not.toHaveTextContent(landmark.where)
  })

  it('fills in the stations of a lesson the learner has reached the end of', () => {
    setLessonReviewed('station-8')
    const { container } = render(<CoursePage mode="Learn" />)
    expect(openRows(container)).toEqual(['station-8'])
  })

  it('shows every station when the learner asks for it, and hides them again', () => {
    const { container } = render(<CoursePage />)
    const all = container.querySelector<HTMLButtonElement>('[data-show-every-station]')!
    expect(all).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(all)
    expect(all).toHaveAttribute('aria-pressed', 'true')
    expect(openRows(container)).toEqual(STATIONS.map((station) => station.id))
    fireEvent.click(all)
    expect(openRows(container)).toEqual([])
  })
})
