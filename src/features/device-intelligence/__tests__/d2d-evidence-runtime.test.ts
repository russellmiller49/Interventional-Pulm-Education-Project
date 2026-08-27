import type {
  D2dProductEvidence,
  ReviewedProductProfile,
  ReviewedProductRegulatoryEvidence,
} from '@/features/device-intelligence/server/d2d-evidence.server'

const runtime = jest.requireActual(
  '@/features/device-intelligence/server/d2d-evidence.server',
) as typeof import('@/features/device-intelligence/server/d2d-evidence.server')

const PILOT_PRODUCT_IDS = [
  'PRD-003C4641E6',
  'PRD-05670F1B5F',
  'PRD-1ED27ADA45',
  'PRD-2632FFBF07',
  'PRD-3E1556EBE5',
  'PRD-6F15A8C9B5',
  'PRD-A0655BF464',
  'PRD-AED3720BF6',
  'PRD-B76AF3D731',
  'PRD-F4AE2A74E6',
] as const

interface RuntimeSourceReference {
  readonly source_id: string
  readonly locator: string
}

function profileReferences(profile: ReviewedProductProfile): RuntimeSourceReference[] {
  const records = [
    ...profile.summary_claims,
    profile.physical_device_type,
    profile.intended_function,
    profile.exact_configuration_summary,
    ...profile.key_specifications,
  ].filter((record): record is NonNullable<typeof record> => record !== null)
  return records.flatMap((record) => [...record.source_refs])
}

function regulatoryReferences(
  regulatory: ReviewedProductRegulatoryEvidence,
): RuntimeSourceReference[] {
  return [
    ...regulatory.udi_identities,
    ...regulatory.classifications,
    ...regulatory.pathways,
    ...regulatory.registration_listing_evidence,
    ...regulatory.commercial_distribution_evidence,
  ].flatMap((record) => [...record.source_refs])
}

function expectOnlyReferencedSources(
  view: ReviewedProductProfile | ReviewedProductRegulatoryEvidence,
  references: readonly RuntimeSourceReference[],
) {
  const expectedIds = [...new Set(references.map((reference) => reference.source_id))]
  expect(view.sources.map((source) => source.source_id)).toEqual(expectedIds)

  for (const source of view.sources) {
    expect(Object.keys(source).sort()).toEqual([
      'governed_source_id',
      'locators',
      'official_url',
      'organization',
      'snapshot_date',
      'source_id',
      'source_kind',
      'title',
    ])
    expect(source.locators).toEqual([
      ...new Set(
        references
          .filter((reference) => reference.source_id === source.source_id)
          .map((reference) => reference.locator),
      ),
    ])
  }
}

