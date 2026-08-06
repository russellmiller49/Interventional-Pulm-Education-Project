/** @jest-environment node */

import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import JSZip from 'jszip'

import { parseCsvRows } from '@/features/literature/gold-set/export'

import {
  CANONICAL_EXTERNAL_QA_FINDINGS_SHA256,
  EXTERNAL_QA_COLUMNS,
} from './data-quality/external-qa'
import {
  GOLD_ENRICHMENT_V3_EXCLUDED_RESULT_COLUMNS,
  GOLD_ENRICHMENT_V3_INCLUDED_FULL_TEXT_RESULT_COLUMNS,
  GOLD_ENRICHMENT_V3_INCLUDED_METADATA_RESULT_COLUMNS,
  GOLD_ENRICHMENT_V3_MERGED_COLUMNS,
  GOLD_ENRICHMENT_V3_RAW_MERGED_COLUMNS,
  GOLD_ENRICHMENT_V3_REVIEW_CSV_COLUMNS,
  buildGoldEnrichmentV3ReviewCohorts,
  mergeGoldEnrichmentV3RawResults,
  validateGoldEnrichmentV3Results,
  type GoldEnrichmentV3MergedRow,
  type GoldEnrichmentV3ValidationReport,
} from './gold-enrichment-v3-results'
import {
  GOLD_ENRICHMENT_V3_REVIEW_WORKBOOK_SHEETS,
  buildGoldEnrichmentV3ReviewWorkbookBytes,
  type GoldEnrichmentV3ReviewWorkbookMetadata,
} from './gold-enrichment-v3-workbook'
import { runGoldEnrichmentV3Cli } from './gold-enrichment-v3-cli'
import {
  GOLD_ENRICHMENT_V3_CANONICAL_RECEIPT_SHA256,
  GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_COLUMNS,
  GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_SHA256,
  GOLD_ENRICHMENT_V3_CONFIG_CONTRACT,
  GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
  GOLD_ENRICHMENT_V3_FULL_TEXT_AUDIT_COLUMNS,
  GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION,
  GOLD_ENRICHMENT_V3_MERGED_SCHEMA_VERSION,
  GOLD_ENRICHMENT_V3_PACKET_MEMBERSHIP_ORDER_SHA256,
  GOLD_ENRICHMENT_V3_PACKET_FAMILIES,
  GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256,
  GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION,
  GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
  GOLD_ENRICHMENT_V3_SUPERSEDED_PROMPT_SHA256,
  GOLD_ENRICHMENT_V3_TAXONOMY_VERSION,
  GOLD_ENRICHMENT_V3_UPGRADE_PLAN_SHA256,
  GOLD_ENRICHMENT_V3_WORKFLOW_ID,
  GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
  assertGoldEnrichmentV3SafeOutputDirectory,
  buildGoldEnrichmentV3ModelFacingInventory,
  buildGoldEnrichmentV3ModelInputIndependenceAudit,
  buildGoldEnrichmentV3PacketRows,
  buildGoldEnrichmentV3Packets,
  goldEnrichmentV3ControlledValueCatalog,
  goldEnrichmentV3ForbiddenPromptPhraseLabels,
  goldEnrichmentV3PacketColumns,
  goldEnrichmentV3PacketMembershipOrderProjection,
  goldEnrichmentV3PacketSourceColumns,
  goldEnrichmentV3PhysicianFieldSha256,
  parseGoldEnrichmentV3CanonicalSource,
  parseGoldEnrichmentV3FullTextAudit,
  plannedGoldEnrichmentV3Text,
  preflightGoldEnrichmentV3Artifacts,
  publishGoldEnrichmentV3Artifact,
  serializeGoldEnrichmentV3Csv,
  serializeGoldEnrichmentV3Json,
  sha256Bytes,
  validateGoldEnrichmentV3CanonicalReceipt,
  type GoldEnrichmentV3ArtifactIdentity,
  type GoldEnrichmentV3CanonicalRow,
  type GoldEnrichmentV3FullTextAuditRow,
  type GoldEnrichmentV3FullTextRegistryRow,
  type GoldEnrichmentV3PacketFamily,
  type GoldEnrichmentV3PreparedPacket,
} from './gold-enrichment-v3'
import * as goldEnrichmentV3Core from './gold-enrichment-v3'

type StringRow = Record<string, string>

interface SyntheticWorkflow {
  sourceRows: GoldEnrichmentV3CanonicalRow[]
  registryRows: GoldEnrichmentV3FullTextRegistryRow[]
  packets: GoldEnrichmentV3PreparedPacket[]
}

interface SyntheticResultFile {
  filename: string
  family: GoldEnrichmentV3PacketFamily
  columns: readonly string[]
  rows: StringRow[]
  text: string
}

interface SyntheticPacketIndexEntry {
  packetId: string
  family: GoldEnrichmentV3PacketFamily
  ordinal: number
  rows: number
  csvPath: string
  csvSha256: string
  modelFacingPromptPath: string
  modelFacingPromptSha256: string
  modelFacingFullTextManifestPath: string | null
  modelFacingFullTextManifestSha256: string | null
  receiptPath: string
  receiptSha256: string
  expectedOutputFilename: string
  sourceProjectionSha256: string
}

interface ValidationFixture {
  root: string
  runDirectory: string
  resultsDirectory: string
  files: Map<string, SyntheticResultFile>
}

const COMPLETE_FULL_TEXT_ROWS = 50
const PREVIEW_SOURCE_INDEX = 51
const FIRST_MISSING_SOURCE_INDEX = 52
const LAST_MISSING_SOURCE_INDEX = 56
const FIXED_PMID_BY_SOURCE_INDEX = new Map([
  [PREVIEW_SOURCE_INDEX, '16043961'],
  [57, '26033136'],
  [60, '41229759'],
  [61, '18453348'],
])
const CLASSIFICATION_PROMPT_FILENAMES = [
  'included-metadata-only.md',
  'included-full-text.md',
  'excluded-metadata-sufficiency.md',
] as const
const SUPERSEDED_PROMPT_SHA256 = new Map([
  ['included-metadata-only.md', '0ebd1906e275b5bbf9017e5c48f5c7de50ab5cc8a4afb836ea7c2e904a531ec7'],
  ['included-full-text.md', '1d44482548b63533e35f9d78a1602df9d90f5f5a28aad5d25db97c56af62a0e3'],
  [
    'excluded-metadata-sufficiency.md',
    '17ed3fe1f5a8d00450ceacefa43071434be23736a3a9c4d8575de9ace8164d9f',
  ],
])
const HISTORICAL_PACKET_MEMBERSHIP_SHA256 =
  'd0bfc858145b2ee09e976946da1491069c5de26e2c32e600462d1cad323d8e10'
const HISTORICAL_PACKET_MEMBERSHIP_BYTES = 27_137

function classificationPromptTexts(): Map<
  (typeof CLASSIFICATION_PROMPT_FILENAMES)[number],
  string
> {
  return new Map(
    CLASSIFICATION_PROMPT_FILENAMES.map((filename) => [
      filename,
      readFileSync(
        path.join(process.cwd(), 'docs/ip-literature/gold-enrichment-v3-prompts', filename),
        'utf8',
      ),
    ]),
  )
}

function containsStandaloneIdentifier(input: string, identifier: string): boolean {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  return new RegExp(`(?<![0-9])${escaped}(?![0-9])`, 'u').test(input)
}

function blankRecord<const Columns extends readonly string[]>(
  columns: Columns,
): Record<Columns[number], string> {
  return Object.fromEntries(columns.map((column) => [column, ''])) as Record<
    Columns[number],
    string
  >
}

function csvObjects<const Columns extends readonly string[]>(
  input: string,
  columns: Columns,
): Array<Record<Columns[number], string>> {
  const parsed = parseCsvRows(input)
  expect(parsed[0]).toEqual(columns)
  return parsed
    .slice(1)
    .map(
      (values) =>
        Object.fromEntries(columns.map((column, index) => [column, values[index]])) as Record<
          Columns[number],
          string
        >,
    )
}

function flexibleCsvObjects(input: string): StringRow[] {
  const [columns, ...records] = parseCsvRows(input)
  expect(columns).toBeDefined()
  return records.map((values) =>
    Object.fromEntries(columns.map((column, index) => [column, values[index]])),
  )
}

function canonicalRow(index: number): GoldEnrichmentV3CanonicalRow {
  const row = blankRecord(GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_COLUMNS)
  const physicianLabel =
    index <= 283 ? 'include_core' : index <= 358 ? 'include_adjacent' : 'exclude'
  return {
    ...row,
    batch_id: 'synthetic-development-batch',
    batch_name: 'gold-set-v1',
    dataset_split: 'development',
    gold_set_item_id: `synthetic-item-${index}`,
    display_order: String(index),
    master_row_id: String(index),
    screening_batch: 'synthetic-screening-batch',
    source_row_id: String(index),
    pmid: FIXED_PMID_BY_SOURCE_INDEX.get(index) ?? String(70_000_000 + index),
    title: `Synthetic development article ${index} — bronchoscopy`,
    abstract: `Synthetic abstract ${index} with adequate metadata and a stable UTF-8 café marker.`,
    authors_json: '["Synthetic Author"]',
    journal: 'Synthetic Pulmonology',
    journal_abbreviation: 'Synth Pulm',
    publication_year: '2025',
    publication_types_json: '["Journal Article"]',
    mesh_terms_json: '["Bronchoscopy"]',
    author_keywords_json: '["airway"]',
    languages_json: '["eng"]',
    no_abstract: 'False',
    physician_final_label: physicianLabel,
    physician_final_confidence: 'high',
    physician_accept_or_modify: 'accept',
    physician_reviewed: 'True',
    decision_provenance: 'human_ai_assisted',
    is_blinded: 'False',
    relevance_review_complete: 'True',
    enrichment_status: 'pending',
    database_import_ready: 'False',
    csvRecordNumber: index + 1,
  }
}

function fullTextRegistryRow(
  source: GoldEnrichmentV3CanonicalRow,
  evidenceStatus: GoldEnrichmentV3FullTextRegistryRow['evidence_status'],
): GoldEnrichmentV3FullTextRegistryRow {
  const fileSha256 =
    evidenceStatus === 'missing'
      ? ''
      : evidenceStatus === 'preview_only'
        ? 'a777267005cbab7321aacb0e2569f528925068434267c2860d9f9167289e7b2b'
        : sha256Bytes(`synthetic full text for ${source.pmid}`)
  return {
    master_row_id: source.master_row_id,
    pmid: source.pmid,
    title: source.title,
    physician_final_label: source.physician_final_label,
    physician_final_confidence: source.physician_final_confidence,
    pubmed_abstract_status: 'abstract_present',
    metadata_sufficiency_constraint: 'adequate_abstract',
    expected_filename: `${source.pmid}${evidenceStatus === 'preview_only' ? '.preview' : ''}.pdf`,
    actual_filename: evidenceStatus === 'missing' ? '' : `${source.pmid}.pdf`,
    file_sha256: fileSha256,
    file_bytes: evidenceStatus === 'missing' ? null : 128,
    evidence_status: evidenceStatus,
    full_text_used: false,
    categorization_from_full_text: false,
    source_reconciliation_receipt: 'synthetic-reconciliation.receipt.json',
    full_text_availability_note:
      evidenceStatus === 'matched_complete'
        ? 'Synthetic checksum-bound complete full text.'
        : evidenceStatus === 'preview_only'
          ? 'Synthetic preview only; never complete full text.'
          : 'Synthetic missing full text.',
  }
}

function artifactIdentities(
  kind: 'prompt' | 'schema',
): Record<
  GoldEnrichmentV3PacketFamily,
  Omit<GoldEnrichmentV3ArtifactIdentity, 'publication'> & { text: string }
> {
  const filenames: Record<GoldEnrichmentV3PacketFamily, string> =
    kind === 'prompt'
      ? {
          included_metadata_only: 'included-metadata-only.md',
          included_full_text: 'included-full-text.md',
          excluded_metadata_sufficiency: 'excluded-metadata-sufficiency.md',
        }
      : {
          included_metadata_only: 'included-metadata-only-result.schema.json',
          included_full_text: 'included-full-text-result.schema.json',
          excluded_metadata_sufficiency: 'excluded-metadata-sufficiency-result.schema.json',
        }
  return Object.fromEntries(
    GOLD_ENRICHMENT_V3_PACKET_FAMILIES.map((family) => {
      const filename = filenames[family]
      const sourcePath = path.join(
        process.cwd(),
        kind === 'prompt'
          ? 'docs/ip-literature/gold-enrichment-v3-prompts'
          : 'config/literature/gold-enrichment-v3',
        filename,
      )
      const content = readFileSync(sourcePath)
      return [
        family,
        {
          path: `${kind}s/${filename}`,
          bytes: content.byteLength,
          sha256: sha256Bytes(content),
          text: content.toString('utf8'),
        },
      ]
    }),
  ) as Record<
    GoldEnrichmentV3PacketFamily,
    Omit<GoldEnrichmentV3ArtifactIdentity, 'publication'> & { text: string }
  >
}

function buildSyntheticWorkflow(): SyntheticWorkflow {
  const sourceRows = Array.from({ length: 630 }, (_, index) => canonicalRow(index + 1))
  const registryRows = sourceRows.slice(0, LAST_MISSING_SOURCE_INDEX).map((source, index) => {
    const sourceIndex = index + 1
    const status =
      sourceIndex <= COMPLETE_FULL_TEXT_ROWS
        ? 'matched_complete'
        : sourceIndex === PREVIEW_SOURCE_INDEX
          ? 'preview_only'
          : 'missing'
    return fullTextRegistryRow(source, status)
  })
  const families = buildGoldEnrichmentV3PacketRows(sourceRows, registryRows)
  const packets = buildGoldEnrichmentV3Packets(
    families,
    artifactIdentities('prompt'),
    artifactIdentities('schema'),
  )
  return { sourceRows, registryRows, packets }
}

const SYNTHETIC_WORKFLOW = buildSyntheticWorkflow()

function resultColumns(family: GoldEnrichmentV3PacketFamily): readonly string[] {
  if (family === 'included_metadata_only') {
    return GOLD_ENRICHMENT_V3_INCLUDED_METADATA_RESULT_COLUMNS
  }
  if (family === 'included_full_text') {
    return GOLD_ENRICHMENT_V3_INCLUDED_FULL_TEXT_RESULT_COLUMNS
  }
  return GOLD_ENRICHMENT_V3_EXCLUDED_RESULT_COLUMNS
}

function includedResultRow(input: StringRow, family: GoldEnrichmentV3PacketFamily): StringRow {
  const fullText = family === 'included_full_text'
  const row = blankRecord(resultColumns(family))
  Object.assign(row, {
    packet_id: input.packet_id,
    packet_family: input.packet_family,
    workflow_id: input.workflow_id,
    prompt_template_version: input.prompt_template_version,
    result_schema_version: input.result_schema_version,
    taxonomy_version: input.taxonomy_version,
    label_schema_version: input.label_schema_version,
    enrichment_schema_version: input.enrichment_schema_version,
    source_projection_sha256: input.source_projection_sha256,
    source_row_sha256: input.source_row_sha256,
    master_row_id: input.master_row_id,
    pmid: input.pmid,
    physician_final_label: input.physician_final_label,
    physician_final_confidence: input.physician_final_confidence,
    metadata_sufficiency: input.metadata_sufficiency_constraint || 'adequate_abstract',
    topic_ids: 'basic-bronchoscopy',
    technology_tags: 'convex-ebus',
    technology_tag_status: 'tagged',
    clinical_purposes: 'diagnosis',
    disease_tags: 'lung-cancer',
    disease_tag_status: 'tagged',
    study_design: 'randomized-trial',
    publication_status: 'full-article',
    categorization_from_full_text: String(fullText),
    full_text_used: String(fullText),
    full_text_filename: fullText ? input.expected_full_text_filename : '',
    full_text_sha256: fullText ? input.expected_full_text_sha256 : '',
    enrichment_confidence: 'high',
    model_requests_physician_enrichment_review: 'false',
    evidence_1_field: fullText ? 'full_text' : 'title',
    evidence_1_excerpt: fullText ? 'Synthetic full-text evidence one.' : input.title,
    evidence_1_location: fullText ? 'page 1' : 'title',
    evidence_2_field: fullText ? 'full_text' : '',
    evidence_2_excerpt: fullText ? 'Synthetic full-text evidence two.' : '',
    evidence_2_location: fullText ? 'page 2' : '',
    enrichment_rationale: 'Synthetic evidence supports the complete controlled-value proposal.',
    processing_status: 'valid',
    processing_error: '',
  })
  return row
}

