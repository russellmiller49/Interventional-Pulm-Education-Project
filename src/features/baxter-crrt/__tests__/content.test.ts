import {
  baxterCrrtDeviceProfileSchema,
  baxterCrrtDeviceProfiles,
  baxterCrrtLearningArtifactRegistry,
  baxterCrrtOptionalLocalConfigurationSchema,
  baxterCrrtPathways,
  baxterCrrtPublicationStatus,
  baxterCrrtReleaseStage,
  baxterCrrtSmeReviewItems,
  baxterCrrtSourceDocuments,
  baxterCrrtSourceRecords,
  initialBaxterCrrtDeviceId,
  prismaflexDeviceProfile,
  prismaflexSourceConflictRecords,
  prismaxDeviceProfile,
} from '../content'

describe('Baxter CRRT v1 content boundaries', () => {
  it('uses one protected SME-review release state without publishing', () => {
    expect(baxterCrrtReleaseStage).toBe('sme-review')
    expect(baxterCrrtPublicationStatus).toBe('draft')
    expect(baxterCrrtSmeReviewItems).toHaveLength(4)
    expect(baxterCrrtSmeReviewItems.every(({ reviewStatus }) => reviewStatus === 'pending')).toBe(
      true,
    )
  })

  it('keeps every pending provenance record runnable in the unified private registry', () => {
    expect(baxterCrrtLearningArtifactRegistry).toHaveLength(35)
    expect(
      baxterCrrtLearningArtifactRegistry.reduce<Record<string, number>>((counts, artifact) => {
        counts[artifact.kind] = (counts[artifact.kind] ?? 0) + 1
        return counts
      }, {}),
    ).toEqual({
      case: 18,
      'rapid-drill': 7,
      'instructional-tool': 6,
      mastery: 1,
      'device-profile': 2,
      'cross-device-transfer': 1,
    })
    expect(
      baxterCrrtLearningArtifactRegistry.every(
        ({ reviewStatus, runtimeAvailable, releaseStage }) =>
          reviewStatus === 'pending' && runtimeAvailable && releaseStage === 'sme-review',
      ),
    ).toBe(true)
  })

  it('exposes two immutable manual-reference learner profiles', () => {
    expect(initialBaxterCrrtDeviceId).toBe('prismax-aw8035-2xx')
    expect(baxterCrrtDeviceProfiles.map(({ id }) => id)).toEqual([
      'prismax-aw8035-2xx',
      'prismaflex-g5036003-6xx',
    ])

    for (const profile of baxterCrrtDeviceProfiles) {
      expect(baxterCrrtDeviceProfileSchema.safeParse(profile).success).toBe(true)
      expect(profile.profileKind).toBe('manual-reference')
      expect(profile.localConfiguration).toBeNull()
      expect(profile.availability).toBe('learner-runtime')
      expect(profile.supportedModalities).toEqual(['SCUF', 'CVVH', 'CVVHD', 'CVVHDF'])
      expect(profile.referenceMetadata.learnerRuntimeEnabled).toBe(true)
      expect(profile.referenceMetadata.adapterRegistrationStatus).toBe('registered')
      expect(profile.marketConfiguration).toMatch(/not .*local|not a local/i)
      expect(Object.isFrozen(profile)).toBe(true)
      expect(Object.isFrozen(profile.supportedModalities)).toBe(true)
      expect(Object.isFrozen(profile.screenVocabulary)).toBe(true)
    }

    expect(prismaxDeviceProfile.unresolvedFormulaGates).toEqual(['CONFLICT-001', 'CONFLICT-002'])
    expect(prismaflexDeviceProfile.contextualFormulaConflicts).toEqual(['CONFLICT-010'])
  })

  it('strictly validates optional local extensions without supplying one by default', () => {
    const localExtension = {
      kind: 'local-extension',
      id: 'example-site-prismax',
      version: '1.0.0',
      baseDeviceId: 'prismax-aw8035-2xx',
      displayLabel: 'Example site profile',
      enabledModalities: ['CVVHD'],
      setLabels: ['Locally verified set'],
      solutionLabels: ['Locally verified solution'],
      sourceRecordIds: ['LOCAL-EXAMPLE-001'],
    }
    expect(baxterCrrtOptionalLocalConfigurationSchema.safeParse(localExtension).success).toBe(true)
    expect(
      baxterCrrtOptionalLocalConfigurationSchema.safeParse({
        ...localExtension,
        unknownField: true,
      }).success,
    ).toBe(false)
  })

  it('keeps source identity, limitations, and known formula conflicts visible', () => {
    expect(baxterCrrtSourceDocuments.some(({ id }) => id === 'PRISMAX-AW8035-RB')).toBe(true)
    expect(baxterCrrtSourceDocuments.some(({ id }) => id === 'PRISMAFLEX-G5036003-R05')).toBe(true)
    expect(baxterCrrtSourceRecords.length).toBeGreaterThan(0)
    expect(prismaflexSourceConflictRecords).toEqual([
      expect.objectContaining({ id: 'CONFLICT-010', sourceRecordIds: ['DEV-PF-006'] }),
    ])
  })

  it('retains the four progressive learning pathways', () => {
    expect(baxterCrrtPathways.map(({ id }) => id)).toEqual([
      'orientation',
      'learn',
      'practice',
      'mastery',
    ])
  })
})
