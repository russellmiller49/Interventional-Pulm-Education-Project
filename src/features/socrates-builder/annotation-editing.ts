import { polygonBounds } from '@/features/socrates-demo/engine/geometry'
import type { DemoAnnotation, ImagePoint, ImageRect } from '@/features/socrates-demo/types'

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
