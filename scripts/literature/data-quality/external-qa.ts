import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'

import { parseCsvRows } from '@/features/literature/gold-set/export'

export const EXTERNAL_QA_COLUMNS = [
  'source_review',
  'severity',
  'category',
  'master_row_id',
  'pmid',
  'field',
  'issue',
  'current_value_in_external_review',
  'suggested_action',
  'title',
  'status_against_v2',
  'review_tier',
] as const

export const V2_SOURCE_COLUMNS = [
  'batch_row_id',
  'master_row_id',
  'screening_batch',
  'source_row_id',
  'pmid',
  'title',
  'abstract',
  'mesh',
  'author_keywords',
  'publication_types',
  'journal',
  'year',
  'language',
  'no_abstract',
  'physician_final_label',
  'physician_final_confidence',
  'metadata_sufficiency',
  'topic_ids',
  'technology_tags',
  'clinical_purposes',
  'disease_tags',
  'study_design',
  'publication_status',
  'categorization_from_full_text',
  'ai_used_supplemental_metadata',
  'enrichment_confidence',
  'requires_physician_enrichment_review',
  'enrichment_rationale',
  'processing_status',
  'processing_error',
  'full_text_used',
  'full_text_filename',
  'full_text_sha256',
  'relevance_concern',
  'relevance_concern_note',
  'full_text_evidence_1_location',
  'full_text_evidence_1_text',
  'full_text_evidence_2_location',
  'full_text_evidence_2_text',
  'full_text_evidence_3_location',
  'full_text_evidence_3_text',
  'partial_text_available',
  'partial_text_filename',
  'partial_text_sha256',
  'partial_text_note',
  'physician_metadata_sufficiency',
  'physician_topic_ids',
  'physician_technology_tags',
  'physician_clinical_purposes',
  'physician_disease_tags',
  'physician_study_design',
  'physician_publication_status',
  'physician_enrichment_accept_or_modify',
  'physician_enrichment_notes',
  'physician_enrichment_reviewed',
] as const

export const PHYSICIAN_FIELDS = [
  'physician_final_label',
  'physician_final_confidence',
  'physician_metadata_sufficiency',
  'physician_topic_ids',
  'physician_technology_tags',
  'physician_clinical_purposes',
  'physician_disease_tags',
  'physician_study_design',
  'physician_publication_status',
  'physician_enrichment_accept_or_modify',
  'physician_enrichment_notes',
  'physician_enrichment_reviewed',
] as const satisfies readonly (typeof V2_SOURCE_COLUMNS)[number][]

export const EXTERNAL_QA_TIERS = [
  'direct_targeted',
  'rule_based_consistency',
  'global_data_quality',
] as const

export const EXTERNAL_QA_SEVERITIES = ['High', 'Medium', 'Low'] as const
export const EXTERNAL_QA_TITLE_PREFIX_LENGTH = 180
export const CANONICAL_EXTERNAL_QA_FINDINGS_SHA256 =
  '1c7992f29bb7c03afc370f3cb0e7a978a237dc9cbb964966e0dcec0cd07b6edd'
export const CANONICAL_V2_SOURCE_SHA256 =
  '62003ac04650a4d303a8cc73785452a0bdf3ddeeca3c1ea87bdf2e4e4bc0b15c'
export const CANONICAL_V2_SOURCE_ROWS = 630

export type ExternalQaColumn = (typeof EXTERNAL_QA_COLUMNS)[number]
export type V2SourceColumn = (typeof V2_SOURCE_COLUMNS)[number]
export type ExternalQaTier = (typeof EXTERNAL_QA_TIERS)[number]
export type ExternalQaSeverity = (typeof EXTERNAL_QA_SEVERITIES)[number]

export type ExternalQaFinding = Record<ExternalQaColumn, string> & {
  csv_record_number: number
  review_tier: ExternalQaTier
  severity: ExternalQaSeverity
}

export type V2SourceRow = Record<V2SourceColumn, string> & {
  csv_record_number: number
}

interface ParsedV2Source {
  rows: V2SourceRow[]
  byPmid: Map<string, V2SourceRow>
  byMasterRowId: Map<string, V2SourceRow>
}

