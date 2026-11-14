import { fireEvent, render } from '@testing-library/react'

import { LessonHost } from '../components/LessonHost'
import { CONTENT_LESSONS, lessonById } from '../content/curriculum'
import { activitiesForLesson } from '../content/stage'

/** A content unit by id: its lab, checks and boundary, whichever lesson now holds it. */
export const unitById = (id: string) => CONTENT_LESSONS.find((unit) => unit.id === id)!

/**
 * Render the lesson that holds a unit and continue to that unit's acquisition step.
 *
 * Five units (gain, and the contact, phantom, route and needle models) sit inside the lesson
 * before or after them since 2026-11-10. An earlier lab in the same lesson is left without an
 * image; every other step is continued past. Returns the unit.
 */
export function openUnitAcquisition(unitId: string) {
  const lesson = lessonById(unitId)!
  render(<LessonHost lesson={lesson} />)
  const target = activitiesForLesson(lesson).findIndex(
    (activity) => activity.interaction === 'acquire' && activity.lessonId === unitId,
  )
  for (let step = 0; step < target; step++) {
    const skip = document.querySelector('[data-skip-acquisition]') as HTMLButtonElement | null
    fireEvent.click(skip ?? (document.querySelector('[data-now-primary]') as HTMLButtonElement))
  }
  return unitById(unitId)
}
