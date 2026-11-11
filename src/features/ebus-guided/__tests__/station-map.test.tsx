import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import coreStations from '../../../../EBUS-course/content/stations/core-stations.json'
import media from '../../../../EBUS-course/apps/web/src/content/station-media.json'
import { CoursePage } from '../components/CoursePage'
import { LessonHost } from '../components/LessonHost'
import { StationMap } from '../components/StationMap'
import { contentById, lessonById } from '../content/curriculum'
import { activitiesForLesson } from '../content/stage'
import { MAP_STATIONS, SAMPLING_ORDER, mapStation, nCategory } from '../content/station-map'

/*
 * The course's nodal map (2026-11-10). It replaced an airway drawing with five unlabelled ovals.
 * Everything it says about a station is the owner's existing station record or the course's own
 * lesson text; these tests pin that, and the three ways the one drawing is read.
 */
jest.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
jest.mock('../components/StationFigure', () => ({
  StationFigure: ({ station }: { station: string }) => (
    <figure data-mock-station-figure={station} />
  ),
}))
jest.mock('../components/Workbench', () => ({ Workbench: () => <section data-mock-workbench /> }))
beforeEach(() => {
  localStorage.clear()
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(cleanup)

const node = (id: string) => document.querySelector(`[data-station="${id}"]`) as SVGGElement
const panel = () => document.querySelector('[data-station-panel]') as HTMLElement
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const primary = () => document.querySelector('[data-now-primary]') as HTMLButtonElement

describe('station data', () => {
  it('takes the ten scanned stations from the owner’s records and names four more', () => {
    expect(MAP_STATIONS.map((station) => station.id)).toEqual([
      ...coreStations.map((record) => record.id),
      '5',
      '6',
      '8',
      '9',
    ])
    for (const record of coreStations) {
      const station = mapStation(record.id)!
      expect(station.record).toBe(record)
      expect(station.name).toBe(record.iaslcName)
      expect(station.access).toBe(record.accessProfile === 'Both' ? 'both' : 'ebus')
      // Every scanned station can open its CT, airway and ultrasound views.
      expect(Object.keys(media)).toContain(record.id)
    }
    // No two stations are drawn on top of each other.
    for (const a of MAP_STATIONS)
      for (const b of MAP_STATIONS)
        if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(44)
  })

  it('gives each station the N category its own record states, for either primary side', () => {
    const right = Object.fromEntries(MAP_STATIONS.map((s) => [s.id, nCategory(s, 'right')]))
    expect(right).toEqual({
      '2R': 'N2',
      '4R': 'N2',
      '10R': 'N1',
      '11Rs': 'N1',
      '11Ri': 'N1',
      '7': 'N2',
      '2L': 'N3',
      '4L': 'N3',
      '10L': 'N3',
      '11L': 'N3',
      '5': 'N3',
      '6': 'N3',
      '8': 'N2 or N3',
      '9': 'N2 or N3',
    })
    for (const record of coreStations) {
      const station = mapStation(record.id)!
      if (record.laterality === 'Midline') {
        expect(nCategory(station, 'right')).toBe('N2')
        expect(nCategory(station, 'left')).toBe('N2')
        continue
      }
      const own = record.laterality.toLowerCase() as 'right' | 'left'
      const other = own === 'right' ? 'left' : 'right'
      expect(record.nStageImplication.ipsilateral).toContain('(' + nCategory(station, own) + ')')
      expect(record.nStageImplication.contralateral).toContain(
        '(' + nCategory(station, other) + ')',
      )
    }
    expect(SAMPLING_ORDER).toEqual(['N3', 'N2', 'N1'])
  })

  it('says of stations 5, 6, 8 and 9 only what the EUS-B lesson says', () => {
    const lesson = contentById('eus-b')!.paragraphs.join(' ')
    expect(lesson).toContain(
      'Stations 5 and 6 are not routine targets for standard EBUS-TBNA or EUS-B-FNA',
    )
    expect(lesson).toContain('lower mediastinal stations 8 and 9')
    for (const id of ['5', '6']) {
      expect(mapStation(id)!.access).toBe('neither')
      expect(mapStation(id)!.context).toMatch(
        /^Not a routine target for standard EBUS-TBNA or EUS-B-FNA\./,
      )
    }
    for (const id of ['8', '9']) {
      expect(mapStation(id)!.access).toBe('eus-b')
      expect(mapStation(id)!.context).toMatch(/lower mediastinal station/)
    }
  })
})

describe('the map', () => {
  it('shows a selected station’s borders, vessels and window from its record', () => {
    render(<StationMap />)
    expect(panel()).toHaveTextContent('No station selected')
    fireEvent.click(node('4R'))
    const record = coreStations.find((entry) => entry.id === '4R')!
    expect(panel()).toHaveAttribute('data-station-panel', '4R')
    expect(panel()).toHaveTextContent('Station 4R · Right lower paratracheal')
    expect(panel()).toHaveTextContent(record.boundaryDefinition.superior)
    expect(panel()).toHaveTextContent('Lower border of the azygos vein')
    expect(panel()).toHaveTextContent(record.landmarkVessels.join(', '))
    expect(panel()).toHaveTextContent(record.bestEbusWindow)
    // The station it is most often confused with is one press away.
    fireEvent.click(within(panel()).getByRole('button', { name: '10R' }))
    expect(panel()).toHaveAttribute('data-station-panel', '10R')
    // Its CT, airway and ultrasound views open from the map.
    expect(document.querySelector('[data-mock-station-figure]')).toBeNull()
    fireEvent.click(document.querySelector('[data-station-views-toggle]')!)
    expect(document.querySelector('[data-mock-station-figure="10R"]')).toBeInTheDocument()
    // A named station that is not scanned shows the course’s statement and no views.
    press('5')
    expect(panel()).toHaveTextContent('Subaortic (aortopulmonary window)')
    expect(panel().querySelector('[data-station-context]')).toHaveTextContent(
      'Not a routine target',
    )
    expect(document.querySelector('[data-station-views-toggle]')).toBeNull()
  })

  it('works from the keyboard: a station is a button', () => {
    render(<StationMap />)
    expect(node('7')).toHaveAttribute('role', 'button')
    expect(node('7')).toHaveAttribute('tabindex', '0')
    fireEvent.keyDown(node('7'), { key: 'Enter' })
    expect(node('7')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(node('7'), { key: ' ' })
    expect(node('7')).toHaveAttribute('aria-pressed', 'false')
  })

  it('reads as N categories for either primary side, with the staging lesson’s order', () => {
    render(<StationMap view="n-category" />)
    expect(node('4R')).toHaveAttribute('data-n', 'N2')
    expect(node('4L')).toHaveAttribute('data-n', 'N3')
    press('Left lung')
    expect(node('4R')).toHaveAttribute('data-n', 'N3')
    expect(node('4L')).toHaveAttribute('data-n', 'N2')
    expect(node('11L')).toHaveAttribute('data-n', 'N1')
    // The order is hidden until asked for, then numbers each station by its category.
    expect(document.querySelector('[data-sampling-order]')).toBeNull()
    press('Show the sampling order')
    expect(document.querySelector('[data-sampling-order]')).toHaveTextContent(
      'For a left lung primary, sample in the numbered order: N3 stations first, then N2, then N1',
    )
    expect(node('4R').querySelector('[data-order]')).toHaveAttribute('data-order', '1')
    expect(node('7').querySelector('[data-order]')).toHaveAttribute('data-order', '2')
    expect(node('11L').querySelector('[data-order]')).toHaveAttribute('data-order', '3')
    // A station whose side depends on the node carries no number.
    expect(node('8').querySelector('[data-order]')).toBeNull()
    // The order's wording is the staging lesson's.
    expect(contentById('systematic-staging')!.paragraphs.join(' ')).toContain(
      'A usual staging sampling order is N3 → N2 → N1',
    )
  })

  it('reads as access, and never by colour alone', () => {
    render(<StationMap view="access" station="7" />)
    expect(node('7')).toHaveAttribute('data-access', 'both')
    expect(node('10R')).toHaveAttribute('data-access', 'ebus')
    expect(node('8')).toHaveAttribute('data-access', 'eus-b')
    expect(node('5')).toHaveAttribute('data-access', 'neither')
    const legend = document.querySelector('[data-station-map-legend]')!
    for (const label of ['EBUS', 'EBUS or EUS-B', 'EUS-B', 'Neither route'])
      expect(legend).toHaveTextContent(label)
    // The selected station says its access and category in words.
    expect(panel().querySelector('[data-fact="access"]')).toHaveTextContent('EBUS or EUS-B')
    expect(panel().querySelector('[data-fact="n"]')).toHaveTextContent(
      'N2 for a right lung primary',
    )
  })

  it('is drawn like a coronal CT and can be mirrored, saying which it is', () => {
    render(<StationMap />)
    const svg = document.querySelector('[data-station-map] svg')!
    const cx = (id: string) => Number(node(id).querySelector('ellipse')!.getAttribute('cx'))
    const marker = (side: string) =>
      Number(document.querySelector(`[data-side-marker="${side}"]`)!.getAttribute('x'))
    expect(svg).toHaveAttribute('data-orientation', 'coronal-ct')
    expect(document.querySelector('[data-station-map-caption]')).toHaveTextContent(
      'Drawn like a coronal CT: the patient’s right is on the left.',
    )
    expect(cx('4R')).toBeLessThan(cx('4L'))
    expect(marker('right')).toBeLessThan(marker('left'))
    press('Put the patient’s right on the right')
    expect(svg).toHaveAttribute('data-orientation', 'from-head')
    expect(document.querySelector('[data-station-map-caption]')).toHaveTextContent(
      'Mirrored so the patient’s right is on the right',
    )
    expect(cx('4R')).toBeGreaterThan(cx('4L'))
    expect(marker('right')).toBeGreaterThan(marker('left'))
  })
})

describe('where the map is used', () => {
  it('opens each lesson’s map on the view that lesson teaches', () => {
    const figures = (id: string) =>
      activitiesForLesson(lessonById(id)!)
        .filter((activity) => activity.kind === 'briefing')
        .map((activity) => activity.figure ?? contentById(activity.lessonId)!.diagram)
    expect(figures('ct-map')).toEqual(['station-map'])
    expect(figures('systematic-staging')).toEqual(['station-map-n'])
    expect(figures('eus-b')).toEqual(['station-map-access', 'station-map-access'])
    render(<LessonHost lesson={lessonById('ct-map')!} />)
    expect(document.querySelector('[data-station-map]')).toBeNull()
    fireEvent.click(primary())
    expect(document.querySelector('[data-station-map]')).toHaveAttribute('data-view', 'stations')
    expect(panel()).toHaveAttribute('data-station-panel', '7')
    cleanup()
    render(<LessonHost lesson={lessonById('systematic-staging')!} />)
    // The prediction asks for an N category; the map is not on that screen.
    expect(document.querySelector('[data-station-map]')).toBeNull()
    fireEvent.click(primary())
    expect(document.querySelector('[data-station-map]')).toHaveAttribute('data-view', 'n-category')
  })

  it('is one press away in every lesson, opening on stations, not N categories', () => {
    render(<LessonHost lesson={lessonById('needle-safety')!} />)
    expect(document.querySelector('[data-station-map-dialog]')).toBeNull()
    press('Station map')
    const dialog = document.querySelector('[data-station-map-dialog]') as HTMLElement
    // The dialog carries the title once; the map does not repeat it.
    expect(screen.getAllByRole('heading', { name: 'Nodal station map' })).toHaveLength(1)
    expect(within(dialog).queryByRole('heading', { name: 'Nodal station map' })).toBeNull()
    expect(dialog.querySelector('[data-station-map]')).toHaveAttribute('data-view', 'stations')
  })

  it('opens from the hub without putting a diagram on the Overview', () => {
    const { container } = render(<CoursePage />)
    expect(container.querySelector('[data-station-map]')).toBeNull()
    press('Station map')
    expect(container.querySelector('[data-station-map-dialog] [data-station-map]')).not.toBeNull()
  })
})