export interface ExternalQaTierSummary {
  findings: number
  uniquePmids: number
  severity: Record<string, number>
  category: Record<string, number>
  status: Record<string, number>
}

export type ExternalQaMismatchCode =
  | 'pmid_not_found'
  | 'master_row_id_not_found'
  | 'identifier_pair_mismatch'
  | 'title_mismatch'

export interface ExternalQaSourceMismatch {
  code: ExternalQaMismatchCode
  csvRecordNumber: number
  reviewTier: Exclude<ExternalQaTier, 'global_data_quality'>
  pmid: string
  masterRowId: string
  field: string
  expected: string | null
  actual: string
  message: string
}

export interface ExternalQaAuditReport {
  reportVersion: '1.0.0'
  generatedAt: string
  operation: 'read_only_external_qa_validation'
  sources: {
    findings: {
      path: string | null
      rows: number
      sha256: string
      sha256AfterReadOnlyAudit: string
    }
    v2Source: {
      path: string | null
      rows: number
      uniquePmids: number
      uniqueMasterRowIds: number
      sha256: string
      sha256AfterReadOnlyAudit: string
    }
  }
  summaries: {
    totalFindings: number
    uniqueTargetedPmids: number
    severity: Record<string, number>
    category: Record<string, number>
    status: Record<string, number>
    tier: Record<ExternalQaTier, number>
    byTier: Record<ExternalQaTier, ExternalQaTierSummary>
  }
  findingsByTier: Record<ExternalQaTier, ExternalQaFinding[]>
  validation: {
    ok: boolean
    mismatchCount: number
    mismatches: ExternalQaSourceMismatch[]
    titleMatches: {
      exact: number
      acceptedTruncatedPrefix: number
      mismatch: number
      notValidated: number
    }
  }
  physicianFieldIntegrity: {
    fields: readonly (typeof PHYSICIAN_FIELDS)[number][]
    sha256Before: string
    sha256After: string
    unchanged: boolean
  }
  provenanceVerification: {
    method: 'sha256_allowlist_and_exact_source_row_count'
    verified: true
    expected: ExternalQaExpectedProvenance
    actual: ExternalQaExpectedProvenance
  }
  safety: {
    developmentOnlyInputs: true
    heldOutTestSplitAccessed: false
    databaseAccessed: false
    networkAccessed: false
    sourceFilesModified: false
    inputHashesUnchanged: boolean
    mutationPlan: null
  }
}

export interface ExternalQaExpectedProvenance {
  readonly findingsSha256: string
  readonly sourceRows: number
  readonly sourceSha256: string
}

export const CANONICAL_EXTERNAL_QA_PROVENANCE: ExternalQaExpectedProvenance = Object.freeze({
  findingsSha256: CANONICAL_EXTERNAL_QA_FINDINGS_SHA256,
  sourceRows: CANONICAL_V2_SOURCE_ROWS,
  sourceSha256: CANONICAL_V2_SOURCE_SHA256,
})

export interface BuildExternalQaAuditOptions {
  expectedProvenance: ExternalQaExpectedProvenance
  findingsCsv: string
  sourceCsv: string
  findingsPath?: string
  sourcePath?: string
  generatedAt?: string
}

export interface RunExternalQaAuditOptions {
  expectedProvenance?: ExternalQaExpectedProvenance
  findingsPath: string
  sourcePath: string
  outputPath?: string
  workspaceRoot?: string
  generatedAt?: string
}

export interface RunExternalQaAuditResult {
  outputPath: string
  report: ExternalQaAuditReport
}

const POSITIVE_DECIMAL = /^[1-9]\d*$/u
const FORBIDDEN_SPLIT_PATH_TOKEN = /(?:^|[\\/_. -])(?:test|all|held[ _-]?out)(?=$|[\\/_. -])/iu

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function validateExpectedExternalQaProvenance(expected: ExternalQaExpectedProvenance) {
  for (const [label, value] of [
    ['expected findings', expected.findingsSha256],
    ['expected source', expected.sourceSha256],
  ] as const) {
    if (!/^[a-f0-9]{64}$/u.test(value)) {
      throw new Error(`External QA ${label} SHA-256 allowlist value is invalid.`)
    }
  }
  if (!Number.isSafeInteger(expected.sourceRows) || expected.sourceRows < 1) {
    throw new Error('External QA expected source row count must be a positive integer.')
  }
}

