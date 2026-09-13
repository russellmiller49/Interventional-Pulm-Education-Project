import { crrtFoundationTasks } from './foundationLessons'
import { crrtOperationalTasks, CRRT_OPERATIONAL_VERSION } from './operationalLessons'
import type { BaxterCrrtLearnLessonId } from './learnerRegistry'
import { CRRT_FOUNDATION_VERSION } from '../learnEvidence'

export const crrtLearnTasks = { ...crrtFoundationTasks, ...crrtOperationalTasks }
export const crrtLearnTaskVersion = (id: BaxterCrrtLearnLessonId) =>
  crrtOperationalTasks[id] ? CRRT_OPERATIONAL_VERSION : CRRT_FOUNDATION_VERSION
