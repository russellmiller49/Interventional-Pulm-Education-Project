import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import catalogJson from '../../../../data/ip-preference-cards/generated/catalog-products.json'
import refreshJson from '../../../../data/ip-device-intelligence/generated/status-refresh.json'
import baselineJson from '../../../../data/ip-device-intelligence/generated/product-status-overlay.json'
import baselineSafetyJson from '../../../../data/ip-device-intelligence/generated/product-safety-evidence.json'
import { statusRefreshSchema } from '../domain/status-refresh-schema'
import { applyStatusRefresh, mergeSafetyRefresh } from '../domain/apply-status-refresh'
import { UNRESEARCHED_PRODUCT_STATUS } from '../domain/product-status'
import { getProductStatus } from '../server/product-status.server'
import { getSafetyEvidence } from '../server/safety-evidence.server'
import { getAtlasCatalogStore } from '../server/atlas-store.server'
import {
  applyPhysicianSafetyReview,
  applyPhysicianStatusReview,
  getPhysicianProductReview,
} from '../server/physician-review.server'
import {
  marketFinding,
  noticeState,
  safetyFinding,
  type Inputs,
} from '../../../../scripts/ip-device-intelligence/status-refresh/adjudicate'
import {
  identifierInText,
  udiIdentityMatches,
  type Product,
} from '../../../../scripts/ip-device-intelligence/status-refresh/identity'
import type {
  BatchResult,
  Receipt,
} from '../../../../scripts/ip-device-intelligence/status-refresh/acquire'

jest.mock('../../../../scripts/local-data-root.mjs', () => ({
  localDataPath: (...parts: string[]) => parts.join('/'),
}))
const artifact = statusRefreshSchema.parse(refreshJson)
const product: Product = {
  ...(catalogJson[0] as Product),
  manufacturer: 'Ambu',
  manufacturer_id: 'MFR-C84E13E4FD',
  catalog_number: '621001000US',
  gtin: null,
  alternate_ids: null,
  global_part_number: null,
  reference_part_number: null,
}
function batch(endpoint: string, records: Record<string, unknown>[] = []): BatchResult {
  const page: Receipt = {
    records,
    datasetLastUpdated: '2026-09-02',
    resultTotal: records.length,
    retrievedAt: '2026-09-17T12:00:00.000Z',
    fromCache: true,
    httpStatus: 200,
    attemptCount: 1,
    apiRequestsMade: 0,
    retryCount: 0,
    requestUrl: `https://api.fda.gov/device/${endpoint}.json?search=test`,
    requestSearch: 'test',
    requestLimit: 100,
    requestSkip: 0,
    responseSha256: 'a'.repeat(64),
    rawCacheReference: 'test',
  }
  return {
    key: 'a'.repeat(64),
    product_ids: [product.product_id],
    endpoint,
    search: 'test',
    complete: true,
    error: null,
    pages: [page],
  }
}
function inputs(): Inputs {
  return {
    udi: [
      batch('udi', [
        {
          company_name: 'Ambu A/S',
          catalog_number: product.catalog_number,
          public_device_record_key: 'record-1',
          commercial_distribution_status: 'In Commercial Distribution',
          identifiers: [{ id: '05707480156306', type: 'Primary' }],
        },
      ]),
    ],
    registration: [batch('registrationlisting')],
    recall: [batch('recall')],
    enforcement: [batch('enforcement')],
    snapshots: {},
  }
}

