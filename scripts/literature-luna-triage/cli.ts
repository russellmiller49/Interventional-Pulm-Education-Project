import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline'

import { deterministicPmidOrder } from '../../src/features/literature/ultra-screening/core'
import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import type { OverlayRelevance } from '../literature-reviewed-overlay/constants'
import { buildAuditSample } from './audit'
import {
  batchControlPlanSha256,
  batchFetchRequestSlots,
  batchStatusRequestSlots,
  batchSubmitPlanSha256,
  batchSubmitRequestSlots,
  fetchBatchFileContent,
  fetchBatchStatus,
  parseBatchOutputJsonl,
  planBatchShards,
  shardPlanSummary,
  submitBatchShard,
  DEFAULT_SHARD_CEILINGS,
} from './batch'
import {
  LUNA_CALIBRATION_COHORTS,
  LUNA_COHORTS,
  LUNA_DEFAULT_MODEL,
  LUNA_DEFAULT_REASONING_EFFORT,
  LUNA_PILOT_COHORT_SIZE,
  LUNA_PILOT_SEED,
  LUNA_REASONING_EFFORTS,
  LUNA_REVIEW_APP_DEFAULT_PORT,
  LUNA_SMOKE_COHORT_SIZE,
  LUNA_SMOKE_SEED,
  type LunaCohort,
  type LunaReasoningEffort,
} from './constants'
import {
  assertCorpusAuthority,
  collectCorpusInventory,
  corpusAbstractPresent,
  streamCorpus,
  yearBandOf,
  type CorpusRecord,
} from './corpus'
import { assertWithinCostCeiling, assertWithinRecordCeiling, estimateCohortCost } from './estimate'
import { buildEvaluationReport, type EvaluationReport } from './evaluation'
import { assertFreezeReceiptCurrent, buildFreezeReceipt, type FreezeReceipt } from './freeze'
import {
  mintSpendAuthorization,
  type AuthorizedRequestSlot,
  type LunaSpendAction,
  type SpendAuthorization,
} from './openai'
import {
  appendJsonlRows,
  createOperation,
  listRawResponseIds,
  loadOperationMetadata,
  operationPaths,
  readMapping,
  readPackets,
  readReviewDecisions,
  readRequests,
  readRiskFlags,
  readRoutedRecords,
  readTerminalStates,
  type OperationPaths,
} from './operation'
import { buildPacket, mintOperationSalt } from './packet'
import { loadStageAPrompt } from './prompt'
import {
  buildQualificationEvidence,
  buildQualificationReport,
  evaluationReportSha256,
  lockedSanityCohortIdentitySha256,
  type LockedRunMarker,
} from './qualify'
import { ingestStageAResponses, type RawResponseRecord } from './results'
import { startReviewServer } from './review-app'
import { buildRoutedRecords, buildRoutingManifest } from './routing'
import {
  executeSyncRun,
  prepareRequestSet,
  syncRunPlanSha256,
  syncRunRequestSlots,
  type PreparedRequest,
} from './runner'
import {
  apportionLockedSanity,
  buildCalibrationSplit,
  buildSplitManifest,
  sortedIdentityDigest,
} from './split'
import {
  appendJournalLine,
  createJournal,
  ensureStateDirectory,
  exclusiveWriteFile,
  openExclusiveJournalWriter,
  readJournalLines,
  readRegularFile,
  resolveInsideRoot,
  resolveStateRoot,
  type StateRoot,
} from './state'
import { loadTruthAuthority, type TruthAuthority } from './truth'

/**
 * The Luna triage CLI. Run from the repository root:
 *
 *   npx tsx scripts/literature-luna-triage/cli.ts <command> [flags]
 *
 * Coordinator discipline everywhere: stdout carries aggregates, digests, and paths — never a
 * PMID, never a record title, never credentials. No command accepts a record identity as an
 * argument. Network exists only behind `--confirm-api-spend` plus an interactively typed
 * confirmation phrase, and this session's commands never call it.
 */

class CliUsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CliUsageError'
  }
}