function verifyExternalQaProvenance(
  expected: ExternalQaExpectedProvenance,
  actual: ExternalQaExpectedProvenance,
) {
  validateExpectedExternalQaProvenance(expected)
  if (actual.findingsSha256 !== expected.findingsSha256) {
    throw new Error(
      `External QA findings provenance verification failed: expected SHA-256 ${expected.findingsSha256}, received ${actual.findingsSha256}.`,
    )
  }
  if (actual.sourceSha256 !== expected.sourceSha256) {
    throw new Error(
      `External QA source provenance verification failed: expected SHA-256 ${expected.sourceSha256}, received ${actual.sourceSha256}.`,
    )
  }
  if (actual.sourceRows !== expected.sourceRows) {
    throw new Error(
      `External QA source provenance verification failed: expected exactly ${expected.sourceRows} rows, received ${actual.sourceRows}.`,
    )
  }
  return {
    method: 'sha256_allowlist_and_exact_source_row_count' as const,
    verified: true as const,
    expected: { ...expected },
    actual: { ...actual },
  }
}

function withoutBom(value: string) {
  return value.startsWith('\uFEFF') ? value.slice(1) : value
}

function exactCsvRecords<Column extends string>(
  input: string,
  label: string,
  expectedColumns: readonly Column[],
): Record<Column, string>[] {
  const parsed = parseCsvRows(withoutBom(input))
  if (parsed.length === 0) throw new Error(`${label} is empty.`)

  const actualColumns = parsed[0]
  if (
    actualColumns.length !== expectedColumns.length ||
    actualColumns.some((column, index) => column !== expectedColumns[index])
  ) {
    throw new Error(
      `${label} header must exactly match the required ${expectedColumns.length}-column schema. ` +
        `Expected: ${expectedColumns.join(', ')}. Received: ${actualColumns.join(', ')}.`,
    )
  }

  if (parsed.length === 1) throw new Error(`${label} contains no data rows.`)
  return parsed.slice(1).map((values, index) => {
    const recordNumber = index + 2
    if (values.length !== expectedColumns.length) {
      throw new Error(
        `${label} CSV record ${recordNumber} has ${values.length} columns; expected ${expectedColumns.length}.`,
      )
    }
    return Object.fromEntries(
      expectedColumns.map((column, columnIndex) => [column, values[columnIndex]]),
    ) as Record<Column, string>
  })
}

function requireNonblank(value: string, label: string, recordNumber: number) {
  if (!value.trim()) throw new Error(`${label} CSV record ${recordNumber} must not be blank.`)
}

function requirePositiveDecimal(value: string, label: string, recordNumber: number) {
  if (!POSITIVE_DECIMAL.test(value)) {
    throw new Error(`${label} CSV record ${recordNumber} must be a positive decimal identifier.`)
  }
}

export function parseV2SourceCsv(input: string): ParsedV2Source {
  const records = exactCsvRecords(input, 'V2 source', V2_SOURCE_COLUMNS)
  const rows = records.map((record, index): V2SourceRow => {
    const csv_record_number = index + 2
    requirePositiveDecimal(record.master_row_id, 'V2 source master_row_id', csv_record_number)
    requirePositiveDecimal(record.pmid, 'V2 source PMID', csv_record_number)
    requireNonblank(record.title, 'V2 source title', csv_record_number)
    requireNonblank(
      record.physician_final_label,
      'V2 source physician_final_label',
      csv_record_number,
    )
    requireNonblank(
      record.physician_final_confidence,
      'V2 source physician_final_confidence',
      csv_record_number,
    )
    return { ...record, csv_record_number }
  })

  const byPmid = new Map<string, V2SourceRow>()
  const byMasterRowId = new Map<string, V2SourceRow>()
  for (const row of rows) {
    const duplicatePmid = byPmid.get(row.pmid)
    if (duplicatePmid) {
      throw new Error(
        `V2 source PMID ${row.pmid} at CSV record ${row.csv_record_number} duplicates record ${duplicatePmid.csv_record_number}.`,
      )
    }
    const duplicateMasterRow = byMasterRowId.get(row.master_row_id)
    if (duplicateMasterRow) {
      throw new Error(
        `V2 source master_row_id ${row.master_row_id} at CSV record ${row.csv_record_number} duplicates record ${duplicateMasterRow.csv_record_number}.`,
      )
    }
    byPmid.set(row.pmid, row)
    byMasterRowId.set(row.master_row_id, row)
  }

  return { rows, byPmid, byMasterRowId }
}

