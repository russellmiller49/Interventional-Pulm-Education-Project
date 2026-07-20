import { socratesDemoAnnotations, socratesDemoSlide } from '../content/demo-slide'
import { annotationsInCurrentView, resolveVisibleAnnotationIds } from '../engine/visibility'

describe('SOCRATES zoom visibility', () => {
  it('shows roots initially and reveals children at the enter threshold', () => {
    const initial = resolveVisibleAnnotationIds(socratesDemoAnnotations, 1, new Set())
    const belowEntry = resolveVisibleAnnotationIds(socratesDemoAnnotations, 1.74, initial)
    const atEntry = resolveVisibleAnnotationIds(socratesDemoAnnotations, 1.75, belowEntry)

    expect([...initial]).toEqual(['zone-1', 'zone-2'])
    expect([...belowEntry]).toEqual(['zone-1', 'zone-2'])
    expect([...atEntry]).toEqual(['zone-1', 'zone-2', 'zone-1a', 'zone-1b', 'zone-2a'])
  })

  it('keeps visible children through the hysteresis band and hides them below exit', () => {
    const detailed = resolveVisibleAnnotationIds(socratesDemoAnnotations, 2, new Set())
    const withinBand = resolveVisibleAnnotationIds(socratesDemoAnnotations, 1.55, detailed)
    const belowExit = resolveVisibleAnnotationIds(socratesDemoAnnotations, 1.54, withinBand)

    expect(withinBand.has('zone-1a')).toBe(true)
    expect(withinBand.has('zone-2a')).toBe(true)
    expect([...belowExit]).toEqual(['zone-1', 'zone-2'])
  })

  it('lists only visible annotations intersecting the current image bounds', () => {
    const visibleIds = resolveVisibleAnnotationIds(socratesDemoAnnotations, 2, new Set())
    const zoneOneView = annotationsInCurrentView(socratesDemoAnnotations, visibleIds, {
      x: 200,
      y: 1780,
      width: 730,
      height: 940,
    })

    expect(zoneOneView.map((annotation) => annotation.id)).toEqual(['zone-1', 'zone-1a', 'zone-1b'])
    expect(
      annotationsInCurrentView(
        socratesDemoAnnotations,
        new Set(['zone-1', 'zone-2']),
        socratesDemoSlide.initialImageRect,
      ).map((annotation) => annotation.id),
    ).toEqual(['zone-1', 'zone-2'])
  })
})
