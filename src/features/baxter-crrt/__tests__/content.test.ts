import {
  baxterCrrtDeviceProfileSchema,
  baxterCrrtDeviceProfiles,
  baxterCrrtInstructionalToolManifest,
  baxterCrrtLearningArtifactRegistry,
  baxterCrrtOptionalLocalConfigurationSchema,
  baxterCrrtPublicationStatus,
  baxterCrrtReleaseStage,
  baxterCrrtSmeReviewItems,
  baxterCrrtSourceDocuments,
  baxterCrrtSourceRecords,
  initialBaxterCrrtDeviceId,
  prismaxDeviceProfile,
} from '../content'

describe('Baxter CRRT rebuilt content boundaries', () => {
  it('stays protected in SME review', () => {
    expect(baxterCrrtReleaseStage).toBe('sme-review')
    expect(baxterCrrtPublicationStatus).toBe('draft')
    expect(baxterCrrtSmeReviewItems).toHaveLength(4)
    expect(baxterCrrtSmeReviewItems.every(({ reviewStatus }) => reviewStatus === 'pending')).toBe(
      true,
    )
  })

  it('curates the runtime artifacts to PrisMax, five drills, and two embedded labs', () => {
    expect(baxterCrrtLearningArtifactRegistry).toHaveLength(27)
    expect(
      baxterCrrtLearningArtifactRegistry.reduce<Record<string, number>>((counts, artifact) => {
        counts[artifact.kind] = (counts[artifact.kind] ?? 0) + 1
        return counts
      }, {}),
    ).toEqual({
      case: 18,
      'rapid-drill': 5,
      'instructional-tool': 2,
      mastery: 1,
      'device-profile': 1,
    })
    expect(baxterCrrtInstructionalToolManifest.map(({ id }) => id)).toEqual([
      'LAB-PRESCRIPTION',
      'LAB-PRESSURE-LOCALIZATION',
    ])
  })

  it('exposes one immutable PrisMax learner profile', () => {
    expect(initialBaxterCrrtDeviceId).toBe('prismax-aw8035-2xx')
    expect(baxterCrrtDeviceProfiles).toEqual([prismaxDeviceProfile])
    expect(baxterCrrtDeviceProfileSchema.safeParse(prismaxDeviceProfile).success).toBe(true)
    expect(prismaxDeviceProfile.supportedModalities).toEqual(['SCUF', 'CVVH', 'CVVHD', 'CVVHDF'])
    expect(prismaxDeviceProfile.unresolvedFormulaGates).toEqual(['CONFLICT-001', 'CONFLICT-002'])
    expect(Object.isFrozen(prismaxDeviceProfile)).toBe(true)
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
      baxterCrrtOptionalLocalConfigurationSchema.safeParse({ ...localExtension, unknown: true })
        .success,
    ).toBe(false)
  })

  it('retains complete provenance while limiting runtime behavior to PrisMax', () => {
    expect(baxterCrrtSourceDocuments.some(({ id }) => id === 'PRISMAX-AW8035-RB')).toBe(true)
    expect(baxterCrrtSourceDocuments.some(({ id }) => id === 'PRISMAFLEX-G5036003-R05')).toBe(true)
    expect(baxterCrrtSourceRecords.length).toBeGreaterThan(0)
  })
})
