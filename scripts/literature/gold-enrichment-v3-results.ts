import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'

import type { ValidateFunction } from 'ajv'
import Ajv2020 from 'ajv/dist/2020'

import { loadLiteratureEnrichmentLabels } from '@/features/literature/config'
import { parseCsvRows } from '@/features/literature/gold-set/export'
import { literatureEnrichmentRecordV2Schema } from '@/features/literature/schemas/enrichment'

import { parseExternalQaFindingsCsv, type ExternalQaFinding } from './data-quality/external-qa'
import {
  GOLD_ENRICHMENT_V3_CANONICAL_RECEIPT_SHA256,
  GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_SHA256,
  GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
  GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION,
  GOLD_ENRICHMENT_V3_PACKET_COLUMNS,
  GOLD_ENRICHMENT_V3_PACKET_FAMILIES,
  GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS,
  GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256,
  GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION,
  GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
  GOLD_ENRICHMENT_V3_TAXONOMY_VERSION,
  GOLD_ENRICHMENT_V3_UPGRADE_PLAN_SHA256,
  GOLD_ENRICHMENT_V3_WORKFLOW_ID,
  GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
  assertGoldEnrichmentV3QaContract,
  assertGoldEnrichmentV3SafeOutputDirectory,
  goldEnrichmentV3PhysicianFieldSha256,
  parseGoldEnrichmentV3CanonicalSource,
  parseGoldEnrichmentV3UpgradePlan,
  plannedGoldEnrichmentV3Text,
  preflightGoldEnrichmentV3Artifacts,
  publishGoldEnrichmentV3Artifact,
  serializeGoldEnrichmentV3Csv,
  serializeGoldEnrichmentV3Json,
  sha256Bytes,
  type GoldEnrichmentV3ArtifactIdentity,
  type GoldEnrichmentV3CanonicalRow,
  type GoldEnrichmentV3PacketFamily,
  type GoldEnrichmentV3PacketReceipt,
} from './gold-enrichment-v3'
import {
  buildGoldEnrichmentV3ReviewWorkbookBytes,
  type GoldEnrichmentV3ReviewWorkbookCohorts,
  type GoldEnrichmentV3ReviewWorkbookMetadata,
  type GoldEnrichmentV3ReviewWorkbookRow,
} from './gold-enrichment-v3-workbook'

export const GOLD_ENRICHMENT_V3_INCLUDED_METADATA_RESULT_COLUMNS = [
  'packet_id',
  'packet_family',
  'workflow_id',
  'prompt_template_version',
  'result_schema_version',
  'taxonomy_version',
  'label_schema_version',
  'enrichment_schema_version',
  'source_projection_sha256',
  'source_row_sha256',
  'master_row_id',
  'pmid',
  'physician_final_label',
  'physician_final_confidence',
  'metadata_sufficiency',
  'topic_ids',
  'technology_tags',
  'technology_tag_status',
  'clinical_purposes',
  'disease_tags',
  'disease_tag_status',
  'study_design',
  'publication_status',
  'categorization_from_full_text',
  'full_text_used',
  'enrichment_confidence',
  'requires_physician_enrichment_review',
  'evidence_1_field',
  'evidence_1_excerpt',
  'evidence_1_location',
  'evidence_2_field',
  'evidence_2_excerpt',
  'evidence_2_location',
  'enrichment_rationale',
  'processing_status',
  'processing_error',
] as const

export const GOLD_ENRICHMENT_V3_INCLUDED_FULL_TEXT_RESULT_COLUMNS = [
  ...GOLD_ENRICHMENT_V3_INCLUDED_METADATA_RESULT_COLUMNS.slice(0, 25),
  'full_text_filename',
  'full_text_sha256',
  ...GOLD_ENRICHMENT_V3_INCLUDED_METADATA_RESULT_COLUMNS.slice(25),
] as const

export const GOLD_ENRICHMENT_V3_EXCLUDED_RESULT_COLUMNS = [
  'packet_id',
  'packet_family',
  'workflow_id',
  'prompt_template_version',
  'result_schema_version',
  'taxonomy_version',
  'label_schema_version',
  'enrichment_schema_version',
  'source_projection_sha256',
  'source_row_sha256',
  'master_row_id',
  'pmid',
  'physician_final_label',
  'physician_final_confidence',
  'metadata_sufficiency',
  'assessment_confidence',
  'requires_physician_enrichment_review',
  'evidence_field',
  'evidence_excerpt',
  'assessment_rationale',
  'categorization_from_full_text',
  'full_text_used',
  'processing_status',
  'processing_error',
] as const

export const GOLD_ENRICHMENT_V3_MERGED_COLUMNS = [
  'workflow_id',
  'workflow_schema_version',
  'prompt_template_version',
  'result_schema_version',
  'taxonomy_version',
  'label_schema_version',
  'enrichment_schema_version',
  'source_sha256',
  'source_receipt_sha256',
  'physician_field_sha256',
  'result_packet_id',
  'result_packet_family',
  'source_projection_sha256',
  'source_row_sha256',
  'batch_id',
  'batch_name',
  'dataset_split',
  'gold_set_item_id',
  'display_order',
  'master_row_id',
  'screening_batch',
  'source_row_id',
  'pmid',
  'title',
  'abstract',
  'journal',
  'publication_year',
  'physician_final_label',
  'physician_final_confidence',
  'physician_accept_or_modify',
  'physician_notes',
  'physician_reviewed',
  'decision_provenance',
  'is_blinded',
  'relevance_review_complete',
  'metadata_sufficiency',
  'topic_ids',
  'technology_tags',
  'technology_tag_status',
  'clinical_purposes',
  'disease_tags',
  'disease_tag_status',
  'study_design',
  'publication_status',
  'categorization_from_full_text',
  'full_text_used',
  'full_text_filename',
  'full_text_sha256',
  'enrichment_confidence',
  'assessment_confidence',
  'requires_physician_enrichment_review',
  'evidence_1_field',
  'evidence_1_excerpt',
  'evidence_1_location',
  'evidence_2_field',
  'evidence_2_excerpt',
  'evidence_2_location',
  'enrichment_rationale',
  'processing_status',
  'processing_error',
  'external_qa_review_flag',
  'taxonomy_v2_upgrade_review_flag',
  'relevance_concern_review_flag',
  'physician_enrichment_reviewed',
  'physician_enrichment_accept_or_modify',
  'physician_enrichment_notes',
  'enrichment_provenance',
  'protocol_acceptance_authorized',
  'import_ready',
  'database_mutation_plan',
] as const

type IncludedMetadataColumn = (typeof GOLD_ENRICHMENT_V3_INCLUDED_METADATA_RESULT_COLUMNS)[number]
type IncludedFullTextColumn = (typeof GOLD_ENRICHMENT_V3_INCLUDED_FULL_TEXT_RESULT_COLUMNS)[number]
type ExcludedResultColumn = (typeof GOLD_ENRICHMENT_V3_EXCLUDED_RESULT_COLUMNS)[number]
type PacketInputColumn = (typeof GOLD_ENRICHMENT_V3_PACKET_COLUMNS)[number]
export type GoldEnrichmentV3MergedColumn = (typeof GOLD_ENRICHMENT_V3_MERGED_COLUMNS)[number]
export type GoldEnrichmentV3MergedRow = Record<GoldEnrichmentV3MergedColumn, string>

type IncludedRawResult = Record<IncludedMetadataColumn | IncludedFullTextColumn, string>
type ExcludedRawResult = Record<ExcludedResultColumn, string>

export interface GoldEnrichmentV3ValidatedIncludedRow {
  family: 'included_metadata_only' | 'included_full_text'
  raw: IncludedRawResult
  packetInput: Record<PacketInputColumn, string>
  topicIds: string[]
  technologyTags: string[]
  clinicalPurposes: string[]
  diseaseTags: string[]
}

export interface GoldEnrichmentV3ValidatedExcludedRow {
  family: 'excluded_metadata_sufficiency'
  raw: ExcludedRawResult
  packetInput: Record<PacketInputColumn, string>
}

export type GoldEnrichmentV3ValidatedRow =
  | GoldEnrichmentV3ValidatedIncludedRow
  | GoldEnrichmentV3ValidatedExcludedRow

interface PacketIndexEntry {
  packetId: string
  family: GoldEnrichmentV3PacketFamily
  ordinal: number
  rows: number
  csvPath: string
  csvSha256: string
  receiptPath: string
  receiptSha256: string
  expectedOutputFilename: string
  sourceProjectionSha256: string
}

interface PacketContext {
  index: PacketIndexEntry
  receipt: GoldEnrichmentV3PacketReceipt
  inputs: Array<Record<PacketInputColumn, string> & { csvRecordNumber: number }>
  resultSchemaValidator: ValidateFunction
}

export interface GoldEnrichmentV3PacketValidation {
  packetId: string
  family: GoldEnrichmentV3PacketFamily
  expectedResultFilename: string
  resultPath: string | null
  resultBytes: number | null
  resultSha256: string | null
  expectedRows: number
  receivedRows: number
  validRows: number
  valid: boolean
  issues: string[]
}

export interface GoldEnrichmentV3ValidationReport {
  workflowId: typeof GOLD_ENRICHMENT_V3_WORKFLOW_ID
  workflowSchemaVersion: typeof GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION
  resultSchemaVersion: typeof GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION
  complete: boolean
  valid: boolean
  packetCoverage: {
    expectedPackets: number
    presentPackets: number
    validPackets: number
    expectedRows: number
    validRows: number
    missingResultFiles: string[]
    unrecognizedResultFiles: string[]
  }
  packets: GoldEnrichmentV3PacketValidation[]
  safety: {
    rawResultsModified: false
    silentCorrections: false
    databaseWrites: 0
    modelCalls: 0
    heldOutTestAccessed: false
  }
}

export interface ValidateGoldEnrichmentV3ResultsOptions {
  runDirectory: string
  resultsDirectory: string
  outputDirectory?: string
  workspaceRoot?: string
  publishReports?: boolean
}

export interface ValidateGoldEnrichmentV3ResultsResult {
  report: GoldEnrichmentV3ValidationReport
  rows: GoldEnrichmentV3ValidatedRow[]
  reportArtifacts: GoldEnrichmentV3ArtifactIdentity[]
}

const SHA256 = /^[a-f0-9]{64}$/u
const BOOLEAN_VALUES = new Set(['true', 'false'])
const CONFIDENCES = new Set(['high', 'moderate', 'low'])
const METADATA_SUFFICIENCY = new Set([
  'adequate_abstract',
  'limited_abstract',
  'no_abstract',
  'conflicting_metadata',
])
const PROCESSING_STATUSES = new Set(['valid', 'error'])
const RELEVANCE_CONCERNS = new Set(['16043961', '26033136'])
const FORBIDDEN_LVRS_PMIDS = new Set(['41229759', '18453348'])
const FORBIDDEN_INPUT_PATH_TOKEN =
  /(?:^|[\\/_. -])(?:test|testing|all|held[ _-]?out|holdout)(?=$|[\\/_. -])/iu
const PACKET_PROMPT_PATHS: Record<GoldEnrichmentV3PacketFamily, string> = {
  included_metadata_only: 'prompts/included-metadata-only.md',
  included_full_text: 'prompts/included-full-text.md',
  excluded_metadata_sufficiency: 'prompts/excluded-metadata-sufficiency.md',
}
const PACKET_SCHEMA_PATHS: Record<GoldEnrichmentV3PacketFamily, string> = {
  included_metadata_only: 'schemas/included-metadata-only-result.schema.json',
  included_full_text: 'schemas/included-full-text-result.schema.json',
  excluded_metadata_sufficiency: 'schemas/excluded-metadata-sufficiency-result.schema.json',
}

const labelsV2 = loadLiteratureEnrichmentLabels('2.0.0')
const resultSchemaCompiler = new Ajv2020({ allErrors: true, strict: false })
const compiledResultSchemas = new Map<string, ValidateFunction>()

function deterministicArtifactIdentity(relativePath: string, bytes: Uint8Array) {
  return { path: relativePath, bytes: bytes.byteLength, sha256: sha256Bytes(bytes) }
}

function withoutBom(input: string) {
  return input.startsWith('\uFEFF') ? input.slice(1) : input
}

function exactCsvRecords<Column extends string>(
  input: string,
  label: string,
  columns: readonly Column[],
): Array<Record<Column, string> & { csvRecordNumber: number }> {
  const parsed = parseCsvRows(withoutBom(input))
  if (parsed.length === 0) throw new Error(`${label} is empty.`)
  const header = parsed[0]
  if (header.length !== columns.length || header.some((value, index) => value !== columns[index])) {
    throw new Error(`${label} header does not match the exact ${columns.length}-column schema.`)
  }
  return parsed.slice(1).map((values, index) => {
    if (values.length !== columns.length) {
      throw new Error(
        `${label} record ${index + 2} has ${values.length} columns; expected ${columns.length}.`,
      )
    }
    return {
      ...(Object.fromEntries(
        columns.map((column, columnIndex) => [column, values[columnIndex]]),
      ) as Record<Column, string>),
      csvRecordNumber: index + 2,
    }
  })
}

async function readUtf8RegularFile(inputPath: string, label: string) {
  const metadata = await lstat(inputPath)
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`${label} must be a non-symlink regular file.`)
  }
  assertSafeDevelopmentPath(await realpath(inputPath), `${label} resolved path`)
  const bytes = await readFile(inputPath)
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error(`${label} must be strict UTF-8.`)
  }
  if (Buffer.compare(Buffer.from(text, 'utf8'), bytes) !== 0) {
    throw new Error(`${label} is not byte-stable UTF-8.`)
  }
  return { bytes, text, sha256: sha256Bytes(bytes) }
}

function assertSafeDevelopmentPath(candidate: string, label: string) {
  if (!path.isAbsolute(candidate)) throw new Error(`${label} must be an absolute path.`)
  if (FORBIDDEN_INPUT_PATH_TOKEN.test(candidate)) {
    throw new Error(`${label} has held-out/test/all semantics and is forbidden.`)
  }
}