function excludedResultRow(input: StringRow): StringRow {
  const row = blankRecord(GOLD_ENRICHMENT_V3_EXCLUDED_RESULT_COLUMNS)
  Object.assign(row, {
    packet_id: input.packet_id,
    packet_family: input.packet_family,
    workflow_id: input.workflow_id,
    prompt_template_version: input.prompt_template_version,
    result_schema_version: input.result_schema_version,
    taxonomy_version: input.taxonomy_version,
    label_schema_version: input.label_schema_version,
    enrichment_schema_version: input.enrichment_schema_version,
    source_projection_sha256: input.source_projection_sha256,
    source_row_sha256: input.source_row_sha256,
    master_row_id: input.master_row_id,
    pmid: input.pmid,
    physician_final_label: input.physician_final_label,
    physician_final_confidence: input.physician_final_confidence,
    metadata_sufficiency: 'adequate_abstract',
    assessment_confidence: 'high',
    model_requests_physician_enrichment_review: 'false',
    evidence_field: 'title',
    evidence_excerpt: input.title,
    assessment_rationale: 'Synthetic metadata is adequate for exclusion review.',
    categorization_from_full_text: 'false',
    full_text_used: 'false',
    processing_status: 'valid',
    processing_error: '',
  })
  return row
}

function buildSyntheticResultFiles(
  packets: readonly GoldEnrichmentV3PreparedPacket[],
): SyntheticResultFile[] {
  return packets.map((packet) => {
    const family = packet.receipt.packetFamily
    const columns = resultColumns(family)
    const inputs = csvObjects(packet.csv, goldEnrichmentV3PacketColumns(family))
    const rows = inputs.map((input) =>
      family === 'excluded_metadata_sufficiency'
        ? excludedResultRow(input)
        : includedResultRow(input, family),
    )
    const text = serializeGoldEnrichmentV3Csv(columns, rows)
    return {
      filename: packet.receipt.expectedOutputFilename,
      family,
      columns,
      rows,
      text,
    }
  })
}

async function materializeValidationFixture(): Promise<ValidationFixture> {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'gold-v3-fixture-')))
  const runDirectory = path.join(root, 'run')
  const resultsDirectory = path.join(root, 'returned')
  await Promise.all([
    mkdir(runDirectory, { recursive: true }),
    mkdir(resultsDirectory, { recursive: true }),
  ])

  const packetEntries: SyntheticPacketIndexEntry[] = []
  for (const packet of SYNTHETIC_WORKFLOW.packets) {
    const receiptText = serializeGoldEnrichmentV3Json(packet.receipt)
    const csvTarget = path.join(runDirectory, packet.csvPath)
    const receiptTarget = path.join(runDirectory, packet.receiptPath)
    const renderedPromptTarget = path.join(runDirectory, packet.renderedPrompt.path)
    const fullTextManifestTarget = packet.modelFacingFullTextManifest
      ? path.join(runDirectory, packet.modelFacingFullTextManifest.path)
      : null
    await Promise.all(
      [...new Set([csvTarget, receiptTarget, renderedPromptTarget, fullTextManifestTarget])]
        .filter((target): target is string => target !== null)
        .map((target) => mkdir(path.dirname(target), { recursive: true })),
    )
    await Promise.all([
      writeFile(csvTarget, packet.csv, 'utf8'),
      writeFile(receiptTarget, receiptText, 'utf8'),
      writeFile(renderedPromptTarget, packet.renderedPrompt.text, 'utf8'),
      ...(packet.modelFacingFullTextManifest && fullTextManifestTarget
        ? [writeFile(fullTextManifestTarget, packet.modelFacingFullTextManifest.text, 'utf8')]
        : []),
    ])
    packetEntries.push({
      packetId: packet.receipt.packetId,
      family: packet.receipt.packetFamily,
      ordinal: packet.receipt.packetOrdinal,
      rows: packet.receipt.rowCount,
      csvPath: packet.csvPath,
      csvSha256: sha256Bytes(packet.csv),
      modelFacingPromptPath: packet.renderedPrompt.path,
      modelFacingPromptSha256: packet.receipt.modelFacingPrompt.sha256,
      modelFacingFullTextManifestPath: packet.receipt.modelFacingFullTextManifest?.path ?? null,
      modelFacingFullTextManifestSha256: packet.receipt.modelFacingFullTextManifest?.sha256 ?? null,
      receiptPath: packet.receiptPath,
      receiptSha256: sha256Bytes(receiptText),
      expectedOutputFilename: packet.receipt.expectedOutputFilename,
      sourceProjectionSha256: packet.receipt.sourceProjectionSha256,
    })
  }
  const indexFamilies = Object.fromEntries(
    GOLD_ENRICHMENT_V3_PACKET_FAMILIES.map((family) => {
      const selected = packetEntries.filter((entry) => entry.family === family)
      return [
        family,
        {
          packets: selected.length,
          rows: selected.reduce((sum, entry) => sum + entry.rows, 0),
          packetIds: selected.map((entry) => entry.packetId),
          packetManifestSha256: sha256Bytes(
            serializeGoldEnrichmentV3Json(
              selected.map((entry) => ({
                packetId: entry.packetId,
                csvSha256: entry.csvSha256,
                promptSha256: entry.modelFacingPromptSha256,
                fullTextManifestSha256: entry.modelFacingFullTextManifestSha256,
                receiptSha256: entry.receiptSha256,
                sourceProjectionSha256: entry.sourceProjectionSha256,
              })),
            ),
          ),
        },
      ]
    }),
  )
  const runPacketManifestHashes = Object.fromEntries(
    GOLD_ENRICHMENT_V3_PACKET_FAMILIES.map((family) => {
      const selected = packetEntries.filter((entry) => entry.family === family)
      return [
        family,
        sha256Bytes(
          serializeGoldEnrichmentV3Json(
            selected.map((entry) => ({
              packetId: entry.packetId,
              packetCsvSha256: entry.csvSha256,
              modelFacingPromptSha256: entry.modelFacingPromptSha256,
              modelFacingFullTextManifestSha256: entry.modelFacingFullTextManifestSha256,
              packetReceiptSha256: entry.receiptSha256,
            })),
          ),
        ),
      ]
    }),
  )
  const packetIndex = serializeGoldEnrichmentV3Json({
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    packetCount: packetEntries.length,
    families: indexFamilies,
    packets: packetEntries,
  })
  await writeFile(path.join(runDirectory, 'packet-index.json'), packetIndex, 'utf8')
  const contractIdentities = new Map<string, { path: string; bytes: number; sha256: string }>()
  const contractArtifacts = []
  for (const packet of SYNTHETIC_WORKFLOW.packets) {
    for (const identity of [packet.receipt.promptTemplate, packet.receipt.expectedResultSchema]) {
      contractIdentities.set(identity.path, {
        path: identity.path,
        bytes: identity.bytes,
        sha256: identity.sha256,
      })
    }
  }
  for (const filename of ['README.md', 'result-merge-prompt.md']) {
    const bytes = readFileSync(
      path.join(process.cwd(), 'docs/ip-literature/gold-enrichment-v3-prompts', filename),
    )
    contractIdentities.set(`prompts/${filename}`, {
      path: `prompts/${filename}`,
      bytes: bytes.byteLength,
      sha256: sha256Bytes(bytes),
    })
  }
  const mergedSchemaBytes = readFileSync(
    path.join(process.cwd(), 'config/literature/gold-enrichment-v3/merged-v3.schema.json'),
  )
  contractIdentities.set('schemas/merged-v3.schema.json', {
    path: 'schemas/merged-v3.schema.json',
    bytes: mergedSchemaBytes.byteLength,
    sha256: sha256Bytes(mergedSchemaBytes),
  })
  for (const identity of contractIdentities.values()) {
    const filename = path.basename(identity.path)
    const sourcePath = path.join(
      process.cwd(),
      identity.path.startsWith('prompts/')
        ? 'docs/ip-literature/gold-enrichment-v3-prompts'
        : 'config/literature/gold-enrichment-v3',
      filename,
    )
    const bytes = await readFile(sourcePath)
    expect(bytes.byteLength).toBe(identity.bytes)
    expect(sha256Bytes(bytes)).toBe(identity.sha256)
    const target = path.join(runDirectory, identity.path)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, bytes)
    contractArtifacts.push({ path: identity.path, bytes })
  }
  const runDefinition = serializeGoldEnrichmentV3Json({
    workflow: {
      id: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
      workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
      promptTemplateVersion: GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION,
      resultSchemaVersion: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
      mergedSchemaVersion: GOLD_ENRICHMENT_V3_MERGED_SCHEMA_VERSION,
      taxonomyVersion: GOLD_ENRICHMENT_V3_TAXONOMY_VERSION,
      labelSchemaVersion: GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION,
      enrichmentSchemaVersion: GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
    },
    repository: {
      branch: 'codex/synthetic-fixture',
      commit: '0'.repeat(40),
      originMainSha: '1'.repeat(40),
      mergeBaseSha: '1'.repeat(40),
      cleanTrackedState: true,
    },
    developmentScope: { rows: 630, heldOutTestRows: 0, testIdentitiesAccessed: 0 },
    safety: { heldOutTestAccessed: false },
    modelInputIndependence: {
      status: 'preparation-blocked-unless-audit-passes',
      modelFacingInventoryPath: 'model-facing-inventory.json',
      auditPath: 'model-input-independence-audit.json',
    },
    packetization: {
      ordering: 'canonical-source-order',
      families: {
        included_metadata_only: { rows: 308, packets: 7, maximumPacketSize: 50 },
        included_full_text: { rows: 50, packets: 10, maximumPacketSize: 5 },
        excluded_metadata_sufficiency: { rows: 272, packets: 3, maximumPacketSize: 100 },
      },
      packetCount: packetEntries.length,
      packetManifestHashes: runPacketManifestHashes,
      membershipOrderProjection: {
        serialization: 'compact JSON.stringify preserving packet/property order plus one LF',
        bytes: HISTORICAL_PACKET_MEMBERSHIP_BYTES,
        sha256: GOLD_ENRICHMENT_V3_PACKET_MEMBERSHIP_ORDER_SHA256,
        approvedSha256: GOLD_ENRICHMENT_V3_PACKET_MEMBERSHIP_ORDER_SHA256,
        syntheticFixtureOnly: true,
      },
    },
    promptTemplates: Object.fromEntries(
      [...contractIdentities.values()]
        .filter((identity) => identity.path.startsWith('prompts/'))
        .map((identity) => [identity.path, { bytes: identity.bytes, sha256: identity.sha256 }]),
    ),
    outputSchemas: Object.fromEntries(
      [...contractIdentities.values()]
        .filter((identity) => identity.path.startsWith('schemas/'))
        .map((identity) => [
          identity.path,
          {
            bytes: identity.bytes,
            sha256: identity.sha256,
            version: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
          },
        ]),
    ),
  })
  const registryCsv = syntheticFullTextRegistryCsv()
  const registryIdentity = {
    path: 'full-text-registry-v3.csv',
    bytes: Buffer.byteLength(registryCsv),
    sha256: sha256Bytes(registryCsv),
  }
  const registryReceiptText = serializeGoldEnrichmentV3Json({
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    registry: registryIdentity,
    counts: { matched_complete: 50, preview_only: 1, missing: 5 },
    binariesCopiedIntoWorkflow: false,
  })
  await Promise.all([
    writeFile(path.join(runDirectory, registryIdentity.path), registryCsv, 'utf8'),
    writeFile(
      path.join(runDirectory, 'full-text-registry-v3.receipt.json'),
      registryReceiptText,
      'utf8',
    ),
  ])
  const packetArtifacts = SYNTHETIC_WORKFLOW.packets.flatMap((packet) => [
    plannedGoldEnrichmentV3Text(packet.csvPath, packet.csv),
    plannedGoldEnrichmentV3Text(packet.renderedPrompt.path, packet.renderedPrompt.text),
    ...(packet.modelFacingFullTextManifest
      ? [
          plannedGoldEnrichmentV3Text(
            packet.modelFacingFullTextManifest.path,
            packet.modelFacingFullTextManifest.text,
          ),
        ]
      : []),
    plannedGoldEnrichmentV3Text(packet.receiptPath, serializeGoldEnrichmentV3Json(packet.receipt)),
  ])
  const baseCanonicalArtifacts = [
    plannedGoldEnrichmentV3Text('packet-index.json', packetIndex),
    plannedGoldEnrichmentV3Text('run-definition.json', runDefinition),
    plannedGoldEnrichmentV3Text(registryIdentity.path, registryCsv),
    plannedGoldEnrichmentV3Text('full-text-registry-v3.receipt.json', registryReceiptText),
    ...contractArtifacts,
    ...packetArtifacts,
  ].sort((left, right) => left.path.localeCompare(right.path, 'en-US'))
  const inventory = buildGoldEnrichmentV3ModelFacingInventory(
    baseCanonicalArtifacts,
    SYNTHETIC_WORKFLOW.packets,
  )
  const inventoryText = serializeGoldEnrichmentV3Json(inventory)
  const promptArtifacts = artifactIdentities('prompt')
  const controlledValueCatalog = goldEnrichmentV3ControlledValueCatalog(
    readFileSync(path.join(process.cwd(), 'config/literature/enrichment-labels.v2.json'), 'utf8'),
  )
  const syntheticAudit = buildGoldEnrichmentV3ModelInputIndependenceAudit({
    sourceRows: SYNTHETIC_WORKFLOW.sourceRows,
    fullTextRegistryRows: SYNTHETIC_WORKFLOW.registryRows,
    packets: SYNTHETIC_WORKFLOW.packets,
    promptTemplates: Object.fromEntries(
      GOLD_ENRICHMENT_V3_PACKET_FAMILIES.map((family) => [
        family,
        { path: promptArtifacts[family].path, text: promptArtifacts[family].text },
      ]),
    ) as Record<GoldEnrichmentV3PacketFamily, { path: string; text: string }>,
    inventory,
    inventoryText,
    generatedArtifacts: baseCanonicalArtifacts,
    controlledValueCatalog,
  })
  expect(inventory.modelFacingFileCount).toBe(100)
  expect(inventory.categories.model_facing.filter((entry) => entry.external)).toHaveLength(50)
  expect(syntheticAudit.checks.modelFacingFileIdentities).toHaveLength(100)
  expect(syntheticAudit.checks.packetUploadBundleAudit).toHaveLength(20)
  expect(syntheticAudit.checks.promptPlaceholderAudit).toHaveLength(23)
  expect(syntheticAudit.checks.canonicalPacketCoverage).toMatchObject({
    rows: 630,
    uniqueRows: 630,
    pass: true,
  })
  expect(syntheticAudit.failures).toEqual([
    'Packet membership/order projection changed from the approved cohort.',
  ])
  const syntheticMembershipProjection = goldEnrichmentV3PacketMembershipOrderProjection(
    SYNTHETIC_WORKFLOW.packets,
  )
  const independenceAudit = {
    ...syntheticAudit,
    pass: true,
    failures: [],
    packetMembershipOrderIdentity: {
      ...syntheticAudit.packetMembershipOrderIdentity,
      bytes: Buffer.byteLength(syntheticMembershipProjection),
      sha256: GOLD_ENRICHMENT_V3_PACKET_MEMBERSHIP_ORDER_SHA256,
      expectedSha256: GOLD_ENRICHMENT_V3_PACKET_MEMBERSHIP_ORDER_SHA256,
      pass: true,
      syntheticFixtureOnly: true,
    },
  }
  const independenceAuditText = serializeGoldEnrichmentV3Json(independenceAudit)
  const canonicalArtifacts = [
    ...baseCanonicalArtifacts,
    plannedGoldEnrichmentV3Text('model-facing-inventory.json', inventoryText),
    plannedGoldEnrichmentV3Text('model-input-independence-audit.json', independenceAuditText),
  ].sort((left, right) => left.path.localeCompare(right.path, 'en-US'))
  expect(canonicalArtifacts).toHaveLength(85)
  const canonicalIdentities = canonicalArtifacts.map((artifact) => ({
    path: artifact.path,
    bytes: artifact.bytes.byteLength,
    sha256: sha256Bytes(artifact.bytes),
  }))
  const canonicalTotalBytes = canonicalIdentities.reduce((sum, identity) => sum + identity.bytes, 0)
  const manifestText = serializeGoldEnrichmentV3Json({
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    canonicalArtifacts: canonicalIdentities,
    canonicalFileCount: canonicalIdentities.length,
    canonicalTotalBytes,
    excludes: ['artifact-manifest.json', 'execution-receipts/**'],
  })
  const executionTime = '2026-01-01T00:00:00.000Z'
  const executionFilename = `execution-${executionTime.replace(/[:.]/gu, '-')}.json`
  const executionReceiptText = serializeGoldEnrichmentV3Json({
    canonical: false,
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    executedAt: executionTime,
    outputDirectory: runDirectory,
    repositoryCommit: '0'.repeat(40),
    canonicalManifest: {
      path: 'artifact-manifest.json',
      bytes: Buffer.byteLength(manifestText),
      sha256: sha256Bytes(manifestText),
    },
    canonicalFileCount: canonicalIdentities.length + 1,
    canonicalTotalBytes: canonicalTotalBytes + Buffer.byteLength(manifestText),
    publicationCounts: { created: canonicalIdentities.length + 1 },
    modelCalls: 0,
    networkRequests: 0,
    databaseWrites: 0,
    importRowsCreated: 0,
    testIdentitiesAccessed: 0,
  })
  await mkdir(path.join(runDirectory, 'execution-receipts'), { recursive: true })
  await Promise.all([
    writeFile(path.join(runDirectory, 'run-definition.json'), runDefinition, 'utf8'),
    writeFile(path.join(runDirectory, 'model-facing-inventory.json'), inventoryText, 'utf8'),
    writeFile(
      path.join(runDirectory, 'model-input-independence-audit.json'),
      independenceAuditText,
      'utf8',
    ),
    writeFile(path.join(runDirectory, 'artifact-manifest.json'), manifestText, 'utf8'),
    writeFile(
      path.join(runDirectory, 'execution-receipts', executionFilename),
      executionReceiptText,
      'utf8',
    ),
  ])

  const resultFiles = buildSyntheticResultFiles(SYNTHETIC_WORKFLOW.packets)
  const files = new Map(resultFiles.map((file) => [file.filename, file]))
  await Promise.all(
    resultFiles.map((file) =>
      writeFile(path.join(resultsDirectory, file.filename), file.text, 'utf8'),
    ),
  )
  return { root, runDirectory, resultsDirectory, files }
}

