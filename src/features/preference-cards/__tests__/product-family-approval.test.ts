import type { ReviewedProductFamilyVersion } from '../domain/product-family'

/**
 * What happens the day a reviewer approves one of these families.
 *
 * The eighteen seeded families are all `draft` — identified, membership frozen, clinical review
 * pending — so nothing in the repository can exercise the approved path end to end. Seeding an
 * approval to make a test pass would be the exact thing this correction exists to avoid: an
 * unreviewed clinical grouping published as reviewed, and append-only the moment it merges.
 *
 * So the approval is synthesized here instead, from a *real* retained family with its governance
 * flipped and nothing else touched. That is precisely the transition a reviewer will perform, and
 * it is legitimate to simulate because governance sits outside `productFamilyDefinitionHash`: the
 * approved version has the same id, the same members, and the same hash as the draft it came from.
 *
 * The mock replaces only the two governance-reading lookups. Everything underneath — the release
 * bundle, the pinned catalog release, the retained rows the members resolve against, the resolver —
 * is the real thing.
 */

jest.mock('../data/product-families.server', () => {
  const actual = jest.requireActual('../data/product-families.server')
  const domain = jest.requireActual('../domain/product-family')
  const taxonomy = jest.requireActual('../domain/role-taxonomy')

  const approved: ReviewedProductFamilyVersion[] = actual
    .getReviewedProductFamilyVersions()
    .map((version: ReviewedProductFamilyVersion) => ({
      ...version,
      governanceState: 'approved' as const,
      approvedAt: '2026-09-01T00:00:00.000Z',
    }))
  const byId = new Map(approved.map((version) => [version.productFamilyVersionId, version]))

  return {
    ...actual,
    getReviewedProductFamilyVersions: () => approved,
    getReviewedProductFamilyVersion: (id: string) => byId.get(id) ?? null,
    getApprovedProductFamiliesForRole: (roleCode: string) => {
      const canonical = taxonomy.canonicalRoleCode(roleCode)
      return approved.filter((version) => version.roleCodes.includes(canonical))
    },
    getReviewedProductFamiliesForRole: (roleCode: string) => {
      const canonical = taxonomy.canonicalRoleCode(roleCode)
      return approved.filter((version) => version.roleCodes.includes(canonical))
    },
    resolveProductFamilyPin: (
      pin: { roleCode: string },
      canonicalize: (roleCode: string) => string = taxonomy.canonicalRoleCode,
    ) =>
      domain.resolveReviewedProductFamily(
        { ...pin, roleCode: canonicalize(pin.roleCode) },
        byId,
        canonicalize,
      ),
  }
})

// These imports deliberately sit below `jest.mock`: the mock has to be registered before the
// modules that read the family ledger are loaded.
import {
  defaultBuildInput,
  getComposedRecipeSlots,
  getScenarioDefinition,
} from '../data/demo-context.server'
import { getApprovedProductFamiliesForRole } from '../data/product-families.server'
import { getCurrentReleaseBundleForScenario } from '../data/release-bundles.server'
import { familyPickId } from '../domain/size-at-procedure'
import {
  BUILDER_INPUTS_SCHEMA_VERSION,
  builderInputsSchema,
  saveCardRequestSchema,
} from '../schemas/saved-card'
import { rebuildBuilderContext } from '../server/rebuild-builder-context'
import { searchProductFamiliesForRole } from '../server/catalog'
import { resolveForSave } from '../server/user-cards'

const STENT_ROLE = 'AIRWAY_STENT_SILICONE_STRAIGHT'
const SCENARIO_ID = 'rigid-bronch'
const GENERATED_AT = '2026-09-01T12:00:00.000Z'

function approvedStentFamily(): ReviewedProductFamilyVersion {
  const [version] = getApprovedProductFamiliesForRole(STENT_ROLE)
  expect(version).toBeDefined()
  return version
}