function parseJsonObject(input: string, label: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    throw new Error(`${label} must be valid JSON.`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return parsed as Record<string, unknown>
}

function canonicalArtifactEntries(
  manifestText: string,
  label: string,
): Array<Record<string, unknown>> {
  const manifest = parseJsonObject(manifestText, label)
  if (
    manifest.workflowId !== GOLD_ENRICHMENT_V3_WORKFLOW_ID ||
    manifest.workflowSchemaVersion !== GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION ||
    !Array.isArray(manifest.canonicalArtifacts)
  ) {
    throw new Error(`${label} does not match the V3 workflow contract.`)
  }
  return manifest.canonicalArtifacts as Array<Record<string, unknown>>
}

function assertManifestArtifactIdentity(
  canonicalArtifacts: readonly Record<string, unknown>[],
  relativePath: string,
  file: { bytes: Uint8Array; sha256: string },
  label: string,
) {
  const identities = canonicalArtifacts.filter((entry) => entry.path === relativePath)
  if (
    identities.length !== 1 ||
    identities[0].sha256 !== file.sha256 ||
    identities[0].bytes !== file.bytes.byteLength
  ) {
    throw new Error(`${label} is not checksum-bound by the V3 artifact manifest.`)
  }
}

function assertSafeRelativeArtifactPath(value: string, label: string, basenameOnly = false) {
  if (!value || path.isAbsolute(value) || value.split(/[\\/]/u).includes('..')) {
    throw new Error(`${label} must be a non-traversing relative artifact path.`)
  }
  if (basenameOnly && path.basename(value) !== value) {
    throw new Error(`${label} must be a basename without directory components.`)
  }
}

async function loadPacketContexts(runDirectory: string): Promise<PacketContext[]> {
  const [indexFile, manifestFile, runDefinitionFile] = await Promise.all([
    readUtf8RegularFile(path.join(runDirectory, 'packet-index.json'), 'Packet index'),
    readUtf8RegularFile(path.join(runDirectory, 'artifact-manifest.json'), 'Artifact manifest'),
    readUtf8RegularFile(path.join(runDirectory, 'run-definition.json'), 'Run definition'),
  ])
  const canonicalArtifacts = canonicalArtifactEntries(manifestFile.text, 'Artifact manifest')
  assertManifestArtifactIdentity(canonicalArtifacts, 'packet-index.json', indexFile, 'Packet index')
  assertManifestArtifactIdentity(
    canonicalArtifacts,
    'run-definition.json',
    runDefinitionFile,
    'Run definition',
  )
  const runDefinition = parseJsonObject(runDefinitionFile.text, 'Run definition')
  const runWorkflow = runDefinition.workflow as Record<string, unknown> | undefined
  const runScope = runDefinition.developmentScope as Record<string, unknown> | undefined
  const runSafety = runDefinition.safety as Record<string, unknown> | undefined
  if (
    runWorkflow?.id !== GOLD_ENRICHMENT_V3_WORKFLOW_ID ||
    runWorkflow?.workflowSchemaVersion !== GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION ||
    runWorkflow?.resultSchemaVersion !== GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION ||
    runWorkflow?.taxonomyVersion !== GOLD_ENRICHMENT_V3_TAXONOMY_VERSION ||
    runWorkflow?.labelSchemaVersion !== GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION ||
    runWorkflow?.enrichmentSchemaVersion !== GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION ||
    runScope?.rows !== 630 ||
    runScope?.heldOutTestRows !== 0 ||
    runScope?.testIdentitiesAccessed !== 0 ||
    runSafety?.heldOutTestAccessed !== false
  ) {
    throw new Error('Run definition does not match the development-only V3 contract.')
  }
  const parsedIndex = parseJsonObject(indexFile.text, 'Packet index')
  if (
    parsedIndex.workflowId !== GOLD_ENRICHMENT_V3_WORKFLOW_ID ||
    parsedIndex.workflowSchemaVersion !== GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION ||
    !Array.isArray(parsedIndex.packets) ||
    parsedIndex.packets.length !== 20
  ) {
    throw new Error('Packet index does not match the V3 workflow contract.')
  }
  const contexts: PacketContext[] = []
  const seenPacketIds = new Set<string>()
  for (const [index, value] of parsedIndex.packets.entries()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Packet index entry ${index + 1} is invalid.`)
    }
    const entry = value as unknown as PacketIndexEntry
    if (
      typeof entry.packetId !== 'string' ||
      !GOLD_ENRICHMENT_V3_PACKET_FAMILIES.includes(entry.family) ||
      !Number.isSafeInteger(entry.ordinal) ||
      entry.ordinal < 1 ||
      !Number.isSafeInteger(entry.rows) ||
      entry.rows < 1 ||
      typeof entry.csvPath !== 'string' ||
      typeof entry.receiptPath !== 'string' ||
      typeof entry.expectedOutputFilename !== 'string' ||
      !SHA256.test(entry.csvSha256) ||
      !SHA256.test(entry.receiptSha256) ||
      !SHA256.test(entry.sourceProjectionSha256)
    ) {
      throw new Error(`Packet index entry ${index + 1} has an invalid identity.`)
    }
    if (seenPacketIds.has(entry.packetId)) {
      throw new Error(`Packet index duplicates packet ID ${entry.packetId}.`)
    }
    seenPacketIds.add(entry.packetId)
    assertSafeRelativeArtifactPath(entry.csvPath, `Packet ${entry.packetId} CSV path`)
    assertSafeRelativeArtifactPath(entry.receiptPath, `Packet ${entry.packetId} receipt path`)
    assertSafeRelativeArtifactPath(
      entry.expectedOutputFilename,
      `Packet ${entry.packetId} result filename`,
      true,
    )
    const familyPath = entry.family.replaceAll('_', '-')
    const expectedPacketId = `${familyPath}-${String(entry.ordinal).padStart(3, '0')}`
    if (
      entry.packetId !== expectedPacketId ||
      entry.csvPath !== `packets/${familyPath}/${entry.packetId}.csv` ||
      entry.receiptPath !== `packets/${familyPath}/${entry.packetId}.receipt.json` ||
      entry.expectedOutputFilename !== `${entry.packetId}.result.csv`
    ) {
      throw new Error(`Packet ${entry.packetId} paths or ordinal are noncanonical.`)
    }
    const [receiptFile, packetCsv] = await Promise.all([
      readUtf8RegularFile(
        path.join(runDirectory, entry.receiptPath),
        `Packet ${entry.packetId} receipt`,
      ),
      readUtf8RegularFile(path.join(runDirectory, entry.csvPath), `Packet ${entry.packetId} CSV`),
    ])
    if (receiptFile.sha256 !== entry.receiptSha256 || packetCsv.sha256 !== entry.csvSha256) {
      throw new Error(`Packet ${entry.packetId} artifact checksum mismatch.`)
    }
    const receipt = parseJsonObject(
      receiptFile.text,
      `Packet ${entry.packetId} receipt`,
    ) as unknown as GoldEnrichmentV3PacketReceipt
    const promptIdentity = receipt.promptTemplate
    const schemaIdentity = receipt.expectedResultSchema
    const expectedPromptPath = PACKET_PROMPT_PATHS[entry.family]
    const expectedSchemaPath = PACKET_SCHEMA_PATHS[entry.family]
    if (
      promptIdentity?.path !== expectedPromptPath ||
      schemaIdentity?.path !== expectedSchemaPath
    ) {
      throw new Error(`Packet ${entry.packetId} prompt/result-schema paths are noncanonical.`)
    }
    assertSafeRelativeArtifactPath(promptIdentity.path, `Packet ${entry.packetId} prompt path`)
    assertSafeRelativeArtifactPath(schemaIdentity.path, `Packet ${entry.packetId} schema path`)
    const [promptFile, schemaFile] = await Promise.all([
      readUtf8RegularFile(
        path.join(runDirectory, promptIdentity.path),
        `Packet ${entry.packetId} prompt template`,
      ),
      readUtf8RegularFile(
        path.join(runDirectory, schemaIdentity.path),
        `Packet ${entry.packetId} result schema`,
      ),
    ])
    const promptManifest = canonicalArtifacts.find((item) => item.path === promptIdentity.path)
    const schemaManifest = canonicalArtifacts.find((item) => item.path === schemaIdentity.path)
    const promptContracts = runDefinition.promptTemplates as Record<string, unknown> | undefined
    const schemaContracts = runDefinition.outputSchemas as Record<string, unknown> | undefined
    const promptContract = promptContracts?.[promptIdentity.path] as
      | Record<string, unknown>
      | undefined
    const schemaContract = schemaContracts?.[schemaIdentity.path] as
      | Record<string, unknown>
      | undefined
    if (
      promptFile.sha256 !== promptIdentity.sha256 ||
      promptFile.bytes.byteLength !== promptIdentity.bytes ||
      schemaFile.sha256 !== schemaIdentity.sha256 ||
      schemaFile.bytes.byteLength !== schemaIdentity.bytes ||
      promptManifest?.sha256 !== promptFile.sha256 ||
      promptManifest?.bytes !== promptFile.bytes.byteLength ||
      schemaManifest?.sha256 !== schemaFile.sha256 ||
      schemaManifest?.bytes !== schemaFile.bytes.byteLength ||
      promptContract?.sha256 !== promptFile.sha256 ||
      promptContract?.bytes !== promptFile.bytes.byteLength ||
      schemaContract?.sha256 !== schemaFile.sha256 ||
      schemaContract?.bytes !== schemaFile.bytes.byteLength ||
      schemaContract?.version !== GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION
    ) {
      throw new Error(`Packet ${entry.packetId} prompt/result-schema checksum binding failed.`)
    }
    const parsedSchema = parseJsonObject(schemaFile.text, `Packet ${entry.packetId} result schema`)
    if (
      !Array.isArray(parsedSchema['x-csv-columns']) ||
      parsedSchema['x-csv-columns'].length !== resultColumns(entry.family).length ||
      parsedSchema['x-csv-columns'].some(
        (column, columnIndex) => column !== resultColumns(entry.family)[columnIndex],
      )
    ) {
      throw new Error(`Packet ${entry.packetId} result schema/header binding failed.`)
    }
    let resultSchemaValidator = compiledResultSchemas.get(schemaFile.sha256)
    if (!resultSchemaValidator) {
      resultSchemaValidator = resultSchemaCompiler.compile(parsedSchema)
      compiledResultSchemas.set(schemaFile.sha256, resultSchemaValidator)
    }
    if (
      receipt.workflowId !== GOLD_ENRICHMENT_V3_WORKFLOW_ID ||
      receipt.workflowSchemaVersion !== GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION ||
      receipt.promptTemplateVersion !== GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION ||
      receipt.resultSchemaVersion !== GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION ||
      receipt.taxonomyVersion !== GOLD_ENRICHMENT_V3_TAXONOMY_VERSION ||
      receipt.labelSchemaVersion !== GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION ||
      receipt.enrichmentSchemaVersion !== GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION ||
      receipt.packetId !== entry.packetId ||
      receipt.packetFamily !== entry.family ||
      receipt.packetOrdinal !== entry.ordinal ||
      receipt.rowCount !== entry.rows ||
      receipt.sourceProjectionSha256 !== entry.sourceProjectionSha256 ||
      receipt.expectedOutputFilename !== entry.expectedOutputFilename ||
      receipt.packetCsv.path !== entry.csvPath ||
      receipt.packetCsv.sha256 !== entry.csvSha256 ||
      receipt.packetCsv.bytes !== packetCsv.bytes.byteLength ||
      receipt.expectedResultSchema.version !== GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION ||
      !Array.isArray(receipt.orderedKeys) ||
      receipt.orderedKeys.length !== entry.rows
    ) {
      throw new Error(`Packet ${entry.packetId} receipt/index mismatch.`)
    }
    const inputs = exactCsvRecords(
      packetCsv.text,
      `Packet ${entry.packetId} CSV`,
      GOLD_ENRICHMENT_V3_PACKET_COLUMNS,
    )
    if (inputs.length !== entry.rows || inputs.length !== receipt.rowCount) {
      throw new Error(`Packet ${entry.packetId} row count mismatch.`)
    }
    inputs.forEach((row, rowIndex) => {
      const key = receipt.orderedKeys[rowIndex]
      const source = Object.fromEntries(
        GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS.map((column) => [column, row[column]]),
      )
      const sourceRowSha256 = sha256Bytes(serializeGoldEnrichmentV3Json(source))
      if (
        row.workflow_id !== GOLD_ENRICHMENT_V3_WORKFLOW_ID ||
        row.workflow_schema_version !== GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION ||
        row.prompt_template_version !== GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION ||
        row.result_schema_version !== GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION ||
        row.taxonomy_version !== GOLD_ENRICHMENT_V3_TAXONOMY_VERSION ||
        row.label_schema_version !== GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION ||
        row.enrichment_schema_version !== GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION ||
        row.packet_id !== entry.packetId ||
        row.packet_family !== entry.family ||
        row.packet_ordinal !== String(entry.ordinal) ||
        row.expected_output_filename !== entry.expectedOutputFilename ||
        row.master_row_id !== key?.masterRowId ||
        row.pmid !== key?.pmid ||
        row.source_row_sha256 !== key?.sourceRowSha256 ||
        row.source_row_sha256 !== sourceRowSha256 ||
        row.source_projection_sha256 !== entry.sourceProjectionSha256
      ) {
        throw new Error(
          `Packet ${entry.packetId} input order or identity mismatch at row ${rowIndex + 1}.`,
        )
      }
    })
    const sourceProjection = {
      columns: GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS,
      rows: inputs.map((row) =>
        GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS.map((column) => row[column]),
      ),
    }
    if (
      sha256Bytes(serializeGoldEnrichmentV3Json(sourceProjection)) !== entry.sourceProjectionSha256
    ) {
      throw new Error(`Packet ${entry.packetId} source projection checksum mismatch.`)
    }
    contexts.push({ index: entry, receipt, inputs, resultSchemaValidator })
  }
  const expectedFamilies: Record<GoldEnrichmentV3PacketFamily, { packets: number; rows: number }> =
    {
      included_metadata_only: { packets: 7, rows: 308 },
      included_full_text: { packets: 10, rows: 50 },
      excluded_metadata_sufficiency: { packets: 3, rows: 272 },
    }
  for (const family of GOLD_ENRICHMENT_V3_PACKET_FAMILIES) {
    const selected = contexts.filter((context) => context.index.family === family)
    if (
      selected.length !== expectedFamilies[family].packets ||
      selected.reduce((sum, context) => sum + context.index.rows, 0) !==
        expectedFamilies[family].rows
    ) {
      throw new Error(`Packet index has invalid ${family} coverage.`)
    }
  }
  const allInputs = contexts.flatMap((context) => context.inputs)
  if (
    allInputs.length !== 630 ||
    new Set(allInputs.map((row) => row.master_row_id)).size !== 630 ||
    new Set(allInputs.map((row) => row.pmid)).size !== 630
  ) {
    throw new Error('Packet inputs must bind exactly 630 unique development identities.')
  }
  return contexts
}

function parseStrictBoolean(value: string, label: string): boolean {
  if (!BOOLEAN_VALUES.has(value)) throw new Error(`${label} must be lowercase true or false.`)
  return value === 'true'
}

function parsePipeList(value: string, label: string): string[] {
  if (!value) return []
  const values = value.split('|').map((item) => item.trim())
  if (values.some((item) => !item)) throw new Error(`${label} contains a blank list item.`)
  if (new Set(values).size !== values.length)
    throw new Error(`${label} contains a duplicate value.`)
  if (value !== values.join('|')) {
    throw new Error(`${label} must use canonical pipe-delimited IDs without surrounding spaces.`)
  }
  return values
}

function assertVersionBinding(row: IncludedRawResult | ExcludedRawResult, context: PacketContext) {
  if (
    row.packet_id !== context.index.packetId ||
    row.packet_family !== context.index.family ||
    row.workflow_id !== GOLD_ENRICHMENT_V3_WORKFLOW_ID ||
    row.prompt_template_version !== GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION ||
    row.result_schema_version !== GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION ||
    row.taxonomy_version !== GOLD_ENRICHMENT_V3_TAXONOMY_VERSION ||
    row.label_schema_version !== GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION ||
    row.enrichment_schema_version !== GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION ||
    row.source_projection_sha256 !== context.receipt.sourceProjectionSha256
  ) {
    throw new Error('Result version, packet, or source-projection binding is invalid.')
  }
}

function assertIdentityBinding(
  result: IncludedRawResult | ExcludedRawResult,
  input: Record<PacketInputColumn, string>,
) {
  if (
    result.master_row_id !== input.master_row_id ||
    result.pmid !== input.pmid ||
    result.source_row_sha256 !== input.source_row_sha256
  ) {
    throw new Error('Result identifiers or canonical source-row hash changed.')
  }
  if (
    result.physician_final_label !== input.physician_final_label ||
    result.physician_final_confidence !== input.physician_final_confidence
  ) {
    throw new Error('Result changed immutable physician relevance fields.')
  }
}

function assertProcessingStatus(result: IncludedRawResult | ExcludedRawResult) {
  if (!PROCESSING_STATUSES.has(result.processing_status)) {
    throw new Error('processing_status must be valid or error.')
  }
  if (result.processing_status === 'valid' && result.processing_error) {
    throw new Error('A valid row must have blank processing_error.')
  }
  if (result.processing_status === 'error') {
    if (!result.processing_error) throw new Error('An error row must explain processing_error.')
    throw new Error(`Returned row failed closed: ${result.processing_error}`)
  }
}

function assertMetadataSufficiency(
  result: IncludedRawResult | ExcludedRawResult,
  input: Record<PacketInputColumn, string>,
) {
  if (!METADATA_SUFFICIENCY.has(result.metadata_sufficiency)) {
    throw new Error(`Unsupported metadata_sufficiency ${result.metadata_sufficiency}.`)
  }
  if (input.no_abstract === 'true' && result.metadata_sufficiency !== 'no_abstract') {
    throw new Error('A no-abstract source must remain metadata_sufficiency=no_abstract.')
  }
  if (input.no_abstract === 'false' && result.metadata_sufficiency === 'no_abstract') {
    throw new Error(
      'A source with a supplied abstract cannot use metadata_sufficiency=no_abstract.',
    )
  }
  if (
    input.metadata_sufficiency_constraint &&
    result.metadata_sufficiency !== input.metadata_sufficiency_constraint
  ) {
    throw new Error('Result violated the checksum-bound metadata-sufficiency constraint.')
  }
}

const EVIDENCE_FIELDS: Record<string, keyof Record<PacketInputColumn, string>> = {
  title: 'title',
  abstract: 'abstract',
  mesh_terms: 'mesh_terms_json',
  author_keywords: 'author_keywords_json',
  publication_types: 'publication_types_json',
}

function assertMetadataEvidence(
  field: string,
  excerpt: string,
  input: Record<PacketInputColumn, string>,
  required: boolean,
) {
  if (!field && !excerpt && !required) return
  if (!field || !excerpt) throw new Error('Evidence field and excerpt must be supplied together.')
  const sourceColumn = EVIDENCE_FIELDS[field]
  if (!sourceColumn) throw new Error(`Unsupported metadata evidence field: ${field}.`)
  if (!input[sourceColumn].includes(excerpt)) {
    throw new Error(`Evidence excerpt is not verbatim in supplied ${field}.`)
  }
}

function validateIncludedResult(
  raw: IncludedRawResult,
  input: Record<PacketInputColumn, string>,
  family: 'included_metadata_only' | 'included_full_text',
): GoldEnrichmentV3ValidatedIncludedRow {
  assertProcessingStatus(raw)
  assertMetadataSufficiency(raw, input)
  const topicIds = parsePipeList(raw.topic_ids, 'topic_ids')
  const technologyTags = parsePipeList(raw.technology_tags, 'technology_tags')
  const clinicalPurposes = parsePipeList(raw.clinical_purposes, 'clinical_purposes')
  const diseaseTags = parsePipeList(raw.disease_tags, 'disease_tags')
  if (
    raw.technology_tag_status === 'legacy_unspecified' ||
    raw.disease_tag_status === 'legacy_unspecified'
  ) {
    throw new Error('legacy_unspecified is invalid in V3 output.')
  }
  literatureEnrichmentRecordV2Schema.parse({
    master_row_id: raw.master_row_id,
    pmid: raw.pmid,
    topic_ids: topicIds,
    technology_tags: technologyTags,
    technology_tag_status: raw.technology_tag_status,
    clinical_purposes: clinicalPurposes,
    disease_tags: diseaseTags,
    disease_tag_status: raw.disease_tag_status,
    study_design: raw.study_design,
    publication_status: raw.publication_status,
  })
  if (
    FORBIDDEN_LVRS_PMIDS.has(raw.pmid) &&
    topicIds.includes('bronchoscopic-lung-volume-reduction')
  ) {
    throw new Error('The checksum-bound LVRS false-positive topic is forbidden for this PMID.')
  }
  if (!CONFIDENCES.has(raw.enrichment_confidence)) {
    throw new Error('enrichment_confidence must be high, moderate, or low.')
  }
  const fromFullText = parseStrictBoolean(
    raw.categorization_from_full_text,
    'categorization_from_full_text',
  )
  const fullTextUsed = parseStrictBoolean(raw.full_text_used, 'full_text_used')
  const review = parseStrictBoolean(
    raw.requires_physician_enrichment_review,
    'requires_physician_enrichment_review',
  )
  if (family === 'included_metadata_only') {
    if (fromFullText || fullTextUsed) {
      throw new Error('Metadata-only result must keep both full-text flags false.')
    }
    assertMetadataEvidence(raw.evidence_1_field, raw.evidence_1_excerpt, input, true)
    if (!raw.evidence_1_location) {
      throw new Error('Metadata-only primary evidence requires a source-field location.')
    }
    assertMetadataEvidence(raw.evidence_2_field, raw.evidence_2_excerpt, input, false)
    if ((raw.evidence_2_field || raw.evidence_2_excerpt) && !raw.evidence_2_location) {
      throw new Error('Metadata-only secondary evidence requires a source-field location.')
    }
  } else {
    if (!fromFullText || !fullTextUsed) {
      throw new Error('Complete-full-text result must set both full-text flags true.')
    }
    if (
      raw.full_text_filename !== input.expected_full_text_filename ||
      raw.full_text_sha256 !== input.expected_full_text_sha256 ||
      !SHA256.test(raw.full_text_sha256)
    ) {
      throw new Error('Complete-full-text result file identity does not match the packet manifest.')
    }
    if (
      raw.evidence_1_field !== 'full_text' ||
      !raw.evidence_1_excerpt ||
      !raw.evidence_1_location
    ) {
      throw new Error('Complete-full-text primary evidence must be a located full_text excerpt.')
    }
    const secondaryParts = [
      raw.evidence_2_field,
      raw.evidence_2_excerpt,
      raw.evidence_2_location,
    ].filter(Boolean).length
    if (secondaryParts !== 0 && secondaryParts !== 3) {
      throw new Error('Complete-full-text secondary evidence must be entirely blank or complete.')
    }
    if (secondaryParts === 3 && raw.evidence_2_field !== 'full_text') {
      assertMetadataEvidence(raw.evidence_2_field, raw.evidence_2_excerpt, input, true)
    }
  }
  if (!raw.enrichment_rationale) throw new Error('Included result requires enrichment_rationale.')
  const requiredReview =
    family === 'included_full_text' ||
    raw.physician_final_label === 'include_adjacent' ||
    raw.enrichment_confidence !== 'high' ||
    ['limited_abstract', 'no_abstract', 'conflicting_metadata'].includes(
      raw.metadata_sufficiency,
    ) ||
    raw.technology_tag_status === 'not_assessable' ||
    raw.disease_tag_status === 'not_assessable' ||
    raw.study_design === 'not-assessable-from-available-metadata' ||
    raw.publication_status === 'not-assessable-from-available-metadata' ||
    ['preview_only', 'missing'].includes(input.full_text_evidence_status) ||
    RELEVANCE_CONCERNS.has(raw.pmid)
  if (requiredReview && !review) {
    throw new Error('Result failed a mandatory physician-enrichment-review trigger.')
  }
  return {
    family,
    raw,
    packetInput: input,
    topicIds,
    technologyTags,
    clinicalPurposes,
    diseaseTags,
  }
}

function validateExcludedResult(
  raw: ExcludedRawResult,
  input: Record<PacketInputColumn, string>,
): GoldEnrichmentV3ValidatedExcludedRow {
  assertProcessingStatus(raw)
  assertMetadataSufficiency(raw, input)
  if (raw.physician_final_label !== 'exclude') {
    throw new Error('Excluded metadata-sufficiency result must preserve label=exclude.')
  }
  if (!CONFIDENCES.has(raw.assessment_confidence)) {
    throw new Error('assessment_confidence must be high, moderate, or low.')
  }
  if (
    parseStrictBoolean(raw.categorization_from_full_text, 'categorization_from_full_text') ||
    parseStrictBoolean(raw.full_text_used, 'full_text_used')
  ) {
    throw new Error('Excluded result must keep both full-text flags false.')
  }
  const review = parseStrictBoolean(
    raw.requires_physician_enrichment_review,
    'requires_physician_enrichment_review',
  )
  if (
    (raw.assessment_confidence !== 'high' || raw.metadata_sufficiency !== 'adequate_abstract') &&
    !review
  ) {
    throw new Error('Result failed a mandatory physician-enrichment-review trigger.')
  }
  assertMetadataEvidence(raw.evidence_field, raw.evidence_excerpt, input, true)
  if (!raw.assessment_rationale) throw new Error('Excluded result requires assessment_rationale.')
  return { family: 'excluded_metadata_sufficiency', raw, packetInput: input }
}

function resultColumns(family: GoldEnrichmentV3PacketFamily): readonly string[] {
  if (family === 'included_metadata_only')
    return GOLD_ENRICHMENT_V3_INCLUDED_METADATA_RESULT_COLUMNS
  if (family === 'included_full_text') return GOLD_ENRICHMENT_V3_INCLUDED_FULL_TEXT_RESULT_COLUMNS
  return GOLD_ENRICHMENT_V3_EXCLUDED_RESULT_COLUMNS
}

async function validatePacketResult(
  context: PacketContext,
  resultsDirectory: string,
): Promise<{ packet: GoldEnrichmentV3PacketValidation; rows: GoldEnrichmentV3ValidatedRow[] }> {
  const resultPath = path.join(resultsDirectory, context.index.expectedOutputFilename)
  const base: GoldEnrichmentV3PacketValidation = {
    packetId: context.index.packetId,
    family: context.index.family,
    expectedResultFilename: context.index.expectedOutputFilename,
    resultPath,
    resultBytes: null,
    resultSha256: null,
    expectedRows: context.index.rows,
    receivedRows: 0,
    validRows: 0,
    valid: false,
    issues: [],
  }
  let file: Awaited<ReturnType<typeof readUtf8RegularFile>>
  try {
    file = await readUtf8RegularFile(resultPath, `Result ${context.index.expectedOutputFilename}`)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { packet: { ...base, resultPath: null, issues: ['missing_result_file'] }, rows: [] }
    }
    return {
      packet: { ...base, issues: [error instanceof Error ? error.message : String(error)] },
      rows: [],
    }
  }
  base.resultBytes = file.bytes.byteLength
  base.resultSha256 = file.sha256
  let rawRows: Array<Record<string, string> & { csvRecordNumber: number }>
  try {
    rawRows = exactCsvRecords(
      file.text,
      `Result ${context.index.expectedOutputFilename}`,
      resultColumns(context.index.family),
    )
  } catch (error: unknown) {
    return {
      packet: { ...base, issues: [error instanceof Error ? error.message : String(error)] },
      rows: [],
    }
  }
  base.receivedRows = rawRows.length
  if (rawRows.length !== context.inputs.length) {
    base.issues.push(
      `row_count_mismatch: expected ${context.inputs.length}, received ${rawRows.length}`,
    )
  }
  const seenMasterRows = new Set<string>()
  const seenPmids = new Set<string>()
  const rows: GoldEnrichmentV3ValidatedRow[] = []
  for (let index = 0; index < rawRows.length; index += 1) {
    const raw = rawRows[index] as unknown as IncludedRawResult | ExcludedRawResult
    const input = context.inputs[index]
    try {
      if (!input) throw new Error('Result contains an extra row.')
      if (seenMasterRows.has(raw.master_row_id) || seenPmids.has(raw.pmid)) {
        throw new Error('Result contains a duplicate identifier.')
      }
      seenMasterRows.add(raw.master_row_id)
      seenPmids.add(raw.pmid)
      assertVersionBinding(raw, context)
      assertIdentityBinding(raw, input)
      const validated =
        context.index.family === 'excluded_metadata_sufficiency'
          ? validateExcludedResult(raw as ExcludedRawResult, input)
          : validateIncludedResult(
              raw as IncludedRawResult,
              input,
              context.index.family as 'included_metadata_only' | 'included_full_text',
            )
      const schemaRow = Object.fromEntries(
        resultColumns(context.index.family).map((column) => [
          column,
          (raw as Record<string, string>)[column],
        ]),
      )
      if (!context.resultSchemaValidator(schemaRow)) {
        throw new Error(
          `Result schema validation failed: ${resultSchemaCompiler.errorsText(
            context.resultSchemaValidator.errors,
            { separator: '; ' },
          )}`,
        )
      }
      rows.push(validated)
    } catch (error: unknown) {
      base.issues.push(
        `record ${index + 2}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  if (rawRows.length < context.inputs.length) base.issues.push('result_missing_expected_rows')
  base.validRows = rows.length
  base.valid = base.issues.length === 0 && rows.length === context.inputs.length
  return { packet: base, rows: base.valid ? rows : [] }
}

async function publishValidationReports(
  outputDirectory: string,
  workspaceRoot: string,
  report: GoldEnrichmentV3ValidationReport,
) {
  const resolvedOutput = await assertGoldEnrichmentV3SafeOutputDirectory(
    outputDirectory,
    workspaceRoot,
  )
  const controlledReport = {
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    taxonomyVersion: GOLD_ENRICHMENT_V3_TAXONOMY_VERSION,
    labelSchemaVersion: GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION,
    enrichmentSchemaVersion: GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
    valid: report.valid,
    packetResults: report.packets.map((packet) => ({
      packetId: packet.packetId,
      valid: packet.valid,
      issues: packet.issues.filter((issue) =>
        /unsupported|taxonomy|tag|study|publication|legacy|controlled/iu.test(issue),
      ),
    })),
  }
  const coverageReport = {
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    complete: report.complete,
    ...report.packetCoverage,
  }
  const plan = [
    plannedGoldEnrichmentV3Text(
      'packet-validation-report.json',
      serializeGoldEnrichmentV3Json(report),
    ),
    plannedGoldEnrichmentV3Text(
      'controlled-value-validation-report.json',
      serializeGoldEnrichmentV3Json(controlledReport),
    ),
    plannedGoldEnrichmentV3Text(
      'result-coverage-report.json',
      serializeGoldEnrichmentV3Json(coverageReport),
    ),
  ]
  await preflightGoldEnrichmentV3Artifacts(resolvedOutput, plan)
  const published: GoldEnrichmentV3ArtifactIdentity[] = []
  for (const artifact of plan) {
    published.push(await publishGoldEnrichmentV3Artifact(resolvedOutput, artifact))
  }
  return published
}

export async function validateGoldEnrichmentV3Results(
  options: ValidateGoldEnrichmentV3ResultsOptions,
): Promise<ValidateGoldEnrichmentV3ResultsResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd())
  const runDirectory = path.resolve(options.runDirectory)
  const resultsDirectory = path.resolve(options.resultsDirectory)
  assertSafeDevelopmentPath(runDirectory, 'Run directory')
  assertSafeDevelopmentPath(resultsDirectory, 'Results directory')
  const resultsMetadata = await lstat(resultsDirectory)
  if (!resultsMetadata.isDirectory() || resultsMetadata.isSymbolicLink()) {
    throw new Error('Results directory must be a non-symlink directory.')
  }
  assertSafeDevelopmentPath(await realpath(resultsDirectory), 'Results directory resolved path')
  const contexts = await loadPacketContexts(runDirectory)
  const expectedFiles = new Set(contexts.map((context) => context.index.expectedOutputFilename))
  const unrecognizedResultFiles = (await readdir(resultsDirectory))
    .filter((filename) => filename.toLocaleLowerCase('en-US').endsWith('.csv'))
    .filter((filename) => !expectedFiles.has(filename))
    .sort((left, right) => left.localeCompare(right, 'en-US'))
  const packetResults = await Promise.all(
    contexts.map((context) => validatePacketResult(context, resultsDirectory)),
  )
  const packets = packetResults.map((result) => result.packet)
  const missingResultFiles = packets
    .filter((packet) => packet.resultPath === null)
    .map((packet) => packet.expectedResultFilename)
  const rows = packetResults.flatMap((result) => result.rows)
  const complete =
    missingResultFiles.length === 0 && packets.every((packet) => packet.receivedRows > 0)
  const valid =
    complete &&
    unrecognizedResultFiles.length === 0 &&
    packets.every((packet) => packet.valid) &&
    rows.length === 630
  const report: GoldEnrichmentV3ValidationReport = {
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    resultSchemaVersion: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
    complete,
    valid,
    packetCoverage: {
      expectedPackets: contexts.length,
      presentPackets: packets.filter((packet) => packet.resultPath !== null).length,
      validPackets: packets.filter((packet) => packet.valid).length,
      expectedRows: contexts.reduce((sum, context) => sum + context.index.rows, 0),
      validRows: rows.length,
      missingResultFiles,
      unrecognizedResultFiles,
    },
    packets,
    safety: {
      rawResultsModified: false,
      silentCorrections: false,
      databaseWrites: 0,
      modelCalls: 0,
      heldOutTestAccessed: false,
    },
  }
  const reportArtifacts =
    options.publishReports === false || !options.outputDirectory
      ? []
      : await publishValidationReports(path.resolve(options.outputDirectory), workspaceRoot, report)
  return { report, rows: valid ? rows : [], reportArtifacts }
}