export function parseExternalQaFindingsCsv(input: string): ExternalQaFinding[] {
  const records = exactCsvRecords(input, 'External QA findings', EXTERNAL_QA_COLUMNS)
  return records.map((record, index): ExternalQaFinding => {
    const csv_record_number = index + 2
    for (const column of [
      'source_review',
      'severity',
      'category',
      'field',
      'issue',
      'suggested_action',
      'status_against_v2',
      'review_tier',
    ] as const) {
      requireNonblank(record[column], `External QA ${column}`, csv_record_number)
    }

    if (!EXTERNAL_QA_SEVERITIES.includes(record.severity as ExternalQaSeverity)) {
      throw new Error(
        `External QA severity at CSV record ${csv_record_number} must be one of: ${EXTERNAL_QA_SEVERITIES.join(', ')}.`,
      )
    }
    if (!EXTERNAL_QA_TIERS.includes(record.review_tier as ExternalQaTier)) {
      throw new Error(
        `External QA review_tier at CSV record ${csv_record_number} must be one of: ${EXTERNAL_QA_TIERS.join(', ')}.`,
      )
    }

    const reviewTier = record.review_tier as ExternalQaTier
    if (reviewTier === 'global_data_quality') {
      for (const column of ['master_row_id', 'pmid', 'title'] as const) {
        if (record[column].trim()) {
          throw new Error(
            `Global data-quality finding at CSV record ${csv_record_number} must have blank ${column}.`,
          )
        }
      }
    } else {
      requirePositiveDecimal(record.master_row_id, 'External QA master_row_id', csv_record_number)
      requirePositiveDecimal(record.pmid, 'External QA PMID', csv_record_number)
      requireNonblank(record.title, 'External QA title', csv_record_number)
    }

    return {
      ...record,
      csv_record_number,
      review_tier: reviewTier,
      severity: record.severity as ExternalQaSeverity,
    }
  })
}

function countValues(values: Iterable<string>) {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => left.localeCompare(right, 'en-US')),
  )
}

function tierSummary(findings: readonly ExternalQaFinding[]): ExternalQaTierSummary {
  return {
    findings: findings.length,
    uniquePmids: new Set(findings.map((finding) => finding.pmid).filter(Boolean)).size,
    severity: countValues(findings.map((finding) => finding.severity)),
    category: countValues(findings.map((finding) => finding.category)),
    status: countValues(findings.map((finding) => finding.status_against_v2)),
  }
}

function physicianFieldSha256(rows: readonly V2SourceRow[]) {
  const orderedRows = [...rows].sort((left, right) =>
    left.master_row_id.localeCompare(right.master_row_id, 'en-US', { numeric: true }),
  )
  const projection = {
    columns: ['master_row_id', 'pmid', ...PHYSICIAN_FIELDS],
    rows: orderedRows.map((row) => [
      row.master_row_id,
      row.pmid,
      ...PHYSICIAN_FIELDS.map((field) => row[field]),
    ]),
  }
  return sha256(`${JSON.stringify(projection)}\n`)
}