function saveRequest(version: ReviewedProductFamilyVersion) {
  const definition = getScenarioDefinition(SCENARIO_ID)!
  const slot = getComposedRecipeSlots(SCENARIO_ID).find(
    (candidate) => candidate.roleCode === STENT_ROLE,
  )
  expect(slot).toBeDefined()
  const input = defaultBuildInput(SCENARIO_ID)
  input.selectedHospitalItemIds = {
    ...input.selectedHospitalItemIds,
    [slot!.id]: familyPickId(version.productFamilyVersionId),
  }
  return saveCardRequestSchema.parse({
    schemaVersion: BUILDER_INPUTS_SCHEMA_VERSION,
    releaseBundleId: getCurrentReleaseBundleForScenario(SCENARIO_ID)!.id,
    scenarioId: SCENARIO_ID,
    title: 'Approved family round trip',
    physicianName: null,
    status: 'draft',
    input: { ...input, recipeVersionId: definition.recipeVersionId },
    catalogPicks: [],
    familyPicks: [
      {
        productFamilyVersionId: version.productFamilyVersionId,
        catalogReleaseId: version.catalogReleaseId,
        definitionHash: version.definitionHash,
        roleCode: STENT_ROLE,
      },
    ],
    customItems: [],
    equipmentSets: [],
  })
}

describe('once a reviewed family is approved', () => {
  it('the picker offers it with the four pin fields it needs', () => {
    const groupings = searchProductFamiliesForRole({ roleCode: STENT_ROLE })
    const offered = groupings.filter(
      (family) => family.reviewedFamilyGovernanceState === 'approved',
    )
    expect(offered.length).toBeGreaterThan(0)
    for (const family of offered) {
      expect(family.reviewedFamilyVersionId).toMatch(/^family-/)
      expect(family.reviewedFamilyCatalogReleaseId).toMatch(/^[a-f0-9]{64}$/)
      expect(family.reviewedFamilyDefinitionHash).toMatch(/^[a-f0-9]{64}$/)
    }
  })

  it('saves and reopens from the four-field pin', () => {
    const version = approvedStentFamily()
    const request = saveRequest(version)

    const saved = resolveForSave(request, GENERATED_AT)
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.rebuilt.familyPicks).toHaveLength(1)
    expect(saved.rebuilt.familyPicks[0].productFamilyVersionId).toBe(version.productFamilyVersionId)
    expect(saved.rebuilt.familyPicks[0].definitionHash).toBe(version.definitionHash)
    expect(saved.rebuilt.familyPicks[0].variantCount).toBe(version.memberProductIds.length)

    // Reopening runs the same reconstruction, so what opens is what would be stored.
    const reopened = rebuildBuilderContext(builderInputsSchema.parse(request), GENERATED_AT)
    expect(reopened.ok).toBe(true)
    if (!reopened.ok) return
    expect(reopened.familyPicks[0].productFamilyVersionId).toBe(version.productFamilyVersionId)
    // Rebuilt from the release the card pins, not from today's catalog.
    expect(reopened.historicalCatalog.catalogReleaseId).toBe(version.catalogReleaseId)
  })

  it('lands the line on the card as "size at time of procedure" with no catalog number', () => {
    const version = approvedStentFamily()
    const saved = resolveForSave(saveRequest(version), GENERATED_AT)
    expect(saved.ok).toBe(true)
    if (!saved.ok) return

    const line = saved.card.items.find(
      (item) => item.selectedHospitalItemId === familyPickId(version.productFamilyVersionId),
    )
    expect(line).toBeDefined()
    expect(line!.selectedItemSnapshot?.localDescription).toContain('size at time of procedure')
    expect(line!.selectedItemSnapshot?.catalogProduct?.catalogNumber).toBeNull()
  })

  it('still refuses a tampered pin', () => {
    const version = approvedStentFamily()
    const request = saveRequest(version)
    const tampered = builderInputsSchema.parse({
      ...request,
      familyPicks: [{ ...request.familyPicks[0], definitionHash: 'c'.repeat(64) }],
    })

    const rebuilt = rebuildBuilderContext(tampered, GENERATED_AT)
    expect(rebuilt.ok).toBe(false)
    if (!rebuilt.ok) expect(rebuilt.code).toBe('product_family_unavailable')
  })
})
