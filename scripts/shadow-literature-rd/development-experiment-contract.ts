import { createHash } from 'node:crypto'
import { TextDecoder } from 'node:util'

import { z } from 'zod'

import {
  SHADOW_DEVELOPMENT_SCOPE_SCHEMA_VERSION,
  LITERATURE_DEVELOPMENT_COHORT_SIZE,
  LITERATURE_DEVELOPMENT_MEMBERSHIP_PROJECTION_VERSION,
  PINNED_DEVELOPMENT_MEMBERSHIP_SHA256,
  authorizeDevelopmentShadowScope,
  developmentShadowScopeDescriptor,
  type AuthorizedDevelopmentShadowScope,
} from '../../src/features/literature/shadow-classifier/held-out-guard'
import {
  buildShadowModelPacket,
  shadowModelInputForAdapter,
  type ShadowModelInput,
  type ShadowModelPacketEnvelope,
} from '../../src/features/literature/shadow-classifier/model-packet'
import { createShadowComponentAttemptEnvelope } from '../../src/features/literature/shadow-classifier/result-validation'
import { NO_ADDITIONAL_SHADOW_ROUTING_RISK } from '../../src/features/literature/shadow-classifier/routing'
import {
  resolveShadowAutonomyPolicy,
  NO_SHADOW_PRODUCTION_EFFECTS,
} from '../../src/features/literature/shadow-classifier/autonomy'
import {
  createShadowRunArtifact,
  verifyShadowRunArtifact,
  type ShadowRunArtifact,
} from '../../src/features/literature/shadow-classifier/shadow-run'
import {
  verifyShadowComponentRegistry,
  type ShadowComponentRegistry,
} from '../../src/features/literature/shadow-classifier/registry'
import { loadConfiguredShadowComponentRegistry } from '../../src/features/literature/shadow-classifier/configured-registry'
import {
  canonicalShadowJson,
  immutableShadowValue,
  sha256ShadowValue,
} from '../../src/features/literature/shadow-classifier/canonical'
import {
  authorizeShadowDevelopmentTruthFromPinnedBytes,
  type AuthorizedShadowDevelopmentTruth,
} from '../../src/features/literature/shadow-classifier/development-truth-authority'

export const SHADOW_DEVELOPMENT_SOURCE_SHA256 =
  'd2942507531a4ba55a5a4195a6919c959eff77cd3473a83eeae16074861b1e64' as const
export const SHADOW_DEVELOPMENT_TRUTH_SHA256 =
  '961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59' as const
export const SHADOW_DEVELOPMENT_PMID_SET_SHA256 =
  'b17375388f2a9298a21b40420fe1749ec69399e328a95328fe52a6cecc9fe250' as const
export const SHADOW_DEVELOPMENT_PREPARED_SCHEMA_VERSION =
  'literature-shadow-development-prepared-experiment/1.0.0' as const
export const SHADOW_DEVELOPMENT_TRUTH_SCHEMA_VERSION =
  'literature-shadow-development-coordinator-truth/1.0.0' as const
export const SHADOW_DEVELOPMENT_WORKER_RESULT_SCHEMA_VERSION =
  'literature-shadow-development-worker-result/1.0.0' as const

const SOURCE_COLUMNS = [
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
  'authors_json',
  'journal',
  'journal_abbreviation',
  'publication_year',
  'publication_types_json',
  'mesh_terms_json',
  'author_keywords_json',
  'languages_json',
  'no_abstract',
  'protected_procedural_cue',
  'first_pass_label',
  'first_pass_confidence',
  'first_pass_requires_human_review',
  'first_pass_rationale',
  'second_pass_label',
  'second_pass_confidence',
  'second_pass_requires_human_review',
  'second_pass_rationale',
  'two_pass_status',
  'provisional_label',
  'triage_lane',
  'triage_reason',
  'physician_final_label',
  'physician_final_confidence',
  'physician_accept_or_modify',
  'physician_notes',
  'physician_reviewed',
  'decision_provenance',
  'is_blinded',
  'relevance_review_complete',
  'enrichment_status',
  'database_import_ready',
] as const

