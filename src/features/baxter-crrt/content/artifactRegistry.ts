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

/** Immutable pilot boundary; later learner releases must not alter phase classification. */
export const CRRT_PROTECTED_PILOT_RELEASE_ARTIFACT_IDS = Object.freeze([
  'CRRT-04',
  'CRRT-10',
  'CRRT-13',
  'prismax-aw8035-2xx',
] as const)

/** Exact artifact composition currently exposed by the protected learner runtime. */
export const CRRT_CURRENT_LEARNER_RELEASE_ARTIFACT_IDS = Object.freeze([
  ...CRRT_PROTECTED_PILOT_RELEASE_ARTIFACT_IDS,
] as const)

export const CRRT_CROSS_DEVICE_TRANSFER_ARTIFACT_IDS = Object.freeze([
  'TRANSFER-PRISMAX-PRISMAFLEX-01',
] as const)

export const CRRT_PHASE_8_SURFACE_RELEASE_ARTIFACT_IDS = Object.freeze([
  'PRISMAFLEX-CALCULATION-ADAPTER',
  'PRISMAFLEX-SETUP-NAVIGATION-WORKFLOW',
  'PRISMAFLEX-ALARM-HELP-WORKFLOW',
  'PRISMAFLEX-STOP-END-BLOOD-DISPOSITION-WORKFLOW',
  'PRISMAFLEX-LEARNER-INTERFACE',
  'TRANSFER-DOMAIN-SETUP-NAVIGATION',
  'TRANSFER-DOMAIN-PRESCRIPTION-DISPLAY',
  'TRANSFER-DOMAIN-PRESSURE-TRANSLATION',
  'TRANSFER-DOMAIN-FLUID-ACCOUNTING',
  'TRANSFER-DOMAIN-ALARM-TAXONOMY',
] as const)

export const CRRT_ACTIVATABLE_ARTIFACT_IDS = Object.freeze([
  ...CRRT_CASE_ARTIFACT_IDS,
  ...CRRT_RAPID_DRILL_ARTIFACT_IDS,
  ...CRRT_INSTRUCTIONAL_TOOL_ARTIFACT_IDS,
  ...CRRT_MASTERY_ARTIFACT_IDS,
  ...CRRT_CROSS_DEVICE_TRANSFER_ARTIFACT_IDS,
] as const)

export const CRRT_RELEASE_ARTIFACT_IDS = Object.freeze([
  ...CRRT_ACTIVATABLE_ARTIFACT_IDS,
  ...CRRT_DEVICE_PROFILE_RELEASE_ARTIFACT_IDS,
  ...CRRT_PHASE_8_SURFACE_RELEASE_ARTIFACT_IDS,
] as const)

if (new Set(CRRT_RELEASE_ARTIFACT_IDS).size !== CRRT_RELEASE_ARTIFACT_IDS.length) {
  throw new Error('CRRT release artifact IDs must be globally unique.')
}

export type CrrtCaseArtifactId = (typeof CRRT_CASE_ARTIFACT_IDS)[number]
export type CrrtRapidDrillArtifactId = (typeof CRRT_RAPID_DRILL_ARTIFACT_IDS)[number]
export type CrrtInstructionalToolArtifactId = (typeof CRRT_INSTRUCTIONAL_TOOL_ARTIFACT_IDS)[number]
export type CrrtMasteryArtifactId = (typeof CRRT_MASTERY_ARTIFACT_IDS)[number]
export type CrrtDeviceProfileReleaseArtifactId =
  (typeof CRRT_DEVICE_PROFILE_RELEASE_ARTIFACT_IDS)[number]
export type CrrtCrossDeviceTransferArtifactId =
  (typeof CRRT_CROSS_DEVICE_TRANSFER_ARTIFACT_IDS)[number]
export type CrrtPhase8SurfaceReleaseArtifactId =
  (typeof CRRT_PHASE_8_SURFACE_RELEASE_ARTIFACT_IDS)[number]
export type CrrtActivatableArtifactId = (typeof CRRT_ACTIVATABLE_ARTIFACT_IDS)[number]
export type CrrtReleaseArtifactId = (typeof CRRT_RELEASE_ARTIFACT_IDS)[number]

