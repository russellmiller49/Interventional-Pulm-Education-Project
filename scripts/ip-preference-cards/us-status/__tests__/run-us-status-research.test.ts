import type { UdiRecordEvidence } from '../acquire-fda-evidence'
import type { UsStatusEvidenceSource } from '../proposal-schemas'
import { allSourcesTraceable, buildUdiSources, datasetSnapshots } from '../run-us-status-research'

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