describe('D2D-B reviewed evidence runtime reader', () => {
  it('strict-parses each overlay once at module initialization, never once per lookup', () => {
    jest.isolateModules(() => {
      const profileSchemaModule = jest.requireActual(
        '@/features/device-intelligence/domain/profile-overlay-schema',
      ) as typeof import('@/features/device-intelligence/domain/profile-overlay-schema')
      const regulatorySchemaModule = jest.requireActual(
        '@/features/device-intelligence/domain/regulatory-overlay-schema',
      ) as typeof import('@/features/device-intelligence/domain/regulatory-overlay-schema')
      const profileParse = jest.spyOn(profileSchemaModule.profileOverlayArtifactSchema, 'parse')
      const regulatoryParse = jest.spyOn(
        regulatorySchemaModule.regulatoryOverlayArtifactSchema,
        'parse',
      )

      const isolatedRuntime = jest.requireActual(
        '@/features/device-intelligence/server/d2d-evidence.server',
      ) as typeof import('@/features/device-intelligence/server/d2d-evidence.server')

      expect(profileParse).toHaveBeenCalledTimes(1)
      expect(regulatoryParse).toHaveBeenCalledTimes(1)

      for (const productId of PILOT_PRODUCT_IDS) {
        isolatedRuntime.getReviewedProductProfile(productId)
        isolatedRuntime.getReviewedProductRegulatoryEvidence(productId)
        isolatedRuntime.getD2dProductEvidence(productId)
        isolatedRuntime.getD2dProductEvidence(productId)
      }

      expect(profileParse).toHaveBeenCalledTimes(1)
      expect(regulatoryParse).toHaveBeenCalledTimes(1)
    })
  })

  it('resolves both reviewed views for exactly all ten pilot product IDs', () => {
    for (const productId of PILOT_PRODUCT_IDS) {
      const profile = runtime.getReviewedProductProfile(productId)
      const regulatory = runtime.getReviewedProductRegulatoryEvidence(productId)
      const evidence = runtime.getD2dProductEvidence(productId)
      expect({
        productId,
        profileId: profile?.product_id,
        regulatoryId: regulatory?.product_id,
      }).toEqual({ productId, profileId: productId, regulatoryId: productId })
      expect(evidence).toEqual({ profile, regulatoryEvidence: regulatory })
      expect(evidence?.profile).toBe(profile)
      expect(evidence?.regulatoryEvidence).toBe(regulatory)
    }
  })

  it('returns null outside the pilot and never synthesizes an enrichment row', () => {
    // A real verified-source Atlas product outside the D2D pilot.
    const nonpilotProductId = 'PRD-88E003F12B'
    expect(runtime.getReviewedProductProfile(nonpilotProductId)).toBeNull()
    expect(runtime.getReviewedProductRegulatoryEvidence(nonpilotProductId)).toBeNull()
    expect(runtime.getD2dProductEvidence(nonpilotProductId)).toBeNull()
    expect(runtime.getD2dProductEvidence('PRD-NOTAREALPRODUCT')).toBeNull()
  })

  it('returns stable, deeply frozen views with governed internals removed', () => {
    const productId = 'PRD-A0655BF464'
    const first = runtime.getD2dProductEvidence(productId) as D2dProductEvidence
    const second = runtime.getD2dProductEvidence(productId) as D2dProductEvidence
    expect(second).toBe(first)
    expect(runtime.getReviewedProductProfile(productId)).toBe(first.profile)
    expect(runtime.getReviewedProductRegulatoryEvidence(productId)).toBe(first.regulatoryEvidence)

    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.profile)).toBe(true)
    expect(Object.isFrozen(first.profile?.summary_claims)).toBe(true)
    expect(Object.isFrozen(first.profile?.summary_claims[0].source_refs)).toBe(true)
    expect(Object.isFrozen(first.profile?.sources)).toBe(true)
    expect(Object.isFrozen(first.profile?.sources[0].locators)).toBe(true)
    expect(Object.isFrozen(first.regulatoryEvidence)).toBe(true)
    expect(Object.isFrozen(first.regulatoryEvidence?.udi_identities)).toBe(true)
    expect(Reflect.set(first, 'profile', null)).toBe(false)

    const serialized = JSON.stringify(first)
    expect(serialized).not.toMatch(
      /review_id|content_sha256|source_artifacts|artifact_kind|method_version|row_scope|D2D-Q-|request skip|record keys|search=/i,
    )
  })

  it("projects only each selected product's cited sources and deduplicates exact locators", () => {
    for (const productId of PILOT_PRODUCT_IDS) {
      const profile = runtime.getReviewedProductProfile(productId)!
      const regulatory = runtime.getReviewedProductRegulatoryEvidence(productId)!
      expectOnlyReferencedSources(profile, profileReferences(profile))
      expectOnlyReferencedSources(regulatory, regulatoryReferences(regulatory))
    }

    const clr = runtime.getReviewedProductProfile('PRD-003C4641E6')!
    expect(clr.sources.map((source) => source.source_id)).toEqual([
      'D2D-SRC-089-001',
      'D2D-SRC-103-013',
    ])
    expect(clr.sources[0].locators).toEqual(['Rendered PDF page 6, CLR Irrigator panel'])
    expect(clr.sources[1].locators).toEqual(['CLR Irrigator IFU LBL S012-01-203 Rev D'])
    // Unresolved rows contain no evidence records, so they carry no unused source registry rows.
    expect(runtime.getReviewedProductRegulatoryEvidence('PRD-3E1556EBE5')!.sources).toEqual([])

    const storz = runtime.getReviewedProductRegulatoryEvidence('PRD-A0655BF464')!
    expect(storz.udi_identities[0].source_refs[0].locator).toBe('Primary DI 04048551046692')
    expect(storz.sources[0]).toEqual(
      expect.objectContaining({
        title: 'openFDA device UDI record',
        locators: [
          'Primary DI 04048551046692',
          'Primary DI 04048551046692; commercial-distribution record as of 2026-08-24',
        ],
      }),
    )
    expect(new URL(storz.sources[0].official_url!).pathname).toBe('/device/udi.json')
    expect(new URL(storz.sources[0].official_url!).search).toBe('')

    const narwhal = runtime.getReviewedProductRegulatoryEvidence('PRD-AED3720BF6')!
    expect(narwhal.sources[0]).toEqual(
      expect.objectContaining({
        title: 'openFDA device 510(k) record',
        locators: ['Product code GEH; regulation 878.4350', 'Premarket submission K261068'],
      }),
    )
    expect(new URL(narwhal.sources[0].official_url!).pathname).toBe('/device/510k.json')
    expect(new URL(narwhal.sources[0].official_url!).search).toBe('')
  })
})
