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
export const BAXTER_CRRT_LEARN_LESSON_IDS = Object.freeze([
  'crrt-indications-modality',
  'crrt-solute-transport',
  'crrt-prescription-dosing',
  'crrt-circuit-pressures',
  'crrt-anticoagulation',
  'crrt-alarms-troubleshooting',
  'crrt-fluid-liberation',
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
