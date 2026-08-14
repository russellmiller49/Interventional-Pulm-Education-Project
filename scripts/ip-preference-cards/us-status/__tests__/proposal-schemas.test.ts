import {
  usStatusEvidenceArtifactSchema,
  usStatusEvidenceProposalSchema,
  usStatusReviewRowSchema,
  usStatusRunSummarySchema,
  usStatusSourceManifestSchema,
  type UsStatusDatasetSnapshot,
  type UsStatusEvidenceArtifact,
  type UsStatusEvidenceProposal,
  type UsStatusEvidenceSource,
  type UsStatusInputHash,
  type UsStatusProposalCounts,
} from '../proposal-schemas'

const RESEARCH_AS_OF_DATE = '2026-08-13'
const RETRIEVED_AT = '2026-08-13T19:00:00.000Z'

function evidenceSources(productId: string): UsStatusEvidenceSource[] {
  return [
    {
      source_id: `SRC-${productId}-FDA`,
      layer: 'udi_distribution',
      source_type: 'official_fda_api',
      endpoint: 'device/udi',
      url: `https://api.fda.gov/device/udi.json?search=${encodeURIComponent(`identifiers.id:"DI-${productId}"`)}&limit=100`,
      publisher: 'U.S. Food and Drug Administration',
      title: 'AccessGUDID device record',
      as_of_date: '2026-08-12',
      retrieved_at: RETRIEVED_AT,
      content_sha256: 'a'.repeat(64),
      request_search: `identifiers.id:"DI-${productId}"`,
      raw_cache_reference: `local-data/ip-preference-cards/us-status/2026-08-13/openfda/udi/${'1'.repeat(64)}.json`,
      identity_scope: 'exact_product',
      temporal_scope: 'current',
      us_specific: true,
      exact_identifier_text: [`DI-${productId}`],
      factual_summary: 'The exact device and package records have different distribution states.',
    },
    {
      source_id: `SRC-${productId}-MFG`,
      layer: 'manufacturer',
      source_type: 'official_manufacturer_page',
      endpoint: 'manufacturer_public_web',
      url: `https://example.com/us/products/${productId}`,
      publisher: 'Example Manufacturer',
      title: 'Official U.S. product page',
      as_of_date: RESEARCH_AS_OF_DATE,
      retrieved_at: RETRIEVED_AT,
      content_sha256: 'b'.repeat(64),
      request_search: null,
      raw_cache_reference: null,
      identity_scope: 'exact_product',
      temporal_scope: 'current',
      us_specific: true,
      exact_identifier_text: [`CAT-${productId}`],
      factual_summary: 'The official U.S. page identifies the exact catalog product.',
    },
  ]
}

