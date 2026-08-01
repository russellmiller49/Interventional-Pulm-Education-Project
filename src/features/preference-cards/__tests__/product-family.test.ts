import {
  getApprovedProductFamiliesForRole,
  getReviewedProductFamilyVersion,
  getReviewedProductFamilyVersions,
  resolveProductFamilyPin,
} from '../data/product-families.server'
import { getCurrentReleaseBundleForScenario } from '../data/release-bundles.server'
import {
  defaultBuildInput,
  getComposedRecipeSlots,
  getScenarioDefinition,
} from '../data/demo-context.server'
import {
  assertProductFamilySelectableForNewCard,
  computeReviewedProductFamilyVersion,
  productFamilyDefinitionHash,
  resolveReviewedProductFamily,
  validateProductFamilyLedger,
  type ReviewedProductFamilyVersion,
} from '../domain/product-family'
import { familyPickId } from '../domain/size-at-procedure'
import {
  BUILDER_INPUTS_SCHEMA_VERSION,
  builderInputsSchema,
  carriesUnreconcilableFamilyIdentity,
  saveCardRequestSchema,
} from '../schemas/saved-card'
import { rebuildBuilderContext } from '../server/rebuild-builder-context'
import { resolveForSave } from '../server/user-cards'

/**
 * Reviewed product families: the identity a card may persist, and the grouping it may not.
 *
 * The discovery grouping is a good picker and a bad identity. It over-merges — nine Argyle chest
 * tubes from 16 Fr to 40 Fr plus a right-angle share one key — and it is recomputed from mutable
 * labels, so what a saved card *means* changes when a subcategory is edited. Everything below is
 * about keeping the two apart: what may be shown, what may be saved, and what happens to a card
 * that already recorded the wrong one.
 */

const STENT_ROLE = 'AIRWAY_STENT_SILICONE_STRAIGHT'
const SCENARIO_ID = 'rigid-bronch'
const GENERATED_AT = '2026-08-01T12:00:00.000Z'

function approvedStentFamily(): ReviewedProductFamilyVersion {
  const [version] = getApprovedProductFamiliesForRole(STENT_ROLE)
  expect(version).toBeDefined()
  return version
}

function fixtureVersion(
  overrides: Partial<Omit<ReviewedProductFamilyVersion, 'definitionHash'>> = {},
): ReviewedProductFamilyVersion {
  return computeReviewedProductFamilyVersion({
    productFamilyVersionId: 'family-fixture-line-v1-0',
    productFamilyCode: 'FIXTURE_LINE',
    version: '1.0',
    catalogReleaseId: 'a'.repeat(64),
    roleCodes: [STENT_ROLE],
    displayName: 'Fixture Line',
    manufacturerGroupId: 'MFR-FIXTURE',
    manufacturerDisplay: 'Fixture Devices',
    memberProductIds: ['PRD-FIXTUREAA', 'PRD-FIXTUREBB'],
    governanceState: 'approved',
    supersedesProductFamilyVersionId: null,
    reviewBasis: 'Synthetic fixture.',
    approvedAt: '2026-01-01T00:00:00.000Z',
    retiredAt: null,
    ...overrides,
  })
}

/** A save request for the rigid-bronchoscopy card with the given family selections. */
function saveRequestWithFamilies(
  families: Array<{ version: ReviewedProductFamilyVersion; roleCode: string }>,
) {
  const definition = getScenarioDefinition(SCENARIO_ID)!
  const composedSlots = getComposedRecipeSlots(SCENARIO_ID)
  const input = defaultBuildInput(SCENARIO_ID)
  input.selectedHospitalItemIds = {
    ...input.selectedHospitalItemIds,
    ...Object.fromEntries(
      families.map(({ version, roleCode }) => {
        const slot = composedSlots.find((candidate) => candidate.roleCode === roleCode)
        expect(slot).toBeDefined()
        return [slot!.id, familyPickId(version.productFamilyVersionId)]
      }),
    ),
  }
  return {
    schemaVersion: BUILDER_INPUTS_SCHEMA_VERSION,
    releaseBundleId: getCurrentReleaseBundleForScenario(SCENARIO_ID)!.id,
    scenarioId: SCENARIO_ID,
    title: 'Family identity test',
    physicianName: null,
    status: 'draft' as const,
    input: { ...input, recipeVersionId: definition.recipeVersionId },
    catalogPicks: [],
    familyPicks: families.map(({ version, roleCode }) => ({
      productFamilyVersionId: version.productFamilyVersionId,
      catalogReleaseId: version.catalogReleaseId,
      definitionHash: version.definitionHash,
      roleCode,
    })),
    customItems: [],
    equipmentSets: [],
  }
}

