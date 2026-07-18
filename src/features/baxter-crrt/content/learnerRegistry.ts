import { baxterCrrtCases } from './completeCases'
import { CRRT_ALL_CASE_IDS, validateCrrtCaseRegistry, type RuntimeCrrtCase } from './schema'

/**
 * The single immutable v1 learner registry. Informational review metadata is
 * deliberately not consulted here: private-development and SME-preview
 * runtimes execute the complete sourced curriculum.
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
const learnerLessonIds = new Set(
  baxterCrrtLearnerCases.map(({ id }) => `${id.toLowerCase()}.learn`),
)

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