function proposal(productId: string): UsStatusEvidenceProposal {
  const sources = evidenceSources(productId)
  const fdaSourceId = sources[0].source_id
  const manufacturerSourceId = sources[1].source_id

  return {
    canonical_identity: {
      product_id: productId,
      manufacturer_id: 'MFR-001',
      manufacturer: 'Example Manufacturer',
      product_name: `Example Device ${productId}`,
      catalog_number: `CAT-${productId}`,
      model_number: `MODEL-${productId}`,
      gtin_di: `DI-${productId}`,
      global_part_number: null,
      reference_part_number: `REF-${productId}`,
      alternate_ids: [`ALT-${productId}`],
    },
    canonical_context: {
      verification_grade: 'verified_source',
      visibility_state: 'hidden',
      cohort_partition: 'us_status_pending',
      identifier_completeness: 'exact_di',
      mapped_roles: [{ role_code: 'DEVICE', role_fit: 'exact' }],
      authored_slot_use_count: 2,
      selectable_slot_use_count: 0,
      authored_procedure_codes: ['EBUS_TBNA'],
      role_mapped_procedure_codes: ['EBUS_TBNA', 'THERAPEUTIC_BRONCH'],
      source_count: 2,
    },
    research_state: 'current_status_conflicted',
    confidence: 'moderate',
    identity_match_method: 'exact_primary_di_or_gtin',
    layer_results: {
      udi_distribution: {
        search_completed: true,
        snapshot_current: true,
        all_exact_configurations_retrieved: true,
        assessment: 'conflicting_exact_configuration_statuses',
        configurations: [
          {
            record_key: `RK-${productId}-PRIMARY`,
            configuration_type: 'primary',
            primary_di: `DI-${productId}`,
            package_di: null,
            unit_of_use_di: null,
            quantity_per_package: 1,
            company_name: 'Example Manufacturer',
            brand_name: 'Example Device',
            catalog_number: `CAT-${productId}`,
            version_or_model_number: `MODEL-${productId}`,
            product_codes: ['NOU'],
            premarket_submission_numbers: ['K260001'],
            commercial_distribution_status: 'in_distribution',
            commercial_distribution_end_date: null,
            package_status: null,
            package_discontinue_date: null,
            record_status: 'published',
            exact_query: `identifiers.id:"DI-${productId}"`,
            match_basis: 'exact_primary_di_or_gtin',
            exact_identity: true,
            public_version_date: '2026-08-01',
            record_date: '2026-08-02',
            source_ids: [fdaSourceId],
          },
          {
            record_key: `RK-${productId}-PACKAGE`,
            configuration_type: 'package',
            primary_di: `DI-${productId}`,
            package_di: `PKG-${productId}`,
            unit_of_use_di: `UNIT-${productId}`,
            quantity_per_package: 10,
            company_name: 'Example Manufacturer',
            brand_name: 'Example Device Package',
            catalog_number: `CAT-${productId}`,
            version_or_model_number: `MODEL-${productId}`,
            product_codes: ['NOU'],
            premarket_submission_numbers: ['K260001'],
            commercial_distribution_status: 'not_in_distribution',
            commercial_distribution_end_date: '2025-12-31',
            package_status: 'discontinued',
            package_discontinue_date: '2025-12-31',
            record_status: 'published',
            exact_query: `identifiers.id:"DI-${productId}"`,
            match_basis: 'package_configuration_of_exact_device',
            exact_identity: true,
            public_version_date: '2026-08-01',
            record_date: '2026-08-02',
            source_ids: [fdaSourceId],
          },
        ],
      },
      registration_listing: {
        search_completed: true,
        snapshot_current: true,
        assessment: 'exact_current_listing',
        match_scope: 'exact_product',
        listing_status: 'current',
        establishment_registration_current: true,
        conflict: false,
        records: [
          {
            record_key: `LIST-${productId}`,
            establishment_name: 'Example Manufacturer',
            proprietary_name: 'Example Device',
            product_code: 'NOU',
            registration_number: '3012345678',
            listing_identifiers: [`LISTING-${productId}`],
            linked_submission_numbers: ['K260001'],
            listing_status: 'current',
            match_scope: 'exact_product',
            exact_query: `catalog_number:"CAT-${productId}"`,
            match_basis: 'exact manufacturer and catalog number',
            dataset_as_of_date: '2026-08-12',
            source_ids: [fdaSourceId],
          },
        ],
      },
      authorization: {
        search_completed: true,
        finding: 'exact_510k_clearance',
        records: [
          {
            pathway: '510k',
            submission_number: 'K260001',
            decision_or_exemption_status: 'substantially equivalent',
            decision_date: '2026-01-15',
            product_code: 'NOU',
            match_scope: 'exact_product',
            exact_query: 'K260001',
            match_basis: 'official labeling links the submission to the exact model',
            dataset_as_of_date: '2026-08-12',
            source_ids: [fdaSourceId],
          },
        ],
      },
      manufacturer: {
        search_completed: true,
        finding: 'current_exact_official_us_product',
        exact_product_source_confirmed: true,
        current_us_source_confirmed: true,
        official_discontinuation_confirmed: false,
        source_ids: [manufacturerSourceId],
      },
      recall: {
        search_completed: true,
        finding: 'no_result',
        excluded_from_distribution_assessment: true,
        records: [],
      },
    },
    sources,
    conflicts: {
      identity: false,
      model: false,
      manufacturer: false,
      package_configuration: true,
      distribution: true,
      discontinuation: false,
      details: [
        {
          conflict_type: 'package_configuration',
          summary: 'The base-device DI is active while the exact package DI is ended.',
          source_ids: [fdaSourceId],
        },
      ],
    },
    reason_codes: ['package_status_conflict'],
    rationale: 'Exact package configurations have conflicting current distribution states.',
    unresolved_questions: ['Confirm whether the ended package has a current replacement package.'],
    proposed_human_review_disposition: 'keep_hidden_conflicting',
    invariant_audit: {
      performed: true,
      provisional_state: 'current_us_distribution_supported',
      passed: false,
      failures: ['package_status_conflict'],
    },
    query_error: {
      present: false,
      errors: [],
    },
    canonical_change_applied: false,
  }
}

const inputHashes: UsStatusInputHash[] = [
  {
    input_id: 'catalog_products',
    path: 'data/ip-preference-cards/generated/catalog-products.json',
    sha256: 'c'.repeat(64),
  },
  {
    input_id: 'cohort_manifest',
    path: 'data/ip-preference-cards/research/us-status/2026-08-13/cohort-manifest.json',
    sha256: 'd'.repeat(64),
  },
]

