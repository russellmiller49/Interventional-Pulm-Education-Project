import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { catalogSearchSchema } from '@/features/preference-cards/schemas/catalog-search'
import { safetyDisplayIsMaterialOnCards } from '@/features/device-intelligence/domain/product-status'
import { getAtlasCatalogStore } from '@/features/device-intelligence/server/atlas-store.server'
import {
  getAtlasProductDetail,
  getAtlasUseDetail,
  searchAtlas,
} from '@/features/device-intelligence/server/atlas.server'
import { getProductStatus } from '@/features/device-intelligence/server/product-status.server'

/**
 * The D2B safety contract: an active FDA safety action changes what a product's page SAYS
 * and disqualifies it from being a default or a recommendation. It never removes it from the
 * atlas, and it is never mistaken for a discontinuation.
 */

/**
 * The three ERBE flexible cryoprobes the owner named: each matched an active, lot-specific
 * FDA action exactly, and each is simultaneously supported as currently distributed in the
 * U.S. Both facts must render.
 */
const ERBE_CRYOPROBES = [
  { productId: 'PRD-05670F1B5F', name: 'Flexible Cryoprobe 2.4 mm' },
  { productId: 'PRD-7DC3645CFA', name: 'Flexible Cryoprobe 1.7 mm' },
  { productId: 'PRD-A2C49C9352', name: 'Flexible Cryoprobe 1.1 mm with 817 mm Oversheath' },
] as const

/** The sibling probe whose action matched only at family level — identity review, not a recall. */
const ERBE_FAMILY_MATCH_PRODUCT_ID = 'PRD-6C2199C862'

