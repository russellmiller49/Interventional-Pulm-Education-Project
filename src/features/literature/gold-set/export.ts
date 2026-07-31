import {
  literatureGoldSetDatasetSplits,
  literatureGoldSetReviewStatuses,
  literatureGoldSetStrata,
} from './constants'
import type {
  LiteratureGoldSetDatasetSplit,
  LiteratureGoldSetReviewStatus,
  LiteratureGoldSetStratum,
} from './types'

export interface LiteratureGoldExportReview {
  id: string | null
  revision: number | null
  relevanceLabel: string | null
  metadataSufficiency: string | null
  reviewerConfidence: string | null
  topicIds: string[]
  technologyTags: string[]
  clinicalPurposes: string[]
  diseaseTags: string[]
  studyDesign: string | null
  publicationStatus: string | null
  categorizationFromFullText: boolean
  notes: string
  usedSupplementalMetadata: boolean
  reviewSeconds: number
  isBlinded: boolean | null
  reviewerEmail: string | null
  completedAt: string | null
}

export interface LiteratureGoldExportRecord {
  itemId: string
  pmid: string
  title: string
  abstract: string | null
  authors: unknown
  journalTitle: string | null
  journalAbbreviation: string | null
  publicationYear: number | null
  publicationTypes: string[]
  sampleStratum: string | null
  samplingReason: string | null
  datasetSplit: string
  displayOrder: number
  reviewStatus: string
  reviewSource: 'completed' | 'draft' | 'empty'
  review: LiteratureGoldExportReview | null
  reviewHistory?: LiteratureGoldExportReview[]
}

export interface LiteratureGoldExport {
  exportVersion: '1.0.0'
  exportedAt: string
  batch: {
    id: string
    name: string
    kind: string
    status: string
    taxonomyVersion: string
    labelSchemaVersion: string
    relevanceDefinitionVersion: string
    samplingAlgorithmVersion: string
    samplingSeed: number
    requestedSize: number
    frozenAt: string | null
  }
  split: 'development' | 'test' | 'all'
  includesHistory: boolean
  records: LiteratureGoldExportRecord[]
}

export interface LiteratureGoldCsvRow {
  batchId: string
  batchName: string
  itemId: string
  pmid: string
  title: string
  abstract: string | null
  authors: unknown[]
  journalTitle: string | null
  journalAbbreviation: string | null
  publicationYear: number | null
  publicationTypes: string[]
  sampleStratum: LiteratureGoldSetStratum | null
  samplingReason: string | null
  datasetSplit: LiteratureGoldSetDatasetSplit
  displayOrder: number
  reviewStatus: LiteratureGoldSetReviewStatus
  reviewSource: 'completed' | 'draft' | 'empty'
  review: LiteratureGoldExportReview
}

export function literatureGoldExportSamplingContext(
  hasCompletedDecision: boolean,
  sampleStratum: string,
  samplingReason: string,
) {
  return hasCompletedDecision
    ? { sampleStratum, samplingReason }
    : { sampleStratum: null, samplingReason: null }
}

export const LITERATURE_GOLD_CSV_COLUMNS = [
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
] as const

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? '' : String(value)
  const serialized = /^[=+\-@]/u.test(raw) ? `'${raw}` : raw
  return `"${serialized.replaceAll('"', '""')}"`
}

export function serializeLiteratureGoldSetCsv(exported: LiteratureGoldExport) {
  const lines = [LITERATURE_GOLD_CSV_COLUMNS.map(csvCell).join(',')]
  for (const record of exported.records) {
    const review = record.review
    const values: Record<(typeof LITERATURE_GOLD_CSV_COLUMNS)[number], unknown> = {
      batch_id: exported.batch.id,
      batch_name: exported.batch.name,
      item_id: record.itemId,
      pmid: record.pmid,
      title: record.title,
      abstract: record.abstract,
      authors_json: JSON.stringify(record.authors),
      journal_title: record.journalTitle,
      journal_abbreviation: record.journalAbbreviation,
      publication_year: record.publicationYear,
      publication_types_json: JSON.stringify(record.publicationTypes),
      sample_stratum: record.sampleStratum,
      sampling_reason: record.samplingReason,
      dataset_split: record.datasetSplit,
      display_order: record.displayOrder,
      review_status: record.reviewStatus,
      review_source: record.reviewSource,
      review_id: review?.id,
      revision: review?.revision,
      relevance_label: review?.relevanceLabel,
      metadata_sufficiency: review?.metadataSufficiency,
      reviewer_confidence: review?.reviewerConfidence,
      topic_ids_json: JSON.stringify(review?.topicIds ?? []),
      technology_tags_json: JSON.stringify(review?.technologyTags ?? []),
      clinical_purposes_json: JSON.stringify(review?.clinicalPurposes ?? []),
      disease_tags_json: JSON.stringify(review?.diseaseTags ?? []),
      study_design: review?.studyDesign,
      publication_status: review?.publicationStatus,
      categorization_from_full_text: review?.categorizationFromFullText ?? false,
      notes: review?.notes,
      used_supplemental_metadata: review?.usedSupplementalMetadata ?? false,
      review_seconds: review?.reviewSeconds ?? 0,
      is_blinded: review?.isBlinded,
      reviewer_email: review?.reviewerEmail,
      completed_at: review?.completedAt,
    }
    lines.push(LITERATURE_GOLD_CSV_COLUMNS.map((column) => csvCell(values[column])).join(','))
  }
  return `${lines.join('\r\n')}\r\n`
}

