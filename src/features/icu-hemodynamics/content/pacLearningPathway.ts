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
 * The PAC pathway now consumes the shared `LearningPathway` abstraction rather than keeping its
 * own copy. The order is unchanged: it begins at the introducer and follows the catheter through
 * the right heart, with signal validation as an ungated final integration station rather than a
 * duplicate introductory module.
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
