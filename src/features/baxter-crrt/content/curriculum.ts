import { baxterCrrtLearnerCases } from './learnerRegistry'
import { baxterCrrtReleaseStage, type BaxterCrrtReleaseStage } from './release'
import { CRRT_ALL_CASE_IDS, type CrrtCaseId, type RuntimeCrrtCase } from './schema'
import { BAXTER_CRRT_CONTENT_VERSION } from './versions'

export type CrrtCurriculumStationNumber = 1 | 2 | 3 | 4 | 5 | 6

const stationNumberById: Readonly<
  Record<RuntimeCrrtCase['stationId'], CrrtCurriculumStationNumber>
> = Object.freeze({
  'define-goal': 1,
  'build-prescription': 2,
  'setup-start': 3,
  'monitor-dose-fluid': 4,
  'pressures-troubleshooting': 5,
  'anticoagulation-complications-liberation': 6,
})

export const baxterCrrtStationLabels: Readonly<Record<CrrtCurriculumStationNumber, string>> =
  Object.freeze({
    1: 'Define the goal',
    2: 'Build the prescription',
    3: 'Set up and start safely',
    4: 'Monitor patient, delivery, and fluid',
    5: 'Read pressures and troubleshoot',
    6: 'Anticoagulation, complications, and liberation',
  })

export interface BaxterCrrtCaseCatalogEntry {
  readonly id: CrrtCaseId
  readonly contentVersion: typeof BAXTER_CRRT_CONTENT_VERSION
  readonly releaseStage: BaxterCrrtReleaseStage
  readonly station: CrrtCurriculumStationNumber
  readonly stationLabel: string
  readonly title: string
  readonly focus: string
  readonly runtimeAvailable: true
  readonly sourceRecordIds: readonly string[]
  readonly reviewStatus: RuntimeCrrtCase['reviewStatus']
}

export const baxterCrrtCaseCatalog: readonly BaxterCrrtCaseCatalogEntry[] = Object.freeze(
  baxterCrrtLearnerCases.map((definition) => {
    const station = stationNumberById[definition.stationId]
    return Object.freeze({
      id: definition.id as CrrtCaseId,
      contentVersion: BAXTER_CRRT_CONTENT_VERSION,
      releaseStage: baxterCrrtReleaseStage,
      station,
      stationLabel: baxterCrrtStationLabels[station],
      title: definition.title,
      focus: definition.learningObjectives[0] ?? definition.title,
      runtimeAvailable: true as const,
      sourceRecordIds: Object.freeze(definition.sourceBasis.map((source) => source.id)),
      reviewStatus: definition.reviewStatus,
    })
  }),
)

for (const [index, id] of CRRT_ALL_CASE_IDS.entries()) {
  if (baxterCrrtCaseCatalog[index]?.id !== id) {
    throw new Error(`CRRT curriculum catalog order mismatch at ${id}.`)
  }
}

export {
  baxterCrrtLearnerCases,
  isBaxterCrrtLearnerCaseDefinition,
  isBaxterCrrtLearnerCaseId,
  isBaxterCrrtLearnerLessonId,
  isBaxterCrrtLearnerProgressCaseId,
} from './learnerRegistry'

/** Informational alias used by the SME preview; functionality is identical. */
export const baxterCrrtReviewerCases: readonly RuntimeCrrtCase[] = baxterCrrtLearnerCases

export function getBaxterCrrtCaseCatalogEntry(caseId: CrrtCaseId): BaxterCrrtCaseCatalogEntry {
  const entry = baxterCrrtCaseCatalog.find((candidate) => candidate.id === caseId)
  if (!entry) throw new Error(`Unknown CRRT curriculum case: ${caseId}`)
  return entry
}
