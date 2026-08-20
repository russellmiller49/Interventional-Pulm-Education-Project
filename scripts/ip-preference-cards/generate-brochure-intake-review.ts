import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import {
  BROCHURE_DISPOSITIONS,
  decodeComparisonEntities,
  normalizeComparisonText,
  parseBrochureCsv,
  parseCsvRecords,
  sha256File,
  summarizeBrochureInput,
  validateReconciliationRows,
  type BrochureDisposition,
  type BrochureInputRow,
  type BrochureInputSummary,
  type BrochureReconciliationRow,
} from './brochure-intake'
import { stableId } from './catalog-utils'

const execFileAsync = promisify(execFile)

export const BROCHURE_REVIEW_DATE = '2026-08-19'

export const EXPECTED_BROCHURE_CSV_HEADER = [
  'Product ID',
  'Product Name',
  'Manufacturer',
  'Source File',
] as const

export interface FrozenBrochureIntakeExpectations {
  reviewDate: string
  csvSha256: string
  header: readonly string[]
  dataRows: number
  rowsWithExactIdentifier: number
  rowsWithNotStatedIdentifier: number
  uniqueManufacturers: number
  uniqueSourceFilenames: number
  brochureFiles: number
  brochureFileExtensions: Readonly<Record<string, number>>
  dispositionCounts: Readonly<Record<BrochureDisposition, number>>
  canonicalProductsAdded: number
  exactRepeatedIdentifierGroups: number
  exactRepeatedIdentifierRows: number
  exactRepeatedIdentifierExcessRows: number
  normalizedRepeatedIdentifierGroups: number
  normalizedRepeatedIdentifierRows: number
  normalizedRepeatedIdentifierExcessRows: number
  byteIdenticalSourceGroups: number
  byteIdenticalSourceFiles: number
  byteIdenticalSourceRedundantCopies: number
  totalPdfPages: number
  canonicalSourceSupportOccurrences: number
  canonicalSourceSupportUniqueProducts: number
}

/**
 * The intake brief called the CSV headerless. The frozen payload actually has this exact header
 * followed by 2,060 data rows. Keeping the observed facts here prevents a future generator from
 * silently dropping the first product or counting the header as a product.
 */
export const FROZEN_BROCHURE_INTAKE: FrozenBrochureIntakeExpectations = {
  reviewDate: BROCHURE_REVIEW_DATE,
  csvSha256: '9ddcd7c85f32b116e4f19536937deeaf115b4406ff1c1c90f539416c445fda61',
  header: EXPECTED_BROCHURE_CSV_HEADER,
  dataRows: 2060,
  rowsWithExactIdentifier: 1997,
  rowsWithNotStatedIdentifier: 63,
  uniqueManufacturers: 55,
  uniqueSourceFilenames: 121,
  brochureFiles: 125,
  brochureFileExtensions: { '.html': 7, '.md': 3, '.pdf': 115 },
  dispositionCounts: {
    existing_exact: 803,
    existing_alias_or_format_variant: 64,
    existing_family_or_package_variant: 35,
    new_product_added: 397,
    relevant_but_insufficient_identity: 9,
    relevant_family_level_only: 13,
    duplicate_source_row: 57,
    irrelevant_to_current_scope: 615,
    source_document_missing: 0,
    source_evidence_conflicted: 51,
    needs_owner_review: 16,
  },
  canonicalProductsAdded: 397,
  exactRepeatedIdentifierGroups: 21,
  exactRepeatedIdentifierRows: 43,
  exactRepeatedIdentifierExcessRows: 22,
  normalizedRepeatedIdentifierGroups: 30,
  normalizedRepeatedIdentifierRows: 61,
  normalizedRepeatedIdentifierExcessRows: 31,
  byteIdenticalSourceGroups: 4,
  byteIdenticalSourceFiles: 8,
  byteIdenticalSourceRedundantCopies: 4,
  totalPdfPages: 2609,
  canonicalSourceSupportOccurrences: 398,
  canonicalSourceSupportUniqueProducts: 397,
}

export const BROCHURE_REVIEW_ARTIFACTS = [
  'input-summary.json',
  'source-manifest.json',
  'row-reconciliation.csv',
  'new-product-additions.csv',
  'existing-product-matches.csv',
  'unresolved-relevant-products.csv',
  'irrelevant-products.csv',
  'duplicate-analysis.csv',
  'manufacturer-summary.csv',
  'README.md',
] as const

const RECONCILIATION_HEADER = [
  'input_row_number',
  'extracted_identifier',
  'extracted_product_name',
  'extracted_manufacturer',
  'source_filename',
  'matched_source_page',
  'disposition',
  'canonical_product_id',
  'canonical_catalog_number',
  'match_basis',
  'evidence_strength',
  'reason_code',
  'owner_review_note',
] as const

const EXISTING_DISPOSITIONS = new Set<BrochureDisposition>([
  'existing_exact',
  'existing_alias_or_format_variant',
  'existing_family_or_package_variant',
])

const UNRESOLVED_DISPOSITIONS = new Set<BrochureDisposition>([
  'relevant_but_insufficient_identity',
  'relevant_family_level_only',
  'source_document_missing',
  'source_evidence_conflicted',
  'needs_owner_review',
])

interface ReviewedSource {
  sourceId: string
  title: string
  filename: string
  sourceType: string
  publisher: string
  revisionDate: string | null
  officialUrl?: string | null
  usePolicy: string
  notes: string | null
}

interface ReviewedEvidence {
  sourceId: string
  sourceLocation: string
  claimType?: string
  notes?: string | null
}

interface ReviewedProduct {
  inputRows: number[]
  productId: string
  manufacturerId: string
  manufacturer: string
  catalogNumber: string
  productName: string
  brandFamily: string | null
  primaryCategory: string
  subcategory: string
  productKind: string | null
  description: string
  roleCode: string | null
  roleFit?: string
  roleNotes?: string | null
  strongestDuplicateCandidates?: string
  duplicateRejection?: string
  evidence: ReviewedEvidence[]
}

interface ReviewedBrochureIntake {
  format_version: string
  reviewed_on: string
  source_csv_sha256: string
  notes: string
  manufacturers: unknown[]
  sources: ReviewedSource[]
  products: ReviewedProduct[]
}

interface ExistingSource {
  source_id: string
  title: string
  filename: string | null
  source_type: string
  publisher: string
  revision_date?: string | null
  official_url?: string | null
}

interface NormalizedSource {
  sourceId: string
  title: string
  filename: string
  sourceType: string
  publisher: string
  officialUrl: string | null
}

interface SourceManifestAddition {
  product_id: string
  catalog_number: string
}

export interface SourceManifestEntry {
  source_filename: string
  relative_path: string
  sha256: string
  page_count: number | null
  document_type: string
  manufacturer: string
  publisher: string | null
  official_url: string | null
  governed_source_ids: string[]
  matched_csv_row_count: number
  matched_input_row_numbers: number[]
  canonical_additions_supported: SourceManifestAddition[]
}

export interface BrochureSourceManifest {
  format_version: '1.0'
  reviewed_on: string
  source_directory: 'brochures'
  source_count: number
  pdf_count: number
  html_count: number
  markdown_count: number
  total_pdf_pages: number
  canonical_addition_support_occurrences: number
  canonical_addition_support_unique_products: number
  sources: SourceManifestEntry[]
}

