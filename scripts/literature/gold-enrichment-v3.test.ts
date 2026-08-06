/** @jest-environment node */

import {
  cp,
  mkdir,
  mkdtemp,
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
  GOLD_ENRICHMENT_V3_REVIEW_CSV_COLUMNS,
  buildGoldEnrichmentV3ReviewCohorts,
  validateGoldEnrichmentV3Results,
  type GoldEnrichmentV3MergedRow,
  type GoldEnrichmentV3ValidationReport,
} from './gold-enrichment-v3-results'
import {
  GOLD_ENRICHMENT_V3_REVIEW_WORKBOOK_SHEETS,
  buildGoldEnrichmentV3ReviewWorkbookBytes,
  type GoldEnrichmentV3ReviewWorkbookMetadata,
} from './gold-enrichment-v3-workbook'
import {
  GOLD_ENRICHMENT_V3_CANONICAL_RECEIPT_SHA256,
  GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_COLUMNS,
  GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_SHA256,
  GOLD_ENRICHMENT_V3_CONFIG_CONTRACT,
  GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
  GOLD_ENRICHMENT_V3_FULL_TEXT_AUDIT_COLUMNS,
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
  assertGoldEnrichmentV3SafeOutputDirectory,
  buildGoldEnrichmentV3PacketRows,
  buildGoldEnrichmentV3Packets,
  goldEnrichmentV3PhysicianFieldSha256,
  parseGoldEnrichmentV3CanonicalSource,
  parseGoldEnrichmentV3FullTextAudit,
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
): Record<GoldEnrichmentV3PacketFamily, Omit<GoldEnrichmentV3ArtifactIdentity, 'publication'>> {
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
        },
      ]
    }),
  ) as Record<GoldEnrichmentV3PacketFamily, Omit<GoldEnrichmentV3ArtifactIdentity, 'publication'>>
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
    requires_physician_enrichment_review: String(
      fullText ||
        input.physician_final_label === 'include_adjacent' ||
        ['preview_only', 'missing'].includes(input.full_text_evidence_status) ||
        ['16043961', '26033136', '41229759', '18453348'].includes(input.pmid),
    ),
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
    requires_physician_enrichment_review: 'false',
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
    const inputs = csvObjects(packet.csv, GOLD_ENRICHMENT_V3_PACKET_COLUMNS)
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

  const packetEntries = []
  for (const packet of SYNTHETIC_WORKFLOW.packets) {
    const receiptText = serializeGoldEnrichmentV3Json(packet.receipt)
    const csvTarget = path.join(runDirectory, packet.csvPath)
    const receiptTarget = path.join(runDirectory, packet.receiptPath)
    await mkdir(path.dirname(csvTarget), { recursive: true })
    await Promise.all([
      writeFile(csvTarget, packet.csv, 'utf8'),
      writeFile(receiptTarget, receiptText, 'utf8'),
    ])
    packetEntries.push({
      packetId: packet.receipt.packetId,
      family: packet.receipt.packetFamily,
      ordinal: packet.receipt.packetOrdinal,
      rows: packet.receipt.rowCount,
      csvPath: packet.csvPath,
      csvSha256: sha256Bytes(packet.csv),
      receiptPath: packet.receiptPath,
      receiptSha256: sha256Bytes(receiptText),
      expectedOutputFilename: packet.receipt.expectedOutputFilename,
      sourceProjectionSha256: packet.receipt.sourceProjectionSha256,
    })
  }
  const packetIndex = serializeGoldEnrichmentV3Json({
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    packets: packetEntries,
  })
  await writeFile(path.join(runDirectory, 'packet-index.json'), packetIndex, 'utf8')
  const contractIdentities = new Map<string, { path: string; bytes: number; sha256: string }>()
  for (const packet of SYNTHETIC_WORKFLOW.packets) {
    for (const identity of [packet.receipt.promptTemplate, packet.receipt.expectedResultSchema]) {
      contractIdentities.set(identity.path, {
        path: identity.path,
        bytes: identity.bytes,
        sha256: identity.sha256,
      })
    }
  }
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
  }
  const runDefinition = serializeGoldEnrichmentV3Json({
    workflow: {
      id: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
      workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
      resultSchemaVersion: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
      taxonomyVersion: GOLD_ENRICHMENT_V3_TAXONOMY_VERSION,
      labelSchemaVersion: GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION,
      enrichmentSchemaVersion: GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
    },
    developmentScope: { rows: 630, heldOutTestRows: 0, testIdentitiesAccessed: 0 },
    safety: { heldOutTestAccessed: false },
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
  await Promise.all([
    writeFile(path.join(runDirectory, 'run-definition.json'), runDefinition, 'utf8'),
    writeFile(
      path.join(runDirectory, 'artifact-manifest.json'),
      serializeGoldEnrichmentV3Json({
        workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
        workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
        canonicalArtifacts: [
          {
            path: 'packet-index.json',
            bytes: Buffer.byteLength(packetIndex),
            sha256: sha256Bytes(packetIndex),
          },
          {
            path: 'run-definition.json',
            bytes: Buffer.byteLength(runDefinition),
            sha256: sha256Bytes(runDefinition),
          },
          ...contractIdentities.values(),
        ],
      }),
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
  const direct = Array.from({ length: 54 }, (_, index) => {
    const source = SYNTHETIC_WORKFLOW.sourceRows[100 + (index % 44)]
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
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    canonicalArtifacts: Array<{ path: string; bytes: number; sha256: string }>
  }
  manifest.canonicalArtifacts = [
    ...manifest.canonicalArtifacts.filter(
      (identity) =>
        identity.path !== registryIdentity.path && identity.path !== registryReceiptIdentity.path,
    ),
    registryIdentity,
    registryReceiptIdentity,
  ]
  await writeFile(manifestPath, serializeGoldEnrichmentV3Json(manifest), 'utf8')
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
  packetRows[0].journal = 'Self-consistent but noncanonical journal'
  const packetSource = (row: StringRow) =>
    Object.fromEntries(
      GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS.map((column) => [column, row[column]]),
    )
  packetRows[0].source_row_sha256 = sha256Bytes(
    serializeGoldEnrichmentV3Json(packetSource(packetRows[0])),
  )
  const sourceProjectionSha256 = sha256Bytes(
    serializeGoldEnrichmentV3Json({
      columns: GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS,
      rows: packetRows.map((row) =>
        GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS.map((column) => row[column]),
      ),
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
    orderedKeys: Array<{ masterRowId: string; pmid: string; sourceRowSha256: string }>
  }
  receipt.sourceProjectionSha256 = sourceProjectionSha256
  receipt.packetCsv = packetIdentity
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
      receiptSha256: string
      sourceProjectionSha256: string
    }>
  }
  const indexEntry = packetIndex.packets.find(
    (candidate) => candidate.packetId === packet.receipt.packetId,
  )!
  indexEntry.csvSha256 = packetIdentity.sha256
  indexEntry.receiptSha256 = receiptIdentity.sha256
  indexEntry.sourceProjectionSha256 = sourceProjectionSha256
  const driftedIndexText = serializeGoldEnrichmentV3Json(packetIndex)
  const indexIdentity = {
    path: 'packet-index.json',
    bytes: Buffer.byteLength(driftedIndexText),
    sha256: sha256Bytes(driftedIndexText),
  }

  const manifestPath = path.join(runDirectory, 'artifact-manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    canonicalArtifacts: Array<{ path: string; bytes: number; sha256: string }>
  }
  for (const identity of [indexIdentity, packetIdentity, receiptIdentity]) {
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
    writeFile(receiptPath, driftedReceiptText, 'utf8'),
    writeFile(indexPath, driftedIndexText, 'utf8'),
    writeFile(manifestPath, serializeGoldEnrichmentV3Json(manifest), 'utf8'),
    writeFile(resultPath, serializeGoldEnrichmentV3Csv(resultColumns, resultRows), 'utf8'),
  ])
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
  return {
    ...row,
    workflow_id: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflow_schema_version: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
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
    requires_physician_enrichment_review: 'false',
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

function reviewCandidate(row: GoldEnrichmentV3MergedRow, index: number): StringRow {
  const required = index < 10 || (index >= 300 && index < 330)
  return {
    master_row_id: row.master_row_id,
    pmid: row.pmid,
    physician_final_label: row.physician_final_label,
    required_review: String(required),
    review_reasons: required ? 'synthetic_required_review' : '',
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
      taxonomy: GOLD_ENRICHMENT_V3_TAXONOMY_VERSION,
      labels: GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION,
      enrichment: GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
    }).toEqual({
      workflow: 'gold-set-v1-enrichment-v3',
      workflowSchema: '3.0.0',
      prompt: '3.0.0',
      result: '3.0.0',
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
    expect(metadataByPmid.get(previewPmid)).toMatchObject({
      source: {
        full_text_evidence_status: 'preview_only',
        expected_full_text_sha256: '',
      },
    })
    for (const pmid of missingPmids) {
      expect(metadataByPmid.get(pmid)).toMatchObject({
        source: { full_text_evidence_status: 'missing', expected_full_text_sha256: '' },
      })
    }
    expect(families.included_full_text.every((row) => row.source.expected_full_text_sha256)).toBe(
      true,
    )
  })

  it('packetizes deterministically with exact order, sizes, hashes, receipts, and source binding', () => {
    const packets = SYNTHETIC_WORKFLOW.packets
    expect(packets).toHaveLength(20)
    expect(packets.map((packet) => packet.receipt.packetFamily)).toEqual([
      ...Array<GoldEnrichmentV3PacketFamily>(7).fill('included_metadata_only'),
      ...Array<GoldEnrichmentV3PacketFamily>(10).fill('included_full_text'),
      ...Array<GoldEnrichmentV3PacketFamily>(3).fill('excluded_metadata_sufficiency'),
    ])
    expect(packets.map((packet) => packet.receipt.rowCount)).toEqual([
      50, 50, 50, 50, 50, 50, 8, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 100, 100, 72,
    ])

    for (const packet of packets) {
      expect([packet.csvPath, packet.receiptPath].every((value) => !value.endsWith('.pdf'))).toBe(
        true,
      )
      expect(packet.csv).not.toContain('%PDF-')
      const rows = csvObjects(packet.csv, GOLD_ENRICHMENT_V3_PACKET_COLUMNS)
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
          GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS.map((column) => [column, row[column]]),
        )
        expect(row.source_row_sha256).toBe(sha256Bytes(serializeGoldEnrichmentV3Json(source)))
        expect(row.source_projection_sha256).toBe(packet.receipt.sourceProjectionSha256)
      })
      const projection = {
        columns: GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS,
        rows: rows.map((row) =>
          GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS.map((column) => row[column]),
        ),
      }
      expect(packet.receipt.sourceProjectionSha256).toBe(
        sha256Bytes(serializeGoldEnrichmentV3Json(projection)),
      )
      expect(sha256Bytes(serializeGoldEnrichmentV3Json(packet.receipt))).toMatch(/^[a-f0-9]{64}$/u)
      expect(rows[0]).not.toHaveProperty('external_qa_findings')
      expect(rows[0]).not.toHaveProperty('taxonomy_v2_upgrade_candidates')
    }

    const rebuilt = buildSyntheticWorkflow().packets
    expect(rebuilt).toEqual(packets)
    expect(rebuilt.map((packet) => sha256Bytes(packet.csv))).toEqual(
      packets.map((packet) => sha256Bytes(packet.csv)),
    )
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

      const metadataFile = [...fixture.files.values()].find(
        (file) => file.family === 'included_metadata_only',
      )!
      const fullTextFile = [...fixture.files.values()].find(
        (file) => file.family === 'included_full_text',
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
          rows[0].result_schema_version = '3.0.1'
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

  it('rejects packet/receipt checksum drift and forbidden held-out path semantics', async () => {
    const fixture = await materializeValidationFixture()
    try {
      const packet = SYNTHETIC_WORKFLOW.packets[0]
      const packetPath = path.join(fixture.runDirectory, packet.csvPath)
      await writeFile(packetPath, `${packet.csv}\n`, 'utf8')
      await expect(validateFixture(fixture)).rejects.toThrow('artifact checksum mismatch')
      await writeFile(packetPath, packet.csv, 'utf8')

      const receiptPath = path.join(fixture.runDirectory, packet.receiptPath)
      const receipt = serializeGoldEnrichmentV3Json(packet.receipt)
      await writeFile(receiptPath, `${receipt}\n`, 'utf8')
      await expect(validateFixture(fixture)).rejects.toThrow('artifact checksum mismatch')
      await writeFile(receiptPath, receipt, 'utf8')

      const promptPath = path.join(fixture.runDirectory, packet.receipt.promptTemplate.path)
      const prompt = await readFile(promptPath)
      await writeFile(promptPath, Buffer.concat([prompt, Buffer.from('\n')]))
      await expect(validateFixture(fixture)).rejects.toThrow(
        'prompt/result-schema checksum binding',
      )
      await writeFile(promptPath, prompt)

      const schemaPath = path.join(fixture.runDirectory, packet.receipt.expectedResultSchema.path)
      const schema = await readFile(schemaPath)
      await writeFile(schemaPath, Buffer.concat([schema, Buffer.from('\n')]))
      await expect(validateFixture(fixture)).rejects.toThrow(
        'prompt/result-schema checksum binding',
      )
      await writeFile(schemaPath, schema)

      const runDefinitionPath = path.join(fixture.runDirectory, 'run-definition.json')
      const runDefinition = await readFile(runDefinitionPath)
      await writeFile(runDefinitionPath, Buffer.concat([runDefinition, Buffer.from('\n')]))
      await expect(validateFixture(fixture)).rejects.toThrow(
        'Run definition is not checksum-bound by the V3 artifact manifest',
      )
      await writeFile(runDefinitionPath, runDefinition)

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

    const metadata: GoldEnrichmentV3ReviewWorkbookMetadata = {
      workflow_id: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
      workflow_schema_version: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
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
      for (const [relativePath, label] of [
        ['full-text-registry-v3.csv', 'Full-text registry'],
        ['full-text-registry-v3.receipt.json', 'Full-text registry receipt'],
      ] as const) {
        const artifactPath = path.join(fixture.runDirectory, relativePath)
        const original = await readFile(artifactPath)
        await writeFile(artifactPath, Buffer.concat([original, Buffer.from('\n')]))
        await expect(mergeGoldEnrichmentV3(mergeOptions)).rejects.toThrow(
          `${label} is not checksum-bound by the V3 artifact manifest`,
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
      ) as {
        canonicalArtifacts: Array<{ path: string; bytes: number; sha256: string }>
      }
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
        writeFile(
          registryDriftManifestPath,
          serializeGoldEnrichmentV3Json(registryDriftManifest),
          'utf8',
        ),
      ])
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
      const selfConsistentValidation = await validateIsolatedResults({
        runDirectory: packetDrift.runDirectory,
        resultsDirectory: packetDrift.resultsDirectory,
        workspaceRoot: fixture.root,
        publishReports: false,
      })
      expect(selfConsistentValidation.report.valid).toBe(true)
      await expect(
        mergeGoldEnrichmentV3({
          ...mergeOptions,
          runDirectory: packetDrift.runDirectory,
          resultsDirectory: packetDrift.resultsDirectory,
          outputDirectory: path.join(inputs.localData, 'literature', 'packet-drift-merge'),
        }),
      ).rejects.toThrow(/canonical source binding failed.*field journal/iu)

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
      expect(['41229759', '18453348'].every((pmid) => requiredReviewPmids.has(pmid))).toBe(true)

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