function flagValue(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`)
  if (index < 0) return undefined
  const value = argv[index + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new CliUsageError(`--${name} requires a value.`)
  }
  return value
}

function flagPresent(argv: readonly string[], name: string): boolean {
  return argv.includes(`--${name}`)
}

function requireFlag(argv: readonly string[], name: string): string {
  const value = flagValue(argv, name)
  if (value === undefined) throw new CliUsageError(`--${name} is required.`)
  return value
}

function numberFlag(argv: readonly string[], name: string): number | undefined {
  const value = flagValue(argv, name)
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new CliUsageError(`--${name} must be a number.`)
  return parsed
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function nowIso(): string {
  return new Date().toISOString()
}

function parseCohort(value: string): LunaCohort {
  if (!(LUNA_COHORTS as readonly string[]).includes(value)) {
    throw new CliUsageError(`--cohort must be one of: ${LUNA_COHORTS.join(', ')}.`)
  }
  return value as LunaCohort
}

function parseReasoning(value: string | undefined): LunaReasoningEffort {
  if (value === undefined) return LUNA_DEFAULT_REASONING_EFFORT
  if (!(LUNA_REASONING_EFFORTS as readonly string[]).includes(value)) {
    throw new CliUsageError(`--reasoning must be one of: ${LUNA_REASONING_EFFORTS.join(', ')}.`)
  }
  return value as LunaReasoningEffort
}

async function stateFromArgv(argv: readonly string[]): Promise<StateRoot> {
  return resolveStateRoot(flagValue(argv, 'state-dir'))
}

/** Corpus identity pinning: first run records, later runs must match. */
async function recordOrVerifyCorpusIdentity(
  state: StateRoot,
  identitySha256: string,
): Promise<'recorded' | 'verified'> {
  const path = resolveInsideRoot(state, 'corpus-identity.json')
  try {
    const existing = JSON.parse(await readRegularFile(path)) as { identitySha256?: string }
    if (existing.identitySha256 !== identitySha256) {
      throw new Error(
        'Corpus identity drift: the ordered-PMID digest differs from the digest recorded in ' +
          'this state directory. Stopping.',
      )
    }
    return 'verified'
  } catch (error) {
    if (error instanceof Error && error.message.includes('drift')) throw error
    await exclusiveWriteFile(path, `${canonicalJson({ identitySha256, recordedAt: nowIso() })}\n`)
    return 'recorded'
  }
}

interface SplitArtifactFiles {
  readonly development: readonly string[]
  readonly lockedSanity: readonly string[]
  readonly manifest: Record<string, unknown>
}

async function readSplitArtifacts(state: StateRoot): Promise<SplitArtifactFiles> {
  const developmentPath = resolveInsideRoot(state, 'split', 'development-pmids.json')
  const sanityPath = resolveInsideRoot(state, 'split', 'locked-sanity-pmids.json')
  const manifestPath = resolveInsideRoot(state, 'split', 'split-manifest.json')
  const development = JSON.parse(await readRegularFile(developmentPath)) as string[]
  const lockedSanity = JSON.parse(await readRegularFile(sanityPath)) as string[]
  const manifest = JSON.parse(await readRegularFile(manifestPath)) as Record<string, unknown>
  return { development, lockedSanity, manifest }
}

async function collectTruthPresence(
  truth: TruthAuthority,
): Promise<{ presence: Map<string, boolean>; corpusIdentity: string }> {
  const wanted = new Set(truth.rows.map((row) => row.pmid))
  const presence = new Map<string, boolean>()
  const result = await streamCorpus((record) => {
    if (wanted.has(record.pmid)) {
      presence.set(record.pmid, corpusAbstractPresent(record.abstract))
    }
  })
  assertCorpusAuthority(result)
  if (presence.size !== wanted.size) {
    throw new Error(
      `Only ${presence.size} of ${wanted.size} reviewed records were found in the corpus; ` +
        'the truth and corpus authorities disagree. Stopping.',
    )
  }
  return { presence, corpusIdentity: result.identitySha256 }
}

async function runInventory(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const inventory = await collectCorpusInventory()
  const identityStatus = await recordOrVerifyCorpusIdentity(state, inventory.identitySha256)
  await ensureStateDirectory(state, 'inventory')
  const reportPath = resolveInsideRoot(
    state,
    'inventory',
    `corpus-inventory-${nowIso().replace(/[:.]/gu, '-')}.json`,
  )
  await exclusiveWriteFile(reportPath, `${canonicalJson(inventory)}\n`)
  print({
    command: 'inventory',
    identityStatus,
    reportPath,
    total: inventory.total,
    withAbstract: inventory.withAbstract,
    withoutAbstract: inventory.withoutAbstract,
    byYearBand: inventory.byYearBand,
    identitySha256: inventory.identitySha256,
  })
}

async function runSplit(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const artifactPath = requireFlag(argv, 'artifact')
  const truth = loadTruthAuthority(artifactPath)
  const { presence, corpusIdentity } = await collectTruthPresence(truth)
  await recordOrVerifyCorpusIdentity(state, corpusIdentity)
  const split = buildCalibrationSplit(truth, presence)
  const manifest = buildSplitManifest(split)
  await ensureStateDirectory(state, 'split')
  await exclusiveWriteFile(
    resolveInsideRoot(state, 'split', 'development-pmids.json'),
    `${canonicalJson(split.developmentPmids)}\n`,
  )
  await exclusiveWriteFile(
    resolveInsideRoot(state, 'split', 'locked-sanity-pmids.json'),
    `${canonicalJson(split.lockedSanityPmids)}\n`,
  )
  await exclusiveWriteFile(
    resolveInsideRoot(state, 'split', 'split-manifest.json'),
    `${canonicalJson(manifest)}\n`,
  )
  print({ command: 'split', manifest })
}

/** Proportional largest-remainder selection over strata, hash-ranked inside each stratum. */
function stratifiedSelection(
  groups: ReadonlyMap<string, readonly string[]>,
  total: number,
  seed: string,
): string[] {
  const keys = [...groups.keys()].sort()
  const sizes = keys.map((key) => groups.get(key)?.length ?? 0)
  const quotas = apportionLockedSanity(sizes, total)
  const selected: string[] = []
  keys.forEach((key, index) => {
    const ordered = deterministicPmidOrder([...(groups.get(key) ?? [])], `${seed}:${key}`)
    selected.push(...ordered.slice(0, quotas[index]))
  })
  return selected.sort()
}

async function runPackets(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const cohort = parseCohort(requireFlag(argv, 'cohort'))
  const operationId = requireFlag(argv, 'operation')
  const artifactPath = flagValue(argv, 'artifact')

  let selection: Set<string> | null = null
  if (LUNA_CALIBRATION_COHORTS.includes(cohort)) {
    const split = await readSplitArtifacts(state)
    if (cohort === 'development-430') {
      selection = new Set(split.development)
    } else if (cohort === 'locked-sanity-200') {
      selection = new Set(split.lockedSanity)
    } else {
      // Smoke: stratified by evidence profile inside the development cohort. Presence is
      // resolved from the corpus during the stream below, so selection happens afterward.
      selection = null
    }
  } else if (cohort === 'pilot-1000') {
    if (!artifactPath) {
      throw new CliUsageError(
        '--artifact is required for pilot-1000: the pilot excludes the 630 reviewed records.',
      )
    }
  }

  const excluded =
    cohort === 'pilot-1000' && artifactPath
      ? new Set(loadTruthAuthority(artifactPath).rows.map((row) => row.pmid))
      : new Set<string>()

  const paths = await createOperation(state, operationId, cohort, `packets:${cohort}`, nowIso())
  const salt = mintOperationSalt()
  await exclusiveWriteFile(paths.saltJson, `${canonicalJson(salt)}\n`)

  // For smoke and pilot the member set is derived from a first pass; for the others it is
  // known up front. Either way, packets are built in one corpus stream and written as
  // encountered, so full-corpus packet builds never hold the corpus in memory.
  let members: Set<string>
  if (cohort === 'smoke-30') {
    const split = await readSplitArtifacts(state)
    const development = new Set(split.development)
    const groups = new Map<string, string[]>([
      ['with_abstract', []],
      ['without_abstract', []],
    ])
    const scan = await streamCorpus((record) => {
      if (!development.has(record.pmid)) return
      const key = corpusAbstractPresent(record.abstract) ? 'with_abstract' : 'without_abstract'
      groups.get(key)?.push(record.pmid)
    })
    assertCorpusAuthority(scan)
    members = new Set(stratifiedSelection(groups, LUNA_SMOKE_COHORT_SIZE, LUNA_SMOKE_SEED))
  } else if (cohort === 'pilot-1000') {
    const groups = new Map<string, string[]>()
    const scan = await streamCorpus((record) => {
      if (excluded.has(record.pmid)) return
      const profile = corpusAbstractPresent(record.abstract) ? 'with_abstract' : 'without_abstract'
      const key = `${profile}|${yearBandOf(record.publicationYear)}`
      const bucket = groups.get(key) ?? []
      bucket.push(record.pmid)
      groups.set(key, bucket)
    })
    assertCorpusAuthority(scan)
    members = new Set(stratifiedSelection(groups, LUNA_PILOT_COHORT_SIZE, LUNA_PILOT_SEED))
  } else if (cohort === 'full-corpus') {
    members = new Set()
  } else {
    members = selection ?? new Set()
  }

  const packetWriter = await openExclusiveJournalWriter(paths.packetsJsonl)
  const mappingWriter = await openExclusiveJournalWriter(paths.mappingJsonl)
  const riskWriter = await openExclusiveJournalWriter(paths.riskFlagsJsonl)
  let built = 0
  let withAbstract = 0
  let riskFlagged = 0
  const packetHashes: string[] = []
  const buildFor = (record: CorpusRecord): boolean =>
    cohort === 'full-corpus' ? true : members.has(record.pmid)
  const result = await streamCorpus(async (record) => {
    if (!buildFor(record)) return
    const item = buildPacket(salt, record)
    await packetWriter.writeLine(canonicalJson(item.packet))
    await mappingWriter.writeLine(canonicalJson(item.mapping))
    await riskWriter.writeLine(
      canonicalJson({ recordId: item.mapping.recordId, riskFlags: item.riskFlags }),
    )
    built += 1
    if (item.packet.evidence_profile === 'metadata_with_abstract') withAbstract += 1
    if (item.riskFlags.length > 0) riskFlagged += 1
    packetHashes.push(sha256(canonicalJson(item.packet)))
  })
  await packetWriter.close()
  await mappingWriter.close()
  await riskWriter.close()
  assertCorpusAuthority(result)
  await recordOrVerifyCorpusIdentity(state, result.identitySha256)

  const expected =
    cohort === 'full-corpus'
      ? result.count
      : cohort === 'smoke-30'
        ? LUNA_SMOKE_COHORT_SIZE
        : cohort === 'pilot-1000'
          ? LUNA_PILOT_COHORT_SIZE
          : members.size
  if (built !== expected) {
    throw new Error(
      `Packet build accounting failed: built ${built}, expected ${expected}. Stopping.`,
    )
  }
  const manifest = {
    operationId,
    cohort,
    builtRecords: built,
    withAbstract,
    withoutAbstract: built - withAbstract,
    riskFlaggedRecords: riskFlagged,
    packetSetSha256: sha256(canonicalJson(packetHashes.sort())),
    corpusIdentitySha256: result.identitySha256,
    createdAt: nowIso(),
  }
  await exclusiveWriteFile(paths.packetManifestJson, `${canonicalJson(manifest)}\n`)
  print({ command: 'packets', manifest })
}

interface RequestPreparation {
  readonly paths: OperationPaths
  readonly requests: readonly PreparedRequest[]
  readonly manifest: Record<string, unknown>
}

async function prepareRequestsForOperation(
  state: StateRoot,
  argv: readonly string[],
  persist: boolean,
): Promise<RequestPreparation> {
  const operationId = requireFlag(argv, 'operation')
  const paths = operationPaths(state, operationId)
  const packets = await readPackets(paths)
  const prompt = loadStageAPrompt()
  const model = flagValue(argv, 'model') ?? LUNA_DEFAULT_MODEL
  const reasoningEffort = parseReasoning(flagValue(argv, 'reasoning'))
  const prepared = prepareRequestSet(packets, {
    model,
    reasoningEffort,
    instructions: prompt.text,
    promptSha256: prompt.sha256,
  })
  const manifest: Record<string, unknown> = { ...prepared.manifest }
  if (persist) {
    await appendJsonlRows(
      paths.requestsJsonl,
      prepared.requests.map((request) => ({
        customId: request.customId,
        bodySha256: request.bodySha256,
        body: request.body,
      })),
    )
    await exclusiveWriteFile(paths.requestManifestJson, `${canonicalJson(manifest)}\n`)
  }
  return { paths, requests: prepared.requests, manifest }
}

async function runEstimate(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const preparation = await prepareRequestsForOperation(state, argv, false)
  const estimate = estimateCohortCost(
    preparation.requests.map((request) => request.estimate),
    { batch: flagPresent(argv, 'batch') },
  )
  print({ command: 'estimate', manifest: preparation.manifest, estimate })
}

async function runPrepareRequests(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const preparation = await prepareRequestsForOperation(state, argv, true)
  print({ command: 'prepare-requests', manifest: preparation.manifest })
}

async function confirmSpendPhrase(requiredPhrase: string): Promise<string | null> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return null
  }
  process.stdout.write(
    'API spend requires interactive owner confirmation.\n' + `Type exactly: ${requiredPhrase}\n> `,
  )
  const lines = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  const answer = await new Promise<string>((resolvePromise) => {
    lines.once('line', (line) => resolvePromise(line))
  })
  lines.close()
  return answer.trim()
}

interface SpendRequestSpec {
  readonly action: LunaSpendAction
  readonly operationId: string
  readonly cohort: string
  readonly recordCount: number
  /** Prepared requests used only to price the spend; empty for control-plane actions. */
  readonly estimateRecords: readonly PreparedRequest[]
  readonly batch: boolean
  /** The exact plan this spend is authorized against. */
  readonly planSha256: string
  /** The exact, bounded set of network requests this spend may perform. */
  readonly requests: readonly AuthorizedRequestSlot[]
}

async function mintAuthorizationFromArgv(
  argv: readonly string[],
  spec: SpendRequestSpec,
): Promise<{ authorization: SpendAuthorization; estimatedCostUsd: number }> {
  const maxRecords = numberFlag(argv, 'max-records')
  const maxEstimatedCostUsd = numberFlag(argv, 'max-estimated-cost-usd')
  if (maxRecords === undefined) throw new CliUsageError('--max-records is required.')
  if (maxEstimatedCostUsd === undefined) {
    throw new CliUsageError('--max-estimated-cost-usd is required.')
  }
  assertWithinRecordCeiling(spec.recordCount, maxRecords)
  const estimate = estimateCohortCost(
    spec.estimateRecords.map((request) => request.estimate),
    { batch: spec.batch },
  )
  assertWithinCostCeiling(estimate, maxEstimatedCostUsd)
  const requiredPhrase = `SPEND ${spec.operationId}`
  const interactivePhrase = flagPresent(argv, 'confirm-api-spend')
    ? await confirmSpendPhrase(requiredPhrase)
    : null
  const authorization = mintSpendAuthorization({
    confirmFlagPresent: flagPresent(argv, 'confirm-api-spend'),
    interactivePhrase,
    requiredPhrase,
    envelope: {
      action: spec.action,
      operationId: spec.operationId,
      cohort: spec.cohort,
      planSha256: spec.planSha256,
      recordCount: spec.recordCount,
      estimatedInputTokens: estimate.inputTokens,
      estimatedOutputTokenAllowance: estimate.outputTokenAllowance,
      estimatedTotalTokens: estimate.totalTokenAllowance,
      estimatedCostUsd: estimate.estimatedCostUsd,
      maxRecords,
      maxEstimatedCostUsd,
      requests: spec.requests,
      maxNetworkRequests: spec.requests.reduce(
        (sum, slot) => sum + (slot.kind === 'derived' ? slot.maxUses : 1),
        0,
      ),
    },
    estimate,
  })
  return { authorization, estimatedCostUsd: estimate.estimatedCostUsd }
}

async function runSync(argv: readonly string[], lockedCalibration?: string): Promise<void> {
  const state = await stateFromArgv(argv)
  const operationId = requireFlag(argv, 'operation')
  const paths = operationPaths(state, operationId)
  const metadata = await loadOperationMetadata(paths)

  if (lockedCalibration !== undefined) {
    if (metadata.cohort !== 'locked-sanity-200') {
      throw new CliUsageError('run-locked only runs operations over the locked-sanity-200 cohort.')
    }
    const receiptPath = resolveInsideRoot(state, 'freeze', `${lockedCalibration}.receipt.json`)
    const receipt = JSON.parse(await readRegularFile(receiptPath)) as FreezeReceipt
    const prompt = loadStageAPrompt()
    const split = await readSplitArtifacts(state)
    assertFreezeReceiptCurrent(receipt, {
      calibrationVersion: receipt.calibrationVersion,
      model: flagValue(argv, 'model') ?? receipt.model,
      modelAlias: receipt.modelAlias,
      reasoningEffort: parseReasoning(flagValue(argv, 'reasoning') ?? receipt.reasoningEffort),
      promptText: prompt.text,
      splitManifestSha256: (split.manifest as { manifestSha256?: string }).manifestSha256 ?? '',
    })
    await ensureStateDirectory(state, 'freeze', 'locked-runs')
    // Create-once: a second locked run of the same calibration version refuses here, and a
    // failed run still consumes the version — tuning against its outputs is a new version.
    await exclusiveWriteFile(
      resolveInsideRoot(state, 'freeze', 'locked-runs', `${lockedCalibration}.marker.json`),
      `${canonicalJson({ calibrationVersion: lockedCalibration, operationId, startedAt: nowIso() })}\n`,
    )
  }

  const stored = await readRequests(paths)
  const limit = numberFlag(argv, 'limit')
  const selected = stored.slice(0, limit === undefined ? stored.length : limit)
  const prompt = loadStageAPrompt()
  const model = flagValue(argv, 'model') ?? LUNA_DEFAULT_MODEL
  const reasoningEffort = parseReasoning(flagValue(argv, 'reasoning'))
  const packets = await readPackets(paths)
  const packetById = new Map(packets.map((packet) => [packet.record_id, packet]))
  const requests: PreparedRequest[] = selected.map((row) => {
    const packet = packetById.get(row.customId)
    if (!packet) throw new Error('A stored request has no packet; artifacts disagree.')
    const rebuilt = prepareRequestSet([packet], {
      model,
      reasoningEffort,
      instructions: prompt.text,
      promptSha256: prompt.sha256,
    }).requests[0]
    if (rebuilt.bodySha256 !== row.bodySha256) {
      throw new Error(
        'A stored request no longer matches its recomputation; the prepared surface drifted. ' +
          'Re-run prepare-requests in a fresh operation.',
      )
    }
    return rebuilt
  })

  const { authorization, estimatedCostUsd } = await mintAuthorizationFromArgv(argv, {
    action: 'run-sync',
    operationId,
    cohort: metadata.cohort,
    recordCount: requests.length,
    estimateRecords: requests,
    batch: false,
    planSha256: syncRunPlanSha256(requests),
    requests: syncRunRequestSlots(requests),
  })
  await createJournal(paths.ledgerJsonl).catch(() => undefined)
  const summary = await executeSyncRun({
    requests,
    operationId,
    authorization,
    sinks: {
      writeRawResponse: async (customId, bodyText) => {
        await exclusiveWriteFile(join(paths.rawResponsesDir, `${customId}.json`), bodyText)
      },
      appendLedger: async (row) => {
        await appendJournalLine(paths.ledgerJsonl, canonicalJson(row))
      },
      now: nowIso,
    },
  })
  print({ command: lockedCalibration ? 'run-locked' : 'run-sync', summary, estimatedCostUsd })
}

async function runFreeze(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const calibrationVersion = requireFlag(argv, 'calibration-version')
  const prompt = loadStageAPrompt()
  const split = await readSplitArtifacts(state)
  const receipt = buildFreezeReceipt(
    {
      calibrationVersion,
      model: flagValue(argv, 'model') ?? LUNA_DEFAULT_MODEL,
      modelAlias: flagValue(argv, 'model-alias') ?? null,
      reasoningEffort: parseReasoning(flagValue(argv, 'reasoning')),
      promptText: prompt.text,
      splitManifestSha256: (split.manifest as { manifestSha256?: string }).manifestSha256 ?? '',
    },
    nowIso(),
  )
  await ensureStateDirectory(state, 'freeze')
  await exclusiveWriteFile(
    resolveInsideRoot(state, 'freeze', `${calibrationVersion}.receipt.json`),
    `${canonicalJson(receipt)}\n`,
  )
  print({ command: 'freeze', receipt })
}

async function runBatchPrepare(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const operationId = requireFlag(argv, 'operation')
  const paths = operationPaths(state, operationId)
  const stored = await readRequests(paths)
  const maxRecords = numberFlag(argv, 'max-records')
  if (maxRecords !== undefined) {
    assertWithinRecordCeiling(stored.length, maxRecords)
  }
  const requestsById = new Map(stored.map((row) => [row.customId, row]))
  const prompt = loadStageAPrompt()
  const model = flagValue(argv, 'model') ?? LUNA_DEFAULT_MODEL
  const reasoningEffort = parseReasoning(flagValue(argv, 'reasoning'))
  const packets = await readPackets(paths)
  const estimates = new Map(
    prepareRequestSet(packets, {
      model,
      reasoningEffort,
      instructions: prompt.text,
      promptSha256: prompt.sha256,
    }).requests.map((request) => [request.customId, request.estimate]),
  )
  const ceilings = {
    maxRecordsPerShard:
      numberFlag(argv, 'max-records-per-shard') ?? DEFAULT_SHARD_CEILINGS.maxRecordsPerShard,
    maxEstimatedTokensPerShard:
      numberFlag(argv, 'max-estimated-tokens-per-shard') ??
      DEFAULT_SHARD_CEILINGS.maxEstimatedTokensPerShard,
  }
  const plan = planBatchShards(
    [...requestsById.values()].map((row) => ({ customId: row.customId, body: row.body })),
    estimates,
    ceilings,
  )
  for (const shard of plan.shards) {
    await exclusiveWriteFile(join(paths.batchShardsDir, shard.filename), shard.content)
  }
  const summary = shardPlanSummary(plan)
  const estimate = estimateCohortCost([...estimates.values()], { batch: true })
  await exclusiveWriteFile(
    join(paths.batchShardsDir, 'shard-plan.json'),
    `${canonicalJson({ ...summary, estimate })}\n`,
  )
  print({ command: 'batch-prepare', summary, estimate })
}

async function runBatchSubmit(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const operationId = requireFlag(argv, 'operation')
  const shardFilename = requireFlag(argv, 'shard')
  const paths = operationPaths(state, operationId)
  const metadata = await loadOperationMetadata(paths)
  const content = await readRegularFile(join(paths.batchShardsDir, shardFilename))
  const contentSha256 = sha256(content)
  const plan = JSON.parse(await readRegularFile(join(paths.batchShardsDir, 'shard-plan.json'))) as {
    shards?: readonly { filename?: string; contentSha256?: string }[]
  }
  const plannedShard = (plan.shards ?? []).find((shard) => shard.filename === shardFilename)
  if (!plannedShard || plannedShard.contentSha256 !== contentSha256) {
    throw new Error('The shard bytes do not match the prepared shard plan; refusing to submit.')
  }
  const recordCount = content.split('\n').filter((line) => line.trim().length > 0).length
  const shardIds = new Set(
    content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => (JSON.parse(line) as { custom_id: string }).custom_id),
  )
  const prompt = loadStageAPrompt()
  const model = flagValue(argv, 'model') ?? LUNA_DEFAULT_MODEL
  const reasoningEffort = parseReasoning(flagValue(argv, 'reasoning'))
  const packets = await readPackets(paths)
  const prepared = prepareRequestSet(
    packets.filter((packet) => shardIds.has(packet.record_id)),
    { model, reasoningEffort, instructions: prompt.text, promptSha256: prompt.sha256 },
  )
  if (prepared.requests.length !== recordCount) {
    throw new Error('The shard does not match the prepared request set; refusing to submit.')
  }
  const shard = {
    index: 0,
    filename: shardFilename,
    contentSha256,
    recordCount,
    estimatedInputTokens: prepared.manifest.totalEstimatedInputTokens,
    estimatedOutputTokenAllowance: prepared.manifest.totalEstimatedOutputTokenAllowance,
    content,
  }
  const { authorization } = await mintAuthorizationFromArgv(argv, {
    action: 'batch-submit',
    operationId,
    cohort: metadata.cohort,
    recordCount,
    estimateRecords: prepared.requests,
    batch: true,
    planSha256: batchSubmitPlanSha256(shard),
    requests: batchSubmitRequestSlots(contentSha256),
  })
  const receipt = await submitBatchShard({
    shard,
    operationId,
    authorization,
    submittedAt: nowIso(),
  })
  await exclusiveWriteFile(
    join(paths.batchReceiptsDir, `${receipt.batchId}.json`),
    `${canonicalJson(receipt)}\n`,
  )
  print({ command: 'batch-submit', receipt })
}

async function runBatchStatus(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const operationId = requireFlag(argv, 'operation')
  const batchId = requireFlag(argv, 'batch-id')
  const paths = operationPaths(state, operationId)
  const metadata = await loadOperationMetadata(paths)
  const { authorization } = await mintAuthorizationFromArgv(argv, {
    action: 'batch-status',
    operationId,
    cohort: metadata.cohort,
    recordCount: 0,
    estimateRecords: [],
    batch: true,
    planSha256: batchControlPlanSha256(batchId),
    requests: batchStatusRequestSlots(batchId),
  })
  const status = await fetchBatchStatus({
    batchId,
    operationId,
    action: 'batch-status',
    authorization,
  })
  print({
    command: 'batch-status',
    batchId: status.batchId,
    status: status.status,
    outputFileId: status.outputFileId,
    errorFileId: status.errorFileId,
    requestCounts: status.requestCounts,
  })
}

async function runBatchFetch(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const operationId = requireFlag(argv, 'operation')
  const batchId = requireFlag(argv, 'batch-id')
  const paths = operationPaths(state, operationId)
  const metadata = await loadOperationMetadata(paths)
  const { authorization } = await mintAuthorizationFromArgv(argv, {
    action: 'batch-fetch',
    operationId,
    cohort: metadata.cohort,
    recordCount: 0,
    estimateRecords: [],
    batch: true,
    planSha256: batchControlPlanSha256(batchId),
    requests: batchFetchRequestSlots(batchId),
  })
  const status = await fetchBatchStatus({
    batchId,
    operationId,
    action: 'batch-fetch',
    authorization,
  })
  const fetched: string[] = []
  for (const [label, fileId] of [
    ['output', status.outputFileId],
    ['error', status.errorFileId],
  ] as const) {
    if (!fileId) continue
    const content = await fetchBatchFileContent({ fileId, batchId, operationId, authorization })
    const path = join(paths.batchRawDir, `${batchId}-${label}.jsonl`)
    await exclusiveWriteFile(path, content.bodyText)
    fetched.push(path)
  }
  print({ command: 'batch-fetch', batchId, status: status.status, fetched })
}

async function collectRawResponses(
  paths: OperationPaths,
  source: string,
): Promise<RawResponseRecord[]> {
  const responses: RawResponseRecord[] = []
  if (source === 'sync' || source === 'all') {
    for (const customId of await listRawResponseIds(paths)) {
      responses.push({
        customId,
        bodyText: await readRegularFile(join(paths.rawResponsesDir, `${customId}.json`)),
      })
    }
  }
  if (source === 'batch' || source === 'all') {
    let entries: string[] = []
    try {
      entries = (await readdir(paths.batchRawDir)).filter((entry) => entry.endsWith('.jsonl'))
    } catch {
      entries = []
    }
    for (const entry of entries.sort()) {
      const content = await readRegularFile(join(paths.batchRawDir, entry))
      responses.push(...parseBatchOutputJsonl(content))
    }
  }
  return responses
}

async function runIngest(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const operationId = requireFlag(argv, 'operation')
  const source = flagValue(argv, 'source') ?? 'all'
  if (!['sync', 'batch', 'all'].includes(source)) {
    throw new CliUsageError('--source must be sync, batch, or all.')
  }
  const paths = operationPaths(state, operationId)
  const mapping = await readMapping(paths)
  const selectedRecordIds = mapping.map((row) => row.recordId)
  let attemptedRecordIds: string[]
  try {
    const requests = await readRequests(paths)
    const ledger = await readJournalLines(paths.ledgerJsonl).catch(() => [] as unknown[])
    const ledgerIds = new Set(
      ledger
        .map((row) => (row as { customId?: string }).customId)
        .filter((value): value is string => typeof value === 'string'),
    )
    const batchAttempted = new Set<string>()
    try {
      const receipts = await readdir(paths.batchReceiptsDir)
      if (receipts.some((entry) => entry.endsWith('.json'))) {
        // A submitted batch attempts every request in the submitted shards; the shard files
        // are authoritative for which custom ids were sent.
        const shards = await readdir(paths.batchShardsDir)
        for (const shard of shards.filter((entry) => entry.endsWith('.jsonl'))) {
          const content = await readRegularFile(join(paths.batchShardsDir, shard))
          for (const line of content.split('\n')) {
            if (line.trim().length === 0) continue
            const parsed = JSON.parse(line) as { custom_id?: string }
            if (typeof parsed.custom_id === 'string') batchAttempted.add(parsed.custom_id)
          }
        }
      }
    } catch {
      // No batch artifacts: sync-only operation.
    }
    attemptedRecordIds = requests
      .map((row) => row.customId)
      .filter((customId) => ledgerIds.has(customId) || batchAttempted.has(customId))
  } catch {
    attemptedRecordIds = []
  }
  const responses = await collectRawResponses(paths, source)
  const ingestion = ingestStageAResponses({
    selectedRecordIds,
    attemptedRecordIds,
    responses,
  })
  for (const entry of ingestion.quarantine) {
    const path = join(paths.quarantineDir, `${entry.rawSha256}.json`)
    try {
      await exclusiveWriteFile(path, `${canonicalJson(entry)}\n`)
    } catch {
      // Content-addressed: an existing identical quarantine artifact is not an error.
    }
  }
  await appendJsonlRows(paths.terminalStatesJsonl, ingestion.assignments)
  const stateCounts: Record<string, number> = {}
  for (const assignment of ingestion.assignments) {
    stateCounts[assignment.state] = (stateCounts[assignment.state] ?? 0) + 1
  }
  const report = {
    operationId,
    source,
    selected: selectedRecordIds.length,
    attempted: attemptedRecordIds.length,
    stateCounts,
    quarantined: ingestion.quarantine.length,
    unknownIdentityResponses: ingestion.unknownIdentityCount,
    createdAt: nowIso(),
  }
  await exclusiveWriteFile(paths.ingestionReportJson, `${canonicalJson(report)}\n`)
  print({ command: 'ingest', report })
}

async function runRoute(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const operationId = requireFlag(argv, 'operation')
  const paths = operationPaths(state, operationId)
  const assignments = await readTerminalStates(paths)
  const packets = await readPackets(paths)
  const riskFlags = await readRiskFlags(paths)
  const routed = buildRoutedRecords({
    assignments,
    evidenceProfiles: new Map(packets.map((packet) => [packet.record_id, packet.evidence_profile])),
    // The raw rows, not a map: exact one-to-one coverage is asserted inside, and a map would
    // have already collapsed a duplicate risk result before anyone could notice it.
    riskAnalysisResults: riskFlags,
  })
  const manifest = buildRoutingManifest(routed)
  await appendJsonlRows(paths.routedRecordsJsonl, routed)
  await exclusiveWriteFile(paths.routingManifestJson, `${canonicalJson(manifest)}\n`)
  const stageBRows = routed
    .filter((record) => record.route === 'advance_to_full_relevance_classification')
    .map((record) => ({
      recordId: record.recordId,
      evidenceProfile: record.evidenceProfile,
      terminalState: record.terminalState,
      riskFlagCount: record.riskFlags.length,
    }))
  await appendJsonlRows(paths.stageBQueueJsonl, stageBRows)
  print({ command: 'route', manifest })
}

async function truthByRecordId(
  paths: OperationPaths,
  artifactPath: string | undefined,
  cohort: LunaCohort,
): Promise<Map<string, OverlayRelevance>> {
  if (!LUNA_CALIBRATION_COHORTS.includes(cohort)) {
    return new Map()
  }
  if (!artifactPath) {
    throw new CliUsageError('--artifact is required to evaluate a calibration cohort.')
  }
  const truth = loadTruthAuthority(artifactPath)
  const byPmid = new Map(truth.rows.map((row) => [row.pmid, row.relevance]))
  const mapping = await readMapping(paths)
  const result = new Map<string, OverlayRelevance>()
  for (const row of mapping) {
    const relevance = byPmid.get(row.pmid)
    if (!relevance) {
      throw new Error('A calibration-cohort record is missing from the physician truth; stopping.')
    }
    result.set(row.recordId, relevance)
  }
  return result
}

async function runEvaluate(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const operationId = requireFlag(argv, 'operation')
  const paths = operationPaths(state, operationId)
  const metadata = await loadOperationMetadata(paths)
  const assignments = await readTerminalStates(paths)
  const routed = await readRoutedRecords(paths)
  const truth = await truthByRecordId(paths, flagValue(argv, 'artifact'), metadata.cohort)
  const report = buildEvaluationReport({
    cohortLabel: metadata.cohort,
    routed,
    assignments,
    truthByRecordId: truth,
  })
  await exclusiveWriteFile(paths.evaluationReportJson, `${canonicalJson(report)}\n`)
  // Create-once receipt: the digest recorded here is what qualification re-derives from the
  // stored report, so an artifact edited after the run cannot pass the gate.
  const receipt = {
    operationId,
    cohort: metadata.cohort,
    evaluationVersion: report.version,
    selected: report.denominators.selected,
    evaluationReportSha256: evaluationReportSha256(report),
    createdAt: nowIso(),
  }
  await exclusiveWriteFile(paths.evaluationReceiptJson, `${canonicalJson(receipt)}\n`)
  print({ command: 'evaluate', report, receipt })
}

async function runReviewQueue(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const operationId = requireFlag(argv, 'operation')
  const paths = operationPaths(state, operationId)
  const routed = await readRoutedRecords(paths)
  const assignments = await readTerminalStates(paths)
  const outputById = new Map(assignments.map((row) => [row.recordId, row.output]))
  const negatives = routed.filter((record) => {
    const output = outputById.get(record.recordId)
    return (
      output !== null && output !== undefined && output.triage_decision === 'obvious_irrelevant'
    )
  })
  const bucket = negatives.filter((record) => {
    const output = outputById.get(record.recordId)
    return output?.confidence_band === 'high'
  })
  const queue = {
    operationId,
    generatedAt: nowIso(),
    negativeQueueRecordIds: negatives.map((record) => record.recordId).sort(),
    highConfidenceNegativeRecordIds: bucket.map((record) => record.recordId).sort(),
    mandatoryReviewRecordIds: routed
      .filter((record) => record.mandatoryPhysicianReview)
      .map((record) => record.recordId)
      .sort(),
    deprioritizationCandidateRecordIds: routed
      .filter((record) => record.route === 'deprioritization_candidate')
      .map((record) => record.recordId)
      .sort(),
  }
  await exclusiveWriteFile(paths.reviewQueueJson, `${canonicalJson(queue)}\n`)
  print({
    command: 'review-queue',
    counts: {
      negativeQueue: queue.negativeQueueRecordIds.length,
      highConfidenceNegatives: queue.highConfidenceNegativeRecordIds.length,
      mandatoryReview: queue.mandatoryReviewRecordIds.length,
      deprioritizationCandidates: queue.deprioritizationCandidateRecordIds.length,
    },
  })
}

async function runQualify(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const operationId = requireFlag(argv, 'operation')
  const calibrationVersion = requireFlag(argv, 'calibration-version')
  const paths = operationPaths(state, operationId)
  const metadata = await loadOperationMetadata(paths)
  if (metadata.cohort !== 'locked-sanity-200') {
    throw new CliUsageError(
      'qualify runs only over the frozen locked-sanity-200 cohort. Nothing else may qualify.',
    )
  }
  const evaluation = JSON.parse(
    await readRegularFile(paths.evaluationReportJson),
  ) as EvaluationReport
  const evaluationReceipt = JSON.parse(await readRegularFile(paths.evaluationReceiptJson)) as {
    evaluationReportSha256?: string
  }
  if (typeof evaluationReceipt.evaluationReportSha256 !== 'string') {
    throw new Error('The evaluation receipt is malformed; refusing to qualify.')
  }

  // The frozen calibration surface must still name what would run today.
  const freezeReceipt = JSON.parse(
    await readRegularFile(resolveInsideRoot(state, 'freeze', `${calibrationVersion}.receipt.json`)),
  ) as FreezeReceipt
  const prompt = loadStageAPrompt()
  const split = await readSplitArtifacts(state)
  const splitManifestSha256 = (split.manifest as { manifestSha256?: string }).manifestSha256 ?? ''
  assertFreezeReceiptCurrent(freezeReceipt, {
    calibrationVersion: freezeReceipt.calibrationVersion,
    model: freezeReceipt.model,
    modelAlias: freezeReceipt.modelAlias,
    reasoningEffort: freezeReceipt.reasoningEffort,
    promptText: prompt.text,
    splitManifestSha256,
  })
  const lockedRunMarker = JSON.parse(
    await readRegularFile(
      resolveInsideRoot(state, 'freeze', 'locked-runs', `${calibrationVersion}.marker.json`),
    ),
  ) as LockedRunMarker

  // Exact set equality at the coordinator boundary: the identities actually evaluated against
  // the frozen locked-sanity list. Identities never leave this process.
  const routed = await readRoutedRecords(paths)
  const pmidByRecordId = new Map((await readMapping(paths)).map((row) => [row.recordId, row.pmid]))
  const cohortPmids = routed.map((record) => {
    const pmid = pmidByRecordId.get(record.recordId)
    if (pmid === undefined) {
      throw new Error('A routed record has no coordinator mapping row; refusing to qualify.')
    }
    return pmid
  })
  const splitLockedSanityIdentitySha256 = sortedIdentityDigest(split.lockedSanity)
  if (
    splitLockedSanityIdentitySha256 !==
    (split.manifest as { lockedSanityIdentitySha256?: string }).lockedSanityIdentitySha256
  ) {
    throw new Error('The stored locked-sanity identities disagree with the split manifest.')
  }
  const cohortIdentitySha256 = lockedSanityCohortIdentitySha256(cohortPmids)

  const decisions = await readReviewDecisions(paths)
  const systematicMissFlagCount = [...decisions.values()].filter(
    (decision) => decision.action === 'flag_systematic_miss',
  ).length
  let coverage = false
  try {
    const queue = JSON.parse(await readRegularFile(paths.reviewQueueJson)) as {
      highConfidenceNegativeRecordIds?: string[]
    }
    const assignments = await readTerminalStates(paths)
    const outputById = new Map(assignments.map((row) => [row.recordId, row.output]))
    const bucketIds = routed
      .filter((record) => {
        const output = outputById.get(record.recordId)
        return (
          output != null &&
          output.triage_decision === 'obvious_irrelevant' &&
          output.confidence_band === 'high'
        )
      })
      .map((record) => record.recordId)
    const queueIds = new Set(queue.highConfidenceNegativeRecordIds ?? [])
    coverage = bucketIds.every((recordId) => queueIds.has(recordId))
  } catch {
    coverage = false
  }

  const evidence = buildQualificationEvidence({
    calibrationVersion,
    operationId,
    cohortLabel: metadata.cohort,
    selectedCount: evaluation.denominators.selected,
    cohortIdentitySha256,
    splitLockedSanityIdentitySha256,
    splitManifestSha256,
    freezeReceipt,
    lockedRunMarker,
    evaluationReportSha256: evaluationReceipt.evaluationReportSha256,
  })

  // Once per freeze: a pristine locked run is spent by the qualification that reads it.
  await ensureStateDirectory(state, 'freeze', 'qualified')
  const qualifiedDir = resolveInsideRoot(state, 'freeze', 'qualified')
  let observedRunMarkerSha256s: string[] = []
  try {
    observedRunMarkerSha256s = (await readdir(qualifiedDir))
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => entry.slice(0, -'.json'.length))
  } catch {
    observedRunMarkerSha256s = []
  }

  const report = buildQualificationReport({
    evidence,
    evaluation,
    systematicMissFlagCount,
    reviewInterfaceCoversAllHighConfidenceNegatives: coverage,
    observedRunMarkerSha256s,
  })
  await exclusiveWriteFile(
    join(qualifiedDir, `${evidence.lockedRunMarkerSha256}.json`),
    `${canonicalJson({
      calibrationVersion,
      operationId,
      evidenceSha256: evidence.evidenceSha256,
      qualified: report.qualified,
      observedAt: nowIso(),
    })}\n`,
  )
  await exclusiveWriteFile(paths.qualificationReportJson, `${canonicalJson(report)}\n`)
  print({ command: 'qualify', report })
}

async function runAuditSample(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const operationId = requireFlag(argv, 'operation')
  const sampleSize = numberFlag(argv, 'sample-size')
  if (sampleSize === undefined) throw new CliUsageError('--sample-size is required.')
  const paths = operationPaths(state, operationId)
  const routed = await readRoutedRecords(paths)
  const packets = await readPackets(paths)
  const assignments = await readTerminalStates(paths)
  const packetById = new Map(packets.map((packet) => [packet.record_id, packet]))
  const outputById = new Map(assignments.map((row) => [row.recordId, row.output]))
  const candidates = routed.filter(
    (record) => record.route === 'deprioritization_candidate' && record.riskFlags.length === 0,
  )
  const sample = buildAuditSample({
    candidates,
    contexts: new Map(
      candidates.map((record) => {
        const packet = packetById.get(record.recordId)
        return [
          record.recordId,
          {
            journal: packet?.journal ?? null,
            publicationYear: packet?.publication_year ?? null,
            primaryPublicationType: packet?.publication_types[0] ?? null,
          },
        ]
      }),
    ),
    sampleSize,
    primaryReasonCodes: new Map(
      candidates.map((record) => [
        record.recordId,
        outputById.get(record.recordId)?.reason_codes[0] ?? '(none)',
      ]),
    ),
  })
  await exclusiveWriteFile(paths.auditSampleJson, `${canonicalJson(sample)}\n`)
  print({
    command: 'audit-sample',
    requestedSize: sample.requestedSize,
    poolSize: sample.poolSize,
    sampled: sample.entries.length,
    strata: Object.keys(sample.strataCounts).length,
  })
}

async function runReviewApp(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const operationId = requireFlag(argv, 'operation')
  const port = numberFlag(argv, 'port') ?? LUNA_REVIEW_APP_DEFAULT_PORT
  const server = await startReviewServer({ state, operationId, port, now: nowIso })
  print({
    command: 'review-app',
    url: `http://127.0.0.1:${port}/`,
    operationId,
    note: 'Loopback only. Press Ctrl+C to stop.',
  })
  await new Promise<void>((resolvePromise) => {
    const stop = () => {
      void server.close().finally(() => resolvePromise())
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  })
}

