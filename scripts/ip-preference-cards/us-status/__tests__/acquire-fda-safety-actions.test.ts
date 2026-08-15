import type { OpenFdaClient, OpenFdaClientRequest, OpenFdaClientResult } from '../../openfda/client'
import type { OpenFdaRecord } from '../../openfda/types'
import {
  acquireSafetyActionEvidence,
  normalizeSafetyDate,
  reduceSafetyActionState,
  safetyActionScopeFor,
  safetyStatusDisposition,
  safetyTextTokens,
  textContainsExactIdentifier,
  type SafetyActionRecordEvidence,
} from '../acquire-fda-safety-actions'

const RETRIEVED_AT = '2026-08-14T12:00:00.000Z'
const DATASET_LAST_UPDATED = '2026-08-05T00:00:00.000Z'

/**
 * The three exact ERBE flexible cryoprobe SKUs subject to FDA recall event 98429.
 *
 * `code_info` cites the package DI (a box of five) while the catalog row carries the each/primary
 * DI, so the REF number in `product_description` and the package DI of the exact device are the
 * two governed ties. Adjacent SKUs must not be captured by either.
 */
const ERBE_FIXTURES = [
  {
    productId: 'PRD-A2C49C9352',
    ref: '20402-401',
    primaryDi: '04050147021778',
    packageDi: '04050147021785',
    recallNumber: 'Z-1566-2026',
    description:
      'Flexible Cryoprobe (OD 1.1mm, L1.15mm) w/ oversheath (OD2.6mm, L817mm) REF: 20402-401 STERILE EO.  For surgical use',
  },
  {
    productId: 'PRD-7DC3645CFA',
    ref: '20402-410',
    primaryDi: '04050147021815',
    packageDi: '04050147021822',
    recallNumber: 'Z-1567-2026',
    description: 'Flexible Cryoprobe (OD 1.7mm, L1.15mm)  REF: 20402-410. For surgical use',
  },
  {
    productId: 'PRD-05670F1B5F',
    ref: '20402-411',
    primaryDi: '04050147021839',
    packageDi: '04050147021846',
    recallNumber: 'Z-1568-2026',
    description: 'Flexible Cryoprobe (OD 2.4mm, L1.15mm)  REF: 20402-411. For surgical use',
  },
] as const

function enforcementRecord(
  fixture: (typeof ERBE_FIXTURES)[number],
  overrides: Partial<OpenFdaRecord> = {},
): OpenFdaRecord {
  return {
    status: 'Ongoing',
    classification: 'Class I',
    product_type: 'Devices',
    event_id: '98429',
    recalling_firm: 'Erbe USA Inc',
    distribution_pattern: 'US Nationwide distribution, including Puerto Rico.',
    recall_number: fixture.recallNumber,
    product_description: fixture.description,
    reason_for_recall: 'Probes may rupture/burst during activation',
    recall_initiation_date: '20260212',
    center_classification_date: '20260320',
    report_date: '20260401',
    code_info: `UDI: ${fixture.packageDi}/ Expanded Lots:WO472498 WO472499 WO472615 WO472616; Initial Lots: WO461840 WO461846`,
    ...overrides,
  }
}

function recallRecord(
  fixture: (typeof ERBE_FIXTURES)[number],
  overrides: Partial<OpenFdaRecord> = {},
): OpenFdaRecord {
  return {
    cfres_id: '218707',
    product_res_number: fixture.recallNumber,
    event_date_initiated: '2026-02-12',
    event_date_posted: '2026-03-20',
    recall_status: 'Open, Classified',
    res_event_number: '98429',
    product_code: 'GEH',
    k_numbers: ['K190651'],
    product_description: fixture.description,
    code_info: `UDI: ${fixture.packageDi}/\nExpanded Lots: WO472498 WO472499`,
    ...overrides,
  }
}

function clientResult(records: OpenFdaRecord[]): OpenFdaClientResult {
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
    requestUrl: 'https://api.fda.gov/device/enforcement.json?search=mock',
    requestSearch: 'mock',
    requestLimit: 100,
    requestSkip: 0,
    responseSha256: '0'.repeat(64),
    rawCacheReference:
      'local-data/ip-preference-cards/us-status/2026-08-14/openfda/enforcement/' +
      `${'a'.repeat(64)}.json`,
    ...{},
  }
}