interface RepeatedIdentifierGroup {
  identifier: string
  input_row_numbers: number[]
}

interface DuplicateGroupSummary {
  groups: number
  rows: number
  excess_rows: number
}

interface ByteIdenticalSourceGroup {
  sha256: string
  source_filenames: string[]
  redundant_copies: number
}

export interface GeneratedInputSummary extends Omit<BrochureInputSummary, 'repeated_identifiers'> {
  format_version: '1.0'
  reviewed_on: string
  source_csv_filename: 'preference_card_products.csv'
  source_csv_sha256: string
  detected_header: true
  observed_header: string[]
  brief_claimed_headerless: true
  brochure_file_count: number
  brochure_file_extensions: Record<string, number>
  disposition_counts: Record<BrochureDisposition, number>
  canonical_products_added: number
  repeated_identifiers: RepeatedIdentifierGroup[]
  normalized_repeated_identifiers: RepeatedIdentifierGroup[]
  repeated_identifier_summary: DuplicateGroupSummary
  normalized_repeated_identifier_summary: DuplicateGroupSummary
  byte_identical_source_groups: ByteIdenticalSourceGroup[]
  byte_identical_source_summary: {
    groups: number
    files: number
    redundant_copies: number
  }
}

export interface BrochureReviewGenerationResult {
  inputSummary: GeneratedInputSummary
  sourceManifest: BrochureSourceManifest
  reconciliationRows: BrochureReconciliationRow[]
  artifactPaths: string[]
}

export interface GenerateBrochureReviewOptions {
  intakeRoot?: string
  repositoryRoot?: string
  outputDirectory?: string
  reviewedAdditionsPath?: string
  reconciliationPath?: string
  generatedSourcesPath?: string
  expectations?: FrozenBrochureIntakeExpectations
  pdfPageCounter?: (pdfPath: string) => Promise<number>
  jsonFormatter?: (value: unknown) => Promise<string>
  checkOnly?: boolean
}

interface ReviewBatch {
  batchId: string
  manufacturer: string
  productCount: number
  inputRowNumbers: number[]
  productIds: string[]
}

type CsvValue = string | number | boolean | null | undefined
type CsvRow = Record<string, CsvValue>

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function assertPlainObject(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
}

function parseReviewedIntake(contents: string): ReviewedBrochureIntake {
  const value: unknown = JSON.parse(contents)
  assertPlainObject(value, 'Reviewed brochure intake')
  if (
    typeof value.format_version !== 'string' ||
    typeof value.reviewed_on !== 'string' ||
    typeof value.source_csv_sha256 !== 'string' ||
    typeof value.notes !== 'string' ||
    !Array.isArray(value.manufacturers) ||
    !Array.isArray(value.sources) ||
    !Array.isArray(value.products)
  ) {
    throw new Error('Reviewed brochure intake has an invalid top-level shape.')
  }
  return value as unknown as ReviewedBrochureIntake
}

export function parseReconciliationCsv(contents: string): BrochureReconciliationRow[] {
  const records = parseCsvRecords(contents)
  const header = records.shift()
  if (!header || !RECONCILIATION_HEADER.every((field, index) => header[index] === field)) {
    throw new Error(`Reconciliation header must be exactly: ${RECONCILIATION_HEADER.join(',')}.`)
  }
  if (header.length !== RECONCILIATION_HEADER.length) {
    throw new Error(`Reconciliation has ${header.length} columns; expected 13.`)
  }

  return records.map((record, index) => {
    if (record.length !== RECONCILIATION_HEADER.length) {
      throw new Error(
        `Reconciliation data row ${index + 1} has ${record.length} columns; expected 13.`,
      )
    }
    const rawRow = Object.fromEntries(
      RECONCILIATION_HEADER.map((field, fieldIndex) => [field, record[fieldIndex]]),
    ) as Record<(typeof RECONCILIATION_HEADER)[number], string>
    const inputRowNumber = Number(rawRow.input_row_number)
    if (!Number.isSafeInteger(inputRowNumber) || inputRowNumber < 1) {
      throw new Error(
        `Reconciliation data row ${index + 1} has invalid input_row_number ${rawRow.input_row_number}.`,
      )
    }
    return {
      ...rawRow,
      input_row_number: inputRowNumber,
      disposition: rawRow.disposition as BrochureDisposition,
    }
  })
}

function csvCell(value: CsvValue): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function serializeCsv(headers: readonly string[], rows: CsvRow[]): string {
  return `${[
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n')}\n`
}

function extensionCounts(filenames: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const filename of filenames) {
    const extension = path.extname(filename).toLowerCase()
    counts[extension] = (counts[extension] ?? 0) + 1
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => compareText(left, right)),
  )
}

function assertRecordEquals(
  actual: Readonly<Record<string, number>>,
  expected: Readonly<Record<string, number>>,
  label: string,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} changed: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
    )
  }
}

function exactRepeatedIdentifiers(inputRows: BrochureInputRow[]): RepeatedIdentifierGroup[] {
  const rowsByIdentifier = new Map<string, number[]>()
  for (const row of inputRows) {
    if (row.extractedIdentifier === 'Not stated in source') continue
    rowsByIdentifier.set(row.extractedIdentifier, [
      ...(rowsByIdentifier.get(row.extractedIdentifier) ?? []),
      row.inputRowNumber,
    ])
  }
  return [...rowsByIdentifier.entries()]
    .filter(([, inputRowNumbers]) => inputRowNumbers.length > 1)
    .map(([identifier, inputRowNumbers]) => ({
      identifier,
      input_row_numbers: inputRowNumbers,
    }))
    .sort((left, right) => compareText(left.identifier, right.identifier))
}

function duplicateGroupSummary(groups: RepeatedIdentifierGroup[]): DuplicateGroupSummary {
  const rows = groups.reduce((total, group) => total + group.input_row_numbers.length, 0)
  return {
    groups: groups.length,
    rows,
    excess_rows: rows - groups.length,
  }
}

function byteIdenticalSourceGroups(manifest: BrochureSourceManifest): ByteIdenticalSourceGroup[] {
  const filenamesByHash = new Map<string, string[]>()
  for (const source of manifest.sources) {
    filenamesByHash.set(source.sha256, [
      ...(filenamesByHash.get(source.sha256) ?? []),
      source.source_filename,
    ])
  }
  return [...filenamesByHash.entries()]
    .filter(([, filenames]) => filenames.length > 1)
    .map(([sha256, filenames]) => ({
      sha256,
      source_filenames: filenames.sort(compareText),
      redundant_copies: filenames.length - 1,
    }))
    .sort((left, right) => compareText(left.sha256, right.sha256))
}