describe('the seeded reviewed families', () => {
  it('are all approved, hashed, and pinned to a catalog release', () => {
    const versions = getReviewedProductFamilyVersions()
    expect(versions.length).toBeGreaterThan(0)
    for (const version of versions) {
      expect(version.definitionHash).toBe(productFamilyDefinitionHash(version))
      expect(version.catalogReleaseId).toMatch(/^[a-f0-9]{64}$/)
      expect(version.memberProductIds.length).toBeGreaterThan(1)
      expect(version.reviewBasis.trim().length).toBeGreaterThan(0)
    }
  })

  it('leave the mixed-coverage Micro-Tech groupings unreviewed rather than approving them', () => {
    // Two brand families mix fully-covered and partially-covered variants within one role. Those
    // are different devices to the person picking one, so no reviewed family claims them and the
    // picker offers the individual sizes instead.
    const codes = getReviewedProductFamilyVersions().map((version) => version.productFamilyCode)
    expect(codes).not.toContain(
      'MICRO_TECH_ENDOSCOPY_MICRO_TECH_TRACHEAL_STENT__AIRWAY_STENT_SEMS_COVERED',
    )
    expect(codes).not.toContain(
      'MICRO_TECH_ENDOSCOPY_MICRO_TECH_Y_SHAPED_TRACHEAL_STENT__AIRWAY_STENT_SEMS_COVERED',
    )
  })

  it('scope membership by role, so one brand family serving two roles is two families', () => {
    // Novatech GSS covers both the straight and the Y stent requirements, and the discovery
    // grouping merged them.
    const straight = getApprovedProductFamiliesForRole('AIRWAY_STENT_SILICONE_STRAIGHT').find(
      (version) => version.productFamilyCode.startsWith('NOVATECH_GSS'),
    )
    const bifurcation = getApprovedProductFamiliesForRole('AIRWAY_STENT_SILICONE_Y').find(
      (version) => version.productFamilyCode.startsWith('NOVATECH_GSS'),
    )
    expect(straight).toBeDefined()
    expect(bifurcation).toBeDefined()
    expect(straight!.productFamilyVersionId).not.toBe(bifurcation!.productFamilyVersionId)
    expect(straight!.memberProductIds).not.toEqual(bifurcation!.memberProductIds)
  })

  it('offers none for a role that has no reviewed line', () => {
    // Chest tubes are the other known over-merge and are deliberately not seeded.
    expect(getApprovedProductFamiliesForRole('CHEST_TUBE_SURGICAL')).toEqual([])
  })
})

describe('a discovery grouping cannot become a card selection', () => {
  it('is rejected by the current builder-input schema', () => {
    const request = saveRequestWithFamilies([])
    const parsed = saveCardRequestSchema.safeParse({
      ...request,
      familyPicks: [{ familyKey: 'MFR-X|surgical chest tube|candidate', roleCode: STENT_ROLE }],
    })
    expect(parsed.success).toBe(false)
  })

  it('is refused at reconstruction even if it reached storage', () => {
    // Belt and braces: the schema is the wall, and the rebuild path does not assume the wall held.
    const inputs = builderInputsSchema.parse({
      ...saveRequestWithFamilies([]),
      schemaVersion: 3,
      familyPicks: [{ familyKey: 'MFR-X|surgical chest tube|candidate', roleCode: STENT_ROLE }],
    })
    const rebuilt = rebuildBuilderContext(inputs, GENERATED_AT)
    expect(rebuilt.ok).toBe(false)
    if (!rebuilt.ok) expect(rebuilt.code).toBe('legacy_family_identity')
  })

  it('is never mapped to a reviewed family by label, manufacturer, or role', () => {
    // The one thing that would make an old card openable is a lookup from key to family, and there
    // is no such function. This asserts the absence at the level that matters: an input carrying a
    // key is refused rather than resolved, whatever a reviewed family for the same role looks like.
    expect(getApprovedProductFamiliesForRole(STENT_ROLE).length).toBeGreaterThan(0)
    expect(
      carriesUnreconcilableFamilyIdentity({
        schemaVersion: 3,
        familyPicks: [{ familyKey: 'anything at all', roleCode: STENT_ROLE }],
      }),
    ).toBe(true)
  })

  it('leaves a version-3 card without a family selection fully editable', () => {
    // The refusal is scoped to the ambiguity. Most version-3 cards never selected a line, and
    // closing the builder to those would punish them for a field they did not use.
    expect(carriesUnreconcilableFamilyIdentity({ schemaVersion: 3, familyPicks: [] })).toBe(false)
    expect(carriesUnreconcilableFamilyIdentity({ schemaVersion: 3 })).toBe(false)
  })
})

