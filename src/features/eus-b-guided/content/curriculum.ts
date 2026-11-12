import { liver } from './abdomen'
import { stationSeven } from './mediastinum'
import { whatEusBAdds } from './orientation'
import type { Chapter, Lesson, Step } from './types'

export const BASE = '/eus-b-guided'

/** The sole course-order registry. Every list, count and link is derived from it. */
export const CHAPTERS: Chapter[] = [
  { id: 'from-ebus', title: 'From EBUS to EUS-B', lessons: [whatEusBAdds] },
  { id: 'abdomen', title: 'Below the diaphragm', lessons: [liver] },
  { id: 'mediastinum', title: 'The mediastinum on the way out', lessons: [stationSeven] },
]

export const LESSONS: Lesson[] = CHAPTERS.flatMap((chapter) => chapter.lessons)

export const GUIDED_MINUTES = LESSONS.reduce((total, lesson) => total + lesson.minutes, 0)

export function lessonById(id: string | undefined): Lesson | undefined {
  return id ? LESSONS.find((lesson) => lesson.id === id) : undefined
}

export function lessonHref(id: string) {
  return `${BASE}/learn?section=${id}`
}

export function lessonNumber(id: string) {
  return LESSONS.findIndex((lesson) => lesson.id === id) + 1
}

export function nextLesson(id: string): Lesson | undefined {
  return LESSONS[LESSONS.findIndex((lesson) => lesson.id === id) + 1]
}

export function chapterOf(id: string): Chapter | undefined {
  return CHAPTERS.find((chapter) => chapter.lessons.some((lesson) => lesson.id === id))
}

/** The lab step a debrief explains. */
export function labStepFor(lesson: Lesson, debrief: Extract<Step, { kind: 'debrief' }>) {
  return lesson.steps.find(
    (step): step is Extract<Step, { kind: 'lab' }> => step.kind === 'lab' && step.id === debrief.of,
  )
}

/** Whether any step of the lesson shows the ultrasound lab. */
export function lessonUsesLab(lesson: Lesson) {
  return lesson.steps.some(
    (step) => step.kind === 'lab' || step.kind === 'debrief' || ('view' in step && !!step.view),
  )
}

/**
 * The six landmarks of the survey, in the order they are examined (Issa, Clementsen et al. 2023):
 * three below the diaphragm, then three in the mediastinum as the scope is withdrawn.
 */
export const SURVEY_STOPS = [
  { stop: 1, name: 'Left lobe of the liver', region: 'abdomen' },
  { stop: 2, name: 'Abdominal aorta, celiac trunk and SMA', region: 'abdomen' },
  { stop: 3, name: 'Left adrenal gland', region: 'abdomen' },
  { stop: 4, name: 'Station 7', region: 'mediastinum' },
  { stop: 5, name: 'Station 4L', region: 'mediastinum' },
  { stop: 6, name: 'Station 4R', region: 'mediastinum' },
] as const

export function lessonForStop(stop: number): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.stop === stop)
}

export const COURSE_OBJECTIVES = [
  'Say what an examination from the esophagus adds to airway EBUS, and what stays with the airway.',
  'Find each landmark of the survey on ultrasound and confirm it by its neighbors.',
  'Use rotation to move around the scope at one level, and advancing or withdrawing to change level.',
]
