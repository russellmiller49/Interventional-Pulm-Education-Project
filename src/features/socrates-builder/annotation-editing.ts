import { polygonBounds, rectangleToPolygon } from '@/features/socrates-demo/engine/geometry'
import type { DemoAnnotation, ImagePoint, ImageRect } from '@/features/socrates-demo/types'

export const resizeHandles = [
  { id: 'nw', label: 'top left', x: 0, y: 0 },
  { id: 'n', label: 'top', x: 0.5, y: 0 },
  { id: 'ne', label: 'top right', x: 1, y: 0 },
  { id: 'e', label: 'right', x: 1, y: 0.5 },
  { id: 'se', label: 'bottom right', x: 1, y: 1 },
  { id: 's', label: 'bottom', x: 0.5, y: 1 },
  { id: 'sw', label: 'bottom left', x: 0, y: 1 },
  { id: 'w', label: 'left', x: 0, y: 0.5 },
] as const
export type ResizeHandle = (typeof resizeHandles)[number]['id']

/** Keep the opposite edge fixed, even when the pointer crosses it. */
export function resizeBoundsFromHandle(bounds: ImageRect, handle: ResizeHandle, delta: ImagePoint) {
  const right = bounds.x + bounds.width
  const bottom = bounds.y + bounds.height
  const x = handle.includes('w') ? Math.min(bounds.x + delta.x, right - 1) : bounds.x
  const y = handle.includes('n') ? Math.min(bounds.y + delta.y, bottom - 1) : bounds.y
  return {
    x,
    y,
    width: handle.includes('e') ? Math.max(1, bounds.width + delta.x) : right - x,
    height: handle.includes('s') ? Math.max(1, bounds.height + delta.y) : bottom - y,
  }
}

/** Resize only this box; retain its descendants' exact coordinates and containment. */
export function resizeAnnotation(
  annotations: readonly DemoAnnotation[],
  id: string,
  proposed: ImageRect,
  slideBounds: ImageRect,
): DemoAnnotation[] {
  const selected = annotations.find((a) => a.id === id)
  if (!selected || !Object.values(proposed).every(Number.isFinite)) return [...annotations]
  const parent = annotations.find((a) => a.id === selected.parentId)
  const container = parent ? polygonBounds(parent.polygon) : slideBounds
  const family = annotationFamily(id, annotations)
  const children = annotations.filter((a) => a.id !== id && family.has(a.id))
  const childBounds = children.length ? polygonBounds(children.flatMap((a) => a.polygon)) : null
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))
  const x = clamp(proposed.x, container.x, childBounds?.x ?? container.x + container.width - 1)
  const y = clamp(proposed.y, container.y, childBounds?.y ?? container.y + container.height - 1)
  const right = clamp(
    proposed.x + proposed.width,
    Math.max(x + 1, childBounds ? childBounds.x + childBounds.width : x + 1),
    container.x + container.width,
  )
  const bottom = clamp(
    proposed.y + proposed.height,
    Math.max(y + 1, childBounds ? childBounds.y + childBounds.height : y + 1),
    container.y + container.height,
  )
  const next = { x, y, width: right - x, height: bottom - y }
  const previous = polygonBounds(selected.polygon)
  if ((Object.keys(next) as (keyof ImageRect)[]).every((key) => next[key] === previous[key]))
    return [...annotations]
  return annotations.map((a) => (a.id === id ? { ...a, polygon: rectangleToPolygon(next) } : a))
}

export function annotationFamily(id: string, annotations: readonly DemoAnnotation[]) {
  const ids = new Set([id])
  let added = true
  while (added) {
    added = false
    for (const annotation of annotations) {
      if (annotation.parentId && ids.has(annotation.parentId) && !ids.has(annotation.id)) {
        ids.add(annotation.id)
        added = true
      }
    }
  }
  return ids
}

/** Move a region and its descendants together, keeping the complete family inside its container. */
export function moveAnnotation(
  annotations: readonly DemoAnnotation[],
  id: string,
  delta: ImagePoint,
  slideBounds: ImageRect,
): DemoAnnotation[] {
  const selected = annotations.find((a) => a.id === id)
  if (!selected || !Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return [...annotations]
  const parent = annotations.find((a) => a.id === selected.parentId)
  const container = parent ? polygonBounds(parent.polygon) : slideBounds
  const family = annotationFamily(id, annotations)
  const bounds = polygonBounds(
    annotations.filter((a) => family.has(a.id)).flatMap((a) => a.polygon),
  )
  const x = Math.max(
    container.x - bounds.x,
    Math.min(delta.x, container.x + container.width - bounds.x - bounds.width),
  )
  const y = Math.max(
    container.y - bounds.y,
    Math.min(delta.y, container.y + container.height - bounds.y - bounds.height),
  )
  if (!x && !y) return [...annotations]
  const translate = (point: ImagePoint) => ({ x: point.x + x, y: point.y + y })
  return annotations.map(
    (a): DemoAnnotation =>
      family.has(a.id)
        ? {
            ...a,
            polygon: [
              translate(a.polygon[0]),
              translate(a.polygon[1]),
              translate(a.polygon[2]),
              translate(a.polygon[3]),
            ],
          }
        : a,
  )
}
