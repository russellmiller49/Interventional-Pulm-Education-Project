import {
  getApprovedProductFamiliesForRole,
  getReviewedProductFamiliesForRole,
  getReviewedProductFamilyVersion,
  getReviewedProductFamilyVersions,
  resolveProductFamilyPin,
} from '../data/product-families.server'
import {
  resolveCatalogPick,
  searchProductFamiliesForRole,
  searchProductsForRole,
} from '../server/catalog'
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

function draftStentFamily(): ReviewedProductFamilyVersion {
  const [version] = getReviewedProductFamiliesForRole(STENT_ROLE)
  expect(version).toBeDefined()
  expect(version.governanceState).toBe('draft')
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
  it('are all draft, hashed, and pinned to a catalog release', () => {
    const versions = getReviewedProductFamilyVersions()
    expect(versions).toHaveLength(18)
    for (const version of versions) {
      expect(version.governanceState).toBe('draft')
      expect(version.approvedAt).toBeNull()
      expect(version.definitionHash).toBe(productFamilyDefinitionHash(version))
      expect(version.catalogReleaseId).toMatch(/^[a-f0-9]{64}$/)
      expect(version.memberProductIds.length).toBeGreaterThan(1)
      expect(version.reviewBasis.trim().length).toBeGreaterThan(0)
    }
  })

  /**
   * The rule that keeps the seed honest.
   *
   * These families were seeded from the manufacturer's own `brand_family` grouping and passed a
   * structural homogeneity check. That is an identity claim, not a clinical one: nobody has
   * reviewed the individual devices for interchangeability within a line. Approving them on that
   * basis would publish an unreviewed clinical grouping as reviewed, and merging makes those
   * identities append-only — so the approval would be the hard part to undo.
   */
  it('leaves nothing approved without a review basis recording an explicit clinical review', () => {
    for (const version of getReviewedProductFamilyVersions()) {
      if (version.governanceState !== 'approved') continue
      expect(version.reviewBasis).toMatch(/clinical(ly)? review(ed)?/i)
      expect(version.reviewBasis).not.toMatch(/pending/i)
      expect(version.approvedAt).not.toBeNull()
    }
  })

  it('says in every review basis that clinical membership review is still pending', () => {
    for (const version of getReviewedProductFamilyVersions()) {
      expect(version.reviewBasis).toContain('Clinical membership review is PENDING')
      // And never claims a device-level review happened.
      expect(version.reviewBasis).toMatch(
        /no individual device .* has been\s+clinically reviewed|no individual device[\s\S]*clinically reviewed/i,
      )
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
    const straight = getReviewedProductFamiliesForRole('AIRWAY_STENT_SILICONE_STRAIGHT').find(
      (version) => version.productFamilyCode.startsWith('NOVATECH_GSS'),
    )
    const bifurcation = getReviewedProductFamiliesForRole('AIRWAY_STENT_SILICONE_Y').find(
      (version) => version.productFamilyCode.startsWith('NOVATECH_GSS'),
    )
    expect(straight).toBeDefined()
    expect(bifurcation).toBeDefined()
    expect(straight!.productFamilyVersionId).not.toBe(bifurcation!.productFamilyVersionId)
    expect(straight!.memberProductIds).not.toEqual(bifurcation!.memberProductIds)
  })

  it('offers none for a role that has no reviewed line', () => {
    // Chest tubes are the other known over-merge and are deliberately not seeded.
    expect(getReviewedProductFamiliesForRole('CHEST_TUBE_SURGICAL')).toEqual([])
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
    expect(getReviewedProductFamiliesForRole(STENT_ROLE).length).toBeGreaterThan(0)
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

describe('a draft family is identified but not selectable', () => {
  it('is never offered to the picker', () => {
    expect(getApprovedProductFamiliesForRole(STENT_ROLE)).toEqual([])
    expect(getReviewedProductFamiliesForRole(STENT_ROLE).length).toBeGreaterThan(0)
  })

  it('withholds the pin fields the picker would build a selection from', () => {
    // Withheld by construction rather than flagged: a pick cannot be assembled from fields that
    // are not there, so a caller that forgets to check governance gets nothing rather than an
    // unapproved selection.
    const groupings = searchProductFamiliesForRole({ roleCode: STENT_ROLE })
    const backedByDraft = groupings.filter(
      (family) => family.reviewedFamilyGovernanceState === 'draft',
    )
    expect(backedByDraft.length).toBeGreaterThan(0)
    for (const family of backedByDraft) {
      expect(family.reviewedFamilyVersionId).toBeNull()
      expect(family.reviewedFamilyCode).toBeNull()
      expect(family.reviewedFamilyCatalogReleaseId).toBeNull()
      expect(family.reviewedFamilyDefinitionHash).toBeNull()
    }
  })

  it('produces no valid version-4 family pick', () => {
    const version = draftStentFamily()
    const resolved = resolveProductFamilyPin({
      productFamilyVersionId: version.productFamilyVersionId,
      catalogReleaseId: version.catalogReleaseId,
      definitionHash: version.definitionHash,
      roleCode: STENT_ROLE,
    })
    expect(resolved.ok).toBe(false)
    if (!resolved.ok) expect(resolved.code).toBe('product_family_unpublished')
  })

  it('is refused at save time even when the pin is otherwise perfectly formed', () => {
    // The picker withholding a control has never been a security boundary here. A crafted request
    // naming a draft family carries a correct version id, catalog release, hash, and role — and is
    // still refused, because no reviewer has approved the membership.
    const version = draftStentFamily()
    const request = saveCardRequestSchema.parse(
      saveRequestWithFamilies([{ version, roleCode: STENT_ROLE }]),
    )
    const saved = resolveForSave(request, GENERATED_AT)
    expect(saved.ok).toBe(false)
    if (!saved.ok) expect(saved.code).toBe('product_family_unavailable')

    const rebuilt = rebuildBuilderContext(builderInputsSchema.parse(request), GENERATED_AT)
    expect(rebuilt.ok).toBe(false)
    if (!rebuilt.ok) expect(rebuilt.message).toContain('awaiting clinical review')
  })

  it('stays distinguishable from a grouping with no reviewed family at all', () => {
    // Both withhold the whole-line action, and they are not the same situation: one has a frozen
    // membership waiting on a clinician, the other has nobody looking at it.
    const stent = searchProductFamiliesForRole({ roleCode: STENT_ROLE })
    expect(stent.some((family) => family.reviewedFamilyGovernanceState === 'draft')).toBe(true)

    const chestTubes = searchProductFamiliesForRole({ roleCode: 'CHEST_TUBE_SURGICAL' })
    expect(chestTubes.length).toBeGreaterThan(0)
    for (const family of chestTubes) {
      expect(family.reviewedFamilyGovernanceState).toBeNull()
    }
  })

  it('does not interfere with exact product selection', () => {
    // The sizes are still individually pickable, which is the fallback the whole design leans on
    // while a family waits for review.
    const products = searchProductsForRole({ roleCode: STENT_ROLE, limit: 5 })
    expect(products.length).toBeGreaterThan(0)
    const [option] = products
    const pick = resolveCatalogPick(option.productId, STENT_ROLE)
    expect(pick.ok).toBe(true)
  })

  it('can move to approved without rewriting its identity or membership', () => {
    // Governance is outside the definition hash, so approval is a lifecycle act and not an edit.
    // That is what makes it safe for these to merge as drafts: the hash a card would later pin is
    // the hash they already have.
    const version = draftStentFamily()
    const approved = computeReviewedProductFamilyVersion({
      ...version,
      governanceState: 'approved',
      approvedAt: '2026-09-01T00:00:00.000Z',
      reviewBasis: 'Reviewed device by device on 2026-09-01.',
    })

    expect(approved.productFamilyVersionId).toBe(version.productFamilyVersionId)
    expect(approved.memberProductIds).toEqual(version.memberProductIds)
    expect(approved.definitionHash).toBe(version.definitionHash)
    expect(assertProductFamilySelectableForNewCard(approved).ok).toBe(true)
  })
})

describe('a reviewed pin is verified in every part', () => {
  const version = fixtureVersion()
  const versions = new Map([[version.productFamilyVersionId, version]])

  it('accepts a pin that matches the retained family exactly', () => {
    const resolved = resolveReviewedProductFamily(
      {
        productFamilyVersionId: version.productFamilyVersionId,
        catalogReleaseId: version.catalogReleaseId,
        definitionHash: version.definitionHash,
        roleCode: STENT_ROLE,
      },
      versions,
    )
    expect(resolved.ok).toBe(true)
  })

  it('refuses a pin whose membership hash no longer matches', () => {
    const resolved = resolveReviewedProductFamily(
      {
        productFamilyVersionId: version.productFamilyVersionId,
        catalogReleaseId: version.catalogReleaseId,
        definitionHash: 'c'.repeat(64),
        roleCode: STENT_ROLE,
      },
      versions,
    )
    expect(resolved.ok).toBe(false)
    if (!resolved.ok) expect(resolved.code).toBe('product_family_definition_mutated')
  })

  it('refuses a pin naming a role the family does not serve', () => {
    const resolved = resolveReviewedProductFamily(
      {
        productFamilyVersionId: version.productFamilyVersionId,
        catalogReleaseId: version.catalogReleaseId,
        definitionHash: version.definitionHash,
        roleCode: 'CHEST_TUBE_SURGICAL',
      },
      versions,
    )
    expect(resolved.ok).toBe(false)
    if (!resolved.ok) expect(resolved.code).toBe('product_family_role_not_covered')
  })

  it('refuses a pin naming a catalog release the family was not reviewed against', () => {
    const resolved = resolveReviewedProductFamily(
      {
        productFamilyVersionId: version.productFamilyVersionId,
        catalogReleaseId: 'd'.repeat(64),
        definitionHash: version.definitionHash,
        roleCode: STENT_ROLE,
      },
      versions,
    )
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
