import type { DemoAnnotation, ImageRect } from '../types'
import { polygonBounds, rectsIntersect } from './geometry'

function annotationDepth(
  annotation: DemoAnnotation,
  annotationById: ReadonlyMap<string, DemoAnnotation>,
): number {
  let depth = 0
  let parentId = annotation.parentId
  const visited = new Set<string>([annotation.id])

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    depth += 1
    parentId = annotationById.get(parentId)?.parentId
  }

  return depth
}

export function resolveVisibleAnnotationIds(
  annotations: readonly DemoAnnotation[],
  zoomRatio: number,
  previouslyVisibleIds: ReadonlySet<string>,
): Set<string> {
  const annotationById = new Map(annotations.map((annotation) => [annotation.id, annotation]))
  const ordered = [...annotations].sort(
    (first, second) =>
      annotationDepth(first, annotationById) - annotationDepth(second, annotationById),
  )
  const visibleIds = new Set<string>()

  for (const annotation of ordered) {
    if (!annotation.parentId) {
      visibleIds.add(annotation.id)
      continue
    }

    if (!visibleIds.has(annotation.parentId)) continue

    const threshold = previouslyVisibleIds.has(annotation.id)
      ? annotation.exitZoomRatio
      : annotation.enterZoomRatio

    if (zoomRatio >= threshold) visibleIds.add(annotation.id)
  }

  return visibleIds
}

export function annotationsInCurrentView(
  annotations: readonly DemoAnnotation[],
  visibleIds: ReadonlySet<string>,
  visibleImageBounds: ImageRect,
): DemoAnnotation[] {
  return annotations.filter(
    (annotation) =>
      visibleIds.has(annotation.id) &&
      rectsIntersect(polygonBounds(annotation.polygon), visibleImageBounds),
  )
}
