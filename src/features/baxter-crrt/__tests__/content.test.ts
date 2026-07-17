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
    expect(prismaxDraftDeviceProfile.enabledTherapies).toEqual([
      'CVVHD pilot interface (configuration review pending)',
    ])
    expect(prismaxDraftDeviceProfile.enabledSetsAndAccessories).toEqual([])
    expect(prismaxDraftDeviceProfile.flowRateRanges.ranges).toEqual([])
    expect(prismaxDraftDeviceProfile.alarmBehaviorStatus).toBe('phase-3-window-pending-mapping')
    expect(prismaxDraftDeviceProfile.deviceReviewStatus).toBe('pending')
    expect(prismaxDraftDeviceProfile.marketConfiguration).toMatch(/not established/i)
  })

  it('keeps Prismaflex deferred and every release review pending', () => {
    expect(Object.isFrozen(prismaflexDeferredDeviceProfile)).toBe(true)
    expect(prismaflexDeferredDeviceProfile.availability).toBe('deferred')
    expect(prismaflexDeferredDeviceProfile.enabledTherapies).toEqual([])
    expect(baxterCrrtReleaseReviews.every((review) => review.status === 'pending')).toBe(true)
  })

  it('resolves profile source IDs and keeps supporting sources inactive', () => {
    const recordIds = new Set([
      ...baxterCrrtSourceRecords.map((record) => record.id),
      ...baxterCrrtEngineSourceRecords.map((record) => record.id),
    ])
    for (const sourceRecordId of prismaxDraftDeviceProfile.sourceRecordIds) {
      expect(recordIds.has(sourceRecordId)).toBe(true)
    }

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
