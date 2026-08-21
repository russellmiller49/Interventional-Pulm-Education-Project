import {
  assignCorpusDispositions,
  type DispositionIdentitySets,
} from './source-completeness-dispositions'
import type { ScannerCandidate } from './source-completeness-corpus-scan'
import type { CorpusCandidateOverride, CorpusDocumentRule } from './source-completeness-intake'

function candidate(overrides: Partial<ScannerCandidate>): ScannerCandidate {
  return {
    sourceFilename: 'fixture.pdf',
    relativePath: 'brochures/fixture.pdf',
    sourceSha256: '0'.repeat(64),
    documentPageCount: 4,
    manufacturer: 'Fixture Mfr',
    normalizedIdentifier: 'G00001',
    rawIdentifier: 'G00001',
    firstPage: 1,
    pages: [1],
    occurrenceCount: 1,
    detectionRule: 'inline_identifier',
    confidence: 'moderate',
    headingContext: '',
    lineContext: 'G00001',
    columnHeader: null,
    rowLabel: null,
    pairedIdentifier: null,
    onPairingPage: false,
    column: 0,
    ...overrides,
  }
}

function identities(overrides: Partial<DispositionIdentitySets> = {}): DispositionIdentitySets {
  return {
    additionExact: new Map(),
    additionAlias: new Map(),
    additionEvidenceDocuments: new Map(),
    baselineExact: new Map(),
    baselineAlias: new Map(),
    csvIdentifiers: new Set(),
    ...overrides,
  }
}

const CATCH_ALL: CorpusDocumentRule = {
  ruleId: 'RULE-T01',
  filename: 'fixture.pdf',
  disposition: 'not_a_product_identifier',
  rationale: 'Fixture catch-all.',
  reviewMethod: 'corpus_text_extraction',
}

