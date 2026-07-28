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

export function literatureGoldExportSamplingContext(
  hasCompletedDecision: boolean,
  sampleStratum: string,
  samplingReason: string,
) {
  return hasCompletedDecision
    ? { sampleStratum, samplingReason }
    : { sampleStratum: null, samplingReason: null }
}

const CSV_COLUMNS = [
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
  const lines = [CSV_COLUMNS.map(csvCell).join(',')]
  for (const record of exported.records) {
    const review = record.review
    const values: Record<(typeof CSV_COLUMNS)[number], unknown> = {
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
    lines.push(CSV_COLUMNS.map((column) => csvCell(values[column])).join(','))
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

export function parseLiteratureGoldSetCsv(input: string) {
  const rows = parseCsvRows(input)
  const headers = rows.shift()
  if (!headers) return []
  const indexByHeader = new Map(headers.map((header, index) => [header, index]))
  const required = [
    'item_id',
    'pmid',
    'relevance_label',
    'metadata_sufficiency',
    'reviewer_confidence',
  ]
  for (const header of required) {
    if (!indexByHeader.has(header)) throw new Error(`CSV is missing required column ${header}.`)
  }
  const field = (row: string[], name: string) => row[indexByHeader.get(name) ?? -1] ?? ''
  const decodedField = (row: string[], name: string) =>
    field(row, name).replace(/^'(?=[=+\-@])/u, '')
  const jsonArray = (row: string[], name: string) => {
    const parsed = JSON.parse(decodedField(row, name) || '[]') as unknown
    if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) {
      throw new Error(`${name} must contain a JSON string array.`)
    }
    return parsed
  }

  return rows
    .filter((row) => row.some(Boolean))
    .map((row) => ({
      batchId: decodedField(row, 'batch_id') || null,
      itemId: decodedField(row, 'item_id'),
      pmid: decodedField(row, 'pmid'),
      reviewSource: decodedField(row, 'review_source') || 'completed',
      sourceReviewId: decodedField(row, 'review_id') || null,
      review: {
        relevanceLabel: decodedField(row, 'relevance_label') || null,
        metadataSufficiency: decodedField(row, 'metadata_sufficiency') || null,
        reviewerConfidence: decodedField(row, 'reviewer_confidence') || null,
        topicIds: jsonArray(row, 'topic_ids_json'),
        technologyTags: jsonArray(row, 'technology_tags_json'),
        clinicalPurposes: jsonArray(row, 'clinical_purposes_json'),
        diseaseTags: jsonArray(row, 'disease_tags_json'),
        studyDesign: decodedField(row, 'study_design') || null,
        publicationStatus: decodedField(row, 'publication_status') || null,
        categorizationFromFullText: decodedField(row, 'categorization_from_full_text') === 'true',
        notes: decodedField(row, 'notes'),
        usedSupplementalMetadata: decodedField(row, 'used_supplemental_metadata') === 'true',
        reviewSeconds: Number(decodedField(row, 'review_seconds')) || 0,
      },
    }))
}