const datasetSnapshots: UsStatusDatasetSnapshot[] = [
  {
    dataset_id: 'manufacturer_public_web',
    layer: 'manufacturer',
    endpoint: 'manufacturer_public_web',
    as_of_date: RESEARCH_AS_OF_DATE,
    last_updated_at: null,
    retrieved_at: RETRIEVED_AT,
    content_sha256: null,
    record_count: null,
  },
  {
    dataset_id: 'openfda_device_udi',
    layer: 'udi_distribution',
    endpoint: 'https://api.fda.gov/device/udi.json',
    as_of_date: '2026-08-12',
    last_updated_at: '2026-08-12T00:00:00.000Z',
    retrieved_at: RETRIEVED_AT,
    content_sha256: 'e'.repeat(64),
    record_count: 4,
  },
]

function proposalCounts(productCount: number): UsStatusProposalCounts {
  return {
    product_count: productCount,
    research_state_counts: {
      current_us_distribution_supported: 0,
      not_currently_distributed_supported: 0,
      historically_authorized_current_status_unresolved: 0,
      current_status_conflicted: productCount,
      identity_unresolved: 0,
      insufficient_evidence: 0,
      not_applicable_noncommercial_or_local: 0,
    },
    confidence_counts: {
      high: 0,
      moderate: productCount,
      low: 0,
    },
    query_error_product_count: 0,
    source_record_count: productCount * 2,
    udi_configuration_count: productCount * 2,
    conflicted_product_count: productCount,
  }
}

function artifact(): UsStatusEvidenceArtifact {
  return {
    format_version: 1,
    artifact_kind: 'current_us_status_evidence_proposals',
    method_version: 'us-status-evidence-v1',
    research_as_of_date: RESEARCH_AS_OF_DATE,
    input_hashes: inputHashes,
    dataset_snapshots: datasetSnapshots,
    counts: proposalCounts(2),
    products: [proposal('PRD-001'), proposal('PRD-002')],
    canonical_change_applied: false,
  }
}