describe('a reviewed family can be persisted and reopened', () => {
  it('saves and rebuilds from the four-field pin', () => {
    const version = approvedStentFamily()
    const request = saveCardRequestSchema.parse(
      saveRequestWithFamilies([{ version, roleCode: STENT_ROLE }]),
    )

    const saved = resolveForSave(request, GENERATED_AT)
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.rebuilt.familyPicks).toHaveLength(1)
    expect(saved.rebuilt.familyPicks[0].productFamilyVersionId).toBe(version.productFamilyVersionId)
    expect(saved.rebuilt.familyPicks[0].definitionHash).toBe(version.definitionHash)

    // Reopening runs the same reconstruction, so what opens is what would be stored.
    const reopened = rebuildBuilderContext(builderInputsSchema.parse(request), GENERATED_AT)
    expect(reopened.ok).toBe(true)
    if (reopened.ok) {
      expect(reopened.familyPicks[0].productFamilyVersionId).toBe(version.productFamilyVersionId)
      expect(reopened.familyPicks[0].variantCount).toBe(version.memberProductIds.length)
    }
  })

  it('rebuilds the family from the pinned catalog release, not from today’s catalog', () => {
    const version = approvedStentFamily()
    const request = saveCardRequestSchema.parse(
      saveRequestWithFamilies([{ version, roleCode: STENT_ROLE }]),
    )
    const rebuilt = rebuildBuilderContext(builderInputsSchema.parse(request), GENERATED_AT)
    expect(rebuilt.ok).toBe(true)
    if (!rebuilt.ok) return
    expect(rebuilt.historicalCatalog.catalogReleaseId).toBe(version.catalogReleaseId)
  })

  it('refuses a pin whose membership hash no longer matches', () => {
    const version = approvedStentFamily()
    const request = saveRequestWithFamilies([{ version, roleCode: STENT_ROLE }])
    const tampered = builderInputsSchema.parse({
      ...request,
      familyPicks: [{ ...request.familyPicks[0], definitionHash: 'c'.repeat(64) }],
    })

    const rebuilt = rebuildBuilderContext(tampered, GENERATED_AT)
    expect(rebuilt.ok).toBe(false)
    if (!rebuilt.ok) expect(rebuilt.code).toBe('product_family_unavailable')
  })

  it('refuses a pin naming a role the family does not serve', () => {
    const version = approvedStentFamily()
    const resolved = resolveProductFamilyPin({
      productFamilyVersionId: version.productFamilyVersionId,
      catalogReleaseId: version.catalogReleaseId,
      definitionHash: version.definitionHash,
      roleCode: 'CHEST_TUBE_SURGICAL',
    })
    expect(resolved.ok).toBe(false)
    if (!resolved.ok) expect(resolved.code).toBe('product_family_role_not_covered')
  })

  it('refuses a pin naming a catalog release the family was not reviewed against', () => {
    const version = approvedStentFamily()
    const resolved = resolveProductFamilyPin({
      productFamilyVersionId: version.productFamilyVersionId,
      catalogReleaseId: 'd'.repeat(64),
      definitionHash: version.definitionHash,
      roleCode: STENT_ROLE,
    })
    expect(resolved.ok).toBe(false)
    if (!resolved.ok) expect(resolved.code).toBe('product_family_catalog_release_mismatch')
  })

  it('refuses a pin naming a family that is not retained', () => {
    expect(getReviewedProductFamilyVersion('family-does-not-exist-v1-0')).toBeNull()
    const resolved = resolveProductFamilyPin({
      productFamilyVersionId: 'family-does-not-exist-v1-0',
      catalogReleaseId: 'a'.repeat(64),
      definitionHash: 'b'.repeat(64),
      roleCode: STENT_ROLE,
    })
    expect(resolved.ok).toBe(false)
    if (!resolved.ok) expect(resolved.code).toBe('product_family_unknown')
  })
})

