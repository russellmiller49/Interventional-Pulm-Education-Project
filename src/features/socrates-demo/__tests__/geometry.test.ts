import { socratesDemoAnnotations, socratesDemoSlide } from '../content/demo-slide'
import {
  findDeepestAnnotationAtPoint,
  polygonArea,
  polygonBounds,
  polygonContainsPoint,
  rectangleToPolygon,
  validateDemoData,
} from '../engine/geometry'
import type { DemoAnnotation } from '../types'

describe('SOCRATES image-pixel geometry', () => {
  it('converts rectangles to ordered four-point polygons and recovers their bounds', () => {
    const polygon = rectangleToPolygon({ x: 10, y: 20, width: 30, height: 40 })

    expect(polygon).toEqual([
      { x: 10, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 60 },
      { x: 10, y: 60 },
    ])
    expect(polygonBounds(polygon)).toEqual({ x: 10, y: 20, width: 30, height: 40 })
    expect(polygonArea(polygon)).toBe(1200)
  })

  it('treats polygon interiors and boundaries as selectable', () => {
    const polygon = rectangleToPolygon({ x: 10, y: 20, width: 30, height: 40 })

    expect(polygonContainsPoint(polygon, { x: 25, y: 35 })).toBe(true)
    expect(polygonContainsPoint(polygon, { x: 10, y: 20 })).toBe(true)
    expect(polygonContainsPoint(polygon, { x: 40, y: 40 })).toBe(true)
    expect(polygonContainsPoint(polygon, { x: 41, y: 40 })).toBe(false)
  })

  it('selects the deepest and then smallest visible region at an overlap', () => {
    const smallestPeer: DemoAnnotation = {
      ...socratesDemoAnnotations[1],
      id: 'smallest-peer',
      polygon: rectangleToPolygon({ x: 350, y: 1930, width: 80, height: 80 }),
    }
    const annotations = [...socratesDemoAnnotations, smallestPeer]
    const visibleIds = new Set(annotations.map((annotation) => annotation.id))

    expect(findDeepestAnnotationAtPoint(annotations, visibleIds, { x: 370, y: 1950 })?.id).toBe(
      'smallest-peer',
    )
    expect(
      findDeepestAnnotationAtPoint(socratesDemoAnnotations, new Set(['zone-1', 'zone-1a']), {
        x: 400,
        y: 2000,
      })?.id,
    ).toBe('zone-1a')
  })

  it('validates the fixed demo against slide and hierarchy bounds', () => {
    expect(validateDemoData(socratesDemoSlide, socratesDemoAnnotations)).toEqual([])

    expect(
      validateDemoData(
        { ...socratesDemoSlide, initialImageRect: { x: 5300, y: 5800, width: 200, height: 200 } },
        socratesDemoAnnotations,
      ),
    ).toContain('The initial image rectangle must be inside the slide bounds.')
  })

  it('reports missing parents, cycles, and out-of-bounds annotations', () => {
    const missingParent: DemoAnnotation = {
      ...socratesDemoAnnotations[1],
      id: 'missing-parent-child',
      parentId: 'not-present',
    }
    const cyclicParent: DemoAnnotation = {
      ...socratesDemoAnnotations[0],
      id: 'cycle-parent',
      parentId: 'cycle-child',
    }
    const cyclicChild: DemoAnnotation = {
      ...socratesDemoAnnotations[1],
      id: 'cycle-child',
      parentId: 'cycle-parent',
    }
    const outside: DemoAnnotation = {
      ...socratesDemoAnnotations[0],
      id: 'outside',
      polygon: rectangleToPolygon({ x: 5300, y: 5800, width: 200, height: 200 }),
    }

    const errors = validateDemoData(socratesDemoSlide, [
      missingParent,
      cyclicParent,
      cyclicChild,
      outside,
    ])

    expect(errors).toContain(
      'Annotation "missing-parent-child" references missing parent "not-present".',
    )
    expect(errors).toContain('Annotation "cycle-parent" participates in a parent cycle.')
    expect(errors).toContain('Annotation "outside" must be inside the slide bounds.')
  })
})
