import type { CriticalCareCurriculumStage } from '@/features/learning-module/activity/types'
import type {
  LearningPathway,
  LearningPathwaySection,
} from '@/features/learning-module/curriculum/types'

import { LESSONS } from '../data/lessons'
import { QUESTION_BY_ID } from '../data/questions'
import type { Lesson } from '../types'
import { imagingLearnerCopyErrors } from './learnerCopy'

/**
 * The canonical order: the one ordering authority every surface lists content from.
 *
 * Section ids are the draft's lesson ids, kept stable so a learner's record survives the
 * rebuild, plus the foundations the stage grammar needs (the chain walk and the control-panel
 * moment). Everything that counts, numbers or groups sections derives from this array at render;
 * nothing writes a count down. The lesson data (`data/lessons.ts`) must list the same ids in the
 * same order, which the validator below enforces at import.
 */
export const peripheralImagingSectionIds = [
  'imaging-questions',
  'chain-walk',
  'good-image',
  'current-anatomy',
  'projection',
  'signal',
  'field',
  'time',
  'two-dimensional',
  'dts-acquisition',
  'dts-interpretation',
  'cbct-acquisition',
  'fixed-suite',
  'mobile-suite',
  'tool-confirmation',
  'changing-anatomy',
  'staff-protection',
  'dose-reporting',
  'suite-cases',
] as const

export type ImagingSectionId = (typeof peripheralImagingSectionIds)[number]

export function isImagingSectionId(value: unknown): value is ImagingSectionId {
  return (
    typeof value === 'string' && (peripheralImagingSectionIds as readonly string[]).includes(value)
  )
}

export const PERIPHERAL_IMAGING_MODULE_ID = 'peripheral-imaging'

export function imagingActivityId(sectionId: ImagingSectionId): string {
  return `${PERIPHERAL_IMAGING_MODULE_ID}:learn:${sectionId}`
}

const lessonById = new Map<string, Lesson>(LESSONS.map((lesson) => [lesson.id, lesson]))

export function imagingLesson(sectionId: ImagingSectionId): Lesson {
  const lesson = lessonById.get(sectionId)
  if (!lesson) throw new Error(`No lesson for section ${sectionId}`)
  return lesson
}

const STAGE_BY_LABEL: Readonly<Record<string, CriticalCareCurriculumStage>> = {
  Orientation: 'orientation',
  Foundation: 'foundation',
  Mechanism: 'mechanism',
  Application: 'application',
  'Independent practice': 'integration',
}

export function imagingStageOf(lesson: Lesson): CriticalCareCurriculumStage {
  const stage = STAGE_BY_LABEL[lesson.stage]
  if (!stage) throw new Error(`Lesson ${lesson.id} has an unknown stage ${lesson.stage}`)
  return stage
}

/** The Learn landing's verbs, in order. */
export const PERIPHERAL_IMAGING_ARC_SENTENCE =
  'Ask the question, follow the beam, add a dimension, verify the tool, protect the room.'

export const peripheralImagingPathway: LearningPathway = {
  moduleId: PERIPHERAL_IMAGING_MODULE_ID,
  arcSentence: PERIPHERAL_IMAGING_ARC_SENTENCE,
  sections: peripheralImagingSectionIds.map((sectionId): LearningPathwaySection => {
    const lesson = imagingLesson(sectionId)
    return {
      id: sectionId,
      shortTitle: lesson.shortTitle,
      title: lesson.title,
      minutes: lesson.minutes,
      description: lesson.outcome,
      stage: imagingStageOf(lesson),
      activityId: imagingActivityId(sectionId),
    }
  }),
}

export const peripheralImagingPathwaySections: readonly LearningPathwaySection[] =
  peripheralImagingPathway.sections

export function validateImagingPathway(): readonly string[] {
  const errors: string[] = []
  const lessonIds = LESSONS.map((lesson) => lesson.id)
  if (lessonIds.join('|') !== peripheralImagingSectionIds.join('|')) {
    errors.push(
      `The lesson data (${lessonIds.join(', ')}) does not list the canonical order (${peripheralImagingSectionIds.join(', ')}).`,
    )
  }
  if (new Set(lessonIds).size !== lessonIds.length) errors.push('A lesson id is declared twice.')
  LESSONS.forEach((lesson, index) => {
    const where = `Lesson ${lesson.id}`
    errors.push(
      ...imagingLearnerCopyErrors(`${where} title`, lesson.title, { allowDigits: false }),
      ...imagingLearnerCopyErrors(`${where} short title`, lesson.shortTitle, {
        allowDigits: false,
      }),
    )
    if (lesson.shortTitle.split(/\s+/).length > 3) {
      errors.push(`${where} short title runs past three words.`)
    }
    if (!(lesson.stage in STAGE_BY_LABEL)) errors.push(`${where} has an unknown stage.`)
    if (index === 0 ? lesson.prerequisites.length > 0 : lesson.prerequisites.length === 0) {
      errors.push(`${where} prerequisites: only the first section may assume nothing.`)
    }
    for (const prerequisite of lesson.prerequisites) {
      const prerequisiteIndex = lessonIds.indexOf(prerequisite)
      if (prerequisiteIndex < 0) errors.push(`${where} assumes an unknown section ${prerequisite}.`)
      else if (prerequisiteIndex >= index) {
        errors.push(`${where} assumes ${prerequisite}, which is not earlier on the pathway.`)
      }
    }
    if (lesson.checkIds.length !== 2) {
      errors.push(`${where} must carry a prediction item and a transfer item.`)
    }
    for (const checkId of lesson.checkIds) {
      if (!QUESTION_BY_ID[checkId]) errors.push(`${where} names an unknown item ${checkId}.`)
    }
  })
  return errors
}

const pathwayErrors = validateImagingPathway()
if (pathwayErrors.length > 0) {
  throw new Error(`The peripheral-imaging pathway is invalid:\n${pathwayErrors.join('\n')}`)
}