function assertDuplicateAccounting(options: {
  exactGroups: RepeatedIdentifierGroup[]
  normalizedGroups: RepeatedIdentifierGroup[]
  sourceGroups: ByteIdenticalSourceGroup[]
  expectations: FrozenBrochureIntakeExpectations
}): void {
  const exact = duplicateGroupSummary(options.exactGroups)
  const normalized = duplicateGroupSummary(options.normalizedGroups)
  const sourceFiles = options.sourceGroups.reduce(
    (total, group) => total + group.source_filenames.length,
    0,
  )
  const redundantCopies = options.sourceGroups.reduce(
    (total, group) => total + group.redundant_copies,
    0,
  )
  const checks: [string, number, number][] = [
    [
      'exact repeated-identifier groups',
      exact.groups,
      options.expectations.exactRepeatedIdentifierGroups,
    ],
    [
      'exact repeated-identifier rows',
      exact.rows,
      options.expectations.exactRepeatedIdentifierRows,
    ],
    [
      'exact repeated-identifier excess rows',
      exact.excess_rows,
      options.expectations.exactRepeatedIdentifierExcessRows,
    ],
    [
      'normalized repeated-identifier groups',
      normalized.groups,
      options.expectations.normalizedRepeatedIdentifierGroups,
    ],
    [
      'normalized repeated-identifier rows',
      normalized.rows,
      options.expectations.normalizedRepeatedIdentifierRows,
    ],
    [
      'normalized repeated-identifier excess rows',
      normalized.excess_rows,
      options.expectations.normalizedRepeatedIdentifierExcessRows,
    ],
    [
      'byte-identical source groups',
      options.sourceGroups.length,
      options.expectations.byteIdenticalSourceGroups,
    ],
    ['byte-identical source files', sourceFiles, options.expectations.byteIdenticalSourceFiles],
    [
      'byte-identical redundant source copies',
      redundantCopies,
      options.expectations.byteIdenticalSourceRedundantCopies,
    ],
  ]
  for (const [label, actual, expected] of checks) {
    if (actual !== expected) {
      throw new Error(`${label} changed: expected ${expected}, received ${actual}.`)
    }
  }
}

function assertManifestAccounting(
  manifest: BrochureSourceManifest,
  expectations: FrozenBrochureIntakeExpectations,
): void {
  const checks: [string, number, number][] = [
    ['total PDF pages', manifest.total_pdf_pages, expectations.totalPdfPages],
    [
      'canonical source-support occurrences',
      manifest.canonical_addition_support_occurrences,
      expectations.canonicalSourceSupportOccurrences,
    ],
    [
      'canonical source-support unique products',
      manifest.canonical_addition_support_unique_products,
      expectations.canonicalSourceSupportUniqueProducts,
    ],
  ]
  for (const [label, actual, expected] of checks) {
    if (actual !== expected) {
      throw new Error(`${label} changed: expected ${expected}, received ${actual}.`)
    }
  }
}

export function assertFrozenIntakeFacts(options: {
  parsedHeader: readonly string[]
  detectedHeader: boolean
  csvSha256: string
  summary: BrochureInputSummary
  brochureFilenames: string[]
  expectations?: FrozenBrochureIntakeExpectations
}): void {
  const expected = options.expectations ?? FROZEN_BROCHURE_INTAKE
  if (!options.detectedHeader) {
    throw new Error('Frozen brochure CSV no longer has the observed header row.')
  }
  if (JSON.stringify(options.parsedHeader) !== JSON.stringify(expected.header)) {
    throw new Error(`Frozen brochure CSV header changed: ${JSON.stringify(options.parsedHeader)}.`)
  }
  const checks: [string, number | string, number | string][] = [
    ['CSV SHA-256', options.csvSha256, expected.csvSha256],
    ['data-row count', options.summary.total_rows, expected.dataRows],
    [
      'exact-identifier row count',
      options.summary.rows_with_exact_identifier,
      expected.rowsWithExactIdentifier,
    ],
    [
      'not-stated identifier row count',
      options.summary.rows_with_not_stated_identifier,
      expected.rowsWithNotStatedIdentifier,
    ],
    ['manufacturer count', options.summary.unique_manufacturers, expected.uniqueManufacturers],
    [
      'referenced source-filename count',
      options.summary.unique_source_filenames,
      expected.uniqueSourceFilenames,
    ],
    ['brochure-file count', options.brochureFilenames.length, expected.brochureFiles],
  ]
  for (const [label, actual, wanted] of checks) {
    if (actual !== wanted)
      throw new Error(`${label} changed: expected ${wanted}, received ${actual}.`)
  }
  if (options.summary.unresolved_source_filenames.length > 0) {
    throw new Error(
      `Local source files are unresolved: ${options.summary.unresolved_source_filenames.join('; ')}.`,
    )
  }
  assertRecordEquals(
    extensionCounts(options.brochureFilenames),
    expected.brochureFileExtensions,
    'Brochure extension counts',
  )
}

async function pdfInfoPageCount(pdfPath: string): Promise<number> {
  const { stdout } = await execFileAsync('pdfinfo', [pdfPath], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  })
  const match = stdout.match(/^Pages:\s+(\d+)\s*$/m)
  const pages = match ? Number(match[1]) : Number.NaN
  if (!Number.isSafeInteger(pages) || pages < 1) {
    throw new Error(`pdfinfo did not report a positive page count for ${path.basename(pdfPath)}.`)
  }
  return pages
}

function normalizeExistingSource(source: ExistingSource): NormalizedSource | null {
  if (!source.filename) return null
  return {
    sourceId: source.source_id,
    title: source.title,
    filename: source.filename,
    sourceType: source.source_type,
    publisher: source.publisher,
    officialUrl: source.official_url ?? null,
  }
}

function normalizeReviewedSource(source: ReviewedSource): NormalizedSource {
  return {
    sourceId: source.sourceId,
    title: source.title,
    filename: source.filename,
    sourceType: source.sourceType,
    publisher: source.publisher,
    officialUrl: source.officialUrl ?? null,
  }
}

function validateReviewedProducts(options: {
  reviewed: ReviewedBrochureIntake
  reconciliationRows: BrochureReconciliationRow[]
  sourceById: Map<string, NormalizedSource>
  inputRows: BrochureInputRow[]
}): void {
  const inputByNumber = new Map(options.inputRows.map((row) => [row.inputRowNumber, row]))
  const reconciliationByNumber = new Map(
    options.reconciliationRows.map((row) => [row.input_row_number, row]),
  )
  const productIds = new Set<string>()
  const identities = new Set<string>()
  const reviewedInputRows = new Set<number>()

  for (const product of options.reviewed.products) {
    if (
      !product.productId ||
      !product.manufacturer ||
      !product.catalogNumber ||
      !product.productName
    ) {
      throw new Error('Reviewed brochure product is missing its exact governed identity.')
    }
    const deterministicId = stableId('PRD', `${product.manufacturer}|${product.catalogNumber}`)
    if (product.productId !== deterministicId) {
      throw new Error(
        `${product.manufacturer} ${product.catalogNumber} pins ${product.productId}; expected ${deterministicId}.`,
      )
    }
    const identity = `${product.manufacturerId}\u0000${product.catalogNumber
      .normalize('NFKC')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')}`
    if (productIds.has(product.productId) || identities.has(identity)) {
      throw new Error(`Reviewed additions repeat ${product.manufacturer} ${product.catalogNumber}.`)
    }
    productIds.add(product.productId)
    identities.add(identity)
    if (product.inputRows.length === 0) {
      throw new Error(`Reviewed addition ${product.productId} has no input-row provenance.`)
    }
    if (product.evidence.length === 0) {
      throw new Error(`Reviewed addition ${product.productId} has no source evidence.`)
    }
    if (!product.strongestDuplicateCandidates?.trim() || !product.duplicateRejection?.trim()) {
      throw new Error(
        `Reviewed addition ${product.productId} must record strongest duplicate candidates and the rejection rationale.`,
      )
    }
    for (const evidence of product.evidence) {
      if (!options.sourceById.has(evidence.sourceId)) {
        throw new Error(
          `Reviewed addition ${product.productId} references unknown source ${evidence.sourceId}.`,
        )
      }
      if (!evidence.sourceLocation.trim()) {
        throw new Error(`Reviewed addition ${product.productId} has an empty source locator.`)
      }
    }
    for (const inputRowNumber of product.inputRows) {
      if (!inputByNumber.has(inputRowNumber)) {
        throw new Error(
          `Reviewed addition ${product.productId} references unknown input row ${inputRowNumber}.`,
        )
      }
      const reconciliation = reconciliationByNumber.get(inputRowNumber)
      if (
        !reconciliation ||
        reconciliation.disposition !== 'new_product_added' ||
        reconciliation.canonical_product_id !== product.productId ||
        reconciliation.canonical_catalog_number !== product.catalogNumber
      ) {
        throw new Error(
          `Reviewed addition ${product.productId} does not match reconciliation input row ${inputRowNumber}.`,
        )
      }
      if (!reconciliation.matched_source_page.trim()) {
        throw new Error(`Added input row ${inputRowNumber} has no page-level source locator.`)
      }
      reviewedInputRows.add(inputRowNumber)
    }
  }

  const addedRows = options.reconciliationRows.filter(
    (row) => row.disposition === 'new_product_added',
  )
  const unreviewedRows = addedRows.filter((row) => !reviewedInputRows.has(row.input_row_number))
  if (unreviewedRows.length > 0) {
    throw new Error(
      `Reconciliation marks ${unreviewedRows.length} unreviewed row(s) as added: ${unreviewedRows
        .map((row) => row.input_row_number)
        .join(', ')}.`,
    )
  }
  const reconciliationProductIds = new Set(addedRows.map((row) => row.canonical_product_id))
  if (
    reconciliationProductIds.size !== productIds.size ||
    [...productIds].some((productId) => !reconciliationProductIds.has(productId))
  ) {
    throw new Error('Reviewed products and added reconciliation product IDs do not match exactly.')
  }
}

