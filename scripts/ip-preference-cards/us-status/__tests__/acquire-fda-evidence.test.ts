import type { OpenFdaClient, OpenFdaClientRequest, OpenFdaClientResult } from '../../openfda/client'
import type {
  CatalogProductInput,
  OpenFdaRecord,
  VerificationBacklogInput,
} from '../../openfda/types'
import {
  acquireSupplementalEvidence,
  acquireUdiEvidence,
  type UdiAcquisitionResult,
} from '../acquire-fda-evidence'

const RETRIEVED_AT = '2026-08-13T18:00:00.000Z'
const DATASET_LAST_UPDATED = '2026-08-12T00:00:00.000Z'

function product(overrides: Partial<CatalogProductInput> = {}): CatalogProductInput {
  return {
    product_id: 'PRD-TEST',
    manufacturer_id: 'MFR-954E57FBB9',
    manufacturer: 'Olympus',
    product_name: 'Example Device',
    catalog_number: 'CAT-100',
    alternate_ids: null,
    gtin: null,
    global_part_number: null,
    reference_part_number: null,
    brand_family: null,
    verification_status: 'source_verified',
    visibility_state: 'hidden',
    ...overrides,
  }
}

function backlog(overrides: Partial<VerificationBacklogInput> = {}): VerificationBacklogInput {
  return {
    product_id: 'PRD-TEST',
    ...overrides,
  }
}

function udiRecord(overrides: Partial<OpenFdaRecord> = {}): OpenFdaRecord {
  return {
    record_key: 'RK-1',
    public_device_record_key: 'PUBLIC-RK-1',
    company_name: 'Olympus',
    brand_name: 'Example Device',
    catalog_number: 'CAT-100',
    version_or_model_number: null,
    identifiers: [{ id: 'DI-BASE', type: 'Primary' }],
    commercial_distribution_status: 'In Commercial Distribution',
    commercial_distribution_end_date: null,
    record_status: 'Published',
    public_version_date: '2026-08-01',
    publish_date: '2026-08-02',
    product_codes: [],
    premarket_submissions: [],
    ...overrides,
  }
}

function clientResult(
  records: OpenFdaRecord[],
  overrides: Partial<OpenFdaClientResult> = {},
): OpenFdaClientResult {
  return {
    records,
    datasetLastUpdated: DATASET_LAST_UPDATED,
    resultTotal: records.length,
    retrievedAt: RETRIEVED_AT,
    fromCache: false,
    httpStatus: 200,
    attemptCount: 1,
    apiRequestsMade: 1,
    retryCount: 0,
    requestUrl: 'https://api.fda.gov/device/udi.json?search=mock',
    requestSearch: 'mock',
    requestLimit: 100,
    requestSkip: 0,
    responseSha256: '0'.repeat(64),
    rawCacheReference: 'mock-cache:response.json',
    ...overrides,
  }
}

function mockClient(
  handler: (request: OpenFdaClientRequest) => OpenFdaClientResult | Promise<OpenFdaClientResult>,
) {
  const request = jest.fn(async (input: OpenFdaClientRequest) => {
    const result = await handler(input)
    return withRequestProvenance(result, input)
  })
  return {
    client: { request } as unknown as OpenFdaClient,
    request,
  }
}

function withRequestProvenance(
  result: OpenFdaClientResult,
  input: OpenFdaClientRequest,
): OpenFdaClientResult {
  const skip = input.skip ?? 0
  const parameters = new URLSearchParams({
    search: input.search,
    limit: String(input.limit),
  })
  if (skip > 0) parameters.set('skip', String(skip))

  return {
    ...result,
    requestUrl: `https://api.fda.gov/mock.json?${parameters.toString()}`,
    requestSearch: input.search,
    requestLimit: input.limit,
    requestSkip: skip,
  }
}

function clientReturning(records: OpenFdaRecord[]) {
  return mockClient(() => clientResult(records))
}

function emptyClient() {
  return clientReturning([])
}

