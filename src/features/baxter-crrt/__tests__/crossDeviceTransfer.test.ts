import {
  BAXTER_CRRT_CROSS_DEVICE_TRANSFER_DOMAIN_IDS,
  baxterCrrtCrossDeviceTransferAvailable,
  baxterCrrtCrossDeviceTransferManifest,
  baxterCrrtCrossDeviceTransferManifestSchema,
} from '../content/crossDeviceTransfer'

describe('cross-device transfer reviewer manifest', () => {
  it('maps the complete reviewer comparison plan without creating a runtime', () => {
    expect(baxterCrrtCrossDeviceTransferManifest.domains.map((domain) => domain.id)).toEqual(
      BAXTER_CRRT_CROSS_DEVICE_TRANSFER_DOMAIN_IDS,
    )
    expect(baxterCrrtCrossDeviceTransferManifest.runtimeCaseIds).toEqual([])
    expect(baxterCrrtCrossDeviceTransferManifest.outcomeTolerance).toBeNull()
    expect(baxterCrrtCrossDeviceTransferManifest.learnerRuntimeEnabled).toBe(false)
    expect(baxterCrrtCrossDeviceTransferManifest.scoringAvailable).toBe(false)
    expect(baxterCrrtCrossDeviceTransferManifest.progressPersistenceAvailable).toBe(false)
    expect(baxterCrrtCrossDeviceTransferManifest.competencyAvailable).toBe(false)
    expect(baxterCrrtCrossDeviceTransferAvailable).toBe(false)
  })

  it('preserves separate device identities and unresolved calculation context', () => {
    expect(baxterCrrtCrossDeviceTransferManifest.prismaxDeviceId).toBe('prismax-aw8035-2xx')
    expect(baxterCrrtCrossDeviceTransferManifest.prismaflexDeviceId).toBe('prismaflex-g5036003-6xx')
    expect(baxterCrrtCrossDeviceTransferManifest.sourceRecordIds).toContain('CONFLICT-010')
    expect(
      baxterCrrtCrossDeviceTransferManifest.domains.find(
        (domain) => domain.id === 'prescription-display',
      )?.equivalenceBoundary,
    ).toMatch(/No cross-device numeric equivalence tolerance is approved/)
  })

  it('keeps every prerequisite unsatisfied and freezes nested content', () => {
    expect(baxterCrrtCrossDeviceTransferManifest.prerequisites).toHaveLength(5)
    expect(
      baxterCrrtCrossDeviceTransferManifest.prerequisites.every(
        (prerequisite) => prerequisite.satisfied === false,
      ),
    ).toBe(true)
    expect(Object.isFrozen(baxterCrrtCrossDeviceTransferManifest)).toBe(true)
    expect(Object.isFrozen(baxterCrrtCrossDeviceTransferManifest.domains)).toBe(true)
    expect(Object.isFrozen(baxterCrrtCrossDeviceTransferManifest.domains[0])).toBe(true)
    expect(Object.isFrozen(baxterCrrtCrossDeviceTransferManifest.domains[0]?.sourceRecordIds)).toBe(
      true,
    )
    expect(Object.isFrozen(baxterCrrtCrossDeviceTransferManifest.prerequisites[0])).toBe(true)
  })

  it('strictly validates the fail-closed transfer composition plan', () => {
    expect(
      baxterCrrtCrossDeviceTransferManifestSchema.safeParse(baxterCrrtCrossDeviceTransferManifest)
        .success,
    ).toBe(true)

    expect(
      baxterCrrtCrossDeviceTransferManifestSchema.safeParse({
        ...baxterCrrtCrossDeviceTransferManifest,
        unknownField: 'not permitted',
      }).success,
    ).toBe(false)
    expect(
      baxterCrrtCrossDeviceTransferManifestSchema.safeParse({
        ...baxterCrrtCrossDeviceTransferManifest,
        outcomeTolerance: 0.01,
      }).success,
    ).toBe(false)
    expect(
      baxterCrrtCrossDeviceTransferManifestSchema.safeParse({
        ...baxterCrrtCrossDeviceTransferManifest,
        runtimeCaseIds: ['CRRT-04'],
      }).success,
    ).toBe(false)
    expect(
      baxterCrrtCrossDeviceTransferManifestSchema.safeParse({
        ...baxterCrrtCrossDeviceTransferManifest,
        prerequisites: baxterCrrtCrossDeviceTransferManifest.prerequisites.map(
          (prerequisite, index) =>
            index === 0 ? { ...prerequisite, satisfied: true } : prerequisite,
        ),
      }).success,
    ).toBe(false)
    expect(
      baxterCrrtCrossDeviceTransferManifestSchema.safeParse({
        ...baxterCrrtCrossDeviceTransferManifest,
        sourceRecordIds: baxterCrrtCrossDeviceTransferManifest.sourceRecordIds.slice(1),
      }).success,
    ).toBe(false)
  })
})
