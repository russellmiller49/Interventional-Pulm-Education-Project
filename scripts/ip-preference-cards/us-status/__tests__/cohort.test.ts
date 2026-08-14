import { readFileSync } from 'node:fs'
import path from 'node:path'

import { parseCohortManifestArgs, validatedCohortOutputPath } from '../build-cohort-manifest'
import { buildHiddenProductCohortManifest } from '../cohort'
import {
  cohortCatalogProductSchema,
  cohortGudidReportSchema,
  cohortOpenFdaProposalSchema,
  cohortOpenFdaRunSummarySchema,
  cohortProcedureSlotSchema,
  cohortProductRoleSchema,
  cohortProductSourceSchema,
  cohortSlotProductOptionSchema,
  hiddenProductCohortManifestSchema,
} from '../schemas'
import type { BuildCohortManifestInput } from '../types'

const GENERATED_DIRECTORY = 'data/ip-preference-cards/generated'

function readJson(filename: string): unknown {
  return JSON.parse(readFileSync(filename, 'utf8')) as unknown
}

function realCatalogInput(): BuildCohortManifestInput {
  return {
    catalogProducts: cohortCatalogProductSchema
      .array()
      .parse(readJson(path.join(GENERATED_DIRECTORY, 'catalog-products.json'))),
    productRoles: cohortProductRoleSchema
      .array()
      .parse(readJson(path.join(GENERATED_DIRECTORY, 'product-roles.json'))),
    procedureSlots: cohortProcedureSlotSchema
      .array()
      .parse(readJson(path.join(GENERATED_DIRECTORY, 'procedure-slots.json'))),
    slotProductOptions: cohortSlotProductOptionSchema
      .array()
      .parse(readJson(path.join(GENERATED_DIRECTORY, 'slot-product-options.json'))),
    productSources: cohortProductSourceSchema
      .array()
      .parse(readJson(path.join(GENERATED_DIRECTORY, 'product-sources.json'))),
    gudidReport: cohortGudidReportSchema.parse(
      readJson(path.join(GENERATED_DIRECTORY, 'gudid-confirmations.json')),
    ),
    openFdaProposals: cohortOpenFdaProposalSchema
      .array()
      .parse(readJson(path.join(GENERATED_DIRECTORY, 'openfda', 'enrichment-proposals.json'))),
    openFdaRunSummary: cohortOpenFdaRunSummarySchema.parse(
      readJson(path.join(GENERATED_DIRECTORY, 'openfda', 'run-summary.json')),
    ),
    inputHashes: {
      catalog_products_sha256: 'a'.repeat(64),
      product_roles_sha256: 'b'.repeat(64),
      procedure_slots_sha256: 'c'.repeat(64),
      slot_product_options_sha256: 'd'.repeat(64),
      product_sources_sha256: 'e'.repeat(64),
      gudid_confirmations_sha256: 'f'.repeat(64),
      openfda_proposals_sha256: '1'.repeat(64),
      openfda_run_summary_sha256: '2'.repeat(64),
    },
    gitSha: '3'.repeat(40),
  }
}