export interface MergeGoldEnrichmentV3Options {
  runDirectory: string
  resultsDirectory: string
  sourcePath: string
  priorEnrichmentPath: string
  qaFindingsPath: string
  upgradePlanPath: string
  outputDirectory: string
  workspaceRoot?: string
}

export interface MergeGoldEnrichmentV3Result {
  rows: GoldEnrichmentV3MergedRow[]
  artifacts: GoldEnrichmentV3ArtifactIdentity[]
  mergedArtifact: GoldEnrichmentV3ArtifactIdentity
  receiptArtifact: GoldEnrichmentV3ArtifactIdentity
}

interface PriorEnrichmentRow {
  master_row_id: string
  pmid: string
  topic_ids: string
  technology_tags: string
  clinical_purposes: string
  disease_tags: string
  study_design: string
  publication_status: string
}

interface FullTextRegistryProjection {
  master_row_id: string
  pmid: string
  evidence_status: string
  expected_filename: string
  file_sha256: string
  full_text_availability_note: string
}

export const GOLD_ENRICHMENT_V3_REVIEW_CANDIDATE_COLUMNS = [
  'master_row_id',
  'pmid',
  'physician_final_label',
  'required_review',
  'review_reasons',
  'full_text_evidence_status',
  'expected_full_text_filename',
  'full_text_file_sha256',
  'full_text_availability_note',
  'direct_qa_finding',
  'taxonomy_v2_upgrade_candidate',
  'relevance_concern',
  'v3_qa_or_upgrade_disagreement',
] as const

function parseFlexibleCsv(input: string, label: string) {
  const parsed = parseCsvRows(withoutBom(input))
  if (parsed.length === 0) throw new Error(`${label} is empty.`)
  const header = parsed[0]
  if (new Set(header).size !== header.length)
    throw new Error(`${label} contains duplicate columns.`)
  return parsed.slice(1).map((values, index) => {
    if (values.length !== header.length) {
      throw new Error(`${label} record ${index + 2} has the wrong column count.`)
    }
    return Object.fromEntries(header.map((column, columnIndex) => [column, values[columnIndex]]))
  })
}

function requireFlexibleColumns(
  rows: Array<Record<string, string>>,
  columns: readonly string[],
  label: string,
) {
  const first = rows[0]
  if (!first) throw new Error(`${label} has no rows.`)
  const missing = columns.filter((column) => !(column in first))
  if (missing.length > 0) throw new Error(`${label} is missing columns: ${missing.join(', ')}.`)
}

function currentFieldValue(row: GoldEnrichmentV3MergedRow, field: string): string {
  const normalized = field.trim()
  if (normalized in row) return row[normalized as GoldEnrichmentV3MergedColumn]
  return normalized
    .split('/')
    .map((part) => (part in row ? row[part as GoldEnrichmentV3MergedColumn] : ''))
    .filter(Boolean)
    .join(' || ')
}

function normalizedQaSuggestion(value: string): string[] {
  const normalized = value.trim()
  if (!normalized || /^\(?blank\)?$/iu.test(normalized)) return []
  if (/manual|review|check|verify|consider|assess/iu.test(normalized)) return []
  return normalized
    .split(/[|;,]/u)
    .map((part) => part.trim())
    .filter((part) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(part))
}

function qaRuleViolation(
  finding: ExternalQaFinding,
  merged: GoldEnrichmentV3MergedRow | undefined,
): boolean | null {
  if (finding.review_tier !== 'rule_based_consistency' || !merged) return null
  const topics = new Set(parsePipeList(merged.topic_ids, 'QA rerun topic_ids'))
  const technologies = new Set(parsePipeList(merged.technology_tags, 'QA rerun technology_tags'))
  const diseases = new Set(parsePipeList(merged.disease_tags, 'QA rerun disease_tags'))
  const purposes = new Set(parsePipeList(merged.clinical_purposes, 'QA rerun clinical_purposes'))
  switch (finding.issue) {
    case 'topic=pleural-interventions but no pleural technology tag':
      return (
        topics.has('pleural-interventions') &&
        ![
          'indwelling-pleural-catheter',
          'medical-thoracoscopy',
          'thoracentesis',
          'chest-tube',
          'pleurodesis',
        ].some((value) => technologies.has(value))
      )
    case 'topic=ebus-mediastinal-staging but disease lacks lung-cancer':
      return topics.has('ebus-mediastinal-staging') && !diseases.has('lung-cancer')
    case 'purpose=staging but topic lacks ebus-mediastinal-staging':
      return purposes.has('staging') && !topics.has('ebus-mediastinal-staging')
    case 'topic=education-simulation-quality but purpose lacks training':
      return topics.has('education-simulation-quality') && !purposes.has('training')
    case 'topic=pleural-interventions but disease lacks pleural-disease':
      return topics.has('pleural-interventions') && !diseases.has('pleural-disease')
    case 'topic=airway-stents-stenosis but no airway-stent tech tag':
      return topics.has('airway-stents-stenosis') && !technologies.has('airway-stent')
    case 'topic=ebus-mediastinal-staging but no EBUS technology tag':
      return (
        topics.has('ebus-mediastinal-staging') &&
        !['convex-ebus', 'eus-b'].some((value) => technologies.has(value))
      )
    case 'topic=BLVR but no endobronchial-valve tech tag':
      return (
        topics.has('bronchoscopic-lung-volume-reduction') &&
        !technologies.has('endobronchial-valve')
      )
    case 'purpose=training but topic lacks education-simulation-quality':
      return purposes.has('training') && !topics.has('education-simulation-quality')
    case 'study_design=editorial paired with publication_status=letter':
      return merged.study_design === 'editorial' && merged.publication_status === 'letter'
    case 'topic=tracheostomy-airway-access but no percutaneous-tracheostomy tag':
      return (
        topics.has('tracheostomy-airway-access') && !technologies.has('percutaneous-tracheostomy')
      )
    default:
      return null
  }
}

function qaIndependentlyAddressed(
  finding: ExternalQaFinding,
  merged: GoldEnrichmentV3MergedRow | undefined,
): boolean {
  if (!merged || finding.review_tier === 'global_data_quality') return false
  if (finding.review_tier === 'rule_based_consistency') {
    return qaRuleViolation(finding, merged) === false
  }
  const suggestion = normalizedQaSuggestion(finding.suggested_action)
  if (suggestion.length === 0) return false
  const current = currentFieldValue(merged, finding.field)
  const currentValues = new Set(current.split(/\s*\|\s*/u).filter(Boolean))
  return suggestion.every((value) => currentValues.has(value))
}

