import { baxterCrrtReleaseStage, type BaxterCrrtReleaseStage } from './release'

export const CRRT_CASE_ARTIFACT_IDS = Object.freeze([
  'CRRT-01',
  'CRRT-02',
  'CRRT-03',
  'CRRT-04',
  'CRRT-05',
  'CRRT-06',
  'CRRT-07',
  'CRRT-08',
  'CRRT-09',
  'CRRT-10',
  'CRRT-11',
  'CRRT-12',
  'CRRT-13',
  'CRRT-14',
  'CRRT-15',
  'CRRT-16',
  'CRRT-17',
  'CRRT-18',
] as const)

export const CRRT_RAPID_DRILL_ARTIFACT_IDS = Object.freeze([
  'DRILL-AIR',
  'DRILL-BLOOD-LEAK',
  'DRILL-GAIN-LOSS',
  'DRILL-BAG-SCALE',
  'DRILL-POWER',
  'DRILL-WRONG-SOLUTION',
  'DRILL-BLOOD-RETURN',
] as const)

export const CRRT_INSTRUCTIONAL_TOOL_ARTIFACT_IDS = Object.freeze([
  'LAB-TRANSPORT',
  'LAB-PRESCRIPTION',
  'LAB-PREPOST-DILUTION',
  'LAB-PRESSURE-LOCALIZATION',
  'LAB-FLUID-LEDGER',
  'LAB-CITRATE-DASHBOARD',
] as const)

export const CRRT_MASTERY_ARTIFACT_IDS = Object.freeze(['MASTERY-PRISMAX-01'] as const)
export const CRRT_DEVICE_PROFILE_RELEASE_ARTIFACT_IDS = Object.freeze([
  'prismax-aw8035-2xx',
  'prismaflex-g5036003-6xx',
] as const)
export const CRRT_CROSS_DEVICE_TRANSFER_ARTIFACT_IDS = Object.freeze([
  'TRANSFER-PRISMAX-PRISMAFLEX-01',
] as const)

export const CRRT_LEARNING_ARTIFACT_IDS = Object.freeze([
  ...CRRT_CASE_ARTIFACT_IDS,
  ...CRRT_RAPID_DRILL_ARTIFACT_IDS,
  ...CRRT_INSTRUCTIONAL_TOOL_ARTIFACT_IDS,
  ...CRRT_MASTERY_ARTIFACT_IDS,
  ...CRRT_DEVICE_PROFILE_RELEASE_ARTIFACT_IDS,
  ...CRRT_CROSS_DEVICE_TRANSFER_ARTIFACT_IDS,
] as const)

export type CrrtCaseArtifactId = (typeof CRRT_CASE_ARTIFACT_IDS)[number]
export type CrrtRapidDrillArtifactId = (typeof CRRT_RAPID_DRILL_ARTIFACT_IDS)[number]
export type CrrtInstructionalToolArtifactId = (typeof CRRT_INSTRUCTIONAL_TOOL_ARTIFACT_IDS)[number]
export type CrrtMasteryArtifactId = (typeof CRRT_MASTERY_ARTIFACT_IDS)[number]
export type CrrtDeviceProfileReleaseArtifactId =
  (typeof CRRT_DEVICE_PROFILE_RELEASE_ARTIFACT_IDS)[number]
export type CrrtCrossDeviceTransferArtifactId =
  (typeof CRRT_CROSS_DEVICE_TRANSFER_ARTIFACT_IDS)[number]
export type CrrtLearningArtifactId = (typeof CRRT_LEARNING_ARTIFACT_IDS)[number]

export type CrrtLearningArtifactKind =
  | 'case'
  | 'rapid-drill'
  | 'instructional-tool'
  | 'mastery'
  | 'device-profile'
  | 'cross-device-transfer'

export interface CrrtLearningArtifact {
  readonly id: CrrtLearningArtifactId
  readonly kind: CrrtLearningArtifactKind
  readonly releaseStage: BaxterCrrtReleaseStage
  readonly runtimeAvailable: true
  /** Informational provenance only; never consulted for runtime availability. */
  readonly reviewStatus: 'pending' | 'reviewed' | 'approved'
}

function kindFor(id: CrrtLearningArtifactId): CrrtLearningArtifactKind {
  if ((CRRT_CASE_ARTIFACT_IDS as readonly string[]).includes(id)) return 'case'
  if ((CRRT_RAPID_DRILL_ARTIFACT_IDS as readonly string[]).includes(id)) return 'rapid-drill'
  if ((CRRT_INSTRUCTIONAL_TOOL_ARTIFACT_IDS as readonly string[]).includes(id)) {
    return 'instructional-tool'
  }
  if ((CRRT_MASTERY_ARTIFACT_IDS as readonly string[]).includes(id)) return 'mastery'
  if ((CRRT_DEVICE_PROFILE_RELEASE_ARTIFACT_IDS as readonly string[]).includes(id)) {
    return 'device-profile'
  }
  return 'cross-device-transfer'
}

export const baxterCrrtLearningArtifactRegistry: readonly CrrtLearningArtifact[] = Object.freeze(
  CRRT_LEARNING_ARTIFACT_IDS.map((id) =>
    Object.freeze({
      id,
      kind: kindFor(id),
      releaseStage: baxterCrrtReleaseStage,
      runtimeAvailable: true as const,
      reviewStatus: 'pending' as const,
    }),
  ),
)

if (
  new Set(baxterCrrtLearningArtifactRegistry.map(({ id }) => id)).size !==
  CRRT_LEARNING_ARTIFACT_IDS.length
) {
  throw new Error('CRRT learning artifact IDs must be globally unique.')
}

const artifactIds = new Set<string>(CRRT_LEARNING_ARTIFACT_IDS)
export function isCrrtLearningArtifactId(value: string): value is CrrtLearningArtifactId {
  return artifactIds.has(value)
}

export function getCrrtLearningArtifact(id: CrrtLearningArtifactId): CrrtLearningArtifact {
  const artifact = baxterCrrtLearningArtifactRegistry.find((candidate) => candidate.id === id)
  if (!artifact) throw new Error(`Unknown CRRT learning artifact: ${id}`)
  return artifact
}