describe('current-U.S.-status proposal schemas', () => {
  it('requires one supported research state, confidence, and identity method', () => {
    const valid = proposal('PRD-001')

    expect(
      usStatusEvidenceProposalSchema.safeParse({
        ...valid,
        research_state: 'FDA_authenticated',
      }).success,
    ).toBe(false)
    expect(
      usStatusEvidenceProposalSchema.safeParse({
        ...valid,
        confidence: undefined,
      }).success,
    ).toBe(false)
    expect(
      usStatusEvidenceProposalSchema.safeParse({
        ...valid,
        identity_match_method: undefined,
      }).success,
    ).toBe(false)
  })

  it('preserves mixed base, package, and unit-of-use UDI data without collapsing it', () => {
    const parsed = usStatusEvidenceProposalSchema.parse(proposal('PRD-001'))
    const [primary, packageConfiguration] = parsed.layer_results.udi_distribution.configurations

    expect(parsed.layer_results.udi_distribution.assessment).toBe(
      'conflicting_exact_configuration_statuses',
    )
    expect(primary).toMatchObject({
      configuration_type: 'primary',
      primary_di: 'DI-PRD-001',
      package_di: null,
      commercial_distribution_status: 'in_distribution',
    })
    expect(packageConfiguration).toMatchObject({
      record_key: 'RK-PRD-001-PACKAGE',
      configuration_type: 'package',
      primary_di: 'DI-PRD-001',
      package_di: 'PKG-PRD-001',
      unit_of_use_di: 'UNIT-PRD-001',
      quantity_per_package: 10,
      package_discontinue_date: '2025-12-31',
      commercial_distribution_end_date: '2025-12-31',
      commercial_distribution_status: 'not_in_distribution',
      match_basis: 'package_configuration_of_exact_device',
      public_version_date: '2026-08-01',
      record_date: '2026-08-02',
    })
    expect(parsed.conflicts.package_configuration).toBe(true)
  })

  it('is strict at artifact, product, and nested evidence boundaries', () => {
    const validProposal = proposal('PRD-001')
    const primaryConfiguration = validProposal.layer_results.udi_distribution.configurations[0]

    expect(
      usStatusEvidenceProposalSchema.safeParse({
        ...validProposal,
        unexpected_apply_instruction: true,
      }).success,
    ).toBe(false)
    expect(
      usStatusEvidenceProposalSchema.safeParse({
        ...validProposal,
        layer_results: {
          ...validProposal.layer_results,
          udi_distribution: {
            ...validProposal.layer_results.udi_distribution,
            configurations: [
              { ...primaryConfiguration, unexpected_raw_field: 'must not leak' },
              validProposal.layer_results.udi_distribution.configurations[1],
            ],
          },
        },
      }).success,
    ).toBe(false)
    expect(
      usStatusEvidenceArtifactSchema.safeParse({ ...artifact(), unexpected_top_level: true })
        .success,
    ).toBe(false)
  })

  it.each([
    ['missing response hash', { content_sha256: null }],
    ['missing request search', { request_search: null }],
    ['missing cache reference', { raw_cache_reference: null }],
    ['nonportable cache reference', { raw_cache_reference: 'C:/private/cache.json' }],
    [
      'URL for a different query',
      {
        url: `https://api.fda.gov/device/udi.json?search=${encodeURIComponent('catalog_number:"OTHER"')}&limit=100`,
      },
    ],
  ])('rejects an FDA source with %s', (_label, sourceOverrides) => {
    const valid = proposal('PRD-001')
    const [fda, manufacturer] = valid.sources
    expect(
      usStatusEvidenceProposalSchema.safeParse({
        ...valid,
        sources: [{ ...fda, ...sourceOverrides }, manufacturer],
      }).success,
    ).toBe(false)
  })

  it('requires canonical_change_applied false at every proposal artifact boundary', () => {
    const validProposal = proposal('PRD-001')

    expect(
      usStatusEvidenceProposalSchema.safeParse({
        ...validProposal,
        canonical_change_applied: true,
      }).success,
    ).toBe(false)
    expect(
      usStatusEvidenceArtifactSchema.safeParse({
        ...artifact(),
        canonical_change_applied: true,
      }).success,
    ).toBe(false)
  })

  it('accepts exact derived counts and rejects unstable product order or stale counts', () => {
    const validArtifact = artifact()

    expect(usStatusEvidenceArtifactSchema.parse(validArtifact)).toEqual(validArtifact)
    expect(
      usStatusEvidenceArtifactSchema.safeParse({
        ...validArtifact,
        products: [...validArtifact.products].reverse(),
      }).success,
    ).toBe(false)
    expect(
      usStatusEvidenceArtifactSchema.safeParse({
        ...validArtifact,
        counts: { ...validArtifact.counts, source_record_count: 3 },
      }).success,
    ).toBe(false)
  })

  it('validates cohesive source-manifest, run-summary, and nonapplying review rows', () => {
    const validArtifact = artifact()
    const sources = validArtifact.products
      .flatMap((product) => product.sources)
      .sort((left, right) => left.source_id.localeCompare(right.source_id))

    expect(() =>
      usStatusSourceManifestSchema.parse({
        format_version: 1,
        artifact_kind: 'current_us_status_source_manifest',
        method_version: validArtifact.method_version,
        research_as_of_date: RESEARCH_AS_OF_DATE,
        input_hashes: inputHashes,
        dataset_snapshots: datasetSnapshots,
        source_count: sources.length,
        sources,
        canonical_change_applied: false,
      }),
    ).not.toThrow()
    expect(() =>
      usStatusRunSummarySchema.parse({
        format_version: 1,
        artifact_kind: 'current_us_status_run_summary',
        method_version: validArtifact.method_version,
        research_as_of_date: RESEARCH_AS_OF_DATE,
        proposal_artifact_sha256: 'f'.repeat(64),
        source_manifest_sha256: '1'.repeat(64),
        input_hashes: inputHashes,
        dataset_snapshots: datasetSnapshots,
        counts: validArtifact.counts,
        execution: {
          products_requested: 2,
          products_processed: 2,
          fda_api_requests: 4,
          manufacturer_requests: 2,
          cache_hits: 4,
          cache_misses: 2,
          retry_count: 0,
          query_error_count: 0,
          started_at: '2026-08-13T18:00:00.000Z',
          completed_at: RETRIEVED_AT,
          raw_cache_committed: false,
        },
        canonical_change_applied: false,
      }),
    ).not.toThrow()
    expect(() =>
      usStatusReviewRowSchema.parse({
        product_id: 'PRD-001',
        manufacturer: 'Example Manufacturer',
        product_name: 'Example Device PRD-001',
        catalog_number: 'CAT-PRD-001',
        model_number: 'MODEL-PRD-001',
        research_state: 'current_status_conflicted',
        confidence: 'moderate',
        identity_match_method: 'exact_primary_di_or_gtin',
        rationale: 'Exact package configurations have conflicting distribution states.',
        official_fda_evidence_summary: 'FDA package records contain active and ended statuses.',
        official_manufacturer_evidence_summary: 'A current exact official U.S. page was found.',
        conflicts: ['package_configuration', 'distribution'],
        source_links: [
          {
            source_id: 'SRC-PRD-001-FDA',
            layer: 'udi_distribution',
            url: 'https://api.fda.gov/device/udi.json',
            as_of_date: '2026-08-12',
            retrieved_at: RETRIEVED_AT,
          },
        ],
        proposed_human_review_disposition: 'keep_hidden_conflicting',
        reviewer_decision: 'pending',
        reviewer_rationale: null,
        second_review: {
          required: true,
          decision: null,
          rationale: null,
        },
        canonical_change_applied: false,
      }),
    ).not.toThrow()
  })
})
