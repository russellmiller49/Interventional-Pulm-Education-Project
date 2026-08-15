import type { UdiRecordEvidence } from '../acquire-fda-evidence'
import type { SafetyActionRecordEvidence } from '../acquire-fda-safety-actions'
import type { ManufacturerSourceManifest } from '../fetch-manufacturer-sources'
import type { UsStatusEvidenceSource } from '../proposal-schemas'
import {
  allSourcesTraceable,
  buildUdiSources,
  datasetSnapshots,
  distinctRecallNumbers,
  evaluateManufacturerSources,
  exactSafetyActionReferences,
  researchInputHashes,
  safetyReviewSummary,
} from '../run-us-status-research'
import type { HiddenProductCohortRow } from '../types'

const SEARCH = 'catalog_number:"CAT-100"'
const REQUEST_URL = `https://api.fda.gov/device/udi.json?search=${encodeURIComponent(SEARCH)}&limit=100`
const RAW_CACHE_REFERENCE = `local-data/ip-preference-cards/us-status/2026-08-13/openfda/udi/${'1'.repeat(64)}.json`

function fdaSource(overrides: Partial<UsStatusEvidenceSource> = {}): UsStatusEvidenceSource {
  return {
    source_id: 'openfda-udi:PRD-TEST:RK-1:response-cache',
    layer: 'udi_distribution',
    source_type: 'official_fda_api',
    endpoint: 'device/udi',
    url: REQUEST_URL,
    publisher: 'U.S. Food and Drug Administration',
    title: 'GUDID device-identification record RK-1',
    as_of_date: '2026-08-03',
    retrieved_at: '2026-08-13T18:00:00.000Z',
    content_sha256: 'a'.repeat(64),
    request_search: SEARCH,
    raw_cache_reference: RAW_CACHE_REFERENCE,
    identity_scope: 'exact_product',
    temporal_scope: 'current',
    retrieval_status: 'retrieved',
    us_specific: true,
    exact_identifier_text: ['CAT-100'],
    factual_summary: 'Manufacturer-submitted UDI identity record.',
    ...overrides,
  }
}

function udiRecord(): UdiRecordEvidence {
  return {
    record_key: 'RK-1',
    public_device_record_key: 'PUBLIC-RK-1',
    primary_di: '00012345678905',
    identifiers: [],
    company_name: 'Example Manufacturer',
    brand_name: 'Example Device',
    catalog_number: 'CAT-100',
    version_or_model_number: 'CAT-100',
    commercial_distribution_status: 'In Commercial Distribution',
    commercial_distribution_end_date: null,
    record_status: 'Published',
    public_version_date: '2026-08-01',
    publish_date: '2026-08-02',
    product_codes: [],
    premarket_submissions: [],
    premarket_exempt: false,
    exact_identity: true,
    match_basis: ['exact_catalog_and_reviewed_manufacturer_alias'],
    exact_queries: [SEARCH],
    retrieved_at: ['2026-08-13T18:00:00.000Z'],
    raw_cache_references: [RAW_CACHE_REFERENCE],
    response_provenance: [
      {
        request_url: REQUEST_URL,
        request_search: SEARCH,
        request_limit: 100,
        request_skip: 0,
        retrieved_at: '2026-08-13T18:00:00.000Z',
        response_sha256: 'a'.repeat(64),
        raw_cache_reference: RAW_CACHE_REFERENCE,
      },
    ],
  }
}

describe('current-U.S.-status FDA provenance', () => {
  it('builds a source from one coherent cached response tuple', () => {
    const sources = buildUdiSources('PRD-TEST', udiRecord(), '2026-08-03')

    expect(sources).toHaveLength(1)
    expect(sources[0]).toMatchObject({
      url: REQUEST_URL,
      retrieved_at: '2026-08-13T18:00:00.000Z',
      content_sha256: 'a'.repeat(64),
      request_search: SEARCH,
      raw_cache_reference: RAW_CACHE_REFERENCE,
    })
    expect(new URL(sources[0].url).searchParams.get('search')).toBe(sources[0].request_search)
  })

  it('requires hash, exact query alignment, and portable cache reference for traceability', () => {
    expect(allSourcesTraceable([fdaSource()])).toBe(true)
    expect(allSourcesTraceable([])).toBe(false)
    expect(allSourcesTraceable([fdaSource({ content_sha256: null })])).toBe(false)
    expect(allSourcesTraceable([fdaSource({ raw_cache_reference: null })])).toBe(false)
    expect(
      allSourcesTraceable([
        fdaSource({
          raw_cache_reference: 'C:/private/openfda/cache.json',
        }),
      ]),
    ).toBe(false)
    expect(
      allSourcesTraceable([
        fdaSource({
          url: `https://api.fda.gov/device/udi.json?search=${encodeURIComponent('catalog_number:"OTHER"')}&limit=100`,
        }),
      ]),
    ).toBe(false)
  })
})