function acquiredUdi({
  submissions = [],
  productCodes = [],
  premarketExempt = false,
}: {
  submissions?: string[]
  productCodes?: string[]
  premarketExempt?: boolean
} = {}): UdiAcquisitionResult {
  return {
    identity_match_method: 'exact_primary_di_or_gtin',
    identity_conflict: false,
    identity_match_basis: ['exact_canonical_primary_di'],
    records: [
      {
        record_key: 'RK-EXACT',
        public_device_record_key: 'PUBLIC-RK-EXACT',
        primary_di: 'DI-EXACT',
        identifiers: [
          {
            id: 'DI-EXACT',
            type: 'Primary',
            issuing_agency: 'GS1',
            unit_of_use_id: null,
            quantity_per_package: null,
            package_status: null,
            package_discontinue_date: null,
            package_type: null,
          },
        ],
        company_name: 'Olympus',
        brand_name: 'Example Device',
        catalog_number: 'CAT-100',
        version_or_model_number: 'MODEL-100',
        commercial_distribution_status: 'In Commercial Distribution',
        commercial_distribution_end_date: null,
        record_status: 'Published',
        public_version_date: '2026-08-01',
        publish_date: '2026-08-02',
        product_codes: productCodes.map((code) => ({ code, name: null })),
        premarket_submissions: submissions.map((submission_number) => ({
          submission_number,
          supplement_number: null,
        })),
        premarket_exempt: premarketExempt,
        exact_identity: true,
        match_basis: ['exact_canonical_primary_di'],
        exact_queries: ['identifiers.id:"DI-EXACT"'],
        retrieved_at: [RETRIEVED_AT],
        raw_cache_references: ['mock-cache:udi.json'],
        response_provenance: [
          {
            request_url:
              'https://api.fda.gov/device/udi.json?search=identifiers.id%3A%22DI-EXACT%22&limit=100',
            request_search: 'identifiers.id:"DI-EXACT"',
            request_limit: 100,
            request_skip: 0,
            retrieved_at: RETRIEVED_AT,
            response_sha256: '1'.repeat(64),
            raw_cache_reference: 'mock-cache:udi.json',
          },
        ],
      },
    ],
    configurations: [
      {
        configuration_id: 'DI-EXACT',
        identifier_type: 'primary',
        exact_identity: true,
        distribution_status: 'in_distribution',
      },
    ],
    queries: [],
    search_completed: true,
    all_exact_configurations_retrieved: true,
    dataset_last_updated: DATASET_LAST_UPDATED,
    adjacent_sku_excluded: true,
    model_conflict: false,
    manufacturer_conflict: false,
    metrics: {
      pages: 1,
      apiRequests: 1,
      cacheHits: 0,
      cacheMisses: 1,
      retries: 0,
    },
    query_errors: [],
  }
}

