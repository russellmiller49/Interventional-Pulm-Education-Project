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
 * Codex C-02 / C-03 — the D1 cohort wall, adversarially and data-wide.
 *
 * C-02: non-cohort product identities must not enter the PUBLIC procedure-workspace view
 * model at all — not as options, keys, aria/title fodder, or debug fields — while the
 * structural truth (how many authored options exist, how many are withheld) stays honest.
 *
 * C-03: raw compatibility statements (and the product record's own free-text note) must not
 * print a non-cohort product's exact identity on any public atlas surface, including via
 * nominally unresolved textual participants such as "BF-MP190F".
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

    // SLOT-115310F554 (Retrieval basket/net): 7 authored options — 3 cohort-identifiable,
    // 4 withheld (2 hidden verified Karl Storz baskets + 2 candidate/hidden nets), none of
    // the withheld ones selectable. The slot is never presented as option-free.
    const retrieval = workspace.requirements.find(
      (requirement) => requirement.sourceSlotId === 'SLOT-115310F554',
    )!
    expect(retrieval.authoredOptions).toHaveLength(3)
    expect(retrieval.withheldAuthoredOptionCount).toBe(4)
    expect(retrieval.withheldSelectableOptionCount).toBe(0)
    // The hidden product's direct atlas route stays a 404 (null detail).
    expect(getAtlasProductDetail('PRD-F43B951B75')).toBeNull()
  })
})

describe('C-03 — exact non-cohort identifiers never reach public compatibility output', () => {
  it('withholds the GuideSheath statements that textually identify the hidden BF-MP190F scope', () => {
    for (const { productId, ruleId } of GUIDE_SHEATH_CASES) {
      const detail = getAtlasProductDetail(productId)!
      const statement = detail.rawCompatibilityStatements.find(
        (candidate) => candidate.ruleId === ruleId,
      )!
      expect({ productId, ruleId, withheld: statement.withheld }).toEqual({
        productId,
        ruleId,
        withheld: true,
      })
      // The record's own free-text note ("… not compatible with BF-MP190F.") is withheld
      // from the view model too, and the flag says so honestly.
      expect(detail.compatibilityTextWithheld).toBe(true)
      expect(detail.product.compatibility_text).toBeNull()
      // Nothing serialized identifies the hidden product.
      const serialized = JSON.stringify(detail)
      expect(serialized).not.toContain('BF-MP190F')
      expect(serialized).not.toContain('PRD-CB1622624D')
    }
    // The hidden bronchoscope itself stays outside the atlas entirely.
    expect(getAtlasProductDetail('PRD-CB1622624D')).toBeNull()
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
    // The hidden bronchoscope's catalog number, alone or inside a sentence.
    expect(textReferencesNonCohortIdentity('BF-MP190F')).toBe(true)
    expect(
      textReferencesNonCohortIdentity('The GuideSheath is not compatible with BF-MP190F.'),
    ).toBe(true)
    // A cohort product's own catalog number is not a leak.
    expect(textReferencesNonCohortIdentity('K-404')).toBe(false)
    // Short numeric fragments in prose are not deterministic identifier recognitions.
    expect(textReferencesNonCohortIdentity('Working length 332 mm')).toBe(false)
    expect(textReferencesNonCohortIdentity(null)).toBe(false)
    expect(textReferencesNonCohortIdentity('')).toBe(false)
  })
})
