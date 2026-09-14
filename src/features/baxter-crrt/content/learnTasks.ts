import { crrtFoundationTasks } from './foundationLessons'
import { crrtOperationalTasks, CRRT_OPERATIONAL_VERSION } from './operationalLessons'
import type { BaxterCrrtLearnLessonId } from './learnerRegistry'
import { CRRT_FOUNDATION_VERSION } from '../learnEvidence'
import { crrtAdvancedTasks, CRRT_ADVANCED_VERSION } from './advancedLessons'

export const crrtLearnTasks = {
  ...crrtFoundationTasks,
  ...crrtOperationalTasks,
  ...crrtAdvancedTasks,
}
export const crrtLearnTaskVersion = (id: BaxterCrrtLearnLessonId) =>
  crrtAdvancedTasks[id]
    ? CRRT_ADVANCED_VERSION
    : crrtOperationalTasks[id]
      ? CRRT_OPERATIONAL_VERSION
      : CRRT_FOUNDATION_VERSION