describe('FDA status refresh matching and evidence policy', () => {
  it('requires manufacturer identity as well as an exact catalog/model identifier', () => {
    expect(
      udiIdentityMatches(product, {
        company_name: 'Ambu A/S',
        catalog_number: product.catalog_number,
      }),
    ).toBe(true)
    expect(
      udiIdentityMatches(product, {
        company_name: 'B. Braun Medical',
        catalog_number: product.catalog_number,
      }),
    ).toBe(false)
    expect(
      udiIdentityMatches(product, {
        company_name: 'Ambu A/S',
        catalog_number: product.catalog_number + '-A',
      }),
    ).toBe(false)
    expect(identifierInText('REF ABC123-A; ABC1230; XABC123', 'ABC123')).toBe(false)
    expect(identifierInText('REF: ABC123, lot 9', 'ABC123')).toBe(true)
    expect(identifierInText('REF/ABC123/05707480156306', 'ABC123')).toBe(true)
  })
  it('separates current UDI evidence from exact second-source corroboration', () => {
    const input = inputs()
    expect(marketFinding(product, input)).toMatchObject({
      market_status: 'likely_current_us',
      market_confidence: 'moderate',
    })
    input.registration[0].pages[0].records = [
      {
        registration: { name: 'Ambu A/S', status_code: '1', reg_expiry_date_year: '2026' },
        proprietary_name: [product.catalog_number],
      },
    ]
    expect(marketFinding(product, input)).toMatchObject({
      market_status: 'confirmed_current_us',
      market_confidence: 'high',
    })
    input.registration[0].pages[0].records = [
      {
        registration: { name: 'Ambu A/S', status_code: '1', reg_expiry_date_year: '2026' },
        proprietary_name: ['aScope family'],
      },
    ]
    expect(marketFinding(product, input).market_status).toBe('likely_current_us')
  })
  it('does not promote partial searches, contradictory configurations or an ended exact package', () => {
    const input = inputs()
    input.registration[0].complete = false
    expect(marketFinding(product, input).market_status).toBeNull()
    input.registration[0].complete = true
    input.udi[0].pages[0].records.push({
      ...input.udi[0].pages[0].records[0],
      public_device_record_key: 'record-2',
      commercial_distribution_status: 'Not in Commercial Distribution',
    })
    expect(marketFinding(product, input).market_status).toBe('current_status_conflicted')
    const packageInput = inputs()
    packageInput.udi[0].pages[0].records[0].identifiers = [
      { id: '05707480156306', type: 'Primary' },
      { id: '05707480156313', type: 'Package', package_status: 'Not in Commercial Distribution' },
    ]
    expect(marketFinding({ ...product, gtin: '05707480156313' }, packageInput).market_status).toBe(
      'current_status_conflicted',
    )
  })
  it('does not equate ended registry entries with manufacturer-confirmed discontinuation', () => {
    const input = inputs()
    input.udi[0].pages[0].records[0].commercial_distribution_status =
      'Not in Commercial Distribution'
    expect(marketFinding(product, input)).toMatchObject({
      market_status: null,
      market_evidence: { basis: 'ended_udi_only' },
    })
  })
  it('does not attach another manufacturer’s recall or treat a family title as an exact model', () => {
    const input = inputs()
    input.recall[0].pages[0].records = [
      {
        recalling_firm: 'B. Braun Medical',
        product_res_number: 'Z-0001-2026',
        recall_status: 'Ongoing',
        product_description: product.catalog_number,
      },
    ]
    expect(safetyFinding(product, input).safety.notices).toEqual([])
    expect(safetyFinding(product, input).safety_identity_review_required).toBe(true)
    const family = { ...product, catalog_number: 'aScope Broncho', gtin: null }
    input.udi[0].pages[0].records = []
    input.recall[0].pages[0].records = [
      {
        recalling_firm: 'Ambu A/S',
        product_res_number: 'Z-0001-2026',
        recall_status: 'Ongoing',
        product_description: 'aScope Broncho',
      },
    ]
    expect(safetyFinding(family, input).safety.notices).toEqual([])
    expect(safetyFinding(family, input).safety_identity_review_required).toBe(true)
  })
  it('uses a dated recall termination despite a frozen ongoing enforcement report', () => {
    expect(
      noticeState(
        { recall_status: 'Terminated', event_date_terminated: '2026-08-01' },
        { status: 'Ongoing' },
      ),
    ).toBe('historical')
    expect(noticeState({ recall_status: 'Ongoing' }, { status: 'Terminated' })).toBe('conflicted')
  })
  it('requires complete dated safety coverage before showing an absence of exact findings', () => {
    const row = JSON.parse(
      JSON.stringify(
        artifact.rows.find(
          (r) =>
            !r.safety.notices.length &&
            !r.safety_identity_review_required &&
            r.safety.search_status === 'searched',
        )!,
      ),
    ) as (typeof artifact.rows)[number]
    expect(applyStatusRefresh(UNRESEARCHED_PRODUCT_STATUS, row, row.safety).safetyDisplay).toBe(
      'no_exact_action_found_as_of_snapshot',
    )
    row.safety.search_status = 'query_error'
    expect(applyStatusRefresh(UNRESEARCHED_PRODUCT_STATUS, row, row.safety).safetyDisplay).toBe(
      'safety_status_unverified',
    )
    row.safety.search_status = 'searched'
    row.safety.source_checks[0].dataset_as_of = null
    expect(applyStatusRefresh(UNRESEARCHED_PRODUCT_STATUS, row, row.safety).safetyDisplay).toBe(
      'safety_status_unverified',
    )
  })
})

