import { baxterCrrtLearnerCases, type BaxterCrrtLearnLessonId } from './learnerRegistry'
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
    4: 'Monitor dose and fluid',
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

/**
 * The complete immutable case catalog remains ordered with the schema registry.
 * Curation happens only through `baxterCrrtCurriculum` below.
 */
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

export interface CrrtCurriculumUnit {
  readonly id: string
  readonly station: CrrtCurriculumStationNumber
  readonly title: string
  readonly summary: string
  readonly lessonIds: readonly BaxterCrrtLearnLessonId[]
  readonly coreCaseIds: readonly CrrtCaseId[]
  readonly additionalCaseIds: readonly CrrtCaseId[]
  readonly capstoneId?: 'MASTERY-PRISMAX-01'
}

function curriculumUnit(unit: CrrtCurriculumUnit): Readonly<CrrtCurriculumUnit> {
  return Object.freeze(unit)
}

/** The high-yield presentation layer. CRRT-16 intentionally appears nowhere here. */
export const baxterCrrtCurriculum: readonly CrrtCurriculumUnit[] = Object.freeze([
  curriculumUnit({
    id: 'station-1-goal',
    station: 1,
    title: baxterCrrtStationLabels[1],
    summary:
      'Choose CRRT for the right goal, distinguish modality intent, and state what success means.',
    lessonIds: Object.freeze(['crrt-indications-modality']),
    coreCaseIds: Object.freeze(['CRRT-01', 'CRRT-02']),
    additionalCaseIds: Object.freeze(['CRRT-03']),
  }),
  curriculumUnit({
    id: 'station-2-prescription',
    station: 2,
    title: baxterCrrtStationLabels[2],
    summary:
      'Connect transport mechanisms to an explicit prescription and a measurable delivered dose.',
    lessonIds: Object.freeze(['crrt-solute-transport', 'crrt-prescription-dosing']),
    coreCaseIds: Object.freeze(['CRRT-04', 'CRRT-05']),
    additionalCaseIds: Object.freeze(['CRRT-06']),
  }),
  curriculumUnit({
    id: 'station-3-start',
    station: 3,
    title: baxterCrrtStationLabels[3],
    summary:
      'Verify the patient, prescription, circuit, fluids, and team plan before starting PrisMax.',
    lessonIds: Object.freeze(['crrt-alarms-troubleshooting']),
    coreCaseIds: Object.freeze(['CRRT-08']),
    additionalCaseIds: Object.freeze(['CRRT-07', 'CRRT-09']),
  }),
  curriculumUnit({
    id: 'station-4-monitor',
    station: 4,
    title: baxterCrrtStationLabels[4],
    summary:
      'Reconcile prescribed therapy with downtime, delivered dose, and the whole-patient fluid ledger.',
    lessonIds: Object.freeze(['crrt-fluid-liberation']),
    coreCaseIds: Object.freeze(['CRRT-11']),
    additionalCaseIds: Object.freeze(['CRRT-10', 'CRRT-12']),
  }),
  curriculumUnit({
    id: 'station-5-pressures',
    station: 5,
    title: baxterCrrtStationLabels[5],
    summary: 'Read pressure patterns as locations, then correct the cause and verify recovery.',
    lessonIds: Object.freeze(['crrt-circuit-pressures']),
    coreCaseIds: Object.freeze(['CRRT-13', 'CRRT-15']),
    additionalCaseIds: Object.freeze(['CRRT-14']),
  }),
  curriculumUnit({
    id: 'station-6-complications',
    station: 6,
    title: baxterCrrtStationLabels[6],
    summary:
      'Recognize anticoagulation hazards, manage complications, and reassess readiness to liberate.',
    lessonIds: Object.freeze(['crrt-anticoagulation']),
    coreCaseIds: Object.freeze(['CRRT-17', 'CRRT-18']),
    additionalCaseIds: Object.freeze([]),
    capstoneId: 'MASTERY-PRISMAX-01',
  }),
])

export const baxterCrrtCoreCaseIds: readonly CrrtCaseId[] = Object.freeze(
  baxterCrrtCurriculum.flatMap((unit) => unit.coreCaseIds),
)

export const baxterCrrtAdditionalCaseIds: readonly CrrtCaseId[] = Object.freeze(
  baxterCrrtCurriculum.flatMap((unit) => unit.additionalCaseIds),
)

export const baxterCrrtPracticeCaseIds: readonly CrrtCaseId[] = Object.freeze(
  baxterCrrtCurriculum.flatMap((unit) => [...unit.coreCaseIds, ...unit.additionalCaseIds]),
)

