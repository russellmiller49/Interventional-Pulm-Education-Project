import type {
  LearningPathway,
  LearningPathwaySection,
} from '@/features/learning-module/curriculum/types'

import { bronchLearnerCopyErrors } from './learnerCopy'
import { BRONCH_SECTION_IDS, BRONCH_SECTION_STAGE, type BronchSectionId } from './sectionIds'
import { BRONCH_SECTIONS, bronchSection } from './sections'
import type { BronchSectionDefinition } from './types'

export { BRONCH_SECTION_IDS, isBronchSectionId, type BronchSectionId } from './sectionIds'
export { bronchSection }

/**
 * The pathway every surface lists sections from, derived from the section registry in the
 * canonical order. Nothing writes a count down: totals, minutes and positions come from this
 * array at render.
 */
export const BRONCH_MODULE_ID = 'bronchoscopy-foundations'

export function bronchActivityId(sectionId: BronchSectionId): string {
  return `${BRONCH_MODULE_ID}:learn:${sectionId}`
}

/** The Learn landing H1: the module's verbs, in the order of its nine phases. */
export const BRONCH_ARC_SENTENCE =
  'Prepare, handle, orient, enter, survey, describe, sample, respond, close.'

function pathwaySectionOf(section: BronchSectionDefinition): LearningPathwaySection {
  return {
    id: section.id,
    shortTitle: section.shortTitle,
    title: section.title,
    minutes: section.minutes,
    description: section.objective,
    stage: BRONCH_SECTION_STAGE[section.id],
    activityId: bronchActivityId(section.id),
  }
}

export const bronchoscopyFoundationsPathway: LearningPathway = {
  moduleId: BRONCH_MODULE_ID,
  arcSentence: BRONCH_ARC_SENTENCE,
  sections: BRONCH_SECTIONS.map(pathwaySectionOf),
}

export const bronchPathwaySections: readonly LearningPathwaySection[] =
  bronchoscopyFoundationsPathway.sections

export function validateBronchPathway(): readonly string[] {
  const errors: string[] = []
  const ids = bronchPathwaySections.map((section) => section.id)
  if (ids.join('|') !== BRONCH_SECTION_IDS.join('|')) {
    errors.push('The pathway does not list the canonical order.')
  }
  errors.push(
    ...bronchLearnerCopyErrors('The arc sentence', BRONCH_ARC_SENTENCE, { allowDigits: false }),
  )
  bronchPathwaySections.forEach((section, index) => {
    const where = `Pathway section ${section.id}`
    if (section.shortTitle.split(/\s+/).length > 4)
      errors.push(`${where} short title runs past four words.`)
    const authored = bronchSection(section.id as BronchSectionId)
    if (index === 0 ? authored.prerequisites.length > 0 : authored.prerequisites.length === 0) {
      errors.push(`${where}: only the first section may assume nothing.`)
    }
  })
  return errors
}

const pathwayErrors = validateBronchPathway()
if (pathwayErrors.length > 0) {
  throw new Error(`The Bronchoscopy Foundations pathway is invalid:\n${pathwayErrors.join('\n')}`)
}