async function validateFixture(fixture: ValidationFixture) {
  return validateGoldEnrichmentV3Results({
    runDirectory: fixture.runDirectory,
    resultsDirectory: fixture.resultsDirectory,
    workspaceRoot: fixture.root,
    publishReports: false,
  })
}

async function writeMutatedResult(
  fixture: ValidationFixture,
  file: SyntheticResultFile,
  mutate: (rows: StringRow[]) => void,
) {
  const rows = file.rows.map((row) => ({ ...row }))
  mutate(rows)
  await writeFile(
    path.join(fixture.resultsDirectory, file.filename),
    serializeGoldEnrichmentV3Csv(file.columns, rows),
    'utf8',
  )
}

async function restoreResult(fixture: ValidationFixture, file: SyntheticResultFile) {
  await writeFile(path.join(fixture.resultsDirectory, file.filename), file.text, 'utf8')
}

const SYNTHETIC_PRIOR_SHA256 = '62003ac04650a4d303a8cc73785452a0bdf3ddeeca3c1ea87bdf2e4e4bc0b15c'

function syntheticFullTextRegistryCsv(): string {
  const columns = [
    'master_row_id',
    'pmid',
    'evidence_status',
    'expected_filename',
    'file_sha256',
    'full_text_availability_note',
  ] as const
  return serializeGoldEnrichmentV3Csv(
    columns,
    SYNTHETIC_WORKFLOW.registryRows.map((row) => ({
      master_row_id: row.master_row_id,
      pmid: row.pmid,
      evidence_status: row.evidence_status,
      expected_filename: row.expected_filename,
      file_sha256: row.file_sha256,
      full_text_availability_note: row.full_text_availability_note,
    })),
  )
}

function syntheticPriorCsv(): string {
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
  return serializeGoldEnrichmentV3Csv(
    columns,
    SYNTHETIC_WORKFLOW.sourceRows.map((row) => {
      const included = row.physician_final_label !== 'exclude'
      return {
        master_row_id: row.master_row_id,
        pmid: row.pmid,
        topic_ids: included ? 'basic-bronchoscopy' : '',
        technology_tags: included ? 'convex-ebus' : '',
        clinical_purposes: included ? 'diagnosis' : '',
        disease_tags: included ? 'lung-cancer' : '',
        study_design: included ? 'randomized-trial' : '',
        publication_status: included ? 'full-article' : '',
      }
    }),
  )
}

function syntheticQaCsv(): string {
  const directTargets = [
    SYNTHETIC_WORKFLOW.sourceRows[59],
    SYNTHETIC_WORKFLOW.sourceRows[60],
    ...SYNTHETIC_WORKFLOW.sourceRows.slice(100, 142),
  ]
  expect(directTargets).toHaveLength(44)
  const direct = Array.from({ length: 54 }, (_, index) => {
    const source = directTargets[index % directTargets.length]
    return {
      source_review: 'synthetic_QA_review_1',
      severity: 'Medium',
      category: 'taxonomy_consistency',
      master_row_id: source.master_row_id,
      pmid: source.pmid,
      field: 'topic_ids',
      issue: `Synthetic direct QA concern ${index + 1}`,
      current_value_in_external_review: '',
      suggested_action: 'pleural-interventions',
      title: source.title,
      status_against_v2: 'retained_for_physician_review',
      review_tier: 'direct_targeted',
    }
  })
  const ruleBased = Array.from({ length: 104 }, (_, index) => {
    const source = SYNTHETIC_WORKFLOW.sourceRows[200 + (index % 50)]
    return {
      source_review: 'synthetic_QA_review_2',
      severity: 'Low',
      category: 'rule_based_consistency',
      master_row_id: source.master_row_id,
      pmid: source.pmid,
      field: 'clinical_purposes/topic_ids',
      issue: 'purpose=staging but topic lacks ebus-mediastinal-staging',
      current_value_in_external_review: '',
      suggested_action: 'ebus-mediastinal-staging',
      title: source.title,
      status_against_v2: 'rule_retained',
      review_tier: 'rule_based_consistency',
    }
  })
  const global = Array.from({ length: 8 }, (_, index) => ({
    source_review: 'synthetic_QA_review_2',
    severity: 'Low',
    category: 'global_data_quality',
    master_row_id: '',
    pmid: '',
    field: 'dataset',
    issue: `Synthetic global QA finding ${index + 1}`,
    current_value_in_external_review: '',
    suggested_action: 'manual review',
    title: '',
    status_against_v2: 'global_finding_retained',
    review_tier: 'global_data_quality',
  }))
  return serializeGoldEnrichmentV3Csv(EXTERNAL_QA_COLUMNS, [...direct, ...ruleBased, ...global])
}

function syntheticUpgradePlan(): string {
  return serializeGoldEnrichmentV3Json({
    operation: 'synthetic_candidate_only_upgrade_plan',
    planVersion: '2.0.0',
    rows: SYNTHETIC_WORKFLOW.sourceRows.slice(150, 283).map((source) => ({
      candidateFieldVocabularyAdditions: [
        { field: 'topic_ids', vocabularyId: 'ebus-mediastinal-staging' },
      ],
      candidateFields: ['topic_ids'],
      deterministicCandidateDetection: false,
      existingV1Values: { topic_ids: ['basic-bronchoscopy'] },
      finalChangeDeterministic: false,
      masterRowId: source.master_row_id,
      physicianAdjudication: true,
      pmid: source.pmid,
      reason: 'Synthetic candidate-only taxonomy-v2 review.',
      sourceFindingReferences: [],
    })),
    safety: {
      developmentOnly: true,
      containsFinalChangedValues: false,
      relevanceModification: false,
      testIdentitiesIncluded: false,
      databaseOperations: [],
      importOperations: [],
    },
  })
}

interface SyntheticCanonicalManifest {
  workflowId: string
  workflowSchemaVersion: string
  canonicalArtifacts: Array<{ path: string; bytes: number; sha256: string }>
  canonicalFileCount: number
  canonicalTotalBytes: number
  excludes: string[]
}

async function writeSyntheticManifestAndRebindExecutionReceipt(
  runDirectory: string,
  manifest: SyntheticCanonicalManifest,
) {
  manifest.canonicalArtifacts.sort((left, right) => left.path.localeCompare(right.path, 'en-US'))
  manifest.canonicalFileCount = manifest.canonicalArtifacts.length
  manifest.canonicalTotalBytes = manifest.canonicalArtifacts.reduce(
    (sum, identity) => sum + identity.bytes,
    0,
  )
  manifest.excludes = ['artifact-manifest.json', 'execution-receipts/**']
  const manifestText = serializeGoldEnrichmentV3Json(manifest)
  await writeFile(path.join(runDirectory, 'artifact-manifest.json'), manifestText, 'utf8')
  const receiptDirectory = path.join(runDirectory, 'execution-receipts')
  for (const filename of await readdir(receiptDirectory)) {
    const receiptPath = path.join(receiptDirectory, filename)
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8')) as Record<string, unknown>
    receipt.canonicalManifest = {
      path: 'artifact-manifest.json',
      bytes: Buffer.byteLength(manifestText),
      sha256: sha256Bytes(manifestText),
    }
    receipt.canonicalFileCount = manifest.canonicalArtifacts.length + 1
    receipt.canonicalTotalBytes = manifest.canonicalTotalBytes + Buffer.byteLength(manifestText)
    receipt.publicationCounts = { created: manifest.canonicalArtifacts.length + 1 }
    await writeFile(receiptPath, serializeGoldEnrichmentV3Json(receipt), 'utf8')
  }
}

