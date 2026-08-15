import catalogProductsJson from '../../../../data/ip-preference-cards/generated/catalog-products.json'
import slotProductOptionsJson from '../../../../data/ip-preference-cards/generated/slot-product-options.json'

import { isAtlasCohortProduct } from '@/features/device-intelligence/domain/atlas-cohort'
import { D1_EXEMPLAR_PROCEDURE_CODES } from '@/features/device-intelligence/domain/exemplars'
import { getAtlasProductDetail } from '@/features/device-intelligence/server/atlas.server'
import { getAtlasCatalogStore } from '@/features/device-intelligence/server/atlas-store.server'
import { textReferencesNonCohortIdentity } from '@/features/device-intelligence/server/compatibility.server'
import { getProcedureWorkspace } from '@/features/device-intelligence/server/procedures.server'
import { normalizeIdentifier } from '@/features/preference-cards/server/catalog-store'

/**
 * Codex C-02 / C-03 — the cohort wall, adversarially and data-wide, re-pinned for D2B.
 *
 * C-02: non-cohort product identities must not enter the PUBLIC procedure-workspace view
 * model at all — not as options, keys, aria/title fodder, or debug fields — while the
 * structural truth (how many authored options exist, how many are withheld) stays honest.
 *
 * C-03: raw compatibility statements (and the product record's own free-text note) must not
 * print a non-cohort product's exact identity on any public atlas surface, including via
 * nominally unresolved textual participants.
 *
 * D2B does NOT weaken either wall — it moves the population behind it. "Non-cohort" now means
 * candidate-grade, unknown-grade, or explicitly owner-excluded. Statements that used to be
 * withheld because they named a HIDDEN VERIFIED-SOURCE product (the Olympus BF-MP190F scope)
 * are now displayable, and that is correct precisely because the referenced product is itself
 * inside the D2B cohort — asserted below rather than assumed.
 */

interface ProductRow {
  product_id: string
  product_name: string
  catalog_number: string | null
  verification_grade?: string | null
  visibility_state?: string | null
}

interface OptionRow {
  slot_id: string
  product_id: string
  selectable: boolean | null
}

const products = catalogProductsJson as unknown as ProductRow[]
const options = slotProductOptionsJson as unknown as OptionRow[]

const nonCohortProducts = products.filter((product) => !isAtlasCohortProduct(product))
const nonCohortIds = new Set(nonCohortProducts.map((product) => product.product_id))

/** The same exact-token derivation the C-03 wall uses, re-implemented independently. */
function tokensOf(text: string): string[] {
  return [normalizeIdentifier(text), ...text.split(/[^A-Za-z0-9-]+/).map(normalizeIdentifier)]
}

const nonCohortIdentifierTokens = (() => {
  const tokens = new Set<string>()
  for (const product of nonCohortProducts) {
    tokens.add(normalizeIdentifier(product.product_id))
    if (product.catalog_number) {
      const normalized = normalizeIdentifier(product.catalog_number)
      if (normalized.length >= 4) tokens.add(normalized)
    }
  }
  return tokens
})()

const GUIDE_SHEATH_CASES = [
  { productId: 'PRD-6FF6668D03', ruleId: 'RULE-04C5B71790' },
  { productId: 'PRD-0790420A76', ruleId: 'RULE-5344B40FFF' },
  { productId: 'PRD-E2EB4E573F', ruleId: 'RULE-774756609E' },
  { productId: 'PRD-6D7A0E9DA8', ruleId: 'RULE-BBE709CE49' },
] as const

