import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import mpr from '../../../../public/branch-tracing/mpr-v1/manifest.json'
import {
  REFERENCE_PLANES,
  ReferenceCtView,
  referenceIndexFor,
  referencePick,
  referencePlaneUrl,
  referencePoint,
  type ReferencePlane,
} from '../components/ReferenceCtView'

const ASPECT = mpr.spacingXyzMm[2] / mpr.spacingXyzMm[0]
const [K0, K1] = mpr.crop.k
const HEIGHT = (K1 - K0 + 1) * ASPECT
const width = (plane: ReferencePlane) =>
  REFERENCE_PLANES[plane].columns[1] - REFERENCE_PLANES[plane].columns[0] + 1
// r-apical-anterior: lesion centre at voxel (192, 282) on slice 444.
const LESION = { slice: 444, pixel: [191.5611, 282.436] as const }

function Host({
  plane,
  start,
  focus,
  onIndexChange,
  onPick,
}: {
  plane: ReferencePlane
  start: number
  focus?: { slice: number; pixel: readonly [number, number] }
  onIndexChange?: (index: number) => void
  onPick?: (pick: { slice: number; pixel: [number, number] }) => void
}) {
  const [index, setIndex] = useState(start)
  return (
    <ReferenceCtView
      plane={plane}
      index={index}
      onIndexChange={(next) => {
        onIndexChange?.(next)
        setIndex(next)
      }}
      axialSlice={430}
      focus={focus}
      focusLabel="scope tip"
      target={{ id: 'r-apical-anterior' }}
      onPick={onPick}
    />
  )
}
const edges = (container: HTMLElement) =>
  Object.fromEntries(
    [...container.querySelectorAll('[data-ref-edge]')].map((el) => [
      el.getAttribute('data-ref-edge'),
      el.textContent,
    ]),
  )
/** Lay the picture out at `scale` screen pixels per picture unit, letterboxed by `pad` each side. */
function layout(container: HTMLElement, plane: ReferencePlane, scale: number, pad = [0, 0]) {
  const svg = container.querySelector('[data-ref-image] svg') as SVGSVGElement
  const rect = {
    left: 100,
    top: 50,
    width: width(plane) * scale + 2 * pad[0],
    height: HEIGHT * scale + 2 * pad[1],
  }
  svg.getBoundingClientRect = () =>
    ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
    }) as DOMRect
  return {
    svg,
    at: ([x, y]: [number, number]) => ({
      clientX: rect.left + pad[0] + x * scale,
      clientY: rect.top + pad[1] + y * scale,
    }),
  }
}
/** jsdom has no PointerEvent; a MouseEvent of that type carries the coordinates React reads. */
const press = (element: Element, at: { clientX: number; clientY: number }) =>
  fireEvent(element, new MouseEvent('pointerdown', { bubbles: true, ...at }))

test('edge letters: coronal S/I with R screen-left, sagittal S/I with A screen-left', () => {
  const coronal = render(<Host plane="coronal" start={282} />)
  expect(coronal.container.querySelector('[data-ref-view]')?.getAttribute('data-ref-plane')).toBe(
    'coronal',
  )
  expect(edges(coronal.container)).toEqual({ top: 'S', right: 'L', bottom: 'I', left: 'R' })
  coronal.unmount()
  const sagittal = render(<Host plane="sagittal" start={192} />)
  expect(edges(sagittal.container)).toEqual({ top: 'S', right: 'P', bottom: 'I', left: 'A' })
})

test('a click reports the voxel under it as an axial slice and pixel', () => {
  const onPick = jest.fn()
  const { container } = render(<Host plane="coronal" start={282} onPick={onPick} />)
  // Letterboxed horizontally: the picture is centred in a wider box.
  const { svg, at } = layout(container, 'coronal', 2, [40, 0])
  press(svg, at(referencePoint('coronal', 444, [192, 282])))
  expect(onPick).toHaveBeenCalledTimes(1)
  const pick = onPick.mock.calls[0][0]
  expect(pick.slice).toBe(444)
  expect(pick.pixel[0]).toBeCloseTo(192, 6)
  expect(pick.pixel[1]).toBe(282)
  // A click in the letterbox, off the picture, reports nothing.
  press(svg, { clientX: 105, clientY: 60 })
  expect(onPick).toHaveBeenCalledTimes(1)
})

test('on a sagittal plane the click column is j and the plane is i', () => {
  const onPick = jest.fn()
  const { container } = render(<Host plane="sagittal" start={192} onPick={onPick} />)
  const { svg, at } = layout(container, 'sagittal', 1.5, [0, 12])
  press(svg, at(referencePoint('sagittal', 300, [192, 250.25])))
  const pick = onPick.mock.calls[0][0]
  expect(pick.slice).toBe(300)
  expect(pick.pixel[0]).toBe(192)
  expect(pick.pixel[1]).toBeCloseTo(250.25, 6)
})