function inferredDocumentType(filename: string): string {
  switch (path.extname(filename).toLowerCase()) {
    case '.pdf':
      return 'PDF source document'
    case '.html':
      return 'HTML product-page capture'
    case '.md':
      return 'Markdown research report'
    default:
      return 'Source document'
  }
}

async function buildSourceManifest(options: {
  intakeRoot: string
  brochureFilenames: string[]
  inputRows: BrochureInputRow[]
  reviewedProducts: ReviewedProduct[]
  sourceById: Map<string, NormalizedSource>
  pdfPageCounter: (pdfPath: string) => Promise<number>
  reviewDate: string
}): Promise<BrochureSourceManifest> {
  const actualNameByNormalized = new Map<string, string>()
  for (const filename of options.brochureFilenames) {
    const normalized = normalizeComparisonText(filename)
    const prior = actualNameByNormalized.get(normalized)
    if (prior && prior !== filename) {
      throw new Error(
        `Local source filenames normalize to the same identity: ${prior}; ${filename}.`,
      )
    }
    actualNameByNormalized.set(normalized, filename)
  }

  const inputRowsByFilename = new Map<string, Set<number>>()
  const manufacturersByFilename = new Map<string, Set<string>>()
  const sourcesByFilename = new Map<string, Map<string, NormalizedSource>>()
  const associateGovernedSource = (filename: string, source: NormalizedSource) => {
    const sources = sourcesByFilename.get(filename) ?? new Map<string, NormalizedSource>()
    sources.set(source.sourceId, source)
    sourcesByFilename.set(filename, sources)
  }
  for (const source of options.sourceById.values()) {
    const actual = actualNameByNormalized.get(normalizeComparisonText(source.filename))
    if (actual) associateGovernedSource(actual, source)
  }
  for (const row of options.inputRows) {
    for (const extractedFilename of row.sourceFilenames) {
      const actual = actualNameByNormalized.get(normalizeComparisonText(extractedFilename))
      if (!actual) {
        throw new Error(
          `Input row ${row.inputRowNumber} source is absent locally: ${extractedFilename}.`,
        )
      }
      const inputNumbers = inputRowsByFilename.get(actual) ?? new Set<number>()
      inputNumbers.add(row.inputRowNumber)
      inputRowsByFilename.set(actual, inputNumbers)
      const manufacturers = manufacturersByFilename.get(actual) ?? new Set<string>()
      manufacturers.add(row.extractedManufacturer)
      manufacturersByFilename.set(actual, manufacturers)
    }
  }

  const additionsByFilename = new Map<string, Map<string, SourceManifestAddition>>()
  const addSupportedProduct = (filename: string, product: ReviewedProduct) => {
    const additions = additionsByFilename.get(filename) ?? new Map<string, SourceManifestAddition>()
    additions.set(product.productId, {
      product_id: product.productId,
      catalog_number: product.catalogNumber,
    })
    additionsByFilename.set(filename, additions)
  }
  const inputByNumber = new Map(options.inputRows.map((row) => [row.inputRowNumber, row]))
  const filenameStem = (filename: string) =>
    decodeComparisonEntities(path.parse(filename).name)
      .normalize('NFKC')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
  for (const product of options.reviewedProducts) {
    const inputSourceCandidates = [
      ...new Set(
        product.inputRows.flatMap((inputRowNumber) => {
          const row = inputByNumber.get(inputRowNumber)
          return (row?.sourceFilenames ?? []).flatMap((extractedFilename) => {
            const actual = actualNameByNormalized.get(normalizeComparisonText(extractedFilename))
            return actual ? [actual] : []
          })
        }),
      ),
    ]
    for (const evidence of product.evidence) {
      const source = options.sourceById.get(evidence.sourceId)
      if (!source) {
        throw new Error(`Reviewed evidence source ${evidence.sourceId} is not governed.`)
      }
      let actual = actualNameByNormalized.get(normalizeComparisonText(source.filename))
      if (!actual) {
        const governedStem = filenameStem(source.filename)
        const matchingCandidates = inputSourceCandidates.filter((candidate) => {
          const candidateStem = filenameStem(candidate)
          return candidateStem.includes(governedStem) || governedStem.includes(candidateStem)
        })
        if (matchingCandidates.length === 1) {
          actual = matchingCandidates[0]
        } else if (matchingCandidates.length === 0 && inputSourceCandidates.length === 1) {
          actual = inputSourceCandidates[0]
        } else {
          throw new Error(
            `Evidence source ${evidence.sourceId} (${source.filename}) has no unique local filename match for ${product.productId}.`,
          )
        }
      }
      associateGovernedSource(actual, source)
      addSupportedProduct(actual, product)
    }
  }

  const entries: SourceManifestEntry[] = []
  for (const filename of options.brochureFilenames) {
    const filePath = path.join(options.intakeRoot, 'brochures', filename)
    const extension = path.extname(filename).toLowerCase()
    const governedSources = [...(sourcesByFilename.get(filename)?.values() ?? [])].sort(
      (left, right) => compareText(left.sourceId, right.sourceId),
    )
    const primarySource = governedSources[0]
    const inputRows = [...(inputRowsByFilename.get(filename) ?? [])].sort(
      (left, right) => left - right,
    )
    const manufacturers = [...(manufacturersByFilename.get(filename) ?? [])].sort(compareText)
    const pageCount = extension === '.pdf' ? await options.pdfPageCounter(filePath) : null
    if (extension === '.pdf' && (!pageCount || pageCount < 1)) {
      throw new Error(`PDF source ${filename} has no positive page count.`)
    }
    entries.push({
      source_filename: filename,
      relative_path: path.posix.join('brochures', filename),
      sha256: await sha256File(filePath),
      page_count: pageCount,
      document_type: primarySource?.sourceType ?? inferredDocumentType(filename),
      manufacturer:
        manufacturers.length > 0
          ? manufacturers.join('; ')
          : primarySource?.publisher || 'Not stated / unreferenced source',
      publisher:
        governedSources.length > 0
          ? [...new Set(governedSources.map((source) => source.publisher))].join('; ')
          : null,
      official_url: governedSources.find((source) => source.officialUrl)?.officialUrl ?? null,
      governed_source_ids: governedSources.map((source) => source.sourceId),
      matched_csv_row_count: inputRows.length,
      matched_input_row_numbers: inputRows,
      canonical_additions_supported: [...(additionsByFilename.get(filename)?.values() ?? [])].sort(
        (left, right) => compareText(left.product_id, right.product_id),
      ),
    })
  }

  const extensions = extensionCounts(options.brochureFilenames)
  const supportedProductIds = new Set(
    entries.flatMap((entry) =>
      entry.canonical_additions_supported.map((addition) => addition.product_id),
    ),
  )
  return {
    format_version: '1.0',
    reviewed_on: options.reviewDate,
    source_directory: 'brochures',
    source_count: entries.length,
    pdf_count: extensions['.pdf'] ?? 0,
    html_count: extensions['.html'] ?? 0,
    markdown_count: extensions['.md'] ?? 0,
    total_pdf_pages: entries.reduce((total, entry) => total + (entry.page_count ?? 0), 0),
    canonical_addition_support_occurrences: entries.reduce(
      (total, entry) => total + entry.canonical_additions_supported.length,
      0,
    ),
    canonical_addition_support_unique_products: supportedProductIds.size,
    sources: entries,
  }
}