const COMMANDS: Record<string, (argv: readonly string[]) => Promise<void>> = {
  inventory: runInventory,
  split: runSplit,
  packets: runPackets,
  estimate: runEstimate,
  'prepare-requests': runPrepareRequests,
  'run-sync': (argv) => runSync(argv),
  freeze: runFreeze,
  'run-locked': (argv) => runSync(argv, requireFlag(argv, 'calibration-version')),
  'batch-prepare': runBatchPrepare,
  'batch-submit': runBatchSubmit,
  'batch-status': runBatchStatus,
  'batch-fetch': runBatchFetch,
  ingest: runIngest,
  route: runRoute,
  evaluate: runEvaluate,
  'review-queue': runReviewQueue,
  qualify: runQualify,
  'audit-sample': runAuditSample,
  'review-app': runReviewApp,
}

export async function runLunaTriageCli(argv: readonly string[]): Promise<void> {
  const [command, ...rest] = argv
  if (!command || !(command in COMMANDS)) {
    throw new CliUsageError(
      `Usage: npx tsx scripts/literature-luna-triage/cli.ts <command>\n` +
        `Commands: ${Object.keys(COMMANDS).sort().join(', ')}`,
    )
  }
  await COMMANDS[command](rest)
}

/* istanbul ignore next -- entrypoint wiring */
if (pathToFileURL(process.argv[1] ?? '').href === import.meta.url) {
  runLunaTriageCli(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