function validateTargetedFindings(
  findings: readonly ExternalQaFinding[],
  source: ParsedV2Source,
): {
  mismatches: ExternalQaSourceMismatch[]
  titleMatches: ExternalQaAuditReport['validation']['titleMatches']
} {
  const mismatches: ExternalQaSourceMismatch[] = []
  const titleMatches = {
    exact: 0,
    acceptedTruncatedPrefix: 0,
    mismatch: 0,
    notValidated: 0,
  }
  const add = (
    finding: ExternalQaFinding,
    code: ExternalQaMismatchCode,
    expected: string | null,
    actual: string,
    message: string,
  ) => {
    if (finding.review_tier === 'global_data_quality') return
    mismatches.push({
      code,
      csvRecordNumber: finding.csv_record_number,
      reviewTier: finding.review_tier,
      pmid: finding.pmid,
      masterRowId: finding.master_row_id,
      field: finding.field,
      expected,
      actual,
      message,
    })
  }

  for (const finding of findings) {
    if (finding.review_tier === 'global_data_quality') continue
    const byPmid = source.byPmid.get(finding.pmid)
    const byMasterRowId = source.byMasterRowId.get(finding.master_row_id)

    if (!byPmid) {
      add(
        finding,
        'pmid_not_found',
        null,
        finding.pmid,
        `PMID ${finding.pmid} is absent from the V2 source.`,
      )
    }
    if (!byMasterRowId) {
      add(
        finding,
        'master_row_id_not_found',
        null,
        finding.master_row_id,
        `master_row_id ${finding.master_row_id} is absent from the V2 source.`,
      )
    }
    if (byPmid && byMasterRowId && byPmid !== byMasterRowId) {
      add(
        finding,
        'identifier_pair_mismatch',
        byPmid.master_row_id,
        finding.master_row_id,
        `PMID ${finding.pmid} belongs to master_row_id ${byPmid.master_row_id}, not ${finding.master_row_id}.`,
      )
    }

    const sourceRow = byPmid ?? byMasterRowId
    if (!sourceRow) {
      titleMatches.notValidated += 1
    } else if (sourceRow.title === finding.title) {
      titleMatches.exact += 1
    } else if (
      finding.title.length === EXTERNAL_QA_TITLE_PREFIX_LENGTH &&
      sourceRow.title.startsWith(finding.title)
    ) {
      // The exported QA workbook deliberately caps its display title at 180 characters. A
      // precisely 180-character prefix is therefore valid, but is counted separately from an
      // exact title so the provenance compromise remains visible in the audit report.
      titleMatches.acceptedTruncatedPrefix += 1
    } else {
      titleMatches.mismatch += 1
      add(
        finding,
        'title_mismatch',
        sourceRow.title,
        finding.title,
        `Title for PMID ${finding.pmid} does not exactly match the V2 source.`,
      )
    }
  }
  return { mismatches, titleMatches }
}