describe('openFDA UDI evidence acquisition', () => {
  it('requires exact manufacturer plus catalog identity and accepts only a reviewed alias', async () => {
    const reviewedAlias = clientReturning([
      udiRecord({
        company_name: 'Olympus Medical Systems Corp.',
        catalog_number: 'CAT-100',
      }),
    ])
    const accepted = await acquireUdiEvidence({
      product: product(),
      backlog: null,
      client: reviewedAlias.client,
    })

    expect(accepted.identity_match_method).toBe('exact_manufacturer_catalog_number')
    expect(accepted.manufacturer_conflict).toBe(false)
    expect(accepted.records).toHaveLength(1)
    expect(accepted.records[0]).toMatchObject({
      exact_identity: true,
      match_basis: ['exact_catalog_and_reviewed_manufacturer_alias'],
    })

    const unreviewedAlias = clientReturning([
      udiRecord({
        company_name: 'Olympus America, Inc.',
        catalog_number: 'CAT-100',
      }),
    ])
    const rejected = await acquireUdiEvidence({
      product: product(),
      backlog: null,
      client: unreviewedAlias.client,
    })

    expect(rejected.identity_match_method).toBe('family_or_name_only')
    expect(rejected.identity_conflict).toBe(true)
    expect(rejected.manufacturer_conflict).toBe(true)
    expect(rejected.records[0].exact_identity).toBe(false)
    expect(rejected.configurations).toEqual([])
  })

  it('never promotes a suggested stale DI alone to exact identity', async () => {
    const suggestedDi = '00876543210987'
    const api = clientReturning([
      udiRecord({
        catalog_number: null,
        identifiers: [{ id: suggestedDi, type: 'Primary' }],
      }),
    ])
    const result = await acquireUdiEvidence({
      product: product({
        catalog_number: null,
        gtin: null,
        global_part_number: null,
        reference_part_number: null,
        alternate_ids: null,
      }),
      backlog: backlog({ suggested_primary_di: suggestedDi }),
      client: api.client,
    })

    expect(result.identity_match_method).toBe('family_or_name_only')
    expect(result.identity_match_basis).toContain(
      'exact_stale_backlog_di_candidate_not_independently_canonical',
    )
    expect(result.records[0].exact_identity).toBe(false)
    expect(result.configurations).toEqual([])
  })

  it.each([
    [
      'global model',
      { global_part_number: 'MODEL-200', reference_part_number: null },
      'exact_manufacturer_model_number',
    ],
    [
      'reference number',
      { global_part_number: null, reference_part_number: 'MODEL-200' },
      'exact_manufacturer_reference_number',
    ],
  ] as const)('supports exact manufacturer plus %s', async (_label, identifiers, method) => {
    const api = clientReturning([
      udiRecord({
        catalog_number: null,
        company_name: 'Olympus Medical Systems Corp.',
        version_or_model_number: 'MODEL-200',
      }),
    ])
    const result = await acquireUdiEvidence({
      product: product({ catalog_number: null, ...identifiers }),
      backlog: null,
      client: api.client,
    })

    expect(result.identity_match_method).toBe(method)
    expect(result.identity_conflict).toBe(false)
    expect(result.records[0].exact_identity).toBe(true)
  })

  it('detects an adjacent SKU returned by an analyzed catalog search', async () => {
    const api = clientReturning([
      udiRecord({ record_key: 'RK-EXACT', catalog_number: 'CAT100' }),
      udiRecord({ record_key: 'RK-ADJACENT', catalog_number: 'CAT101' }),
    ])
    const result = await acquireUdiEvidence({
      product: product({ catalog_number: 'CAT100' }),
      backlog: null,
      client: api.client,
    })

    expect(result.identity_match_method).toBe('exact_manufacturer_catalog_number')
    expect(result.records.map((record) => record.record_key)).toEqual(['RK-EXACT'])
    expect(result.adjacent_sku_excluded).toBe(false)
  })

  it('does not collapse punctuation-distinct catalog identifiers into an exact identity', async () => {
    const api = clientReturning([
      udiRecord({
        record_key: 'RK-PUNCTUATION-COLLISION',
        company_name: 'Olympus Medical Systems Corp.',
        catalog_number: '82520-1041',
      }),
    ])
    const result = await acquireUdiEvidence({
      product: product({ catalog_number: '82520.1041' }),
      backlog: null,
      client: api.client,
    })

    expect(result.identity_match_method).toBe('family_or_name_only')
    expect(result.records[0].exact_identity).toBe(false)
    expect(result.configurations).toEqual([])
    expect(result.adjacent_sku_excluded).toBe(false)
  })

  it('retains mixed base, package, and unit-of-use configurations with package details', async () => {
    const api = clientReturning([
      udiRecord({
        identifiers: [
          { id: 'DI-BASE', type: 'Primary' },
          {
            id: 'PKG-10',
            type: 'Package',
            quantity_per_package: '10',
            package_status: 'Not in Commercial Distribution',
            package_discontinue_date: '2025-12-31',
            package_type: 'Box',
          },
          {
            id: 'UNIT-1',
            type: 'Unit of Use',
            quantity_per_package: '1',
            package_status: 'In Commercial Distribution',
          },
        ],
      }),
    ])
    const result = await acquireUdiEvidence({
      product: product({ catalog_number: null, gtin: 'DI-BASE' }),
      backlog: null,
      client: api.client,
    })

    expect(result.records[0].identifiers).toContainEqual(
      expect.objectContaining({
        id: 'PKG-10',
        type: 'Package',
        quantity_per_package: '10',
        package_status: 'Not in Commercial Distribution',
        package_discontinue_date: '2025-12-31',
        package_type: 'Box',
      }),
    )
    expect(result.configurations).toEqual([
      {
        configuration_id: 'DI-BASE',
        identifier_type: 'primary',
        exact_identity: true,
        distribution_status: 'in_distribution',
      },
      {
        configuration_id: 'PKG-10',
        identifier_type: 'package',
        exact_identity: true,
        distribution_status: 'not_in_distribution',
      },
      {
        configuration_id: 'UNIT-1',
        identifier_type: 'unit_of_use',
        exact_identity: true,
        distribution_status: 'in_distribution',
      },
    ])
  })

  it('paginates through every result and marks the exact configuration inventory complete', async () => {
    const firstPage = [
      udiRecord({ record_key: 'RK-PAGE-1', identifiers: [{ id: 'DI-PAGE', type: 'Primary' }] }),
      ...Array.from({ length: 99 }, (_, index) =>
        udiRecord({
          record_key: `RK-NOISE-${String(index).padStart(2, '0')}`,
          identifiers: [{ id: `NOISE-${index}`, type: 'Primary' }],
        }),
      ),
    ]
    const secondPage = [
      udiRecord({
        record_key: 'RK-PAGE-2',
        identifiers: [
          { id: 'DI-PAGE', type: 'Primary' },
          { id: 'PKG-PAGE', type: 'Package', package_status: 'In Commercial Distribution' },
        ],
      }),
    ]
    const api = mockClient((request) => {
      const second = request.skip === 100
      return clientResult(second ? secondPage : firstPage, {
        resultTotal: 101,
        rawCacheReference: `mock-cache:page-${request.skip ?? 0}.json`,
        responseSha256: (second ? '2' : '1').repeat(64),
        retrievedAt: second ? '2026-08-13T18:01:00.000Z' : RETRIEVED_AT,
      })
    })
    const result = await acquireUdiEvidence({
      product: product({ catalog_number: null, gtin: 'DI-PAGE' }),
      backlog: null,
      client: api.client,
    })

    expect(api.request.mock.calls.map(([request]) => request.skip)).toEqual([0, 100])
    expect(result.records.map((record) => record.record_key)).toEqual(['RK-PAGE-1', 'RK-PAGE-2'])
    expect(result.records.map((record) => record.response_provenance)).toEqual([
      [
        expect.objectContaining({
          request_search: 'identifiers.id:"DI-PAGE"',
          request_skip: 0,
          retrieved_at: RETRIEVED_AT,
          response_sha256: '1'.repeat(64),
          raw_cache_reference: 'mock-cache:page-0.json',
        }),
      ],
      [
        expect.objectContaining({
          request_search: 'identifiers.id:"DI-PAGE"',
          request_skip: 100,
          retrieved_at: '2026-08-13T18:01:00.000Z',
          response_sha256: '2'.repeat(64),
          raw_cache_reference: 'mock-cache:page-100.json',
        }),
      ],
    ])
    expect(result.queries[0]).toMatchObject({
      raw_result_count: 101,
      exact_result_count: 2,
      result_total: 101,
      truncated: false,
    })
    expect(result.configurations).toContainEqual(
      expect.objectContaining({ configuration_id: 'PKG-PAGE', identifier_type: 'package' }),
    )
    expect(result.all_exact_configurations_retrieved).toBe(true)
    expect(result.metrics.pages).toBe(2)
  })

  it('treats a completed no-result search as no evidence, not an error or negative status', async () => {
    const api = emptyClient()
    const result = await acquireUdiEvidence({
      product: product({ catalog_number: null, gtin: 'DI-NONE' }),
      backlog: null,
      client: api.client,
    })

    expect(result).toMatchObject({
      identity_match_method: 'none',
      records: [],
      configurations: [],
      search_completed: true,
      all_exact_configurations_retrieved: true,
      query_errors: [],
    })
    expect(result.queries[0]).toMatchObject({
      raw_result_count: 0,
      exact_result_count: 0,
      result_total: 0,
      error: null,
    })
  })

  it('captures a malformed-client failure as an incomplete query without throwing', async () => {
    const api = mockClient(async () => {
      throw new Error('Malformed openFDA client response')
    })
    const result = await acquireUdiEvidence({
      product: product({ catalog_number: null, gtin: 'DI-ERROR' }),
      backlog: null,
      client: api.client,
    })

    expect(result.search_completed).toBe(false)
    expect(result.all_exact_configurations_retrieved).toBe(false)
    expect(result.query_errors).toEqual(['Malformed openFDA client response'])
    expect(result.queries[0].error).toBe('Malformed openFDA client response')
  })
})

