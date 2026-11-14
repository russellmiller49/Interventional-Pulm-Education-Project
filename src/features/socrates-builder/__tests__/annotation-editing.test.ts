import {
  annotationFamily,
  moveAnnotation,
  resizeAnnotation,
  resizeBoundsFromHandle,
} from '../annotation-editing'
import { rectangleToPolygon, polygonBounds } from '@/features/socrates-demo/engine/geometry'
import type { DemoAnnotation } from '@/features/socrates-demo/types'

const region = (id: string, x: number, width: number, parentId?: string): DemoAnnotation => ({
  id,
  label: id,
  polygon: rectangleToPolygon({ x, y: x, width, height: width }),
  style: parentId ? 'detail' : 'parent',
  parentId,
  enterZoomRatio: 0,
  exitZoomRatio: 0,
  summary: '',
  placeholderNote: '',
  sortOrder: 0,
})
const slide = { x: 0, y: 0, width: 1000, height: 1000 }

test('moving a parent preserves polygons, relative child placement, and unrelated regions', () => {
  const annotations = [
    region('parent', 100, 300),
    region('detail', 150, 100, 'parent'),
    region('other', 700, 100),
  ]
  const before = JSON.stringify(annotations)
  const moved = moveAnnotation(annotations, 'parent', { x: 50, y: -30 }, slide)
  expect(polygonBounds(moved[0].polygon)).toMatchObject({ x: 150, y: 70 })
  expect(polygonBounds(moved[1].polygon)).toMatchObject({ x: 200, y: 120 })
  expect(moved[2]).toBe(annotations[2])
  expect(JSON.stringify(annotations)).toBe(before)
  expect(annotationFamily('parent', annotations)).toEqual(new Set(['parent', 'detail']))
})

test('movement clamps a parent to the slide and a detail to its parent without shrinking either', () => {
  const annotations = [region('parent', 100, 300), region('detail', 150, 100, 'parent')]
  const moved = moveAnnotation(annotations, 'parent', { x: 5000, y: -5000 }, slide)
  expect(polygonBounds(moved[0].polygon)).toEqual({ x: 700, y: 0, width: 300, height: 300 })
  expect(polygonBounds(moved[1].polygon)).toEqual({ x: 750, y: 50, width: 100, height: 100 })
  const child = moveAnnotation(annotations, 'detail', { x: 5000, y: -5000 }, slide)
  expect(polygonBounds(child[1].polygon)).toEqual({ x: 300, y: 100, width: 100, height: 100 })
  expect(child[0]).toBe(annotations[0])
})

test('resizing a parent retains all descendants in place and clamps at their outer bounds', () => {
  const annotations = [
    region('parent', 100, 300),
    region('detail', 150, 100, 'parent'),
    region('nested', 170, 40, 'detail'),
    region('other', 700, 100),
  ]
  const resized = resizeAnnotation(
    annotations,
    'parent',
    { x: 200, y: 200, width: 1, height: 1 },
    slide,
  )
  expect(polygonBounds(resized[0].polygon)).toEqual({ x: 150, y: 150, width: 100, height: 100 })
  expect(resized.slice(1)).toEqual(annotations.slice(1))
  expect(resized[1]).toBe(annotations[1])
  expect(polygonBounds(annotations[0].polygon)).toEqual({ x: 100, y: 100, width: 300, height: 300 })
})

test('resizing a detail stays in its parent and resizing an outer box stays in the slide', () => {
  const annotations = [region('parent', 100, 300), region('detail', 150, 100, 'parent')]
  const proposed = { x: -100, y: -100, width: 5000, height: 5000 }
  const detail = resizeAnnotation(annotations, 'detail', proposed, slide)
  expect(polygonBounds(detail[1].polygon)).toEqual({ x: 100, y: 100, width: 300, height: 300 })
  expect(detail[0]).toBe(annotations[0])
  const parent = resizeAnnotation(annotations, 'parent', proposed, slide)
  expect(polygonBounds(parent[0].polygon)).toEqual(slide)
  expect(parent[1]).toBe(annotations[1])
  expect(resizeAnnotation(annotations, 'parent', { ...proposed, x: NaN }, slide)).toEqual(
    annotations,
  )
})

test('corner and edge resizes fix the opposite edge and stop at one source pixel', () => {
  const bounds = { x: 100, y: 200, width: 300, height: 400 }
  expect(resizeBoundsFromHandle(bounds, 'nw', { x: -50, y: -80 })).toEqual({
    x: 50,
    y: 120,
    width: 350,
    height: 480,
  })
  expect(resizeBoundsFromHandle(bounds, 'e', { x: 70, y: 80 })).toEqual({ ...bounds, width: 370 })
  expect(resizeBoundsFromHandle(bounds, 'nw', { x: 5000, y: 5000 })).toEqual({
    x: 399,
    y: 599,
    width: 1,
    height: 1,
  })
})
