import type {
  CatalogProductInput,
  ManufacturerAliasGroup,
  OpenFdaMatchedCandidate,
  OpenFdaQueryKind,
  OpenFdaRecord,
  VerificationBacklogInput,
} from '../types'

export function catalogProduct(overrides: Partial<CatalogProductInput> = {}): CatalogProductInput {
  return {
    product_id: 'PRD-TEST-001',
    manufacturer_id: 'MFR-TEST',
    manufacturer: 'Acme Medical',
    product_name: 'Acme Biopsy Device',
    catalog_number: 'CAT-001',
    alternate_ids: null,
    gtin: null,
    global_part_number: null,
    reference_part_number: null,
    brand_family: 'Acme Biopsy',
    verification_status: 'Candidate',
    visibility_state: 'hidden',
    ...overrides,
  }
}

export function verificationBacklog(
  overrides: Partial<VerificationBacklogInput> = {},
): VerificationBacklogInput {
  return {
    product_id: 'PRD-TEST-001',
    priority: 'P0',
    procedures: 'TEST_PROCEDURE',
    roles: 'TEST_ROLE',
    existing_gtin: null,
    suggested_primary_di: null,
    gudid_result: null,
    match_confidence: null,
    distribution_status: null,
    evidence_url: null,
    ...overrides,
  }
}

export const acmeAliasGroup: ManufacturerAliasGroup = {
  canonicalManufacturerId: 'MFR-TEST',
  canonicalName: 'Acme Medical',
  aliases: ['Acme Medical'],
}

export function openFdaRecord(overrides: Partial<OpenFdaRecord> = {}): OpenFdaRecord {
  return {
    public_device_record_key: 'record-001',
    brand_name: 'Acme Biopsy',
    company_name: 'Acme Medical, Inc.',
    catalog_number: 'CAT-001',
    version_or_model_number: 'CAT-001',
    device_description: 'Test biopsy device',
    device_count_in_base_package: 1,
    identifiers: [{ id: '00012345678901', type: 'Primary', issuing_agency: 'GS1' }],
    commercial_distribution_status: 'In Commercial Distribution',
    is_kit: false,
    is_single_use: true,
    public_version_date: '2026-07-01',
    record_status: 'Published',
    ...overrides,
  }
}

export function matchedCandidate(
  record: OpenFdaRecord = openFdaRecord(),
  queryKinds: OpenFdaQueryKind[] = ['catalog_number'],
): OpenFdaMatchedCandidate {
  return {
    record,
    queryKinds,
    querySearches: ['catalog_number:"CAT-001"'],
    retrievedAt: ['2026-07-27T00:00:00.000Z'],
    rawCacheReferences: ['openfda-cache:test.json'],
  }
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const encoded = Buffer.from(JSON.stringify(body), 'utf8')
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
    arrayBuffer: async () =>
      encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength),
  } as Response
}

if (expect.getState().testPath === __filename) {
  describe('openFDA test fixtures', () => {
    it('keeps the primary identifier as a string', () => {
      expect(openFdaRecord().identifiers?.[0].id).toBe('00012345678901')
    })
  })
}

export function openFdaApiResponse(records: OpenFdaRecord[] = [openFdaRecord()]) {
  return {
    meta: { last_updated: '2026-07-27' },
    results: records,
  }
}

/**
 * Sanitized structural fixture based on package-bearing records observed in the
 * 2026-07-28 live calibration. Values are invented; field presence, nesting, and
 * string-vs-boolean shapes mirror the response family without retaining a raw record.
 */
export function sanitizedLivePackageResponse() {
  return {
    meta: {
      disclaimer: 'Sanitized fixture',
      results: { skip: 0, limit: 1, total: 1 },
    },
    results: [
      {
        public_device_record_key: 'sanitized-package-record',
        brand_name: 'Example Device',
        company_name: 'Example Medical Systems Corp.',
        version_or_model_number: 'MODEL-100',
        device_count_in_base_package: 1,
        identifiers: [
          {
            id: '00000000000001',
            type: 'Primary',
            issuing_agency: 'GS1',
          },
          {
            id: '00000000000018',
            type: 'Package',
            issuing_agency: 'GS1',
            unit_of_use_id: '00000000000025',
            quantity_per_package: '5',
            package_status: 'In Commercial Distribution',
            package_type: 'Case',
          },
        ],
        commercial_distribution_status: 'In Commercial Distribution',
        is_kit: false,
        is_single_use: true,
        has_expiration_date: true,
        has_lot_or_batch_number: true,
        has_manufacturing_date: false,
        has_serial_number: false,
        sterilization: {
          is_sterile: 'true',
          is_sterilization_prior_use: 'false',
          sterilization_methods: 'Ethylene Oxide',
        },
        device_sizes: [
          {
            type: 'Catalog description',
            text: 'Example configuration',
          },
        ],
        product_codes: [
          {
            code: 'ZZZ',
            name: 'Sanitized product code',
            openfda: { device_class: '2' },
          },
        ],
        premarket_submissions: [
          {
            submission_number: 'K000000',
            supplement_number: 'S000',
          },
        ],
        gmdn_terms: [
          {
            code: '00000',
            code_status: 'Active',
            definition: 'Sanitized definition',
            implantable: 'false',
            name: 'Sanitized GMDN term',
          },
        ],
        public_version_date: '2026-01-01',
        public_version_number: '1',
        public_version_status: 'New',
        publish_date: '2026-01-01',
        record_status: 'Published',
        has_donation_id_number: 'false',
        is_combination_product: 'false',
      },
    ],
  }
}

export function downloadManifest() {
  return {
    meta: { last_updated: '2026-07-27', additional_future_field: true },
    results: {
      device: {
        udi: {
          export_date: '2026-07-27',
          total_records: 2,
          partitions: [
            {
              display_name: '/device/udi (part 1 of 1)',
              file: 'https://download.open.fda.gov/device/udi/device-udi-0001-of-0001.json.zip',
              size_mb: '0',
              records: 2,
              additional_future_field: 'allowed',
            },
          ],
          additional_future_field: true,
        },
      },
    },
  }
}