describe('supplemental FDA evidence acquisition', () => {
  it('keeps current registration/listing evidence separate from marketing authorization', async () => {
    const registration = clientReturning([
      {
        record_key: 'REG-1',
        k_number: 'K230001',
        registration: {
          status_code: '1',
          registration_number: '3012345678',
          name: 'Example Establishment',
        },
        proprietary_name: ['Example Device'],
        products: [{ product_code: 'NOU' }],
      },
    ])
    const clearance = emptyClient()
    const pma = emptyClient()
    const classification = emptyClient()
    const result = await acquireSupplementalEvidence({
      udi: acquiredUdi({ submissions: ['K230001'] }),
      clients: {
        registration: registration.client,
        clearance: clearance.client,
        pma: pma.client,
        classification: classification.client,
      },
    })

    expect(result.registration).toMatchObject({
      match_scope: 'exact_product',
      listing_status: 'current',
      establishment_registration_current: true,
      conflict: false,
    })
    expect(result.registration.records[0]).toMatchObject({
      registration_number: '3012345678',
      linked_submission_numbers: ['K230001'],
      match_scope: 'exact_product',
    })
    expect(result.authorization).toMatchObject({
      finding: 'not_found',
      submission_numbers: [],
      records: [],
    })
    expect(result.sources.map((source) => source.source_layer)).toEqual(['registration_listing'])
    expect(result.sources[0]).toMatchObject({
      exact_query: 'k_number:"K230001"',
      retrieved_at: RETRIEVED_AT,
      response_sha256: '0'.repeat(64),
      raw_cache_reference: 'mock-cache:response.json',
    })
    expect(new URL(result.sources[0].source_url).searchParams.get('search')).toBe(
      result.sources[0].exact_query,
    )
    expect(result.registration.records[0].source_ids).toEqual([result.sources[0].source_id])
  })

  it('records premarket exemption separately without inventing a product-specific submission', async () => {
    const registration = emptyClient()
    const clearance = emptyClient()
    const pma = emptyClient()
    const classification = clientReturning([
      {
        product_code: 'NOU',
        submission_type_id: '4',
      },
    ])
    const result = await acquireSupplementalEvidence({
      udi: acquiredUdi({ productCodes: ['NOU'], premarketExempt: true }),
      clients: {
        registration: registration.client,
        clearance: clearance.client,
        pma: pma.client,
        classification: classification.client,
      },
    })

    expect(result.authorization.finding).toBe('premarket_exempt')
    expect(result.authorization.submission_numbers).toEqual([])
    expect(result.authorization.records).toEqual([
      expect.objectContaining({
        pathway: 'premarket_exempt',
        submission_number: null,
        product_code: 'NOU',
        match_scope: 'product_code_or_classification_only',
      }),
    ])
    expect(result.registration.match_scope).toBe('none')
  })

  it('retains only labeler-matched context from a broad product-code listing search', async () => {
    const registration = clientReturning([
      {
        record_key: 'REG-OLYMPUS',
        registration: {
          status_code: '1',
          registration_number: '8010047',
          name: 'OLYMPUS',
        },
        proprietary_name: ['Example Device'],
        products: [{ product_code: 'NOU' }],
      },
      {
        record_key: 'REG-UNRELATED',
        registration: {
          status_code: '1',
          registration_number: '9999999',
          name: 'Unrelated Manufacturer',
        },
        proprietary_name: ['Different Device'],
        products: [{ product_code: 'NOU' }],
      },
    ])
    const result = await acquireSupplementalEvidence({
      udi: acquiredUdi({ productCodes: ['NOU'] }),
      clients: {
        registration: registration.client,
        clearance: emptyClient().client,
        pma: emptyClient().client,
        classification: emptyClient().client,
      },
    })

    expect(result.registration.match_scope).toBe('family_or_proprietary_name')
    expect(result.registration.records.map((record) => record.record_key)).toEqual(['REG-OLYMPUS'])
  })

  it('retains scoped listing context but marks a truncated product-code search incomplete', async () => {
    const registration = mockClient(() =>
      clientResult(
        [
          {
            record_key: 'REG-OLYMPUS',
            registration: {
              status_code: '1',
              registration_number: '8010047',
              name: 'OLYMPUS',
            },
            proprietary_name: [],
            products: [{ product_code: 'NOU' }],
          },
        ],
        { resultTotal: 2 },
      ),
    )
    const result = await acquireSupplementalEvidence({
      udi: acquiredUdi({ productCodes: ['NOU'] }),
      clients: {
        registration: registration.client,
        clearance: emptyClient().client,
        pma: emptyClient().client,
        classification: emptyClient().client,
      },
    })

    expect(registration.request).toHaveBeenCalledTimes(1)
    expect(result.registration).toMatchObject({
      search_completed: false,
      snapshot_current: true,
      match_scope: 'family_or_proprietary_name',
      listing_status: 'current',
    })
    expect(result.registration.records.map((record) => record.record_key)).toEqual(['REG-OLYMPUS'])
    expect(result.authorization.search_completed).toBe(true)
    expect(result.query_errors).toContain('result_set_truncated')
    expect(result.query_issues).toEqual([
      {
        layer: 'registration_listing',
        endpoint: 'device/registrationlisting',
        exact_query: 'products.product_code:"NOU"',
        message: 'result_set_truncated',
      },
    ])
  })

  it.each([
    ['K230001', 'clearance', 'k_number', 'exact_510k_clearance', '510k'],
    ['DEN230001', 'clearance', 'k_number', 'exact_de_novo_grant', 'de_novo'],
    ['P230001', 'pma', 'pma_number', 'exact_pma_approval', 'pma'],
  ] as const)(
    'routes %s to the %s client and preserves its pathway',
    async (submission, targetClient, field, finding, pathway) => {
      const registration = emptyClient()
      const clearance = emptyClient()
      const pma = emptyClient()
      const classification = emptyClient()
      const target = targetClient === 'clearance' ? clearance : pma
      target.request.mockImplementation(async (input) =>
        withRequestProvenance(
          clientResult([
            {
              [field]: submission,
              decision_code: 'SE',
              decision_date: '2026-01-15',
              product_code: 'NOU',
            },
          ]),
          input,
        ),
      )

      const result = await acquireSupplementalEvidence({
        udi: acquiredUdi({ submissions: [submission] }),
        clients: {
          registration: registration.client,
          clearance: clearance.client,
          pma: pma.client,
          classification: classification.client,
        },
      })

      expect(target.request).toHaveBeenCalledTimes(1)
      expect(target.request.mock.calls[0][0].search).toBe(`${field}:"${submission}"`)
      expect(result.authorization.finding).toBe(finding)
      expect(result.authorization.records).toEqual([
        expect.objectContaining({
          pathway,
          submission_number: submission,
          decision_date: '2026-01-15',
          match_scope: 'exact_product',
        }),
      ])
      expect(result.registration.listing_status).toBe('unknown')
    },
  )
})
