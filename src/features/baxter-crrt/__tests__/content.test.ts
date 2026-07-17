import {
  baxterCrrtPathways,
  baxterCrrtPublicationStatus,
  baxterCrrtReleaseReviews,
  baxterCrrtEngineSourceRecords,
  baxterCrrtSourceDocuments,
  baxterCrrtSourceRecords,
  disabledCitrateProtocolProfile,
  initialBaxterCrrtDeviceId,
  prismaflexDeferredDeviceProfile,
  prismaflexReviewCandidateDeviceProfile,
  prismaflexReviewCandidateDeviceProfileSchema,
  prismaflexSourceConflictRecords,
  prismaxDraftDeviceProfile,
  sourceReferenceSchema,
} from '../content'

describe('Baxter CRRT Phase 1 through 3 content boundaries', () => {
  it('keeps the pilot profile immutable, draft-only, and clinically bounded', () => {
    expect(baxterCrrtPublicationStatus).toBe('draft')
    expect(initialBaxterCrrtDeviceId).toBe('prismax-aw8035-2xx')
    expect(Object.isFrozen(prismaxDraftDeviceProfile)).toBe(true)
    expect(Object.isFrozen(prismaxDraftDeviceProfile.enabledTherapies)).toBe(true)
    expect(Object.isFrozen(prismaxDraftDeviceProfile.pumpAndScaleInventory)).toBe(true)
    expect(prismaxDraftDeviceProfile.availability).toBe('pilot-interface')
    expect(prismaxDraftDeviceProfile.publicationStatus).toBe('draft')
    expect(prismaxDraftDeviceProfile.enabledTherapies).toEqual([
      'CVVHD pilot interface (configuration review pending)',
    ])
    expect(prismaxDraftDeviceProfile.enabledSetsAndAccessories).toEqual([])
    expect(prismaxDraftDeviceProfile.flowRateRanges.ranges).toEqual([])
    expect(prismaxDraftDeviceProfile.flowRateIncrements).toMatchObject({
      status: 'pending-set-and-configuration-review',
      increments: [],
    })
    expect(Object.isFrozen(prismaxDraftDeviceProfile.flowRateIncrements)).toBe(true)
    expect(Object.isFrozen(prismaxDraftDeviceProfile.flowRateIncrements.increments)).toBe(true)
    expect(prismaxDraftDeviceProfile.alarmBehaviorStatus).toBe('phase-3-window-pending-mapping')
    expect(prismaxDraftDeviceProfile.deviceReviewStatus).toBe('pending')
    expect(prismaxDraftDeviceProfile.marketConfiguration).toMatch(/not established/i)
  })

  it('keeps Prismaflex deferred and every release review pending', () => {
    expect(Object.isFrozen(prismaflexDeferredDeviceProfile)).toBe(true)
    expect(prismaflexDeferredDeviceProfile).toBe(prismaflexReviewCandidateDeviceProfile)
    expect(prismaflexDeferredDeviceProfile.availability).toBe('deferred')
    expect(prismaflexDeferredDeviceProfile.publicationStatus).toBe('draft')
    expect(prismaflexDeferredDeviceProfile.enabledTherapies).toEqual([])
    expect(prismaflexDeferredDeviceProfile.enabledSetsAndAccessories).toEqual([])
    expect(prismaflexDeferredDeviceProfile.flowRateRanges.ranges).toEqual([])
    expect(prismaflexDeferredDeviceProfile.flowRateIncrements).toMatchObject({
      status: 'pending-set-and-configuration-review',
      increments: [],
    })
    expect(Object.isFrozen(prismaflexDeferredDeviceProfile.flowRateIncrements)).toBe(true)
    expect(Object.isFrozen(prismaflexDeferredDeviceProfile.flowRateIncrements.increments)).toBe(
      true,
    )
    expect(prismaflexDeferredDeviceProfile.manufacturerDisclosure).toBe('Gambro Lundia AB')
    expect(prismaflexDeferredDeviceProfile.reviewerCandidateMetadata).toMatchObject({
      status: 'reviewer-only',
      learnerRuntimeEnabled: false,
      adapterRegistrationStatus: 'not-registered-in-learner-runtime',
      targetConfigurationStatus: 'pending-local-configuration',
    })
    expect(Object.isFrozen(prismaflexDeferredDeviceProfile.reviewerCandidateMetadata)).toBe(true)
    expect(
      Object.isFrozen(
        prismaflexDeferredDeviceProfile.reviewerCandidateMetadata?.sourceDescribedTherapyFamilies,
      ),
    ).toBe(true)
    expect(Object.isFrozen(prismaflexDeferredDeviceProfile.screenVocabulary)).toBe(true)
    expect(prismaflexDeferredDeviceProfile.unresolvedFormulaGates).toEqual([])
    expect(prismaflexDeferredDeviceProfile.contextualFormulaConflicts).toEqual(['CONFLICT-010'])
    expect(prismaflexSourceConflictRecords).toEqual([
      expect.objectContaining({
        id: 'CONFLICT-010',
        sourceRecordIds: ['DEV-PF-006'],
        reviewStatus: 'pending',
      }),
    ])
    expect(
      baxterCrrtReleaseReviews.every(
        (review) =>
          review.reviewStatus === 'pending' &&
          review.reviewer === null &&
          review.exactCandidateIdentity === null &&
          review.exactVersionDisposition === null &&
          review.attestedAt === null &&
          review.attestationArtifactId === null &&
          review.attestationSha256 === null,
      ),
    ).toBe(true)
    expect(baxterCrrtReleaseReviews.map((review) => review.domain)).toEqual([
      'nephrology',
      'critical-care',
      'crrt-nurse-education',
      'prismax-device',
      'accessibility',
      'localization',
      'privacy-data-governance',
      'entitlement-security',
      'product-owner',
      'publication-approval',
    ])
  })

  it('strictly validates the fail-closed Prismaflex reviewer profile', () => {
    expect(
      prismaflexReviewCandidateDeviceProfileSchema.safeParse(prismaflexReviewCandidateDeviceProfile)
        .success,
    ).toBe(true)

    expect(
      prismaflexReviewCandidateDeviceProfileSchema.safeParse({
        ...prismaflexReviewCandidateDeviceProfile,
        unknownField: 'not permitted',
      }).success,
    ).toBe(false)
    expect(
      prismaflexReviewCandidateDeviceProfileSchema.safeParse({
        ...prismaflexReviewCandidateDeviceProfile,
        profileVersion: '',
      }).success,
    ).toBe(false)
    expect(
      prismaflexReviewCandidateDeviceProfileSchema.safeParse({
        ...prismaflexReviewCandidateDeviceProfile,
        enabledTherapies: ['CVVHDF'],
      }).success,
    ).toBe(false)

    const reviewerMetadata = prismaflexReviewCandidateDeviceProfile.reviewerCandidateMetadata
    expect(reviewerMetadata).not.toBeNull()
    expect(
      prismaflexReviewCandidateDeviceProfileSchema.safeParse({
        ...prismaflexReviewCandidateDeviceProfile,
        reviewerCandidateMetadata:
          reviewerMetadata === null ? null : { ...reviewerMetadata, learnerRuntimeEnabled: true },
      }).success,
    ).toBe(false)
  })

  it('resolves both device profiles to materialized provenance and keeps supporting sources inactive', () => {
    const recordIds = new Set([
      ...baxterCrrtSourceRecords.map((record) => record.id),
      ...baxterCrrtEngineSourceRecords.map((record) => record.id),
    ])
    for (const profile of [prismaxDraftDeviceProfile, prismaflexReviewCandidateDeviceProfile]) {
      for (const sourceRecordId of profile.sourceRecordIds) {
        expect(recordIds.has(sourceRecordId)).toBe(true)
      }
      for (const sourceRecordId of [
        ...profile.pressureCalculationSourceIds,
        ...profile.fluidCalculationSourceIds,
      ]) {
        expect(recordIds.has(sourceRecordId)).toBe(true)
      }
    }

    expect(
      baxterCrrtSourceRecords
        .filter((record) => record.id.startsWith('DEV-PF-'))
        .map((record) => record.id),
    ).toEqual([
      'DEV-PF-001',
      'DEV-PF-002',
      'DEV-PF-003',
      'DEV-PF-004',
      'DEV-PF-005',
      'DEV-PF-006',
      'DEV-PF-007',
      'DEV-PF-008',
    ])
    expect(
      baxterCrrtSourceRecords
        .filter((record) => record.id.startsWith('DEV-PF-'))
        .every((record) => record.reviewStatus === 'pending'),
    ).toBe(true)

    expect(baxterCrrtSourceDocuments).toHaveLength(3)
    expect(baxterCrrtSourceDocuments.filter((source) => source.role === 'primary')).toHaveLength(1)
    expect(
      baxterCrrtSourceDocuments
        .filter((source) => source.role !== 'primary')
        .every((source) => source.reviewStatus === 'pending'),
    ).toBe(true)
  })

  it('source-maps implemented draft calculations and keeps disputed formulas gated', () => {
    const engineRecordIds = new Set<string>(
      baxterCrrtEngineSourceRecords.map((record) => record.id),
    )
    for (const sourceId of [
      ...prismaxDraftDeviceProfile.pressureCalculationSourceIds,
      ...prismaxDraftDeviceProfile.fluidCalculationSourceIds,
    ]) {
      expect(engineRecordIds.has(sourceId)).toBe(true)
    }
    expect(prismaxDraftDeviceProfile.unresolvedFormulaGates).toEqual([
      'CONFLICT-001',
      'CONFLICT-002',
    ])
    expect(baxterCrrtEngineSourceRecords.every((record) => record.reviewStatus === 'pending')).toBe(
      true,
    )
    expect(
      baxterCrrtEngineSourceRecords.every(
        (record) => sourceReferenceSchema.safeParse(record).success,
      ),
    ).toBe(true)
    expect(engineRecordIds.has('MATH-PM-004')).toBe(true)
    expect(engineRecordIds.has('MATH-PM-006')).toBe(true)
  })

  it('keeps citrate disabled without protocol values or targets', () => {
    expect(disabledCitrateProtocolProfile).toMatchObject({
      id: 'PROTO-001',
      protocolVersion: null,
      enabled: false,
      reviewStatus: 'pending',
      parameterValues: [],
    })
  })

  it('registers Orientation, Learn, Practice, and locked Mastery only', () => {
    expect(baxterCrrtPathways.map((pathway) => pathway.id)).toEqual([
      'orientation',
      'learn',
      'practice',
      'mastery',
    ])
    expect(baxterCrrtPathways.find((pathway) => pathway.id === 'mastery')?.status).toBe('locked')
  })
})
