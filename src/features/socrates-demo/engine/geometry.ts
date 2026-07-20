import type {
  DeepZoomSlide,
  DemoAnnotation,
  FourPointPolygon,
  ImagePoint,
  ImageRect,
} from '../types'

const EPSILON = 1e-7

export function rectangleToPolygon(rect: ImageRect): FourPointPolygon {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ]
}

export function polygonBounds(points: readonly ImagePoint[]): ImageRect {
  if (points.length === 0) {
    throw new Error('A polygon must contain at least one point.')
  }

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function polygonArea(points: readonly ImagePoint[]): number {
  if (points.length < 3) return 0

  let twiceArea = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    twiceArea += current.x * next.y - next.x * current.y
  }

  return Math.abs(twiceArea) / 2
}

function pointIsOnSegment(point: ImagePoint, start: ImagePoint, end: ImagePoint) {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y)

  if (Math.abs(cross) > EPSILON) return false

  const dot = (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)
  if (dot < -EPSILON) return false

  const squaredLength = (end.x - start.x) ** 2 + (end.y - start.y) ** 2
  return dot <= squaredLength + EPSILON
}

export function polygonContainsPoint(points: readonly ImagePoint[], point: ImagePoint): boolean {
  if (points.length < 3) return false

  let inside = false

  for (
    let currentIndex = 0, previousIndex = points.length - 1;
    currentIndex < points.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const current = points[currentIndex]
    const previous = points[previousIndex]

    if (pointIsOnSegment(point, previous, current)) return true

    const crossesHorizontalRay =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x

    if (crossesHorizontalRay) inside = !inside
  }

  return inside
}

export function rectContainsRect(container: ImageRect, candidate: ImageRect): boolean {
  return (
    candidate.width > 0 &&
    candidate.height > 0 &&
    candidate.x >= container.x &&
    candidate.y >= container.y &&
    candidate.x + candidate.width <= container.x + container.width &&
    candidate.y + candidate.height <= container.y + container.height
  )
}

export function rectsIntersect(first: ImageRect, second: ImageRect): boolean {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  )
}

function getAnnotationDepth(
  annotation: DemoAnnotation,
  annotationById: ReadonlyMap<string, DemoAnnotation>,
  visited = new Set<string>(),
): number {
  if (!annotation.parentId) return 0
  if (visited.has(annotation.id)) return Number.POSITIVE_INFINITY

  const parent = annotationById.get(annotation.parentId)
  if (!parent) return Number.POSITIVE_INFINITY

  const nextVisited = new Set(visited)
  nextVisited.add(annotation.id)
  return 1 + getAnnotationDepth(parent, annotationById, nextVisited)
}

export function findDeepestAnnotationAtPoint(
  annotations: readonly DemoAnnotation[],
  visibleIds: ReadonlySet<string>,
  point: ImagePoint,
): DemoAnnotation | null {
  const annotationById = new Map(annotations.map((annotation) => [annotation.id, annotation]))

  const hits = annotations.filter(
    (annotation) =>
      visibleIds.has(annotation.id) && polygonContainsPoint(annotation.polygon, point),
  )

  hits.sort((first, second) => {
    const depthDifference =
      getAnnotationDepth(second, annotationById) - getAnnotationDepth(first, annotationById)
    if (depthDifference !== 0) return depthDifference

    const areaDifference = polygonArea(first.polygon) - polygonArea(second.polygon)
    if (areaDifference !== 0) return areaDifference

    return first.id.localeCompare(second.id)
  })

  return hits[0] ?? null
}

export function getAnnotationAncestry(
  annotationId: string,
  annotations: readonly DemoAnnotation[],
): DemoAnnotation[] {
  const annotationById = new Map(annotations.map((annotation) => [annotation.id, annotation]))
  const ancestry: DemoAnnotation[] = []
  const visited = new Set<string>()
  let current = annotationById.get(annotationId)

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    ancestry.unshift(current)
    current = current.parentId ? annotationById.get(current.parentId) : undefined
  }

  return ancestry
}

export function validateDemoData(
  slide: DeepZoomSlide,
  annotations: readonly DemoAnnotation[],
): string[] {
  const errors: string[] = []
  const slideBounds: ImageRect = {
    x: 0,
    y: 0,
    width: slide.expectedDimensions.width,
    height: slide.expectedDimensions.height,
  }

  if (slide.expectedDimensions.width <= 0 || slide.expectedDimensions.height <= 0) {
    errors.push('Slide dimensions must be positive.')
  }

  if (!rectContainsRect(slideBounds, slide.initialImageRect)) {
    errors.push('The initial image rectangle must be inside the slide bounds.')
  }

  const annotationById = new Map<string, DemoAnnotation>()
  for (const annotation of annotations) {
    if (annotationById.has(annotation.id)) {
      errors.push(`Annotation ID "${annotation.id}" is duplicated.`)
    }
    annotationById.set(annotation.id, annotation)

    if (!rectContainsRect(slideBounds, polygonBounds(annotation.polygon))) {
      errors.push(`Annotation "${annotation.id}" must be inside the slide bounds.`)
    }

    if (annotation.style === 'detail' && annotation.enterZoomRatio < annotation.exitZoomRatio) {
      errors.push(`Annotation "${annotation.id}" must enter at or above its exit zoom ratio.`)
    }
  }

  for (const annotation of annotations) {
    if (annotation.parentId && !annotationById.has(annotation.parentId)) {
      errors.push(
        `Annotation "${annotation.id}" references missing parent "${annotation.parentId}".`,
      )
      continue
    }

    const visited = new Set<string>([annotation.id])
    let parentId = annotation.parentId
    while (parentId) {
      if (visited.has(parentId)) {
        errors.push(`Annotation "${annotation.id}" participates in a parent cycle.`)
        break
      }
      visited.add(parentId)
      parentId = annotationById.get(parentId)?.parentId
    }
  }

  return errors
}