function candidateValuesSelected(
  merged: GoldEnrichmentV3MergedRow,
  additions: Array<Record<string, unknown>>,
): boolean | null {
  if (additions.length === 0) return null
  return additions.every((addition) => {
    const field = String(addition.field ?? '')
    const value = String(addition.vocabularyId ?? '')
    const current = currentFieldValue(merged, field)
    return current.split('|').includes(value)
  })
}

function loadPriorRows(input: string): PriorEnrichmentRow[] {
  const rows = parseFlexibleCsv(input, 'Prior V1/V2 enrichment')
  const columns = [
    'master_row_id',
    'pmid',
    'topic_ids',
    'technology_tags',
    'clinical_purposes',
    'disease_tags',
    'study_design',
    'publication_status',
  ] as const
  requireFlexibleColumns(rows, columns, 'Prior V1/V2 enrichment')
  return rows.map(
    (row) =>
      Object.fromEntries(
        columns.map((column) => [column, row[column]]),
      ) as unknown as PriorEnrichmentRow,
  )
}

function loadFullTextRegistry(input: string): FullTextRegistryProjection[] {
  const rows = parseFlexibleCsv(input, 'V3 full-text registry')
  const columns = [
    'master_row_id',
    'pmid',
    'evidence_status',
    'expected_filename',
    'file_sha256',
    'full_text_availability_note',
  ] as const
  requireFlexibleColumns(rows, columns, 'V3 full-text registry')
  const projected = rows.map(
    (row) =>
      Object.fromEntries(
        columns.map((column) => [column, row[column]]),
      ) as unknown as FullTextRegistryProjection,
  )
  const statuses = countStrings(projected.map((row) => row.evidence_status))
  if (
    projected.length !== 56 ||
    new Set(projected.map((row) => row.master_row_id)).size !== 56 ||
    new Set(projected.map((row) => row.pmid)).size !== 56 ||
    statuses.matched_complete !== 50 ||
    statuses.preview_only !== 1 ||
    statuses.missing !== 5 ||
    Object.keys(statuses).some(
      (status) => !['matched_complete', 'preview_only', 'missing'].includes(status),
    )
  ) {
    throw new Error('V3 full-text registry does not match the exact 50/1/5 evidence contract.')
  }
  const preview = projected.find((row) => row.pmid === '16043961')
  if (
    !preview ||
    preview.evidence_status !== 'preview_only' ||
    preview.file_sha256 !== 'a777267005cbab7321aacb0e2569f528925068434267c2860d9f9167289e7b2b'
  ) {
    throw new Error('V3 full-text registry lost the PMID 16043961 preview-only binding.')
  }
  projected.forEach((row) => {
    if (
      row.evidence_status === 'matched_complete' &&
      (!row.expected_filename || !SHA256.test(row.file_sha256))
    ) {
      throw new Error(`Complete full-text registry identity is incomplete for PMID ${row.pmid}.`)
    }
    if (row.evidence_status === 'missing' && row.file_sha256) {
      throw new Error(
        `Missing full-text registry row unexpectedly has a hash for PMID ${row.pmid}.`,
      )
    }
  })
  return projected
}

function mergedRowFromValidated(
  source: GoldEnrichmentV3CanonicalRow,
  validated: GoldEnrichmentV3ValidatedRow,
  registry: FullTextRegistryProjection | undefined,
  directQa: boolean,
  upgrade: boolean,
): GoldEnrichmentV3MergedRow {
  const relevanceConcern = RELEVANCE_CONCERNS.has(source.pmid)
  const requiresReview =
    validated.raw.requires_physician_enrichment_review === 'true' ||
    Boolean(registry) ||
    directQa ||
    upgrade ||
    relevanceConcern
  const common = {
    workflow_id: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflow_schema_version: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    prompt_template_version: GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION,
    result_schema_version: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
    taxonomy_version: GOLD_ENRICHMENT_V3_TAXONOMY_VERSION,
    label_schema_version: GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION,
    enrichment_schema_version: GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
    source_sha256: GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_SHA256,
    source_receipt_sha256: GOLD_ENRICHMENT_V3_CANONICAL_RECEIPT_SHA256,
    physician_field_sha256: GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256,
    result_packet_id: validated.raw.packet_id,
    result_packet_family: validated.raw.packet_family,
    source_projection_sha256: validated.raw.source_projection_sha256,
    source_row_sha256: validated.raw.source_row_sha256,
    batch_id: source.batch_id,
    batch_name: source.batch_name,
    dataset_split: source.dataset_split,
    gold_set_item_id: source.gold_set_item_id,
    display_order: source.display_order,
    master_row_id: source.master_row_id,
    screening_batch: source.screening_batch,
    source_row_id: source.source_row_id,
    pmid: source.pmid,
    title: source.title,
    abstract: source.abstract,
    journal: source.journal,
    publication_year: source.publication_year,
    physician_final_label: source.physician_final_label,
    physician_final_confidence: source.physician_final_confidence,
    physician_accept_or_modify: source.physician_accept_or_modify,
    physician_notes: source.physician_notes,
    physician_reviewed: source.physician_reviewed,
    decision_provenance: source.decision_provenance,
    is_blinded: source.is_blinded,
    relevance_review_complete: source.relevance_review_complete,
  }
  if (validated.family === 'excluded_metadata_sufficiency') {
    const raw = validated.raw
    return {
      ...common,
      metadata_sufficiency: raw.metadata_sufficiency,
      topic_ids: '',
      technology_tags: '',
      technology_tag_status: '',
      clinical_purposes: '',
      disease_tags: '',
      disease_tag_status: '',
      study_design: '',
      publication_status: '',
      categorization_from_full_text: 'false',
      full_text_used: 'false',
      full_text_filename: '',
      full_text_sha256: '',
      enrichment_confidence: '',
      assessment_confidence: raw.assessment_confidence,
      requires_physician_enrichment_review: String(requiresReview),
      evidence_1_field: raw.evidence_field,
      evidence_1_excerpt: raw.evidence_excerpt,
      evidence_1_location: '',
      evidence_2_field: '',
      evidence_2_excerpt: '',
      evidence_2_location: '',
      enrichment_rationale: raw.assessment_rationale,
      processing_status: raw.processing_status,
      processing_error: raw.processing_error,
      external_qa_review_flag: String(directQa),
      taxonomy_v2_upgrade_review_flag: String(upgrade),
      relevance_concern_review_flag: String(relevanceConcern),
      physician_enrichment_reviewed: 'false',
      physician_enrichment_accept_or_modify: '',
      physician_enrichment_notes: '',
      enrichment_provenance: 'unresolved_enrichment',
      protocol_acceptance_authorized: 'false',
      import_ready: 'false',
      database_mutation_plan: '',
    }
  }
  const raw = validated.raw
  const fullText = validated.family === 'included_full_text'
  return {
    ...common,
    metadata_sufficiency: raw.metadata_sufficiency,
    topic_ids: validated.topicIds.join('|'),
    technology_tags: validated.technologyTags.join('|'),
    technology_tag_status: raw.technology_tag_status,
    clinical_purposes: validated.clinicalPurposes.join('|'),
    disease_tags: validated.diseaseTags.join('|'),
    disease_tag_status: raw.disease_tag_status,
    study_design: raw.study_design,
    publication_status: raw.publication_status,
    categorization_from_full_text: raw.categorization_from_full_text,
    full_text_used: raw.full_text_used,
    full_text_filename: fullText ? raw.full_text_filename : '',
    full_text_sha256: fullText ? raw.full_text_sha256 : '',
    enrichment_confidence: raw.enrichment_confidence,
    assessment_confidence: '',
    requires_physician_enrichment_review: String(requiresReview),
    evidence_1_field: raw.evidence_1_field,
    evidence_1_excerpt: raw.evidence_1_excerpt,
    evidence_1_location: raw.evidence_1_location,
    evidence_2_field: raw.evidence_2_field,
    evidence_2_excerpt: raw.evidence_2_excerpt,
    evidence_2_location: raw.evidence_2_location,
    enrichment_rationale: raw.enrichment_rationale,
    processing_status: raw.processing_status,
    processing_error: raw.processing_error,
    external_qa_review_flag: String(directQa),
    taxonomy_v2_upgrade_review_flag: String(upgrade),
    relevance_concern_review_flag: String(relevanceConcern),
    physician_enrichment_reviewed: 'false',
    physician_enrichment_accept_or_modify: '',
    physician_enrichment_notes: '',
    enrichment_provenance: fullText
      ? 'full_text_ai_enrichment_pending_physician'
      : 'unresolved_enrichment',
    protocol_acceptance_authorized: 'false',
    import_ready: 'false',
    database_mutation_plan: '',
  }
}

function reviewReasonsForRow(
  row: GoldEnrichmentV3MergedRow,
  registry: FullTextRegistryProjection | undefined,
  qaDisagreement: boolean,
  upgradeDisagreement: boolean,
): string[] {
  const reasons: string[] = []
  if (row.requires_physician_enrichment_review === 'true') {
    reasons.push('v3_requires_physician_enrichment_review')
  }
  if (row.physician_final_label === 'include_adjacent') reasons.push('include_adjacent')
  if (registry) reasons.push('full_text_manifest')
  if (registry && ['preview_only', 'missing'].includes(registry.evidence_status)) {
    reasons.push(`full_text_${registry.evidence_status}`)
  }
  if (row.relevance_concern_review_flag === 'true') reasons.push('relevance_concern')
  if (row.taxonomy_v2_upgrade_review_flag === 'true') {
    reasons.push('taxonomy_v2_upgrade_candidate')
  }
  if (row.external_qa_review_flag === 'true') reasons.push('direct_external_qa')
  const confidence = row.enrichment_confidence || row.assessment_confidence
  if (confidence !== 'high') reasons.push('moderate_or_low_confidence')
  if (row.physician_final_label !== 'exclude') {
    if (row.technology_tag_status === 'not_assessable') reasons.push('technology_not_assessable')
    if (row.disease_tag_status === 'not_assessable') reasons.push('disease_not_assessable')
    if (row.study_design === 'not-assessable-from-available-metadata') {
      reasons.push('study_design_unresolved')
    }
    if (row.publication_status === 'not-assessable-from-available-metadata') {
      reasons.push('publication_status_unresolved')
    }
  }
  if (
    ['limited_abstract', 'no_abstract', 'conflicting_metadata'].includes(row.metadata_sufficiency)
  ) {
    reasons.push(`metadata_${row.metadata_sufficiency}`)
  }
  if (qaDisagreement) reasons.push('v3_external_qa_disagreement')
  if (upgradeDisagreement) reasons.push('v3_taxonomy_upgrade_disagreement')
  if (row.processing_status !== 'valid' || row.processing_error)
    reasons.push('invalid_or_warning_result')
  return [...new Set(reasons)]
}

const CANONICAL_PACKET_METADATA_FIELDS = [
  'master_row_id',
  'pmid',
  'title',
  'abstract',
  'journal',
  'journal_abbreviation',
  'publication_year',
  'publication_types_json',
  'mesh_terms_json',
  'author_keywords_json',
  'languages_json',
  'no_abstract',
  'physician_final_label',
  'physician_final_confidence',
] as const

function assertCanonicalPacketAndResultBinding(
  source: GoldEnrichmentV3CanonicalRow,
  validated: GoldEnrichmentV3ValidatedRow,
) {
  for (const field of CANONICAL_PACKET_METADATA_FIELDS) {
    const expected =
      field === 'no_abstract'
        ? String(['true', 'True'].includes(source.no_abstract) || !source.abstract)
        : source[field]
    if (validated.packetInput[field] !== expected) {
      throw new Error(
        `Packet/result canonical source binding failed for PMID ${source.pmid} field ${field}.`,
      )
    }
  }
  if (
    validated.raw.master_row_id !== source.master_row_id ||
    validated.raw.pmid !== source.pmid ||
    validated.raw.physician_final_label !== source.physician_final_label ||
    validated.raw.physician_final_confidence !== source.physician_final_confidence
  ) {
    throw new Error(`Result fixed metadata is not anchored to canonical PMID ${source.pmid}.`)
  }
}

