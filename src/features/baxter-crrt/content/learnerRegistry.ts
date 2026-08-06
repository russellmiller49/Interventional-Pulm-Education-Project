import { baxterCrrtCases } from './completeCases'
import { CRRT_ALL_CASE_IDS, validateCrrtCaseRegistry, type RuntimeCrrtCase } from './schema'

/**
 * The single immutable v1 learner registry. Informational review metadata is
 * deliberately not consulted here: the protected learner runtime executes
 * the complete sourced curriculum while the release remains in SME review.
 */
export const baxterCrrtLearnerCases: readonly RuntimeCrrtCase[] = baxterCrrtCases

const registryIssues = validateCrrtCaseRegistry(baxterCrrtLearnerCases, {
  expectedCaseIds: CRRT_ALL_CASE_IDS,
  registryLabel: 'Baxter CRRT v1 learner',
})
if (registryIssues.length > 0) {
  throw new Error(`Invalid Baxter CRRT learner registry: ${registryIssues.join('; ')}`)
}

const learnerCaseIds = new Set(baxterCrrtLearnerCases.map(({ id }) => id))
const learnerProgressCaseIds = new Set(baxterCrrtLearnerCases.map(({ id }) => id.toLowerCase()))
/**
 * Learner-facing lesson order (WP10 §5.2, C2 §4). Circuit anatomy precedes transport and
 * prescription because both of those reason about a blood path the learner has not otherwise been
 * shown; pressure localization precedes citrate because a citrate finding is only readable once
 * the learner can say whether a result belongs to the circuit or to the patient.
 *
 * This array is the module's single lesson sequence: `nextRecommendedCrrtActivity` walks it, and
 * `learnLessons.ts` and `lessonClinicalAnchors.ts` are both pinned to it, so the hub, the Learn
 * workbench, and the pathway cannot disagree about what comes next.
 */
export const BAXTER_CRRT_LEARN_LESSON_IDS = Object.freeze([
  'crrt-indications-modality',
  'crrt-circuit-pressures',
  'crrt-solute-transport',
  'crrt-prescription-dosing',
  'crrt-alarms-troubleshooting',
  'crrt-anticoagulation',
  'crrt-fluid-liberation',
  'crrt-pressure-profile-integration',
] as const)

export type BaxterCrrtLearnLessonId = (typeof BAXTER_CRRT_LEARN_LESSON_IDS)[number]

const learnerLessonIds = new Set<string>(BAXTER_CRRT_LEARN_LESSON_IDS)

export function isBaxterCrrtLearnerCaseId(caseId: string): boolean {
  return learnerCaseIds.has(caseId)
}

/** Learner runtime accepts only immutable definitions from the unified registry. */
export function isBaxterCrrtLearnerCaseDefinition(caseDefinition: RuntimeCrrtCase): boolean {
  return baxterCrrtLearnerCases.some((candidate) => candidate === caseDefinition)
}

export function isBaxterCrrtLearnerProgressCaseId(caseId: string): boolean {
  return learnerProgressCaseIds.has(caseId)
}

export function isBaxterCrrtLearnerLessonId(lessonId: string): boolean {
  return learnerLessonIds.has(lessonId)
}
