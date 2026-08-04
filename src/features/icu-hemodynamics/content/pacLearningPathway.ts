import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
// Leaf import, not the curriculum barrel: the barrel re-exports React components that reach
// next-intl navigation, and this is a content module loaded by non-DOM callers.
import {
  firstPathwaySectionId,
  isPathwaySectionId,
  nextPathwaySection,
  type LearningPathway,
  type LearningPathwaySection,
} from '@/features/learning-module/curriculum/types'

import type { PacGuidedSkillId } from './pacGuidedSkills'

export type PacLearningPathwaySectionId = PacGuidedSkillId | 'pac-signal-validation'

export type PacLearningPathwaySection = LearningPathwaySection

/**
 * The PAC pathway consumes the shared `LearningPathway` abstraction rather than keeping its own
 * copy.
 *
 * H0/H1 reordered it around measurement validity: the runway now opens with the pressure system
 * ("can I trust this signal?"), establishes a normal RA/RV/PA/PAWP reference, and only then asks
 * the learner to advance a simulated catheter. `pac-signal-validation` stays where it was — the
 * ungated final integration station, not a duplicate introductory lesson.
 *
 * Nothing here gates. The order is a recommendation; every section stays reachable by URL.
 */
export const pacLearningPathway: LearningPathway = criticalCareLearningPathway('icu-hemodynamics')

export const pacLearningPathwaySections: readonly PacLearningPathwaySection[] =
  pacLearningPathway.sections

export const firstPacLearningPathwaySectionId = firstPathwaySectionId(
  pacLearningPathway,
) as PacLearningPathwaySectionId

export function isPacLearningPathwaySectionId(
  value: unknown,
): value is PacLearningPathwaySectionId {
  return isPathwaySectionId(pacLearningPathway, value)
}

export function nextPacLearningPathwaySection(
  sectionId: PacLearningPathwaySectionId,
): PacLearningPathwaySection | null {
  return nextPathwaySection(pacLearningPathway, sectionId)
}