export async function mergeGoldEnrichmentV3(
  options: MergeGoldEnrichmentV3Options,
): Promise<MergeGoldEnrichmentV3Result> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd())
  const paths = [
    options.runDirectory,
    options.resultsDirectory,
    options.sourcePath,
    options.priorEnrichmentPath,
    options.qaFindingsPath,
    options.upgradePlanPath,
  ].map((candidate) => path.resolve(candidate))
  paths.forEach((candidate, index) =>
    assertSafeDevelopmentPath(candidate, `Merge input ${index + 1}`),
  )
  const validation = await validateGoldEnrichmentV3Results({
    runDirectory: paths[0],
    resultsDirectory: paths[1],
    workspaceRoot,
    publishReports: false,
  })
  if (!validation.report.valid || validation.rows.length !== 630) {
    throw new Error('Merge requires complete, valid coverage for all 20 result packets.')
  }
  const [
    sourceFile,
    priorFile,
    qaFile,
    upgradeFile,
    registryFile,
    registryReceiptFile,
    manifestFile,
  ] = await Promise.all([
    readUtf8RegularFile(paths[2], 'Canonical source'),
    readUtf8RegularFile(paths[3], 'Prior V1/V2 enrichment'),
    readUtf8RegularFile(paths[4], 'External-QA findings'),
    readUtf8RegularFile(paths[5], 'Taxonomy-v2 upgrade plan'),
    readUtf8RegularFile(path.join(paths[0], 'full-text-registry-v3.csv'), 'Full-text registry'),
    readUtf8RegularFile(
      path.join(paths[0], 'full-text-registry-v3.receipt.json'),
      'Full-text registry receipt',
    ),
    readUtf8RegularFile(path.join(paths[0], 'artifact-manifest.json'), 'Artifact manifest'),
  ])
  if (sourceFile.sha256 !== 'd2942507531a4ba55a5a4195a6919c959eff77cd3473a83eeae16074861b1e64') {
    throw new Error('Merge canonical source checksum mismatch.')
  }
  if (
    ![
      '62003ac04650a4d303a8cc73785452a0bdf3ddeeca3c1ea87bdf2e4e4bc0b15c',
      '0c6762a5532e20e2b94cfdd39f2dfc8141d60e468da297805194c2d70f6420c7',
    ].includes(priorFile.sha256)
  ) {
    throw new Error('Prior comparison source is not a recognized checksum-bound V1/V2 artifact.')
  }
  if (qaFile.sha256 !== '1c7992f29bb7c03afc370f3cb0e7a978a237dc9cbb964966e0dcec0cd07b6edd') {
    throw new Error('External-QA findings checksum mismatch.')
  }
  if (upgradeFile.sha256 !== GOLD_ENRICHMENT_V3_UPGRADE_PLAN_SHA256) {
    throw new Error('Taxonomy-v2 upgrade-plan checksum mismatch.')
  }
  const canonicalArtifacts = canonicalArtifactEntries(manifestFile.text, 'Artifact manifest')
  assertManifestArtifactIdentity(
    canonicalArtifacts,
    'full-text-registry-v3.csv',
    registryFile,
    'Full-text registry',
  )
  assertManifestArtifactIdentity(
    canonicalArtifacts,
    'full-text-registry-v3.receipt.json',
    registryReceiptFile,
    'Full-text registry receipt',
  )
  const registryReceipt = parseJsonObject(registryReceiptFile.text, 'Full-text registry receipt')
  const registryIdentity = registryReceipt.registry as Record<string, unknown> | undefined
  const registryCounts = registryReceipt.counts as Record<string, unknown> | undefined
  if (
    registryReceipt.workflowId !== GOLD_ENRICHMENT_V3_WORKFLOW_ID ||
    registryReceipt.workflowSchemaVersion !== GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION ||
    registryIdentity?.path !== 'full-text-registry-v3.csv' ||
    registryIdentity?.sha256 !== registryFile.sha256 ||
    registryIdentity?.bytes !== registryFile.bytes.byteLength ||
    registryCounts?.matched_complete !== 50 ||
    registryCounts?.preview_only !== 1 ||
    registryCounts?.missing !== 5 ||
    registryReceipt.binariesCopiedIntoWorkflow !== false
  ) {
    throw new Error('Full-text registry identity/receipt mismatch.')
  }
  const sourceRows = parseGoldEnrichmentV3CanonicalSource(sourceFile.text)
  const priorRows = loadPriorRows(priorFile.text)
  const qaFindings = parseExternalQaFindingsCsv(qaFile.text)
  assertGoldEnrichmentV3QaContract(qaFindings)
  const upgradePlan = parseGoldEnrichmentV3UpgradePlan(upgradeFile.text)
  const upgradeRows = upgradePlan.rows as Array<Record<string, unknown>>
  const registryRows = loadFullTextRegistry(registryFile.text)
  if (
    priorRows.length !== 630 ||
    new Set(priorRows.map((row) => row.master_row_id)).size !== 630 ||
    new Set(priorRows.map((row) => row.pmid)).size !== 630
  ) {
    throw new Error('Prior enrichment comparison must contain 630 unique development rows.')
  }
  const sourceByPmid = new Map(sourceRows.map((row) => [row.pmid, row]))
  registryRows.forEach((row) => {
    if (sourceByPmid.get(row.pmid)?.master_row_id !== row.master_row_id) {
      throw new Error(`Full-text registry/source identity mismatch for PMID ${row.pmid}.`)
    }
  })
  const registryByPmid = new Map(registryRows.map((row) => [row.pmid, row]))
  const resultByKey = new Map(
    validation.rows.map((row) => [`${row.raw.master_row_id}:${row.raw.pmid}`, row]),
  )
  validation.rows.forEach((validated) => {
    const source = sourceByPmid.get(validated.raw.pmid)
    if (!source || source.master_row_id !== validated.raw.master_row_id) {
      throw new Error(
        `Validated packet/result identity is absent from the canonical source: ${validated.raw.master_row_id}:${validated.raw.pmid}.`,
      )
    }
    assertCanonicalPacketAndResultBinding(source, validated)
  })
  const directQaPmids = new Set(
    qaFindings
      .filter((finding) => finding.review_tier === 'direct_targeted')
      .map((finding) => finding.pmid),
  )
  const upgradePmids = new Set(upgradeRows.map((row) => String(row.pmid)))
  upgradeRows.forEach((row) => {
    const source = sourceByPmid.get(String(row.pmid))
    if (!source || source.master_row_id !== String(row.masterRowId)) {
      throw new Error(`Taxonomy-v2 upgrade/source identity mismatch for PMID ${String(row.pmid)}.`)
    }
  })
  const mergedRows = sourceRows.map((source) => {
    const validated = resultByKey.get(`${source.master_row_id}:${source.pmid}`)
    if (!validated) throw new Error(`Validated V3 result is missing PMID ${source.pmid}.`)
    return mergedRowFromValidated(
      source,
      validated,
      registryByPmid.get(source.pmid),
      directQaPmids.has(source.pmid),
      upgradePmids.has(source.pmid),
    )
  })
  const mergedByPmid = new Map(mergedRows.map((row) => [row.pmid, row]))
  assertGoldEnrichmentV3MergedCandidateRows(mergedRows)
  if (new Set(mergedRows.map((row) => row.pmid)).size !== 630) {
    throw new Error('Merged V3 artifact must contain 630 unique PMIDs.')
  }
  for (const registry of registryRows) {
    const merged = mergedByPmid.get(registry.pmid)
    if (!merged) {
      throw new Error(`Full-text registry/result identity mismatch for PMID ${registry.pmid}.`)
    }
    if (registry.evidence_status === 'matched_complete') {
      if (
        merged.full_text_used !== 'true' ||
        merged.categorization_from_full_text !== 'true' ||
        merged.full_text_filename !== registry.expected_filename ||
        merged.full_text_sha256 !== registry.file_sha256
      ) {
        throw new Error(
          `Matched-complete full-text registry/result binding failed for PMID ${registry.pmid}.`,
        )
      }
      continue
    }
    if (
      merged.full_text_used !== 'false' ||
      merged.categorization_from_full_text !== 'false' ||
      merged.full_text_filename ||
      merged.full_text_sha256
    ) {
      throw new Error(`Preview/missing full text must not be used for PMID ${registry.pmid}.`)
    }
  }
  const fullTextUsed = mergedRows.filter((row) => row.full_text_used === 'true')
  if (fullTextUsed.length !== 50)
    throw new Error('Merged V3 artifact must use exactly 50 full texts.')
  const excludedRows = mergedRows.filter((row) => row.physician_final_label === 'exclude')
  if (excludedRows.length !== 272)
    throw new Error('Merged V3 artifact must contain 272 exclusions.')
  for (const row of excludedRows) {
    if (
      [
        row.topic_ids,
        row.technology_tags,
        row.technology_tag_status,
        row.clinical_purposes,
        row.disease_tags,
        row.disease_tag_status,
        row.study_design,
        row.publication_status,
      ].some(Boolean)
    ) {
      throw new Error(`Excluded PMID ${row.pmid} contains forbidden taxonomy.`)
    }
  }
  const mergedCsv = serializeGoldEnrichmentV3Csv(GOLD_ENRICHMENT_V3_MERGED_COLUMNS, mergedRows)
  const mergedSha256 = sha256Bytes(mergedCsv)

  const qaOverlayRows = qaFindings.map((finding) => {
    const merged = mergedByPmid.get(finding.pmid)
    const ruleViolation = qaRuleViolation(finding, merged)
    const addressed = qaIndependentlyAddressed(finding, merged)
    const remainsOpen = !addressed
    return {
      source_review: finding.source_review,
      severity: finding.severity,
      category: finding.category,
      master_row_id: finding.master_row_id,
      pmid: finding.pmid,
      field: finding.field,
      issue: finding.issue,
      suggested_qa_action: finding.suggested_action,
      review_tier: finding.review_tier,
      v3_current_value: merged ? currentFieldValue(merged, finding.field) : '',
      v3_independently_addressed: String(addressed),
      concern_remains_open: String(remainsOpen),
      rule_rerun_evaluable:
        finding.review_tier === 'rule_based_consistency' ? String(ruleViolation !== null) : '',
      rule_violation_present: ruleViolation === null ? '' : String(ruleViolation),
      consistency_rerun_status:
        finding.review_tier === 'rule_based_consistency'
          ? addressed
            ? 'closed_by_independent_v3'
            : 'open_after_v3_consistency_rerun'
          : finding.review_tier === 'global_data_quality'
            ? 'global_finding_retained'
            : addressed
              ? 'direct_finding_independently_addressed'
              : 'direct_finding_open',
      physician_adjudication_required: String(
        remainsOpen || finding.review_tier !== 'global_data_quality',
      ),
      qa_value_applied_automatically: 'false',
    }
  })
  const qaOverlayColumns = [
    'source_review',
    'severity',
    'category',
    'master_row_id',
    'pmid',
    'field',
    'issue',
    'suggested_qa_action',
    'review_tier',
    'v3_current_value',
    'v3_independently_addressed',
    'concern_remains_open',
    'rule_rerun_evaluable',
    'rule_violation_present',
    'consistency_rerun_status',
    'physician_adjudication_required',
    'qa_value_applied_automatically',
  ] as const
  const qaOverlayCsv = serializeGoldEnrichmentV3Csv(qaOverlayColumns, qaOverlayRows)
  if (
    qaOverlayRows.filter(
      (row) => row.review_tier === 'rule_based_consistency' && row.rule_rerun_evaluable === 'true',
    ).length !== 104
  ) {
    throw new Error('Not every rule-based external-QA finding was rerun against V3 output.')
  }
  const qaDisagreementPmids = new Set(
    qaOverlayRows
      .filter((row) => row.pmid && row.concern_remains_open === 'true')
      .map((row) => row.pmid),
  )

  const upgradeOverlayRows = upgradeRows.map((candidate) => {
    const pmid = String(candidate.pmid)
    const merged = mergedByPmid.get(pmid)
    if (!merged) throw new Error(`Taxonomy-v2 upgrade candidate PMID ${pmid} is absent from V3.`)
    const additions = Array.isArray(candidate.candidateFieldVocabularyAdditions)
      ? (candidate.candidateFieldVocabularyAdditions as Array<Record<string, unknown>>)
      : []
    const selected = candidateValuesSelected(merged, additions)
    return {
      master_row_id: String(candidate.masterRowId),
      pmid,
      candidate_fields: Array.isArray(candidate.candidateFields)
        ? candidate.candidateFields.map(String).join('|')
        : '',
      candidate_values: additions
        .map((addition) => `${String(addition.field)}:${String(addition.vocabularyId)}`)
        .join('|'),
      candidate_reason: String(candidate.reason ?? ''),
      v3_selected_candidate_independently:
        selected === null ? 'not_machine_assessable' : String(selected),
      v3_current_values: Array.isArray(candidate.candidateFields)
        ? candidate.candidateFields
            .map((field) => `${String(field)}=${currentFieldValue(merged, String(field))}`)
            .join(' || ')
        : '',
      physician_adjudication_required: 'true',
      remains_review_eligible: 'true',
      candidate_applied_automatically: 'false',
    }
  })
  const upgradeOverlayColumns = [
    'master_row_id',
    'pmid',
    'candidate_fields',
    'candidate_values',
    'candidate_reason',
    'v3_selected_candidate_independently',
    'v3_current_values',
    'physician_adjudication_required',
    'remains_review_eligible',
    'candidate_applied_automatically',
  ] as const
  const upgradeOverlayCsv = serializeGoldEnrichmentV3Csv(upgradeOverlayColumns, upgradeOverlayRows)
  const upgradeDisagreementPmids = new Set(
    upgradeOverlayRows
      .filter((row) => row.v3_selected_candidate_independently !== 'true')
      .map((row) => row.pmid),
  )

  const priorByKey = new Map(priorRows.map((row) => [`${row.master_row_id}:${row.pmid}`, row]))
  const comparisonColumns = [
    'master_row_id',
    'pmid',
    'physician_final_label',
    'changed_fields_vs_prior',
    'prior_topic_ids',
    'v3_topic_ids',
    'prior_technology_tags',
    'v3_technology_tags',
    'prior_clinical_purposes',
    'v3_clinical_purposes',
    'prior_disease_tags',
    'v3_disease_tags',
    'prior_study_design',
    'v3_study_design',
    'prior_publication_status',
    'v3_publication_status',
  ] as const
  const comparisonRows = mergedRows.map((row) => {
    const prior = priorByKey.get(`${row.master_row_id}:${row.pmid}`)
    if (!prior) throw new Error(`Prior V1/V2 comparison is missing PMID ${row.pmid}.`)
    const fieldPairs = [
      ['topic_ids', prior.topic_ids, row.topic_ids],
      ['technology_tags', prior.technology_tags, row.technology_tags],
      ['clinical_purposes', prior.clinical_purposes, row.clinical_purposes],
      ['disease_tags', prior.disease_tags, row.disease_tags],
      ['study_design', prior.study_design, row.study_design],
      ['publication_status', prior.publication_status, row.publication_status],
    ] as const
    return {
      master_row_id: row.master_row_id,
      pmid: row.pmid,
      physician_final_label: row.physician_final_label,
      changed_fields_vs_prior: fieldPairs
        .filter(([, before, after]) => before !== after)
        .map(([field]) => field)
        .join('|'),
      prior_topic_ids: prior.topic_ids,
      v3_topic_ids: row.topic_ids,
      prior_technology_tags: prior.technology_tags,
      v3_technology_tags: row.technology_tags,
      prior_clinical_purposes: prior.clinical_purposes,
      v3_clinical_purposes: row.clinical_purposes,
      prior_disease_tags: prior.disease_tags,
      v3_disease_tags: row.disease_tags,
      prior_study_design: prior.study_design,
      v3_study_design: row.study_design,
      prior_publication_status: prior.publication_status,
      v3_publication_status: row.publication_status,
    }
  })
  const comparisonCsv = serializeGoldEnrichmentV3Csv(comparisonColumns, comparisonRows)

  const reviewCandidateRows = mergedRows.map((row) => {
    const registry = registryByPmid.get(row.pmid)
    const reasons = reviewReasonsForRow(
      row,
      registry,
      qaDisagreementPmids.has(row.pmid),
      upgradeDisagreementPmids.has(row.pmid),
    )
    return {
      master_row_id: row.master_row_id,
      pmid: row.pmid,
      physician_final_label: row.physician_final_label,
      required_review: String(reasons.length > 0),
      review_reasons: reasons.join('|'),
      full_text_evidence_status: registry?.evidence_status ?? 'not_selected',
      expected_full_text_filename: registry?.expected_filename ?? '',
      full_text_file_sha256: registry?.file_sha256 ?? '',
      full_text_availability_note: registry?.full_text_availability_note ?? '',
      direct_qa_finding: row.external_qa_review_flag,
      taxonomy_v2_upgrade_candidate: row.taxonomy_v2_upgrade_review_flag,
      relevance_concern: row.relevance_concern_review_flag,
      v3_qa_or_upgrade_disagreement: String(
        qaDisagreementPmids.has(row.pmid) || upgradeDisagreementPmids.has(row.pmid),
      ),
    }
  })
  const reviewCandidatesCsv = serializeGoldEnrichmentV3Csv(
    GOLD_ENRICHMENT_V3_REVIEW_CANDIDATE_COLUMNS,
    reviewCandidateRows,
  )

  const packetCoverageReport = serializeGoldEnrichmentV3Json(validation.report.packetCoverage)
  const controlledValueReport = serializeGoldEnrichmentV3Json({
    valid: true,
    taxonomyVersion: '2.0.0',
    labelSchemaVersion: '2.0.0',
    enrichmentSchemaVersion: '2.0.0',
    includedRows: 358,
    excludedRows: 272,
    unsupportedValues: 0,
    legacyUnspecifiedValues: 0,
    excludedTaxonomyViolations: 0,
    hardSafetyViolations: 0,
  })
  const fullTextUsageReport = serializeGoldEnrichmentV3Json({
    registryRows: registryRows.length,
    matchedComplete: registryRows.filter((row) => row.evidence_status === 'matched_complete')
      .length,
    previewOnly: registryRows.filter((row) => row.evidence_status === 'preview_only').length,
    missing: registryRows.filter((row) => row.evidence_status === 'missing').length,
    fullTextUsedTrue: fullTextUsed.length,
    previewOrMissingUsed: mergedRows.filter(
      (row) =>
        row.full_text_used === 'true' &&
        ['preview_only', 'missing'].includes(registryByPmid.get(row.pmid)?.evidence_status ?? ''),
    ).length,
  })
  const mergeReceipt = serializeGoldEnrichmentV3Json({
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    resultSchemaVersion: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
    taxonomyVersion: GOLD_ENRICHMENT_V3_TAXONOMY_VERSION,
    labelSchemaVersion: GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION,
    enrichmentSchemaVersion: GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
    source: { bytes: sourceFile.bytes.byteLength, sha256: sourceFile.sha256 },
    priorComparisonSource: { bytes: priorFile.bytes.byteLength, sha256: priorFile.sha256 },
    merged: {
      path: 'gold-set-v1-enrichment-v3-merged.csv',
      bytes: Buffer.byteLength(mergedCsv),
      sha256: mergedSha256,
    },
    outputs: {
      packetCoverage: deterministicArtifactIdentity(
        'packet-coverage-report.json',
        Buffer.from(packetCoverageReport),
      ),
      controlledValueValidation: deterministicArtifactIdentity(
        'controlled-value-validation-report.json',
        Buffer.from(controlledValueReport),
      ),
      fullTextUsage: deterministicArtifactIdentity(
        'full-text-usage-report.json',
        Buffer.from(fullTextUsageReport),
      ),
      priorComparison: deterministicArtifactIdentity(
        'comparison-against-prior-v1-v2.csv',
        Buffer.from(comparisonCsv),
      ),
      externalQaOverlay: deterministicArtifactIdentity(
        'external-qa-overlay.csv',
        Buffer.from(qaOverlayCsv),
      ),
      taxonomyV2UpgradeOverlay: deterministicArtifactIdentity(
        'taxonomy-v2-upgrade-overlay.csv',
        Buffer.from(upgradeOverlayCsv),
      ),
      physicianReviewCandidates: deterministicArtifactIdentity(
        'physician-review-candidate-report.csv',
        Buffer.from(reviewCandidatesCsv),
      ),
    },
    rows: { total: 630, included: 358, excluded: 272, uniquePmids: 630 },
    fullTextUsed: 50,
    physicianFieldSha256: goldEnrichmentV3PhysicianFieldSha256(sourceRows),
    packetValidation: { complete: true, valid: true, packets: 20, rows: 630 },
    overlays: {
      externalQaFindings: qaOverlayRows.length,
      externalQaAppliedAutomatically: 0,
      upgradeCandidates: upgradeOverlayRows.length,
      upgradeCandidatesAppliedAutomatically: 0,
    },
    safety: {
      importRowsCreated: 0,
      databaseMutationPlan: null,
      databaseWrites: 0,
      heldOutTestAccessed: false,
      physicianRelevanceChanged: false,
      modelCalls: 0,
      networkRequests: 0,
      importReady: false,
    },
  })
  const outputDirectory = await assertGoldEnrichmentV3SafeOutputDirectory(
    path.resolve(options.outputDirectory),
    workspaceRoot,
  )
  const plan = [
    plannedGoldEnrichmentV3Text('gold-set-v1-enrichment-v3-merged.csv', mergedCsv),
    plannedGoldEnrichmentV3Text('gold-set-v1-enrichment-v3-merged.receipt.json', mergeReceipt),
    plannedGoldEnrichmentV3Text('packet-coverage-report.json', packetCoverageReport),
    plannedGoldEnrichmentV3Text('controlled-value-validation-report.json', controlledValueReport),
    plannedGoldEnrichmentV3Text('full-text-usage-report.json', fullTextUsageReport),
    plannedGoldEnrichmentV3Text('comparison-against-prior-v1-v2.csv', comparisonCsv),
    plannedGoldEnrichmentV3Text('external-qa-overlay.csv', qaOverlayCsv),
    plannedGoldEnrichmentV3Text('taxonomy-v2-upgrade-overlay.csv', upgradeOverlayCsv),
    plannedGoldEnrichmentV3Text('physician-review-candidate-report.csv', reviewCandidatesCsv),
  ]
  await preflightGoldEnrichmentV3Artifacts(outputDirectory, plan)
  const artifacts: GoldEnrichmentV3ArtifactIdentity[] = []
  for (const artifact of plan) {
    artifacts.push(await publishGoldEnrichmentV3Artifact(outputDirectory, artifact))
  }
  const byPath = new Map(artifacts.map((artifact) => [artifact.path, artifact]))
  const mergedArtifact = byPath.get('gold-set-v1-enrichment-v3-merged.csv')
  const receiptArtifact = byPath.get('gold-set-v1-enrichment-v3-merged.receipt.json')
  if (!mergedArtifact || !receiptArtifact)
    throw new Error('Merge output publication was incomplete.')
  return { rows: mergedRows, artifacts, mergedArtifact, receiptArtifact }
}

export interface BuildGoldEnrichmentV3ReviewOptions {
  runDirectory: string
  mergeDirectory: string
  outputDirectory: string
  workspaceRoot?: string
}

export interface BuildGoldEnrichmentV3ReviewResult {
  cohorts: GoldEnrichmentV3ReviewWorkbookCohorts
  artifacts: GoldEnrichmentV3ArtifactIdentity[]
  workbookArtifact: GoldEnrichmentV3ArtifactIdentity
}

export const GOLD_ENRICHMENT_V3_REVIEW_CSV_COLUMNS = [
  'cohort',
  'master_row_id',
  'pmid',
  'title',
  'abstract',
  'journal',
  'publication_year',
  'physician_final_label',
  'physician_final_confidence',
  'metadata_sufficiency',
  'full_text_evidence_status',
  'full_text_filename',
  'full_text_sha256',
  'full_text_evidence',
  'qa_concerns',
  'upgrade_concerns',
  'review_reasons',
  'topic_ids',
  'technology_tags',
  'technology_tag_status',
  'clinical_purposes',
  'disease_tags',
  'disease_tag_status',
  'study_design',
  'publication_status',
  'enrichment_confidence',
  'requires_physician_enrichment_review',
  'evidence_summary',
  'enrichment_rationale',
  'physician_action',
  'physician_metadata_sufficiency',
  'physician_topic_ids',
  'physician_technology_tags',
  'physician_technology_tag_status',
  'physician_clinical_purposes',
  'physician_disease_tags',
  'physician_disease_tag_status',
  'physician_study_design',
  'physician_publication_status',
  'physician_enrichment_confidence',
  'physician_reviewed',
  'physician_notes',
] as const