function reconciliationCsvRows(rows: BrochureReconciliationRow[]): CsvRow[] {
  return rows.map((row) => ({ ...row }))
}

function batchSlug(manufacturer: string): string {
  return (
    manufacturer
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'unresolved'
  )
}

export function buildReviewBatchPlan(products: ReviewedProduct[]): ReviewBatch[] {
  const byManufacturer = new Map<string, ReviewedProduct[]>()
  for (const product of products) {
    byManufacturer.set(product.manufacturer, [
      ...(byManufacturer.get(product.manufacturer) ?? []),
      product,
    ])
  }
  return [...byManufacturer.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([manufacturer, members], index) => ({
      batchId: `B${String(index + 1).padStart(2, '0')}-${batchSlug(manufacturer)}`,
      manufacturer,
      productCount: members.length,
      inputRowNumbers: [...new Set(members.flatMap((product) => product.inputRows))].sort(
        (left, right) => left - right,
      ),
      productIds: members.map((product) => product.productId).sort(compareText),
    }))
}

function newProductCsvRows(products: ReviewedProduct[], batches: ReviewBatch[]): CsvRow[] {
  const batchByManufacturer = new Map(batches.map((batch) => [batch.manufacturer, batch]))
  return [...products]
    .sort((left, right) => {
      const batchDifference = compareText(
        batchByManufacturer.get(left.manufacturer)!.batchId,
        batchByManufacturer.get(right.manufacturer)!.batchId,
      )
      return (
        batchDifference ||
        Math.min(...left.inputRows) - Math.min(...right.inputRows) ||
        compareText(left.productId, right.productId)
      )
    })
    .map((product) => {
      const batch = batchByManufacturer.get(product.manufacturer)!
      return {
        review_batch_id: batch.batchId,
        review_batch_manufacturer: batch.manufacturer,
        review_batch_product_count: batch.productCount,
        input_row_numbers: product.inputRows.join(';'),
        product_id: product.productId,
        manufacturer_id: product.manufacturerId,
        manufacturer: product.manufacturer,
        catalog_number: product.catalogNumber,
        product_name: product.productName,
        brand_family: product.brandFamily,
        primary_category: product.primaryCategory,
        subcategory: product.subcategory,
        product_kind: product.productKind,
        role_code: product.roleCode,
        verification_grade: 'verified_source',
        visibility_state: 'hidden',
        evidence: product.evidence
          .map((evidence) => `${evidence.sourceId}: ${evidence.sourceLocation}`)
          .join('; '),
        strongest_duplicate_candidates: product.strongestDuplicateCandidates ?? '',
        duplicate_rejection: product.duplicateRejection ?? '',
      }
    })
}

function reconciliationSubsetRows(rows: BrochureReconciliationRow[]): CsvRow[] {
  return rows.map((row) => ({ ...row }))
}

function duplicateAnalysisRows(
  summary: BrochureInputSummary,
  exactRepeatedGroups: RepeatedIdentifierGroup[],
  normalizedRepeatedGroups: RepeatedIdentifierGroup[],
  sourceDuplicateGroups: ByteIdenticalSourceGroup[],
  manifest: BrochureSourceManifest,
  reconciliationRows: BrochureReconciliationRow[],
): CsvRow[] {
  const rows: CsvRow[] = []
  for (const duplicate of summary.exact_duplicate_rows) {
    rows.push({
      analysis_type: 'exact_input_row_duplicate',
      identifier: '',
      source_filenames: '',
      input_row_numbers: [
        duplicate.first_input_row_number,
        ...duplicate.duplicate_input_row_numbers,
      ].join(';'),
      canonical_product_id: '',
      canonical_catalog_number: '',
      note: 'Every extracted field and source value are identical.',
    })
  }
  for (const repeated of exactRepeatedGroups) {
    rows.push({
      analysis_type: 'repeated_exact_identifier',
      identifier: repeated.identifier,
      source_filenames: '',
      input_row_numbers: repeated.input_row_numbers.join(';'),
      canonical_product_id: '',
      canonical_catalog_number: '',
      note: 'Identifier repeats byte-for-byte in the frozen intake.',
    })
  }
  for (const repeated of normalizedRepeatedGroups) {
    rows.push({
      analysis_type: 'repeated_normalized_identifier',
      identifier: repeated.identifier,
      source_filenames: '',
      input_row_numbers: repeated.input_row_numbers.join(';'),
      canonical_product_id: '',
      canonical_catalog_number: '',
      note: 'Identifier repeats in the frozen intake; manufacturer-aware reconciliation remains authoritative.',
    })
  }
  const sourceByFilename = new Map(
    manifest.sources.map((source) => [source.source_filename, source]),
  )
  for (const group of sourceDuplicateGroups) {
    const inputRowNumbers = [
      ...new Set(
        group.source_filenames.flatMap(
          (filename) => sourceByFilename.get(filename)?.matched_input_row_numbers ?? [],
        ),
      ),
    ].sort((left, right) => left - right)
    rows.push({
      analysis_type: 'byte_identical_source_files',
      identifier: group.sha256,
      source_filenames: group.source_filenames.join(';'),
      input_row_numbers: inputRowNumbers.join(';'),
      canonical_product_id: '',
      canonical_catalog_number: '',
      note: `${group.source_filenames.length} files share this SHA-256; ${group.redundant_copies} redundant copy/copies.`,
    })
  }
  for (const reconciliation of reconciliationRows.filter(
    (row) => row.disposition === 'duplicate_source_row',
  )) {
    rows.push({
      analysis_type: 'duplicate_source_row',
      identifier: reconciliation.extracted_identifier,
      source_filenames: reconciliation.source_filename,
      input_row_numbers: reconciliation.input_row_number,
      canonical_product_id: reconciliation.canonical_product_id,
      canonical_catalog_number: reconciliation.canonical_catalog_number,
      note: reconciliation.owner_review_note,
    })
  }
  return rows
}