describe('committed status refresh and runtime integration', () => {
  it('pins public research receipts and validates every runtime row', () => {
    const research = readFileSync(
      join(
        __dirname,
        '../../../../data/ip-device-intelligence/research/status-refresh-2026-09-17.json',
      ),
    )
    expect(createHash('sha256').update(research).digest('hex')).toBe(artifact.research_sha256)
    expect(artifact.rows).toHaveLength(1911)
    expect(artifact.rows.filter((r) => r.market_status === 'confirmed_current_us')).toHaveLength(56)
    expect(artifact.rows.filter((r) => r.market_status === 'likely_current_us')).toHaveLength(1070)
    expect(
      artifact.rows.filter((r) => r.market_status === 'current_status_conflicted'),
    ).toHaveLength(16)
    expect(
      JSON.parse(research.toString()).queries.every((q: BatchResult) => q.complete && !q.error),
    ).toBe(true)
  })
  it('preserves previous notices through negative searches and preserves physician exclusions', () => {
    const previous = getSafetyEvidence('PRD-05670F1B5F')!
    const noNotices = { ...artifact.rows[0], safety: { ...artifact.rows[0].safety, notices: [] } }
    expect(mergeSafetyRefresh(previous, noNotices).notices).toEqual(previous.notices)
    for (const product of getAtlasCatalogStore().products) {
      const review = getPhysicianProductReview(product.product_id)
      const evidence = getSafetyEvidence(product.product_id)
      for (const excluded of review?.excluded_recalls ?? [])
        expect(evidence?.notices.some((n) => n.recall_number === excluded.recall_number)).toBe(
          false,
        )
      if (review?.unresolved_checks.length)
        expect(getProductStatus(product.product_id).statusRecommendationGate).not.toBe('clear')
    }
  })
  it('blocks every recorded active action and never removes a device from the atlas', () => {
    for (const product of getAtlasCatalogStore().products) {
      const status = getProductStatus(product.product_id)
      if (getSafetyEvidence(product.product_id)?.notices.some((n) => n.recorded_state === 'active'))
        expect(status.statusRecommendationGate).toBe('blocked_active_safety_action')
    }
    expect(getAtlasCatalogStore().products).toHaveLength(1957)
  })
  it('accounts for before/after status coverage', () => {
    const original = new Map(baselineJson.rows.map((r) => [r.product_id, r]))
    const safety = new Map(baselineSafetyJson.rows.map((r) => [r.product_id, r]))
    const counts: Record<string, number> = {}
    for (const product of getAtlasCatalogStore().products) {
      const id = product.product_id,
        row = original.get(id)
      const before = applyPhysicianStatusReview(
        id,
        row
          ? ({
              researched: true,
              researchSnapshotDate: row.research_snapshot_date,
              marketStatus: row.market_status,
              marketConfidence: row.market_confidence,
              safetyDisplay: row.safety_display,
              safetyActionScope: row.safety_action_scope,
              safetyReferenceCodes: row.safety_reference_codes,
              statusRecommendationGate: row.status_recommendation_gate,
            } as typeof UNRESEARCHED_PRODUCT_STATUS)
          : UNRESEARCHED_PRODUCT_STATUS,
        applyPhysicianSafetyReview(
          id,
          (safety.get(id) ?? null) as Parameters<typeof applyPhysicianSafetyReview>[1],
        ),
      )
      const after = getProductStatus(id)
      for (const [prefix, state] of [
        ['market', after.marketStatus],
        ['safety', after.safetyDisplay],
        ['gate', after.statusRecommendationGate],
      ])
        counts[prefix + ':' + state] = (counts[prefix + ':' + state] ?? 0) + 1
      if (
        before.marketStatus === 'current_status_unverified' &&
        ['confirmed_current_us', 'likely_current_us'].includes(after.marketStatus)
      )
        counts.market_resolved = (counts.market_resolved ?? 0) + 1
      if (
        before.safetyDisplay === 'safety_status_unverified' &&
        !['safety_status_unverified', 'safety_identity_review_required'].includes(
          after.safetyDisplay,
        )
      )
        counts.safety_resolved = (counts.safety_resolved ?? 0) + 1
    }
    expect(counts).toEqual({
      'market:likely_current_us': 1094,
      'market:confirmed_current_us': 63,
      'market:current_status_unverified': 766,
      'market:current_status_conflicted': 34,
      'safety:no_exact_action_found_as_of_snapshot': 1651,
      'safety:active_safety_notice': 163,
      'safety:historical_safety_notice': 33,
      'safety:safety_identity_review_required': 99,
      'safety:safety_status_unverified': 11,
      'gate:clear': 1647,
      'gate:blocked_active_safety_action': 163,
      'gate:review_required': 147,
      market_resolved: 1123,
      safety_resolved: 1317,
    })
  })
})