function parseMergedRows(input: string): GoldEnrichmentV3MergedRow[] {
  const rows = exactCsvRecords(
    input,
    'Merged V3 enrichment',
    GOLD_ENRICHMENT_V3_MERGED_COLUMNS,
  ).map(({ csvRecordNumber, ...row }) => {
    void csvRecordNumber
    return row
  })
  assertGoldEnrichmentV3MergedCandidateRows(rows)
  return rows
}

export function assertGoldEnrichmentV3MergedCandidateRows(
  rows: readonly GoldEnrichmentV3MergedRow[],
) {
  if (
    rows.length !== 630 ||
    new Set(rows.map((row) => row.master_row_id)).size !== 630 ||
    new Set(rows.map((row) => row.pmid)).size !== 630
  ) {
    throw new Error('Merged V3 candidate must contain exactly 630 unique development identities.')
  }
  if (
    goldEnrichmentV3PhysicianFieldSha256(
      rows as unknown as readonly GoldEnrichmentV3CanonicalRow[],
    ) !== GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256
  ) {
    throw new Error('Merged V3 candidate changed the immutable physician-field projection.')
  }
  let included = 0
  let excluded = 0
  let fullTextUsed = 0
  rows.forEach((row) => {
    if (
      row.workflow_id !== GOLD_ENRICHMENT_V3_WORKFLOW_ID ||
      row.workflow_schema_version !== GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION ||
      row.prompt_template_version !== GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION ||
      row.result_schema_version !== GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION ||
      row.taxonomy_version !== GOLD_ENRICHMENT_V3_TAXONOMY_VERSION ||
      row.label_schema_version !== GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION ||
      row.enrichment_schema_version !== GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION ||
      row.source_sha256 !== GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_SHA256 ||
      row.source_receipt_sha256 !== GOLD_ENRICHMENT_V3_CANONICAL_RECEIPT_SHA256 ||
      row.physician_field_sha256 !== GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256 ||
      row.dataset_split !== 'development' ||
      row.batch_name !== 'gold-set-v1'
    ) {
      throw new Error(`Merged V3 version/source binding failed for PMID ${row.pmid}.`)
    }
    parseStrictBoolean(row.requires_physician_enrichment_review, 'merged review flag')
    parseStrictBoolean(row.external_qa_review_flag, 'merged external-QA flag')
    parseStrictBoolean(row.taxonomy_v2_upgrade_review_flag, 'merged upgrade flag')
    parseStrictBoolean(row.relevance_concern_review_flag, 'merged relevance-concern flag')
    if (
      row.physician_enrichment_reviewed !== 'false' ||
      row.physician_enrichment_accept_or_modify ||
      row.physician_enrichment_notes ||
      row.protocol_acceptance_authorized !== 'false' ||
      row.import_ready !== 'false' ||
      row.database_mutation_plan
    ) {
      throw new Error(`Merged V3 candidate has premature review/import state for PMID ${row.pmid}.`)
    }
    const fullText = parseStrictBoolean(row.full_text_used, 'merged full_text_used')
    const fromFullText = parseStrictBoolean(
      row.categorization_from_full_text,
      'merged categorization_from_full_text',
    )
    if (fullText !== fromFullText) {
      throw new Error(`Merged V3 full-text flags disagree for PMID ${row.pmid}.`)
    }
    if (fullText) {
      fullTextUsed += 1
      if (!row.full_text_filename || !SHA256.test(row.full_text_sha256)) {
        throw new Error(`Merged V3 full-text identity is incomplete for PMID ${row.pmid}.`)
      }
      if (row.enrichment_provenance !== 'full_text_ai_enrichment_pending_physician') {
        throw new Error(`Merged V3 full-text provenance is invalid for PMID ${row.pmid}.`)
      }
    } else if (
      row.full_text_filename ||
      row.full_text_sha256 ||
      row.enrichment_provenance !== 'unresolved_enrichment'
    ) {
      throw new Error(
        `Merged V3 metadata-only provenance/file state is invalid for PMID ${row.pmid}.`,
      )
    }
    if (!METADATA_SUFFICIENCY.has(row.metadata_sufficiency)) {
      throw new Error(`Merged V3 metadata sufficiency is invalid for PMID ${row.pmid}.`)
    }
    if (row.physician_final_label === 'exclude') {
      excluded += 1
      if (
        [
          row.topic_ids,
          row.technology_tags,
          row.technology_tag_status,
          row.clinical_purposes,
          row.disease_tags,
          row.disease_tag_status,
          row.study_design,
          row.publication_status,
          row.enrichment_confidence,
        ].some(Boolean) ||
        !CONFIDENCES.has(row.assessment_confidence) ||
        fullText
      ) {
        throw new Error(`Merged V3 exclusion contract failed for PMID ${row.pmid}.`)
      }
    } else {
      included += 1
      const topicIds = parsePipeList(row.topic_ids, 'merged topic_ids')
      literatureEnrichmentRecordV2Schema.parse({
        master_row_id: row.master_row_id,
        pmid: row.pmid,
        topic_ids: topicIds,
        technology_tags: parsePipeList(row.technology_tags, 'merged technology_tags'),
        technology_tag_status: row.technology_tag_status,
        clinical_purposes: parsePipeList(row.clinical_purposes, 'merged clinical_purposes'),
        disease_tags: parsePipeList(row.disease_tags, 'merged disease_tags'),
        disease_tag_status: row.disease_tag_status,
        study_design: row.study_design,
        publication_status: row.publication_status,
      })
      if (
        row.assessment_confidence ||
        !CONFIDENCES.has(row.enrichment_confidence) ||
        (FORBIDDEN_LVRS_PMIDS.has(row.pmid) &&
          topicIds.includes('bronchoscopic-lung-volume-reduction'))
      ) {
        throw new Error(`Merged V3 included enrichment contract failed for PMID ${row.pmid}.`)
      }
    }
  })
  if (included !== 358 || excluded !== 272 || fullTextUsed !== 50) {
    throw new Error(
      `Merged V3 counts are invalid: included=${included}, excluded=${excluded}, fullTextUsed=${fullTextUsed}.`,
    )
  }
}

function groupOverlayConcerns(
  input: string,
  label: string,
  formatter: (row: Record<string, string>) => string,
): Map<string, string> {
  const rows = parseFlexibleCsv(input, label)
  const grouped = new Map<string, string[]>()
  rows.forEach((row) => {
    if (!row.pmid) return
    grouped.set(row.pmid, [...(grouped.get(row.pmid) ?? []), formatter(row)])
  })
  return new Map(
    [...grouped].map(([pmid, concerns]) => [pmid, [...new Set(concerns)].join(' || ')]),
  )
}

function assertMergeReceiptOutputIdentity(
  mergeReceipt: Record<string, unknown>,
  key: string,
  expectedPath: string,
  file: { bytes: Uint8Array; sha256: string },
) {
  const outputs = mergeReceipt.outputs as Record<string, unknown> | undefined
  const identity = outputs?.[key] as Record<string, unknown> | undefined
  if (
    identity?.path !== expectedPath ||
    identity?.bytes !== file.bytes.byteLength ||
    identity?.sha256 !== file.sha256
  ) {
    throw new Error(`Merged V3 receipt does not checksum-bind ${expectedPath}.`)
  }
}

function reviewWorkbookRow(
  row: GoldEnrichmentV3MergedRow,
  candidate: Record<string, string>,
  cohort: string,
  qaConcerns: string,
  upgradeConcerns: string,
): GoldEnrichmentV3ReviewWorkbookRow {
  const evidence = [
    row.evidence_1_excerpt
      ? `${row.evidence_1_field}${row.evidence_1_location ? ` (${row.evidence_1_location})` : ''}: ${row.evidence_1_excerpt}`
      : '',
    row.evidence_2_excerpt
      ? `${row.evidence_2_field}${row.evidence_2_location ? ` (${row.evidence_2_location})` : ''}: ${row.evidence_2_excerpt}`
      : '',
  ]
    .filter(Boolean)
    .join(' || ')
  return {
    cohort,
    master_row_id: row.master_row_id,
    pmid: row.pmid,
    title: row.title,
    abstract: row.abstract,
    journal: row.journal,
    publication_year: row.publication_year,
    physician_final_label: row.physician_final_label,
    physician_final_confidence: row.physician_final_confidence,
    metadata_sufficiency: row.metadata_sufficiency,
    full_text_evidence_status: candidate.full_text_evidence_status,
    full_text_filename: row.full_text_filename || candidate.expected_full_text_filename,
    full_text_sha256: row.full_text_sha256 || candidate.full_text_file_sha256,
    full_text_evidence: [candidate.full_text_availability_note, evidence]
      .filter(Boolean)
      .join(' || '),
    qa_concerns: qaConcerns,
    upgrade_concerns: upgradeConcerns,
    review_reasons: candidate.review_reasons,
    topic_ids: row.topic_ids,
    technology_tags: row.technology_tags,
    technology_tag_status: row.technology_tag_status,
    clinical_purposes: row.clinical_purposes,
    disease_tags: row.disease_tags,
    disease_tag_status: row.disease_tag_status,
    study_design: row.study_design,
    publication_status: row.publication_status,
    enrichment_confidence: row.enrichment_confidence || row.assessment_confidence,
    requires_physician_enrichment_review: row.requires_physician_enrichment_review,
    evidence_summary: evidence,
    enrichment_rationale: row.enrichment_rationale,
    physician_action: '',
    physician_metadata_sufficiency: row.metadata_sufficiency,
    physician_topic_ids: row.topic_ids,
    physician_technology_tags: row.technology_tags,
    physician_technology_tag_status: row.technology_tag_status,
    physician_clinical_purposes: row.clinical_purposes,
    physician_disease_tags: row.disease_tags,
    physician_disease_tag_status: row.disease_tag_status,
    physician_study_design: row.study_design,
    physician_publication_status: row.publication_status,
    physician_enrichment_confidence: row.enrichment_confidence || row.assessment_confidence,
    physician_reviewed: 'false',
    physician_notes: '',
  }
}

function qcRank(row: GoldEnrichmentV3MergedRow): string {
  const cohort = row.physician_final_label === 'exclude' ? 'exclude' : 'include_core'
  return sha256Bytes(
    `gold-set-v1-enrichment-v3-qc-v1\u0000${cohort}\u0000${row.master_row_id}\u0000${row.pmid}`,
  )
}

function selectQcRows(
  rows: readonly GoldEnrichmentV3MergedRow[],
  requiredKeys: ReadonlySet<string>,
): GoldEnrichmentV3MergedRow[] {
  const eligible = rows.filter(
    (row) =>
      !requiredKeys.has(`${row.master_row_id}:${row.pmid}`) &&
      ['include_core', 'exclude'].includes(row.physician_final_label) &&
      row.relevance_concern_review_flag !== 'true' &&
      row.external_qa_review_flag !== 'true' &&
      row.taxonomy_v2_upgrade_review_flag !== 'true',
  )
  const ranked = (label: 'include_core' | 'exclude') =>
    eligible
      .filter((row) => row.physician_final_label === label)
      .sort(
        (left, right) =>
          qcRank(left).localeCompare(qcRank(right), 'en-US') ||
          Number(left.master_row_id) - Number(right.master_row_id),
      )
      .slice(0, 25)
  const core = ranked('include_core')
  const excluded = ranked('exclude')
  if (core.length !== 25 || excluded.length !== 25) {
    throw new Error(
      `Deterministic QC requires 25 eligible include_core and 25 exclude rows; received ${core.length}/${excluded.length}.`,
    )
  }
  return [...core, ...excluded]
}

export function buildGoldEnrichmentV3ReviewCohorts(options: {
  candidates: Array<Record<string, string>>
  mergedRows: GoldEnrichmentV3MergedRow[]
  qaConcerns: Map<string, string>
  upgradeConcerns: Map<string, string>
}): GoldEnrichmentV3ReviewWorkbookCohorts {
  const candidateByKey = new Map(
    options.candidates.map((row) => [`${row.master_row_id}:${row.pmid}`, row]),
  )
  if (candidateByKey.size !== 630 || options.mergedRows.length !== 630) {
    throw new Error('Review cohort construction requires exactly 630 candidate and merged rows.')
  }
  const requiredRows = options.mergedRows.filter(
    (row) => candidateByKey.get(`${row.master_row_id}:${row.pmid}`)?.required_review === 'true',
  )
  const requiredKeys = new Set(requiredRows.map((row) => `${row.master_row_id}:${row.pmid}`))
  const qcRows = selectQcRows(options.mergedRows, requiredKeys)
  const qcKeys = new Set(qcRows.map((row) => `${row.master_row_id}:${row.pmid}`))
  const protocolRows = options.mergedRows.filter((row) => {
    const key = `${row.master_row_id}:${row.pmid}`
    return !requiredKeys.has(key) && !qcKeys.has(key)
  })
  if (requiredRows.length + qcRows.length + protocolRows.length !== 630) {
    throw new Error('Review cohorts do not form a complete non-overlapping 630-row partition.')
  }
  const convert = (rows: readonly GoldEnrichmentV3MergedRow[], cohort: string) =>
    rows.map((row) => {
      const candidate = candidateByKey.get(`${row.master_row_id}:${row.pmid}`)
      if (!candidate) throw new Error(`Review candidate context is missing PMID ${row.pmid}.`)
      return reviewWorkbookRow(
        row,
        candidate,
        cohort,
        options.qaConcerns.get(row.pmid) ?? '',
        options.upgradeConcerns.get(row.pmid) ?? '',
      )
    })
  return {
    required_review: convert(requiredRows, 'Required Review'),
    qc_sample_50: convert(qcRows, 'QC Sample 50'),
    protocol_acceptance_candidates: convert(protocolRows, 'Protocol-Based Acceptance Candidates'),
  }
}

function reviewCsv(rows: readonly GoldEnrichmentV3ReviewWorkbookRow[]) {
  return serializeGoldEnrichmentV3Csv(GOLD_ENRICHMENT_V3_REVIEW_CSV_COLUMNS, rows)
}

function reviewMembershipSha256(rows: readonly GoldEnrichmentV3ReviewWorkbookRow[]) {
  return sha256Bytes(
    serializeGoldEnrichmentV3Json(rows.map((row) => [row.master_row_id, row.pmid])),
  )
}

