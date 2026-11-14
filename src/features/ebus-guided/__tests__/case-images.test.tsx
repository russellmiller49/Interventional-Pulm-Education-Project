import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import media from '../../../../EBUS-course/apps/web/src/content/station-media.json'
import { FINAL_CASES, PRACTICE_CASES } from '../content/cases'
import { CasePlayer } from '../components/CasePlayer'

jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/ebus-guided/assess',
}))
// The station a case shows is deliberately absent from the page, so the tests read it here.
jest.mock('../components/DecisionImage', () => ({
  DecisionImage: ({ station }: { station: string }) => (
    <figure data-mock-case-images={station}>Reference CT and ultrasound</figure>
  ),
}))
jest.mock('../components/StationFigure', () => ({
  ...jest.requireActual('../components/StationFigure'),
  StationFigure: ({ station }: { station: string }) => <figure data-mock-station={station} />,
}))

beforeEach(() => localStorage.clear())
afterEach(cleanup)

/*
 * Integrated cases read beside images (2026-11-11). A case about a station shows that station's
 * CT and ultrasound from the teaching library, unnamed until the debrief; the case about the
 * needle tip shows the needle lab's picture. Three cases are decisions with nothing to read off
 * an image, and stay as text.
 */
const caseById = (id: string) => FINAL_CASES.find((entry) => entry.id === id)!
const shown = (id: string) =>
  caseById(id).questions.map((question) =>
    question.imageStation
      ? 'station ' + question.imageStation
      : question.imageFigure
        ? question.imageFigure.kind
        : '',
  )
const open = (id: string) =>
  render(<CasePlayer item={caseById(id)} kind="integrated" onExit={jest.fn()} />)
const next = () =>
  fireEvent.click(screen.getByRole('button', { name: /Continue without answering|Next check/ }))
const stationOnScreen = () =>
  document.querySelector('[data-mock-case-images]')?.getAttribute('data-mock-case-images') ?? null

describe('which cases have images', () => {
  it('gives five of the eight integrated cases an image, and says which', () => {
    expect(FINAL_CASES.map((entry) => [entry.id, shown(entry.id).filter(Boolean)])).toEqual([
      ['assessment-planning', []],
      ['assessment-image', ['station 4L']],
      ['assessment-map', ['station 4R', 'station 11L']],
      ['assessment-access', []],
      ['assessment-distribution', ['station 7']],
      ['assessment-sampling', ['needle']],
      ['assessment-differential', ['station 4R']],
      ['assessment-followup', []],
    ])
  })

  it('uses only stations the library has both a CT and an ultrasound still for', () => {
    for (const entry of [...FINAL_CASES, ...PRACTICE_CASES])
      for (const question of entry.questions)
        if (question.imageStation) {
          const station = media[question.imageStation as keyof typeof media]
          expect(station.ctVariants.length).toBeGreaterThan(0)
          expect(station.ebusVariants.length).toBeGreaterThan(0)
        }
  })

  it('shows the station the stem is about, where a case asks about two', () => {
    const map = caseById('assessment-map')
    expect(map.questions[0].prompt).toMatch(/right paratracheal/)
    expect(map.questions[0].imageStation).toBe('4R')
    expect(map.questions[1].prompt).toMatch(/left lobar bronchi/)
    expect(map.questions[1].imageStation).toBe('11L')
    // The left station is one the course's own map and library know by that name.
    expect(Object.keys(media)).toContain('11L')
  })
})

describe('a case read beside its images', () => {
  it('keeps the images up across the checks, changing only where a check names another station', () => {
    open('assessment-map')
    expect(stationOnScreen()).toBe('4R')
    next()
    expect(stationOnScreen()).toBe('11L')
    next()
    // The third check returns to "the described right paratracheal target".
    expect(stationOnScreen()).toBe('4R')
  })

  it('opens the labelled views in the debrief, once per station asked about', () => {
    open('assessment-map')
    next()
    next()
    fireEvent.click(screen.getByRole('button', { name: /Open debrief/ }))
    expect(
      [...document.querySelectorAll('[data-case-debrief] [data-mock-station]')].map((figure) =>
        figure.getAttribute('data-mock-station'),
      ),
    ).toEqual(['4R', '11L'])
  })

  it('shows no image where the case has none', () => {
    open('assessment-planning')
    expect(stationOnScreen()).toBeNull()
    expect(document.querySelector('[data-case-figure]')).toBeNull()
  })
})

describe('the case about the needle tip', () => {
  const picture = () =>
    decodeURIComponent(document.querySelector('[data-case-figure] img')!.getAttribute('src')!)

  it('shows the needle picture with the scope turned, and does not say where the tip is', () => {
    open('assessment-sampling')
    expect(document.querySelector('[data-review-image]')).toHaveAttribute(
      'data-review-image',
      'needle',
    )
    expect(picture()).not.toContain('out of the image')
    expect(screen.getByText('What this picture shows is named after you answer.')).toBeVisible()
  })

  it('marks the true tip once the first check is answered, and keeps the picture for the rest', () => {
    open('assessment-sampling')
    fireEvent.click(screen.getByLabelText('Stop movement and restore tip visualization'))
    fireEvent.click(screen.getByRole('button', { name: 'Check response' }))
    expect(picture()).toContain('tip, out of the image')
    expect(screen.queryByText('What this picture shows is named after you answer.')).toBeNull()
    next()
    expect(picture()).toContain('tip, out of the image')
  })

  it('marks the true tip when the explanation is opened instead', () => {
    open('assessment-sampling')
    fireEvent.click(screen.getByRole('button', { name: 'Show explanation' }))
    expect(picture()).toContain('tip, out of the image')
  })
})

describe('the reference images themselves', () => {
  const { DecisionImage } = jest.requireActual('../components/DecisionImage')

  it('are a CT beside an ultrasound still, with nothing in the page that names the station', () => {
    render(<DecisionImage station="4R" />)
    const figure = document.querySelector('[data-case-images]')!
    expect(
      [...figure.querySelectorAll('[data-case-picture]')].map((picture) =>
        picture.getAttribute('data-case-picture'),
      ),
    ).toEqual(['CT', 'Ultrasound'])
    expect(figure.innerHTML).not.toMatch(/stations\/|4R/)
    expect(figure).toHaveTextContent('not this patient’s own images')
    expect(figure).toHaveTextContent('Station labels and outlines open in the debrief')
  })
})
