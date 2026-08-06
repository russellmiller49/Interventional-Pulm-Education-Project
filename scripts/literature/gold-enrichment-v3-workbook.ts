import JSZip from 'jszip'

export const GOLD_ENRICHMENT_V3_REVIEW_XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const GOLD_ENRICHMENT_V3_REVIEW_WORKBOOK_SHEETS = [
  'Instructions',
  'Required Review',
  'QC Sample 50',
  'Protocol Acceptance Candidates',
  'Lookups',
] as const

export const GOLD_ENRICHMENT_V3_REVIEW_SHEETS = GOLD_ENRICHMENT_V3_REVIEW_WORKBOOK_SHEETS

export type GoldEnrichmentV3ReviewWorkbookSheetName =
  (typeof GOLD_ENRICHMENT_V3_REVIEW_WORKBOOK_SHEETS)[number]

export type GoldEnrichmentV3ReviewWorkbookControlledValues = Readonly<
  Record<string, readonly string[]>
>

export interface GoldEnrichmentV3ReviewWorkbookMetadata {
  workflow_id: string
  workflow_schema_version: string
  coordinator_schema_version?: string
  merged_schema_version: string
  prompt_template_version: string
  result_schema_version: string
  taxonomy_version: string
  label_schema_version: string
  enrichment_schema_version: string
  source_sha256: string
  merged_sha256: string
  physician_field_sha256: string
  required_review_count: number
  qc_sample_count: number
  acceptance_candidate_count: number
  controlled_values: GoldEnrichmentV3ReviewWorkbookControlledValues
}

export interface GoldEnrichmentV3ReviewWorkbookRow {
  cohort: string
  master_row_id: string
  pmid: string
  title: string
  abstract: string
  journal: string
  publication_year: string
  physician_final_label: string
  physician_final_confidence: string
  metadata_sufficiency: string
  full_text_evidence_status: string
  full_text_filename: string
  full_text_sha256: string
  full_text_evidence: string
  qa_concerns: string
  upgrade_concerns: string
  coordinator_review_reasons: string
  coordinator_policy_status?: string
  coordinator_conflict_count?: string
  coordinator_conflict_fields?: string
  coordinator_conflict_rule_ids?: string
  coordinator_conflict_diagnostics?: string
  coordinator_candidate_status?: string
  raw_result_filename?: string
  raw_result_sha256?: string
  model_topic_ids?: string
  model_technology_tags?: string
  model_technology_tag_status?: string
  model_clinical_purposes?: string
  model_disease_tags?: string
  model_disease_tag_status?: string
  model_study_design?: string
  model_publication_status?: string
  topic_ids: string
  technology_tags: string
  technology_tag_status: string
  clinical_purposes: string
  disease_tags: string
  disease_tag_status: string
  study_design: string
  publication_status: string
  enrichment_confidence: string
  model_requests_physician_enrichment_review: string
  coordinator_requires_physician_enrichment_review: string
  evidence_summary: string
  enrichment_rationale: string
  physician_action: string
  physician_metadata_sufficiency: string
  physician_topic_ids: string
  physician_technology_tags: string
  physician_technology_tag_status: string
  physician_clinical_purposes: string
  physician_disease_tags: string
  physician_disease_tag_status: string
  physician_study_design: string
  physician_publication_status: string
  physician_enrichment_confidence: string
  physician_reviewed: string
  physician_notes: string
}

export interface GoldEnrichmentV3ReviewWorkbookCohorts {
  required_review: readonly GoldEnrichmentV3ReviewWorkbookRow[]
  qc_sample_50: readonly GoldEnrichmentV3ReviewWorkbookRow[]
  protocol_acceptance_candidates: readonly GoldEnrichmentV3ReviewWorkbookRow[]
}

const ZIP_ENTRY_DATE = new Date(1980, 0, 1, 0, 0, 0)
const CORE_PROPERTIES_TIMESTAMP = '2000-01-01T00:00:00Z'
const REVIEW_ACTIONS = ['accept', 'modify', 'adjudicate'] as const
const BOOLEAN_VALUES = ['false', 'true'] as const
const MAX_EXCEL_CELL_CHARACTERS = 32_767
const MAX_EXCEL_DATA_ROWS = 1_048_575
const LOOKUPS_SHEET = 'Lookups'

type CellValue = string | number | readonly string[] | null | undefined
type ReviewColumnGroup = 'source' | 'proposal' | 'concern' | 'editable' | 'formula'

interface ReviewColumn {
  key: string
  header: string
  width: number
  group: ReviewColumnGroup
  value: (row: GoldEnrichmentV3ReviewWorkbookRow) => CellValue
  validationName?: string
}

interface LookupColumn {
  header: string
  values: readonly string[]
  width: number
  definedName?: string
}

function sanitizeXmlText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

function boundedCellText(value: CellValue): string {
  const text = Array.isArray(value) ? value.join('|') : String(value ?? '')
  return sanitizeXmlText(text).slice(0, MAX_EXCEL_CELL_CHARACTERS)
}