describe('deterministic hidden-product current-U.S.-status cohort', () => {
  const input = realCatalogInput()
  const manifest = buildHiddenProductCohortManifest(input)

  it('partitions every hidden product without treating candidate or unknown rows as status-only', () => {
    expect(manifest.counts).toMatchObject({
      catalog_products_total: 1532,
      prototype_visible_products: 753,
      hidden_products: 779,
      hidden_verified_source: 578,
      hidden_candidate: 200,
      hidden_unknown: 1,
    })
    expect(manifest.products).toHaveLength(779)
    expect(
      manifest.products.filter((row) => row.cohort_partition === 'us_status_pending'),
    ).toHaveLength(578)
    expect(
      manifest.products.filter(
        (row) => row.cohort_partition === 'identity_or_specification_pending_candidate',
      ),
    ).toHaveLength(200)
    expect(
      manifest.products.filter(
        (row) => row.cohort_partition === 'identity_or_specification_pending_unknown',
      ),
    ).toHaveLength(1)
  })

  it('uses exact deterministic identifier tiers and rejects the service placeholder', () => {
    expect(manifest.counts.identifier_completeness).toEqual({
      exact_di: 0,
      catalog_number: 750,
      model_only: 0,
      insufficient: 29,
    })
    expect(manifest.products.find((row) => row.product_id === 'PRD-1A152615A0')).toMatchObject({
      catalog_number: 'CUSTOM-SERVICE',
      identifier_completeness: 'insufficient',
    })
  })

  it('preserves the hidden/selectability boundary and exact authored-use counts', () => {
    expect(manifest.counts).toMatchObject({
      mapped_role_rows: 793,
      authored_slot_uses: 1098,
      selectable_slot_uses: 0,
      products_with_authored_slot_use: 692,
      products_with_selectable_slot_use: 0,
    })
    expect(manifest.products.every((row) => row.visibility_state === 'hidden')).toBe(true)
    expect(manifest.products.every((row) => row.selectable_slot_use_count === 0)).toBe(true)
    expect(manifest.products.every((row) => row.canonical_change_applied === false)).toBe(true)
  })

  it('derives authored and role-mapped procedures plus the three exemplar flags', () => {
    const pending = manifest.products.filter((row) => row.cohort_partition === 'us_status_pending')
    expect(pending.filter((row) => row.device_intelligence_exemplar_flags.CHEST_TUBE)).toHaveLength(
      30,
    )
    expect(pending.filter((row) => row.device_intelligence_exemplar_flags.EBUS_TBNA)).toHaveLength(
      8,
    )
    expect(
      pending.filter((row) => row.device_intelligence_exemplar_flags.THERAPEUTIC_BRONCH),
    ).toHaveLength(154)
    for (const row of manifest.products) {
      expect(row.authored_procedure_codes).toEqual([...row.authored_procedure_codes].sort())
      expect(row.role_mapped_procedure_codes).toEqual([...row.role_mapped_procedure_codes].sort())
      expect(row.authored_slot_use_count).toBe(row.authored_slot_ids.length)
      expect(row.source_count).toBe(row.source_ids.length)
    }
  })

  it('marks the existing GUDID and openFDA contexts stale without dropping them', () => {
    expect(manifest.evidence_artifacts.gudid).toMatchObject({
      artifact_freshness: 'stale',
      artifact_catalog_product_count: 1474,
      current_catalog_product_count: 1532,
    })
    expect(manifest.evidence_artifacts.openfda).toMatchObject({
      artifact_freshness: 'stale',
      artifact_catalog_product_count: 1474,
      current_catalog_product_count: 1532,
      products_processed: 25,
    })
    expect(
      manifest.products.filter((row) => row.existing_gudid.confirmation_count > 0),
    ).toHaveLength(353)
    expect(manifest.products.filter((row) => row.existing_openfda.proposal_present)).toHaveLength(
      10,
    )
  })

  it('is stable when every joined input array arrives in reverse order', () => {
    const reversed = buildHiddenProductCohortManifest({
      ...input,
      catalogProducts: [...input.catalogProducts].reverse(),
      productRoles: [...input.productRoles].reverse(),
      procedureSlots: [...input.procedureSlots].reverse(),
      slotProductOptions: [...input.slotProductOptions].reverse(),
      productSources: [...input.productSources].reverse(),
      gudidReport: {
        ...input.gudidReport,
        confirmations: [...input.gudidReport.confirmations].reverse(),
      },
      openFdaProposals: [...input.openFdaProposals].reverse(),
    })
    expect(reversed).toEqual(manifest)
    expect(manifest.products.map((row) => row.product_id)).toEqual(
      manifest.products.map((row) => row.product_id).sort(),
    )
  })

  it('validates the complete strict manifest schema', () => {
    expect(() => hiddenProductCohortManifestSchema.parse(manifest)).not.toThrow()
  })

  it('requires an explicit noncanonical research output path', () => {
    expect(() => parseCohortManifestArgs([])).toThrow('--output is required')
    expect(() =>
      validatedCohortOutputPath(
        'data/ip-preference-cards/generated/us-status/cohort-manifest.json',
      ),
    ).toThrow('data/ip-preference-cards/research/us-status')
    expect(
      validatedCohortOutputPath(
        'data/ip-preference-cards/research/us-status/2026-08-13/cohort-manifest.json',
      ),
    ).toBe(
      path.resolve('data/ip-preference-cards/research/us-status/2026-08-13/cohort-manifest.json'),
    )
  })
})