async function materializeMergeInputs(fixture: ValidationFixture) {
  const inputDirectory = path.join(fixture.root, 'coordinator-inputs')
  const localData = path.join(fixture.root, 'local-data')
  await Promise.all([
    mkdir(inputDirectory, { recursive: true }),
    mkdir(localData, { recursive: true }),
  ])
  const sourceText = serializeGoldEnrichmentV3Csv(
    GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_COLUMNS,
    SYNTHETIC_WORKFLOW.sourceRows,
  )
  const priorText = syntheticPriorCsv()
  const qaText = syntheticQaCsv()
  const upgradeText = syntheticUpgradePlan()
  const sourcePath = path.join(inputDirectory, 'synthetic-development-source.csv')
  const priorPath = path.join(inputDirectory, 'synthetic-prior.csv')
  const qaPath = path.join(inputDirectory, 'synthetic-qa.csv')
  const upgradePath = path.join(inputDirectory, 'synthetic-upgrade.json')
  await Promise.all([
    writeFile(sourcePath, sourceText, 'utf8'),
    writeFile(priorPath, priorText, 'utf8'),
    writeFile(qaPath, qaText, 'utf8'),
    writeFile(upgradePath, upgradeText, 'utf8'),
  ])

  const registryCsv = syntheticFullTextRegistryCsv()
  const registryIdentity = {
    path: 'full-text-registry-v3.csv',
    bytes: Buffer.byteLength(registryCsv),
    sha256: sha256Bytes(registryCsv),
  }
  const registryReceiptText = serializeGoldEnrichmentV3Json({
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    registry: registryIdentity,
    counts: { matched_complete: 50, preview_only: 1, missing: 5 },
    binariesCopiedIntoWorkflow: false,
  })
  const registryReceiptIdentity = {
    path: 'full-text-registry-v3.receipt.json',
    bytes: Buffer.byteLength(registryReceiptText),
    sha256: sha256Bytes(registryReceiptText),
  }
  await Promise.all([
    writeFile(path.join(fixture.runDirectory, registryIdentity.path), registryCsv, 'utf8'),
    writeFile(
      path.join(fixture.runDirectory, registryReceiptIdentity.path),
      registryReceiptText,
      'utf8',
    ),
  ])
  const manifestPath = path.join(fixture.runDirectory, 'artifact-manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as SyntheticCanonicalManifest
  manifest.canonicalArtifacts = manifest.canonicalArtifacts.map((identity) => {
    if (identity.path === registryIdentity.path) return registryIdentity
    if (identity.path === registryReceiptIdentity.path) return registryReceiptIdentity
    return identity
  })
  await writeSyntheticManifestAndRebindExecutionReceipt(fixture.runDirectory, manifest)
  return {
    localData,
    priorPath,
    qaPath,
    sourcePath,
    upgradePath,
    texts: { priorText, qaText, sourceText, upgradeText },
  }
}

function completedReviewCsv(input: string): string {
  const rows = csvObjects(input, GOLD_ENRICHMENT_V3_REVIEW_CSV_COLUMNS).map((row) => ({
    ...row,
    physician_action: 'accept',
    physician_reviewed: 'true',
    physician_notes: ['16043961', '26033136'].includes(row.pmid)
      ? 'Synthetic relevance concern reviewed and documented.'
      : '',
  }))
  return serializeGoldEnrichmentV3Csv(GOLD_ENRICHMENT_V3_REVIEW_CSV_COLUMNS, rows)
}

function mutateReviewCsv(input: string, mutate: (rows: StringRow[]) => void): string {
  const rows = csvObjects(input, GOLD_ENRICHMENT_V3_REVIEW_CSV_COLUMNS)
  mutate(rows)
  return serializeGoldEnrichmentV3Csv(GOLD_ENRICHMENT_V3_REVIEW_CSV_COLUMNS, rows)
}

async function materializeSelfConsistentCanonicalPacketDrift(
  fixture: ValidationFixture,
  localData: string,
) {
  const runDirectory = path.join(localData, 'literature', 'packet-drift-run')
  const resultsDirectory = path.join(localData, 'literature', 'packet-drift-returned')
  await Promise.all([
    cp(fixture.runDirectory, runDirectory, { recursive: true }),
    cp(fixture.resultsDirectory, resultsDirectory, { recursive: true }),
  ])
  const packet = SYNTHETIC_WORKFLOW.packets.find(
    (candidate) => candidate.receipt.packetFamily === 'included_metadata_only',
  )!
  const packetPath = path.join(runDirectory, packet.csvPath)
  const packetText = await readFile(packetPath, 'utf8')
  const [packetColumns] = parseCsvRows(packetText)
  const packetRows = flexibleCsvObjects(packetText)
  const packetSourceColumns = goldEnrichmentV3PacketSourceColumns(packet.receipt.packetFamily)
  packetRows[0].journal = 'Self-consistent but noncanonical journal'
  const packetSource = (row: StringRow) =>
    Object.fromEntries(packetSourceColumns.map((column) => [column, row[column]]))
  packetRows[0].source_row_sha256 = sha256Bytes(
    serializeGoldEnrichmentV3Json(packetSource(packetRows[0])),
  )
  const sourceProjectionSha256 = sha256Bytes(
    serializeGoldEnrichmentV3Json({
      columns: packetSourceColumns,
      rows: packetRows.map((row) => packetSourceColumns.map((column) => row[column])),
    }),
  )
  packetRows.forEach((row) => {
    row.source_projection_sha256 = sourceProjectionSha256
  })
  const driftedPacketText = serializeGoldEnrichmentV3Csv(packetColumns, packetRows)
  const packetIdentity = {
    path: packet.csvPath,
    bytes: Buffer.byteLength(driftedPacketText),
    sha256: sha256Bytes(driftedPacketText),
  }

  const receiptPath = path.join(runDirectory, packet.receiptPath)
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8')) as {
    sourceProjectionSha256: string
    packetCsv: { path: string; bytes: number; sha256: string }
    modelFacingPrompt: { path: string; bytes: number; sha256: string }
    orderedKeys: Array<{ masterRowId: string; pmid: string; sourceRowSha256: string }>
  }
  const renderedPromptPath = path.join(runDirectory, receipt.modelFacingPrompt.path)
  const renderedPromptText = await readFile(renderedPromptPath, 'utf8')
  const driftedRenderedPromptText = renderedPromptText.replaceAll(
    receipt.sourceProjectionSha256,
    sourceProjectionSha256,
  )
  expect(driftedRenderedPromptText).not.toBe(renderedPromptText)
  const renderedPromptIdentity = {
    path: receipt.modelFacingPrompt.path,
    bytes: Buffer.byteLength(driftedRenderedPromptText),
    sha256: sha256Bytes(driftedRenderedPromptText),
  }
  receipt.sourceProjectionSha256 = sourceProjectionSha256
  receipt.packetCsv = packetIdentity
  receipt.modelFacingPrompt = renderedPromptIdentity
  receipt.orderedKeys[0].sourceRowSha256 = packetRows[0].source_row_sha256
  const driftedReceiptText = serializeGoldEnrichmentV3Json(receipt)
  const receiptIdentity = {
    path: packet.receiptPath,
    bytes: Buffer.byteLength(driftedReceiptText),
    sha256: sha256Bytes(driftedReceiptText),
  }

  const indexPath = path.join(runDirectory, 'packet-index.json')
  const packetIndex = JSON.parse(await readFile(indexPath, 'utf8')) as {
    packets: Array<{
      packetId: string
      csvSha256: string
      modelFacingPromptSha256: string
      receiptSha256: string
      sourceProjectionSha256: string
    }>
  }
  const indexEntry = packetIndex.packets.find(
    (candidate) => candidate.packetId === packet.receipt.packetId,
  )!
  indexEntry.csvSha256 = packetIdentity.sha256
  indexEntry.modelFacingPromptSha256 = renderedPromptIdentity.sha256
  indexEntry.receiptSha256 = receiptIdentity.sha256
  indexEntry.sourceProjectionSha256 = sourceProjectionSha256
  const driftedIndexText = serializeGoldEnrichmentV3Json(packetIndex)
  const indexIdentity = {
    path: 'packet-index.json',
    bytes: Buffer.byteLength(driftedIndexText),
    sha256: sha256Bytes(driftedIndexText),
  }

  const manifestPath = path.join(runDirectory, 'artifact-manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as SyntheticCanonicalManifest
  for (const identity of [indexIdentity, packetIdentity, renderedPromptIdentity, receiptIdentity]) {
    const existing = manifest.canonicalArtifacts.findIndex((entry) => entry.path === identity.path)
    if (existing === -1) manifest.canonicalArtifacts.push(identity)
    else manifest.canonicalArtifacts[existing] = identity
  }

  const resultPath = path.join(resultsDirectory, packet.receipt.expectedOutputFilename)
  const resultText = await readFile(resultPath, 'utf8')
  const [resultColumns] = parseCsvRows(resultText)
  const resultRows = flexibleCsvObjects(resultText)
  resultRows[0].source_row_sha256 = packetRows[0].source_row_sha256
  resultRows.forEach((row) => {
    row.source_projection_sha256 = sourceProjectionSha256
  })

  await Promise.all([
    writeFile(packetPath, driftedPacketText, 'utf8'),
    writeFile(renderedPromptPath, driftedRenderedPromptText, 'utf8'),
    writeFile(receiptPath, driftedReceiptText, 'utf8'),
    writeFile(indexPath, driftedIndexText, 'utf8'),
    writeFile(resultPath, serializeGoldEnrichmentV3Csv(resultColumns, resultRows), 'utf8'),
  ])
  await writeSyntheticManifestAndRebindExecutionReceipt(runDirectory, manifest)
  return { resultsDirectory, runDirectory }
}

function validationIssues(report: GoldEnrichmentV3ValidationReport): string {
  return report.packets.flatMap((packet) => packet.issues).join('\n')
}

function fullTextAuditRows(): GoldEnrichmentV3FullTextAuditRow[] {
  return Array.from({ length: 56 }, (_, index) => {
    const sourceIndex = index + 1
    const status =
      sourceIndex <= 50 ? 'matched_complete' : sourceIndex === 51 ? 'preview_only' : 'missing'
    const row = blankRecord(GOLD_ENRICHMENT_V3_FULL_TEXT_AUDIT_COLUMNS)
    return {
      ...row,
      master_row_id: String(sourceIndex),
      pmid: String(80_000_000 + sourceIndex),
      title: `Synthetic audit article ${sourceIndex} — UTF-8`,
      physician_final_label: 'include_core',
      metadata_sufficiency: 'adequate_abstract',
      source_group: 'synthetic',
      full_text_status: status,
      full_text_used: String(status === 'matched_complete'),
      full_text_filename: status === 'matched_complete' ? `${80_000_000 + sourceIndex}.pdf` : '',
      full_text_sha256: status === 'matched_complete' ? sha256Bytes(`audit-${sourceIndex}`) : '',
      partial_text_available: String(status === 'preview_only'),
      partial_text_filename: status === 'preview_only' ? 'preview.pdf' : '',
      partial_text_sha256: status === 'preview_only' ? sha256Bytes('preview') : '',
      csvRecordNumber: sourceIndex + 1,
    }
  })
}

function mergedRow(index: number): GoldEnrichmentV3MergedRow {
  const row = blankRecord(GOLD_ENRICHMENT_V3_MERGED_COLUMNS)
  const physicianLabel =
    index <= 300 ? 'include_core' : index <= 330 ? 'include_adjacent' : 'exclude'
  const included = physicianLabel !== 'exclude'
  const coordinatorRequired = index <= 10 || (index >= 301 && index <= 330)
  return {
    ...row,
    workflow_id: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflow_schema_version: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    merged_schema_version: GOLD_ENRICHMENT_V3_MERGED_SCHEMA_VERSION,
    prompt_template_version: GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION,
    result_schema_version: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
    taxonomy_version: GOLD_ENRICHMENT_V3_TAXONOMY_VERSION,
    label_schema_version: GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION,
    enrichment_schema_version: GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
    source_sha256: 'a'.repeat(64),
    source_receipt_sha256: 'b'.repeat(64),
    physician_field_sha256: 'c'.repeat(64),
    result_packet_id: `synthetic-packet-${index}`,
    result_packet_family: included ? 'included_metadata_only' : 'excluded_metadata_sufficiency',
    source_projection_sha256: sha256Bytes(`projection-${index}`),
    source_row_sha256: sha256Bytes(`row-${index}`),
    master_row_id: String(index),
    pmid: String(90_000_000 + index),
    title: `Synthetic merged article ${index} — review`,
    abstract: `Synthetic review abstract ${index}.`,
    journal: 'Synthetic Pulmonology',
    publication_year: '2025',
    physician_final_label: physicianLabel,
    physician_final_confidence: 'high',
    physician_accept_or_modify: 'accept',
    physician_reviewed: 'true',
    decision_provenance: 'human_ai_assisted',
    is_blinded: 'false',
    relevance_review_complete: 'true',
    metadata_sufficiency: 'adequate_abstract',
    topic_ids: included ? 'basic-bronchoscopy' : '',
    technology_tags: included ? 'convex-ebus' : '',
    technology_tag_status: included ? 'tagged' : '',
    clinical_purposes: included ? 'diagnosis' : '',
    disease_tags: included ? 'lung-cancer' : '',
    disease_tag_status: included ? 'tagged' : '',
    study_design: included ? 'randomized-trial' : '',
    publication_status: included ? 'full-article' : '',
    categorization_from_full_text: 'false',
    full_text_used: 'false',
    enrichment_confidence: included ? 'high' : '',
    assessment_confidence: included ? '' : 'high',
    model_requests_physician_enrichment_review: 'false',
    coordinator_requires_physician_enrichment_review: String(coordinatorRequired),
    coordinator_review_reasons: coordinatorRequired ? 'synthetic_required_review' : '',
    evidence_1_field: 'title',
    evidence_1_excerpt: `Synthetic merged article ${index}`,
    enrichment_rationale: 'Synthetic deterministic proposal.',
    processing_status: 'valid',
    external_qa_review_flag: 'false',
    taxonomy_v2_upgrade_review_flag: 'false',
    relevance_concern_review_flag: 'false',
    physician_enrichment_reviewed: 'false',
    protocol_acceptance_authorized: 'false',
    import_ready: 'false',
  }
}

function reviewCandidate(row: GoldEnrichmentV3MergedRow): StringRow {
  return {
    master_row_id: row.master_row_id,
    pmid: row.pmid,
    physician_final_label: row.physician_final_label,
    model_requests_physician_enrichment_review: row.model_requests_physician_enrichment_review,
    coordinator_requires_physician_enrichment_review:
      row.coordinator_requires_physician_enrichment_review,
    coordinator_review_reasons: row.coordinator_review_reasons,
    full_text_evidence_status: 'not_selected',
    expected_full_text_filename: '',
    full_text_file_sha256: '',
    full_text_availability_note: '',
    direct_qa_finding: 'false',
    taxonomy_v2_upgrade_candidate: 'false',
    relevance_concern: 'false',
    v3_qa_or_upgrade_disagreement: 'false',
  }
}

describe('gold enrichment V3 deterministic workflow acceptance', () => {
  it('pins explicit V3/v2 identities and fails closed on synthetic canonical/receipt drift', () => {
    expect({
      workflow: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
      workflowSchema: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
      prompt: GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION,
      result: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
      merged: GOLD_ENRICHMENT_V3_MERGED_SCHEMA_VERSION,
      taxonomy: GOLD_ENRICHMENT_V3_TAXONOMY_VERSION,
      labels: GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION,
      enrichment: GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
    }).toEqual({
      workflow: 'gold-set-v1-enrichment-v3',
      workflowSchema: '3.0.0',
      prompt: '3.0.1',
      result: '3.0.1',
      merged: '3.0.1',
      taxonomy: '2.0.0',
      labels: '2.0.0',
      enrichment: '2.0.0',
    })
    expect(GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_SHA256).toBe(
      'd2942507531a4ba55a5a4195a6919c959eff77cd3473a83eeae16074861b1e64',
    )
    expect(GOLD_ENRICHMENT_V3_CANONICAL_RECEIPT_SHA256).toBe(
      '38a0316ab5a3161bdf502a8e0c8b9c69753386862c858336f4d3e912a6ad21ef',
    )
    expect(GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256).toBe(
      '90b4b198da5803158685a9dd89d3f59578b91bad9bbd14e1cc55ebf5fdc9a01e',
    )
    expect(GOLD_ENRICHMENT_V3_PACKET_MEMBERSHIP_ORDER_SHA256).toBe(
      HISTORICAL_PACKET_MEMBERSHIP_SHA256,
    )
    expect(GOLD_ENRICHMENT_V3_SUPERSEDED_PROMPT_SHA256).toEqual({
      included_metadata_only: '0ebd1906e275b5bbf9017e5c48f5c7de50ab5cc8a4afb836ea7c2e904a531ec7',
      included_full_text: '1d44482548b63533e35f9d78a1602df9d90f5f5a28aad5d25db97c56af62a0e3',
      excluded_metadata_sufficiency:
        '17ed3fe1f5a8d00450ceacefa43071434be23736a3a9c4d8575de9ace8164d9f',
    })
    expect(GOLD_ENRICHMENT_V3_CONFIG_CONTRACT).toMatchObject({
      'config/literature/gold-set-labels.v1.json':
        '554cf8b0b39d5f9be0f89566939c6336e040605dba05b0ddfa0f41c7badd7ac4',
      'config/literature/taxonomy.v1.json':
        '70bcd7aea6d9a135368a05a34bc10643bef1e42ff153a734361eaf94a86eb441',
      'config/literature/enrichment-labels.v2.json':
        '97d33c581b7d72b498ab33b62a2df7d042bf9c8d262d23d87c1c26347d1ec4f9',
      'config/literature/taxonomy.v2.json':
        '078e6fca1abcf074846d7acde9a2554d1751039d31608c40a147e5ee88697c7b',
    })

    const sourceRows = SYNTHETIC_WORKFLOW.sourceRows
    expect(sourceRows).toHaveLength(630)
    expect(new Set(sourceRows.map((row) => row.pmid))).toHaveProperty('size', 630)
    expect(sourceRows.filter((row) => row.physician_final_label !== 'exclude')).toHaveLength(358)
    expect(sourceRows.filter((row) => row.physician_final_label === 'exclude')).toHaveLength(272)
    const physicianHash = goldEnrichmentV3PhysicianFieldSha256(sourceRows)
    expect(physicianHash).toMatch(/^[a-f0-9]{64}$/u)
    expect(
      goldEnrichmentV3PhysicianFieldSha256([
        { ...sourceRows[0], physician_final_label: 'exclude' },
        ...sourceRows.slice(1),
      ]),
    ).not.toBe(physicianHash)

    const syntheticSource = serializeGoldEnrichmentV3Csv(
      GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_COLUMNS,
      sourceRows,
    )
    expect(() => parseGoldEnrichmentV3CanonicalSource(syntheticSource)).toThrow(
      'Physician-field checksum mismatch',
    )

    const sourceBytes = Buffer.byteLength(syntheticSource)
    const receipt = {
      batch: { name: 'gold-set-v1', datasetSplit: 'development', rows: 630 },
      output: {
        rows: 630,
        bytes: sourceBytes,
        sha256: GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_SHA256,
      },
      physicianFieldIntegrity: {
        expectedSha256: GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256,
        inputSha256: GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256,
        outputSha256: GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256,
        unchanged: true,
      },
      safety: {
        developmentOnly: true,
        heldOutTestAccessed: false,
        physicianDecisionsChanged: false,
        databaseMutationOperations: [],
        mutationPlan: null,
      },
    }
    expect(validateGoldEnrichmentV3CanonicalReceipt(JSON.stringify(receipt), sourceBytes)).toEqual(
      receipt,
    )
    expect(() =>
      validateGoldEnrichmentV3CanonicalReceipt(
        JSON.stringify({
          ...receipt,
          output: { ...receipt.output, sha256: '0'.repeat(64) },
        }),
        sourceBytes,
      ),
    ).toThrow('output identity')
  })

  it('removes all article identities and coordinator-only review triggers from classification prompts', () => {
    const prompts = classificationPromptTexts()
    const developmentPmids = SYNTHETIC_WORKFLOW.sourceRows.map((row) => row.pmid)
    for (const [filename, prompt] of prompts) {
      expect(sha256Bytes(prompt)).not.toBe(SUPERSEDED_PROMPT_SHA256.get(filename))
      expect(prompt.match(/(?<![0-9])[0-9]{7,9}(?![0-9])/gu)).toBeNull()
      for (const pmid of developmentPmids) {
        expect(containsStandaloneIdentifier(prompt, pmid)).toBe(false)
      }
      expect(prompt).not.toMatch(/Required Review/iu)
      expect(prompt).not.toMatch(/protocol-designated|relevance-concern record/iu)
      expect(prompt).not.toMatch(/include_adjacent/iu)
      expect(prompt).not.toMatch(/external[- ]QA|taxonomy[- ]upgrade candidate/iu)
      expect(prompt).not.toMatch(/sampling (?:stratum|rationale)|screening score|prior AI/iu)
      expect(prompt).not.toMatch(/\bLVRS\b|surgery[- ]only|false[- ]positive|forbidden topic/iu)
      expect(prompt).not.toMatch(/requires_physician_enrichment_review/iu)
      expect(prompt).not.toMatch(
        /(?:full[-_ ]text|manifest).{0,100}(?:mandatory|required|must).{0,60}review/isu,
      )
      expect(prompt).not.toMatch(
        /physician(?:_final)?_confidence.{0,100}(?:mandatory|required|must).{0,60}review/isu,
      )
    }
    expect(goldEnrichmentV3ForbiddenPromptPhraseLabels('required_review')).toContain(
      'Required Review',
    )
    expect(
      goldEnrichmentV3ForbiddenPromptPhraseLabels(
        'full_text_manifest membership must trigger physician review',
      ),
    ).toContain('full-text-membership mandatory review mapping')
  })

  it('does not mechanically map excluded metadata status or confidence to model review', () => {
    const prompt = classificationPromptTexts().get('excluded-metadata-sufficiency.md')!
    expect(prompt).toMatch(
      /set it to `true` only when the supplied metadata leaves unresolved material ambiguity\s+or is internally conflicting/isu,
    )
    expect(prompt).toMatch(
      /do not derive it mechanically from.*metadata sufficiency, assessment\s+confidence/isu,
    )
    expect(prompt).not.toMatch(
      /(?:limited_abstract|no_abstract|conflicting_metadata|moderate|low).{0,100}(?:requires?|must|set).{0,40}(?:review|true)/isu,
    )
    expect(prompt).not.toMatch(
      /(?:review|true).{0,40}(?:when|if|for).{0,100}(?:limited_abstract|no_abstract|conflicting_metadata|moderate|low)/isu,
    )
  })

  it('makes physician fields immutable copy-only audit fields and the model flag independent', () => {
    for (const prompt of classificationPromptTexts().values()) {
      expect(prompt).toMatch(/physician.*label.*confidence.*audit fields to copy verbatim/isu)
      expect(prompt).toMatch(/not evidence or predictive signals/iu)
      expect(prompt).toMatch(/must not\s+influence\s+metadata sufficiency/iu)
      expect(prompt).toMatch(/model's independent review request/iu)
      expect(prompt).toMatch(/processing status/iu)
      expect(prompt).toMatch(/model_requests_physician_enrichment_review/iu)
      expect(prompt).toMatch(/independent self-assessment/iu)
      expect(prompt).toMatch(/unresolved material ambiguity|internally conflicting/iu)
      expect(prompt).toMatch(/processing_status=error/iu)
      expect(prompt).toMatch(/model_requests_physician_enrichment_review=true/iu)
    }
  })

  it('limits classification-template substitutions to the explicit packet bindings', () => {
    for (const prompt of classificationPromptTexts().values()) {
      const placeholders = [...prompt.matchAll(/\{\{([A-Z0-9_]+)\}\}/gu)].map((match) => match[1])
      expect([...new Set(placeholders)].sort()).toEqual([
        'EXPECTED_OUTPUT_FILENAME',
        'PACKET_ID',
        'SOURCE_PROJECTION_SHA256',
      ])
    }
  })

  it('keeps the V3 CLI file-only with no model, network, database, import, or held-out option', async () => {
    for (const option of ['model', 'network', 'database', 'import', 'openai', 'worker', 'ultra']) {
      await expect(
        runGoldEnrichmentV3Cli(['prepare', `--${option}`], process.cwd()),
      ).rejects.toThrow('Forbidden held-out/mutation/model option')
    }
  })

  it('separates complete, preview-only, and missing full-text states at the packet boundary', () => {
    const auditRows = fullTextAuditRows()
    const auditCsv = serializeGoldEnrichmentV3Csv(
      GOLD_ENRICHMENT_V3_FULL_TEXT_AUDIT_COLUMNS,
      auditRows,
    )
    const parsed = parseGoldEnrichmentV3FullTextAudit(auditCsv)
    expect(parsed.filter((row) => row.full_text_status === 'matched_complete')).toHaveLength(50)
    expect(parsed.filter((row) => row.full_text_status === 'preview_only')).toHaveLength(1)
    expect(parsed.filter((row) => row.full_text_status === 'missing')).toHaveLength(5)
    expect(parsed[0].title).toContain('— UTF-8')

    const usageMismatch = auditRows.map((row) => ({ ...row }))
    usageMismatch[PREVIEW_SOURCE_INDEX - 1].full_text_used = 'true'
    expect(() =>
      parseGoldEnrichmentV3FullTextAudit(
        serializeGoldEnrichmentV3Csv(GOLD_ENRICHMENT_V3_FULL_TEXT_AUDIT_COLUMNS, usageMismatch),
      ),
    ).toThrow('usage/status mismatch')
    const countMismatch = auditRows.map((row) => ({ ...row }))
    countMismatch[FIRST_MISSING_SOURCE_INDEX - 1].full_text_status = 'preview_only'
    expect(() =>
      parseGoldEnrichmentV3FullTextAudit(
        serializeGoldEnrichmentV3Csv(GOLD_ENRICHMENT_V3_FULL_TEXT_AUDIT_COLUMNS, countMismatch),
      ),
    ).toThrow('counts do not match')

    const families = buildGoldEnrichmentV3PacketRows(
      SYNTHETIC_WORKFLOW.sourceRows,
      SYNTHETIC_WORKFLOW.registryRows,
    )
    expect(families.included_metadata_only).toHaveLength(308)
    expect(families.included_full_text).toHaveLength(50)
    expect(families.excluded_metadata_sufficiency).toHaveLength(272)
    const previewPmid = SYNTHETIC_WORKFLOW.sourceRows[PREVIEW_SOURCE_INDEX - 1].pmid
    const missingPmids = new Set(
      SYNTHETIC_WORKFLOW.sourceRows
        .slice(FIRST_MISSING_SOURCE_INDEX - 1, LAST_MISSING_SOURCE_INDEX)
        .map((row) => row.pmid),
    )
    const metadataByPmid = new Map(
      families.included_metadata_only.map((row) => [row.source.pmid, row]),
    )
    expect(metadataByPmid.get(previewPmid)).toBeDefined()
    expect(metadataByPmid.get(previewPmid)?.source).not.toHaveProperty('full_text_evidence_status')
    expect(metadataByPmid.get(previewPmid)?.source).not.toHaveProperty('expected_full_text_sha256')
    for (const pmid of missingPmids) {
      expect(metadataByPmid.get(pmid)).toBeDefined()
      expect(metadataByPmid.get(pmid)?.source).not.toHaveProperty('full_text_evidence_status')
      expect(metadataByPmid.get(pmid)?.source).not.toHaveProperty('expected_full_text_sha256')
    }
    expect(families.included_full_text.every((row) => row.source.expected_full_text_sha256)).toBe(
      true,
    )
  })

  it('packetizes deterministically with exact order, sizes, hashes, receipts, and source binding', () => {
    const packets = SYNTHETIC_WORKFLOW.packets
    const promptArtifacts = artifactIdentities('prompt')
    const developmentPmids = SYNTHETIC_WORKFLOW.sourceRows.map((row) => row.pmid)
    const normalizedPrompts = new Map<GoldEnrichmentV3PacketFamily, Set<string>>()
    expect(packets).toHaveLength(20)
    expect(
      Object.fromEntries(
        GOLD_ENRICHMENT_V3_PACKET_FAMILIES.map((family) => [
          family,
          goldEnrichmentV3PacketColumns(family).length,
        ]),
      ),
    ).toEqual({
      included_metadata_only: 27,
      included_full_text: 29,
      excluded_metadata_sufficiency: 27,
    })
    expect(packets.map((packet) => packet.receipt.packetFamily)).toEqual([
      ...Array<GoldEnrichmentV3PacketFamily>(7).fill('included_metadata_only'),
      ...Array<GoldEnrichmentV3PacketFamily>(10).fill('included_full_text'),
      ...Array<GoldEnrichmentV3PacketFamily>(3).fill('excluded_metadata_sufficiency'),
    ])
    expect(packets.map((packet) => packet.receipt.rowCount)).toEqual([
      50, 50, 50, 50, 50, 50, 8, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 100, 100, 72,
    ])

    for (const packet of packets) {
      expect(
        [packet.csvPath, packet.renderedPrompt.path, packet.receiptPath].every(
          (value) => !value.endsWith('.pdf'),
        ),
      ).toBe(true)
      expect(packet.csv).not.toContain('%PDF-')
      const packetColumns = goldEnrichmentV3PacketColumns(packet.receipt.packetFamily)
      const packetSourceColumns = goldEnrichmentV3PacketSourceColumns(packet.receipt.packetFamily)
      expect(packetColumns).toHaveLength(
        packet.receipt.packetFamily === 'included_full_text' ? 29 : 27,
      )
      expect(parseCsvRows(packet.csv)[0]).toEqual(packetColumns)
      const rows = csvObjects(packet.csv, packetColumns)
      expect(Buffer.byteLength(packet.csv)).toBe(packet.receipt.packetCsv.bytes)
      expect(sha256Bytes(packet.csv)).toBe(packet.receipt.packetCsv.sha256)
      expect(packet.receipt.orderedKeys).toEqual(
        rows.map((row) => ({
          masterRowId: row.master_row_id,
          pmid: row.pmid,
          sourceRowSha256: row.source_row_sha256,
        })),
      )
      rows.forEach((row) => {
        const source = Object.fromEntries(
          packetSourceColumns.map((column) => [column, row[column]]),
        )
        expect(row.source_row_sha256).toBe(sha256Bytes(serializeGoldEnrichmentV3Json(source)))
        expect(row.source_projection_sha256).toBe(packet.receipt.sourceProjectionSha256)
      })
      const projection = {
        columns: packetSourceColumns,
        rows: rows.map((row) => packetSourceColumns.map((column) => row[column])),
      }
      expect(packet.receipt.sourceProjectionSha256).toBe(
        sha256Bytes(serializeGoldEnrichmentV3Json(projection)),
      )
      expect(sha256Bytes(serializeGoldEnrichmentV3Json(packet.receipt))).toMatch(/^[a-f0-9]{64}$/u)
      for (const forbiddenColumn of [
        'metadata_sufficiency_constraint',
        'full_text_evidence_status',
        'required_review',
        'required_review_reasons',
        'coordinator_requires_physician_enrichment_review',
        'coordinator_review_reasons',
        'external_qa_findings',
        'external_qa_severity',
        'taxonomy_v2_upgrade_candidates',
        'relevance_concern',
        'review_reasons',
        'sampling_stratum',
        'sampling_rationale',
        'screening_score',
        'prior_ai_enrichment',
        'prior_enrichment',
      ]) {
        expect(rows[0]).not.toHaveProperty(forbiddenColumn)
      }

      expect(packet.renderedPrompt.path).toBe(packet.receipt.modelFacingPrompt.path)
      expect(Buffer.byteLength(packet.renderedPrompt.text)).toBe(
        packet.receipt.modelFacingPrompt.bytes,
      )
      expect(sha256Bytes(packet.renderedPrompt.text)).toBe(packet.receipt.modelFacingPrompt.sha256)
      expect(packet.renderedPrompt.text).not.toMatch(/\{\{[A-Z0-9_]+\}\}/u)
      for (const pmid of developmentPmids) {
        expect(containsStandaloneIdentifier(packet.renderedPrompt.text, pmid)).toBe(false)
      }
      expect(packet.renderedPrompt.text).not.toMatch(/Required Review/iu)
      expect(packet.renderedPrompt.text).not.toMatch(/protocol-designated|relevance-concern/iu)
      expect(packet.renderedPrompt.text).not.toMatch(/hard[- ]case|QA target|upgrade candidate/iu)
      expect(packet.renderedPrompt.text).not.toMatch(
        /include_adjacent.{0,100}(?:mandatory|required|must).{0,40}review/isu,
      )
      expect(packet.renderedPrompt.text).not.toMatch(
        /physician.{0,30}confidence.{0,100}(?:mandatory|required|must).{0,40}review/isu,
      )
      expect(packet.renderedPrompt.text).not.toMatch(
        /full[- ]text.{0,60}(?:manifest|membership).{0,100}(?:mandatory|required|must).{0,40}review/isu,
      )
      const normalizedPrompt = packet.renderedPrompt.text
        .replaceAll(packet.receipt.expectedOutputFilename, '{{EXPECTED_OUTPUT_FILENAME}}')
        .replaceAll(packet.receipt.sourceProjectionSha256, '{{SOURCE_PROJECTION_SHA256}}')
        .replaceAll(packet.receipt.packetId, '{{PACKET_ID}}')
      expect(normalizedPrompt).toBe(promptArtifacts[packet.receipt.packetFamily].text)
      const familyNormalized =
        normalizedPrompts.get(packet.receipt.packetFamily) ?? new Set<string>()
      familyNormalized.add(normalizedPrompt)
      normalizedPrompts.set(packet.receipt.packetFamily, familyNormalized)

      if (packet.receipt.packetFamily === 'included_full_text') {
        expect(
          rows.every((row) => row.expected_full_text_filename && row.expected_full_text_sha256),
        ).toBe(true)
        expect(packet.modelFacingFullTextManifest).toBeDefined()
        expect(packet.receipt.modelFacingFullTextManifest).toMatchObject({
          path: packet.modelFacingFullTextManifest?.path,
          bytes: Buffer.byteLength(packet.modelFacingFullTextManifest?.text ?? ''),
          sha256: sha256Bytes(packet.modelFacingFullTextManifest?.text ?? ''),
        })
        const manifest = JSON.parse(packet.modelFacingFullTextManifest!.text) as {
          workflowId: string
          workflowSchemaVersion: string
          promptTemplateVersion: string
          resultSchemaVersion: string
          packetId: string
          packetFamily: string
          sourceProjectionSha256: string
          attachments: Array<Record<string, string | number>>
        }
        expect(Object.keys(manifest).sort()).toEqual([
          'attachments',
          'packetFamily',
          'packetId',
          'promptTemplateVersion',
          'resultSchemaVersion',
          'sourceProjectionSha256',
          'workflowId',
          'workflowSchemaVersion',
        ])
        expect(manifest).toMatchObject({
          workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
          workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
          promptTemplateVersion: GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION,
          resultSchemaVersion: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
          packetId: packet.receipt.packetId,
          packetFamily: packet.receipt.packetFamily,
          sourceProjectionSha256: packet.receipt.sourceProjectionSha256,
        })
        expect(manifest.attachments).toHaveLength(packet.receipt.rowCount)
        manifest.attachments.forEach((attachment, index) => {
          expect(Object.keys(attachment).sort()).toEqual([
            'bytes',
            'filename',
            'masterRowId',
            'pmid',
            'sha256',
            'title',
          ])
          expect(attachment).toMatchObject({
            masterRowId: packet.receipt.orderedKeys[index].masterRowId,
            pmid: packet.receipt.orderedKeys[index].pmid,
            title: rows[index].title,
            filename: rows[index].expected_full_text_filename,
            sha256: rows[index].expected_full_text_sha256,
          })
          expect(attachment.bytes).toBeGreaterThan(0)
        })
      } else {
        expect(rows[0]).not.toHaveProperty('expected_full_text_filename')
        expect(rows[0]).not.toHaveProperty('expected_full_text_sha256')
        expect(packet.modelFacingFullTextManifest).toBeUndefined()
        expect(packet.receipt.modelFacingFullTextManifest).toBeUndefined()
      }
    }

    expect(
      Object.fromEntries([...normalizedPrompts].map(([family, prompts]) => [family, prompts.size])),
    ).toEqual({
      included_metadata_only: 1,
      included_full_text: 1,
      excluded_metadata_sufficiency: 1,
    })

    const rebuilt = buildSyntheticWorkflow().packets
    expect(rebuilt).toEqual(packets)
    expect(rebuilt.map((packet) => sha256Bytes(packet.csv))).toEqual(
      packets.map((packet) => sha256Bytes(packet.csv)),
    )
    const firstMembershipProjection = goldEnrichmentV3PacketMembershipOrderProjection(packets)
    const rebuiltMembershipProjection = goldEnrichmentV3PacketMembershipOrderProjection(rebuilt)
    expect(rebuiltMembershipProjection).toBe(firstMembershipProjection)
    expect(sha256Bytes(rebuiltMembershipProjection)).toBe(sha256Bytes(firstMembershipProjection))
    expect(GOLD_ENRICHMENT_V3_PACKET_MEMBERSHIP_ORDER_SHA256).toBe(
      HISTORICAL_PACKET_MEMBERSHIP_SHA256,
    )
    expect(HISTORICAL_PACKET_MEMBERSHIP_BYTES).toBe(27_137)
  })

  it('validates complete synthetic results and rejects every fail-closed result boundary', async () => {
    const fixture = await materializeValidationFixture()
    try {
      const baseline = await validateFixture(fixture)
      expect(baseline.report).toMatchObject({
        complete: true,
        valid: true,
        packetCoverage: {
          expectedPackets: 20,
          presentPackets: 20,
          validPackets: 20,
          expectedRows: 630,
          validRows: 630,
          missingResultFiles: [],
          unrecognizedResultFiles: [],
        },
        safety: {
          rawResultsModified: false,
          silentCorrections: false,
          databaseWrites: 0,
          modelCalls: 0,
          heldOutTestAccessed: false,
        },
      })
      expect(baseline.rows).toHaveLength(630)
      expect(
        baseline.rows.every(
          (row) => row.raw.model_requests_physician_enrichment_review === 'false',
        ),
      ).toBe(true)

      const metadataFile = [...fixture.files.values()].find(
        (file) => file.family === 'included_metadata_only',
      )!
      const fullTextFile = [...fixture.files.values()].find(
        (file) => file.family === 'included_full_text',
      )!
      const excludedFile = [...fixture.files.values()].find(
        (file) => file.family === 'excluded_metadata_sufficiency',
      )!

      const expectRejectedMutation = async (
        file: SyntheticResultFile,
        mutate: (rows: StringRow[]) => void,
        expectedIssue: RegExp,
      ) => {
        await writeMutatedResult(fixture, file, mutate)
        const rejected = await validateFixture(fixture)
        expect(rejected.report.valid).toBe(false)
        expect(rejected.rows).toEqual([])
        expect(validationIssues(rejected.report)).toMatch(expectedIssue)
        await restoreResult(fixture, file)
      }

      await writeMutatedResult(fixture, excludedFile, (rows) => {
        rows[0].metadata_sufficiency = 'limited_abstract'
        rows[0].assessment_confidence = 'low'
        rows[0].model_requests_physician_enrichment_review = 'false'
      })
      const independentExcludedFlag = await validateFixture(fixture)
      expect(independentExcludedFlag.report.valid).toBe(true)
      expect(independentExcludedFlag.rows).toHaveLength(630)
      await restoreResult(fixture, excludedFile)

      await writeFile(
        path.join(fixture.resultsDirectory, metadataFile.filename),
        metadataFile.text.replace('"packet_id"', '"unexpected_header"'),
        'utf8',
      )
      let rejected = await validateFixture(fixture)
      expect(validationIssues(rejected.report)).toMatch(/header does not match/iu)
      await restoreResult(fixture, metadataFile)

      await expectRejectedMutation(
        metadataFile,
        (rows) => {
          rows[0].prompt_template_version = '3.0.0'
        },
        /version, packet, or source-projection binding/iu,
      )
      await expectRejectedMutation(
        metadataFile,
        (rows) => {
          rows[0].result_schema_version = '3.0.0'
        },
        /version, packet, or source-projection binding/iu,
      )
      await expectRejectedMutation(
        metadataFile,
        (rows) => {
          rows[0].source_row_sha256 = '0'.repeat(64)
        },
        /identifiers or canonical source-row hash changed/iu,
      )
      await expectRejectedMutation(
        metadataFile,
        (rows) => {
          rows[0].pmid = '999999999'
        },
        /identifiers or canonical source-row hash changed/iu,
      )
      await expectRejectedMutation(
        metadataFile,
        (rows) => {
          rows[0].physician_final_label = 'exclude'
        },
        /immutable physician relevance fields/iu,
      )
      await expectRejectedMutation(
        metadataFile,
        (rows) => {
          rows[0].topic_ids = 'not-a-v2-topic'
        },
        /(?:Unsupported.*topic_ids|topic_ids.*must match pattern)/iu,
      )
      await expectRejectedMutation(
        metadataFile,
        (rows) => {
          rows[0].technology_tags = ''
        },
        /technology_tag_status must be.*when technology_tags is empty/iu,
      )
      await expectRejectedMutation(
        metadataFile,
        (rows) => {
          rows[0].technology_tag_status = 'legacy_unspecified'
        },
        /legacy_unspecified is invalid/iu,
      )
      await expectRejectedMutation(
        metadataFile,
        (rows) => {
          rows[0].clinical_purposes = ''
        },
        /too small|at least 1|Array must contain/iu,
      )
      await expectRejectedMutation(
        metadataFile,
        (rows) => {
          rows[0].full_text_used = 'true'
        },
        /Metadata-only result must keep both full-text flags false/iu,
      )
      await expectRejectedMutation(
        metadataFile,
        (rows) => {
          rows[0].evidence_1_excerpt = 'not present in any source field'
        },
        /Evidence excerpt is not verbatim/iu,
      )
      await expectRejectedMutation(
        metadataFile,
        (rows) => {
          rows[0].metadata_sufficiency = 'no_abstract'
        },
        /source with a supplied abstract cannot use metadata_sufficiency=no_abstract/iu,
      )
      await expectRejectedMutation(
        metadataFile,
        (rows) => {
          rows[0].enrichment_rationale = 'x'.repeat(4001)
        },
        /Result schema validation failed.*enrichment_rationale.*must NOT have more than 4000/iu,
      )
      await expectRejectedMutation(
        fullTextFile,
        (rows) => {
          rows[0].full_text_used = 'false'
        },
        /Complete-full-text result must set both full-text flags true/iu,
      )
      await expectRejectedMutation(
        fullTextFile,
        (rows) => {
          rows[0].full_text_sha256 = '0'.repeat(64)
        },
        /file identity does not match the packet manifest/iu,
      )
      await expectRejectedMutation(
        metadataFile,
        (rows) => {
          Object.assign(rows[1], {
            master_row_id: rows[0].master_row_id,
            pmid: rows[0].pmid,
            source_row_sha256: rows[0].source_row_sha256,
          })
        },
        /duplicate identifier/iu,
      )

      const hardRows = metadataFile.rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => ['41229759', '18453348'].includes(row.pmid))
      expect(hardRows).toHaveLength(2)
      await expectRejectedMutation(
        metadataFile,
        (rows) => {
          hardRows.forEach(({ index }) => {
            rows[index].topic_ids = 'bronchoscopic-lung-volume-reduction'
          })
        },
        /LVRS false-positive topic is forbidden/iu,
      )

      await writeMutatedResult(fixture, metadataFile, (rows) => {
        rows.pop()
      })
      rejected = await validateFixture(fixture)
      expect(validationIssues(rejected.report)).toMatch(/row_count_mismatch/iu)
      expect(validationIssues(rejected.report)).toMatch(/result_missing_expected_rows/iu)
      await restoreResult(fixture, metadataFile)

      await unlink(path.join(fixture.resultsDirectory, metadataFile.filename))
      rejected = await validateFixture(fixture)
      expect(rejected.report.complete).toBe(false)
      expect(rejected.report.packetCoverage.missingResultFiles).toContain(metadataFile.filename)
      await restoreResult(fixture, metadataFile)

      const extraFilename = 'unexpected-extra.result.csv'
      await writeFile(
        path.join(fixture.resultsDirectory, extraFilename),
        '"unexpected"\r\n',
        'utf8',
      )
      rejected = await validateFixture(fixture)
      expect(rejected.report.valid).toBe(false)
      expect(rejected.report.packetCoverage.unrecognizedResultFiles).toEqual([extraFilename])
      await unlink(path.join(fixture.resultsDirectory, extraFilename))

      await writeFile(
        path.join(fixture.resultsDirectory, metadataFile.filename),
        Buffer.from([0xff, 0xfe, 0xfd]),
      )
      rejected = await validateFixture(fixture)
      expect(validationIssues(rejected.report)).toMatch(/strict UTF-8/iu)
      await restoreResult(fixture, metadataFile)
    } finally {
      await rm(fixture.root, { recursive: true, force: true })
    }
  }, 60_000)

  it('raw-merges validated outputs without coordinator inputs, decisions, or value changes', async () => {
    const fixture = await materializeValidationFixture()
    const localData = path.join(fixture.root, 'local-data')
    const outputDirectory = path.join(localData, 'literature', 'raw-merge')
    await mkdir(localData, { recursive: true })
    try {
      const validated = await validateFixture(fixture)
      const first = await mergeGoldEnrichmentV3RawResults({
        runDirectory: fixture.runDirectory,
        resultsDirectory: fixture.resultsDirectory,
        outputDirectory,
        workspaceRoot: fixture.root,
      })
      const repeated = await mergeGoldEnrichmentV3RawResults({
        runDirectory: fixture.runDirectory,
        resultsDirectory: fixture.resultsDirectory,
        outputDirectory,
        workspaceRoot: fixture.root,
      })
      expect(first.rows).toHaveLength(630)
      expect(repeated.rows).toEqual(first.rows)
      expect(repeated.rawMergedArtifact.sha256).toBe(first.rawMergedArtifact.sha256)
      expect(first.artifacts.every((artifact) => artifact.publication === 'created')).toBe(true)
      expect(
        repeated.artifacts.every((artifact) => artifact.publication === 'verified_existing'),
      ).toBe(true)
      expect(GOLD_ENRICHMENT_V3_RAW_MERGED_COLUMNS).toHaveLength(42)
      expect(GOLD_ENRICHMENT_V3_RAW_MERGED_COLUMNS).not.toEqual(
        expect.arrayContaining([
          'coordinator_requires_physician_enrichment_review',
          'coordinator_review_reasons',
          'external_qa_review_flag',
          'taxonomy_v2_upgrade_review_flag',
          'relevance_concern_review_flag',
          'prior_enrichment',
        ]),
      )
      first.rows.forEach((row, index) => {
        const original = validated.rows[index]
        expect(original).toBeDefined()
        const familyColumns = new Set(resultColumns(original.family))
        for (const column of GOLD_ENRICHMENT_V3_RAW_MERGED_COLUMNS) {
          expect(row[column]).toBe(
            familyColumns.has(column) ? (original.raw as Record<string, string>)[column] : '',
          )
        }
      })
      const rawMergedText = await readFile(
        path.join(outputDirectory, 'gold-set-v1-enrichment-v3-raw-merged.csv'),
        'utf8',
      )
      expect(csvObjects(rawMergedText, GOLD_ENRICHMENT_V3_RAW_MERGED_COLUMNS)).toEqual(first.rows)
      const receipt = JSON.parse(
        await readFile(
          path.join(outputDirectory, 'gold-set-v1-enrichment-v3-raw-merged.receipt.json'),
          'utf8',
        ),
      ) as {
        rawMergeSchemaVersion: string
        safety: Record<string, boolean | number>
      }
      expect(receipt.rawMergeSchemaVersion).toBe('1.0.0')
      expect(receipt.safety).toEqual({
        rawResultValuesChanged: false,
        addedBlankUnionColumnsOnly: true,
        priorEnrichmentRead: false,
        externalQaRead: false,
        taxonomyUpgradePlanRead: false,
        coordinatorReviewEligibilityComputed: false,
        enrichmentValuesChanged: false,
        physicianRelevanceChanged: false,
        modelCalls: 0,
        networkRequests: 0,
        databaseWrites: 0,
        importRowsCreated: 0,
        heldOutTestAccessed: false,
      })
      for (const forbiddenOption of ['prior-enrichment', 'qa-findings', 'upgrade-plan']) {
        await expect(
          runGoldEnrichmentV3Cli(
            [
              'merge-raw',
              '--run-dir',
              fixture.runDirectory,
              '--results-dir',
              fixture.resultsDirectory,
              '--output-dir',
              outputDirectory,
              `--${forbiddenOption}`,
              'forbidden',
            ],
            fixture.root,
          ),
        ).rejects.toThrow(/unknown option/iu)
      }
    } finally {
      await rm(fixture.root, { recursive: true, force: true })
    }
  }, 60_000)

  it('rejects packet/receipt checksum drift and forbidden held-out path semantics', async () => {
    const fixture = await materializeValidationFixture()
    try {
      const packet = SYNTHETIC_WORKFLOW.packets[0]
      const packetPath = path.join(fixture.runDirectory, packet.csvPath)
      await writeFile(packetPath, `${packet.csv}\n`, 'utf8')
      await expect(validateFixture(fixture)).rejects.toThrow('does not match the artifact manifest')
      await writeFile(packetPath, packet.csv, 'utf8')

      const receiptPath = path.join(fixture.runDirectory, packet.receiptPath)
      const receipt = serializeGoldEnrichmentV3Json(packet.receipt)
      await writeFile(receiptPath, `${receipt}\n`, 'utf8')
      await expect(validateFixture(fixture)).rejects.toThrow('does not match the artifact manifest')
      await writeFile(receiptPath, receipt, 'utf8')

      const promptPath = path.join(fixture.runDirectory, packet.receipt.promptTemplate.path)
      const prompt = await readFile(promptPath)
      await writeFile(promptPath, Buffer.concat([prompt, Buffer.from('\n')]))
      await expect(validateFixture(fixture)).rejects.toThrow('does not match the artifact manifest')
      await writeFile(promptPath, prompt)

      const schemaPath = path.join(fixture.runDirectory, packet.receipt.expectedResultSchema.path)
      const schema = await readFile(schemaPath)
      await writeFile(schemaPath, Buffer.concat([schema, Buffer.from('\n')]))
      await expect(validateFixture(fixture)).rejects.toThrow('does not match the artifact manifest')
      await writeFile(schemaPath, schema)

      const runDefinitionPath = path.join(fixture.runDirectory, 'run-definition.json')
      const runDefinition = await readFile(runDefinitionPath)
      await writeFile(runDefinitionPath, Buffer.concat([runDefinition, Buffer.from('\n')]))
      await expect(validateFixture(fixture)).rejects.toThrow('does not match the artifact manifest')
      await writeFile(runDefinitionPath, runDefinition)

      const missingReceiptRun = path.join(fixture.root, 'missing-receipt-run')
      await cp(fixture.runDirectory, missingReceiptRun, { recursive: true })
      await rm(path.join(missingReceiptRun, 'execution-receipts'), {
        recursive: true,
        force: true,
      })
      await expect(
        validateGoldEnrichmentV3Results({
          runDirectory: missingReceiptRun,
          resultsDirectory: fixture.resultsDirectory,
          workspaceRoot: fixture.root,
          publishReports: false,
        }),
      ).rejects.toThrow('Execution receipt directory is missing')

      const driftedReceiptRun = path.join(fixture.root, 'drifted-receipt-run')
      await cp(fixture.runDirectory, driftedReceiptRun, { recursive: true })
      const [executionReceiptFilename] = await readdir(
        path.join(driftedReceiptRun, 'execution-receipts'),
      )
      const driftedReceiptPath = path.join(
        driftedReceiptRun,
        'execution-receipts',
        executionReceiptFilename,
      )
      const driftedReceipt = JSON.parse(await readFile(driftedReceiptPath, 'utf8')) as Record<
        string,
        unknown
      >
      ;(driftedReceipt.canonicalManifest as Record<string, unknown>).sha256 = '0'.repeat(64)
      await writeFile(driftedReceiptPath, serializeGoldEnrichmentV3Json(driftedReceipt), 'utf8')
      await expect(
        validateGoldEnrichmentV3Results({
          runDirectory: driftedReceiptRun,
          resultsDirectory: fixture.resultsDirectory,
          workspaceRoot: fixture.root,
          publishReports: false,
        }),
      ).rejects.toThrow('does not bind the canonical preparation')

      const badManifestRun = path.join(fixture.root, 'bad-manifest-run')
      await cp(fixture.runDirectory, badManifestRun, { recursive: true })
      const badManifestPath = path.join(badManifestRun, 'artifact-manifest.json')
      const badManifest = JSON.parse(
        await readFile(badManifestPath, 'utf8'),
      ) as SyntheticCanonicalManifest
      badManifest.canonicalFileCount -= 1
      await writeFile(badManifestPath, serializeGoldEnrichmentV3Json(badManifest), 'utf8')
      await expect(
        validateGoldEnrichmentV3Results({
          runDirectory: badManifestRun,
          resultsDirectory: fixture.resultsDirectory,
          workspaceRoot: fixture.root,
          publishReports: false,
        }),
      ).rejects.toThrow('Artifact manifest does not match the V3 workflow contract')

      const forbiddenTarget = path.join(fixture.root, 'held-out-shadow')
      const safeAlias = path.join(fixture.root, 'safe-run-alias')
      await cp(fixture.runDirectory, forbiddenTarget, { recursive: true })
      await symlink(forbiddenTarget, safeAlias)
      await expect(
        validateGoldEnrichmentV3Results({
          runDirectory: safeAlias,
          resultsDirectory: fixture.resultsDirectory,
          workspaceRoot: fixture.root,
          publishReports: false,
        }),
      ).rejects.toThrow('resolved path has held-out/test/all semantics')

      const forbiddenResultsParent = path.join(fixture.root, 'held-out-results-shadow')
      const forbiddenResultsDirectory = path.join(forbiddenResultsParent, 'returned')
      const safeResultsParentAlias = path.join(fixture.root, 'safe-results-parent')
      await mkdir(forbiddenResultsParent, { recursive: true })
      await cp(fixture.resultsDirectory, forbiddenResultsDirectory, { recursive: true })
      await symlink(forbiddenResultsParent, safeResultsParentAlias)
      await expect(
        validateGoldEnrichmentV3Results({
          runDirectory: fixture.runDirectory,
          resultsDirectory: path.join(safeResultsParentAlias, 'returned'),
          workspaceRoot: fixture.root,
          publishReports: false,
        }),
      ).rejects.toThrow(
        'Results directory resolved path has held-out/test/all semantics and is forbidden',
      )

      await expect(
        validateGoldEnrichmentV3Results({
          runDirectory: path.join(fixture.root, 'held-out'),
          resultsDirectory: fixture.resultsDirectory,
          workspaceRoot: fixture.root,
          publishReports: false,
        }),
      ).rejects.toThrow('held-out/test/all semantics')
    } finally {
      await rm(fixture.root, { recursive: true, force: true })
    }
  })

  it('builds deterministic disjoint review/QC cohorts and byte-identical XLSX files', async () => {
    const mergedRows = Array.from({ length: 630 }, (_, index) => mergedRow(index + 1))
    const candidates = mergedRows.map(reviewCandidate)
    const options = {
      candidates,
      mergedRows,
      qaConcerns: new Map([[mergedRows[0].pmid, 'Synthetic QA concern; never auto-applied.']]),
      upgradeConcerns: new Map([
        [mergedRows[300].pmid, 'Synthetic taxonomy-v2 candidate; physician review only.'],
      ]),
    }
    const first = buildGoldEnrichmentV3ReviewCohorts(options)
    const second = buildGoldEnrichmentV3ReviewCohorts(options)
    expect(second).toEqual(first)
    expect(first.required_review).toHaveLength(40)
    expect(first.qc_sample_50).toHaveLength(50)
    expect(
      first.qc_sample_50.filter((row) => row.physician_final_label === 'include_core'),
    ).toHaveLength(25)
    expect(
      first.qc_sample_50.filter((row) => row.physician_final_label === 'exclude'),
    ).toHaveLength(25)

    const cohortKeys = [
      first.required_review,
      first.qc_sample_50,
      first.protocol_acceptance_candidates,
    ].map((rows) => new Set(rows.map((row) => `${row.master_row_id}:${row.pmid}`)))
    expect(cohortKeys[0].size + cohortKeys[1].size + cohortKeys[2].size).toBe(630)
    expect(new Set([...cohortKeys[0], ...cohortKeys[1], ...cohortKeys[2]])).toHaveProperty(
      'size',
      630,
    )
    expect([...cohortKeys[0]].filter((key) => cohortKeys[1].has(key))).toEqual([])
    expect([...cohortKeys[0]].filter((key) => cohortKeys[2].has(key))).toEqual([])
    expect([...cohortKeys[1]].filter((key) => cohortKeys[2].has(key))).toEqual([])

    const metadata: GoldEnrichmentV3ReviewWorkbookMetadata = {
      workflow_id: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
      workflow_schema_version: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
      merged_schema_version: GOLD_ENRICHMENT_V3_MERGED_SCHEMA_VERSION,
      prompt_template_version: GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION,
      result_schema_version: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
      taxonomy_version: GOLD_ENRICHMENT_V3_TAXONOMY_VERSION,
      label_schema_version: GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION,
      enrichment_schema_version: GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
      source_sha256: 'a'.repeat(64),
      merged_sha256: 'b'.repeat(64),
      physician_field_sha256: 'c'.repeat(64),
      required_review_count: first.required_review.length,
      qc_sample_count: first.qc_sample_50.length,
      acceptance_candidate_count: first.protocol_acceptance_candidates.length,
      controlled_values: {
        metadata_sufficiency: [
          'adequate_abstract',
          'limited_abstract',
          'no_abstract',
          'conflicting_metadata',
        ],
        topic_ids: ['basic-bronchoscopy'],
        technology_tags: ['convex-ebus'],
        technology_tag_status: ['tagged', 'not_applicable', 'not_assessable'],
        clinical_purposes: ['diagnosis'],
        disease_tags: ['lung-cancer'],
        disease_tag_status: ['tagged', 'not_applicable', 'not_assessable'],
        study_design: ['randomized-trial'],
        publication_status: ['full-article'],
        enrichment_confidence: ['high', 'moderate', 'low'],
        provenance: [
          'physician_confirmed_ai_enrichment',
          'physician_modified_ai_enrichment',
          'ai_generated_enrichment_qc_accepted',
          'unresolved_enrichment',
        ],
      },
    }
    const firstWorkbook = await buildGoldEnrichmentV3ReviewWorkbookBytes(first, metadata)
    const secondWorkbook = await buildGoldEnrichmentV3ReviewWorkbookBytes(second, metadata)
    expect(Buffer.compare(firstWorkbook, secondWorkbook)).toBe(0)
    expect(sha256Bytes(firstWorkbook)).toMatch(/^[a-f0-9]{64}$/u)
    expect(Buffer.from(firstWorkbook).subarray(0, 2).toString('ascii')).toBe('PK')
    const zip = await JSZip.loadAsync(firstWorkbook)
    const workbookXml = await zip.file('xl/workbook.xml')!.async('string')
    GOLD_ENRICHMENT_V3_REVIEW_WORKBOOK_SHEETS.forEach((sheet) => {
      expect(workbookXml).toContain(`name="${sheet}"`)
    })
  }, 60_000)

  it('enforces local-data output safety, exclusive publication, and verified-existing identity', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'gold-v3-output-'))
    const root = await realpath(temporaryRoot)
    const localData = path.join(root, 'local-data')
    const output = path.join(localData, 'literature', 'v3-run')
    const outside = path.join(root, 'outside')
    await Promise.all([mkdir(localData, { recursive: true }), mkdir(outside, { recursive: true })])
    try {
      await expect(assertGoldEnrichmentV3SafeOutputDirectory(output, root)).resolves.toBe(output)
      await expect(assertGoldEnrichmentV3SafeOutputDirectory(localData, root)).rejects.toThrow(
        'must remain below',
      )
      await expect(
        assertGoldEnrichmentV3SafeOutputDirectory(path.join(localData, 'inputs', 'v3'), root),
      ).rejects.toThrow('read-only local-data/inputs')
      await expect(assertGoldEnrichmentV3SafeOutputDirectory(outside, root)).rejects.toThrow(
        'must remain below',
      )
      await symlink(outside, path.join(localData, 'escape'))
      await expect(
        assertGoldEnrichmentV3SafeOutputDirectory(path.join(localData, 'escape', 'v3'), root),
      ).rejects.toThrow('symlink')

      await mkdir(output, { recursive: true })
      const artifact = { path: 'nested/artifact.txt', bytes: Buffer.from('deterministic bytes') }
      await expect(preflightGoldEnrichmentV3Artifacts(output, [artifact])).resolves.toBeUndefined()
      await expect(
        preflightGoldEnrichmentV3Artifacts(output, [artifact, artifact]),
      ).rejects.toThrow('Duplicate planned artifact path')
      await expect(
        preflightGoldEnrichmentV3Artifacts(output, [
          { path: '../escape.txt', bytes: Buffer.from('no') },
        ]),
      ).rejects.toThrow('output-relative')
      await expect(
        preflightGoldEnrichmentV3Artifacts(output, [
          { path: path.join(root, 'absolute.txt'), bytes: Buffer.from('no') },
        ]),
      ).rejects.toThrow('output-relative')

      const created = await publishGoldEnrichmentV3Artifact(output, artifact)
      expect(created).toMatchObject({
        path: artifact.path,
        bytes: artifact.bytes.byteLength,
        sha256: sha256Bytes(artifact.bytes),
        publication: 'created',
      })
      expect(await readFile(path.join(output, artifact.path))).toEqual(artifact.bytes)
      await expect(preflightGoldEnrichmentV3Artifacts(output, [artifact])).resolves.toBeUndefined()
      const verified = await publishGoldEnrichmentV3Artifact(output, artifact)
      expect(verified).toEqual({ ...created, publication: 'verified_existing' })
      await expect(
        preflightGoldEnrichmentV3Artifacts(output, [
          { ...artifact, bytes: Buffer.from('different bytes') },
        ]),
      ).rejects.toThrow('nonidentical artifact collision')
      await expect(
        publishGoldEnrichmentV3Artifact(output, {
          ...artifact,
          bytes: Buffer.from('different bytes'),
        }),
      ).rejects.toThrow('nonidentical artifact collision')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('runs synthetic merge, review, and readiness gates end to end without import rows', async () => {
    const fixture = await materializeValidationFixture()
    const inputs = await materializeMergeInputs(fixture)
    const actualSha256Bytes = goldEnrichmentV3Core.sha256Bytes
    const checksumBindings = new Map([
      [actualSha256Bytes(inputs.texts.sourceText), GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_SHA256],
      [actualSha256Bytes(inputs.texts.priorText), SYNTHETIC_PRIOR_SHA256],
      [actualSha256Bytes(inputs.texts.qaText), CANONICAL_EXTERNAL_QA_FINDINGS_SHA256],
      [actualSha256Bytes(inputs.texts.upgradeText), GOLD_ENRICHMENT_V3_UPGRADE_PLAN_SHA256],
    ])
    jest.doMock('./gold-enrichment-v3', () => ({
      ...goldEnrichmentV3Core,
      sha256Bytes: (value: Uint8Array | string) => {
        const actual = actualSha256Bytes(value)
        return checksumBindings.get(actual) ?? actual
      },
      parseGoldEnrichmentV3CanonicalSource: (input: string) => {
        expect(input).toBe(inputs.texts.sourceText)
        return SYNTHETIC_WORKFLOW.sourceRows
      },
      goldEnrichmentV3PhysicianFieldSha256: () => GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256,
    }))
    let workflowApi!: typeof import('./gold-enrichment-v3-results')
    await jest.isolateModulesAsync(async () => {
      workflowApi = await import('./gold-enrichment-v3-results')
    })
    const {
      auditGoldEnrichmentV3Readiness,
      buildGoldEnrichmentV3Review,
      mergeGoldEnrichmentV3,
      validateGoldEnrichmentV3Results: validateIsolatedResults,
    } = workflowApi

    try {
      const mergeDirectory = path.join(inputs.localData, 'literature', 'merge')
      const mergeOptions = {
        runDirectory: fixture.runDirectory,
        resultsDirectory: fixture.resultsDirectory,
        sourcePath: inputs.sourcePath,
        priorEnrichmentPath: inputs.priorPath,
        qaFindingsPath: inputs.qaPath,
        upgradePlanPath: inputs.upgradePath,
        outputDirectory: mergeDirectory,
        workspaceRoot: fixture.root,
      }
      const independentModelRequestPmid = SYNTHETIC_WORKFLOW.sourceRows[144].pmid
      const independentModelRequestFile = [...fixture.files.values()].find(
        (file) =>
          file.family === 'included_metadata_only' &&
          file.rows.some((row) => row.pmid === independentModelRequestPmid),
      )!
      await writeMutatedResult(fixture, independentModelRequestFile, (rows) => {
        const row = rows.find((candidate) => candidate.pmid === independentModelRequestPmid)
        expect(row).toBeDefined()
        row!.model_requests_physician_enrichment_review = 'true'
      })
      for (const relativePath of [
        'full-text-registry-v3.csv',
        'full-text-registry-v3.receipt.json',
      ] as const) {
        const artifactPath = path.join(fixture.runDirectory, relativePath)
        const original = await readFile(artifactPath)
        await writeFile(artifactPath, Buffer.concat([original, Buffer.from('\n')]))
        await expect(mergeGoldEnrichmentV3(mergeOptions)).rejects.toThrow(
          `Canonical artifact ${relativePath} does not match the artifact manifest`,
        )
        await writeFile(artifactPath, original)
      }

      const registryDriftRunDirectory = path.join(
        inputs.localData,
        'literature',
        'registry-drift-run',
      )
      await cp(fixture.runDirectory, registryDriftRunDirectory, { recursive: true })
      const registryDriftPath = path.join(registryDriftRunDirectory, 'full-text-registry-v3.csv')
      const registryDriftRows = flexibleCsvObjects(await readFile(registryDriftPath, 'utf8'))
      const [registryColumns] = parseCsvRows(await readFile(registryDriftPath, 'utf8'))
      const demotedComplete = registryDriftRows.find(
        (row) => row.evidence_status === 'matched_complete',
      )
      const promotedMissing = registryDriftRows.find((row) => row.evidence_status === 'missing')
      expect(demotedComplete).toBeDefined()
      expect(promotedMissing).toBeDefined()
      demotedComplete!.evidence_status = 'missing'
      demotedComplete!.file_sha256 = ''
      promotedMissing!.evidence_status = 'matched_complete'
      promotedMissing!.expected_filename = 'synthetic-promoted-complete.pdf'
      promotedMissing!.file_sha256 = sha256Bytes('synthetic-promoted-complete')
      const registryDriftText = serializeGoldEnrichmentV3Csv(registryColumns, registryDriftRows)
      const registryDriftIdentity = {
        path: 'full-text-registry-v3.csv',
        bytes: Buffer.byteLength(registryDriftText),
        sha256: actualSha256Bytes(registryDriftText),
      }
      const registryDriftReceiptPath = path.join(
        registryDriftRunDirectory,
        'full-text-registry-v3.receipt.json',
      )
      const registryDriftReceipt = JSON.parse(await readFile(registryDriftReceiptPath, 'utf8')) as {
        registry: { path: string; bytes: number; sha256: string }
      }
      registryDriftReceipt.registry = registryDriftIdentity
      const registryDriftReceiptText = serializeGoldEnrichmentV3Json(registryDriftReceipt)
      const registryDriftReceiptIdentity = {
        path: 'full-text-registry-v3.receipt.json',
        bytes: Buffer.byteLength(registryDriftReceiptText),
        sha256: actualSha256Bytes(registryDriftReceiptText),
      }
      const registryDriftManifestPath = path.join(
        registryDriftRunDirectory,
        'artifact-manifest.json',
      )
      const registryDriftManifest = JSON.parse(
        await readFile(registryDriftManifestPath, 'utf8'),
      ) as SyntheticCanonicalManifest
      registryDriftManifest.canonicalArtifacts = registryDriftManifest.canonicalArtifacts.map(
        (identity) => {
          if (identity.path === registryDriftIdentity.path) return registryDriftIdentity
          if (identity.path === registryDriftReceiptIdentity.path) {
            return registryDriftReceiptIdentity
          }
          return identity
        },
      )
      await Promise.all([
        writeFile(registryDriftPath, registryDriftText, 'utf8'),
        writeFile(registryDriftReceiptPath, registryDriftReceiptText, 'utf8'),
      ])
      await writeSyntheticManifestAndRebindExecutionReceipt(
        registryDriftRunDirectory,
        registryDriftManifest,
      )
      await expect(
        mergeGoldEnrichmentV3({
          ...mergeOptions,
          runDirectory: registryDriftRunDirectory,
          outputDirectory: path.join(inputs.localData, 'literature', 'registry-drift-merge'),
        }),
      ).rejects.toThrow('Preview/missing full text must not be used')

      const packetDrift = await materializeSelfConsistentCanonicalPacketDrift(
        fixture,
        inputs.localData,
      )
      await expect(
        validateIsolatedResults({
          runDirectory: packetDrift.runDirectory,
          resultsDirectory: packetDrift.resultsDirectory,
          workspaceRoot: fixture.root,
          publishReports: false,
        }),
      ).rejects.toThrow(/not identity-bound by the model-facing inventory and audit/iu)

      const firstMerge = await mergeGoldEnrichmentV3(mergeOptions)
      const repeatedMerge = await mergeGoldEnrichmentV3(mergeOptions)

      expect(repeatedMerge.rows).toEqual(firstMerge.rows)
      expect(repeatedMerge.mergedArtifact.sha256).toBe(firstMerge.mergedArtifact.sha256)
      expect(
        repeatedMerge.artifacts.map(({ path: artifactPath, bytes, sha256 }) => ({
          path: artifactPath,
          bytes,
          sha256,
        })),
      ).toEqual(
        firstMerge.artifacts.map(({ path: artifactPath, bytes, sha256 }) => ({
          path: artifactPath,
          bytes,
          sha256,
        })),
      )
      expect(firstMerge.artifacts.every((artifact) => artifact.publication === 'created')).toBe(
        true,
      )
      expect(
        repeatedMerge.artifacts.every((artifact) => artifact.publication === 'verified_existing'),
      ).toBe(true)
      expect(firstMerge.rows).toHaveLength(630)
      const modelRequestedRows = firstMerge.rows.filter(
        (row) => row.model_requests_physician_enrichment_review === 'true',
      )
      expect(modelRequestedRows.map((row) => row.pmid)).toEqual([independentModelRequestPmid])
      expect(modelRequestedRows[0]).toMatchObject({
        coordinator_requires_physician_enrichment_review: 'true',
      })
      expect(modelRequestedRows[0].coordinator_review_reasons.split('|')).toContain(
        'model_requests_physician_enrichment_review',
      )
      const adjacentRows = firstMerge.rows.filter(
        (row) => row.physician_final_label === 'include_adjacent',
      )
      expect(adjacentRows).toHaveLength(75)
      expect(
        adjacentRows.every(
          (row) =>
            row.model_requests_physician_enrichment_review === 'false' &&
            row.coordinator_requires_physician_enrichment_review === 'true' &&
            row.coordinator_review_reasons.split('|').includes('include_adjacent'),
        ),
      ).toBe(true)
      const fullTextManifestPmids = new Set(SYNTHETIC_WORKFLOW.registryRows.map((row) => row.pmid))
      expect(fullTextManifestPmids).toHaveProperty('size', 56)
      expect(
        firstMerge.rows
          .filter((row) => fullTextManifestPmids.has(row.pmid))
          .every(
            (row) =>
              row.model_requests_physician_enrichment_review === 'false' &&
              row.coordinator_requires_physician_enrichment_review === 'true' &&
              row.coordinator_review_reasons.split('|').includes('full_text_manifest'),
          ),
      ).toBe(true)
      expect(firstMerge.rows.filter((row) => row.full_text_used === 'true')).toHaveLength(50)
      expect(
        firstMerge.rows
          .filter((row) => row.full_text_used === 'true')
          .every(
            (row) => row.enrichment_provenance === 'full_text_ai_enrichment_pending_physician',
          ),
      ).toBe(true)
      expect(
        firstMerge.rows
          .filter((row) => row.full_text_used === 'false')
          .every((row) => row.enrichment_provenance === 'unresolved_enrichment'),
      ).toBe(true)
      expect(
        firstMerge.rows.every(
          (row) =>
            row.physician_enrichment_reviewed === 'false' &&
            row.protocol_acceptance_authorized === 'false' &&
            row.import_ready === 'false' &&
            row.database_mutation_plan === '',
        ),
      ).toBe(true)

      const qaOverlay = flexibleCsvObjects(
        await readFile(path.join(mergeDirectory, 'external-qa-overlay.csv'), 'utf8'),
      )
      const upgradeOverlay = flexibleCsvObjects(
        await readFile(path.join(mergeDirectory, 'taxonomy-v2-upgrade-overlay.csv'), 'utf8'),
      )
      expect(qaOverlay).toHaveLength(166)
      expect(qaOverlay.every((row) => row.qa_value_applied_automatically === 'false')).toBe(true)
      expect(
        qaOverlay.filter(
          (row) =>
            row.review_tier === 'rule_based_consistency' && row.rule_rerun_evaluable === 'true',
        ),
      ).toHaveLength(104)
      expect(upgradeOverlay).toHaveLength(133)
      expect(
        upgradeOverlay.every(
          (row) =>
            row.physician_adjudication_required === 'true' &&
            row.remains_review_eligible === 'true' &&
            row.candidate_applied_automatically === 'false',
        ),
      ).toBe(true)

      const mergeReceipt = JSON.parse(
        await readFile(
          path.join(mergeDirectory, 'gold-set-v1-enrichment-v3-merged.receipt.json'),
          'utf8',
        ),
      ) as {
        merged: { sha256: string }
        safety: { importRowsCreated: number; databaseMutationPlan: null }
      }
      expect(mergeReceipt.safety).toEqual(
        expect.objectContaining({ importRowsCreated: 0, databaseMutationPlan: null }),
      )
      expect(firstMerge.artifacts.every((artifact) => !/import/iu.test(artifact.path))).toBe(true)

      const reviewDirectory = path.join(inputs.localData, 'literature', 'review')
      const review = await buildGoldEnrichmentV3Review({
        runDirectory: fixture.runDirectory,
        mergeDirectory,
        outputDirectory: reviewDirectory,
        workspaceRoot: fixture.root,
      })
      expect(review.cohorts.qc_sample_50).toHaveLength(50)
      expect(
        review.cohorts.required_review.length +
          review.cohorts.qc_sample_50.length +
          review.cohorts.protocol_acceptance_candidates.length,
      ).toBe(630)
      expect(review.cohorts.required_review.length).toBeGreaterThan(0)
      expect(review.cohorts.protocol_acceptance_candidates.length).toBeGreaterThan(0)
      const requiredReviewPmids = new Set(review.cohorts.required_review.map((row) => row.pmid))
      const directQaTargetPmids = new Set(
        qaOverlay.filter((row) => row.review_tier === 'direct_targeted').map((row) => row.pmid),
      )
      expect(directQaTargetPmids).toHaveProperty('size', 44)
      expect([...directQaTargetPmids].every((pmid) => requiredReviewPmids.has(pmid))).toBe(true)
      expect(upgradeOverlay.every((row) => requiredReviewPmids.has(row.pmid))).toBe(true)
      const mergedByPmid = new Map(firstMerge.rows.map((row) => [row.pmid, row]))
      expect(
        [...directQaTargetPmids].every((pmid) => {
          const row = mergedByPmid.get(pmid)
          return (
            row?.model_requests_physician_enrichment_review === 'false' &&
            row.coordinator_requires_physician_enrichment_review === 'true' &&
            row.coordinator_review_reasons.split('|').includes('direct_external_qa')
          )
        }),
      ).toBe(true)
      expect(
        upgradeOverlay.every((upgrade) => {
          const row = mergedByPmid.get(upgrade.pmid)
          return (
            row?.model_requests_physician_enrichment_review === 'false' &&
            row.coordinator_requires_physician_enrichment_review === 'true' &&
            row.coordinator_review_reasons.split('|').includes('taxonomy_v2_upgrade_candidate')
          )
        }),
      ).toBe(true)
      for (const pmid of ['16043961', '26033136']) {
        expect(mergedByPmid.get(pmid)).toMatchObject({
          model_requests_physician_enrichment_review: 'false',
          coordinator_requires_physician_enrichment_review: 'true',
          relevance_concern_review_flag: 'true',
        })
        expect(mergedByPmid.get(pmid)?.coordinator_review_reasons.split('|')).toContain(
          'relevance_concern',
        )
      }
      for (const pmid of ['41229759', '18453348']) {
        expect(requiredReviewPmids.has(pmid)).toBe(true)
        expect(mergedByPmid.get(pmid)?.model_requests_physician_enrichment_review).toBe('false')
      }

      const reviewReceiptPath = path.join(reviewDirectory, 'review-cohorts.receipt.json')
      const reviewReceiptText = await readFile(reviewReceiptPath, 'utf8')
      const reviewReceipt = JSON.parse(reviewReceiptText) as {
        cohorts: {
          requiredReview: { membershipSha256: string }
          protocolAcceptanceCandidates: { membershipSha256: string }
        }
      }

      const tamperedReviewDirectory = path.join(inputs.localData, 'literature', 'review-tamper')
      await cp(reviewDirectory, tamperedReviewDirectory, { recursive: true })
      const tamperedReceipt = JSON.parse(reviewReceiptText) as typeof reviewReceipt
      tamperedReceipt.cohorts.requiredReview.membershipSha256 = '0'.repeat(64)
      await writeFile(
        path.join(tamperedReviewDirectory, 'review-cohorts.receipt.json'),
        serializeGoldEnrichmentV3Json(tamperedReceipt),
        'utf8',
      )
      await expect(
        auditGoldEnrichmentV3Readiness({
          mergeDirectory,
          reviewDirectory: tamperedReviewDirectory,
          outputDirectory: path.join(inputs.localData, 'literature', 'readiness-tamper'),
          workspaceRoot: fixture.root,
        }),
      ).rejects.toThrow('reconstructed required-review.csv')

      const incomplete = await auditGoldEnrichmentV3Readiness({
        mergeDirectory,
        reviewDirectory,
        outputDirectory: path.join(inputs.localData, 'literature', 'readiness-incomplete'),
        workspaceRoot: fixture.root,
      })
      const incompleteGates = incomplete.report.explicitGates as Record<string, boolean>
      expect(incomplete.report.importReadiness).toBe(false)
      expect(incompleteGates.requiredReviewComplete).toBe(false)
      expect(incompleteGates.qcReviewComplete).toBe(false)
      expect(incompleteGates.directQaFinalAdjudicationComplete).toBe(false)
      expect(incompleteGates.taxonomyUpgradeFinalAdjudicationComplete).toBe(false)
      expect(incomplete.report.importRowsCreated).toBe(0)
      expect(incomplete.report.databaseMutationPlan).toBeNull()
      const incompleteQaMetrics = incomplete.report.externalQa as {
        findings: number
        resolved: number
        open: number
        preReviewIndependentAssessment: {
          independentlyAddressed: number
          concernRemainsOpen: number
        }
        finalPhysicianAdjudication: {
          findings: { total: number; resolved: number; open: number }
          targets: { total: number; resolved: number; open: number }
          complete: boolean
        }
      }
      expect(incompleteQaMetrics).toMatchObject({ findings: 166, resolved: 0, open: 44 })
      expect(incompleteQaMetrics.preReviewIndependentAssessment).toMatchObject({
        independentlyAddressed: 104,
        concernRemainsOpen: 62,
      })
      expect(incompleteQaMetrics.finalPhysicianAdjudication).toMatchObject({
        findings: { total: 54, resolved: 0, open: 54 },
        targets: { total: 44, resolved: 0, open: 44 },
        complete: false,
      })
      const incompleteUpgradeMetrics = incomplete.report.taxonomyUpgradeCandidates as {
        candidates: number
        resolved: number
        open: number
        independentSelection: Record<string, number>
        finalPhysicianAdjudication: {
          candidates: number
          resolved: number
          open: number
          complete: boolean
        }
      }
      expect(incompleteUpgradeMetrics).toMatchObject({ candidates: 133, resolved: 0, open: 133 })
      expect(incompleteUpgradeMetrics.independentSelection).toEqual({
        selected: 0,
        notSelected: 133,
        notMachineAssessable: 0,
      })
      expect(incompleteUpgradeMetrics.finalPhysicianAdjudication).toMatchObject({
        candidates: 133,
        resolved: 0,
        open: 133,
        complete: false,
      })

      const decisionsDirectory = path.join(inputs.localData, 'literature', 'decisions')
      await mkdir(decisionsDirectory, { recursive: true })
      const requiredReviewPath = path.join(decisionsDirectory, 'required-review.csv')
      const qcReviewPath = path.join(decisionsDirectory, 'qc-review.csv')
      await Promise.all([
        writeFile(
          requiredReviewPath,
          completedReviewCsv(
            await readFile(path.join(reviewDirectory, 'required-review.csv'), 'utf8'),
          ),
          'utf8',
        ),
        writeFile(
          qcReviewPath,
          completedReviewCsv(
            await readFile(path.join(reviewDirectory, 'qc-sample-50.csv'), 'utf8'),
          ),
          'utf8',
        ),
      ])

      const completedRequiredReview = await readFile(requiredReviewPath, 'utf8')
      const directFindingCounts = new Map<string, number>()
      qaOverlay
        .filter((row) => row.review_tier === 'direct_targeted')
        .forEach((row) => {
          directFindingCounts.set(row.pmid, (directFindingCounts.get(row.pmid) ?? 0) + 1)
        })
      const repeatedDirectTarget = [...directFindingCounts].find(([, count]) => count === 2)?.[0]
      expect(repeatedDirectTarget).toBeDefined()
      const partialDirectReviewPath = path.join(decisionsDirectory, 'partial-direct-review.csv')
      await writeFile(
        partialDirectReviewPath,
        mutateReviewCsv(completedRequiredReview, (rows) => {
          const row = rows.find((candidate) => candidate.pmid === repeatedDirectTarget)
          expect(row).toBeDefined()
          row!.physician_reviewed = 'false'
        }),
        'utf8',
      )
      const partialDirect = await auditGoldEnrichmentV3Readiness({
        mergeDirectory,
        reviewDirectory,
        requiredReviewPath: partialDirectReviewPath,
        qcReviewPath,
        outputDirectory: path.join(inputs.localData, 'literature', 'readiness-partial-direct'),
        workspaceRoot: fixture.root,
      })
      const partialDirectGates = partialDirect.report.explicitGates as Record<string, boolean>
      const partialDirectQa = partialDirect.report.externalQa as {
        finalPhysicianAdjudication: {
          findings: { total: number; resolved: number; open: number }
          targets: { total: number; resolved: number; open: number }
        }
      }
      expect(partialDirectGates.directQaFinalAdjudicationComplete).toBe(false)
      expect(partialDirectGates.taxonomyUpgradeFinalAdjudicationComplete).toBe(true)
      expect(partialDirectQa.finalPhysicianAdjudication).toMatchObject({
        findings: { total: 54, resolved: 52, open: 2 },
        targets: { total: 44, resolved: 43, open: 1 },
      })

      const partialUpgradeReviewPath = path.join(decisionsDirectory, 'partial-upgrade-review.csv')
      await writeFile(
        partialUpgradeReviewPath,
        mutateReviewCsv(completedRequiredReview, (rows) => {
          const row = rows.find((candidate) => candidate.pmid === upgradeOverlay[0].pmid)
          expect(row).toBeDefined()
          row!.physician_reviewed = 'false'
        }),
        'utf8',
      )
      const partialUpgrade = await auditGoldEnrichmentV3Readiness({
        mergeDirectory,
        reviewDirectory,
        requiredReviewPath: partialUpgradeReviewPath,
        qcReviewPath,
        outputDirectory: path.join(inputs.localData, 'literature', 'readiness-partial-upgrade'),
        workspaceRoot: fixture.root,
      })
      const partialUpgradeGates = partialUpgrade.report.explicitGates as Record<string, boolean>
      expect(partialUpgradeGates.directQaFinalAdjudicationComplete).toBe(true)
      expect(partialUpgradeGates.taxonomyUpgradeFinalAdjudicationComplete).toBe(false)
      expect(partialUpgrade.report.taxonomyUpgradeCandidates).toMatchObject({
        candidates: 133,
        resolved: 132,
        open: 1,
        finalPhysicianAdjudication: { resolved: 132, open: 1, complete: false },
      })

      const lvrsReviewPath = path.join(decisionsDirectory, 'forbidden-lvrs-review.csv')
      await writeFile(
        lvrsReviewPath,
        mutateReviewCsv(completedRequiredReview, (rows) => {
          const hardRows = rows.filter((row) => ['41229759', '18453348'].includes(row.pmid))
          expect(hardRows).toHaveLength(2)
          hardRows.forEach((row) => {
            row.physician_action = 'modify'
            row.physician_topic_ids = 'basic-bronchoscopy|bronchoscopic-lung-volume-reduction'
            row.physician_reviewed = 'true'
            row.physician_notes = 'Synthetic attempted reintroduction of forbidden LVRS topic.'
          })
        }),
        'utf8',
      )
      const forbiddenLvrs = await auditGoldEnrichmentV3Readiness({
        mergeDirectory,
        reviewDirectory,
        requiredReviewPath: lvrsReviewPath,
        qcReviewPath,
        outputDirectory: path.join(inputs.localData, 'literature', 'readiness-forbidden-lvrs'),
        workspaceRoot: fixture.root,
      })
      expect(forbiddenLvrs.report.importReadiness).toBe(false)
      expect(forbiddenLvrs.report.errorCountByField).toMatchObject({ physician_topic_ids: 2 })
      expect(
        (forbiddenLvrs.report.explicitGates as Record<string, boolean>)
          .controlledValueValidationPassed,
      ).toBe(false)

      const completedWithoutAuthorization = await auditGoldEnrichmentV3Readiness({
        mergeDirectory,
        reviewDirectory,
        requiredReviewPath,
        qcReviewPath,
        outputDirectory: path.join(inputs.localData, 'literature', 'readiness-no-authorization'),
        workspaceRoot: fixture.root,
      })
      expect(completedWithoutAuthorization.report.importReadiness).toBe(false)
      const completedGates = completedWithoutAuthorization.report.explicitGates as Record<
        string,
        boolean
      >
      expect(completedGates.directQaFinalAdjudicationComplete).toBe(true)
      expect(completedGates.taxonomyUpgradeFinalAdjudicationComplete).toBe(true)
      expect(completedGates.protocolAcceptanceAuthorized).toBe(false)
      expect(completedWithoutAuthorization.report.externalQa).toMatchObject({
        findings: 166,
        resolved: 44,
        open: 0,
        preReviewIndependentAssessment: incompleteQaMetrics.preReviewIndependentAssessment,
        finalPhysicianAdjudication: {
          findings: { total: 54, resolved: 54, open: 0 },
          targets: { total: 44, resolved: 44, open: 0 },
          complete: true,
        },
      })
      expect(completedWithoutAuthorization.report.taxonomyUpgradeCandidates).toMatchObject({
        candidates: 133,
        resolved: 133,
        open: 0,
        independentSelection: incompleteUpgradeMetrics.independentSelection,
        finalPhysicianAdjudication: {
          candidates: 133,
          resolved: 133,
          open: 0,
          complete: true,
        },
      })

      const authorizationDirectory = path.join(inputs.localData, 'literature', 'authorization')
      await mkdir(authorizationDirectory, { recursive: true })
      const authorizationBase = {
        workflow_id: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
        merged_sha256: mergeReceipt.merged.sha256,
        review_cohorts_receipt_sha256: actualSha256Bytes(reviewReceiptText),
        required_review_sha256: actualSha256Bytes(await readFile(requiredReviewPath)),
        qc_review_sha256: actualSha256Bytes(await readFile(qcReviewPath)),
        protocol_candidate_membership_sha256:
          reviewReceipt.cohorts.protocolAcceptanceCandidates.membershipSha256,
        authorized: true,
        authorized_after_qc: true,
        authorized_by: 'Synthetic Physician Reviewer',
        authorization_note:
          'Synthetic authorization issued after completed required and QC review.',
      }
      const staleAuthorizationPath = path.join(authorizationDirectory, 'stale-authorization.json')
      await writeFile(
        staleAuthorizationPath,
        serializeGoldEnrichmentV3Json({
          ...authorizationBase,
          qc_review_sha256: '0'.repeat(64),
        }),
        'utf8',
      )
      const staleAuthorization = await auditGoldEnrichmentV3Readiness({
        mergeDirectory,
        reviewDirectory,
        requiredReviewPath,
        qcReviewPath,
        protocolAuthorizationPath: staleAuthorizationPath,
        outputDirectory: path.join(inputs.localData, 'literature', 'readiness-stale-authorization'),
        workspaceRoot: fixture.root,
      })
      expect(staleAuthorization.report.importReadiness).toBe(false)
      expect(
        (staleAuthorization.report.protocolAcceptance as Record<string, boolean>)
          .decisionArtifactsBound,
      ).toBe(false)

      const prematureAuthorizationPath = path.join(
        authorizationDirectory,
        'premature-authorization.json',
      )
      await writeFile(
        prematureAuthorizationPath,
        serializeGoldEnrichmentV3Json({
          ...authorizationBase,
          authorized_after_qc: false,
        }),
        'utf8',
      )
      const prematureAuthorization = await auditGoldEnrichmentV3Readiness({
        mergeDirectory,
        reviewDirectory,
        requiredReviewPath,
        qcReviewPath,
        protocolAuthorizationPath: prematureAuthorizationPath,
        outputDirectory: path.join(
          inputs.localData,
          'literature',
          'readiness-premature-authorization',
        ),
        workspaceRoot: fixture.root,
      })
      expect(prematureAuthorization.report.importReadiness).toBe(false)
      expect(
        (prematureAuthorization.report.protocolAcceptance as Record<string, boolean>)
          .authorizedAfterQc,
      ).toBe(false)

      const authorizationPath = path.join(authorizationDirectory, 'authorization.json')
      await writeFile(authorizationPath, serializeGoldEnrichmentV3Json(authorizationBase), 'utf8')
      const ready = await auditGoldEnrichmentV3Readiness({
        mergeDirectory,
        reviewDirectory,
        requiredReviewPath,
        qcReviewPath,
        protocolAuthorizationPath: authorizationPath,
        outputDirectory: path.join(inputs.localData, 'literature', 'readiness-authorized'),
        workspaceRoot: fixture.root,
      })
      const readyGates = ready.report.explicitGates as Record<string, boolean>
      const protocolAcceptance = ready.report.protocolAcceptance as Record<string, unknown>
      const provenance = ready.report.provenanceDistribution as Record<string, number>
      const readyUpgradeMetrics = ready.report.taxonomyUpgradeCandidates as {
        candidates: number
        resolved: number
        open: number
        independentSelection: Record<string, number>
      }
      expect(ready.report.importReadiness).toBe(true)
      expect(Object.values(readyGates).every(Boolean)).toBe(true)
      expect(protocolAcceptance).toMatchObject({
        provided: true,
        authorized: true,
        valid: true,
        authorizedAfterQc: true,
        decisionArtifactsBound: true,
      })
      expect(provenance.physician_confirmed_ai_enrichment).toBe(
        review.cohorts.required_review.length + review.cohorts.qc_sample_50.length,
      )
      expect(provenance.ai_generated_enrichment_qc_accepted).toBe(
        review.cohorts.protocol_acceptance_candidates.length,
      )
      expect(readyUpgradeMetrics).toMatchObject({ candidates: 133, resolved: 133, open: 0 })
      expect(readyUpgradeMetrics.independentSelection).toEqual(
        incompleteUpgradeMetrics.independentSelection,
      )
      expect(ready.report.importRowsCreated).toBe(0)
      expect(ready.report.databaseMutationPlan).toBeNull()
      expect(ready.report.safety).toEqual(
        expect.objectContaining({
          databaseWrites: 0,
          importRowsCreated: 0,
          heldOutTestAccessed: false,
          modelCalls: 0,
          networkRequests: 0,
        }),
      )
    } finally {
      jest.dontMock('./gold-enrichment-v3')
      jest.resetModules()
      await rm(fixture.root, { recursive: true, force: true })
    }
  }, 120_000)
})
