import { canActivateCrrtRecord, type CrrtActivationRecord } from './activation'
import { baxterCrrtPilotCases } from './pilotCases'
import type { RuntimeCrrtCase } from './schema'

export interface BaxterCrrtActivatedLearnerCaseRegistration {
  readonly definition: RuntimeCrrtCase
  readonly activationRecord: CrrtActivationRecord & { readonly contentVersion: string }
}

/**
 * Code-owned activation list. Adding a record is a consequential release
 * change and still cannot pass without the exact candidate-bound reviews and
 * phase authorization enforced by `canActivateCrrtRecord`.
 */
export const baxterCrrtPhase7LearnerRegistrations: readonly BaxterCrrtActivatedLearnerCaseRegistration[] =
  Object.freeze([])

export function buildBaxterCrrtLearnerCaseRegistry(
  protectedPilotCases: readonly RuntimeCrrtCase[],
  phase7Registrations: readonly BaxterCrrtActivatedLearnerCaseRegistration[],
): readonly RuntimeCrrtCase[] {
  if (phase7Registrations.length === 0) return protectedPilotCases

  const learnerCases = [...protectedPilotCases]
  const registeredIds = new Set(learnerCases.map(({ id }) => id))
  for (const registration of phase7Registrations) {
    const { activationRecord, definition } = registration
    if (activationRecord.id !== definition.id) {
      throw new Error('CRRT learner registration case and activation-record IDs must match.')
    }
    if (activationRecord.contentVersion !== definition.contentVersion) {
      throw new Error('CRRT learner registration case and activation content versions must match.')
    }
    if (registeredIds.has(definition.id)) {
      throw new Error(`Duplicate CRRT learner registration: ${definition.id}`)
    }
    if (!canActivateCrrtRecord(activationRecord)) {
      throw new Error(
        `CRRT learner registration ${definition.id} lacks complete exact-candidate activation evidence.`,
      )
    }
    registeredIds.add(definition.id)
    learnerCases.push(definition)
  }
  return Object.freeze(learnerCases)
}

/** The only runtime cases currently available to the protected learner workspace. */
export const baxterCrrtLearnerCases: readonly RuntimeCrrtCase[] =
  buildBaxterCrrtLearnerCaseRegistry(baxterCrrtPilotCases, baxterCrrtPhase7LearnerRegistrations)

const learnerCaseIds = new Set<string>(
  baxterCrrtLearnerCases.map((caseDefinition) => caseDefinition.id),
)
const learnerProgressCaseIds = new Set<string>(
  baxterCrrtLearnerCases.map((caseDefinition) => caseDefinition.id.toLowerCase()),
)
const learnerLessonIds = new Set<string>(
  baxterCrrtLearnerCases.map((caseDefinition) => `${caseDefinition.id.toLowerCase()}.learn`),
)

export function isBaxterCrrtLearnerCaseId(caseId: string): boolean {
  return learnerCaseIds.has(caseId)
}

/** Learner runtime accepts only the immutable object exported by the protected registry. */
export function isBaxterCrrtLearnerCaseDefinition(caseDefinition: RuntimeCrrtCase): boolean {
  return baxterCrrtLearnerCases.some((candidate) => candidate === caseDefinition)
}

export function isBaxterCrrtLearnerProgressCaseId(caseId: string): boolean {
  return learnerProgressCaseIds.has(caseId)
}

export function isBaxterCrrtLearnerLessonId(lessonId: string): boolean {
  return learnerLessonIds.has(lessonId)
}