function manufacturerSummaryRows(
  inputRows: BrochureInputRow[],
  reconciliationRows: BrochureReconciliationRow[],
): CsvRow[] {
  const reconciliationByNumber = new Map(
    reconciliationRows.map((row) => [row.input_row_number, row]),
  )
  const manufacturers = new Map<string, BrochureInputRow[]>()
  for (const row of inputRows) {
    manufacturers.set(row.extractedManufacturer, [
      ...(manufacturers.get(row.extractedManufacturer) ?? []),
      row,
    ])
  }
  return [...manufacturers.entries()]
    .map(([manufacturer, rows]) => {
      const dispositions = Object.fromEntries(
        BROCHURE_DISPOSITIONS.map((disposition) => [
          disposition,
          rows.filter(
            (row) => reconciliationByNumber.get(row.inputRowNumber)?.disposition === disposition,
          ).length,
        ]),
      ) as Record<BrochureDisposition, number>
      return {
        manufacturer,
        total_rows: rows.length,
        rows_with_identifier: rows.filter(
          (row) => row.extractedIdentifier !== 'Not stated in source',
        ).length,
        unique_source_filenames: new Set(rows.flatMap((row) => row.sourceFilenames)).size,
        ...dispositions,
      }
    })
    .sort((left, right) => {
      const countDifference = Number(right.total_rows) - Number(left.total_rows)
      return countDifference || compareText(String(left.manufacturer), String(right.manufacturer))
    })
}

function dispositionCounts(rows: BrochureReconciliationRow[]): Record<BrochureDisposition, number> {
  return Object.fromEntries(
    BROCHURE_DISPOSITIONS.map((disposition) => [
      disposition,
      rows.filter((row) => row.disposition === disposition).length,
    ]),
  ) as Record<BrochureDisposition, number>
}

function readmeContents(
  summary: GeneratedInputSummary,
  manifest: BrochureSourceManifest,
  batches: ReviewBatch[],
): string {
  const dispositionLines = BROCHURE_DISPOSITIONS.map(
    (disposition) => `- \`${disposition}\`: ${summary.disposition_counts[disposition]}`,
  ).join('\n')
  const batchTableRows = batches.map((batch) => [
    `\`${batch.batchId}\``,
    batch.manufacturer.replace(/\|/g, '\\|'),
    String(batch.productCount),
  ])
  const batchHeaders = ['Batch', 'Manufacturer', 'Products']
  const batchColumnWidths = batchHeaders.map((header, index) =>
    Math.max(header.length, ...batchTableRows.map((row) => row[index].length)),
  )
  const batchTable = [
    `| ${batchHeaders[0].padEnd(batchColumnWidths[0])} | ${batchHeaders[1].padEnd(batchColumnWidths[1])} | ${batchHeaders[2].padEnd(batchColumnWidths[2])} |`,
    `| ${'-'.repeat(batchColumnWidths[0])} | ${'-'.repeat(batchColumnWidths[1])} | ${'-'.repeat(batchColumnWidths[2] - 1)}: |`,
    ...batchTableRows.map(
      (row) =>
        `| ${row[0].padEnd(batchColumnWidths[0])} | ${row[1].padEnd(batchColumnWidths[1])} | ${row[2].padStart(batchColumnWidths[2])} |`,
    ),
  ].join('\n')
  return `# Brochure product intake review — ${summary.reviewed_on}

This package is the review and accounting layer for the bounded preference-card brochure intake.
It is not a runtime product database. Canonical additions flow through the governed reviewed-addition
pipeline, and no slot-product option is promoted by this package.

## Frozen input facts

- The supplied CSV **does contain** the exact header \`${summary.observed_header.join(',')}\`, despite the original brief describing it as headerless.
- Data rows (header excluded): ${summary.total_rows}
- Rows with an extracted identifier: ${summary.rows_with_exact_identifier}
- Rows with \`Not stated in source\`: ${summary.rows_with_not_stated_identifier}
- Extracted manufacturer strings: ${summary.unique_manufacturers}
- Referenced source filenames: ${summary.unique_source_filenames}
- Local brochure/source files inventoried: ${manifest.source_count} (${manifest.pdf_count} PDF, ${manifest.html_count} HTML, ${manifest.markdown_count} Markdown)
- PDF pages inventoried: ${manifest.total_pdf_pages}
- Unresolved local source filenames: ${summary.unresolved_source_filenames.length}
- Canonical products added: ${summary.canonical_products_added}
- Exact repeated identifiers: ${summary.repeated_identifier_summary.groups} groups / ${summary.repeated_identifier_summary.rows} rows / ${summary.repeated_identifier_summary.excess_rows} excess rows
- Normalized repeated identifiers: ${summary.normalized_repeated_identifier_summary.groups} groups / ${summary.normalized_repeated_identifier_summary.rows} rows / ${summary.normalized_repeated_identifier_summary.excess_rows} excess rows
- Byte-identical source files: ${summary.byte_identical_source_summary.groups} groups / ${summary.byte_identical_source_summary.files} files / ${summary.byte_identical_source_summary.redundant_copies} redundant copies
- Addition-to-source support: ${manifest.canonical_addition_support_occurrences} evidence-source occurrences covering ${manifest.canonical_addition_support_unique_products} unique products
- Source CSV SHA-256: \`${summary.source_csv_sha256}\`

## Evidence method and limits

Local documents are the primary identity evidence. The completed audit successfully ran
\`pdfinfo\` and \`pdftotext\` on all 115 PDFs (${manifest.total_pdf_pages} pages). Three PDFs had
zero native text and required rendered-page inspection/OCR: \`Brochure-BodyVision_MOSS.pdf\`,
\`Y-Stent-Brochure-2022.pdf\`, and \`eb-530us-esp.pdf\`. Page locators distinguish the one-based
PDF page index from a document's printed page. All ${summary.canonical_products_added}/${summary.canonical_products_added}
canonical additions have page-level locators. Exact brochure identity does not imply current
orderability or U.S. commercial status.

The governed Chartis source \`SRC054\` retains its canonical filename, while the local evidence file
adds the dated suffix \`-Released-2025-12-18\`; the manifest maps \`SRC054\` to that unique local
filename alias explicitly.

## Dispositions

${dispositionLines}

## Deterministic review batches

The canonical additions are partitioned by exact canonical manufacturer, ordered lexicographically.
The \`review_batch_id\` column in \`new-product-additions.csv\` is the exact member list: every row
also carries its logical input row number(s), deterministic product ID, and the batch's total count.

${batchTable}

## Artifacts

- \`input-summary.json\`: frozen input facts, duplicate accounting, and disposition totals.
- \`source-manifest.json\`: all local brochure files with hashes, PDF page counts, row matches, and supported additions.
- \`row-reconciliation.csv\`: one controlled disposition for every data row.
- \`new-product-additions.csv\`: reviewed exact-identity canonical additions and evidence.
- \`existing-product-matches.csv\`: exact, alias/format, and family/package matches.
- \`unresolved-relevant-products.csv\`: insufficient, family-only, missing, conflicted, and owner-review rows.
- \`irrelevant-products.csv\`: rows outside the current IP/pleural/tracheostomy scope.
- \`duplicate-analysis.csv\`: exact and normalized repeated identifiers, exact rows, byte-identical files, and duplicate-source decisions.
- \`manufacturer-summary.csv\`: per-manufacturer row and disposition totals.

The manifest contains portable relative filenames only. Raw brochure contents and the private source
directory are not committed by this generator.
`
}