const pmidSchema = z.string().regex(/^[0-9]{1,12}$/u)
const uuidSchema = z
  .string()
  .uuid()
  .refine((value) => value === value.toLowerCase())
const timestampSchema = z.string().datetime({ offset: true })

function sha256Bytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function parseStrictCsvRows(input: string): string[][] {
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
      } else if (character === '"') quoted = false
      else cell += character
    } else if (character === '"') quoted = true
    else if (character === ',') {
      row.push(cell)
      cell = ''
    } else if (character === '\n') {
      row.push(cell.replace(/\r$/u, ''))
      rows.push(row)
      row = []
      cell = ''
    } else cell += character
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field.')
  if (cell || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function strictCsv(
  bytes: Uint8Array,
  expectedSha256: string,
  columns: readonly string[],
  label: string,
): Record<string, string>[] {
  if (sha256Bytes(bytes) !== expectedSha256) throw new Error(`${label} checksum is not exact.`)
  const text = Buffer.from(bytes).toString('utf8')
  if (text.includes('\uFFFD') || text.startsWith('\uFEFF'))
    throw new Error(`${label} UTF-8 is invalid.`)
  const matrix = parseStrictCsvRows(text)
  const header = matrix.shift()
  if (!header || header.join('\0') !== columns.join('\0')) {
    throw new Error(`${label} header is not the exact canonical schema.`)
  }
  if (matrix.length !== LITERATURE_DEVELOPMENT_COHORT_SIZE) {
    throw new Error(`${label} must contain exactly ${LITERATURE_DEVELOPMENT_COHORT_SIZE} rows.`)
  }
  return matrix.map((cells, index) => {
    if (cells.length !== columns.length)
      throw new Error(`${label} row ${index + 2} has wrong width.`)
    return Object.fromEntries(columns.map((column, columnIndex) => [column, cells[columnIndex]!]))
  })
}

function jsonArray<T>(raw: string, schema: z.ZodType<T>, field: string, pmid: string): T {
  try {
    return schema.parse(JSON.parse(raw) as unknown)
  } catch {
    throw new Error(`Development source PMID ${pmid} has invalid ${field}.`)
  }
}

export interface ShadowPreparedPacketRecord {
  pmid: string
  modelInputFilename: string
  responseFilename: string
  chunkDirectory: string
  packetEnvelope: Readonly<ShadowModelPacketEnvelope>
}

export interface ShadowDevelopmentPreparedExperimentArtifact {
  schemaVersion: typeof SHADOW_DEVELOPMENT_PREPARED_SCHEMA_VERSION
  developmentOnly: true
  authorityClass: 'real_development_membership'
  experimentEligible: true
  componentId: 'ip_relevance'
  repositoryCommit: string
  createdAt: string
  executionModel: {
    adapterId: string
    adapterVersion: string
    modelId: string
    reasoningLevel: string
  }
  sourceSha256: typeof SHADOW_DEVELOPMENT_SOURCE_SHA256
  developmentMembershipSha256: typeof PINNED_DEVELOPMENT_MEMBERSHIP_SHA256
  registry: { registryId: string; registryVersion: string; registrySha256: string }
  cohortSize: typeof LITERATURE_DEVELOPMENT_COHORT_SIZE
  chunkSize: number
  chunkCount: number
  ordering: 'sha256_seed_and_pmid'
  orderingSeed: string
  orderingSha256: string
  membership: {
    projectionVersion: typeof LITERATURE_DEVELOPMENT_MEMBERSHIP_PROJECTION_VERSION
    datasetSplit: 'development'
    items: readonly { itemId: string; pmid: string }[]
  }
  packets: readonly ShadowPreparedPacketRecord[]
  artifactSha256: string
}

export interface ShadowDevelopmentModelFacingFile {
  path: string
  content: Readonly<ShadowModelInput>
  sha256: string
}

export interface ShadowDevelopmentWorkerFileEvidence {
  modelInputSha256: string
  rawBase64: string
  rawBytesSha256: string
}

function parseExactDevelopmentSource(sourceBytes: Uint8Array) {
  const source = strictCsv(
    sourceBytes,
    SHADOW_DEVELOPMENT_SOURCE_SHA256,
    SOURCE_COLUMNS,
    'source-v2',
  )
  const itemIds = new Set<string>()
  const pmids = new Set<string>()
  for (const row of source) {
    uuidSchema.parse(row.gold_set_item_id)
    pmidSchema.parse(row.pmid)
    if (
      row.batch_id !== 'fff41ba3-811d-4d28-ba73-9302db3a942a' ||
      row.batch_name !== 'gold-set-v1' ||
      row.dataset_split !== 'development'
    ) {
      throw new Error('Source-v2 is not the exact development batch.')
    }
    if (itemIds.has(row.gold_set_item_id!) || pmids.has(row.pmid!))
      throw new Error('Source-v2 identities are not unique.')
    itemIds.add(row.gold_set_item_id!)
    pmids.add(row.pmid!)
  }
  const sortedPmids = [...pmids].sort((a, b) => a.length - b.length || a.localeCompare(b))
  if (sha256ShadowValue(sortedPmids) !== SHADOW_DEVELOPMENT_PMID_SET_SHA256) {
    throw new Error('Source-v2 PMID set checksum is not exact.')
  }
  return source
}

export function loadExactShadowDevelopmentCoordinatorTruth(input: {
  sourceBytes: Uint8Array
  truthBytes: Uint8Array
}): AuthorizedShadowDevelopmentTruth {
  return authorizeShadowDevelopmentTruthFromPinnedBytes(input)
}

/**
 * Authorizes the complete pinned 630 projection before any per-article packet is built. There is
 * deliberately no candidate-PMID parameter or membership-oracle API.
 */
export function prepareExactShadowDevelopmentExperiment(input: {
  sourceBytes: Uint8Array
  registry: ShadowComponentRegistry
  createdAt: string
  repositoryCommit: string
  executionModel: {
    adapterId: string
    adapterVersion: string
    modelId: string
    reasoningLevel: string
  }
  chunkSize?: number
  orderingSeed?: string
}): {
  scope: AuthorizedDevelopmentShadowScope
  artifact: Readonly<ShadowDevelopmentPreparedExperimentArtifact>
  modelFacingFiles: readonly ShadowDevelopmentModelFacingFile[]
} {
  verifyShadowComponentRegistry(input.registry)
  const approvedRegistry = loadConfiguredShadowComponentRegistry()
  if (sha256ShadowValue(input.registry) !== sha256ShadowValue(approvedRegistry)) {
    throw new Error('Real experiment preparation requires the exact configured registry identity.')
  }
  const source = parseExactDevelopmentSource(input.sourceBytes)
  const createdAt = timestampSchema.parse(input.createdAt)
  const repositoryCommit = z
    .string()
    .regex(/^[a-f0-9]{40}$/u)
    .parse(input.repositoryCommit)
  const chunkSize = z
    .number()
    .int()
    .min(1)
    .max(100)
    .parse(input.chunkSize ?? 30)
  const orderingSeed = z
    .string()
    .trim()
    .min(1)
    .max(200)
    .parse(input.orderingSeed ?? 'shadow-development-ip-relevance-v1')
  const membership = {
    projectionVersion: LITERATURE_DEVELOPMENT_MEMBERSHIP_PROJECTION_VERSION,
    datasetSplit: 'development' as const,
    items: source.map((row) => ({ itemId: row.gold_set_item_id!, pmid: row.pmid! })),
  }
  const scope = authorizeDevelopmentShadowScope({
    schemaVersion: SHADOW_DEVELOPMENT_SCOPE_SCHEMA_VERSION,
    purpose: 'development_only_shadow_r_and_d',
    datasetSplit: 'development',
    queue: 'development',
    membershipSelection: 'exact_checksum_bound_projection',
    complementDerived: false,
    heldOutIdentityInputCount: 0,
    testQueueInspected: false,
    allQueueInspected: false,
    authority: {
      authorityId: 'gold-v2-development-membership-v1',
      membershipSha256: PINNED_DEVELOPMENT_MEMBERSHIP_SHA256,
    },
    membership,
  })
  const scopeDescriptor = developmentShadowScopeDescriptor(scope)
  if (!scopeDescriptor.experimentEligible)
    throw new Error('Exact source did not mint real experiment authority.')
  const stringArraySchema = z.array(z.string().trim().min(1))
  const authorSchema = z.array(
    z
      .object({
        fullName: z.string().trim().min(1),
        abbreviatedName: z.string().trim().min(1).nullable(),
      })
      .strict(),
  )
  const packets: ShadowPreparedPacketRecord[] = []
  const modelFacingFiles: ShadowDevelopmentModelFacingFile[] = []
  const modelOrder = [...source].sort((left, right) => {
    const leftHash = sha256ShadowValue({ orderingSeed, pmid: left.pmid })
    const rightHash = sha256ShadowValue({ orderingSeed, pmid: right.pmid })
    return leftHash.localeCompare(rightHash) || left.pmid!.localeCompare(right.pmid!)
  })
  for (const [index, row] of modelOrder.entries()) {
    const authors = jsonArray(row.authors_json!, authorSchema, 'authors_json', row.pmid!)
    const envelope = buildShadowModelPacket({
      scope,
      registry: input.registry,
      componentId: 'ip_relevance',
      assignmentId: `ip-relevance-${String(index + 1).padStart(3, '0')}`,
      createdAt,
      executionModel: input.executionModel,
      article: {
        pmid: row.pmid,
        doi: null,
        title: row.title,
        abstract: row.abstract === '' ? null : row.abstract,
        meshTerms: jsonArray(row.mesh_terms_json!, stringArraySchema, 'mesh_terms_json', row.pmid!),
        authorKeywords: jsonArray(
          row.author_keywords_json!,
          stringArraySchema,
          'author_keywords_json',
          row.pmid!,
        ),
        publicationTypes: jsonArray(
          row.publication_types_json!,
          stringArraySchema,
          'publication_types_json',
          row.pmid!,
        ),
        journalTitle: row.journal === '' ? null : row.journal,
        journalAbbreviation: row.journal_abbreviation === '' ? null : row.journal_abbreviation,
        publicationYear: z.coerce.number().int().min(1800).max(3000).parse(row.publication_year),
        languages: jsonArray(row.languages_json!, stringArraySchema, 'languages_json', row.pmid!),
        authors,
        fullText: { availability: 'not_requested', source: null, text: null, sha256: null },
      },
    })
    const modelInput = shadowModelInputForAdapter(envelope, input.registry)
    const chunkDirectory = `model-facing/chunk-${String(Math.floor(index / chunkSize) + 1).padStart(2, '0')}`
    const modelInputFilename = `${envelope.packet.modelInputSha256}.json`
    const responseFilename = `${envelope.packet.modelInputSha256}.response.json`
    packets.push({
      pmid: row.pmid!,
      modelInputFilename,
      responseFilename,
      chunkDirectory,
      packetEnvelope: envelope,
    })
    modelFacingFiles.push({
      path: `${chunkDirectory}/${modelInputFilename}`,
      content: modelInput,
      sha256: sha256ShadowValue(modelInput),
    })
  }
  const withoutHash = {
    schemaVersion: SHADOW_DEVELOPMENT_PREPARED_SCHEMA_VERSION,
    developmentOnly: true as const,
    authorityClass: 'real_development_membership' as const,
    experimentEligible: true as const,
    componentId: 'ip_relevance' as const,
    repositoryCommit,
    createdAt,
    executionModel: input.executionModel,
    sourceSha256: SHADOW_DEVELOPMENT_SOURCE_SHA256,
    developmentMembershipSha256: PINNED_DEVELOPMENT_MEMBERSHIP_SHA256,
    registry: {
      registryId: input.registry.registryId,
      registryVersion: input.registry.registryVersion,
      registrySha256: input.registry.registrySha256,
    },
    cohortSize: LITERATURE_DEVELOPMENT_COHORT_SIZE,
    chunkSize,
    chunkCount: Math.ceil(LITERATURE_DEVELOPMENT_COHORT_SIZE / chunkSize),
    ordering: 'sha256_seed_and_pmid' as const,
    orderingSeed,
    orderingSha256: sha256ShadowValue(modelOrder.map((row) => row.pmid)),
    membership,
    packets,
  }
  const artifact = immutableShadowValue({
    ...withoutHash,
    artifactSha256: sha256ShadowValue(withoutHash),
  })
  return { scope, artifact, modelFacingFiles: immutableShadowValue(modelFacingFiles) }
}

export const shadowDevelopmentWorkerResultSchema = z
  .object({
    schemaVersion: z.literal(SHADOW_DEVELOPMENT_WORKER_RESULT_SCHEMA_VERSION),
    modelInputSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
    execution: z
      .object({
        adapterId: z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,159}$/u),
        adapterVersion: z.string().min(1).max(100),
        modelId: z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,159}$/u),
        reasoningLevel: z.string().trim().min(1).max(100),
        agentId: z.string().trim().min(1).max(200),
        executionId: z.string().trim().min(1).max(200),
        attestation: z.literal('operator_attested_not_cryptographically_verified'),
      })
      .strict(),
    response: z.unknown(),
  })
  .strict()

