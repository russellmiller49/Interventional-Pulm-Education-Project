import type { CytologyAnnotation, CytologySlide, ImageDimensions, PercentPoint } from './types'

export function imagePointToPercent(point: { x: number; y: number }, dimensions: ImageDimensions) {
  if (dimensions.width <= 0 || dimensions.height <= 0) {
    return { xPct: 0, yPct: 0 }
  }

  return {
    xPct: clampPercent((point.x / dimensions.width) * 100),
    yPct: clampPercent((point.y / dimensions.height) * 100),
  }
}

export function percentToImagePoint(point: PercentPoint, dimensions: ImageDimensions) {
  return {
    x: (clampPercent(point.xPct) / 100) * dimensions.width,
    y: (clampPercent(point.yPct) / 100) * dimensions.height,
  }
}

export function annotationContainsPoint(annotation: CytologyAnnotation, point: PercentPoint) {
  const { xPct, yPct, radiusXPct, radiusYPct } = annotation.shape

  if (radiusXPct <= 0 || radiusYPct <= 0) {
    return false
  }

  const normalizedX = (point.xPct - xPct) / radiusXPct
  const normalizedY = (point.yPct - yPct) / radiusYPct

  return normalizedX * normalizedX + normalizedY * normalizedY <= 1
}

export function findAnnotationAtPoint(slide: CytologySlide, point: PercentPoint) {
  return slide.annotations.find((annotation) => annotationContainsPoint(annotation, point))
}

export function getAnnotationById(slide: CytologySlide, annotationId: string | undefined) {
  return slide.annotations.find((annotation) => annotation.id === annotationId)
}

export function getInitialAnnotation(slide: CytologySlide) {
  return slide.annotations[0]
}

export function isQuizAnswerCorrect(annotation: CytologyAnnotation, choiceId: string | undefined) {
  return Boolean(choiceId) && annotation.quiz.correctChoiceId === choiceId
}

export function getAnnotationOverlayStyle(annotation: CytologyAnnotation) {
  const { xPct, yPct, radiusXPct, radiusYPct } = annotation.shape

  return {
    height: `${radiusYPct * 2}%`,
    left: `${xPct}%`,
    top: `${yPct}%`,
    width: `${radiusXPct * 2}%`,
  }
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}