describe('fail-closed corpus disposition assignment', () => {
  test('a scanner candidate no reviewed input covers is reported as unhandled', () => {
    const result = assignCorpusDispositions([candidate({})], {
      overrides: [],
      documentRules: [],
      identities: identities(),
    })
    expect(result.unhandled).toHaveLength(1)
    expect(result.assignments.size).toBe(0)
  })

  test('a reviewed disposition for a candidate the scanner did not produce fails', () => {
    const override: CorpusCandidateOverride = {
      filename: 'fixture.pdf',
      normalizedIdentifier: 'NOTSCANNED1',
      disposition: 'needs_owner_review',
      rationale: 'Stale override.',
    }
    expect(() =>
      assignCorpusDispositions([candidate({})], {
        overrides: [override],
        documentRules: [CATCH_ALL],
        identities: identities(),
      }),
    ).toThrow(/which the scanner did not produce/u)
  })

  test('two reviewed dispositions for one candidate fail as a duplicate', () => {
    const override: CorpusCandidateOverride = {
      filename: 'fixture.pdf',
      normalizedIdentifier: 'G00001',
      disposition: 'needs_owner_review',
      rationale: 'First.',
    }
    expect(() =>
      assignCorpusDispositions([candidate({})], {
        overrides: [override, { ...override, rationale: 'Second.' }],
        documentRules: [],
        identities: identities(),
      }),
    ).toThrow(/Duplicate reviewed disposition/u)
  })

  test('an uncontrolled disposition value is rejected', () => {
    expect(() =>
      assignCorpusDispositions([candidate({})], {
        overrides: [
          {
            filename: 'fixture.pdf',
            normalizedIdentifier: 'G00001',
            disposition: 'looks_fine' as never,
            rationale: 'Invalid.',
          },
        ],
        documentRules: [],
        identities: identities(),
      }),
    ).toThrow(/uncontrolled disposition/u)
  })

  test('a reviewed document rule matching zero scanner candidates fails as stale', () => {
    expect(() =>
      assignCorpusDispositions([candidate({})], {
        overrides: [],
        documentRules: [
          CATCH_ALL,
          { ...CATCH_ALL, ruleId: 'RULE-T02', filename: 'other-file.pdf' },
        ],
        identities: identities(),
      }),
    ).toThrow(/matched zero scanner candidates/u)
  })

  test('reconciles candidates against the original CSV and the pre-review catalog', () => {
    const rows = [
      candidate({ normalizedIdentifier: 'CSVONLY1', rawIdentifier: 'CSVONLY1' }),
      candidate({ normalizedIdentifier: 'CAT0001', rawIdentifier: 'CAT0001' }),
      candidate({ normalizedIdentifier: 'ALIAS001', rawIdentifier: 'ALIAS001' }),
    ]
    const result = assignCorpusDispositions(rows, {
      overrides: [],
      documentRules: [],
      identities: identities({
        csvIdentifiers: new Set(['CSVONLY1', 'CAT0001']),
        baselineExact: new Map([['CAT0001', 'PRD-EXISTING']]),
        baselineAlias: new Map([['ALIAS001', 'PRD-EXISTING']]),
      }),
    })
    expect(result.unhandled).toHaveLength(0)
    const byId = new Map(
      [...result.assignments.entries()].map(([row, assignment]) => [
        row.normalizedIdentifier,
        assignment,
      ]),
    )
    expect(byId.get('CSVONLY1')?.disposition).toBe('previously_accounted_csv')
    // Canonical presence outranks CSV presence.
    expect(byId.get('CAT0001')).toMatchObject({
      disposition: 'existing_exact',
      canonicalProductId: 'PRD-EXISTING',
    })
    expect(byId.get('ALIAS001')?.disposition).toBe('existing_alias_or_format_variant')
  })

  test('accepted additions are new in their evidence document and duplicates elsewhere', () => {
    const rows = [
      candidate({ normalizedIdentifier: 'NEW0001', rawIdentifier: 'NEW0001' }),
      candidate({
        sourceFilename: 'other.pdf',
        normalizedIdentifier: 'NEW0001',
        rawIdentifier: 'NEW0001',
      }),
      candidate({ normalizedIdentifier: 'REF0001', rawIdentifier: 'REF0001' }),
    ]
    const result = assignCorpusDispositions(rows, {
      overrides: [],
      documentRules: [],
      identities: identities({
        additionExact: new Map([['NEW0001', 'PRD-NEW']]),
        additionAlias: new Map([['REF0001', 'PRD-NEW']]),
        additionEvidenceDocuments: new Map([['PRD-NEW', new Set(['fixture.pdf'])]]),
      }),
    })
    const assignments = [...result.assignments.entries()]
    const inEvidenceDoc = assignments.find(
      ([row]) => row.normalizedIdentifier === 'NEW0001' && row.sourceFilename === 'fixture.pdf',
    )?.[1]
    const elsewhere = assignments.find(
      ([row]) => row.normalizedIdentifier === 'NEW0001' && row.sourceFilename === 'other.pdf',
    )?.[1]
    const alias = assignments.find(([row]) => row.normalizedIdentifier === 'REF0001')?.[1]
    expect(inEvidenceDoc).toMatchObject({
      disposition: 'new_exact_product_candidate',
      canonicalProductId: 'PRD-NEW',
    })
    expect(elsewhere?.disposition).toBe('duplicate_source_occurrence')
    expect(alias).toMatchObject({
      disposition: 'duplicate_source_occurrence',
      basis: 'addition_alternate_id',
    })
  })

  test('pairs an order/reference row only on pairing pages with exactly one partner', () => {
    const paired = candidate({
      normalizedIdentifier: 'CREF2400',
      rawIdentifier: 'C-REF-2400',
      lineContext: 'G11111   C-REF-2400   24   41',
      onPairingPage: true,
    })
    const crowded = candidate({
      normalizedIdentifier: 'SIZE35X20',
      rawIdentifier: '3.5X20',
      lineContext: 'G11111 : HOLINGER BRONCHOSCOPE 3.5X20 AND G22222',
      onPairingPage: false,
    })
    const result = assignCorpusDispositions([paired, crowded], {
      overrides: [],
      documentRules: [CATCH_ALL],
      identities: identities({
        baselineExact: new Map([
          ['G11111', 'PRD-ORDER'],
          ['G22222', 'PRD-OTHER'],
        ]),
      }),
    })
    expect(result.assignments.get(paired)).toMatchObject({
      disposition: 'existing_alias_or_format_variant',
      basis: 'paired_reference_of_accounted_row',
      canonicalProductId: 'PRD-ORDER',
    })
    // Off pairing pages the size fragment falls through to the reviewed document rule.
    expect(result.assignments.get(crowded)).toMatchObject({
      disposition: 'not_a_product_identifier',
      basis: 'document_rule',
      ruleId: 'RULE-T01',
    })
  })

  test('document rules scope by pages and identifier pattern in reviewed order', () => {
    const rows = [
      candidate({ normalizedIdentifier: 'GI000123', pages: [10] }),
      candidate({ normalizedIdentifier: 'RESP0456', pages: [120] }),
    ]
    const rules: CorpusDocumentRule[] = [
      {
        ruleId: 'RULE-GI',
        filename: 'fixture.pdf',
        pages: '1-112',
        disposition: 'irrelevant_to_current_scope',
        rationale: 'GI section.',
        reviewMethod: 'corpus_text_extraction',
      },
      {
        ruleId: 'RULE-RESP',
        filename: 'fixture.pdf',
        identifierPattern: '^RESP',
        disposition: 'needs_owner_review',
        rationale: 'Respiratory section.',
        reviewMethod: 'corpus_text_extraction',
      },
    ]
    const result = assignCorpusDispositions(rows, {
      overrides: [],
      documentRules: rules,
      identities: identities(),
    })
    expect(result.assignments.get(rows[0])?.ruleId).toBe('RULE-GI')
    expect(result.assignments.get(rows[1])).toMatchObject({
      ruleId: 'RULE-RESP',
      disposition: 'needs_owner_review',
      ownerReviewRequired: true,
    })
  })
})
