import { createHash } from 'node:crypto'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildUltraFrozenTruthEvaluation,
  writeUltraFrozenTruthEvaluationArtifacts,
  type UltraFrozenTruthEvaluationReport,
  type UltraFrozenTruthRow,
} from '@/features/literature/ultra-screening/frozen-truth-evaluation'
import {
  compareNumericPmids,
  ultraScreeningResultSchema,
  ULTRA_RELEVANCE_LABELS,
  type UltraScreeningResult,
} from '@/features/literature/ultra-screening/core'

import {
  assertKnownArguments,
  hasFlag,
  parseCliArguments,
  stringArgument,
  type ParsedCliArguments,
} from './lib/cli'

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const PMID_PATTERN = /^[0-9]{1,12}$/u

const HELP = `
Evaluate a completed Ultra phase against a supplied frozen full-history export.

This command never connects to Supabase. Every source is an explicit immutable file plus an
expected SHA-256 digest. Existing nonmatching evaluation artifacts are never overwritten.

Usage:
  npx tsx scripts/literature/ultra-frozen-evaluation.ts \\
    --evaluation-id <id> \\
    --evaluated-at <ISO timestamp> \\
    --prediction-run-root <immutable v1 run root> \\
    --output-root <run root> \\
    --truth-export <full-history JSON> \\
    --truth-sha256 <sha256> \\
    --truth-batch <batch name> \\
    --truth-frozen-at <exact timestamp> \\
    --manifest <v1 progress-manifest.json> \\
    --manifest-sha256 <sha256> \\
    --phase <phase id> \\
    --aggregate-sha256 <sha256> \\
    --prediction-attempt-provenance-status unavailable_legacy \\
    --repository-commit <full Git commit> \\
    --policy-record <path> \\
    --policy-version <version> \\
    --policy-sha256 <sha256> \\
    --prompt-record <path> \\
    --prompt-version <version> \\
    --prompt-sha256 <sha256> \\
    [--compare-phases <phase-a,phase-b>] \\
    [--selection-audits <path-a,path-b>] \\
    [--selection-audit-sha256s <sha-a,sha-b>]

Coordinator selection audits are the only source of no-abstract and animal/preclinical subset
membership. Audit paths and hashes must be supplied in the same order.
`.trim()

interface LegacyPhaseRecord {
  status: unknown
  aggregateOutputPath: unknown
  aggregateOutputSha256: unknown
}

interface LegacyManifestRecord {
  manifestVersion: unknown
  runId: unknown
  rootPath: unknown
  phases: unknown
}

interface FrozenTruthReview {
  [key: string]: unknown
  id?: unknown
  revision?: unknown
  relevanceLabel?: unknown
  revisionKind?: unknown
  lifecycleState?: unknown
  supersedesReviewId?: unknown
  compensatesReviewId?: unknown
  effectiveSourceReviewId?: unknown
  operationActionId?: unknown
}

const COMPENSATION_PAYLOAD_FIELDS = [
  'relevanceLabel',
  'metadataSufficiency',
  'reviewerConfidence',
  'topicIds',
  'technologyTags',
  'technologyTagStatus',
  'clinicalPurposes',
  'diseaseTags',
  'diseaseTagStatus',
  'studyDesign',
  'publicationStatus',
  'categorizationFromFullText',
  'notes',
  'usedSupplementalMetadata',
  'reviewSeconds',
  'taxonomyVersion',
  'labelSchemaVersion',
  'enrichmentSchemaVersion',
  'enrichmentProvenance',
  'reviewerEmail',
  'isBlinded',
] as const

function comparableCompensationPayload(review: FrozenTruthReview) {
  return JSON.stringify(
    Object.fromEntries(COMPENSATION_PAYLOAD_FIELDS.map((field) => [field, review[field]])),
  )
}

interface FrozenTruthRecord {
  pmid?: unknown
  abstract?: unknown
  reviewStatus?: unknown
  reviewSource?: unknown
  review?: unknown
  reviewHistory?: unknown
  chainHeadReviewId?: unknown
}

interface FrozenTruthExportRecord {
  exportVersion?: unknown
  exportedAt?: unknown
  batch?: unknown
  split?: unknown
  includesHistory?: unknown
  records?: unknown
}

export interface UltraLegacyProvenanceRecord {
  path: string
  version: string
  sha256: string
}

export interface UltraCoordinatorSelectionAuditInput {
  path: string
  sha256: string
}

