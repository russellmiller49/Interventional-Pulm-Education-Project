import reviewJson from '../../../../data/ip-device-intelligence/reviewed/physician-review-2026-09-17.json'
import overlayJson from '../../../../data/ip-device-intelligence/generated/physician-review-overlay.json'
import catalogJson from '../../../../data/ip-preference-cards/generated/catalog-products.json'
import { validatePhysicianReview } from '../../../../scripts/ip-device-intelligence/build-physician-review'
import { getAtlasProductDetail } from '../server/atlas.server'
import { getProductStatus } from '../server/product-status.server'
import { getSafetyEvidence } from '../server/safety-evidence.server'
import {
  getPhysicianProductReview,
  getPhysicianProcedureReview,
} from '../server/physician-review.server'
import { getReviewedProductProfile } from '../server/d2d-evidence.server'
import { comparisonValue } from '../server/reference-workspace.server'

describe('September 17 physician evidence review', () => {
  it('accounts for the complete export and preserves all unresolved checks', () => {
    const artifact = validatePhysicianReview(reviewJson)
    expect(overlayJson).toEqual(artifact.overlay)
    expect(artifact.decisions).toHaveLength(442)
    expect(artifact.decisions.filter((d) => d.status === 'confirm')).toHaveLength(305)
    expect(artifact.decisions.filter((d) => d.status === 'refute')).toHaveLength(42)
    expect(artifact.overlay.products.reduce((n, p) => n + p.unresolved_checks.length, 0)).toBe(86)
    expect(artifact.overlay.procedures.flatMap((p) => p.unresolved_checks)).toHaveLength(9)
  })

  it('rejects promoting a needs-evidence decision, cross-product citation or stale correction', () => {
    const draft: typeof reviewJson = JSON.parse(JSON.stringify(reviewJson))
    const row = draft.overlay.products.find((p) => p.product_id === 'PRD-07CDEDC2AB')!
    row.summary = {
      ...draft.overlay.products.find((p) => p.summary)!.summary!,
      check_ids: ['PRD-07CDEDC2AB:description'],
    }
    expect(() => validatePhysicianReview(draft)).toThrow('Unsupported publication')
    row.summary!.check_ids = ['PRD-05670F1B5F:description']
    expect(() => validatePhysicianReview(draft)).toThrow('Unsupported publication')
    const drift: typeof reviewJson = JSON.parse(JSON.stringify(reviewJson))
    drift.overlay.products.find(
      (p) => p.catalog_corrections.length,
    )!.catalog_corrections[0].before = 'stale'
    expect(() => validatePhysicianReview(drift)).toThrow('precondition changed')
  })

  it('corrects clinical dimensions without mutating canonical release inputs', () => {
    const wire = getAtlasProductDetail('PRD-5F801B5A8E')!
    expect(wire.product.size_display).toContain('260 cm')
    expect(wire.product.length_mm).toBe(2600)
    expect(catalogJson.find((p) => p.product_id === 'PRD-5F801B5A8E')!.size_display).not.toBe(
      wire.product.size_display,
    )
    for (const id of ['PRD-4F4AA966A9', 'PRD-A72E811F09']) {
      const device = getAtlasProductDetail(id)!
      expect(device.product.working_length_cm).toBeNull()
      expect(device.product.size_display).toContain('19 cm needle')
    }
    expect(getAtlasProductDetail('PRD-48C48C68BA')!.product.reuse_status).toContain('Reusable')
  })

  it('does not equate labeled probe length with working length or scope channel with tool requirement', () => {
    const probe = getAtlasProductDetail('PRD-05670F1B5F')!
    expect(comparisonValue(probe, 'workingLength').value).toBeNull()
    expect(comparisonValue(probe, 'labeledLength')).toMatchObject({
      value: 1150,
      unit: 'mm',
      origin: 'reviewed',
    })
    const scope = getAtlasProductDetail('PRD-4A04124FF2')!
    expect(comparisonValue(scope, 'minChannel').value).toBeNull()
    expect(comparisonValue(scope, 'workingChannel').value).toBe(2.8)
  })

  it('removes seven manufacturer-mismatched Ion notices but keeps genuine historical recalls and review gates', () => {
    for (const id of ['PRD-48C48C68BA', 'PRD-7397B6CA00', 'PRD-8A4A27BDD7', 'PRD-F43740CB5C']) {
      const notices = getSafetyEvidence(id)!.notices
      expect(
        notices.some((n) =>
          ['Z-0355-2024', 'Z-2399-2024', 'Z-2400-2024', 'Z-2401-2024'].includes(n.recall_number),
        ),
      ).toBe(false)
      expect(getProductStatus(id).statusRecommendationGate).toBe('review_required')
    }
    expect(getSafetyEvidence('PRD-48C48C68BA')!.notices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recall_number: 'Z-0489-2021', recorded_state: 'historical' }),
      ]),
    )
    expect(getSafetyEvidence('PRD-7397B6CA00')!.notices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recall_number: 'Z-0106-2022', recorded_state: 'historical' }),
      ]),
    )
    expect(getProductStatus('PRD-8A4A27BDD7').safetyDisplay).toBe('safety_identity_review_required')
  })

  it('adds exact Ambu and Atrium notices consistently to details and safety gates', () => {
    for (const [id, expected] of [
      ['PRD-04A0F61F62', ['Z-1723-2025']],
      ['PRD-2F1DF55F3C', ['Z-1303-2023']],
      ['PRD-94C61697D9', ['Z-0317-2024', 'Z-0485-2024', 'Z-0621-2024']],
    ] as const) {
      expect(getProductStatus(id).statusRecommendationGate).toBe('blocked_active_safety_action')
      expect(getProductStatus(id).safetyReferenceCodes).toEqual(expect.arrayContaining(expected))
      expect(getSafetyEvidence(id)!.notices.map((n) => n.recall_number)).toEqual(
        expect.arrayContaining(expected),
      )
    }
  })

  it('keeps a related ERBE unit correction separate from exact probe recalls', () => {
    const id = 'PRD-05670F1B5F'
    expect(getProductStatus(id).safetyReferenceCodes).not.toContain('Z-2938-2026')
    expect(
      getPhysicianProductReview(id)!.notes.some((note) => note.text.includes('Z-2938-2026')),
    ).toBe(true)
    expect(getProductStatus(id).researchSnapshotDate).toBe('2026-08-13')
  })

  it('preserves package IDs and unresolved model revisions without inventing exact catalogs', () => {
    const acquire = getPhysicianProductReview('PRD-D826F63F9A')!
    expect(acquire.udi_records[0]).toMatchObject({
      primary_di: '08714729986225',
      package_di: '08714729986232',
      package_quantity: 5,
    })
    for (const id of ['PRD-2FAFEA973E', 'PRD-075C3EC5EE', 'PRD-629828B799', 'PRD-59D02C1811']) {
      expect(getAtlasProductDetail(id)!.product.catalog_number).toBeNull()
      expect(
        getPhysicianProductReview(id)!.udi_records.every(
          (record) => record.scope === 'configuration_requires_label',
        ),
      ).toBe(true)
    }
    expect(getPhysicianProductReview('PRD-2F1DF55F3C')!.udi_records).toHaveLength(1)
  })

  it('holds unapproved prose and local procedure approval while rendering confirmed fields', () => {
    expect(getAtlasProductDetail('PRD-07CDEDC2AB')!.publicDescription).toBeNull()
    expect(getReviewedProductProfile('PRD-07CDEDC2AB')!.key_specifications).not.toHaveLength(0)
    expect(getReviewedProductProfile('PRD-05670F1B5F')!.exact_configuration_summary).toBeNull()
    expect(getPhysicianProcedureReview('EBUS_TBNA')!.unresolved_checks).toHaveLength(3)
    expect(getPhysicianProductReview('PRD-FFFFFFFFFF')).toBeNull()
  })
})