export function buildExternalQaAuditReport(
  options: BuildExternalQaAuditOptions,
): ExternalQaAuditReport {
  const sourceSha256 = sha256(options.sourceCsv)
  const findingsSha256 = sha256(options.findingsCsv)
  validateExpectedExternalQaProvenance(options.expectedProvenance)
  if (findingsSha256 !== options.expectedProvenance.findingsSha256) {
    throw new Error(
      `External QA findings provenance verification failed: expected SHA-256 ${options.expectedProvenance.findingsSha256}, received ${findingsSha256}.`,
    )
  }
  if (sourceSha256 !== options.expectedProvenance.sourceSha256) {
    throw new Error(
      `External QA source provenance verification failed: expected SHA-256 ${options.expectedProvenance.sourceSha256}, received ${sourceSha256}.`,
    )
  }
  const source = parseV2SourceCsv(options.sourceCsv)
  const findings = parseExternalQaFindingsCsv(options.findingsCsv)
  const provenanceVerification = verifyExternalQaProvenance(options.expectedProvenance, {
    findingsSha256,
    sourceRows: source.rows.length,
    sourceSha256,
  })
  const physicianSha256Before = physicianFieldSha256(source.rows)

  const findingsByTier = Object.fromEntries(
    EXTERNAL_QA_TIERS.map((tier) => [
      tier,
      findings.filter((finding) => finding.review_tier === tier),
    ]),
  ) as Record<ExternalQaTier, ExternalQaFinding[]>
  const targetedValidation = validateTargetedFindings(findings, source)
  const { mismatches } = targetedValidation

  // Recompute from the same parsed rows after all validation and aggregation. Any accidental
  // mutation of physician fields inside this pipeline therefore fails the integrity proof.
  const physicianSha256After = physicianFieldSha256(source.rows)
  if (physicianSha256Before !== physicianSha256After) {
    throw new Error('External QA audit mutated physician fields in memory; refusing to report.')
  }

  return {
    reportVersion: '1.0.0',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    operation: 'read_only_external_qa_validation',
    sources: {
      findings: {
        path: options.findingsPath ?? null,
        rows: findings.length,
        sha256: findingsSha256,
        sha256AfterReadOnlyAudit: findingsSha256,
      },
      v2Source: {
        path: options.sourcePath ?? null,
        rows: source.rows.length,
        uniquePmids: source.byPmid.size,
        uniqueMasterRowIds: source.byMasterRowId.size,
        sha256: sourceSha256,
        sha256AfterReadOnlyAudit: sourceSha256,
      },
    },
    summaries: {
      totalFindings: findings.length,
      uniqueTargetedPmids: new Set(
        findings
          .filter((finding) => finding.review_tier !== 'global_data_quality')
          .map((finding) => finding.pmid),
      ).size,
      severity: countValues(findings.map((finding) => finding.severity)),
      category: countValues(findings.map((finding) => finding.category)),
      status: countValues(findings.map((finding) => finding.status_against_v2)),
      tier: Object.fromEntries(
        EXTERNAL_QA_TIERS.map((tier) => [tier, findingsByTier[tier].length]),
      ) as Record<ExternalQaTier, number>,
      byTier: Object.fromEntries(
        EXTERNAL_QA_TIERS.map((tier) => [tier, tierSummary(findingsByTier[tier])]),
      ) as Record<ExternalQaTier, ExternalQaTierSummary>,
    },
    findingsByTier,
    validation: {
      ok: mismatches.length === 0,
      mismatchCount: mismatches.length,
      mismatches,
      titleMatches: targetedValidation.titleMatches,
    },
    physicianFieldIntegrity: {
      fields: PHYSICIAN_FIELDS,
      sha256Before: physicianSha256Before,
      sha256After: physicianSha256After,
      unchanged: true,
    },
    provenanceVerification,
    safety: {
      developmentOnlyInputs: true,
      heldOutTestSplitAccessed: false,
      databaseAccessed: false,
      networkAccessed: false,
      sourceFilesModified: false,
      inputHashesUnchanged: true,
      mutationPlan: null,
    },
  }
}

export function assertDevelopmentOnlyInputPath(inputPath: string, optionName: string) {
  const absolutePath = resolve(inputPath)
  if (FORBIDDEN_SPLIT_PATH_TOKEN.test(absolutePath)) {
    throw new Error(
      `Refusing to access ${optionName}: path has held-out, test, or all-split semantics. ` +
        'Only an explicitly development-only CSV is allowed.',
    )
  }
  if (extname(absolutePath).toLocaleLowerCase('en-US') !== '.csv') {
    throw new Error(`${optionName} must reference a .csv file.`)
  }
  return absolutePath
}

