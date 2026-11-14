import type {
  LearningPathway,
  LearningPathwaySection,
} from '@/features/learning-module/curriculum/types'

import { dolphinLearnerCopyErrors } from './learnerCopy'
import { DOLPHIN_BRONCHOSCOPY_MODULE_ID } from './release'
import { DOLPHIN_SECTION_META } from './sectionCatalog'
import { dolphinSectionIds, type DolphinSectionId } from './sectionIds'

export { dolphinSectionIds, isDolphinSectionId, type DolphinSectionId } from './sectionIds'

export function dolphinActivityId(sectionId: DolphinSectionId): string {
  return `${DOLPHIN_BRONCHOSCOPY_MODULE_ID}:learn:${sectionId}`
}

/** The module's verbs, in order: the Learn landing's heading. */
export const DOLPHIN_ARC_SENTENCE =
  'Map the airway, plan the day, reach the glottis, survey, sample, recover.'

export const dolphinPathway: LearningPathway = {
  moduleId: DOLPHIN_BRONCHOSCOPY_MODULE_ID,
  arcSentence: DOLPHIN_ARC_SENTENCE,
  sections: dolphinSectionIds.map((sectionId): LearningPathwaySection => {
    const meta = DOLPHIN_SECTION_META[sectionId]
    return {
      id: sectionId,
      shortTitle: meta.shortTitle,
      title: meta.title,
      minutes: meta.minutes,
      description: meta.summary,
      stage: meta.stage,
      activityId: dolphinActivityId(sectionId),
    }
  }),
}

export const dolphinPathwaySections: readonly LearningPathwaySection[] = dolphinPathway.sections

export function validateDolphinPathway(): readonly string[] {
  const errors: string[] = []
  const metaIds = Object.keys(DOLPHIN_SECTION_META)
  if ([...metaIds].sort().join('|') !== [...dolphinSectionIds].sort().join('|')) {
    errors.push('The section catalog does not list exactly the canonical section ids.')
  }
  dolphinSectionIds.forEach((id, index) => {
    const meta = DOLPHIN_SECTION_META[id]
    const where = `Section ${id}`
    errors.push(
      ...dolphinLearnerCopyErrors(`${where} title`, meta.title, { allowDigits: false }),
      ...dolphinLearnerCopyErrors(`${where} short title`, meta.shortTitle, { allowDigits: false }),
      ...dolphinLearnerCopyErrors(`${where} summary`, meta.summary),
    )
    if (meta.shortTitle.split(/\s+/).length > 3)
      errors.push(`${where} short title runs past three words.`)
    if (index === 0 ? meta.prerequisites.length > 0 : meta.prerequisites.length === 0) {
      errors.push(`${where} prerequisites: only the first section may assume nothing.`)
    }
    for (const prerequisite of meta.prerequisites) {
      const at = dolphinSectionIds.indexOf(prerequisite)
      if (at < 0) errors.push(`${where} assumes an unknown section ${prerequisite}.`)
      else if (at >= index) errors.push(`${where} assumes ${prerequisite}, which is not earlier.`)
    }
    if (meta.activityMinutes >= meta.minutes) {
      errors.push(`${where} spends all its minutes on activities, leaving none for reading.`)
    }
  })
  return errors
}

const pathwayErrors = validateDolphinPathway()
if (pathwayErrors.length > 0) {
  throw new Error(`The dolphin bronchoscopy pathway is invalid:\n${pathwayErrors.join('\n')}`)
}
