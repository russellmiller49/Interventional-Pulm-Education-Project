import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import media from '../../../../EBUS-course/apps/web/src/content/station-media.json'
import {
  STATION_IDS,
  StationFigure,
  stillAnnotation,
  stillRegionName,
} from '../components/StationFigure'

/*
 * Outlines on the station ultrasound stills (2026-11-11). The owner's node and vessel outlines
 * were already in the teaching library; this course showed marked CT and airway images but an
 * unmarked ultrasound still. The still now has the same kind of toggle, with each outline
 * numbered on the image and named in a list below it.
 */
jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))
afterEach(cleanup)

const toggle = () => document.querySelector('[data-still-outline-toggle]') as HTMLButtonElement
const openUltrasound = (station: string) => {
  render(<StationFigure station={station} />)
  fireEvent.click(screen.getByRole('button', { name: 'Ultrasound' }))
}
/** Each legend line: the number that is on the image, then the name. */
const lines = () =>
  [...document.querySelectorAll('[data-still-legend] li')].map((li) => li.textContent)
const names = () => lines().map((line, index) => line!.replace(String(index + 1), ''))

it('has outlines for every station’s ultrasound still, inside the still', () => {
  for (const station of STATION_IDS) {
    for (const variant of media[station].ebusVariants) {
      const outlines = stillAnnotation(variant.annotationKey)!
      expect(outlines.regions.length).toBeGreaterThanOrEqual(2)
      // Every still has at least its own node outlined.
      expect(outlines.regions.some((region) => region.label === 'Station ' + station)).toBe(true)
      for (const region of outlines.regions) {
        expect(region.points.length).toBeGreaterThanOrEqual(3)
        for (const [x, y] of region.points) {
          expect(x).toBeGreaterThanOrEqual(0)
          expect(y).toBeGreaterThanOrEqual(0)
          expect(x).toBeLessThanOrEqual(outlines.width)
          expect(y).toBeLessThanOrEqual(outlines.height)
        }
      }
    }
  }
})

it('shows nothing until asked, then one numbered outline per region and its name below', () => {
  openUltrasound('4L')
  expect(document.querySelector('[data-still-outlines]')).toBeNull()
  expect(document.querySelector('[data-still-legend]')).toBeNull()
  expect(toggle()).toHaveTextContent('Show outlines')
  fireEvent.click(toggle())
  expect(toggle()).toHaveTextContent('Hide outlines')
  const overlay = document.querySelector('[data-still-outlines="4L"]')!
  expect(overlay.querySelectorAll('polygon')).toHaveLength(4)
  expect([...overlay.querySelectorAll('text')].map((text) => text.textContent)).toEqual([
    '1',
    '2',
    '3',
    '4',
  ])
  // Two outlines with the station's label are two distinct nodes in that station.
  expect(names()).toEqual(['Station 4L node', 'Station 4L node', 'Aorta', 'Pulmonary artery'])
  // The list carries the same numbers as the image.
  expect(lines()).toEqual(['1Station 4L node', '2Station 4L node', '3Aorta', '4Pulmonary artery'])
  expect(overlay.querySelectorAll('[data-still-region="node"]')).toHaveLength(2)
  expect(overlay.querySelectorAll('[data-still-region="vessel"]')).toHaveLength(2)
  fireEvent.click(toggle())
  expect(document.querySelector('[data-still-outlines]')).toBeNull()
})

it('names structures as the course spells them, and keeps the lung on 11L', () => {
  expect(stillRegionName('Azygous Vein')).toBe('Azygos vein')
  expect(stillRegionName('Superior Vena Cava')).toBe('Superior vena cava')
  expect(stillRegionName('Station 11Ri')).toBe('Station 11Ri node')
  openUltrasound('10R')
  fireEvent.click(toggle())
  expect(names()).toEqual(['Station 10R node', 'Station 10R node', 'Azygos vein'])
  cleanup()
  openUltrasound('11L')
  fireEvent.click(toggle())
  expect(names()).toEqual(['Station 11L node', 'Lung', 'Pulmonary artery'])
  expect(document.querySelector('[data-still-region="lung"]')).not.toBeNull()
})

it('leaves the CT and airway images on their own marked versions, and clears on a change of view', () => {
  render(<StationFigure station="7" allowSelect />)
  // CT: the existing marked image, no drawn outlines.
  expect(toggle()).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Show annotations' }))
  expect(document.querySelector('[data-still-outlines]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Ultrasound' }))
  // Changing the view hides whatever was shown.
  expect(document.querySelector('[data-still-outlines]')).toBeNull()
  fireEvent.click(toggle())
  expect(document.querySelector('[data-still-outlines="7"]')).not.toBeNull()
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '2R' } })
  expect(document.querySelector('[data-still-outlines]')).toBeNull()
})