function mockClient(
  handler: (request: OpenFdaClientRequest) => OpenFdaClientResult | Promise<OpenFdaClientResult>,
) {
  const request = jest.fn(async (input: OpenFdaClientRequest) => {
    const result = await handler(input)
    const parameters = new URLSearchParams({ search: input.search, limit: String(input.limit) })
    return {
      ...result,
      requestUrl: `https://api.fda.gov/device/mock.json?${parameters.toString()}`,
      requestSearch: input.search,
      requestLimit: input.limit,
      requestSkip: input.skip ?? 0,
      rawCacheReference: `${result.rawCacheReference.replace(/[^/]+\.json$/, '')}${'b'.repeat(64)}.json`,
    }
  })
  return { client: { request } as unknown as OpenFdaClient, request }
}

function throwingClient(message: string) {
  return mockClient(() => {
    throw new Error(message)
  })
}

function record(overrides: Partial<SafetyActionRecordEvidence> = {}): SafetyActionRecordEvidence {
  return {
    system: 'device_enforcement',
    recall_number: 'Z-1000-2026',
    event_id: '1',
    recall_status: 'Ongoing',
    status_disposition: 'active',
    classification: 'Class I',
    recalling_firm: 'Example',
    product_description: 'Example device REF: CAT-1',
    reason_for_recall: 'Example',
    initiation_date: '2026-01-01',
    posted_date: '2026-01-15',
    report_date: null,
    termination_date: null,
    product_code: 'ABC',
    submission_numbers: [],
    match_scope: 'exact_product',
    matched_identifiers: ['CAT-1'],
    match_basis: 'exact_identifier_in_official_fda_device_enforcement_record',
    scope: 'lot_specific',
    affected_lot_identifier_count: 2,
    code_info_excerpt: 'Lots: WO111111 WO222222',
    exact_query: 'product_description:"CAT-1"',
    source_ids: ['safety-device_enforcement:response-x'],
    ...overrides,
  }
}

