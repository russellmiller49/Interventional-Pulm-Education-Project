import {
  LITERATURE_GOLD_CSV_COLUMNS,
  parseCsvRows,
  serializeLiteratureGoldSetCsv,
  type LiteratureGoldExport,
  type LiteratureGoldExportRecord,
} from '@/features/literature/gold-set/export'
import { parseLiteratureGoldReviewImportCsv } from '@/features/literature/gold-set/import'

const itemId = (index: number) => `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const reviewId = (index: number) => `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`

function completedRecord(index: number): LiteratureGoldExportRecord {
  return {
    itemId: itemId(index),
    pmid: String(10_000 + index),
    title: `Article ${index}`,
    abstract: `Abstract ${index}`,
    authors: [{ fullName: `Author ${index}`, abbreviatedName: `A${index}` }],
    journalTitle: 'Test Journal',
    journalAbbreviation: 'Test J',
    publicationYear: 2026,
    publicationTypes: ['Journal Article'],
    sampleStratum: 'strong_likely_ip',
    samplingReason: 'stratum=strong_likely_ip; score=1.0000',
    datasetSplit: 'development',
    displayOrder: index,
    reviewStatus: 'completed',
    reviewSource: 'completed',
    review: {
      id: reviewId(index),
      revision: 1,
      relevanceLabel: 'include_core',
      metadataSufficiency: 'adequate_abstract',
      reviewerConfidence: 'high',
      topicIds: ['ebus-mediastinal-staging'],
      technologyTags: ['convex-ebus'],
      clinicalPurposes: ['diagnosis'],
      diseaseTags: ['lung-cancer'],
      studyDesign: 'diagnostic-accuracy',
      publicationStatus: 'full-article',
      categorizationFromFullText: false,
      notes: '',
      usedSupplementalMetadata: false,
      reviewSeconds: 30,
      isBlinded: true,
      reviewerEmail: 'reviewer@example.com',
      completedAt: '2026-07-27T12:00:00.000Z',
    },
  }
}

function goldExport(count = 1): LiteratureGoldExport {
  return {
    exportVersion: '1.0.0',
    exportedAt: '2026-07-27T12:00:00.000Z',
    batch: {
      id: '30000000-0000-4000-8000-000000000001',
      name: 'pilot-v1',
      kind: 'pilot',
      status: 'active',
      taxonomyVersion: '1',
      labelSchemaVersion: '1',
      relevanceDefinitionVersion: '1',
      samplingAlgorithmVersion: '1',
      samplingSeed: 20_260_727,
      requestedSize: count,
      frozenAt: null,
    },
    split: 'all',
    includesHistory: false,
    records: Array.from({ length: count }, (_, index) => completedRecord(index + 1)),
  }
}

function encodeCsvRows(rows: string[][]) {
  const cell = (value: string) => `"${value.replaceAll('"', '""')}"`
  return `${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`
}

function updateRecord(input: string, recordIndex: number, updates: Record<string, string>) {
  const rows = parseCsvRows(input)
  const headers = rows[0]
  const row = rows[recordIndex + 1]
  for (const [column, value] of Object.entries(updates)) {
    const columnIndex = headers.indexOf(column)
    if (columnIndex < 0) throw new Error(`Missing test column ${column}`)
    row[columnIndex] = value
  }
  return encodeCsvRows(rows)
}

function draftCsv(input: string, recordIndex = 0) {
  return updateRecord(input, recordIndex, {
    sample_stratum: '',
    sampling_reason: '',
    review_status: 'in_progress',
    review_source: 'draft',
    review_id: '',
    revision: '',
    is_blinded: '',
    completed_at: '',
  })
}

function emptyCsv(input: string, recordIndex = 0) {
  return updateRecord(draftCsv(input, recordIndex), recordIndex, {
    review_status: 'pending',
    review_source: 'empty',
    relevance_label: '',
    metadata_sufficiency: '',
    reviewer_confidence: '',
    topic_ids_json: '[]',
    technology_tags_json: '[]',
    clinical_purposes_json: '[]',
    disease_tags_json: '[]',
    study_design: '',
    publication_status: '',
    categorization_from_full_text: 'false',
    notes: '',
    used_supplemental_metadata: 'false',
    review_seconds: '0',
    reviewer_email: '',
  })
}