export type ShadowDevelopmentWorkerResult = z.infer<typeof shadowDevelopmentWorkerResultSchema>

/**
 * Reauthenticates that a persisted run is the exact result set for one prepared experiment. A
 * merely core-valid run from another registry, model, prompt, source projection, or commit cannot
 * be paired with this preparation during evaluation/finalization.
 */
export function verifyExactShadowDevelopmentRunBinding(input: {
  prepared: ShadowDevelopmentPreparedExperimentArtifact
  run: ShadowRunArtifact
  scope: AuthorizedDevelopmentShadowScope
}): void {
  verifyShadowRunArtifact(input.run, input.scope)
  if (
    input.prepared.experimentEligible !== true ||
    input.prepared.authorityClass !== 'real_development_membership' ||
    input.prepared.cohortSize !== LITERATURE_DEVELOPMENT_COHORT_SIZE ||
    input.prepared.packets.length !== LITERATURE_DEVELOPMENT_COHORT_SIZE
  ) {
    throw new Error('Run binding requires an exact real-development 630 preparation.')
  }
  if (input.run.definition.repositoryCommit !== input.prepared.repositoryCommit) {
    throw new Error('Run repository commit does not match its prepared experiment.')
  }
  const preparedRegistry = input.prepared.registry
  if (
    input.run.registry.registryId !== preparedRegistry.registryId ||
    input.run.registry.registryVersion !== preparedRegistry.registryVersion ||
    input.run.registry.registrySha256 !== preparedRegistry.registrySha256
  ) {
    throw new Error('Run registry does not match its prepared experiment.')
  }
  const expectedPackets = input.prepared.packets
    .map((record) => ({
      assignmentId: record.packetEnvelope.packet.assignmentId,
      packetEnvelope: record.packetEnvelope,
    }))
    .sort((left, right) => left.assignmentId.localeCompare(right.assignmentId))
  const actualPackets = input.run.attempts
    .map((attempt) => ({
      assignmentId: attempt.assignmentId,
      packetEnvelope: attempt.packetEnvelope,
    }))
    .sort((left, right) => left.assignmentId.localeCompare(right.assignmentId))
  if (canonicalShadowJson(actualPackets) !== canonicalShadowJson(expectedPackets)) {
    throw new Error(
      'Run packet and model-input set does not exactly match its prepared experiment.',
    )
  }
  const expectedPacketHashes = input.prepared.packets
    .map((record) => record.packetEnvelope.packetSha256)
    .sort()
  const actualPacketHashes = [...input.run.definition.exactInputArtifactSha256s].sort()
  if (canonicalShadowJson(actualPacketHashes) !== canonicalShadowJson(expectedPacketHashes)) {
    throw new Error('Run exact input hashes do not match its prepared experiment.')
  }
  if (
    input.run.attempts.some(
      (attempt) =>
        canonicalShadowJson(attempt.packetEnvelope.packet.componentProvenance.model) !==
        canonicalShadowJson(input.prepared.executionModel),
    )
  ) {
    throw new Error('Run execution model provenance does not match its prepared experiment.')
  }
}