export interface RunUltraFrozenEvaluationOptions {
  evaluationId: string
  evaluatedAt: string
  predictionRunRoot: string
  outputRoot: string
  truthExportPath: string
  truthSha256: string
  truthBatchName: string
  truthFrozenAt: string
  manifestPath: string
  manifestSha256: string
  phaseId: string
  predictionAggregateSha256: string
  predictionAttemptProvenanceStatus: 'fully_recorded' | 'unavailable_legacy'
  comparePhaseIds?: readonly string[]
  selectionAudits?: readonly UltraCoordinatorSelectionAuditInput[]
  screeningPolicyRecord: UltraLegacyProvenanceRecord
  workerPromptTemplateRecord: UltraLegacyProvenanceRecord
  repositoryCommit: string
}

export interface RunUltraFrozenEvaluationResult {
  report: UltraFrozenTruthEvaluationReport
  artifacts: Awaited<ReturnType<typeof writeUltraFrozenTruthEvaluationArtifacts>>
  verifiedInputs: {
    truthExportPath: string
    truthSha256: string
    predictionRunRoot: string
    manifestPath: string
    manifestSha256: string
    predictionAggregatePath: string
    predictionAggregateSha256: string
    screeningPolicyRecordPath: string
    screeningPolicySha256: string
    workerPromptTemplateRecordPath: string
    workerPromptTemplateSha256: string
    selectionAudits: Array<{ path: string; sha256: string }>
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function expectedString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a string.`)
  return value
}

function expectedObject(value: unknown, field: string) {
  if (!isObject(value)) throw new Error(`${field} must be an object.`)
  return value
}

function expectedArray(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`)
  return value
}

function assertSha256(value: string, field: string) {
  if (!SHA256_PATTERN.test(value)) throw new Error(`${field} must be a lowercase SHA-256 digest.`)
}