describe('C-02 — the workspace view model is cohort-walled at the server boundary', () => {
  it('exposes only atlas-cohort product ids as authored options, with honest withheld counts', () => {
    const atlas = getAtlasCatalogStore()
    const rawOptionsBySlot = new Map<string, OptionRow[]>()
    for (const option of options) {
      const rows = rawOptionsBySlot.get(option.slot_id)
      if (rows) rows.push(option)
      else rawOptionsBySlot.set(option.slot_id, [option])
    }
    for (const code of D1_EXEMPLAR_PROCEDURE_CODES) {
      const workspace = getProcedureWorkspace(code)!
      for (const requirement of workspace.requirements) {
        // Every exposed identity is inside the cohort.
        for (const option of requirement.authoredOptions) {
          expect({
            procedure: code,
            requirement: requirement.id,
            productId: option.productId,
            inCohort: atlas.productById.has(option.productId),
          }).toEqual({
            procedure: code,
            requirement: requirement.id,
            productId: option.productId,
            inCohort: true,
          })
        }
        // Withheld counts preserve the underlying authored-option totals — independently
        // re-derived from the raw generated rows and the cohort predicate.
        const raw = requirement.sourceSlotId
          ? (rawOptionsBySlot.get(requirement.sourceSlotId) ?? [])
          : []
        const rawWithheld = raw.filter((option) => !atlas.productById.has(option.product_id))
        expect({
          procedure: code,
          requirement: requirement.id,
          exposed: requirement.authoredOptions.length,
          withheld: requirement.withheldAuthoredOptionCount,
          withheldSelectable: requirement.withheldSelectableOptionCount,
        }).toEqual({
          procedure: code,
          requirement: requirement.id,
          exposed: raw.length - rawWithheld.length,
          withheld: rawWithheld.length,
          withheldSelectable: rawWithheld.filter((option) => option.selectable === true).length,
        })
      }
    }
  })

  it('serializes no non-cohort product id into any exemplar workspace view model', () => {
    for (const code of D1_EXEMPLAR_PROCEDURE_CODES) {
      const serialized = JSON.stringify(getProcedureWorkspace(code))
      for (const productId of nonCohortIds) {
        if (serialized.includes(productId)) {
          throw new Error(`${code} workspace serializes non-cohort product id ${productId}`)
        }
      }
    }
  })

  it('withholds the Micro Retrieval Net identity from the THERAPEUTIC_BRONCH workspace (the Codex exemplar)', () => {
    const workspace = getProcedureWorkspace('THERAPEUTIC_BRONCH')!
    const serialized = JSON.stringify(workspace)
    expect(serialized).not.toContain('PRD-F43B951B75')
    expect(serialized).not.toContain('Micro Retrieval Net')

    // SLOT-115310F554 (Retrieval basket/net): 7 authored options. Under D1 only 3 were
    // identifiable and 4 were withheld; D2B admits the 2 hidden verified-source Karl Storz
    // baskets, so 5 are identifiable and the 2 candidate-grade nets stay withheld. None of
    // the withheld ones is selectable, and the slot is never presented as option-free.
    const retrieval = workspace.requirements.find(
      (requirement) => requirement.sourceSlotId === 'SLOT-115310F554',
    )!
    expect(retrieval.authoredOptions).toHaveLength(5)
    expect(retrieval.withheldAuthoredOptionCount).toBe(2)
    expect(retrieval.withheldSelectableOptionCount).toBe(0)
    // The candidate-grade product's direct atlas route stays a 404 (null detail).
    expect(getAtlasProductDetail('PRD-F43B951B75')).toBeNull()
  })
})