function xmlText(value: CellValue): string {
  return boundedCellText(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function xmlAttribute(value: CellValue): string {
  return xmlText(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function columnName(index: number): string {
  let value = index
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

function textCell(reference: string, value: CellValue, style: number): string {
  const text = boundedCellText(value)
  if (!text) return `<c r="${reference}" s="${style}" t="inlineStr"><is><t></t></is></c>`
  const preserve = /^\s|\s$|\r|\n/.test(text) ? ' xml:space="preserve"' : ''
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t${preserve}>${xmlText(text)}</t></is></c>`
}

function formulaStringCell(
  reference: string,
  formula: string,
  cachedValue: string,
  style: number,
): string {
  return `<c r="${reference}" s="${style}" t="str"><f>${xmlText(formula)}</f><v>${xmlText(cachedValue)}</v></c>`
}

function rowXml(rowNumber: number, cells: readonly string[], height?: number): string {
  const customHeight = height ? ` ht="${height}" customHeight="1"` : ''
  return `<row r="${rowNumber}"${customHeight}>${cells.join('')}</row>`
}

function addZipText(zip: JSZip, archivePath: string, content: string): void {
  zip.file(archivePath, content, {
    date: ZIP_ENTRY_DATE,
    createFolders: false,
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

function normalizedBoolean(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'true' || normalized === 'false') return normalized
  return normalized ?? ''
}

function physicianValue(physicianValueInput: string, proposalValue: string): string {
  return physicianValueInput.trim() ? physicianValueInput : proposalValue
}

const REVIEW_COLUMNS: readonly ReviewColumn[] = [
  {
    key: 'master_row_id',
    header: 'master_row_id',
    width: 16,
    group: 'source',
    value: (row) => row.master_row_id,
  },
  { key: 'pmid', header: 'pmid', width: 14, group: 'source', value: (row) => row.pmid },
  {
    key: 'cohort',
    header: 'cohort',
    width: 28,
    group: 'source',
    value: (row) => row.cohort,
  },
  { key: 'title', header: 'title', width: 48, group: 'source', value: (row) => row.title },
  {
    key: 'abstract',
    header: 'abstract',
    width: 72,
    group: 'source',
    value: (row) => row.abstract,
  },
  { key: 'journal', header: 'journal', width: 28, group: 'source', value: (row) => row.journal },
  {
    key: 'publication_year',
    header: 'publication_year',
    width: 14,
    group: 'source',
    value: (row) => row.publication_year,
  },
  {
    key: 'physician_final_label',
    header: 'physician_final_label (fixed)',
    width: 22,
    group: 'source',
    value: (row) => row.physician_final_label,
  },
  {
    key: 'physician_final_confidence',
    header: 'physician_final_confidence (fixed)',
    width: 24,
    group: 'source',
    value: (row) => row.physician_final_confidence,
  },
  {
    key: 'full_text_evidence_status',
    header: 'full_text_evidence_status',
    width: 20,
    group: 'source',
    value: (row) => row.full_text_evidence_status,
  },
  {
    key: 'full_text_filename',
    header: 'full_text_filename',
    width: 24,
    group: 'source',
    value: (row) => row.full_text_filename,
  },
  {
    key: 'full_text_sha256',
    header: 'full_text_sha256',
    width: 68,
    group: 'source',
    value: (row) => row.full_text_sha256,
  },
  {
    key: 'full_text_evidence',
    header: 'full_text_evidence',
    width: 56,
    group: 'source',
    value: (row) => row.full_text_evidence,
  },
  {
    key: 'raw_result_filename',
    header: 'raw_result_filename',
    width: 38,
    group: 'source',
    value: (row) => row.raw_result_filename,
  },
  {
    key: 'raw_result_sha256',
    header: 'raw_result_sha256',
    width: 68,
    group: 'source',
    value: (row) => row.raw_result_sha256,
  },
  {
    key: 'metadata_sufficiency',
    header: 'v3_proposed_metadata_sufficiency',
    width: 26,
    group: 'proposal',
    value: (row) => row.metadata_sufficiency,
  },
  {
    key: 'model_topic_ids',
    header: 'raw_model_topic_ids (untouched)',
    width: 48,
    group: 'proposal',
    value: (row) => row.model_topic_ids,
  },
  {
    key: 'model_technology_tags',
    header: 'raw_model_technology_tags (untouched)',
    width: 44,
    group: 'proposal',
    value: (row) => row.model_technology_tags,
  },
  {
    key: 'model_technology_tag_status',
    header: 'raw_model_technology_tag_status (untouched)',
    width: 34,
    group: 'proposal',
    value: (row) => row.model_technology_tag_status,
  },
  {
    key: 'model_clinical_purposes',
    header: 'raw_model_clinical_purposes (untouched)',
    width: 44,
    group: 'proposal',
    value: (row) => row.model_clinical_purposes,
  },
  {
    key: 'model_disease_tags',
    header: 'raw_model_disease_tags (untouched)',
    width: 44,
    group: 'proposal',
    value: (row) => row.model_disease_tags,
  },
  {
    key: 'model_disease_tag_status',
    header: 'raw_model_disease_tag_status (untouched)',
    width: 34,
    group: 'proposal',
    value: (row) => row.model_disease_tag_status,
  },
  {
    key: 'model_study_design',
    header: 'raw_model_study_design (untouched)',
    width: 32,
    group: 'proposal',
    value: (row) => row.model_study_design,
  },
  {
    key: 'model_publication_status',
    header: 'raw_model_publication_status (untouched)',
    width: 32,
    group: 'proposal',
    value: (row) => row.model_publication_status,
  },
  {
    key: 'topic_ids',
    header: 'coordinator_candidate_topic_ids',
    width: 42,
    group: 'proposal',
    value: (row) => row.topic_ids,
  },
  {
    key: 'technology_tags',
    header: 'coordinator_candidate_technology_tags',
    width: 42,
    group: 'proposal',
    value: (row) => row.technology_tags,
  },
  {
    key: 'technology_tag_status',
    header: 'coordinator_candidate_technology_tag_status',
    width: 27,
    group: 'proposal',
    value: (row) => row.technology_tag_status,
  },
  {
    key: 'clinical_purposes',
    header: 'coordinator_candidate_clinical_purposes',
    width: 42,
    group: 'proposal',
    value: (row) => row.clinical_purposes,
  },
  {
    key: 'disease_tags',
    header: 'coordinator_candidate_disease_tags',
    width: 42,
    group: 'proposal',
    value: (row) => row.disease_tags,
  },
  {
    key: 'disease_tag_status',
    header: 'coordinator_candidate_disease_tag_status',
    width: 27,
    group: 'proposal',
    value: (row) => row.disease_tag_status,
  },
  {
    key: 'study_design',
    header: 'coordinator_candidate_study_design',
    width: 28,
    group: 'proposal',
    value: (row) => row.study_design,
  },
  {
    key: 'publication_status',
    header: 'coordinator_candidate_publication_status',
    width: 28,
    group: 'proposal',
    value: (row) => row.publication_status,
  },
  {
    key: 'enrichment_confidence',
    header: 'v3_proposed_enrichment_confidence',
    width: 26,
    group: 'proposal',
    value: (row) => row.enrichment_confidence,
  },
  {
    key: 'model_requests_physician_enrichment_review',
    header: 'v3_model_requests_physician_enrichment_review',
    width: 30,
    group: 'proposal',
    value: (row) => row.model_requests_physician_enrichment_review,
  },
  {
    key: 'evidence_summary',
    header: 'v3_evidence_summary',
    width: 56,
    group: 'proposal',
    value: (row) => row.evidence_summary,
  },
  {
    key: 'enrichment_rationale',
    header: 'v3_enrichment_rationale',
    width: 56,
    group: 'proposal',
    value: (row) => row.enrichment_rationale,
  },
  {
    key: 'coordinator_policy_status',
    header: 'coordinator_policy_status',
    width: 28,
    group: 'concern',
    value: (row) => row.coordinator_policy_status,
  },
  {
    key: 'coordinator_conflict_count',
    header: 'coordinator_conflict_count',
    width: 24,
    group: 'concern',
    value: (row) => row.coordinator_conflict_count,
  },
  {
    key: 'coordinator_conflict_fields',
    header: 'coordinator_conflict_fields',
    width: 36,
    group: 'concern',
    value: (row) => row.coordinator_conflict_fields,
  },
  {
    key: 'coordinator_conflict_rule_ids',
    header: 'coordinator_conflict_rule_ids',
    width: 54,
    group: 'concern',
    value: (row) => row.coordinator_conflict_rule_ids,
  },
  {
    key: 'coordinator_conflict_diagnostics',
    header: 'coordinator_conflict_diagnostics',
    width: 72,
    group: 'concern',
    value: (row) => row.coordinator_conflict_diagnostics,
  },
  {
    key: 'coordinator_candidate_status',
    header: 'coordinator_candidate_status',
    width: 34,
    group: 'concern',
    value: (row) => row.coordinator_candidate_status,
  },
  {
    key: 'coordinator_requires_physician_enrichment_review',
    header: 'coordinator_requires_physician_enrichment_review',
    width: 34,
    group: 'concern',
    value: (row) => row.coordinator_requires_physician_enrichment_review,
  },
  {
    key: 'coordinator_review_reasons',
    header: 'coordinator_review_reasons',
    width: 46,
    group: 'concern',
    value: (row) => row.coordinator_review_reasons,
  },
  {
    key: 'qa_concerns',
    header: 'qa_concerns (post-proposal)',
    width: 56,
    group: 'concern',
    value: (row) => row.qa_concerns,
  },
  {
    key: 'upgrade_concerns',
    header: 'upgrade_concerns (post-proposal)',
    width: 56,
    group: 'concern',
    value: (row) => row.upgrade_concerns,
  },
  {
    key: 'physician_action',
    header: 'physician_action',
    width: 20,
    group: 'editable',
    value: (row) => row.physician_action,
    validationName: 'ReviewActionOptions',
  },
  {
    key: 'physician_metadata_sufficiency',
    header: 'physician_metadata_sufficiency',
    width: 27,
    group: 'editable',
    value: (row) => physicianValue(row.physician_metadata_sufficiency, row.metadata_sufficiency),
    validationName: 'MetadataSufficiencyOptions',
  },
  {
    key: 'physician_topic_ids',
    header: 'physician_topic_ids (pipe-delimited)',
    width: 44,
    group: 'editable',
    value: (row) => physicianValue(row.physician_topic_ids, row.topic_ids),
  },
  {
    key: 'physician_technology_tags',
    header: 'physician_technology_tags (pipe-delimited)',
    width: 44,
    group: 'editable',
    value: (row) => physicianValue(row.physician_technology_tags, row.technology_tags),
  },
  {
    key: 'physician_technology_tag_status',
    header: 'physician_technology_tag_status',
    width: 28,
    group: 'editable',
    value: (row) => physicianValue(row.physician_technology_tag_status, row.technology_tag_status),
    validationName: 'TechnologyTagStatusOptions',
  },
  {
    key: 'physician_clinical_purposes',
    header: 'physician_clinical_purposes (pipe-delimited)',
    width: 44,
    group: 'editable',
    value: (row) => physicianValue(row.physician_clinical_purposes, row.clinical_purposes),
  },
  {
    key: 'physician_disease_tags',
    header: 'physician_disease_tags (pipe-delimited)',
    width: 44,
    group: 'editable',
    value: (row) => physicianValue(row.physician_disease_tags, row.disease_tags),
  },
  {
    key: 'physician_disease_tag_status',
    header: 'physician_disease_tag_status',
    width: 28,
    group: 'editable',
    value: (row) => physicianValue(row.physician_disease_tag_status, row.disease_tag_status),
    validationName: 'DiseaseTagStatusOptions',
  },
  {
    key: 'physician_study_design',
    header: 'physician_study_design',
    width: 28,
    group: 'editable',
    value: (row) => physicianValue(row.physician_study_design, row.study_design),
    validationName: 'StudyDesignOptions',
  },
  {
    key: 'physician_publication_status',
    header: 'physician_publication_status',
    width: 28,
    group: 'editable',
    value: (row) => physicianValue(row.physician_publication_status, row.publication_status),
    validationName: 'PublicationStatusOptions',
  },
  {
    key: 'physician_enrichment_confidence',
    header: 'physician_enrichment_confidence',
    width: 27,
    group: 'editable',
    value: (row) => physicianValue(row.physician_enrichment_confidence, row.enrichment_confidence),
    validationName: 'EnrichmentConfidenceOptions',
  },
  {
    key: 'physician_reviewed',
    header: 'physician_reviewed',
    width: 20,
    group: 'editable',
    value: (row) => normalizedBoolean(row.physician_reviewed || 'false'),
    validationName: 'BooleanOptions',
  },
  {
    key: 'physician_notes',
    header: 'physician_notes (required when modified)',
    width: 56,
    group: 'editable',
    value: (row) => row.physician_notes,
  },
  {
    key: 'completion_status',
    header: 'completion_status (formula)',
    width: 24,
    group: 'formula',
    value: () => '',
  },
  {
    key: 'proposed_provenance',
    header: 'proposed_provenance (formula)',
    width: 40,
    group: 'formula',
    value: () => '',
  },
]

function reviewColumnIndex(key: string): number {
  const index = REVIEW_COLUMNS.findIndex((column) => column.key === key)
  if (index < 0) throw new Error(`Workbook review column "${key}" is not defined.`)
  return index + 1
}

function reviewColumnLetter(key: string): string {
  return columnName(reviewColumnIndex(key))
}

function completionFormula(rowNumber: number): string {
  const action = reviewColumnLetter('physician_action')
  const reviewed = reviewColumnLetter('physician_reviewed')
  const notes = reviewColumnLetter('physician_notes')
  const policy = reviewColumnLetter('coordinator_policy_status')
  const conflictFields = reviewColumnLetter('coordinator_conflict_fields')
  const physicianTopics = reviewColumnLetter('physician_topic_ids')
  return `IF(LOWER($${policy}${rowNumber})="conflict",IF(AND(LOWER($${reviewed}${rowNumber})="true",LOWER($${action}${rowNumber})="adjudicate",OR(NOT(ISNUMBER(SEARCH("|topic_ids|","|"&$${conflictFields}${rowNumber}&"|"))),LEN(TRIM($${physicianTopics}${rowNumber}))>0),LEN(TRIM($${notes}${rowNumber}))>0),"Complete","Incomplete"),IF(AND(LOWER($${reviewed}${rowNumber})="true",OR(LOWER($${action}${rowNumber})="accept",LOWER($${action}${rowNumber})="modify"),OR(LOWER($${action}${rowNumber})="accept",AND(LOWER($${action}${rowNumber})="modify",LEN(TRIM($${notes}${rowNumber}))>0))),"Complete","Incomplete"))`
}

function provenanceFormula(rowNumber: number): string {
  const action = reviewColumnLetter('physician_action')
  const completion = reviewColumnLetter('completion_status')
  return `IF($${completion}${rowNumber}<>"Complete","unresolved_enrichment",IF(LOWER($${action}${rowNumber})="accept","physician_confirmed_ai_enrichment","physician_modified_ai_enrichment"))`
}

function cachedCompletionStatus(row: GoldEnrichmentV3ReviewWorkbookRow): string {
  const action = row.physician_action?.trim().toLowerCase()
  const reviewed = normalizedBoolean(row.physician_reviewed || 'false') === 'true'
  const notes = Boolean(row.physician_notes?.trim())
  if (row.coordinator_policy_status === 'conflict') {
    const topicResolved =
      !row.coordinator_conflict_fields?.split('|').includes('topic_ids') ||
      Boolean(row.physician_topic_ids.trim())
    return reviewed && action === 'adjudicate' && topicResolved && notes ? 'Complete' : 'Incomplete'
  }
  return reviewed && (action === 'accept' || (action === 'modify' && notes))
    ? 'Complete'
    : 'Incomplete'
}

function cachedProvenance(row: GoldEnrichmentV3ReviewWorkbookRow): string {
  if (cachedCompletionStatus(row) !== 'Complete') return 'unresolved_enrichment'
  return row.physician_action?.trim().toLowerCase() === 'accept'
    ? 'physician_confirmed_ai_enrichment'
    : 'physician_modified_ai_enrichment'
}

function columnStyle(group: ReviewColumnGroup): number {
  if (group === 'editable') return 7
  if (group === 'formula') return 8
  if (group === 'concern') return 9
  return 6
}

function workbookLookupColumns(
  controlledValues: GoldEnrichmentV3ReviewWorkbookControlledValues,
): readonly LookupColumn[] {
  const knownControlledValueKeys = new Set([
    'metadata_sufficiency',
    'topic_ids',
    'technology_tags',
    'technology_tag_status',
    'clinical_purposes',
    'disease_tags',
    'disease_tag_status',
    'study_design',
    'publication_status',
    'enrichment_confidence',
  ])
  const additionalColumns = Object.keys(controlledValues)
    .filter((key) => !knownControlledValueKeys.has(key))
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map(
      (key): LookupColumn => ({
        header: key,
        values: controlledValues[key],
        width: 36,
      }),
    )
  return [
    {
      header: 'Review Action',
      values: REVIEW_ACTIONS,
      width: 22,
      definedName: 'ReviewActionOptions',
    },
    {
      header: 'Metadata Sufficiency',
      values: controlledValues.metadata_sufficiency,
      width: 30,
      definedName: 'MetadataSufficiencyOptions',
    },
    { header: 'Topic IDs', values: controlledValues.topic_ids, width: 46 },
    { header: 'Technology Tags', values: controlledValues.technology_tags, width: 42 },
    {
      header: 'Technology Tag Status',
      values: controlledValues.technology_tag_status,
      width: 30,
      definedName: 'TechnologyTagStatusOptions',
    },
    { header: 'Clinical Purposes', values: controlledValues.clinical_purposes, width: 42 },
    { header: 'Disease Tags', values: controlledValues.disease_tags, width: 42 },
    {
      header: 'Disease Tag Status',
      values: controlledValues.disease_tag_status,
      width: 30,
      definedName: 'DiseaseTagStatusOptions',
    },
    {
      header: 'Study Design',
      values: controlledValues.study_design,
      width: 34,
      definedName: 'StudyDesignOptions',
    },
    {
      header: 'Publication Status',
      values: controlledValues.publication_status,
      width: 34,
      definedName: 'PublicationStatusOptions',
    },
    {
      header: 'Enrichment Confidence',
      values: controlledValues.enrichment_confidence,
      width: 28,
      definedName: 'EnrichmentConfidenceOptions',
    },
    {
      header: 'Boolean',
      values: BOOLEAN_VALUES,
      width: 16,
      definedName: 'BooleanOptions',
    },
    ...additionalColumns,
  ]
}

function metadataEntries(
  metadata: GoldEnrichmentV3ReviewWorkbookMetadata,
  cohorts: GoldEnrichmentV3ReviewWorkbookCohorts,
): readonly [string, string][] {
  return [
    ['workflow_id', metadata.workflow_id],
    ['workflow_schema_version', metadata.workflow_schema_version],
    ['coordinator_schema_version', metadata.coordinator_schema_version ?? ''],
    ['merged_schema_version', metadata.merged_schema_version],
    ['prompt_template_version', metadata.prompt_template_version],
    ['result_schema_version', metadata.result_schema_version],
    ['taxonomy_version', metadata.taxonomy_version],
    ['label_schema_version', metadata.label_schema_version],
    ['enrichment_schema_version', metadata.enrichment_schema_version],
    ['source_sha256', metadata.source_sha256],
    ['merged_sha256', metadata.merged_sha256],
    ['physician_field_sha256', metadata.physician_field_sha256],
    ['required_review_count', String(metadata.required_review_count)],
    ['qc_sample_count', String(metadata.qc_sample_count)],
    ['acceptance_candidate_count', String(metadata.acceptance_candidate_count)],
    ['actual_required_review_rows', String(cohorts.required_review.length)],
    ['actual_qc_sample_50_rows', String(cohorts.qc_sample_50.length)],
    [
      'actual_protocol_acceptance_candidate_rows',
      String(cohorts.protocol_acceptance_candidates.length),
    ],
    ['core_properties_timestamp', CORE_PROPERTIES_TIMESTAMP],
  ]
}

function assertSha256(value: string, field: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(`Workbook metadata ${field} must be a SHA-256 value.`)
  }
}

function assertControlledValues(
  controlledValues: GoldEnrichmentV3ReviewWorkbookControlledValues,
): void {
  const requiredFields = [
    'metadata_sufficiency',
    'topic_ids',
    'technology_tags',
    'technology_tag_status',
    'clinical_purposes',
    'disease_tags',
    'disease_tag_status',
    'study_design',
    'publication_status',
    'enrichment_confidence',
  ] as const
  for (const field of requiredFields) {
    if (!Array.isArray(controlledValues[field])) {
      throw new Error(`Workbook controlled values are missing ${field}.`)
    }
  }
  for (const [field, rawValues] of Object.entries(controlledValues)) {
    const values = rawValues as readonly string[]
    if (values.length === 0) {
      throw new Error(`Workbook controlled values ${field} must not be empty.`)
    }
    if (values.some((value) => !value.trim())) {
      throw new Error(`Workbook controlled values ${field} contain a blank value.`)
    }
    if (new Set(values).size !== values.length) {
      throw new Error(`Workbook controlled values ${field} contain a duplicate value.`)
    }
  }
}

function assertWorkbookInput(
  cohorts: GoldEnrichmentV3ReviewWorkbookCohorts,
  metadata: GoldEnrichmentV3ReviewWorkbookMetadata,
): void {
  for (const sheetName of GOLD_ENRICHMENT_V3_REVIEW_WORKBOOK_SHEETS) {
    if (sheetName.length > 31)
      throw new Error(`Workbook sheet name exceeds 31 characters: ${sheetName}`)
  }
  const metadataStrings = [
    metadata.workflow_id,
    metadata.workflow_schema_version,
    metadata.coordinator_schema_version ?? '',
    metadata.merged_schema_version,
    metadata.prompt_template_version,
    metadata.result_schema_version,
    metadata.taxonomy_version,
    metadata.label_schema_version,
    metadata.enrichment_schema_version,
  ]
  if (metadataStrings.some((value) => !value.trim())) {
    throw new Error('Workbook version metadata must not contain blank values.')
  }
  assertSha256(metadata.source_sha256, 'source_sha256')
  assertSha256(metadata.merged_sha256, 'merged_sha256')
  assertSha256(metadata.physician_field_sha256, 'physician_field_sha256')
  const expectedCounts = [
    ['required_review_count', metadata.required_review_count, cohorts.required_review.length],
    ['qc_sample_count', metadata.qc_sample_count, cohorts.qc_sample_50.length],
    [
      'acceptance_candidate_count',
      metadata.acceptance_candidate_count,
      cohorts.protocol_acceptance_candidates.length,
    ],
  ] as const
  for (const [field, value, actual] of expectedCounts) {
    if (!Number.isSafeInteger(value) || value < 0 || value !== actual) {
      throw new Error(`Workbook metadata ${field} does not match its cohort row count.`)
    }
  }
  assertControlledValues(metadata.controlled_values)

  const identities = new Set<string>()
  const cohortEntries: readonly [string, readonly GoldEnrichmentV3ReviewWorkbookRow[]][] = [
    ['required_review', cohorts.required_review],
    ['qc_sample_50', cohorts.qc_sample_50],
    ['protocol_acceptance_candidates', cohorts.protocol_acceptance_candidates],
  ]
  for (const [cohortName, rows] of cohortEntries) {
    if (rows.length > MAX_EXCEL_DATA_ROWS) {
      throw new Error(`Workbook cohort ${cohortName} exceeds the Excel row limit.`)
    }
    for (const row of rows) {
      if (!row.cohort.trim() || !row.master_row_id.trim() || !row.pmid.trim()) {
        throw new Error(`Workbook cohort ${cohortName} contains a blank row identity.`)
      }
      const identity = `${row.master_row_id}\u0000${row.pmid}`
      if (identities.has(identity)) {
        throw new Error(`Workbook row identity is duplicated across cohorts: ${row.master_row_id}.`)
      }
      identities.add(identity)
      if (row.coordinator_policy_status === 'conflict') {
        const conflictFields = (row.coordinator_conflict_fields ?? '').split('|').filter(Boolean)
        if (
          cohortName !== 'required_review' ||
          !row.coordinator_conflict_diagnostics?.trim() ||
          row.coordinator_conflict_count === '0' ||
          (conflictFields.includes('topic_ids') &&
            (!row.model_topic_ids?.trim() ||
              row.topic_ids.trim() ||
              row.physician_topic_ids.trim()))
        ) {
          throw new Error(
            `Workbook coordinator conflict is not safely quarantined for PMID ${row.pmid}.`,
          )
        }
      }
    }
  }
}

function contentTypesXml(): string {
  const worksheets = GOLD_ENRICHMENT_V3_REVIEW_WORKBOOK_SHEETS.map(
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${worksheets}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
}

function packageRelationshipsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
}

function workbookXml(metadata: GoldEnrichmentV3ReviewWorkbookMetadata): string {
  const lookupColumns = workbookLookupColumns(metadata.controlled_values)
  const sheets = GOLD_ENRICHMENT_V3_REVIEW_WORKBOOK_SHEETS.map(
    (name, index) =>
      `<sheet name="${xmlAttribute(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
  ).join('')
  const definedNames = lookupColumns
    .map((column, index) => {
      if (!column.definedName) return ''
      const columnLetter = columnName(index + 1)
      const lastRow = Math.max(2, column.values.length + 1)
      return `<definedName name="${column.definedName}">'${LOOKUPS_SHEET}'!$${columnLetter}$2:$${columnLetter}$${lastRow}</definedName>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <fileVersion appName="xl" lastEdited="7" lowestEdited="7" rupBuild="0"/>
  <workbookPr date1904="0"/>
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>
  <sheets>${sheets}</sheets>
  <definedNames>${definedNames}</definedNames>
  <calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>
</workbook>`
}

function workbookRelationshipsXml(): string {
  const worksheetRelationships = GOLD_ENRICHMENT_V3_REVIEW_WORKBOOK_SHEETS.map(
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${worksheetRelationships}
  <Relationship Id="rId${GOLD_ENRICHMENT_V3_REVIEW_WORKBOOK_SHEETS.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="11"/><color rgb="FF1F2937"/><name val="Aptos"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="20"/><color rgb="FF17365D"/><name val="Aptos Display"/><family val="2"/><scheme val="major"/></font>
    <font><b/><sz val="11"/><color rgb="FF17365D"/><name val="Aptos"/><family val="2"/><scheme val="minor"/></font>
    <font><b/><sz val="11"/><color rgb="FF7F6000"/><name val="Aptos"/><family val="2"/><scheme val="minor"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF17365D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2F0D9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFCE4D6"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE7E6E6"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFB8C4CE"/></left><right style="thin"><color rgb="FFB8C4CE"/></right><top style="thin"><color rgb="FFB8C4CE"/></top><bottom style="thin"><color rgb="FFB8C4CE"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="11">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="49" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="49" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="top" wrapText="1"/><protection locked="1"/></xf>
    <xf numFmtId="49" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="top" wrapText="1"/><protection locked="0"/></xf>
    <xf numFmtId="49" fontId="0" fillId="7" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="top" wrapText="1"/><protection locked="1"/></xf>
    <xf numFmtId="49" fontId="4" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="top" wrapText="1"/><protection locked="1"/></xf>
    <xf numFmtId="49" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="top" wrapText="1"/><protection locked="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="2">
    <dxf><font><b/><color rgb="FF375623"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFE2F0D9"/><bgColor indexed="64"/></patternFill></fill></dxf>
    <dxf><font><b/><color rgb="FF9C0006"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/><bgColor indexed="64"/></patternFill></fill></dxf>
  </dxfs>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`
}

function corePropertiesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Gold-set V3 Physician Enrichment Review</dc:title>
  <dc:subject>Deterministic physician review of independent V3 enrichment proposals</dc:subject>
  <dc:creator>Interventional Pulmonology Education</dc:creator>
  <cp:lastModifiedBy>Interventional Pulmonology Education</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${CORE_PROPERTIES_TIMESTAMP}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${CORE_PROPERTIES_TIMESTAMP}</dcterms:modified>
</cp:coreProperties>`
}

function extendedPropertiesXml(): string {
  const titles = GOLD_ENRICHMENT_V3_REVIEW_WORKBOOK_SHEETS.map(
    (name) => `<vt:lpstr>${xmlText(name)}</vt:lpstr>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Excel Compatible</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${GOLD_ENRICHMENT_V3_REVIEW_WORKBOOK_SHEETS.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="${GOLD_ENRICHMENT_V3_REVIEW_WORKBOOK_SHEETS.length}" baseType="lpstr">${titles}</vt:vector></TitlesOfParts>
  <Company>Interventional Pulmonology Education</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>`
}

function worksheetProtectionXml(): string {
  return '<sheetProtection sheet="1" objects="1" scenarios="1" formatCells="1" formatColumns="1" formatRows="1" insertColumns="1" insertRows="1" insertHyperlinks="1" deleteColumns="1" deleteRows="1" selectLockedCells="0" selectUnlockedCells="0" sort="0" autoFilter="0"/>'
}

function instructionsWorksheetXml(
  cohorts: GoldEnrichmentV3ReviewWorkbookCohorts,
  metadata: GoldEnrichmentV3ReviewWorkbookMetadata,
): string {
  const instructions: readonly [string, string][] = [
    [
      'Purpose',
      'Review independent V3 enrichment proposals without changing fixed physician relevance decisions or creating import rows.',
    ],
    [
      'Sheet order',
      'Use Required Review first, then QC Sample 50. Protocol Acceptance Candidates is a separate prospective cohort and is not individually physician-confirmed.',
    ],
    [
      'Independent proposal boundary',
      'Blue V3 proposal columns appear before external-QA and taxonomy-v2 upgrade concerns. QA and upgrade evidence is shown only after the independent proposal.',
    ],
    [
      'Review flag boundary',
      'The model review request is a raw self-assessment. Required Review membership and reasons are computed later by the local coordinator; a false model request never removes a coordinator-required row.',
    ],
    [
      'Editable cells',
      'Blue cells are locked source/proposal evidence. Yellow cells are physician-editable. Worksheet protection is a usability aid rather than a security boundary.',
    ],
    [
      'Accept, modify, or adjudicate',
      'Choose accept to retain a policy-cleared V3 proposal, modify to change one or more physician enrichment fields, or adjudicate when a coordinator conflict is present. Fixed physician relevance label/confidence cannot be edited.',
    ],
    [
      'Coordinator conflicts',
      'A conflict preserves the untouched raw model value in raw_model_* columns, leaves the conflicted coordinator and physician field blank, and requires physician_action=adjudicate, reviewed=true, an allowed resolved value, and a note. No automatic correction is permitted.',
    ],
    [
      'Pipe-delimited fields',
      'Topic IDs, technology tags, clinical purposes, and disease tags use pipe-delimited controlled IDs. Consult Lookups and preserve exact IDs; do not add free-text values.',
    ],
    [
      'Completion rule',
      'For a nonconflicted row, completion_status is Complete only when physician_reviewed=true, physician_action is accept or modify, and physician_notes is nonblank for a modification. A coordinator-conflict row instead requires adjudicate, a resolved value for every conflicted field, and a note.',
    ],
    [
      'Provenance rule',
      'A completed accepted row proposes physician_confirmed_ai_enrichment; a completed modified or adjudicated row proposes physician_modified_ai_enrichment. Every incomplete or unreviewed row remains unresolved_enrichment.',
    ],
    [
      'Protocol acceptance boundary',
      'Protocol Acceptance Candidates are not individually physician-confirmed. Acceptance requires explicit authorization after QC; prospective provenance is ai_generated_enrichment_qc_accepted. No import occurs from this workbook.',
    ],
    [
      'No import',
      'Saving or returning this workbook does not import enrichment, mutate a database, update a batch, or authorize protocol-based acceptance.',
    ],
    ['Required Review rows', String(cohorts.required_review.length)],
    ['QC Sample 50 rows', String(cohorts.qc_sample_50.length)],
    ['Protocol Acceptance Candidates rows', String(cohorts.protocol_acceptance_candidates.length)],
    ['Protocol sheet full name', 'Protocol Acceptance Candidates'],
    ...metadataEntries(metadata, cohorts),
  ]
  const rows = [
    rowXml(1, [textCell('A1', 'Gold-set V3 Physician Enrichment Review', 1)], 32),
    rowXml(
      2,
      [
        textCell(
          'A2',
          'Review artifact only — no relevance decision changes, protocol authorization, database mutation, or import occurs from this workbook.',
          2,
        ),
      ],
      36,
    ),
    ...instructions.map(([label, body], index) => {
      const rowNumber = index + 4
      return rowXml(
        rowNumber,
        [textCell(`A${rowNumber}`, label, 3), textCell(`B${rowNumber}`, body, 4)],
        Math.max(24, Math.min(90, 18 + Math.ceil(body.length / 90) * 15)),
      )
    }),
  ]
  const lastRow = instructions.length + 3
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:B${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols><col min="1" max="1" width="38" customWidth="1"/><col min="2" max="2" width="112" customWidth="1"/></cols>
  <sheetData>${rows.join('')}</sheetData>
  <mergeCells count="2"><mergeCell ref="A1:B1"/><mergeCell ref="A2:B2"/></mergeCells>
  ${worksheetProtectionXml()}
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="1"/>
</worksheet>`
}

function dataValidationsXml(lastRow: number): string {
  const validations = REVIEW_COLUMNS.flatMap((column, index) => {
    if (!column.validationName) return []
    const letter = columnName(index + 1)
    const label = column.header.replace(/ \(.+\)$/, '')
    return [
      `<dataValidation type="list" allowBlank="1" showErrorMessage="1" showInputMessage="1" errorStyle="stop" errorTitle="Invalid ${xmlAttribute(label)}" error="Choose an allowed value from the dropdown list." promptTitle="Controlled value" prompt="Choose an allowed value from Lookups." sqref="${letter}2:${letter}${lastRow}"><formula1>${column.validationName}</formula1></dataValidation>`,
    ]
  })
  return `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`
}

function reviewWorksheetXml(rows: readonly GoldEnrichmentV3ReviewWorkbookRow[]): string {
  const lastColumn = columnName(REVIEW_COLUMNS.length)
  const lastRow = Math.max(2, rows.length + 1)
  const completionColumn = reviewColumnLetter('completion_status')
  const columnXml = REVIEW_COLUMNS.map(
    (column, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`,
  ).join('')
  const headerRow = rowXml(
    1,
    REVIEW_COLUMNS.map((column, index) => textCell(`${columnName(index + 1)}1`, column.header, 5)),
    52,
  )
  const dataRows = rows.map((row, index) => {
    const rowNumber = index + 2
    return rowXml(
      rowNumber,
      REVIEW_COLUMNS.map((column, columnIndex) => {
        const reference = `${columnName(columnIndex + 1)}${rowNumber}`
        if (column.key === 'completion_status') {
          return formulaStringCell(
            reference,
            completionFormula(rowNumber),
            cachedCompletionStatus(row),
            columnStyle(column.group),
          )
        }
        if (column.key === 'proposed_provenance') {
          return formulaStringCell(
            reference,
            provenanceFormula(rowNumber),
            cachedProvenance(row),
            columnStyle(column.group),
          )
        }
        return textCell(reference, column.value(row), columnStyle(column.group))
      }),
      60,
    )
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="${reviewColumnLetter('physician_action')}2" sqref="${reviewColumnLetter('physician_action')}2"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columnXml}</cols>
  <sheetData>${headerRow}${dataRows.join('')}</sheetData>
  ${worksheetProtectionXml()}
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
  <conditionalFormatting sqref="${completionColumn}2:${completionColumn}${lastRow}">
    <cfRule type="expression" dxfId="0" priority="1" stopIfTrue="1"><formula>$${completionColumn}2="Complete"</formula></cfRule>
    <cfRule type="expression" dxfId="1" priority="2" stopIfTrue="1"><formula>$${completionColumn}2="Incomplete"</formula></cfRule>
  </conditionalFormatting>
  ${dataValidationsXml(lastRow)}
  <pageMargins left="0.2" right="0.2" top="0.45" bottom="0.45" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="6" fitToHeight="0" paperSize="1"/>
  <ignoredErrors><ignoredError sqref="A2:B${lastRow}" numberStoredAsText="1"/></ignoredErrors>
</worksheet>`
}

const PROTOCOL_COLUMNS: readonly ReviewColumn[] = [
  ...REVIEW_COLUMNS.filter(
    (column) =>
      column.group === 'source' || column.group === 'proposal' || column.group === 'concern',
  ),
  {
    key: 'protocol_review_status',
    header: 'protocol_review_status',
    width: 38,
    group: 'formula',
    value: () => 'not_individually_physician_confirmed',
  },
  {
    key: 'authorization_required_after_qc',
    header: 'authorization_required_after_qc',
    width: 32,
    group: 'formula',
    value: () => 'true',
  },
  {
    key: 'prospective_provenance',
    header: 'prospective_provenance',
    width: 42,
    group: 'formula',
    value: () => 'ai_generated_enrichment_qc_accepted',
  },
  {
    key: 'import_status',
    header: 'import_status',
    width: 40,
    group: 'formula',
    value: () => 'no_import_occurs_from_this_workbook',
  },
]

function protocolWorksheetXml(rows: readonly GoldEnrichmentV3ReviewWorkbookRow[]): string {
  const headerRowNumber = 4
  const firstDataRow = headerRowNumber + 1
  const lastColumn = columnName(PROTOCOL_COLUMNS.length)
  const lastRow = Math.max(firstDataRow, rows.length + headerRowNumber)
  const columnXml = PROTOCOL_COLUMNS.map(
    (column, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`,
  ).join('')
  const headerRow = rowXml(
    headerRowNumber,
    PROTOCOL_COLUMNS.map((column, index) =>
      textCell(`${columnName(index + 1)}${headerRowNumber}`, column.header, 5),
    ),
    52,
  )
  const dataRows = rows.map((row, index) => {
    const rowNumber = firstDataRow + index
    return rowXml(
      rowNumber,
      PROTOCOL_COLUMNS.map((column, columnIndex) =>
        textCell(
          `${columnName(columnIndex + 1)}${rowNumber}`,
          column.value(row),
          columnStyle(column.group),
        ),
      ),
      60,
    )
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="2" ySplit="4" topLeftCell="C5" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="C5" sqref="C5"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columnXml}</cols>
  <sheetData>
    ${rowXml(1, [textCell('A1', 'Protocol Acceptance Candidates', 1)], 32)}
    ${rowXml(2, [textCell('A2', 'These rows are not individually physician-confirmed. Acceptance requires explicit user authorization after QC.', 2)], 34)}
    ${rowXml(3, [textCell('A3', 'Prospective provenance: ai_generated_enrichment_qc_accepted. No import occurs from this workbook.', 9)], 32)}
    ${headerRow}${dataRows.join('')}
  </sheetData>
  <mergeCells count="3"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/><mergeCell ref="A3:${lastColumn}3"/></mergeCells>
  ${worksheetProtectionXml()}
  <autoFilter ref="A${headerRowNumber}:${lastColumn}${lastRow}"/>
  <pageMargins left="0.2" right="0.2" top="0.45" bottom="0.45" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="6" fitToHeight="0" paperSize="1"/>
  <ignoredErrors><ignoredError sqref="A${firstDataRow}:B${lastRow}" numberStoredAsText="1"/></ignoredErrors>
</worksheet>`
}

function lookupsWorksheetXml(
  cohorts: GoldEnrichmentV3ReviewWorkbookCohorts,
  metadata: GoldEnrichmentV3ReviewWorkbookMetadata,
): string {
  const lookupColumns = workbookLookupColumns(metadata.controlled_values)
  const provenanceColumns: readonly LookupColumn[] = [
    {
      header: 'Enrichment Provenance',
      values: [
        'physician_confirmed_ai_enrichment',
        'physician_modified_ai_enrichment',
        'ai_generated_enrichment_qc_accepted',
        'legacy_v1_enrichment',
        'full_text_ai_enrichment_pending_physician',
        'unresolved_enrichment',
      ],
      width: 44,
    },
  ]
  const columns = [...lookupColumns, ...provenanceColumns]
  const metadataValues = metadataEntries(metadata, cohorts)
  const rowCount = Math.max(
    1,
    metadataValues.length,
    ...columns.map((column) => column.values.length),
  )
  const metadataKeyColumn = columns.length + 1
  const metadataValueColumn = columns.length + 2
  const lastColumn = columnName(metadataValueColumn)
  const columnXml = [
    ...columns.map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`,
    ),
    `<col min="${metadataKeyColumn}" max="${metadataKeyColumn}" width="36" customWidth="1"/>`,
    `<col min="${metadataValueColumn}" max="${metadataValueColumn}" width="72" customWidth="1"/>`,
  ].join('')
  const headerRow = rowXml(
    1,
    [
      ...columns.map((column, index) => textCell(`${columnName(index + 1)}1`, column.header, 5)),
      textCell(`${columnName(metadataKeyColumn)}1`, 'Metadata Field', 5),
      textCell(`${columnName(metadataValueColumn)}1`, 'Metadata Value', 5),
    ],
    42,
  )
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const rowNumber = index + 2
    const metadataEntry = metadataValues[index]
    return rowXml(
      rowNumber,
      [
        ...columns.map((column, columnIndex) =>
          textCell(`${columnName(columnIndex + 1)}${rowNumber}`, column.values[index] ?? '', 10),
        ),
        textCell(`${columnName(metadataKeyColumn)}${rowNumber}`, metadataEntry?.[0] ?? '', 10),
        textCell(`${columnName(metadataValueColumn)}${rowNumber}`, metadataEntry?.[1] ?? '', 10),
      ],
      30,
    )
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${lastColumn}${rowCount + 1}"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columnXml}</cols>
  <sheetData>${headerRow}${rows.join('')}</sheetData>
  ${worksheetProtectionXml()}
  <autoFilter ref="A1:${lastColumn}${rowCount + 1}"/>
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="3" fitToHeight="0" paperSize="1"/>
</worksheet>`
}

export async function buildGoldEnrichmentV3ReviewWorkbookBytes(
  cohorts: GoldEnrichmentV3ReviewWorkbookCohorts,
  metadata: GoldEnrichmentV3ReviewWorkbookMetadata,
): Promise<Uint8Array> {
  assertWorkbookInput(cohorts, metadata)
  const zip = new JSZip()
  addZipText(zip, '[Content_Types].xml', contentTypesXml())
  addZipText(zip, '_rels/.rels', packageRelationshipsXml())
  addZipText(zip, 'docProps/core.xml', corePropertiesXml())
  addZipText(zip, 'docProps/app.xml', extendedPropertiesXml())
  addZipText(zip, 'xl/workbook.xml', workbookXml(metadata))
  addZipText(zip, 'xl/_rels/workbook.xml.rels', workbookRelationshipsXml())
  addZipText(zip, 'xl/styles.xml', stylesXml())
  addZipText(zip, 'xl/worksheets/sheet1.xml', instructionsWorksheetXml(cohorts, metadata))
  addZipText(zip, 'xl/worksheets/sheet2.xml', reviewWorksheetXml(cohorts.required_review))
  addZipText(zip, 'xl/worksheets/sheet3.xml', reviewWorksheetXml(cohorts.qc_sample_50))
  addZipText(
    zip,
    'xl/worksheets/sheet4.xml',
    protocolWorksheetXml(cohorts.protocol_acceptance_candidates),
  )
  addZipText(zip, 'xl/worksheets/sheet5.xml', lookupsWorksheetXml(cohorts, metadata))

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'DOS',
    mimeType: GOLD_ENRICHMENT_V3_REVIEW_XLSX_MIME,
  })
}