describe('gold-set CSV import contract', () => {
  it('freezes the complete 35-column CSV v1 contract', () => {
    expect(LITERATURE_GOLD_CSV_COLUMNS).toEqual([
      'batch_id',
      'batch_name',
      'item_id',
      'pmid',
      'title',
      'abstract',
      'authors_json',
      'journal_title',
      'journal_abbreviation',
      'publication_year',
      'publication_types_json',
      'sample_stratum',
      'sampling_reason',
      'dataset_split',
      'display_order',
      'review_status',
      'review_source',
      'review_id',
      'revision',
      'relevance_label',
      'metadata_sufficiency',
      'reviewer_confidence',
      'topic_ids_json',
      'technology_tags_json',
      'clinical_purposes_json',
      'disease_tags_json',
      'study_design',
      'publication_status',
      'categorization_from_full_text',
      'notes',
      'used_supplemental_metadata',
      'review_seconds',
      'is_blinded',
      'reviewer_email',
      'completed_at',
    ])
  })

  it('accepts a typed 100-row completed pilot and exposes analysis metadata', () => {
    const parsed = parseLiteratureGoldReviewImportCsv(
      serializeLiteratureGoldSetCsv(goldExport(100)),
      {
        completedOnly: true,
        expectedBatchReference: 'pilot-v1',
        expectedRowCount: 100,
      },
    )

    expect(parsed.summary).toEqual({
      completed: 100,
      drafts: 0,
      empty: 0,
      totalRows: 100,
    })
    expect(parsed.decisions).toHaveLength(100)
    expect(parsed.rows[0]).toMatchObject({
      batchName: 'pilot-v1',
      sampleStratum: 'strong_likely_ip',
      datasetSplit: 'development',
      displayOrder: 1,
      publicationYear: 2026,
    })
    expect(parsed.rows[0].authors).toEqual([{ fullName: 'Author 1', abbreviatedName: 'A1' }])
  })

  it('rejects the previously accepted truncated five-column exclusion format', () => {
    const input = [
      'item_id,pmid,relevance_label,metadata_sufficiency,reviewer_confidence',
      `${itemId(1)},123,exclude,adequate_abstract,high`,
    ].join('\n')

    expect(() => parseLiteratureGoldReviewImportCsv(input)).toThrow(
      'CSV is missing required column(s)',
    )
  })

  it('rejects duplicate, missing, and unexpected headers', () => {
    expect(() => parseLiteratureGoldReviewImportCsv('item_id,item_id\n')).toThrow(
      'duplicate column(s): item_id',
    )

    const validRows = parseCsvRows(serializeLiteratureGoldSetCsv(goldExport()))
    validRows[0].push('unexpected')
    validRows[1].push('')
    expect(() => parseLiteratureGoldReviewImportCsv(encodeCsvRows(validRows))).toThrow(
      'unexpected column(s): unexpected',
    )
  })

  it.each([
    ['short', (row: string[]) => row.pop()],
    ['long', (row: string[]) => row.push('extra')],
  ])('rejects a %s data row', (_label, mutate) => {
    const rows = parseCsvRows(serializeLiteratureGoldSetCsv(goldExport()))
    mutate(rows[1])
    expect(() => parseLiteratureGoldReviewImportCsv(encodeCsvRows(rows))).toThrow(
      /CSV record 2 has \d+ columns; expected 35/u,
    )
  })

  it.each([
    ['topic_ids_json', '', 'must contain JSON'],
    ['topic_ids_json', 'not-json', 'contains malformed JSON'],
    ['topic_ids_json', '{}', 'must contain a JSON array'],
    ['topic_ids_json', '[1]', 'must contain a JSON string array'],
    ['authors_json', '{}', 'must contain a JSON array'],
  ])('strictly validates %s=%s', (column, value, message) => {
    const input = updateRecord(serializeLiteratureGoldSetCsv(goldExport()), 0, {
      [column]: value,
    })
    expect(() => parseLiteratureGoldReviewImportCsv(input)).toThrow(
      `CSV record 2, column ${column}: ${message}`,
    )
  })

  it.each(['', 'tru', 'TRUE', '1'])('rejects non-canonical boolean value %s', (value) => {
    const input = updateRecord(serializeLiteratureGoldSetCsv(goldExport()), 0, {
      categorization_from_full_text: value,
    })
    expect(() => parseLiteratureGoldReviewImportCsv(input)).toThrow(
      'column categorization_from_full_text: must be exactly true or false',
    )
  })

  it.each(['NaN', '0x10', '3e2', '1.5', '-1'])('rejects non-decimal review_seconds=%s', (value) => {
    const input = updateRecord(serializeLiteratureGoldSetCsv(goldExport()), 0, {
      review_seconds: value,
    })
    expect(() => parseLiteratureGoldReviewImportCsv(input)).toThrow(
      'column review_seconds: must contain a decimal integer',
    )
  })

  it('reports schema range errors with the CSV record and review path', () => {
    const input = updateRecord(serializeLiteratureGoldSetCsv(goldExport()), 0, {
      review_seconds: '86401',
    })
    expect(() => parseLiteratureGoldReviewImportCsv(input)).toThrow(
      'CSV record 2 (PMID 10001): review.reviewSeconds',
    )
  })

  it.each([
    ['completed', 'in_progress', 'review_source=completed requires review_status=completed'],
    ['draft', 'completed', 'review_source=draft requires review_status'],
    ['empty', 'completed', 'review_source=empty cannot use review_status=completed'],
  ])('rejects %s/%s source-status mismatch', (source, status, message) => {
    const serialized = serializeLiteratureGoldSetCsv(goldExport())
    const base =
      source === 'draft'
        ? draftCsv(serialized)
        : source === 'empty'
          ? emptyCsv(serialized)
          : serialized
    const input = updateRecord(base, 0, { review_source: source, review_status: status })
    expect(() => parseLiteratureGoldReviewImportCsv(input)).toThrow(message)
  })

  it.each(['', 'complete', 'COMPLETED'])(
    'rejects unknown review_source=%s instead of coercing it to completed',
    (reviewSource) => {
      const input = updateRecord(serializeLiteratureGoldSetCsv(goldExport()), 0, {
        review_source: reviewSource,
      })
      expect(() => parseLiteratureGoldReviewImportCsv(input)).toThrow(
        'column review_source: must be one of completed, draft, empty',
      )
    },
  )

  it('accepts drafts and skips empty rows in generic restore mode', () => {
    let input = serializeLiteratureGoldSetCsv(goldExport(2))
    input = draftCsv(input, 0)
    input = emptyCsv(input, 1)

    const parsed = parseLiteratureGoldReviewImportCsv(input)
    expect(parsed.summary).toEqual({
      completed: 0,
      drafts: 1,
      empty: 1,
      totalRows: 2,
    })
    expect(parsed.decisions).toHaveLength(1)
    expect(parsed.decisions[0].reviewSource).toBe('draft')
    expect(() => parseLiteratureGoldReviewImportCsv(input, { completedOnly: true })).toThrow(
      'this import requires every row to be completed',
    )
  })

  it('rejects mixed batch identities and an explicit batch mismatch', () => {
    const serialized = serializeLiteratureGoldSetCsv(goldExport(2))
    const mixed = updateRecord(serialized, 1, {
      batch_id: '40000000-0000-4000-8000-000000000001',
    })
    expect(() => parseLiteratureGoldReviewImportCsv(mixed)).toThrow(
      'batch identity must match pilot-v1',
    )
    expect(() =>
      parseLiteratureGoldReviewImportCsv(serialized, {
        expectedBatchReference: 'another-batch',
      }),
    ).toThrow('does not match --batch another-batch')
  })

  it.each([
    ['item_id', itemId(1)],
    ['pmid', '10001'],
    ['display_order', '1'],
    ['review_id', reviewId(1)],
  ])('rejects duplicate %s values', (column, duplicate) => {
    const input = updateRecord(serializeLiteratureGoldSetCsv(goldExport(2)), 1, {
      [column]: duplicate,
    })
    expect(() => parseLiteratureGoldReviewImportCsv(input)).toThrow(
      `${column} duplicates CSV record 2`,
    )
  })

  it('reports completed-review Zod errors with record and field context', () => {
    const input = updateRecord(serializeLiteratureGoldSetCsv(goldExport()), 0, {
      clinical_purposes_json: '[]',
    })
    expect(() => parseLiteratureGoldReviewImportCsv(input)).toThrow(
      'CSV record 2 (PMID 10001): review.clinicalPurposes: At least one clinical purpose',
    )
  })

  it('rejects entered review data on an empty row', () => {
    const input = updateRecord(emptyCsv(serializeLiteratureGoldSetCsv(goldExport())), 0, {
      notes: 'should not be ignored',
    })
    expect(() => parseLiteratureGoldReviewImportCsv(input)).toThrow(
      'review_source=empty cannot contain review or review-provenance data',
    )
  })
})