describe('C-03 — exact non-cohort identifiers never reach public compatibility output', () => {
  it('now RENDERS the GuideSheath statements, because BF-MP190F joined the cohort', () => {
    // The D1 withholding was correct under the D1 cohort and is wrong under D2B: the scope
    // it protected is a verified-source product the atlas now serves on its own page. The
    // permission is checked, not assumed — the referenced product must really be in-cohort.
    const referenced = getAtlasProductDetail('PRD-CB1622624D')
    expect(referenced).not.toBeNull()
    expect(referenced!.product.verification_grade).toBe('verified_source')
    expect(referenced!.product.catalog_number).toBe('BF-MP190F')

    for (const { productId, ruleId } of GUIDE_SHEATH_CASES) {
      const detail = getAtlasProductDetail(productId)!
      const statement = detail.rawCompatibilityStatements.find(
        (candidate) => candidate.ruleId === ruleId,
      )!
      expect({ productId, ruleId, withheld: statement.withheld }).toEqual({
        productId,
        ruleId,
        withheld: false,
      })
      // The record's own free-text note is displayed again, verbatim.
      expect(detail.compatibilityTextWithheld).toBe(false)
      expect(detail.product.compatibility_text).toContain('BF-MP190F')
    }
  })

  it('still withholds a statement or note that names a candidate-grade product', () => {
    // The wall is armed, not merely dormant: a candidate-grade product's exact catalog
    // number is still recognized as a non-cohort identity wherever it appears in free text.
    // PRD-F43B951B75 (Micro Retrieval Net, MED-194-NET) is candidate-grade and stays outside.
    expect(getAtlasProductDetail('PRD-F43B951B75')).toBeNull()
    expect(textReferencesNonCohortIdentity('MED-194-NET')).toBe(true)
    expect(textReferencesNonCohortIdentity('Use with the MED-194-NET retrieval net.')).toBe(true)
    expect(textReferencesNonCohortIdentity('PRD-F43B951B75')).toBe(true)
  })

  it('carries no withheld statement in the committed data — and says so explicitly', () => {
    // A measured fact, not an assumption: no compatibility row or product note in the
    // committed catalog names a candidate/unknown product by exact identifier today, so the
    // wall withholds nothing. The armed-ness of the wall is proven by the unit assertions
    // above; this pins the data state so a future import that DOES name one is visible.
    const atlas = getAtlasCatalogStore()
    const withheld: string[] = []
    for (const product of atlas.products) {
      const detail = getAtlasProductDetail(product.product_id)!
      if (detail.compatibilityTextWithheld) withheld.push(`${product.product_id}:note`)
      for (const statement of detail.rawCompatibilityStatements) {
        if (statement.withheld) withheld.push(`${product.product_id}:${statement.ruleId}`)
      }
    }
    expect(withheld).toEqual([])
  })

  it('keeps ordinary cohort-safe raw statements rendering verbatim', () => {
    const atlas = getAtlasCatalogStore()
    let rendered = 0
    for (const product of atlas.products) {
      for (const statement of getAtlasProductDetail(product.product_id)!
        .rawCompatibilityStatements) {
        if (!statement.withheld && statement.ruleText) rendered += 1
      }
    }
    expect(rendered).toBeGreaterThan(0)
  })

  it('data-wide: no rendered statement or note token exactly matches a non-cohort identifier', () => {
    const atlas = getAtlasCatalogStore()
    const offending: string[] = []
    for (const product of atlas.products) {
      const detail = getAtlasProductDetail(product.product_id)!
      const texts: (string | null)[] = [detail.product.compatibility_text]
      for (const statement of detail.rawCompatibilityStatements) {
        if (statement.withheld) continue
        texts.push(statement.sourceText, statement.targetText, statement.ruleText)
      }
      for (const text of texts) {
        if (!text) continue
        for (const token of tokensOf(text)) {
          if (token.length >= 4 && nonCohortIdentifierTokens.has(token)) {
            offending.push(`${product.product_id}: "${text}" token ${token}`)
          }
        }
      }
    }
    expect(offending).toEqual([])
  })

  it('recognizes identities deterministically — exact identifiers only, never fuzzily', () => {
    // A candidate-grade product's catalog number, alone or inside a sentence.
    expect(textReferencesNonCohortIdentity('MED-194-NET')).toBe(true)
    expect(textReferencesNonCohortIdentity('The kit is not compatible with MED-194-NET.')).toBe(
      true,
    )
    // A cohort product's own catalog number is not a leak — including one D2B just admitted.
    expect(textReferencesNonCohortIdentity('K-404')).toBe(false)
    expect(textReferencesNonCohortIdentity('BF-MP190F')).toBe(false)
    // Short numeric fragments in prose are not deterministic identifier recognitions, even
    // though "332" is a candidate-grade product's catalog number.
    expect(textReferencesNonCohortIdentity('Working length 332 mm')).toBe(false)
    expect(textReferencesNonCohortIdentity(null)).toBe(false)
    expect(textReferencesNonCohortIdentity('')).toBe(false)
  })
})