describe('official FDA safety-action acquisition', () => {
  describe('exact identifier matching', () => {
    it('ties a recall to the exact REF number in the product description', () => {
      expect(
        textContainsExactIdentifier(
          'Flexible Cryoprobe (OD 2.4mm, L1.15mm)  REF: 20402-411. For surgical use',
          '20402-411',
        ),
      ).toBe(true)
    })

    it('does not capture an adjacent SKU', () => {
      const description = 'Flexible Cryoprobe (OD 2.4mm, L1.15mm)  REF: 20402-411. For surgical use'
      expect(textContainsExactIdentifier(description, '20402-410')).toBe(false)
      expect(textContainsExactIdentifier(description, '20402-401')).toBe(false)
      expect(textContainsExactIdentifier(description, '20402-4110')).toBe(false)
    })

    it('matches a package DI recorded in code_info', () => {
      expect(
        textContainsExactIdentifier(
          'UDI: 04050147021846/ Expanded Lots:WO472498',
          '04050147021846',
        ),
      ).toBe(true)
      expect(
        textContainsExactIdentifier(
          'UDI: 04050147021846/ Expanded Lots:WO472498',
          '04050147021839',
        ),
      ).toBe(false)
    })

    it('refuses to match on a short identifier that would collide with unrelated text', () => {
      expect(textContainsExactIdentifier('Recalled lot 10 of device 55', '10')).toBe(false)
      expect(safetyTextTokens('UDI: 12345/ Lots: A1 B2')).toEqual([
        'UDI',
        '12345',
        'Lots',
        'A1',
        'B2',
      ])
    })

    it('matches a device identifier when FDA omits the space after the code_info separator', () => {
      // Observed verbatim in recall Z-1567-2026.
      expect(
        textContainsExactIdentifier(
          'UDI: 04050147021822/Expanded Lots: WO472495',
          '04050147021822',
        ),
      ).toBe(true)
    })
  })

  describe('status and scope semantics', () => {
    it.each([
      ['Ongoing', null, 'active'],
      ['Open, Classified', null, 'active'],
      ['Pending', null, 'active'],
      ['Terminated', null, 'historical'],
      ['Completed', null, 'historical'],
      ['Ongoing', '2026-05-01', 'historical'],
      ['Something new', null, 'unknown'],
    ] as const)('maps status %s to %s', (status, termination, expected) => {
      expect(safetyStatusDisposition(status, termination)).toBe(expected)
    })

    it('treats enumerated lots as lot-specific rather than product-wide', () => {
      expect(safetyActionScopeFor('UDI: 040.../ Expanded Lots: WO472498 WO472499', 2)).toBe(
        'lot_specific',
      )
      expect(safetyActionScopeFor('All lots and serial numbers are affected.', 0)).toBe(
        'product_wide',
      )
      expect(safetyActionScopeFor(null, 0)).toBe('unknown')
    })

    it('normalizes both FDA date encodings', () => {
      expect(normalizeSafetyDate('20260212')).toBe('2026-02-12')
      expect(normalizeSafetyDate('2026-02-12')).toBe('2026-02-12')
      expect(normalizeSafetyDate('')).toBeNull()
    })
  })

  describe('state reduction', () => {
    it('reports an active exact action when any exact record is open', () => {
      expect(reduceSafetyActionState([record()], 'searched')).toEqual({
        action_state: 'active_exact_product_action',
        action_scope: 'lot_specific',
      })
    })

    it('reports a historical exact action when every exact record is closed', () => {
      expect(
        reduceSafetyActionState(
          [record({ status_disposition: 'historical', termination_date: '2026-06-01' })],
          'searched',
        ).action_state,
      ).toBe('historical_exact_product_action')
    })

    it('never claims an exact action from family-only evidence', () => {
      expect(
        reduceSafetyActionState(
          [
            record({
              match_scope: 'family_or_proprietary_name',
              matched_identifiers: [],
              scope: 'family_level',
            }),
          ],
          'searched',
        ),
      ).toEqual({ action_state: 'family_or_ambiguous_action', action_scope: 'family_level' })
    })

    it('reports no exact action found only for a completed search', () => {
      expect(reduceSafetyActionState([], 'searched').action_state).toBe('no_exact_action_found')
      expect(reduceSafetyActionState([], 'not_searched').action_state).toBe('unknown')
      expect(reduceSafetyActionState([], 'query_error').action_state).toBe('unknown')
    })

    it('resolves a cross-endpoint status disagreement to unknown rather than picking a side', () => {
      const conflicting = [
        record({ system: 'device_enforcement', status_disposition: 'active' }),
        record({ system: 'device_recall', status_disposition: 'historical' }),
      ]
      expect(reduceSafetyActionState(conflicting, 'searched').action_state).toBe('unknown')
    })
  })

  describe('ERBE recall event 98429 fixture', () => {
    it.each(ERBE_FIXTURES)(
      'pins $productId (REF $ref) to $recallNumber as an active lot-specific exact action',
      async (fixture) => {
        const enforcement = mockClient((request) =>
          clientResult(
            request.search.includes(fixture.ref) || request.search.includes(fixture.packageDi)
              ? [enforcementRecord(fixture)]
              : [],
          ),
        )
        const recall = mockClient((request) =>
          clientResult(
            request.search.includes(fixture.ref) ||
              request.search.includes(fixture.packageDi) ||
              request.search.includes('K190651')
              ? [recallRecord(fixture)]
              : [],
          ),
        )

        const result = await acquireSafetyActionEvidence({
          exactIdentifiers: [fixture.ref, fixture.primaryDi, fixture.packageDi],
          submissionNumbers: ['K190651'],
          clients: { enforcement: enforcement.client, recall: recall.client },
        })

        expect(result.search_status).toBe('searched')
        expect(result.action_state).toBe('active_exact_product_action')
        expect(result.action_scope).toBe('lot_specific')
        expect(result.exact_action_sources_traceable).toBe(true)

        const exact = result.records.filter((entry) => entry.match_scope === 'exact_product')
        expect(exact.map((entry) => entry.recall_number).sort()).toEqual([
          fixture.recallNumber,
          fixture.recallNumber,
        ])
        for (const entry of exact) {
          expect(entry.event_id).toBe('98429')
          expect(entry.status_disposition).toBe('active')
          expect(entry.initiation_date).toBe('2026-02-12')
          expect(entry.termination_date).toBeNull()
          expect(entry.scope).toBe('lot_specific')
          expect(entry.matched_identifiers).toContain(fixture.ref)
          expect(entry.source_ids.length).toBeGreaterThan(0)
        }
        // Classification is an enforcement-report field; the RES record does not carry one.
        const enforcementRow = exact.find((entry) => entry.system === 'device_enforcement')
        expect(enforcementRow?.classification).toBe('Class I')
        expect(enforcementRow?.recall_status).toBe('Ongoing')
        // The RES record carries the posted date and the linked clearance.
        const resRecord = exact.find((entry) => entry.system === 'device_recall')
        expect(resRecord?.classification).toBeNull()
        expect(resRecord?.recall_status).toBe('Open, Classified')
        expect(resRecord?.posted_date).toBe('2026-03-20')
        expect(resRecord?.submission_numbers).toEqual(['K190651'])
        // No other product's recall number leaks in.
        const otherNumbers = ERBE_FIXTURES.filter((row) => row.ref !== fixture.ref).map(
          (row) => row.recallNumber,
        )
        expect(result.records.map((entry) => entry.recall_number)).not.toEqual(
          expect.arrayContaining(otherNumbers),
        )
      },
    )

    it('classifies a same-clearance different-product recall as family-only', async () => {
      const consoleRecall: OpenFdaRecord = {
        product_res_number: 'Z-2938-2026',
        res_event_number: '99001',
        recall_status: 'Open, Classified',
        event_date_initiated: '2026-04-01',
        event_date_posted: '2026-05-01',
        product_code: 'GEH',
        k_numbers: ['K190651'],
        product_description: 'ERBECRYO 2 Cryosurgical Unit',
        code_info: 'All units',
      }
      const enforcement = mockClient(() => clientResult([]))
      const recall = mockClient((request) =>
        clientResult(request.search.includes('K190651') ? [consoleRecall] : []),
      )

      const result = await acquireSafetyActionEvidence({
        exactIdentifiers: ['20402-411', '04050147021839'],
        submissionNumbers: ['K190651'],
        clients: { enforcement: enforcement.client, recall: recall.client },
      })

      expect(result.action_state).toBe('family_or_ambiguous_action')
      expect(result.action_scope).toBe('family_level')
      expect(result.records).toHaveLength(1)
      expect(result.records[0]).toMatchObject({
        recall_number: 'Z-2938-2026',
        match_scope: 'family_or_proprietary_name',
        matched_identifiers: [],
        scope: 'family_level',
      })
    })
  })

  describe('search completeness', () => {
    it('records a completed search with no exact result and keeps the query traceable', async () => {
      const enforcement = mockClient(() => clientResult([]))
      const recall = mockClient(() => clientResult([]))

      const result = await acquireSafetyActionEvidence({
        exactIdentifiers: ['CAT-99999'],
        submissionNumbers: [],
        clients: { enforcement: enforcement.client, recall: recall.client },
      })

      expect(result.search_status).toBe('searched')
      expect(result.action_state).toBe('no_exact_action_found')
      expect(result.records).toEqual([])
      // A searched absence still has to be provable.
      expect(result.sources.length).toBeGreaterThan(0)
      expect(result.sources.every((source) => source.response_sha256.length === 64)).toBe(true)
    })

    it('reports a query error instead of an absence when an endpoint fails', async () => {
      const enforcement = throwingClient('openFDA request timed out')
      const recall = mockClient(() => clientResult([]))

      const result = await acquireSafetyActionEvidence({
        exactIdentifiers: ['CAT-99999'],
        submissionNumbers: [],
        clients: { enforcement: enforcement.client, recall: recall.client },
      })

      expect(result.search_status).toBe('query_error')
      expect(result.action_state).toBe('unknown')
      expect(result.action_state).not.toBe('no_exact_action_found')
      expect(result.query_issues).toHaveLength(1)
      expect(result.query_issues[0].message).toContain('timed out')
    })

    it('does not search when no identifier is long enough for a reliable exact tie', async () => {
      const enforcement = mockClient(() => clientResult([]))
      const recall = mockClient(() => clientResult([]))

      const result = await acquireSafetyActionEvidence({
        exactIdentifiers: ['12', '5'],
        submissionNumbers: [],
        clients: { enforcement: enforcement.client, recall: recall.client },
      })

      expect(result.search_status).toBe('not_searched')
      expect(result.action_state).toBe('unknown')
      expect(result.skipped_short_identifiers).toEqual(['12', '5'])
      expect(enforcement.request).not.toHaveBeenCalled()
      expect(recall.request).not.toHaveBeenCalled()
    })
  })
})