describe('manufacturer dataset snapshots', () => {
  const EMPTY_BODY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

  function manufacturerRow(overrides: Record<string, unknown> = {}) {
    return {
      catalog_source_id: 'SRC017',
      source_url: 'https://example-manufacturer.test/catalog.pdf',
      publication_or_revision_date: '2026-01-15',
      retrieved_at: '2026-08-13T18:00:00.000Z',
      http_status: 200,
      http_ok: true,
      body_sha256: 'b'.repeat(64),
      ...overrides,
    }
  }

  function snapshotFor(overrides: Record<string, unknown> = {}) {
    const rows = datasetSnapshots(
      [],
      {
        sources: [manufacturerRow(overrides)],
        unique_url_count: 1,
      } as never,
      '2026-08-13',
    )
    return rows[0]
  }

  it('counts a successfully retrieved manufacturer document as one record', () => {
    expect(snapshotFor()).toMatchObject({
      layer: 'manufacturer',
      content_sha256: 'b'.repeat(64),
      record_count: 1,
    })
  })

  it('never represents an empty response body as a retrieved manufacturer record', () => {
    expect(
      snapshotFor({ http_status: 0, http_ok: false, body_sha256: EMPTY_BODY_SHA256 }),
    ).toMatchObject({ content_sha256: null, record_count: 0 })
  })

  it('does not count a failed fetch even when the body hash is non-empty', () => {
    expect(snapshotFor({ http_status: 404, http_ok: false })).toMatchObject({
      content_sha256: null,
      record_count: 0,
    })
  })
})