describe('membership immutability and versioning', () => {
  it('fails validation when a published membership is edited in place', () => {
    const version = fixtureVersion()
    const mutated = { ...version, memberProductIds: [...version.memberProductIds, 'PRD-FIXTURECC'] }

    const codes = validateProductFamilyLedger({
      ledger: { formatVersion: '1.0', hashVersion: 'x', versions: [mutated] },
    }).map((message) => message.code)
    expect(codes).toContain('product_family_definition_mutated')
  })

  it('fails validation when the current catalog re-derives a different membership', () => {
    const version = fixtureVersion()
    const codes = validateProductFamilyLedger({
      ledger: { formatVersion: '1.0', hashVersion: 'x', versions: [version] },
      rederivedMembership: new Map([
        [version.productFamilyVersionId, ['PRD-FIXTUREAA', 'PRD-FIXTUREBB', 'PRD-FIXTURECC']],
      ]),
    }).map((message) => message.code)
    expect(codes).toContain('product_family_membership_diverged')
  })

  it('fails validation when a member is not in the family’s own catalog release', () => {
    const version = fixtureVersion()
    const codes = validateProductFamilyLedger({
      ledger: { formatVersion: '1.0', hashVersion: 'x', versions: [version] },
      catalogReleaseMembership: new Map([
        [
          version.catalogReleaseId,
          {
            productIds: new Set(['PRD-FIXTUREAA']),
            rolesByProductId: new Map([['PRD-FIXTUREAA', new Set([STENT_ROLE])]]),
          },
        ],
      ]),
    }).map((message) => message.code)
    expect(codes).toContain('product_family_member_not_in_catalog_release')
  })

  it('lets two versions of one family code coexist, addressed by exact version id', () => {
    const v1 = fixtureVersion()
    const v2 = fixtureVersion({
      productFamilyVersionId: 'family-fixture-line-v2-0',
      version: '2.0',
      memberProductIds: ['PRD-FIXTUREAA'],
      supersedesProductFamilyVersionId: v1.productFamilyVersionId,
      governanceState: 'approved',
    })
    const retired = {
      ...v1,
      governanceState: 'retired' as const,
      retiredAt: '2026-02-01T00:00:00.000Z',
    }

    const problems = validateProductFamilyLedger({
      ledger: { formatVersion: '1.0', hashVersion: 'x', versions: [retired, v2] },
    })
    expect(problems).toEqual([])
    expect(retired.definitionHash).not.toBe(v2.definitionHash)
    // Retiring did not move the hash — lifecycle is outside the definition.
    expect(retired.definitionHash).toBe(v1.definitionHash)
  })

  it('fails when a new version supersedes a different family code', () => {
    const v1 = fixtureVersion()
    const other = fixtureVersion({
      productFamilyVersionId: 'family-other-line-v1-0',
      productFamilyCode: 'OTHER_LINE',
      supersedesProductFamilyVersionId: v1.productFamilyVersionId,
    })
    const codes = validateProductFamilyLedger({
      ledger: { formatVersion: '1.0', hashVersion: 'x', versions: [v1, other] },
    }).map((message) => message.code)
    expect(codes).toContain('product_family_supersedes_code_mismatch')
  })
})

describe('retirement', () => {
  it('keeps a retired family reconstructable', () => {
    const retired = fixtureVersion({
      governanceState: 'retired',
      retiredAt: '2026-02-01T00:00:00.000Z',
    })
    const resolved = resolveReviewedProductFamily(
      {
        productFamilyVersionId: retired.productFamilyVersionId,
        catalogReleaseId: retired.catalogReleaseId,
        definitionHash: retired.definitionHash,
        roleCode: STENT_ROLE,
      },
      new Map([[retired.productFamilyVersionId, retired]]),
    )
    expect(resolved.ok).toBe(true)
  })

  it('does not offer a retired or draft family to a new card', () => {
    const retired = fixtureVersion({
      governanceState: 'retired',
      retiredAt: '2026-02-01T00:00:00.000Z',
    })
    const draft = fixtureVersion({ governanceState: 'draft', approvedAt: null })

    expect(assertProductFamilySelectableForNewCard(retired).ok).toBe(false)
    expect(assertProductFamilySelectableForNewCard(draft).ok).toBe(false)
    expect(assertProductFamilySelectableForNewCard(fixtureVersion()).ok).toBe(true)
    // And the picker index only ever contains approved versions.
    for (const version of getApprovedProductFamiliesForRole(STENT_ROLE)) {
      expect(version.governanceState).toBe('approved')
    }
  })
})