const practiceProgressCaseIds = new Set(baxterCrrtPracticeCaseIds.map((id) => id.toLowerCase()))

export function isBaxterCrrtPracticeCaseId(value: string): boolean {
  return practiceProgressCaseIds.has(value.toLowerCase())
}

export interface CrrtCurriculumProgressInput {
  readonly completedLessonIds: readonly string[]
  readonly completedPracticeCaseIds: readonly string[]
  readonly completedMasteryCapstoneIds?: readonly string[]
  readonly lastStation?: RuntimeCrrtCase['stationId'] | 'orientation'
}

export type BaxterCrrtRecommendedActivity =
  | { readonly kind: 'lesson'; readonly id: BaxterCrrtLearnLessonId; readonly unitId: string }
  | { readonly kind: 'case'; readonly id: CrrtCaseId; readonly unitId: string }
  | { readonly kind: 'capstone'; readonly id: 'MASTERY-PRISMAX-01'; readonly unitId: string }

function completedCaseSet(progress: CrrtCurriculumProgressInput): ReadonlySet<string> {
  return new Set(progress.completedPracticeCaseIds.map((id) => id.toUpperCase()))
}

export function isCrrtCurriculumUnitComplete(
  progress: CrrtCurriculumProgressInput,
  unit: CrrtCurriculumUnit,
): boolean {
  const lessons = new Set(progress.completedLessonIds)
  const cases = completedCaseSet(progress)
  return (
    unit.lessonIds.every((id) => lessons.has(id)) && unit.coreCaseIds.every((id) => cases.has(id))
  )
}

export function isCrrtCapstoneUnlocked(progress: CrrtCurriculumProgressInput): boolean {
  const completed = completedCaseSet(progress)
  return baxterCrrtCoreCaseIds.every((id) => completed.has(id))
}

export function remainingCrrtCoreCaseIds(
  progress: CrrtCurriculumProgressInput,
): readonly CrrtCaseId[] {
  const completed = completedCaseSet(progress)
  return baxterCrrtCoreCaseIds.filter((id) => !completed.has(id))
}

function nextInUnit(
  progress: CrrtCurriculumProgressInput,
  unit: CrrtCurriculumUnit,
): BaxterCrrtRecommendedActivity | null {
  const completedLessons = new Set(progress.completedLessonIds)
  const completedCases = completedCaseSet(progress)
  const lessonId = unit.lessonIds.find((id) => !completedLessons.has(id))
  if (lessonId) return { kind: 'lesson', id: lessonId, unitId: unit.id }
  const caseId = unit.coreCaseIds.find((id) => !completedCases.has(id))
  return caseId ? { kind: 'case', id: caseId, unitId: unit.id } : null
}

/**
 * Recommends unfinished work in the last station first, then walks the six-station core path.
 * Optional cases never block the capstone.
 */
export function nextRecommendedCrrtActivity(
  progress: CrrtCurriculumProgressInput,
): BaxterCrrtRecommendedActivity | null {
  const lastStationNumber =
    progress.lastStation && progress.lastStation !== 'orientation'
      ? stationNumberById[progress.lastStation]
      : undefined
  const lastUnit = baxterCrrtCurriculum.find((unit) => unit.station === lastStationNumber)
  const lastUnitActivity = lastUnit ? nextInUnit(progress, lastUnit) : null
  if (lastUnitActivity) return lastUnitActivity

  for (const unit of baxterCrrtCurriculum) {
    const activity = nextInUnit(progress, unit)
    if (activity) return activity
  }

  if (isCrrtCapstoneUnlocked(progress)) {
    const unit = baxterCrrtCurriculum.at(-1)
    return unit ? { kind: 'capstone', id: 'MASTERY-PRISMAX-01', unitId: unit.id } : null
  }
  return null
}

export function getBaxterCrrtCaseCatalogEntry(caseId: CrrtCaseId): BaxterCrrtCaseCatalogEntry {
  const entry = baxterCrrtCaseCatalog.find((candidate) => candidate.id === caseId)
  if (!entry) throw new Error(`Unknown CRRT curriculum case: ${caseId}`)
  return entry
}

export {
  baxterCrrtLearnerCases,
  BAXTER_CRRT_LEARN_LESSON_IDS,
  isBaxterCrrtLearnerCaseDefinition,
  isBaxterCrrtLearnerCaseId,
  isBaxterCrrtLearnerLessonId,
  isBaxterCrrtLearnerProgressCaseId,
  type BaxterCrrtLearnLessonId,
} from './learnerRegistry'