export async function buildGoldEnrichmentV3Review(
  options: BuildGoldEnrichmentV3ReviewOptions,
): Promise<BuildGoldEnrichmentV3ReviewResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd())
  const runDirectory = path.resolve(options.runDirectory)
  const mergeDirectory = path.resolve(options.mergeDirectory)
  assertSafeDevelopmentPath(runDirectory, 'Run directory')
  assertSafeDevelopmentPath(mergeDirectory, 'Merge directory')
  const [mergedFile, mergeReceiptFile, candidateFile, qaOverlayFile, upgradeOverlayFile] =
    await Promise.all([
      readUtf8RegularFile(
        path.join(mergeDirectory, 'gold-set-v1-enrichment-v3-merged.csv'),
        'Merged V3 CSV',
      ),
      readUtf8RegularFile(
        path.join(mergeDirectory, 'gold-set-v1-enrichment-v3-merged.receipt.json'),
        'Merged V3 receipt',
      ),
      readUtf8RegularFile(
        path.join(mergeDirectory, 'physician-review-candidate-report.csv'),
        'Physician review candidate report',
      ),
      readUtf8RegularFile(
        path.join(mergeDirectory, 'external-qa-overlay.csv'),
        'External-QA overlay',
      ),
      readUtf8RegularFile(
        path.join(mergeDirectory, 'taxonomy-v2-upgrade-overlay.csv'),
        'Taxonomy-v2 upgrade overlay',
      ),
    ])
  const mergeReceipt = parseJsonObject(mergeReceiptFile.text, 'Merged V3 receipt')
  const mergedIdentity = mergeReceipt.merged as Record<string, unknown>
  if (
    !mergedIdentity ||
    mergedIdentity.sha256 !== mergedFile.sha256 ||
    mergeReceipt.physicianFieldSha256 !== GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256
  ) {
    throw new Error('Merged V3 CSV/receipt identity mismatch.')
  }
  assertMergeReceiptOutputIdentity(
    mergeReceipt,
    'physicianReviewCandidates',
    'physician-review-candidate-report.csv',
    candidateFile,
  )
  assertMergeReceiptOutputIdentity(
    mergeReceipt,
    'externalQaOverlay',
    'external-qa-overlay.csv',
    qaOverlayFile,
  )
  assertMergeReceiptOutputIdentity(
    mergeReceipt,
    'taxonomyV2UpgradeOverlay',
    'taxonomy-v2-upgrade-overlay.csv',
    upgradeOverlayFile,
  )
  const mergedRows = parseMergedRows(mergedFile.text)
  const candidates = exactCsvRecords(
    candidateFile.text,
    'Physician review candidate report',
    GOLD_ENRICHMENT_V3_REVIEW_CANDIDATE_COLUMNS,
  ).map(({ csvRecordNumber, ...row }) => {
    void csvRecordNumber
    return row
  })
  const qaConcerns = groupOverlayConcerns(
    qaOverlayFile.text,
    'External-QA overlay',
    (row) => `${row.severity}/${row.category}: ${row.issue} [${row.consistency_rerun_status}]`,
  )
  const upgradeConcerns = groupOverlayConcerns(
    upgradeOverlayFile.text,
    'Taxonomy-v2 upgrade overlay',
    (row) =>
      `${row.candidate_fields}: ${row.candidate_values || row.candidate_reason} [physician adjudication required]`,
  )
  const cohorts = buildGoldEnrichmentV3ReviewCohorts({
    candidates,
    mergedRows,
    qaConcerns,
    upgradeConcerns,
  })
  const controlledValues: GoldEnrichmentV3ReviewWorkbookMetadata['controlled_values'] = {
    metadata_sufficiency: [
      'adequate_abstract',
      'limited_abstract',
      'no_abstract',
      'conflicting_metadata',
    ],
    topic_ids: labelsV2.fields.topic_ids.map((value) => value.id),
    technology_tags: labelsV2.fields.technology_tags.map((value) => value.id),
    technology_tag_status: ['tagged', 'not_applicable', 'not_assessable'],
    clinical_purposes: labelsV2.fields.clinical_purposes.map((value) => value.id),
    disease_tags: labelsV2.fields.disease_tags.map((value) => value.id),
    disease_tag_status: ['tagged', 'not_applicable', 'not_assessable'],
    study_design: labelsV2.fields.study_design.map((value) => value.id),
    publication_status: labelsV2.fields.publication_status.map((value) => value.id),
    enrichment_confidence: ['high', 'moderate', 'low'],
    provenance: [
      'physician_confirmed_ai_enrichment',
      'physician_modified_ai_enrichment',
      'ai_generated_enrichment_qc_accepted',
      'legacy_v1_enrichment',
      'full_text_ai_enrichment_pending_physician',
      'unresolved_enrichment',
    ],
  }
  const metadata: GoldEnrichmentV3ReviewWorkbookMetadata = {
    workflow_id: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflow_schema_version: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    result_schema_version: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
    taxonomy_version: GOLD_ENRICHMENT_V3_TAXONOMY_VERSION,
    label_schema_version: GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION,
    enrichment_schema_version: GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
    source_sha256: String((mergeReceipt.source as Record<string, unknown>).sha256),
    merged_sha256: mergedFile.sha256,
    physician_field_sha256: GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256,
    required_review_count: cohorts.required_review.length,
    qc_sample_count: cohorts.qc_sample_50.length,
    acceptance_candidate_count: cohorts.protocol_acceptance_candidates.length,
    controlled_values: controlledValues,
  }
  const workbookBytes = await buildGoldEnrichmentV3ReviewWorkbookBytes(cohorts, metadata)
  const requiredCsv = reviewCsv(cohorts.required_review)
  const qcCsv = reviewCsv(cohorts.qc_sample_50)
  const protocolCsv = reviewCsv(cohorts.protocol_acceptance_candidates)
  const receipt = serializeGoldEnrichmentV3Json({
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    merged: { bytes: mergedFile.bytes.byteLength, sha256: mergedFile.sha256 },
    workbook: {
      path: 'gold-set-v1-enrichment-v3-physician-review.xlsx',
      bytes: workbookBytes.byteLength,
      sha256: sha256Bytes(workbookBytes),
      sheets: [
        'Instructions',
        'Required Review',
        'QC Sample 50',
        'Protocol Acceptance Candidates',
        'Lookups',
      ],
    },
    cohorts: {
      requiredReview: {
        rows: cohorts.required_review.length,
        membershipSha256: reviewMembershipSha256(cohorts.required_review),
        csvTemplate: {
          path: 'required-review.csv',
          bytes: Buffer.byteLength(requiredCsv),
          sha256: sha256Bytes(requiredCsv),
        },
      },
      qcSample50: {
        rows: cohorts.qc_sample_50.length,
        includeCore: cohorts.qc_sample_50.filter(
          (row) => row.physician_final_label === 'include_core',
        ).length,
        exclude: cohorts.qc_sample_50.filter((row) => row.physician_final_label === 'exclude')
          .length,
        ranking: 'sha256:gold-set-v1-enrichment-v3-qc-v1',
        membershipSha256: reviewMembershipSha256(cohorts.qc_sample_50),
        csvTemplate: {
          path: 'qc-sample-50.csv',
          bytes: Buffer.byteLength(qcCsv),
          sha256: sha256Bytes(qcCsv),
        },
      },
      protocolAcceptanceCandidates: {
        rows: cohorts.protocol_acceptance_candidates.length,
        membershipSha256: reviewMembershipSha256(cohorts.protocol_acceptance_candidates),
        csvTemplate: {
          path: 'protocol-acceptance-candidates.csv',
          bytes: Buffer.byteLength(protocolCsv),
          sha256: sha256Bytes(protocolCsv),
        },
        individuallyPhysicianConfirmed: false,
        authorizationRequiredAfterQc: true,
        provenanceIfAuthorized: 'ai_generated_enrichment_qc_accepted',
      },
    },
    safety: {
      cohortsOverlap: false,
      importRowsCreated: 0,
      databaseWrites: 0,
      physicianRelevanceEditable: false,
      unreviewedPhysicianConfirmedProvenance: 0,
      importOccursFromWorkbook: false,
    },
  })
  const outputDirectory = await assertGoldEnrichmentV3SafeOutputDirectory(
    path.resolve(options.outputDirectory),
    workspaceRoot,
  )
  const plan = [
    {
      path: 'gold-set-v1-enrichment-v3-physician-review.xlsx',
      bytes: workbookBytes,
    },
    plannedGoldEnrichmentV3Text('required-review.csv', requiredCsv),
    plannedGoldEnrichmentV3Text('qc-sample-50.csv', qcCsv),
    plannedGoldEnrichmentV3Text('protocol-acceptance-candidates.csv', protocolCsv),
    plannedGoldEnrichmentV3Text('review-cohorts.receipt.json', receipt),
  ]
  await preflightGoldEnrichmentV3Artifacts(outputDirectory, plan)
  const artifacts: GoldEnrichmentV3ArtifactIdentity[] = []
  for (const artifact of plan) {
    artifacts.push(await publishGoldEnrichmentV3Artifact(outputDirectory, artifact))
  }
  const workbookArtifact = artifacts.find((artifact) => artifact.path.endsWith('.xlsx'))
  if (!workbookArtifact) throw new Error('Review workbook publication was incomplete.')
  return { cohorts, artifacts, workbookArtifact }
}

export interface AuditGoldEnrichmentV3ReadinessOptions {
  mergeDirectory: string
  reviewDirectory: string
  outputDirectory: string
  requiredReviewPath?: string
  qcReviewPath?: string
  protocolAuthorizationPath?: string
  workspaceRoot?: string
}

export interface AuditGoldEnrichmentV3ReadinessResult {
  report: Record<string, unknown>
  artifact: GoldEnrichmentV3ArtifactIdentity
}

interface ReviewDecisionAudit {
  complete: boolean
  action: string
  modified: boolean
  provenance: string
  issues: Array<{ field: string; issue: string }>
}

const REVIEW_BOUND_COLUMNS = GOLD_ENRICHMENT_V3_REVIEW_CSV_COLUMNS.slice(
  0,
  GOLD_ENRICHMENT_V3_REVIEW_CSV_COLUMNS.indexOf('physician_action'),
) as readonly (keyof GoldEnrichmentV3ReviewWorkbookRow)[]

function validateReviewDecision(
  review: GoldEnrichmentV3ReviewWorkbookRow,
  merged: GoldEnrichmentV3MergedRow,
  expected: GoldEnrichmentV3ReviewWorkbookRow,
): ReviewDecisionAudit {
  const issues: Array<{ field: string; issue: string }> = []
  REVIEW_BOUND_COLUMNS.forEach((field) => {
    if (review[field] !== expected[field]) {
      issues.push({
        field,
        issue: 'fixed source/proposal value changed from the V3 review template',
      })
    }
  })
  const action = review.physician_action.trim().toLocaleLowerCase('en-US')
  const reviewed = review.physician_reviewed.trim().toLocaleLowerCase('en-US') === 'true'
  if (!['accept', 'modify'].includes(action)) {
    issues.push({ field: 'physician_action', issue: 'must be accept or modify' })
  }
  if (!reviewed) issues.push({ field: 'physician_reviewed', issue: 'must equal true' })
  if (action === 'modify' && !review.physician_notes.trim()) {
    issues.push({ field: 'physician_notes', issue: 'notes are required when modified' })
  }
  if (!METADATA_SUFFICIENCY.has(review.physician_metadata_sufficiency)) {
    issues.push({
      field: 'physician_metadata_sufficiency',
      issue: 'unsupported controlled value',
    })
  }
  const reviewPipeList = (value: string, field: string) => {
    try {
      return parsePipeList(value, field)
    } catch (error: unknown) {
      issues.push({ field, issue: error instanceof Error ? error.message : String(error) })
      return []
    }
  }
  const physicianProjection = {
    master_row_id: review.master_row_id,
    pmid: review.pmid,
    topic_ids: reviewPipeList(review.physician_topic_ids, 'physician_topic_ids'),
    technology_tags: reviewPipeList(review.physician_technology_tags, 'physician_technology_tags'),
    technology_tag_status: review.physician_technology_tag_status,
    clinical_purposes: reviewPipeList(
      review.physician_clinical_purposes,
      'physician_clinical_purposes',
    ),
    disease_tags: reviewPipeList(review.physician_disease_tags, 'physician_disease_tags'),
    disease_tag_status: review.physician_disease_tag_status,
    study_design: review.physician_study_design,
    publication_status: review.physician_publication_status,
  }
  if (
    FORBIDDEN_LVRS_PMIDS.has(review.pmid) &&
    physicianProjection.topic_ids.includes('bronchoscopic-lung-volume-reduction')
  ) {
    issues.push({
      field: 'physician_topic_ids',
      issue: 'checksum-bound LVRS false-positive taxonomy is forbidden for this PMID',
    })
  }
  if (merged.physician_final_label === 'exclude') {
    if (
      physicianProjection.topic_ids.length > 0 ||
      physicianProjection.technology_tags.length > 0 ||
      physicianProjection.clinical_purposes.length > 0 ||
      physicianProjection.disease_tags.length > 0 ||
      physicianProjection.technology_tag_status ||
      physicianProjection.disease_tag_status ||
      physicianProjection.study_design ||
      physicianProjection.publication_status
    ) {
      issues.push({ field: 'excluded_taxonomy', issue: 'taxonomy is forbidden on exclusions' })
    }
  } else {
    try {
      literatureEnrichmentRecordV2Schema.parse(physicianProjection)
    } catch (error: unknown) {
      issues.push({
        field: 'physician_enrichment',
        issue: error instanceof Error ? error.message : String(error),
      })
    }
  }
  if (!CONFIDENCES.has(review.physician_enrichment_confidence)) {
    issues.push({ field: 'physician_enrichment_confidence', issue: 'unsupported confidence' })
  }
  const proposalValues = [
    review.metadata_sufficiency,
    review.topic_ids,
    review.technology_tags,
    review.technology_tag_status,
    review.clinical_purposes,
    review.disease_tags,
    review.disease_tag_status,
    review.study_design,
    review.publication_status,
    review.enrichment_confidence,
  ]
  const physicianValues = [
    review.physician_metadata_sufficiency,
    review.physician_topic_ids,
    review.physician_technology_tags,
    review.physician_technology_tag_status,
    review.physician_clinical_purposes,
    review.physician_disease_tags,
    review.physician_disease_tag_status,
    review.physician_study_design,
    review.physician_publication_status,
    review.physician_enrichment_confidence,
  ]
  const modified = proposalValues.some((value, index) => value !== physicianValues[index])
  if (action === 'accept' && modified) {
    issues.push({ field: 'physician_action', issue: 'accept cannot change proposal fields' })
  }
  if (action === 'modify' && !modified) {
    issues.push({ field: 'physician_action', issue: 'modify must change at least one field' })
  }
  const complete = issues.length === 0
  return {
    complete,
    action,
    modified,
    provenance: complete
      ? modified
        ? 'physician_modified_ai_enrichment'
        : 'physician_confirmed_ai_enrichment'
      : merged.full_text_used === 'true'
        ? 'full_text_ai_enrichment_pending_physician'
        : 'unresolved_enrichment',
    issues,
  }
}

function parseReviewRows(input: string, label: string): GoldEnrichmentV3ReviewWorkbookRow[] {
  return exactCsvRecords(input, label, GOLD_ENRICHMENT_V3_REVIEW_CSV_COLUMNS).map(
    ({ csvRecordNumber, ...row }) => {
      void csvRecordNumber
      return row
    },
  )
}

function countStrings(values: Iterable<string>) {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return Object.fromEntries(
    [...counts].sort(([left], [right]) => left.localeCompare(right, 'en-US')),
  )
}