async function lstatIfPresent(path: string) {
  try {
    return await lstat(path)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

function isWithinDirectory(root: string, candidate: string) {
  const fromRoot = relative(root, candidate)
  return (
    fromRoot === '' ||
    (!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`))
  )
}

function isWithinDirectoryCaseInsensitive(root: string, candidate: string) {
  return isWithinDirectory(
    resolve(root).normalize('NFC').toLocaleLowerCase('en-US'),
    resolve(candidate).normalize('NFC').toLocaleLowerCase('en-US'),
  )
}

async function requireRegularInputFile(path: string, optionName: string) {
  const metadata = await lstatIfPresent(path)
  if (!metadata?.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`${optionName} must be an existing, non-symlink regular file.`)
  }
}

async function resolveAuditOutputPath(options: {
  workspaceRoot: string
  outputPath?: string
  sourceSha256: string
  findingsSha256: string
  inputPaths: readonly string[]
}) {
  const localDataRoot = resolve(options.workspaceRoot, 'local-data')
  const outputPath = resolve(
    options.outputPath ??
      resolve(
        localDataRoot,
        'literature',
        'data-quality',
        `external-qa-audit-${options.sourceSha256.slice(0, 12)}-${options.findingsSha256.slice(0, 12)}.json`,
      ),
  )
  if (!isWithinDirectory(localDataRoot, outputPath)) {
    throw new Error('External QA report output must remain under the repository local-data tree.')
  }
  const readOnlyInputsRoot = resolve(localDataRoot, 'inputs')
  if (isWithinDirectoryCaseInsensitive(readOnlyInputsRoot, outputPath)) {
    throw new Error(
      'External QA report output must not be written under read-only local-data/inputs.',
    )
  }
  if (extname(outputPath).toLocaleLowerCase('en-US') !== '.json') {
    throw new Error('--output must use the .json extension.')
  }
  if (options.inputPaths.includes(outputPath)) {
    throw new Error('External QA report output must not collide with an input file.')
  }

  const localDataMetadata = await lstatIfPresent(localDataRoot)
  if (!localDataMetadata?.isDirectory() || localDataMetadata.isSymbolicLink()) {
    throw new Error('Repository local-data must exist as a non-symlink directory.')
  }
  let current = localDataRoot
  const relativeParent = relative(localDataRoot, dirname(outputPath))
  for (const segment of relativeParent.split(sep).filter(Boolean)) {
    current = resolve(current, segment)
    const metadata = await lstatIfPresent(current)
    if (!metadata) break
    if (metadata.isSymbolicLink()) {
      throw new Error(`External QA report output must not traverse a symbolic link: ${current}`)
    }
    if (!metadata.isDirectory()) {
      throw new Error(`External QA report output contains a non-directory component: ${current}`)
    }
  }
  return outputPath
}

export async function runExternalQaAudit(
  options: RunExternalQaAuditOptions,
): Promise<RunExternalQaAuditResult> {
  const findingsPath = assertDevelopmentOnlyInputPath(options.findingsPath, '--findings')
  const sourcePath = assertDevelopmentOnlyInputPath(options.sourcePath, '--source')
  if (findingsPath === sourcePath) {
    throw new Error('--findings and --source must reference different CSV files.')
  }
  await Promise.all([
    requireRegularInputFile(findingsPath, '--findings'),
    requireRegularInputFile(sourcePath, '--source'),
  ])

  const [findingsCsv, sourceCsv] = await Promise.all([
    readFile(findingsPath, 'utf8'),
    readFile(sourcePath, 'utf8'),
  ])
  const report = buildExternalQaAuditReport({
    expectedProvenance: options.expectedProvenance ?? CANONICAL_EXTERNAL_QA_PROVENANCE,
    findingsCsv,
    sourceCsv,
    findingsPath,
    sourcePath,
    generatedAt: options.generatedAt,
  })

  // Re-read both inputs before writing the report. A concurrent or accidental input change fails
  // closed, and the report is never created from mixed source states.
  const [findingsAfter, sourceAfter] = await Promise.all([
    readFile(findingsPath, 'utf8'),
    readFile(sourcePath, 'utf8'),
  ])
  const findingsAfterSha256 = sha256(findingsAfter)
  const sourceAfterSha256 = sha256(sourceAfter)
  if (
    findingsAfterSha256 !== report.sources.findings.sha256 ||
    sourceAfterSha256 !== report.sources.v2Source.sha256
  ) {
    throw new Error(
      'An input CSV changed during the read-only external QA audit; no report written.',
    )
  }
  report.sources.findings.sha256AfterReadOnlyAudit = findingsAfterSha256
  report.sources.v2Source.sha256AfterReadOnlyAudit = sourceAfterSha256
  report.safety.inputHashesUnchanged = true

  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd())
  const outputPath = await resolveAuditOutputPath({
    workspaceRoot,
    outputPath: options.outputPath,
    sourceSha256: report.sources.v2Source.sha256,
    findingsSha256: report.sources.findings.sha256,
    inputPaths: [findingsPath, sourcePath],
  })
  await mkdir(dirname(outputPath), { recursive: true })
  try {
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    })
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`Refusing to overwrite an existing external QA report: ${outputPath}`)
    }
    throw error
  }
  return { outputPath, report }
}