test('picture units and native voxels round-trip', () => {
  for (const plane of ['coronal', 'sagittal'] as const) {
    const index = referenceIndexFor(plane, [200, 300])
    expect(index).toBe(plane === 'coronal' ? 300 : 200)
    const pick = referencePick(plane, index, referencePoint(plane, 401, [200.5, 300.5]))
    expect(pick.slice).toBe(401)
    expect(pick.pixel[0]).toBeCloseTo(plane === 'coronal' ? 200.5 : 200, 6)
    expect(pick.pixel[1]).toBeCloseTo(plane === 'coronal' ? 300 : 300.5, 6)
  }
  // Points outside the shipped planes clamp to the nearest plane.
  expect(referenceIndexFor('coronal', [0, 0])).toBe(REFERENCE_PLANES.coronal.range[0])
  expect(referenceIndexFor('sagittal', [9999, 0])).toBe(REFERENCE_PLANES.sagittal.range[1])
})

test('Follow tracks the focus until the learner moves the plane, then snaps back when turned on', () => {
  const onIndexChange = jest.fn()
  const view = render(
    <Host plane="coronal" start={200} focus={LESION} onIndexChange={onIndexChange} />,
  )
  expect(onIndexChange).toHaveBeenLastCalledWith(282)
  const follow = screen.getByRole('button', { name: 'Follow the scope tip' })
  expect(follow).toHaveAttribute('aria-pressed', 'true')
  const slider = screen.getByRole('slider', { name: 'Coronal plane' })
  expect(slider).toHaveValue('282')

  // The learner moves the plane: Follow turns off and a moving focus no longer drags it.
  fireEvent.change(slider, { target: { value: '300' } })
  expect(onIndexChange).toHaveBeenLastCalledWith(300)
  expect(follow).toHaveAttribute('aria-pressed', 'false')
  view.rerender(
    <Host
      plane="coronal"
      start={200}
      focus={{ slice: 440, pixel: [190, 270] }}
      onIndexChange={onIndexChange}
    />,
  )
  expect(onIndexChange).toHaveBeenLastCalledWith(300)

  // Turning Follow back on goes to the focus.
  fireEvent.click(follow)
  expect(follow).toHaveAttribute('aria-pressed', 'true')
  expect(onIndexChange).toHaveBeenLastCalledWith(270)
  expect(slider).toHaveValue('270')

  // Step buttons are named for the direction they move.
  fireEvent.click(screen.getByRole('button', { name: 'One plane toward the back' }))
  expect(onIndexChange).toHaveBeenLastCalledWith(271)
  expect(follow).toHaveAttribute('aria-pressed', 'false')
})

test('without a focus, Follow is disabled and the index stays where the bench put it', () => {
  const onIndexChange = jest.fn()
  render(<Host plane="sagittal" start={150} onIndexChange={onIndexChange} />)
  expect(screen.getByRole('button', { name: 'Follow the scope tip' })).toBeDisabled()
  expect(onIndexChange).not.toHaveBeenCalled()
  expect(screen.getByRole('slider', { name: 'Sagittal plane' })).toHaveValue('150')
  expect(screen.getByRole('button', { name: "One plane toward the patient's left" })).toBeEnabled()
})

test('the axial line, the focus marker, the plane and the lesion patch are drawn where they belong', () => {
  const { container } = render(<Host plane="coronal" start={282} focus={LESION} />)
  const line = container.querySelector('[data-ref-axial-line] line')!
  expect(Number(line.getAttribute('y1'))).toBeCloseTo((K1 - 430 + 0.5) * ASPECT, 6)
  expect(container.querySelector('[data-ref-focus]')?.getAttribute('data-ref-focus')).toBe(
    'on-plane',
  )
  // Nothing is shown until the requested plane has decoded; then it replaces the blank in one step.
  const image = container.querySelector('[data-ref-image]')!
  expect(image.getAttribute('data-ref-ready')).toBe('false')
  const hidden = [
    ...container.querySelectorAll('image[visibility="hidden"], [visibility="hidden"] image'),
  ]
  expect(hidden.map((el) => el.getAttribute('href'))).toEqual([
    referencePlaneUrl('coronal', 282),
    '/branch-tracing/mpr-v1/patches/r-apical-anterior/coronal.png',
  ])
  act(() => hidden.forEach((el) => fireEvent.load(el)))
  expect(image.getAttribute('data-ref-ready')).toBe('true')
  expect(image.getAttribute('data-ref-index')).toBe('282')
  const patch = container.querySelector('[data-ref-lesion="r-apical-anterior"]')!
  const entry = mpr.patches.find((p) => p.id === 'r-apical-anterior')!
  expect(patch.getAttribute('viewBox')).toBe(
    `0 ${(282 - entry.coronal.planes[0]) * entry.coronal.frame[1]} ${entry.coronal.frame[0]} ${entry.coronal.frame[1]}`,
  )
  expect(Number(patch.getAttribute('x'))).toBe(entry.origin[0] - mpr.crop.i[0])
  expect(Number(patch.getAttribute('y'))).toBeCloseTo((K1 - entry.slices[1]) * ASPECT, 6)
})

test('the neighbouring planes are preloaded, three each side', () => {
  const sources: string[] = []
  const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    ...src,
    set(value: string) {
      sources.push(value)
    },
  })
  try {
    render(<Host plane="sagittal" start={192} />)
  } finally {
    Object.defineProperty(HTMLImageElement.prototype, 'src', src)
  }
  expect(sources.sort()).toEqual(
    [189, 190, 191, 193, 194, 195].map((i) => referencePlaneUrl('sagittal', i)).sort(),
  )
})