describe('D2B — active safety actions block recommendation, never visibility', () => {
  it.each(ERBE_CRYOPROBES)(
    'keeps $name fully visible with a prominent active, lot-specific notice',
    ({ productId, name }) => {
      const detail = getAtlasProductDetail(productId)
      expect(detail).not.toBeNull()
      expect(detail!.product.product_name).toBe(name)

      const status = detail!.status
      expect(status.safetyDisplay).toBe('active_safety_notice')
      expect(status.safetyActionScope).toBe('lot_specific')
      expect(status.safetyReferenceCodes.length).toBeGreaterThan(0)
      for (const code of status.safetyReferenceCodes) {
        expect(code).toMatch(/^[A-Z]{1,4}-\d{3,5}-\d{4}$/)
      }
      expect(status.researchSnapshotDate).toBe('2026-08-13')

      // Blocked for recommendation/default purposes...
      expect(status.statusRecommendationGate).toBe('blocked_active_safety_action')
      // ...and NOT described as discontinued: the same snapshot supports current U.S.
      // distribution, which is a separate axis from the safety action.
      expect(status.marketStatus).toBe('confirmed_current_us')
      expect(status.marketStatus).not.toBe('historical_or_discontinued')

      // Still discoverable: search, role listing, direct route.
      const hits = searchAtlas(catalogSearchSchema.parse({ q: name, pageSize: 100 }))
      expect(hits.items.map((item) => item.productId)).toContain(productId)
      expect(getAtlasCatalogStore().productById.has(productId)).toBe(true)
      for (const role of detail!.roles) {
        const use = getAtlasUseDetail(role.roleCode)!
        const listed = use.detail.manufacturerGroups.flatMap((group) =>
          group.items.map((item) => item.productId),
        )
        expect({ productId, role: role.roleCode, listed: listed.includes(productId) }).toEqual({
          productId,
          role: role.roleCode,
          listed: true,
        })
      }
    },
  )

  it('keeps a family-level match as identity review, with no recall number attached', () => {
    const detail = getAtlasProductDetail(ERBE_FAMILY_MATCH_PRODUCT_ID)!
    expect(detail.status.safetyDisplay).toBe('safety_identity_review_required')
    expect(detail.status.safetyActionScope).toBe('family_level')
    // Printing an action number beside a product whose identity did not match exactly would
    // assert something the research package explicitly did not establish.
    expect(detail.status.safetyReferenceCodes).toEqual([])
    expect(detail.status.statusRecommendationGate).toBe('review_required')
  })

  it('keeps lot-specific scope lot-specific, and product-wide scope product-wide', () => {
    const atlas = getAtlasCatalogStore()
    const byScope = new Map<string, number>()
    for (const product of atlas.products) {
      const status = getProductStatus(product.product_id)
      if (status.safetyDisplay !== 'active_safety_notice') continue
      const scope = status.safetyActionScope ?? 'null'
      byScope.set(scope, (byScope.get(scope) ?? 0) + 1)
    }
    // 14 lot-specific, 8 product-wide, 1 undetermined — carried through, never collapsed.
    expect(Object.fromEntries([...byScope.entries()].sort())).toEqual({
      lot_specific: 14,
      product_wide: 8,
      unknown: 1,
    })
  })

  it('treats a historical action as history, not as an active one', () => {
    const atlas = getAtlasCatalogStore()
    const historical = atlas.products
      .map((product) => ({ product, status: getProductStatus(product.product_id) }))
      .filter((entry) => entry.status.safetyDisplay === 'historical_safety_notice')
    expect(historical.length).toBe(2)
    for (const { product, status } of historical) {
      // Visible, badged on cards, but not blocked and not called active.
      expect(getAtlasProductDetail(product.product_id)).not.toBeNull()
      expect(safetyDisplayIsMaterialOnCards(status.safetyDisplay)).toBe(true)
      expect(status.statusRecommendationGate).not.toBe('blocked_active_safety_action')
      expect(status.safetyReferenceCodes.length).toBeGreaterThan(0)
    }
  })

  it('never labels an unverified or unfound safety status as safe or recall-free', () => {
    const messages = JSON.parse(
      readFileSync(join(__dirname, '../../../../messages/en.json'), 'utf8'),
    ) as { deviceIntelligence: { status: Record<string, Record<string, string>> } }
    const status = messages.deviceIntelligence.status
    const unverified = status.safetyDetail.safety_status_unverified
    const notFound = status.safetyDetail.no_exact_action_found_as_of_snapshot
    for (const copy of [unverified, notFound]) {
      expect(copy).not.toMatch(/\bsafe\b/i)
      expect(copy).not.toMatch(/recall-free/i)
      expect(copy).not.toMatch(/no known/i)
    }
    // Both must actively deny the "clean bill of health" reading.
    expect(unverified).toMatch(/not a finding that no action exists/i)
    expect(notFound).toMatch(/not a statement that this product is free of safety actions/i)
    // And the snapshot qualifier is carried in the vocabulary itself.
    expect(status.safety.no_exact_action_found_as_of_snapshot).toMatch(/snapshot/i)
  })

  it('carries the two required product-page statements verbatim', () => {
    const messages = JSON.parse(
      readFileSync(join(__dirname, '../../../../messages/en.json'), 'utf8'),
    ) as { deviceIntelligence: { status: Record<string, string> } }
    const status = messages.deviceIntelligence.status
    expect(status.orderabilityNote).toMatch(/does not establish present orderability/i)
    expect(status.lotSpecificNote).toMatch(/lot-specific/i)
    expect(status.gateNote).toMatch(/not evidence of clinical compatibility/i)
  })

  it('never words likely-current or unverified as currently orderable', () => {
    const messages = JSON.parse(
      readFileSync(join(__dirname, '../../../../messages/en.json'), 'utf8'),
    ) as { deviceIntelligence: { status: { market: Record<string, string> } } }
    const market = messages.deviceIntelligence.status.market
    for (const key of ['likely_current_us', 'current_status_unverified']) {
      expect(market[key]).not.toMatch(/orderable/i)
      expect(market[key]).not.toMatch(/in stock|available now|currently available/i)
    }
    expect(market.likely_current_us).toMatch(/orderability not established/i)
  })
})

describe('D2B — the gate governs recommendation only', () => {
  it('leaves every blocked and review-required product fully in the atlas', () => {
    const atlas = getAtlasCatalogStore()
    const gates = new Map<string, number>()
    for (const product of atlas.products) {
      const status = getProductStatus(product.product_id)
      gates.set(
        status.statusRecommendationGate,
        (gates.get(status.statusRecommendationGate) ?? 0) + 1,
      )
      if (status.statusRecommendationGate === 'clear') continue
      // Blocked / review-required products keep their page, their identity, and their roles.
      const detail = getAtlasProductDetail(product.product_id)
      expect(detail).not.toBeNull()
      expect(detail!.product.product_name).toBe(product.product_name)
      expect(detail!.roles.length).toBeGreaterThan(0)
    }
    // 23 blocked, 34 review-required from the researched rows, plus the 753 unresearched
    // products whose safety status is honestly unverified.
    expect(Object.fromEntries([...gates.entries()].sort())).toEqual({
      blocked_active_safety_action: 23,
      clear: 521,
      review_required: 787,
    })
  })
})
