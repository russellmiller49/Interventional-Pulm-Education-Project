import { cytologySlides } from '../content/slides'
import {
  annotationContainsPoint,
  findAnnotationAtPoint,
  getAnnotationById,
  getAnnotationOverlayStyle,
  getInitialAnnotation,
  imagePointToPercent,
  isQuizAnswerCorrect,
  percentToImagePoint,
} from '../engine/annotations'

describe('rapid onsite cytology annotation helpers', () => {
  const slide = cytologySlides[0]
  const annotation = slide.annotations[0]

  it('converts image coordinates to clamped percent coordinates', () => {
    expect(imagePointToPercent({ x: 250, y: 500 }, { width: 1000, height: 1000 })).toEqual({
      xPct: 25,
      yPct: 50,
    })

    expect(imagePointToPercent({ x: 1200, y: -100 }, { width: 1000, height: 1000 })).toEqual({
      xPct: 100,
      yPct: 0,
    })

    expect(imagePointToPercent({ x: 10, y: 10 }, { width: 0, height: 1000 })).toEqual({
      xPct: 0,
      yPct: 0,
    })
  })

  it('converts percent coordinates back into image coordinates', () => {
    expect(percentToImagePoint({ xPct: 25, yPct: 75 }, { width: 800, height: 400 })).toEqual({
      x: 200,
      y: 300,
    })
  })

  it('selects annotations by point and id', () => {
    const center = {
      xPct: annotation.shape.xPct,
      yPct: annotation.shape.yPct,
    }

    expect(annotationContainsPoint(annotation, center)).toBe(true)
    expect(annotationContainsPoint(annotation, { xPct: 1, yPct: 1 })).toBe(false)
    expect(findAnnotationAtPoint(slide, center)).toBe(annotation)
    expect(getAnnotationById(slide, annotation.id)).toBe(annotation)
    expect(getInitialAnnotation(slide)).toBe(annotation)
  })

  it('scores quiz answers and produces percent overlay styles', () => {
    expect(isQuizAnswerCorrect(annotation, annotation.quiz.correctChoiceId)).toBe(true)
    expect(isQuizAnswerCorrect(annotation, 'granuloma')).toBe(false)
    expect(isQuizAnswerCorrect(annotation, undefined)).toBe(false)

    expect(getAnnotationOverlayStyle(annotation)).toEqual({
      height: `${annotation.shape.radiusYPct * 2}%`,
      left: `${annotation.shape.xPct}%`,
      top: `${annotation.shape.yPct}%`,
      width: `${annotation.shape.radiusXPct * 2}%`,
    })
  })
})