export type CrrtArtifactPhase = 'protected-pilot' | 'phase-7' | 'phase-8'
export type CrrtArtifactReviewScope = 'prismax' | 'phase8-cross-device'
export type CrrtConditionalReviewerDomain = 'protocol-owner' | 'pharmacy' | 'nutrition'

export interface CrrtArtifactClassification {
  readonly id: CrrtReleaseArtifactId
  readonly phase: CrrtArtifactPhase
  readonly reviewScope: CrrtArtifactReviewScope
  readonly requiredConditionalReviewerDomains: readonly CrrtConditionalReviewerDomain[]
}

const releaseArtifactIds = new Set<string>(CRRT_RELEASE_ARTIFACT_IDS)
const activatableArtifactIds = new Set<string>(CRRT_ACTIVATABLE_ARTIFACT_IDS)
const protectedPilotArtifactIds = new Set<string>(CRRT_PROTECTED_PILOT_RELEASE_ARTIFACT_IDS)
const phase8ArtifactIds = new Set<string>([
  'prismaflex-g5036003-6xx',
  'TRANSFER-PRISMAX-PRISMAFLEX-01',
  ...CRRT_PHASE_8_SURFACE_RELEASE_ARTIFACT_IDS,
])

const conditionalDomainsByArtifactId: Readonly<
  Partial<Record<CrrtReleaseArtifactId, readonly CrrtConditionalReviewerDomain[]>>
> = Object.freeze({
  'CRRT-09': Object.freeze(['protocol-owner', 'pharmacy'] as const),
  'CRRT-12': Object.freeze(['pharmacy', 'nutrition'] as const),
  'CRRT-16': Object.freeze(['protocol-owner', 'pharmacy'] as const),
  'CRRT-17': Object.freeze(['protocol-owner', 'pharmacy'] as const),
  'CRRT-18': Object.freeze(['protocol-owner'] as const),
  'DRILL-WRONG-SOLUTION': Object.freeze(['protocol-owner', 'pharmacy'] as const),
  'DRILL-BLOOD-RETURN': Object.freeze(['protocol-owner'] as const),
  'LAB-CITRATE-DASHBOARD': Object.freeze(['protocol-owner', 'pharmacy'] as const),
})

export const CRRT_ARTIFACT_CLASSIFICATIONS: readonly CrrtArtifactClassification[] = Object.freeze(
  CRRT_RELEASE_ARTIFACT_IDS.map((id) => {
    const phase: CrrtArtifactPhase = phase8ArtifactIds.has(id)
      ? 'phase-8'
      : protectedPilotArtifactIds.has(id)
        ? 'protected-pilot'
        : 'phase-7'
    return Object.freeze({
      id,
      phase,
      reviewScope: phase === 'phase-8' ? 'phase8-cross-device' : 'prismax',
      requiredConditionalReviewerDomains: conditionalDomainsByArtifactId[id] ?? Object.freeze([]),
    })
  }),
)

const classificationByArtifactId = new Map(
  CRRT_ARTIFACT_CLASSIFICATIONS.map((classification) => [classification.id, classification]),
)

export function isCrrtReleaseArtifactId(value: string): value is CrrtReleaseArtifactId {
  return releaseArtifactIds.has(value)
}

export function isCrrtActivatableArtifactId(value: string): value is CrrtActivatableArtifactId {
  return activatableArtifactIds.has(value)
}

export function getCrrtArtifactClassification(
  artifactId: string,
): CrrtArtifactClassification | null {
  if (!isCrrtReleaseArtifactId(artifactId)) return null
  return classificationByArtifactId.get(artifactId) ?? null
}

export function hasUniqueCrrtReleaseArtifactIds(
  artifactIds: readonly string[],
): artifactIds is readonly CrrtReleaseArtifactId[] {
  return (
    artifactIds.length > 0 &&
    new Set(artifactIds).size === artifactIds.length &&
    artifactIds.every(isCrrtReleaseArtifactId)
  )
}