export async function auditGoldEnrichmentV3Readiness(
  options: AuditGoldEnrichmentV3ReadinessOptions,
): Promise<AuditGoldEnrichmentV3ReadinessResult> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd())
  const mergeDirectory = path.resolve(options.mergeDirectory)
  const reviewDirectory = path.resolve(options.reviewDirectory)
  assertSafeDevelopmentPath(mergeDirectory, 'Merge directory')
  assertSafeDevelopmentPath(reviewDirectory, 'Review directory')
  const requiredReviewPath = path.resolve(
    options.requiredReviewPath ?? path.join(reviewDirectory, 'required-review.csv'),
  )
  const qcReviewPath = path.resolve(
    options.qcReviewPath ?? path.join(reviewDirectory, 'qc-sample-50.csv'),
  )
  assertSafeDevelopmentPath(requiredReviewPath, 'Required-review decisions')
  assertSafeDevelopmentPath(qcReviewPath, 'QC decisions')
  const [
    mergedFile,
    mergeReceiptFile,
    reviewReceiptFile,
    candidateFile,
    requiredFile,
    qcFile,
    qaOverlayFile,
    upgradeOverlayFile,
    fullTextUsageFile,
  ] = await Promise.all([
    readUtf8RegularFile(
      path.join(mergeDirectory, 'gold-set-v1-enrichment-v3-merged.csv'),
      'Merged V3 CSV',
    ),
    readUtf8RegularFile(
      path.join(mergeDirectory, 'gold-set-v1-enrichment-v3-merged.receipt.json'),
      'Merged V3 receipt',
    ),
    readUtf8RegularFile(
      path.join(reviewDirectory, 'review-cohorts.receipt.json'),
      'Review cohort receipt',
    ),
    readUtf8RegularFile(
      path.join(mergeDirectory, 'physician-review-candidate-report.csv'),
      'Physician review candidate report',
    ),
    readUtf8RegularFile(requiredReviewPath, 'Required-review decisions'),
    readUtf8RegularFile(qcReviewPath, 'QC decisions'),
    readUtf8RegularFile(
      path.join(mergeDirectory, 'external-qa-overlay.csv'),
      'External-QA overlay',
    ),
    readUtf8RegularFile(
      path.join(mergeDirectory, 'taxonomy-v2-upgrade-overlay.csv'),
      'Taxonomy-v2 upgrade overlay',
    ),
    readUtf8RegularFile(
      path.join(mergeDirectory, 'full-text-usage-report.json'),
      'Full-text usage report',
    ),
  ])
  const mergedRows = parseMergedRows(mergedFile.text)
  if (
    mergedRows.length !== 630 ||
    new Set(mergedRows.map((row) => row.master_row_id)).size !== 630 ||
    new Set(mergedRows.map((row) => row.pmid)).size !== 630
  ) {
    throw new Error('Readiness requires the exact 630-row merged development artifact.')
  }
  const mergedByKey = new Map(mergedRows.map((row) => [`${row.master_row_id}:${row.pmid}`, row]))
  const mergeReceipt = parseJsonObject(mergeReceiptFile.text, 'Merged V3 receipt')
  const mergedIdentity = mergeReceipt.merged as Record<string, unknown> | undefined
  if (
    mergeReceipt.workflowId !== GOLD_ENRICHMENT_V3_WORKFLOW_ID ||
    mergeReceipt.workflowSchemaVersion !== GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION ||
    mergeReceipt.resultSchemaVersion !== GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION ||
    mergeReceipt.physicianFieldSha256 !== GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256 ||
    mergedIdentity?.sha256 !== mergedFile.sha256 ||
    mergedIdentity?.bytes !== mergedFile.bytes.byteLength
  ) {
    throw new Error('Readiness merged artifact/receipt identity mismatch.')
  }
  assertMergeReceiptOutputIdentity(
    mergeReceipt,
    'physicianReviewCandidates',
    'physician-review-candidate-report.csv',
    candidateFile,
  )
  assertMergeReceiptOutputIdentity(
    mergeReceipt,
    'externalQaOverlay',
    'external-qa-overlay.csv',
    qaOverlayFile,
  )
  assertMergeReceiptOutputIdentity(
    mergeReceipt,
    'taxonomyV2UpgradeOverlay',
    'taxonomy-v2-upgrade-overlay.csv',
    upgradeOverlayFile,
  )
  assertMergeReceiptOutputIdentity(
    mergeReceipt,
    'fullTextUsage',
    'full-text-usage-report.json',
    fullTextUsageFile,
  )
  const reviewReceipt = parseJsonObject(reviewReceiptFile.text, 'Review cohort receipt')
  const reviewMerged = reviewReceipt.merged as Record<string, unknown> | undefined
  const reviewCohorts = reviewReceipt.cohorts as Record<string, unknown> | undefined
  const requiredContract = reviewCohorts?.requiredReview as Record<string, unknown> | undefined
  const qcContract = reviewCohorts?.qcSample50 as Record<string, unknown> | undefined
  const protocolContract = reviewCohorts?.protocolAcceptanceCandidates as
    | Record<string, unknown>
    | undefined
  if (
    reviewReceipt.workflowId !== GOLD_ENRICHMENT_V3_WORKFLOW_ID ||
    reviewReceipt.workflowSchemaVersion !== GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION ||
    reviewMerged?.sha256 !== mergedFile.sha256 ||
    reviewMerged?.bytes !== mergedFile.bytes.byteLength ||
    typeof requiredContract?.rows !== 'number' ||
    typeof requiredContract.membershipSha256 !== 'string' ||
    qcContract?.rows !== 50 ||
    qcContract?.includeCore !== 25 ||
    qcContract?.exclude !== 25 ||
    typeof qcContract.membershipSha256 !== 'string' ||
    typeof protocolContract?.rows !== 'number' ||
    typeof protocolContract.membershipSha256 !== 'string' ||
    Number(requiredContract.rows) + Number(qcContract.rows) + Number(protocolContract.rows) !== 630
  ) {
    throw new Error('Review cohort receipt does not bind a complete deterministic partition.')
  }
  const requiredReviews = parseReviewRows(requiredFile.text, 'Required-review decisions')
  const qcReviews = parseReviewRows(qcFile.text, 'QC decisions')
  const candidates = exactCsvRecords(
    candidateFile.text,
    'Physician review candidate report',
    GOLD_ENRICHMENT_V3_REVIEW_CANDIDATE_COLUMNS,
  ).map(({ csvRecordNumber, ...row }) => {
    void csvRecordNumber
    return row
  })
  const candidateByKey = new Map(candidates.map((row) => [`${row.master_row_id}:${row.pmid}`, row]))
  if (candidates.length !== 630 || candidateByKey.size !== 630) {
    throw new Error('Readiness requires 630 unique physician-review candidate rows.')
  }
  const qaOverlay = parseFlexibleCsv(qaOverlayFile.text, 'External-QA overlay')
  const upgradeOverlay = parseFlexibleCsv(upgradeOverlayFile.text, 'Taxonomy-v2 upgrade overlay')
  const qaConcerns = groupOverlayConcerns(
    qaOverlayFile.text,
    'External-QA overlay',
    (row) => `${row.severity}/${row.category}: ${row.issue} [${row.consistency_rerun_status}]`,
  )
  const upgradeConcerns = groupOverlayConcerns(
    upgradeOverlayFile.text,
    'Taxonomy-v2 upgrade overlay',
    (row) =>
      `${row.candidate_fields}: ${row.candidate_values || row.candidate_reason} [physician adjudication required]`,
  )
  const reconstructedCohorts = buildGoldEnrichmentV3ReviewCohorts({
    candidates,
    mergedRows,
    qaConcerns,
    upgradeConcerns,
  })
  const assertReconstructedCohort = (
    contract: Record<string, unknown>,
    rows: readonly GoldEnrichmentV3ReviewWorkbookRow[],
    expectedPath: string,
  ) => {
    const csv = reviewCsv(rows)
    const template = contract.csvTemplate as Record<string, unknown> | undefined
    if (
      contract.rows !== rows.length ||
      contract.membershipSha256 !== reviewMembershipSha256(rows) ||
      template?.path !== expectedPath ||
      template?.bytes !== Buffer.byteLength(csv) ||
      template?.sha256 !== sha256Bytes(csv)
    ) {
      throw new Error(`Review cohort receipt disagrees with reconstructed ${expectedPath}.`)
    }
  }
  assertReconstructedCohort(
    requiredContract,
    reconstructedCohorts.required_review,
    'required-review.csv',
  )
  assertReconstructedCohort(qcContract, reconstructedCohorts.qc_sample_50, 'qc-sample-50.csv')
  assertReconstructedCohort(
    protocolContract,
    reconstructedCohorts.protocol_acceptance_candidates,
    'protocol-acceptance-candidates.csv',
  )
  if (
    reconstructedCohorts.qc_sample_50.filter((row) => row.physician_final_label === 'include_core')
      .length !== 25 ||
    reconstructedCohorts.qc_sample_50.filter((row) => row.physician_final_label === 'exclude')
      .length !== 25
  ) {
    throw new Error('Reconstructed QC cohort lost the exact 25-core/25-exclude contract.')
  }
  const cohortBinding = (
    rows: readonly GoldEnrichmentV3ReviewWorkbookRow[],
    contract: Record<string, unknown>,
    expectedCohort: string,
  ) => {
    const keys = rows.map((row) => `${row.master_row_id}:${row.pmid}`)
    return {
      expectedRows: Number(contract.rows),
      receivedRows: rows.length,
      countMatches: rows.length === contract.rows,
      membershipMatches: reviewMembershipSha256(rows) === contract.membershipSha256,
      uniqueIdentities: new Set(keys).size === rows.length,
      cohortLabelsMatch: rows.every((row) => row.cohort === expectedCohort),
    }
  }
  const requiredBinding = cohortBinding(requiredReviews, requiredContract, 'Required Review')
  const qcBinding = cohortBinding(qcReviews, qcContract, 'QC Sample 50')
  const requiredKeys = new Set(requiredReviews.map((row) => `${row.master_row_id}:${row.pmid}`))
  const submittedCohortsDisjoint = qcReviews.every(
    (row) => !requiredKeys.has(`${row.master_row_id}:${row.pmid}`),
  )
  const requiredMembershipValid = Object.values(requiredBinding).every(
    (value) => value === true || typeof value === 'number',
  )
  const qcMembershipValid =
    Object.values(qcBinding).every((value) => value === true || typeof value === 'number') &&
    submittedCohortsDisjoint
  const auditCohort = (
    reviews: readonly GoldEnrichmentV3ReviewWorkbookRow[],
    expectedCohort: string,
  ) =>
    reviews.map((review) => {
      const merged = mergedByKey.get(`${review.master_row_id}:${review.pmid}`)
      const candidate = candidateByKey.get(`${review.master_row_id}:${review.pmid}`)
      if (!merged || !candidate) {
        return {
          review,
          audit: {
            complete: false,
            action: '',
            modified: false,
            provenance: 'unresolved_enrichment',
            issues: [{ field: 'identity', issue: 'row is absent from merged V3 artifact' }],
          } satisfies ReviewDecisionAudit,
        }
      }
      const expected = reviewWorkbookRow(
        merged,
        candidate,
        expectedCohort,
        qaConcerns.get(review.pmid) ?? '',
        upgradeConcerns.get(review.pmid) ?? '',
      )
      return { review, audit: validateReviewDecision(review, merged, expected) }
    })
  const requiredAudits = auditCohort(requiredReviews, 'Required Review')
  const qcAudits = auditCohort(qcReviews, 'QC Sample 50')
  const allAudits = [...requiredAudits, ...qcAudits]
  const requiredAuditByPmid = new Map(
    requiredAudits.map((entry) => [entry.review.pmid, entry.audit]),
  )
  const directQaFindings = qaOverlay.filter((row) => row.review_tier === 'direct_targeted')
  const directQaTargetPmids = [...new Set(directQaFindings.map((row) => row.pmid).filter(Boolean))]
  const directQaFindingAdjudications = directQaFindings.map((row) =>
    requiredAuditByPmid.get(row.pmid),
  )
  const directQaTargetAdjudications = directQaTargetPmids.map((pmid) =>
    requiredAuditByPmid.get(pmid),
  )
  const upgradeAdjudications = upgradeOverlay.map((row) => requiredAuditByPmid.get(row.pmid))
  const ruleQaFindings = qaOverlay.filter((row) => row.review_tier === 'rule_based_consistency')
  const globalQaFindings = qaOverlay.filter((row) => row.review_tier === 'global_data_quality')
  if (
    qaOverlay.length !== 166 ||
    directQaFindings.length !== 54 ||
    directQaTargetPmids.length !== 44 ||
    ruleQaFindings.length !== 104 ||
    ruleQaFindings.some((row) => row.rule_rerun_evaluable !== 'true') ||
    globalQaFindings.length !== 8 ||
    upgradeOverlay.length !== 133 ||
    new Set(upgradeOverlay.map((row) => row.pmid)).size !== 133 ||
    upgradeOverlay.some(
      (row) =>
        row.physician_adjudication_required !== 'true' ||
        row.remains_review_eligible !== 'true' ||
        row.candidate_applied_automatically !== 'false',
    )
  ) {
    throw new Error('Readiness overlays do not match the checksum-bound QA/upgrade contract.')
  }
  const qaIndependentAssessment = {
    independentlyAddressed: qaOverlay.filter((row) => row.v3_independently_addressed === 'true')
      .length,
    concernRemainsOpen: qaOverlay.filter((row) => row.concern_remains_open === 'true').length,
    directTargeted: {
      findings: directQaFindings.length,
      targets: directQaTargetPmids.length,
      independentlyAddressed: directQaFindings.filter(
        (row) => row.v3_independently_addressed === 'true',
      ).length,
      concernRemainsOpen: directQaFindings.filter((row) => row.concern_remains_open === 'true')
        .length,
    },
    ruleBased: {
      findings: ruleQaFindings.length,
      rerunEvaluable: ruleQaFindings.filter((row) => row.rule_rerun_evaluable === 'true').length,
    },
    global: { findings: globalQaFindings.length },
  }
  const directQaFinalAdjudication = {
    resolutionCriterion:
      'valid_completed_required_review; suggested-value acceptance is not required',
    findings: {
      total: directQaFindings.length,
      resolved: directQaFindingAdjudications.filter((audit) => audit?.complete).length,
      open: directQaFindingAdjudications.filter((audit) => !audit?.complete).length,
    },
    targets: {
      total: directQaTargetPmids.length,
      resolved: directQaTargetAdjudications.filter((audit) => audit?.complete).length,
      open: directQaTargetAdjudications.filter((audit) => !audit?.complete).length,
    },
  }
  const upgradeFinalAdjudication = {
    candidates: upgradeOverlay.length,
    resolved: upgradeAdjudications.filter((audit) => audit?.complete).length,
    open: upgradeAdjudications.filter((audit) => !audit?.complete).length,
    resolutionCriterion:
      'valid_completed_required_review; candidate-value acceptance is not required',
  }
  const upgradeIndependentSelection = {
    selected: upgradeOverlay.filter((row) => row.v3_selected_candidate_independently === 'true')
      .length,
    notSelected: upgradeOverlay.filter((row) => row.v3_selected_candidate_independently === 'false')
      .length,
    notMachineAssessable: upgradeOverlay.filter(
      (row) => row.v3_selected_candidate_independently === 'not_machine_assessable',
    ).length,
  }
  const errorCountByField = countStrings(
    allAudits.flatMap((entry) => entry.audit.issues.map((issue) => issue.field)),
  )
  const errorRateByField = Object.fromEntries(
    Object.entries(errorCountByField).map(([field, errors]) => [
      field,
      {
        errors,
        reviewedRows: allAudits.length,
        rate: allAudits.length === 0 ? null : errors / allAudits.length,
      },
    ]),
  )
  const qcCompleted = qcAudits.filter((entry) => entry.audit.complete)
  const qcModifications = qcCompleted.filter((entry) => entry.audit.modified).length
  const relevanceConcernReviews = requiredAudits.filter((entry) =>
    RELEVANCE_CONCERNS.has(entry.review.pmid),
  )
  const relevanceConcernsDocumented =
    relevanceConcernReviews.every(
      (entry) => entry.audit.complete && Boolean(entry.review.physician_notes.trim()),
    ) && relevanceConcernReviews.length === RELEVANCE_CONCERNS.size

  let protocolAuthorization = {
    provided: false,
    authorized: false,
    valid: false,
    authorizedAfterQc: false,
    decisionArtifactsBound: false,
    authorizedBy: '',
    authorizationNote: '',
  }
  if (options.protocolAuthorizationPath) {
    const authorizationPath = path.resolve(options.protocolAuthorizationPath)
    assertSafeDevelopmentPath(authorizationPath, 'Protocol authorization')
    const file = await readUtf8RegularFile(authorizationPath, 'Protocol authorization')
    const parsed = parseJsonObject(file.text, 'Protocol authorization')
    const authorized = parsed.authorized === true
    const authorizedBy = typeof parsed.authorized_by === 'string' ? parsed.authorized_by.trim() : ''
    const authorizationNote =
      typeof parsed.authorization_note === 'string' ? parsed.authorization_note.trim() : ''
    const authorizedAfterQc = parsed.authorized_after_qc === true
    const decisionArtifactsBound =
      parsed.review_cohorts_receipt_sha256 === reviewReceiptFile.sha256 &&
      parsed.required_review_sha256 === requiredFile.sha256 &&
      parsed.qc_review_sha256 === qcFile.sha256 &&
      parsed.protocol_candidate_membership_sha256 === protocolContract.membershipSha256
    protocolAuthorization = {
      provided: true,
      authorized,
      valid:
        parsed.workflow_id === GOLD_ENRICHMENT_V3_WORKFLOW_ID &&
        parsed.merged_sha256 === mergedFile.sha256 &&
        authorized &&
        authorizedAfterQc &&
        decisionArtifactsBound &&
        Boolean(authorizedBy) &&
        Boolean(authorizationNote),
      authorizedAfterQc,
      decisionArtifactsBound,
      authorizedBy,
      authorizationNote,
    }
  }

  const fullTextUsage = parseJsonObject(fullTextUsageFile.text, 'Full-text usage report')
  const protocolRows = Number(protocolContract.rows)
  const requiredComplete =
    requiredMembershipValid && requiredAudits.every((entry) => entry.audit.complete)
  const qcComplete =
    qcMembershipValid && qcAudits.length === 50 && qcAudits.every((entry) => entry.audit.complete)
  const controlledValueValidationPassed = allAudits.every(
    (entry) =>
      !entry.audit.issues.some((issue) =>
        /controlled|taxonomy|confidence|enrichment/iu.test(`${issue.field} ${issue.issue}`),
      ),
  )
  const directQaFinalAdjudicationComplete =
    directQaFinalAdjudication.findings.total === 54 &&
    directQaFinalAdjudication.findings.open === 0 &&
    directQaFinalAdjudication.targets.total === 44 &&
    directQaFinalAdjudication.targets.open === 0
  const taxonomyUpgradeFinalAdjudicationComplete =
    upgradeFinalAdjudication.candidates === 133 && upgradeFinalAdjudication.open === 0
  const explicitGates = {
    packetCoverageComplete:
      (mergeReceipt.packetValidation as Record<string, unknown>)?.complete === true,
    resultValidationPassed:
      (mergeReceipt.packetValidation as Record<string, unknown>)?.valid === true,
    requiredReviewComplete: requiredComplete,
    qcReviewComplete: qcComplete,
    controlledValueValidationPassed,
    relevanceConcernsResolvedOrDocumented: relevanceConcernsDocumented,
    directQaFinalAdjudicationComplete,
    taxonomyUpgradeFinalAdjudicationComplete,
    protocolAcceptanceAuthorized:
      protocolRows === 0 || (protocolAuthorization.authorized && protocolAuthorization.valid),
  }
  const importReadiness = Object.values(explicitGates).every(Boolean)
  const reviewedProvenance = allAudits.map((entry) => entry.audit.provenance)
  const protocolProvenance = Array.from({ length: Math.max(0, protocolRows) }, () =>
    importReadiness ? 'ai_generated_enrichment_qc_accepted' : 'unresolved_enrichment',
  )
  const report = {
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    resultSchemaVersion: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
    merged: {
      bytes: mergedFile.bytes.byteLength,
      sha256: mergedFile.sha256,
      rows: mergedRows.length,
    },
    packetCoverage: mergeReceipt.packetValidation,
    resultValidation: mergeReceipt.packetValidation,
    requiredReview: {
      rows: requiredAudits.length,
      completeRows: requiredAudits.filter((entry) => entry.audit.complete).length,
      complete: requiredComplete,
      membership: requiredBinding,
    },
    qc: {
      rows: qcAudits.length,
      completeRows: qcCompleted.length,
      complete: qcComplete,
      modifications: qcModifications,
      modificationRate: qcCompleted.length === 0 ? null : qcModifications / qcCompleted.length,
      membership: qcBinding,
      disjointFromRequired: submittedCohortsDisjoint,
    },
    errorCountByField,
    errorRateByField,
    protocolAcceptance: { candidateRows: protocolRows, ...protocolAuthorization },
    optionalTagStatusDistribution: {
      technology: countStrings(mergedRows.map((row) => row.technology_tag_status || 'blank')),
      disease: countStrings(mergedRows.map((row) => row.disease_tag_status || 'blank')),
    },
    taxonomyCoverage: {
      includedRows: mergedRows.filter((row) => row.physician_final_label !== 'exclude').length,
      includedWithTopic: mergedRows.filter(
        (row) => row.physician_final_label !== 'exclude' && Boolean(row.topic_ids),
      ).length,
      includedWithClinicalPurpose: mergedRows.filter(
        (row) => row.physician_final_label !== 'exclude' && Boolean(row.clinical_purposes),
      ).length,
      excludedWithTaxonomy: mergedRows.filter(
        (row) =>
          row.physician_final_label === 'exclude' &&
          Boolean(
            row.topic_ids ||
            row.technology_tags ||
            row.clinical_purposes ||
            row.disease_tags ||
            row.study_design ||
            row.publication_status,
          ),
      ).length,
    },
    metadataSufficiencyDistribution: countStrings(
      mergedRows.map((row) => row.metadata_sufficiency),
    ),
    fullTextUsage: {
      used: mergedRows.filter((row) => row.full_text_used === 'true').length,
      previewOrMissingUsed: Number(fullTextUsage.previewOrMissingUsed),
      registryRows: Number(fullTextUsage.registryRows),
      matchedComplete: Number(fullTextUsage.matchedComplete),
      previewOnly: Number(fullTextUsage.previewOnly),
      missing: Number(fullTextUsage.missing),
    },
    externalQa: {
      findings: qaOverlay.length,
      directTargetFindings: directQaFindings.length,
      directTargetPmids: directQaTargetPmids.length,
      resolved: directQaFinalAdjudication.targets.resolved,
      open: directQaFinalAdjudication.targets.open,
      preReviewIndependentAssessment: qaIndependentAssessment,
      finalPhysicianAdjudication: {
        ...directQaFinalAdjudication,
        complete: directQaFinalAdjudicationComplete,
      },
    },
    taxonomyUpgradeCandidates: {
      candidates: upgradeOverlay.length,
      resolved: upgradeFinalAdjudication.resolved,
      open: upgradeFinalAdjudication.open,
      independentSelection: upgradeIndependentSelection,
      finalPhysicianAdjudication: {
        ...upgradeFinalAdjudication,
        complete: taxonomyUpgradeFinalAdjudicationComplete,
      },
    },
    relevanceConcerns: {
      pmids: [...RELEVANCE_CONCERNS].sort(),
      reviewed: relevanceConcernReviews.filter((entry) => entry.audit.complete).length,
      documented: relevanceConcernReviews.filter((entry) => entry.review.physician_notes.trim())
        .length,
      gatePassed: relevanceConcernsDocumented,
    },
    provenanceDistribution: countStrings([...reviewedProvenance, ...protocolProvenance]),
    physicianFieldSha256: GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256,
    zeroTestAccess: true,
    databaseMutationPlan: null,
    importRowsCreated: 0,
    explicitGates,
    importReadiness,
    safety: {
      databaseWrites: 0,
      importRowsCreated: 0,
      heldOutTestAccessed: false,
      modelCalls: 0,
      networkRequests: 0,
    },
  }
  const outputDirectory = await assertGoldEnrichmentV3SafeOutputDirectory(
    path.resolve(options.outputDirectory),
    workspaceRoot,
  )
  const plan = [
    plannedGoldEnrichmentV3Text('readiness-audit.json', serializeGoldEnrichmentV3Json(report)),
  ]
  await preflightGoldEnrichmentV3Artifacts(outputDirectory, plan)
  const artifact = await publishGoldEnrichmentV3Artifact(outputDirectory, plan[0])
  return { report, artifact }
}