describe('research run input provenance', () => {
  const BASE = {
    catalogPath: 'data/ip-preference-cards/generated/catalog-products.json',
    catalogText: '[{"product_id":"PRD-1"}]',
    cohortPath: 'data/ip-preference-cards/research/us-status/2026-08-13/cohort-manifest.json',
    cohortText: '{"products":[]}',
    manufacturerSourceManifestPath:
      'data/ip-preference-cards/research/us-status/2026-08-13/manufacturer-source-snapshot.json',
    manufacturerText: '{"sources":[]}',
    backlogPath: 'data/ip-preference-cards/generated/verification-backlog.json',
    backlogText: '[]',
  }
  const SELECTION_PATH = 'local-data/ip-preference-cards/us-status/selection.json'

  function hashesFor(selection: { path: string; text: string } | null) {
    return researchInputHashes({ ...BASE, selection })
  }

  function entry(hashes: ReturnType<typeof hashesFor>, id: string) {
    return hashes.find((hash) => hash.input_id === id)
  }

  it('records the selection file path and content hash when a selection narrows the cohort', () => {
    const selection = { path: SELECTION_PATH, text: '{"products":[{"product_id":"PRD-1"}]}' }
    const recorded = entry(hashesFor(selection), 'product-selection')

    expect(recorded).toMatchObject({ input_id: 'product-selection', path: SELECTION_PATH })
    expect(recorded?.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('changes the recorded input hash when the selection file bytes change', () => {
    const original = hashesFor({
      path: SELECTION_PATH,
      text: '{"products":[{"product_id":"PRD-1"}]}',
    })
    const edited = hashesFor({
      path: SELECTION_PATH,
      text: '{"products":[{"product_id":"PRD-2"}]}',
    })

    expect(entry(edited, 'product-selection')?.sha256).not.toBe(
      entry(original, 'product-selection')?.sha256,
    )
    // Only the selection moved: every other governed input keeps its identity.
    expect(edited.filter((hash) => hash.input_id !== 'product-selection')).toEqual(
      original.filter((hash) => hash.input_id !== 'product-selection'),
    )
  })

  it('invalidates provenance when the selection is omitted or pointed at a different file', () => {
    const selected = hashesFor({
      path: SELECTION_PATH,
      text: '{"products":[{"product_id":"PRD-1"}]}',
    })
    const omitted = hashesFor(null)
    const relocated = hashesFor({
      path: 'local-data/ip-preference-cards/us-status/other-selection.json',
      text: '{"products":[{"product_id":"PRD-1"}]}',
    })

    // A whole-cohort run must not be indistinguishable from a selected-subset run.
    expect(entry(omitted, 'product-selection')).toBeUndefined()
    expect(JSON.stringify(omitted)).not.toBe(JSON.stringify(selected))
    expect(JSON.stringify(relocated)).not.toBe(JSON.stringify(selected))
    expect(entry(relocated, 'product-selection')?.path).not.toBe(
      entry(selected, 'product-selection')?.path,
    )
  })

  it('keeps input ids unique and sorted so the artifact schema accepts them', () => {
    const hashes = hashesFor({ path: SELECTION_PATH, text: '{"products":[]}' })
    const ids = hashes.map((hash) => hash.input_id)

    expect(ids).toEqual([...ids].sort((left, right) => left.localeCompare(right)))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('reviewer-facing safety references', () => {
  function safetyRecord(
    overrides: Partial<SafetyActionRecordEvidence> = {},
  ): SafetyActionRecordEvidence {
    return {
      system: 'device_enforcement',
      recall_number: 'Z-1566-2026',
      event_id: '98429',
      recall_status: 'Ongoing',
      status_disposition: 'active',
      classification: 'Class I',
      recalling_firm: 'Example Firm',
      product_description: 'Flexible Cryoprobe REF 20402-401',
      reason_for_recall: 'Example reason',
      initiation_date: '2026-02-12',
      posted_date: '2026-03-20',
      report_date: null,
      termination_date: null,
      product_code: 'ABC',
      submission_numbers: ['K190651'],
      match_scope: 'exact_product',
      matched_identifiers: ['20402-401'],
      match_basis: 'exact_identifier_in_official_fda_device_enforcement_record',
      scope: 'lot_specific',
      affected_lot_identifier_count: 3,
      code_info_excerpt: 'Lots A12345',
      exact_query: 'product_description:"20402-401"',
      source_ids: ['safety-device_enforcement:response-cache'],
      ...overrides,
    }
  }

  // Both official FDA systems return the same action, so the acquisition layer keeps one record
  // per system. A reviewer must never see one recall counted as two.
  const bothSystems = [
    safetyRecord(),
    safetyRecord({
      system: 'device_recall',
      matched_identifiers: ['04050147021778'],
      match_basis: 'exact_identifier_in_official_fda_device_recall_record',
      source_ids: ['safety-device_recall:response-cache'],
    }),
  ]

  it('collapses the same recall number reported by both FDA systems into one reference', () => {
    expect(distinctRecallNumbers(bothSystems)).toEqual(['Z-1566-2026'])
    expect(exactSafetyActionReferences({ records: bothSystems } as never)).toEqual([
      { recall_number: 'Z-1566-2026', label: 'Z-1566-2026 (event 98429)' },
    ])
  })

  it('names one recall once in reviewer prose while naming both reporting systems', () => {
    const summary = safetyReviewSummary(
      {
        search_status: 'searched',
        action_state: 'active_exact_product_action',
        action_scope: 'lot_specific',
        records: bothSystems,
      } as never,
      'hold_active_safety_action',
    )

    expect(summary.match(/Z-1566-2026/g)).toHaveLength(1)
    expect(summary).toContain('device_enforcement and device_recall')
    // Nothing is dropped: the union of exact identifiers from both systems is preserved.
    expect(summary).toContain('04050147021778/20402-401')
  })

  it('still reports two genuinely distinct recall numbers separately', () => {
    const records = [
      ...bothSystems,
      safetyRecord({ recall_number: 'Z-1567-2026', matched_identifiers: ['20402-410'] }),
    ]

    expect(distinctRecallNumbers(records)).toEqual(['Z-1566-2026', 'Z-1567-2026'])
  })

  it('shows a disagreement between the two FDA systems rather than hiding it behind one value', () => {
    const disagreeing = [
      safetyRecord({ recall_status: 'Ongoing' }),
      safetyRecord({ system: 'device_recall', recall_status: 'Terminated' }),
    ]

    const summary = safetyReviewSummary(
      {
        search_status: 'searched',
        action_state: 'unknown',
        action_scope: 'lot_specific',
        records: disagreeing,
      } as never,
      'hold_safety_identity_ambiguous',
    )

    expect(summary.match(/Z-1566-2026/g)).toHaveLength(1)
    expect(summary).toContain('Ongoing / Terminated')
  })

  it('excludes family-only safety records from exact-product references', () => {
    const records = [
      ...bothSystems,
      safetyRecord({
        recall_number: 'Z-2938-2026',
        match_scope: 'family_or_proprietary_name',
        matched_identifiers: [],
      }),
    ]

    expect(distinctRecallNumbers(records)).toEqual(['Z-1566-2026'])
  })
})

describe('official manufacturer source evaluation', () => {
  function cohortProduct(): HiddenProductCohortRow {
    return {
      product_id: 'PRD-TEST',
      manufacturer: 'ERBE',
      catalog_number: '20402-411',
      model_number: null,
      gtin_di: null,
      global_part_number: null,
      reference_part_number: null,
      alternate_ids: [],
      source_ids: ['SRC018'],
    } as unknown as HiddenProductCohortRow
  }

  function manifestWith(signal: string): ManufacturerSourceManifest {
    return {
      sources: [
        {
          catalog_source_id: 'SRC018',
          manufacturer: 'ERBE',
          source_url: 'https://us.erbe-med.com/documents/MKT-5074_ERBECRYO-2_2023-06.pdf',
          publisher: 'Erbe USA, Incorporated',
          title: 'ERBECRYO 2 with Flexible Single-Use Cryoprobes',
          publication_or_revision_date: '2023-06',
          us_specific: true,
          current_status_signal: signal,
          factual_summary: 'Identifies the cryoprobes by exact product number.',
          limitations: 'A dated brochure is not a live catalog.',
          retrieved_at: '2026-08-13T18:00:00.000Z',
          http_status: 200,
          http_ok: true,
          content_type: 'application/pdf',
          body_sha256: 'c'.repeat(64),
          text_cache_reference: 'local-data/cache/src018.txt',
        },
      ],
    } as unknown as ManufacturerSourceManifest
  }

  async function evaluate(signal: string) {
    const textCache = new Map<string, Promise<string>>([
      ['local-data/cache/src018.txt', Promise.resolve('Product data 20402-411 cryoprobe 2.4 mm')],
    ])
    return evaluateManufacturerSources(cohortProduct(), manifestWith(signal), textCache)
  }

  it('records an identity-only document as exact identity evidence, never as current distribution', async () => {
    const evaluation = await evaluate('identity_only')

    expect(evaluation.finding).toBe('exact_identity_only_not_current')
    expect(evaluation.exactProductSourceConfirmed).toBe(true)
    // The exact identifier matched, so identity is established...
    expect(evaluation.sources[0].identity_scope).toBe('exact_product')
    // ...but nothing here says the product is distributed today.
    expect(evaluation.currentUsSourceConfirmed).toBe(false)
    expect(evaluation.sources[0].temporal_scope).toBe('undated')
  })

  it('does not report an identity-only or historical document as a current family source', async () => {
    expect((await evaluate('identity_only')).finding).not.toBe('family_only_current')
    expect((await evaluate('historical_only')).finding).not.toBe('family_only_current')
  })

  it('still admits a live current catalog page as a current exact U.S. manufacturer source', async () => {
    const evaluation = await evaluate('current_catalog_or_product_page')

    expect(evaluation.finding).toBe('current_exact_official_us_product')
    expect(evaluation.currentUsSourceConfirmed).toBe(true)
    expect(evaluation.sources[0].temporal_scope).toBe('current')
  })
})