export function parseCsvRows(input: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        cell += character
      }
    } else if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(cell)
      cell = ''
    } else if (character === '\n') {
      row.push(cell.replace(/\r$/u, ''))
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field.')
  if (cell || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function csvRecordError(recordNumber: number, column: string, message: string): never {
  throw new Error(`CSV record ${recordNumber}, column ${column}: ${message}`)
}

function csvInteger(
  raw: string,
  recordNumber: number,
  column: string,
  options: { maximum?: number; minimum?: number; nullable: true },
): number | null
function csvInteger(
  raw: string,
  recordNumber: number,
  column: string,
  options?: { maximum?: number; minimum?: number; nullable?: false },
): number
function csvInteger(
  raw: string,
  recordNumber: number,
  column: string,
  options: { maximum?: number; minimum?: number; nullable?: boolean } = {},
) {
  if (raw === '' && options.nullable) return null
  if (!/^(?:0|[1-9][0-9]*)$/u.test(raw)) {
    return csvRecordError(recordNumber, column, 'must contain a decimal integer.')
  }
  const value = Number(raw)
  if (
    !Number.isSafeInteger(value) ||
    value < (options.minimum ?? 0) ||
    value > (options.maximum ?? Number.MAX_SAFE_INTEGER)
  ) {
    return csvRecordError(recordNumber, column, 'contains an out-of-range integer.')
  }
  return value
}

function csvBoolean(
  raw: string,
  recordNumber: number,
  column: string,
  nullable: true,
): boolean | null
function csvBoolean(raw: string, recordNumber: number, column: string, nullable?: false): boolean
function csvBoolean(raw: string, recordNumber: number, column: string, nullable = false) {
  if (raw === '' && nullable) return null
  if (raw === 'true') return true
  if (raw === 'false') return false
  return csvRecordError(recordNumber, column, 'must be exactly true or false.')
}

function csvJson(raw: string, recordNumber: number, column: string) {
  if (raw === '') {
    return csvRecordError(recordNumber, column, 'must contain JSON.')
  }
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return csvRecordError(recordNumber, column, 'contains malformed JSON.')
  }
}

function csvJsonArray(raw: string, recordNumber: number, column: string) {
  const value = csvJson(raw, recordNumber, column)
  if (!Array.isArray(value)) {
    return csvRecordError(recordNumber, column, 'must contain a JSON array.')
  }
  return value
}

function csvStringArray(raw: string, recordNumber: number, column: string) {
  const value = csvJsonArray(raw, recordNumber, column)
  if (value.some((item) => typeof item !== 'string')) {
    return csvRecordError(recordNumber, column, 'must contain a JSON string array.')
  }
  return value as string[]
}

function csvEnum<T extends string>(
  raw: string,
  values: readonly T[],
  recordNumber: number,
  column: string,
  nullable: true,
): T | null
function csvEnum<T extends string>(
  raw: string,
  values: readonly T[],
  recordNumber: number,
  column: string,
  nullable?: false,
): T
function csvEnum<T extends string>(
  raw: string,
  values: readonly T[],
  recordNumber: number,
  column: string,
  nullable = false,
): T | null {
  if (raw === '' && nullable) return null
  if ((values as readonly string[]).includes(raw)) return raw as T
  return csvRecordError(
    recordNumber,
    column,
    `must be one of ${values.join(', ')}${nullable ? ', or blank' : ''}.`,
  )
}

export function parseLiteratureGoldSetCsv(input: string): LiteratureGoldCsvRow[] {
  const parsedRows = parseCsvRows(input)
  const originalHeaders = parsedRows.shift()
  if (!originalHeaders) return []

  const headers = originalHeaders.map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/u, '') : header,
  )
  const duplicateHeaders = [
    ...new Set(headers.filter((header, index) => headers.indexOf(header) !== index)),
  ]
  if (duplicateHeaders.length > 0) {
    throw new Error(`CSV contains duplicate column(s): ${duplicateHeaders.join(', ')}.`)
  }

  const expectedColumns = new Set<string>(LITERATURE_GOLD_CSV_COLUMNS)
  const missingColumns = LITERATURE_GOLD_CSV_COLUMNS.filter((column) => !headers.includes(column))
  const unexpectedColumns = headers.filter((header) => !expectedColumns.has(header))
  if (missingColumns.length > 0) {
    throw new Error(`CSV is missing required column(s): ${missingColumns.join(', ')}.`)
  }
  if (unexpectedColumns.length > 0) {
    throw new Error(`CSV contains unexpected column(s): ${unexpectedColumns.join(', ')}.`)
  }

  const indexByHeader = new Map(headers.map((header, index) => [header, index]))
  const rows = parsedRows
    .map((row, index) => ({ recordNumber: index + 2, row }))
    .filter(({ row }) => row.some(Boolean))

  return rows.map(({ recordNumber, row }) => {
    if (row.length !== headers.length) {
      throw new Error(
        `CSV record ${recordNumber} has ${row.length} columns; expected ${headers.length}.`,
      )
    }

    const field = (name: (typeof LITERATURE_GOLD_CSV_COLUMNS)[number]) =>
      (row[indexByHeader.get(name) ?? -1] ?? '').replace(/^'(?=[=+\-@])/u, '')
    const nullableText = (name: (typeof LITERATURE_GOLD_CSV_COLUMNS)[number]) => field(name) || null
    const authors = csvJsonArray(field('authors_json'), recordNumber, 'authors_json')
    const publicationYear = csvInteger(
      field('publication_year'),
      recordNumber,
      'publication_year',
      {
        minimum: 1000,
        maximum: 9999,
        nullable: true,
      },
    )
    const reviewSource = csvEnum(
      field('review_source'),
      ['completed', 'draft', 'empty'] as const,
      recordNumber,
      'review_source',
    )

    return {
      batchId: field('batch_id'),
      batchName: field('batch_name'),
      itemId: field('item_id'),
      pmid: field('pmid'),
      title: field('title'),
      abstract: nullableText('abstract'),
      authors,
      journalTitle: nullableText('journal_title'),
      journalAbbreviation: nullableText('journal_abbreviation'),
      publicationYear,
      publicationTypes: csvStringArray(
        field('publication_types_json'),
        recordNumber,
        'publication_types_json',
      ),
      sampleStratum: csvEnum(
        field('sample_stratum'),
        literatureGoldSetStrata,
        recordNumber,
        'sample_stratum',
        true,
      ),
      samplingReason: nullableText('sampling_reason'),
      datasetSplit: csvEnum(
        field('dataset_split'),
        literatureGoldSetDatasetSplits,
        recordNumber,
        'dataset_split',
      ),
      displayOrder: csvInteger(field('display_order'), recordNumber, 'display_order', {
        minimum: 1,
      }),
      reviewStatus: csvEnum(
        field('review_status'),
        literatureGoldSetReviewStatuses,
        recordNumber,
        'review_status',
      ),
      reviewSource,
      review: {
        id: nullableText('review_id'),
        revision: csvInteger(field('revision'), recordNumber, 'revision', {
          minimum: 1,
          nullable: true,
        }),
        relevanceLabel: nullableText('relevance_label'),
        metadataSufficiency: nullableText('metadata_sufficiency'),
        reviewerConfidence: nullableText('reviewer_confidence'),
        topicIds: csvStringArray(field('topic_ids_json'), recordNumber, 'topic_ids_json'),
        technologyTags: csvStringArray(
          field('technology_tags_json'),
          recordNumber,
          'technology_tags_json',
        ),
        clinicalPurposes: csvStringArray(
          field('clinical_purposes_json'),
          recordNumber,
          'clinical_purposes_json',
        ),
        diseaseTags: csvStringArray(field('disease_tags_json'), recordNumber, 'disease_tags_json'),
        studyDesign: nullableText('study_design'),
        publicationStatus: nullableText('publication_status'),
        categorizationFromFullText: csvBoolean(
          field('categorization_from_full_text'),
          recordNumber,
          'categorization_from_full_text',
        ),
        notes: field('notes'),
        usedSupplementalMetadata: csvBoolean(
          field('used_supplemental_metadata'),
          recordNumber,
          'used_supplemental_metadata',
        ),
        reviewSeconds: csvInteger(field('review_seconds'), recordNumber, 'review_seconds'),
        isBlinded: csvBoolean(field('is_blinded'), recordNumber, 'is_blinded', true),
        reviewerEmail: nullableText('reviewer_email'),
        completedAt: nullableText('completed_at'),
      },
    }
  })
}