export function verifyExactShadowDevelopmentRunReconstitution(input: {
  persistedRun: ShadowRunArtifact
  reconstitutedRun: ShadowRunArtifact
}): void {
  if (canonicalShadowJson(input.persistedRun) !== canonicalShadowJson(input.reconstitutedRun)) {
    throw new Error(
      'Persisted run does not exactly reconstitute from its model-facing response files.',
    )
  }
}

/** File-only ingestion. It cannot dispatch a model, query a database, or accept a PMID selection. */
export function ingestExactShadowDevelopmentWorkerResults(input: {
  sourceBytes: Uint8Array
  prepared: ShadowDevelopmentPreparedExperimentArtifact
  registry: ShadowComponentRegistry
  workerFiles: readonly ShadowDevelopmentWorkerFileEvidence[]
  repositoryCommit: string
  runId: string
  createdAt: string
}): {
  scope: AuthorizedDevelopmentShadowScope
  run: Readonly<ShadowRunArtifact>
} {
  if (Date.parse(input.createdAt) < Date.parse(input.prepared.createdAt)) {
    throw new Error('Run recording time cannot precede prepared packet creation time.')
  }
  const rebuilt = prepareExactShadowDevelopmentExperiment({
    sourceBytes: input.sourceBytes,
    registry: input.registry,
    createdAt: input.prepared.createdAt,
    repositoryCommit: input.prepared.repositoryCommit,
    executionModel: input.prepared.executionModel,
    chunkSize: input.prepared.chunkSize,
    orderingSeed: input.prepared.orderingSeed,
  })
  if (sha256ShadowValue(rebuilt.artifact) !== sha256ShadowValue(input.prepared)) {
    throw new Error('Prepared experiment does not recompute from exact source and registry.')
  }
  const resultByInputHash = new Map<
    string,
    {
      evidence: ShadowDevelopmentWorkerFileEvidence
      result: ShadowDevelopmentWorkerResult | null
      error: string | null
    }
  >()
  const executionIds = new Set<string>()
  for (const [index, evidence] of input.workerFiles.entries()) {
    z.string()
      .regex(/^[a-f0-9]{64}$/u)
      .parse(evidence.modelInputSha256)
    const rawBytes = Buffer.from(evidence.rawBase64, 'base64')
    if (sha256Bytes(rawBytes) !== evidence.rawBytesSha256) {
      throw new Error(`Worker result file ${index + 1} byte checksum is invalid.`)
    }
    if (resultByInputHash.has(evidence.modelInputSha256)) {
      throw new Error(`Duplicate worker result at index ${index + 1}.`)
    }
    let parsedJson: unknown
    let result: ShadowDevelopmentWorkerResult | null = null
    let error: string | null = null
    try {
      const rawUtf8 = new TextDecoder('utf-8', { fatal: true }).decode(rawBytes)
      parsedJson = JSON.parse(rawUtf8) as unknown
      const parsed = shadowDevelopmentWorkerResultSchema.safeParse(parsedJson)
      if (!parsed.success) error = parsed.error.issues.map((issue) => issue.message).join('; ')
      else result = parsed.data
    } catch (cause) {
      error = `invalid_json:${cause instanceof Error ? cause.message : String(cause)}`
    }
    if (result) {
      const expected = input.prepared.executionModel
      if (result.modelInputSha256 !== evidence.modelInputSha256) {
        error = 'declared_model_input_sha256_mismatch'
        result = null
      } else if (
        result.execution.adapterId !== expected.adapterId ||
        result.execution.adapterVersion !== expected.adapterVersion ||
        result.execution.modelId !== expected.modelId ||
        result.execution.reasoningLevel !== expected.reasoningLevel
      ) {
        error = 'execution_attestation_mismatch'
        result = null
      } else if (
        Date.parse(result.startedAt) < Date.parse(input.prepared.createdAt) ||
        Date.parse(result.completedAt) < Date.parse(result.startedAt) ||
        Date.parse(result.completedAt) > Date.parse(input.createdAt)
      ) {
        error = 'execution_chronology_mismatch'
        result = null
      } else if (executionIds.has(result.execution.executionId)) {
        error = 'duplicate_execution_id'
        result = null
      } else {
        executionIds.add(result.execution.executionId)
      }
    }
    resultByInputHash.set(evidence.modelInputSha256, { evidence, result, error })
  }
  const knownHashes = new Set(
    rebuilt.artifact.packets.map((record) => record.packetEnvelope.packet.modelInputSha256),
  )
  if ([...resultByInputHash].some(([hash]) => !knownHashes.has(hash))) {
    throw new Error('Worker results include an unknown model-input checksum.')
  }
  const assignments = rebuilt.artifact.packets.map((record) => {
    const workerFile = resultByInputHash.get(record.packetEnvelope.packet.modelInputSha256)
    const worker = workerFile?.result ?? null
    let rawResult: unknown = null
    if (workerFile && !worker) {
      rawResult = {
        schemaVersion: 'literature-shadow-invalid-worker-file/1.0.0',
        modelInputSha256: workerFile.evidence.modelInputSha256,
        rawBytesSha256: workerFile.evidence.rawBytesSha256,
        rawBase64: workerFile.evidence.rawBase64,
        validationError: workerFile.error ?? 'invalid_worker_file',
      }
    } else if (worker) {
      try {
        rawResult = createShadowComponentAttemptEnvelope({
          packetEnvelope: record.packetEnvelope,
          startedAt: worker.startedAt,
          completedAt: worker.completedAt,
          modelResponse: worker.response,
        })
      } catch {
        // The unmodified invalid worker payload is retained and rejected by core validation.
        rawResult = worker
      }
    }
    return {
      packetEnvelope: record.packetEnvelope,
      rawResult,
      executionReceipt: worker
        ? {
            ...worker.execution,
            modelInputSha256: worker.modelInputSha256,
            startedAt: worker.startedAt,
            completedAt: worker.completedAt,
            workerFileSha256: workerFile!.evidence.rawBytesSha256,
          }
        : null,
      routingAssessment: NO_ADDITIONAL_SHADOW_ROUTING_RISK,
    }
  })
  const run = createShadowRunArtifact({
    runId: input.runId,
    repositoryCommit: z.literal(input.prepared.repositoryCommit).parse(input.repositoryCommit),
    createdAt: input.createdAt,
    scope: rebuilt.scope,
    registry: input.registry,
    autonomyPolicy: resolveShadowAutonomyPolicy({
      schemaVersion: 'literature-shadow-autonomy/1.0.0',
      requestedLevel: 1,
      developmentOnly: true,
      productionEnabled: false,
      automaticEffects: NO_SHADOW_PRODUCTION_EFFECTS,
    }),
    assignments,
    exactInputArtifactSha256s: rebuilt.artifact.packets.map(
      (record) => record.packetEnvelope.packetSha256,
    ),
    requiredComponentIds: ['ip_relevance'],
  })
  return { scope: rebuilt.scope, run }
}
