// Imported from the leaf module, not the activity barrel: this file is reachable from public
// client components, and the barrel pulls the analytics/progress-sync graph in with it.
import {
  criticalCareCurriculumStageRank,
  type CriticalCareActivityDefinition,
} from '@/features/learning-module/activity/types'

export type CurriculumOrderedActivity = Pick<
  CriticalCareActivityDefinition,
  'curriculumStage' | 'stageOrder'
>

/**
 * The single ordering rule for every surface that lists activities: teaching arc first, then the
 * authored ordinal within that stage.
 *
 * Deliberately no title comparison, as a primary key or a tiebreak. The previous rule sorted by
 * `difficulty`, which was section-constant, so the first term was always zero and the whole sort
 * collapsed into alphabetical-by-title — silently scrambling the station order that CRRT and the
 * ECMO track sequences are authored in.
 */
export function compareByCurriculumOrder(
  left: CurriculumOrderedActivity,
  right: CurriculumOrderedActivity,
): number {
  return (
    criticalCareCurriculumStageRank[left.curriculumStage] -
      criticalCareCurriculumStageRank[right.curriculumStage] || left.stageOrder - right.stageOrder
  )
}

/**
 * Stable sort, so activities that tie on (stage, stageOrder) keep the authored catalog order they
 * arrived in rather than falling back to any lexical comparison.
 */
export function sortByCurriculumOrder<T extends CurriculumOrderedActivity>(
  activities: readonly T[],
): T[] {
  return [...activities].sort(compareByCurriculumOrder)
}