function assertTimestamp(value: string, field: string) {
  if (!value.includes('T') || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be an ISO-8601 timestamp.`)
  }
}

function sha256(data: Buffer | string) {
  return createHash('sha256').update(data).digest('hex')
}

async function readVerifiedFile(path: string, expectedSha256: string, field: string) {
  assertSha256(expectedSha256, `${field} SHA-256`)
  const resolvedPath = resolve(path)
  const data = await readFile(resolvedPath)
  const actualSha256 = sha256(data)
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `${field} SHA-256 mismatch: expected ${expectedSha256}, received ${actualSha256}.`,
    )
  }
  return { resolvedPath, data, sha256: actualSha256 }
}

function parseJson(data: Buffer, field: string) {
  try {
    return JSON.parse(data.toString('utf8')) as unknown
  } catch (error) {
    throw new Error(
      `${field} contains malformed JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function resolveManifestArtifact(manifestPath: string, artifactPath: string) {
  return isAbsolute(artifactPath) ? artifactPath : resolve(dirname(manifestPath), artifactPath)
}

function parseLegacyManifest(value: unknown) {
  const manifest = expectedObject(value, 'manifest') as unknown as LegacyManifestRecord
  if (manifest.manifestVersion !== '1.0.0') {
    throw new Error(
      `Expected legacy manifestVersion 1.0.0, received ${String(manifest.manifestVersion)}.`,
    )
  }
  const runId = expectedString(manifest.runId, 'manifest.runId')
  const rootPath = expectedString(manifest.rootPath, 'manifest.rootPath')
  const phaseObject = expectedObject(manifest.phases, 'manifest.phases')
  return { runId, rootPath, phases: phaseObject }
}

function phaseRecord(phases: Record<string, unknown>, phaseId: string) {
  const phase = expectedObject(
    phases[phaseId],
    `manifest.phases.${phaseId}`,
  ) as unknown as LegacyPhaseRecord
  if (phase.status !== 'completed') {
    throw new Error(`Phase ${phaseId} must be completed; received ${String(phase.status)}.`)
  }
  const aggregateOutputPath = expectedString(
    phase.aggregateOutputPath,
    `manifest.phases.${phaseId}.aggregateOutputPath`,
  )
  const aggregateOutputSha256 = expectedString(
    phase.aggregateOutputSha256,
    `manifest.phases.${phaseId}.aggregateOutputSha256`,
  )
  assertSha256(aggregateOutputSha256, `manifest phase ${phaseId} aggregateOutputSha256`)
  return { aggregateOutputPath, aggregateOutputSha256 }
}

function assertPathWithin(rootPath: string, candidatePath: string, field: string) {
  const relation = relative(resolve(rootPath), resolve(candidatePath))
  if (
    relation === '..' ||
    relation.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
    isAbsolute(relation)
  ) {
    throw new Error(`${field} must remain inside predictionRunRoot.`)
  }
}

async function lstatIfPresent(path: string) {
  try {
    return await lstat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function assertSafeEvaluationOutputRoot(options: {
  predictionRunRoot: string
  outputRoot: string
  evaluationId: string
}) {
  const predictionRootRealPath = await realpath(options.predictionRunRoot)
  const predictionParentRealPath = await realpath(dirname(options.predictionRunRoot))
  const outputParentRealPath = await realpath(dirname(options.outputRoot))
  if (outputParentRealPath !== predictionParentRealPath) {
    throw new Error('outputRoot must resolve beside predictionRunRoot, not through another parent.')
  }

  const candidatePaths = [
    options.outputRoot,
    join(options.outputRoot, 'evaluations'),
    join(options.outputRoot, 'evaluations', 'frozen-truth-v2'),
    join(options.outputRoot, 'evaluations', 'frozen-truth-v2', options.evaluationId),
  ]
  for (const candidatePath of candidatePaths) {
    const metadata = await lstatIfPresent(candidatePath)
    if (!metadata) break
    if (metadata.isSymbolicLink()) {
      throw new Error(`Evaluation output path must not be a symbolic link: ${candidatePath}`)
    }
    if (!metadata.isDirectory()) {
      throw new Error(`Evaluation output path component must be a directory: ${candidatePath}`)
    }
  }

  const outputMetadata = await lstatIfPresent(options.outputRoot)
  if (outputMetadata) {
    const outputRootRealPath = await realpath(options.outputRoot)
    if (
      outputRootRealPath === predictionRootRealPath ||
      dirname(outputRootRealPath) !== predictionParentRealPath
    ) {
      throw new Error('outputRoot resolves into or outside the preserved prediction run boundary.')
    }
  }
}

function parseAggregate(data: Buffer, phaseId: string) {
  const records: UltraScreeningResult[] = []
  const seenPmids = new Set<string>()
  const lines = data
    .toString('utf8')
    .split(/\r?\n/u)
    .map((text, index) => ({ line: index + 1, text }))
    .filter(({ text }) => text.trim())
  for (const { line, text } of lines) {
    let raw: unknown
    try {
      raw = JSON.parse(text) as unknown
    } catch (error) {
      throw new Error(
        `Phase ${phaseId} aggregate line ${line} is malformed JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
    const parsed = ultraScreeningResultSchema.safeParse(raw)
    if (!parsed.success) {
      throw new Error(
        `Phase ${phaseId} aggregate line ${line} is invalid: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'record'} ${issue.message}`)
          .join('; ')}`,
      )
    }
    if (seenPmids.has(parsed.data.pmid)) {
      throw new Error(`Phase ${phaseId} aggregate contains duplicate PMID ${parsed.data.pmid}.`)
    }
    seenPmids.add(parsed.data.pmid)
    records.push(parsed.data)
  }
  if (records.length === 0) throw new Error(`Phase ${phaseId} aggregate contains no results.`)
  return records
}

async function readPhaseAggregate(options: {
  manifestPath: string
  predictionRunRoot: string
  phases: Record<string, unknown>
  phaseId: string
  explicitSha256?: string
}) {
  const phase = phaseRecord(options.phases, options.phaseId)
  if (options.explicitSha256) {
    assertSha256(options.explicitSha256, 'predictionAggregateSha256')
    if (phase.aggregateOutputSha256 !== options.explicitSha256) {
      throw new Error(
        `Phase ${options.phaseId} manifest aggregate SHA-256 does not match the explicit digest.`,
      )
    }
  }
  const aggregatePath = resolveManifestArtifact(options.manifestPath, phase.aggregateOutputPath)
  assertPathWithin(options.predictionRunRoot, aggregatePath, `Phase ${options.phaseId} aggregate`)
  const aggregate = await readVerifiedFile(
    aggregatePath,
    phase.aggregateOutputSha256,
    `phase ${options.phaseId} aggregate`,
  )
  return {
    phaseId: options.phaseId,
    aggregatePath: aggregate.resolvedPath,
    aggregateSha256: aggregate.sha256,
    records: parseAggregate(aggregate.data, options.phaseId),
  }
}

function parseTruthExport(value: unknown, options: { batchName: string; frozenAt: string }) {
  const exported = expectedObject(value, 'truth export') as unknown as FrozenTruthExportRecord
  if (exported.exportVersion !== '1.0.0' && exported.exportVersion !== '1.1.0') {
    throw new Error(
      `Expected truth exportVersion 1.0.0 or 1.1.0, received ${String(exported.exportVersion)}.`,
    )
  }
  const exportedAt = expectedString(exported.exportedAt, 'truth export.exportedAt')
  assertTimestamp(exportedAt, 'truth export.exportedAt')
  if (exported.split !== 'all') throw new Error('Truth export must use split=all.')
  if (exported.includesHistory !== true) {
    throw new Error('Truth export must include complete review history.')
  }
  const batch = expectedObject(exported.batch, 'truth export.batch')
  if (batch.name !== options.batchName) {
    throw new Error(
      `Truth batch mismatch: expected ${options.batchName}, received ${String(batch.name)}.`,
    )
  }
  if (batch.status !== 'frozen') {
    throw new Error(`Truth batch must be frozen; received ${String(batch.status)}.`)
  }
  if (batch.frozenAt !== options.frozenAt) {
    throw new Error(
      `Truth frozenAt mismatch: expected ${options.frozenAt}, received ${String(batch.frozenAt)}.`,
    )
  }
  assertTimestamp(options.frozenAt, 'truthFrozenAt')

  const labels = new Set<string>(ULTRA_RELEVANCE_LABELS)
  const records = expectedArray(exported.records, 'truth export.records')
  const truthByPmid = new Map<string, UltraFrozenTruthRow>()
  const abstractByPmid = new Map<string, string | null>()
  for (const [index, rawRecord] of records.entries()) {
    const record = expectedObject(rawRecord, `truth export.records[${index}]`) as FrozenTruthRecord
    const pmid = expectedString(record.pmid, `truth export.records[${index}].pmid`)
    if (!PMID_PATTERN.test(pmid)) throw new Error(`Truth export contains invalid PMID ${pmid}.`)
    if (truthByPmid.has(pmid)) throw new Error(`Truth export contains duplicate PMID ${pmid}.`)
    if (record.reviewStatus !== 'completed' || record.reviewSource !== 'completed') {
      throw new Error(`Truth PMID ${pmid} does not have a completed current decision.`)
    }
    const review = expectedObject(
      record.review,
      `truth PMID ${pmid} current review`,
    ) as FrozenTruthReview
    const reviewId = expectedString(review.id, `truth PMID ${pmid} current review ID`)
    if (exported.exportVersion === '1.1.0') {
      if (record.chainHeadReviewId !== reviewId) {
        throw new Error(`Truth PMID ${pmid} current review is not the immutable chain head.`)
      }
      if (review.lifecycleState !== 'effective') {
        throw new Error(`Truth PMID ${pmid} current review is not effective.`)
      }
    }
    if (!labels.has(String(review.relevanceLabel))) {
      throw new Error(
        `Truth PMID ${pmid} has invalid relevance label ${String(review.relevanceLabel)}.`,
      )
    }
    if (!Number.isInteger(review.revision) || Number(review.revision) < 1) {
      throw new Error(`Truth PMID ${pmid} has an invalid current revision.`)
    }
    const history = expectedArray(record.reviewHistory, `truth PMID ${pmid} reviewHistory`).map(
      (rawHistory, historyIndex) =>
        expectedObject(
          rawHistory,
          `truth PMID ${pmid} reviewHistory[${historyIndex}]`,
        ) as FrozenTruthReview,
    )
    const historyIds = history.map((historyReview, historyIndex) =>
      expectedString(historyReview.id, `truth PMID ${pmid} reviewHistory[${historyIndex}].id`),
    )
    if (new Set(historyIds).size !== historyIds.length) {
      throw new Error(`Truth PMID ${pmid} reviewHistory contains duplicate review IDs.`)
    }
    const currentInHistory = history.find((historyReview) => historyReview.id === reviewId)
    if (!currentInHistory || currentInHistory.revision !== review.revision) {
      throw new Error(`Truth PMID ${pmid} current review is not preserved in reviewHistory.`)
    }
    if (currentInHistory.relevanceLabel !== review.relevanceLabel) {
      throw new Error(`Truth PMID ${pmid} current review label differs from reviewHistory.`)
    }
    const revisions = history.map((historyReview) => Number(historyReview.revision))
    if (revisions.some((revision) => !Number.isInteger(revision) || revision < 1)) {
      throw new Error(`Truth PMID ${pmid} reviewHistory contains an invalid revision.`)
    }
    if (review.revision !== Math.max(...revisions)) {
      throw new Error(`Truth PMID ${pmid} current review is not the latest revision.`)
    }
    if (exported.exportVersion === '1.1.0') {
      const orderedHistory = [...history].sort(
        (left, right) => Number(left.revision) - Number(right.revision),
      )
      orderedHistory.forEach((historyReview, historyIndex) => {
        const prior = historyIndex === 0 ? null : orderedHistory[historyIndex - 1]
        if (historyReview.revision !== historyIndex + 1) {
          throw new Error(`Truth PMID ${pmid} reviewHistory is not revision-contiguous.`)
        }
        if (historyReview.supersedesReviewId !== (prior?.id ?? null)) {
          throw new Error(`Truth PMID ${pmid} reviewHistory contains a predecessor fork.`)
        }
        if (historyReview.revisionKind === 'compensation') {
          const imported = prior
          const preImportHead = historyIndex >= 2 ? orderedHistory[historyIndex - 2] : null
          const expectedSourceId =
            preImportHead?.lifecycleState === 'effective'
              ? preImportHead.revisionKind === 'compensation'
                ? preImportHead.effectiveSourceReviewId
                : preImportHead.id
              : null
          const effectiveSource =
            typeof expectedSourceId === 'string'
              ? orderedHistory
                  .slice(0, historyIndex - 1)
                  .find((entry) => entry.id === expectedSourceId)
              : null
          const expectedLifecycle = effectiveSource ? 'effective' : 'withdrawn'
          const payloadSource = effectiveSource ?? imported
          if (
            historyReview.operationActionId == null ||
            imported?.revisionKind !== 'import' ||
            historyReview.compensatesReviewId !== imported.id ||
            historyReview.lifecycleState !== expectedLifecycle ||
            historyReview.effectiveSourceReviewId !== (effectiveSource?.id ?? null) ||
            !payloadSource ||
            comparableCompensationPayload(historyReview) !==
              comparableCompensationPayload(payloadSource)
          ) {
            throw new Error(
              `Truth PMID ${pmid} compensation source or copied payload is not chain-consistent.`,
            )
          }
        } else if (
          !['standard', 'import'].includes(String(historyReview.revisionKind)) ||
          historyReview.lifecycleState !== 'effective' ||
          historyReview.compensatesReviewId !== null ||
          historyReview.effectiveSourceReviewId !== null ||
          (historyReview.revisionKind === 'standard' && historyReview.operationActionId !== null) ||
          (historyReview.revisionKind === 'import' &&
            typeof historyReview.operationActionId !== 'string')
        ) {
          throw new Error(`Truth PMID ${pmid} review lifecycle metadata is invalid.`)
        }
      })
    }
    if (record.abstract !== null && typeof record.abstract !== 'string') {
      throw new Error(`Truth PMID ${pmid} abstract must be a string or null.`)
    }
    truthByPmid.set(pmid, {
      pmid,
      relevanceLabel: review.relevanceLabel as UltraFrozenTruthRow['relevanceLabel'],
    })
    abstractByPmid.set(pmid, record.abstract)
  }
  if (truthByPmid.size === 0) throw new Error('Truth export contains no records.')
  return { exportedAt, truthByPmid, abstractByPmid }
}

async function verifyProvenanceRecord(record: UltraLegacyProvenanceRecord, field: string) {
  if (!record.version.trim()) throw new Error(`${field} version must not be empty.`)
  const verified = await readVerifiedFile(record.path, record.sha256, field)
  return { path: verified.resolvedPath, version: record.version, sha256: verified.sha256 }
}

async function readSelectionSubsets(
  audits: readonly UltraCoordinatorSelectionAuditInput[],
  truthByPmid: ReadonlyMap<string, UltraFrozenTruthRow>,
  abstractByPmid: ReadonlyMap<string, string | null>,
) {
  const animalPreclinicalPmids = new Set<string>()
  const verified: Array<{ path: string; sha256: string }> = []
  for (const [auditIndex, input] of audits.entries()) {
    const audit = await readVerifiedFile(
      input.path,
      input.sha256,
      `selection audit ${auditIndex + 1}`,
    )
    verified.push({ path: audit.resolvedPath, sha256: audit.sha256 })
    const parsed = expectedObject(
      parseJson(audit.data, `selection audit ${auditIndex + 1}`),
      `selection audit ${auditIndex + 1}`,
    )
    if (parsed.kind !== 'terra_escalation_selection') continue
    const selections = expectedArray(
      parsed.selections,
      `selection audit ${auditIndex + 1}.selections`,
    )
    for (const [selectionIndex, rawSelection] of selections.entries()) {
      const selection = expectedObject(
        rawSelection,
        `selection audit ${auditIndex + 1}.selections[${selectionIndex}]`,
      )
      const pmid = expectedString(
        selection.pmid,
        `selection audit ${auditIndex + 1}.selections[${selectionIndex}].pmid`,
      )
      if (!truthByPmid.has(pmid)) {
        throw new Error(`Selection audit PMID ${pmid} is outside the supplied frozen truth.`)
      }
      const reasons = expectedArray(
        selection.reasons,
        `selection audit ${auditIndex + 1}.selections[${selectionIndex}].reasons`,
      ).map((reason, reasonIndex) =>
        expectedString(
          reason,
          `selection audit ${auditIndex + 1}.selections[${selectionIndex}].reasons[${reasonIndex}]`,
        ),
      )
      if (reasons.includes('no_abstract_boundary')) {
        if (abstractByPmid.get(pmid) !== null) {
          throw new Error(
            `Selection audit marks PMID ${pmid} as no-abstract but the frozen export has an abstract.`,
          )
        }
      }
      if (reasons.includes('animal_preclinical_boundary')) animalPreclinicalPmids.add(pmid)
    }
  }
  verified.sort((left, right) => left.path.localeCompare(right.path))
  return { animalPreclinicalPmids, verified }
}

export async function runUltraFrozenEvaluation(
  options: RunUltraFrozenEvaluationOptions,
): Promise<RunUltraFrozenEvaluationResult> {
  const truthFile = await readVerifiedFile(
    options.truthExportPath,
    options.truthSha256,
    'frozen truth export',
  )
  const truth = parseTruthExport(parseJson(truthFile.data, 'frozen truth export'), {
    batchName: options.truthBatchName,
    frozenAt: options.truthFrozenAt,
  })
  const manifestFile = await readVerifiedFile(
    options.manifestPath,
    options.manifestSha256,
    'legacy v1 manifest',
  )
  const manifest = parseLegacyManifest(parseJson(manifestFile.data, 'legacy v1 manifest'))
  const predictionRunRoot = resolve(options.predictionRunRoot)
  const outputRoot = resolve(options.outputRoot)
  assertPathWithin(predictionRunRoot, manifestFile.resolvedPath, 'Legacy v1 manifest')
  if (resolve(manifest.rootPath) !== predictionRunRoot) {
    throw new Error(
      `predictionRunRoot does not match manifest.rootPath: ${predictionRunRoot} versus ${manifest.rootPath}.`,
    )
  }
  const outputRelation = relative(predictionRunRoot, outputRoot)
  if (outputRelation === '' || (!outputRelation.startsWith('..') && !isAbsolute(outputRelation))) {
    throw new Error('outputRoot must be outside predictionRunRoot to preserve the v1 run digest.')
  }
  if (dirname(outputRoot) !== dirname(predictionRunRoot)) {
    throw new Error('outputRoot must be a sibling of predictionRunRoot.')
  }
  await assertSafeEvaluationOutputRoot({
    predictionRunRoot,
    outputRoot,
    evaluationId: options.evaluationId,
  })
  if (options.predictionAttemptProvenanceStatus !== 'unavailable_legacy') {
    throw new Error(
      'Legacy v1 evaluation requires predictionAttemptProvenanceStatus=unavailable_legacy.',
    )
  }
  const policy = await verifyProvenanceRecord(
    options.screeningPolicyRecord,
    'screening policy record',
  )
  const prompt = await verifyProvenanceRecord(
    options.workerPromptTemplateRecord,
    'worker prompt template record',
  )
  const primary = await readPhaseAggregate({
    manifestPath: manifestFile.resolvedPath,
    predictionRunRoot,
    phases: manifest.phases,
    phaseId: options.phaseId,
    explicitSha256: options.predictionAggregateSha256,
  })
  const primaryPmids = new Set(primary.records.map((record) => record.pmid))
  const selectedTruth = [...primaryPmids].sort(compareNumericPmids).map((pmid) => {
    const row = truth.truthByPmid.get(pmid)
    if (!row) throw new Error(`Prediction PMID ${pmid} is absent from frozen truth.`)
    return row
  })

  const comparePhaseIds = [...(options.comparePhaseIds ?? [])]
  if (new Set(comparePhaseIds).size !== comparePhaseIds.length) {
    throw new Error('comparePhaseIds contains duplicates.')
  }
  if (comparePhaseIds.includes(options.phaseId)) {
    throw new Error('comparePhaseIds must not include the primary phase.')
  }
  const comparisonAggregates = await Promise.all(
    comparePhaseIds.map((phaseId) =>
      readPhaseAggregate({
        manifestPath: manifestFile.resolvedPath,
        predictionRunRoot,
        phases: manifest.phases,
        phaseId,
      }),
    ),
  )
  const comparisons = comparisonAggregates.map((comparison) => {
    const overlapping = comparison.records.filter((record) => primaryPmids.has(record.pmid))
    if (overlapping.length === 0) {
      throw new Error(
        `Comparison phase ${comparison.phaseId} has no overlap with ${options.phaseId}.`,
      )
    }
    return {
      comparisonId: comparison.phaseId,
      predictionRunId: manifest.runId,
      predictionPhase: comparison.phaseId,
      predictionAggregateSha256: comparison.aggregateSha256,
      predictions: overlapping,
    }
  })
  const subsetAudit = await readSelectionSubsets(
    options.selectionAudits ?? [],
    truth.truthByPmid,
    truth.abstractByPmid,
  )
  const subsetInput = {
    noAbstractPmids: [...truth.abstractByPmid]
      .filter(([pmid, abstract]) => abstract === null && primaryPmids.has(pmid))
      .map(([pmid]) => pmid)
      .sort(compareNumericPmids),
    ...((options.selectionAudits?.length ?? 0) > 0
      ? {
          animalPreclinicalPmids: [...subsetAudit.animalPreclinicalPmids]
            .filter((pmid) => primaryPmids.has(pmid))
            .sort(compareNumericPmids),
        }
      : {}),
  }

  const report = buildUltraFrozenTruthEvaluation({
    evaluationId: options.evaluationId,
    evaluationTimestamp: options.evaluatedAt,
    provenance: {
      predictionRunId: manifest.runId,
      predictionPhase: options.phaseId,
      predictionAggregateSha256: primary.aggregateSha256,
      predictionAttemptProvenanceStatus: options.predictionAttemptProvenanceStatus,
      screeningPolicyRecordPath: policy.path,
      screeningPolicyVersion: policy.version,
      screeningPolicySha256: policy.sha256,
      workerPromptTemplateRecordPath: prompt.path,
      workerPromptTemplateVersion: prompt.version,
      workerPromptTemplateSha256: prompt.sha256,
      repositoryCommit: options.repositoryCommit,
      truthBatchName: options.truthBatchName,
      truthBatchStatus: 'frozen',
      truthBatchFrozenAt: options.truthFrozenAt,
      truthFullHistoryJsonSha256: truthFile.sha256,
      truthExportedAt: truth.exportedAt,
      selectionAudits: subsetAudit.verified,
    },
    truth: selectedTruth,
    predictions: primary.records,
    subsets: subsetInput,
    comparisons,
  })
  const artifacts = await writeUltraFrozenTruthEvaluationArtifacts(outputRoot, report)
  return {
    report,
    artifacts,
    verifiedInputs: {
      truthExportPath: truthFile.resolvedPath,
      truthSha256: truthFile.sha256,
      predictionRunRoot,
      manifestPath: manifestFile.resolvedPath,
      manifestSha256: manifestFile.sha256,
      predictionAggregatePath: primary.aggregatePath,
      predictionAggregateSha256: primary.aggregateSha256,
      screeningPolicyRecordPath: policy.path,
      screeningPolicySha256: policy.sha256,
      workerPromptTemplateRecordPath: prompt.path,
      workerPromptTemplateSha256: prompt.sha256,
      selectionAudits: subsetAudit.verified,
    },
  }
}

function requiredArgument(arguments_: ParsedCliArguments, key: string) {
  const value = stringArgument(arguments_, key)
  if (!value) throw new Error(`--${key} is required.`)
  return value
}

function commaSeparated(value: string | undefined, field: string) {
  if (!value) return []
  const values = value.split(',').map((entry) => entry.trim())
  if (values.some((entry) => !entry)) throw new Error(`${field} contains an empty entry.`)
  if (new Set(values).size !== values.length) throw new Error(`${field} contains duplicates.`)
  return values
}

export function parseUltraFrozenEvaluationCliArguments(
  argv: string[],
): RunUltraFrozenEvaluationOptions | null {
  const arguments_ = parseCliArguments(argv)
  assertKnownArguments(arguments_, [
    'help',
    'evaluation-id',
    'evaluated-at',
    'prediction-run-root',
    'output-root',
    'truth-export',
    'truth-sha256',
    'truth-batch',
    'truth-frozen-at',
    'manifest',
    'manifest-sha256',
    'phase',
    'aggregate-sha256',
    'prediction-attempt-provenance-status',
    'compare-phases',
    'selection-audits',
    'selection-audit-sha256s',
    'policy-record',
    'policy-version',
    'policy-sha256',
    'prompt-record',
    'prompt-version',
    'prompt-sha256',
    'repository-commit',
  ])
  if (hasFlag(arguments_, 'help')) return null
  const selectionAuditPaths = commaSeparated(
    stringArgument(arguments_, 'selection-audits'),
    '--selection-audits',
  )
  const selectionAuditHashes = commaSeparated(
    stringArgument(arguments_, 'selection-audit-sha256s'),
    '--selection-audit-sha256s',
  )
  if (selectionAuditPaths.length !== selectionAuditHashes.length) {
    throw new Error('--selection-audits and --selection-audit-sha256s must have equal lengths.')
  }
  return {
    evaluationId: requiredArgument(arguments_, 'evaluation-id'),
    evaluatedAt: requiredArgument(arguments_, 'evaluated-at'),
    predictionRunRoot: requiredArgument(arguments_, 'prediction-run-root'),
    outputRoot: requiredArgument(arguments_, 'output-root'),
    truthExportPath: requiredArgument(arguments_, 'truth-export'),
    truthSha256: requiredArgument(arguments_, 'truth-sha256'),
    truthBatchName: requiredArgument(arguments_, 'truth-batch'),
    truthFrozenAt: requiredArgument(arguments_, 'truth-frozen-at'),
    manifestPath: requiredArgument(arguments_, 'manifest'),
    manifestSha256: requiredArgument(arguments_, 'manifest-sha256'),
    phaseId: requiredArgument(arguments_, 'phase'),
    predictionAggregateSha256: requiredArgument(arguments_, 'aggregate-sha256'),
    predictionAttemptProvenanceStatus: requiredArgument(
      arguments_,
      'prediction-attempt-provenance-status',
    ) as RunUltraFrozenEvaluationOptions['predictionAttemptProvenanceStatus'],
    comparePhaseIds: commaSeparated(
      stringArgument(arguments_, 'compare-phases'),
      '--compare-phases',
    ),
    selectionAudits: selectionAuditPaths.map((path, index) => ({
      path,
      sha256: selectionAuditHashes[index] as string,
    })),
    screeningPolicyRecord: {
      path: requiredArgument(arguments_, 'policy-record'),
      version: requiredArgument(arguments_, 'policy-version'),
      sha256: requiredArgument(arguments_, 'policy-sha256'),
    },
    workerPromptTemplateRecord: {
      path: requiredArgument(arguments_, 'prompt-record'),
      version: requiredArgument(arguments_, 'prompt-version'),
      sha256: requiredArgument(arguments_, 'prompt-sha256'),
    },
    repositoryCommit: requiredArgument(arguments_, 'repository-commit'),
  }
}

async function main() {
  const options = parseUltraFrozenEvaluationCliArguments(process.argv.slice(2))
  if (!options) {
    console.log(HELP)
    return
  }
  const result = await runUltraFrozenEvaluation(options)
  console.log(
    JSON.stringify(
      {
        evaluationId: result.report.evaluationId,
        evaluationSchemaVersion: result.report.evaluationSchemaVersion,
        predictionRunId: result.report.provenance.predictionRunId,
        predictionPhase: result.report.provenance.predictionPhase,
        articleCount: result.report.performance.metrics.articleCount,
        artifacts: result.artifacts,
        verifiedInputs: result.verifiedInputs,
      },
      null,
      2,
    ),
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