function assertNoAbsolutePaths(value: unknown, forbiddenRoots: string[], label: string): void {
  const visit = (item: unknown): void => {
    if (typeof item === 'string') {
      if (
        forbiddenRoots.some((root) => root && item.includes(root)) ||
        item.includes('file://') ||
        /(?:^|[\s"'])\/(?:Users|home|private|tmp)\//.test(item) ||
        /[A-Za-z]:\\/.test(item)
      ) {
        throw new Error(`${label} contains a local absolute path.`)
      }
      return
    }
    if (Array.isArray(item)) {
      item.forEach(visit)
      return
    }
    if (item && typeof item === 'object') Object.values(item).forEach(visit)
  }
  visit(value)
}

async function atomicWrite(filename: string, contents: string): Promise<void> {
  const temporary = `${filename}.${process.pid}.tmp`
  await writeFile(temporary, contents, 'utf8')
  await rename(temporary, filename)
}

async function defaultJsonFormatter(value: unknown): Promise<string> {
  const { formatJson } = await import('./format-json')
  return formatJson(value)
}

function resolveIntakeRoot(explicitRoot?: string): string {
  const value = explicitRoot ?? process.env.BROCHURE_INTAKE_ROOT
  if (!value) {
    throw new Error(
      'BROCHURE_INTAKE_ROOT is required and must contain preference_card_products.csv and brochures/.',
    )
  }
  return path.resolve(value)
}

export async function generateBrochureIntakeReview(
  options: GenerateBrochureReviewOptions = {},
): Promise<BrochureReviewGenerationResult> {
  const repositoryRoot = path.resolve(options.repositoryRoot ?? process.cwd())
  const intakeRoot = resolveIntakeRoot(options.intakeRoot)
  const expectations = options.expectations ?? FROZEN_BROCHURE_INTAKE
  const outputDirectory = path.resolve(
    options.outputDirectory ??
      path.join(
        repositoryRoot,
        'docs/ip-preference-cards/brochure-intake',
        expectations.reviewDate,
      ),
  )
  const reviewedAdditionsPath = path.resolve(
    options.reviewedAdditionsPath ??
      path.join(
        repositoryRoot,
        'data/ip-preference-cards/reviewed',
        `brochure-intake-additions-${expectations.reviewDate}.json`,
      ),
  )
  const reconciliationPath = path.resolve(
    options.reconciliationPath ?? path.join(outputDirectory, 'row-reconciliation.csv'),
  )
  const generatedSourcesPath = path.resolve(
    options.generatedSourcesPath ??
      path.join(repositoryRoot, 'data/ip-preference-cards/generated/sources.json'),
  )
  const csvPath = path.join(intakeRoot, 'preference_card_products.csv')
  const brochureDirectory = path.join(intakeRoot, 'brochures')

  const [csvContents, reconciliationContents, reviewedContents, existingSourcesContents, entries] =
    await Promise.all([
      readFile(csvPath, 'utf8'),
      readFile(reconciliationPath, 'utf8'),
      readFile(reviewedAdditionsPath, 'utf8'),
      readFile(generatedSourcesPath, 'utf8'),
      readdir(brochureDirectory, { withFileTypes: true }),
    ])
  const brochureFilenames = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort(compareText)
  const rawCsvRecords = parseCsvRecords(csvContents)
  const parsed = parseBrochureCsv(csvContents)
  const inputSummary = summarizeBrochureInput(parsed.rows, brochureFilenames)
  const csvSha256 = await sha256File(csvPath)
  assertFrozenIntakeFacts({
    parsedHeader: rawCsvRecords[0] ?? [],
    detectedHeader: parsed.detectedHeader,
    csvSha256,
    summary: inputSummary,
    brochureFilenames,
    expectations,
  })

  const reconciliationRows = parseReconciliationCsv(reconciliationContents)
  validateReconciliationRows(parsed.rows, reconciliationRows)
  const reviewed = parseReviewedIntake(reviewedContents)
  if (reviewed.reviewed_on !== expectations.reviewDate) {
    throw new Error(
      `Reviewed additions date ${reviewed.reviewed_on} does not match ${expectations.reviewDate}.`,
    )
  }
  if (reviewed.source_csv_sha256 !== csvSha256) {
    throw new Error('Reviewed additions are pinned to a different source CSV SHA-256.')
  }

  const existingSources = JSON.parse(existingSourcesContents) as ExistingSource[]
  if (!Array.isArray(existingSources)) throw new Error('Generated sources JSON must be an array.')
  const sourceById = new Map<string, NormalizedSource>()
  for (const source of existingSources) {
    const normalized = normalizeExistingSource(source)
    if (normalized) sourceById.set(normalized.sourceId, normalized)
  }
  for (const reviewedSource of reviewed.sources) {
    const normalized = normalizeReviewedSource(reviewedSource)
    const prior = sourceById.get(normalized.sourceId)
    if (
      prior &&
      normalizeComparisonText(prior.filename) !== normalizeComparisonText(normalized.filename)
    ) {
      throw new Error(
        `Reviewed source ${normalized.sourceId} collides with existing filename ${prior.filename}.`,
      )
    }
    sourceById.set(normalized.sourceId, normalized)
  }
  validateReviewedProducts({
    reviewed,
    reconciliationRows,
    sourceById,
    inputRows: parsed.rows,
  })

  const sourceManifest = await buildSourceManifest({
    intakeRoot,
    brochureFilenames,
    inputRows: parsed.rows,
    reviewedProducts: reviewed.products,
    sourceById,
    pdfPageCounter: options.pdfPageCounter ?? pdfInfoPageCount,
    reviewDate: expectations.reviewDate,
  })
  if (sourceManifest.source_count !== expectations.brochureFiles) {
    throw new Error(
      `Source manifest has ${sourceManifest.source_count} files; expected ${expectations.brochureFiles}.`,
    )
  }
  assertManifestAccounting(sourceManifest, expectations)

  const exactIdentifierGroups = exactRepeatedIdentifiers(parsed.rows)
  const normalizedIdentifierGroups = inputSummary.repeated_identifiers
  const sourceDuplicateGroups = byteIdenticalSourceGroups(sourceManifest)
  assertDuplicateAccounting({
    exactGroups: exactIdentifierGroups,
    normalizedGroups: normalizedIdentifierGroups,
    sourceGroups: sourceDuplicateGroups,
    expectations,
  })

  const dispositions = dispositionCounts(reconciliationRows)
  assertRecordEquals(
    dispositions,
    expectations.dispositionCounts,
    'Reconciliation disposition counts',
  )
  if (reviewed.products.length !== expectations.canonicalProductsAdded) {
    throw new Error(
      `Canonical-addition count changed: expected ${expectations.canonicalProductsAdded}, received ${reviewed.products.length}.`,
    )
  }
  const baseInputSummary: Omit<BrochureInputSummary, 'repeated_identifiers'> = {
    total_rows: inputSummary.total_rows,
    rows_with_exact_identifier: inputSummary.rows_with_exact_identifier,
    rows_with_not_stated_identifier: inputSummary.rows_with_not_stated_identifier,
    unique_manufacturers: inputSummary.unique_manufacturers,
    unique_source_filenames: inputSummary.unique_source_filenames,
    unresolved_source_filenames: inputSummary.unresolved_source_filenames,
    exact_duplicate_rows: inputSummary.exact_duplicate_rows,
  }
  const exactIdentifierSummary = duplicateGroupSummary(exactIdentifierGroups)
  const normalizedIdentifierSummary = duplicateGroupSummary(normalizedIdentifierGroups)
  const generatedSummary: GeneratedInputSummary = {
    format_version: '1.0',
    reviewed_on: expectations.reviewDate,
    source_csv_filename: 'preference_card_products.csv',
    source_csv_sha256: csvSha256,
    detected_header: true,
    observed_header: [...EXPECTED_BROCHURE_CSV_HEADER],
    brief_claimed_headerless: true,
    brochure_file_count: brochureFilenames.length,
    brochure_file_extensions: extensionCounts(brochureFilenames),
    disposition_counts: dispositions,
    canonical_products_added: reviewed.products.length,
    repeated_identifiers: exactIdentifierGroups,
    normalized_repeated_identifiers: normalizedIdentifierGroups,
    repeated_identifier_summary: exactIdentifierSummary,
    normalized_repeated_identifier_summary: normalizedIdentifierSummary,
    byte_identical_source_groups: sourceDuplicateGroups,
    byte_identical_source_summary: {
      groups: sourceDuplicateGroups.length,
      files: sourceDuplicateGroups.reduce(
        (total, group) => total + group.source_filenames.length,
        0,
      ),
      redundant_copies: sourceDuplicateGroups.reduce(
        (total, group) => total + group.redundant_copies,
        0,
      ),
    },
    ...baseInputSummary,
  }

  const existingRows = reconciliationRows.filter((row) =>
    EXISTING_DISPOSITIONS.has(row.disposition),
  )
  const unresolvedRows = reconciliationRows.filter((row) =>
    UNRESOLVED_DISPOSITIONS.has(row.disposition),
  )
  const irrelevantRows = reconciliationRows.filter(
    (row) => row.disposition === 'irrelevant_to_current_scope',
  )
  const duplicateRows = duplicateAnalysisRows(
    inputSummary,
    exactIdentifierGroups,
    normalizedIdentifierGroups,
    sourceDuplicateGroups,
    sourceManifest,
    reconciliationRows,
  )
  const manufacturerRows = manufacturerSummaryRows(parsed.rows, reconciliationRows)
  const reviewBatches = buildReviewBatchPlan(reviewed.products)
  if (
    reviewBatches.reduce((total, batch) => total + batch.productCount, 0) !==
    reviewed.products.length
  ) {
    throw new Error('Deterministic review batches do not account for every canonical addition.')
  }
  const jsonFormatter = options.jsonFormatter ?? defaultJsonFormatter

  const artifacts = new Map<string, string>([
    ['input-summary.json', await jsonFormatter(generatedSummary)],
    ['source-manifest.json', await jsonFormatter(sourceManifest)],
    [
      'row-reconciliation.csv',
      serializeCsv(RECONCILIATION_HEADER, reconciliationCsvRows(reconciliationRows)),
    ],
    [
      'new-product-additions.csv',
      serializeCsv(
        [
          'review_batch_id',
          'review_batch_manufacturer',
          'review_batch_product_count',
          'input_row_numbers',
          'product_id',
          'manufacturer_id',
          'manufacturer',
          'catalog_number',
          'product_name',
          'brand_family',
          'primary_category',
          'subcategory',
          'product_kind',
          'role_code',
          'verification_grade',
          'visibility_state',
          'evidence',
          'strongest_duplicate_candidates',
          'duplicate_rejection',
        ],
        newProductCsvRows(reviewed.products, reviewBatches),
      ),
    ],
    [
      'existing-product-matches.csv',
      serializeCsv(RECONCILIATION_HEADER, reconciliationSubsetRows(existingRows)),
    ],
    [
      'unresolved-relevant-products.csv',
      serializeCsv(RECONCILIATION_HEADER, reconciliationSubsetRows(unresolvedRows)),
    ],
    [
      'irrelevant-products.csv',
      serializeCsv(RECONCILIATION_HEADER, reconciliationSubsetRows(irrelevantRows)),
    ],
    [
      'duplicate-analysis.csv',
      serializeCsv(
        [
          'analysis_type',
          'identifier',
          'source_filenames',
          'input_row_numbers',
          'canonical_product_id',
          'canonical_catalog_number',
          'note',
        ],
        duplicateRows,
      ),
    ],
    [
      'manufacturer-summary.csv',
      serializeCsv(
        [
          'manufacturer',
          'total_rows',
          'rows_with_identifier',
          'unique_source_filenames',
          ...BROCHURE_DISPOSITIONS,
        ],
        manufacturerRows,
      ),
    ],
    ['README.md', readmeContents(generatedSummary, sourceManifest, reviewBatches)],
  ])

  if (
    artifacts.size !== BROCHURE_REVIEW_ARTIFACTS.length ||
    BROCHURE_REVIEW_ARTIFACTS.some((filename) => !artifacts.has(filename))
  ) {
    throw new Error('Generator did not produce the complete review-package artifact set.')
  }
  for (const [filename, contents] of artifacts) {
    assertNoAbsolutePaths(contents, [repositoryRoot, intakeRoot], filename)
  }

  if (options.checkOnly) {
    const stale: string[] = []
    for (const filename of BROCHURE_REVIEW_ARTIFACTS) {
      const expectedContents = artifacts.get(filename)!
      const existingContents = await readFile(path.join(outputDirectory, filename), 'utf8').catch(
        () => null,
      )
      if (existingContents !== expectedContents) stale.push(filename)
    }
    if (stale.length > 0) {
      throw new Error(`Brochure intake review artifacts are missing or stale: ${stale.join(', ')}.`)
    }
  } else {
    await mkdir(outputDirectory, { recursive: true })
    for (const filename of BROCHURE_REVIEW_ARTIFACTS) {
      await atomicWrite(path.join(outputDirectory, filename), artifacts.get(filename)!)
    }
  }

  return {
    inputSummary: generatedSummary,
    sourceManifest,
    reconciliationRows,
    artifactPaths: BROCHURE_REVIEW_ARTIFACTS.map((filename) =>
      path.join(outputDirectory, filename),
    ),
  }
}

if (process.argv[1] && /generate-brochure-intake-review\.(?:ts|js)$/.test(process.argv[1])) {
  const checkOnly = process.argv.slice(2).includes('--check')
  generateBrochureIntakeReview({ checkOnly })
    .then((result) => {
      console.log(
        `Brochure intake review: ${result.reconciliationRows.length} rows, ${result.sourceManifest.source_count} source files, ${result.inputSummary.canonical_products_added} canonical additions.`,
      )
      console.log(
        checkOnly
          ? `Validated ${result.artifactPaths.length} committed artifacts.`
          : `Wrote ${result.artifactPaths.length} artifacts.`,
      )
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
}
