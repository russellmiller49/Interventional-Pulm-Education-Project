import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { deterministicPmidOrder } from '../../src/features/literature/ultra-screening/core'
import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import type { OverlayRelevance } from '../literature-reviewed-overlay/constants'
import { buildAuditSample } from './audit'
import {
  parseBatchOutputJsonl,
  planBatchShards,
  shardPlanSummary,
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
import { buildEvaluationReport, evaluationReportSha256 } from './evaluation'
import {
  appendJsonlRows,
  createOperation,
  listRawResponseIds,
  loadOperationMetadata,
  operationPaths,
  readMapping,
  readPackets,
  readRequests,
  readRiskFlags,
  readRoutedRecords,
  readTerminalStates,
  type OperationPaths,
} from './operation'
import { buildPacket, mintOperationSalt } from './packet'
import { loadStageAPrompt } from './prompt'
import { reconcileRequestBodyText, reconcileShardContent } from './reconcile'
import { ingestStageAResponses, type RawResponseRecord } from './results'
import { startReviewServer } from './review-app'
import { assertGenericCommandNotLocked, assertNoLockedMembership } from './locked'
import { buildRoutedRecords, buildRoutingManifest } from './routing'
import { prepareRequestSet, type PreparedRequest } from './runner'
import {
  apportionLockedSanity,
  assertStoredSplitIsCanonical,
  buildCalibrationSplit,
  buildSplitManifest,
  recomputeCanonicalSplit,
  type CanonicalSplitAuthority,
} from './split'
import {
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
 * The Luna triage CLI — the **offline** preparation platform. Run from the repository root:
 *
 *   npx tsx scripts/literature-luna-triage/cli.ts <command> [flags]
 *
 * This CLI cannot call a model. It has no credential read, no transport, and no remote
 * endpoint anywhere in its module graph: it builds packets, prepares deterministic request
 * bytes and Batch shards, prices them, ingests result files that arrive by some other route,
 * routes and evaluates them, and serves the loopback physician-review app.
 *
 * The commands that would execute a run (`run-sync`, `run-locked`), submit or poll a Batch
 * (`batch-submit`, `batch-status`, `batch-fetch`), or declare that a model qualified
 * (`qualify`) are **withheld**, not merely absent: each is named in `WITHHELD_COMMANDS` and
 * refused with an explanation before any flag is parsed, any file is opened, or any state
 * directory is resolved. They return as separately reviewed, separately spend-authorized
 * adapters in later PRs.
 *
 * Coordinator discipline everywhere: stdout carries aggregates, digests, and paths — never a
 * PMID, never a record title. No command accepts a record identity as an argument.
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

/**
 * The locked-membership set this run will check selections against.
 *
 * When physician truth is available it is **recomputed** canonically and the stored split is
 * proven to equal it; otherwise the stored locked list is read directly. Either way the set
 * goes to `assertNoLockedMembership`, which refuses to answer membership questions from a set
 * that is not exactly 200 — so a missing, truncated, or emptied split file fails closed
 * instead of silently reporting "no overlap".
 */
async function lockedMembershipSet(
  state: StateRoot,
  artifactPath: string | undefined,
): Promise<Set<string>> {
  if (artifactPath) {
    return (await canonicalSplitAuthority(state, artifactPath)).lockedSanityPmids
  }
  try {
    return new Set((await readSplitArtifacts(state)).lockedSanity)
  } catch {
    throw new CliUsageError(
      'This cohort must be proven free of locked-sanity members, but no split artifacts were ' +
        'found in the state directory. Run `split --artifact <path>` first, or pass --artifact.',
    )
  }
}

/**
 * Build the packet set for one cohort.
 *
 * Packets are inert local JSON — no model ever sees them from this release — but the locked
 * 200 are still refused two ways: by the declared cohort label, and by actual membership of
 * whatever set the selection resolves to. `full-corpus` is the one documented exception: it
 * is the entire 132,350-record corpus rather than a selection, so it necessarily contains the
 * locked identities and there is no selection to check. It remains permitted because nothing
 * here can send it, and because no command can narrow it back down to the locked cohort.
 */
async function runPackets(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const cohort = parseCohort(requireFlag(argv, 'cohort'))
  assertGenericCommandNotLocked(cohort, 'packets')
  const operationId = requireFlag(argv, 'operation')
  const artifactPath = flagValue(argv, 'artifact')

  let selection: Set<string> | null = null
  if (LUNA_CALIBRATION_COHORTS.includes(cohort)) {
    const split = await readSplitArtifacts(state)
    if (cohort === 'development-430') {
      selection = new Set(split.development)
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

  // Membership, not the label. Whatever this cohort calls itself, a selection that touches
  // even one locked identity is refused before a single packet is written.
  if (cohort !== 'full-corpus') {
    assertNoLockedMembership(
      [...members],
      await lockedMembershipSet(state, artifactPath),
      'packets',
    )
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
  command: string,
): Promise<RequestPreparation> {
  const operationId = requireFlag(argv, 'operation')
  const paths = operationPaths(state, operationId)
  await assertPreparationPathwayNotLocked(state, paths, argv, command)
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
  // Reconciliation, not assertion by construction: every prepared body is re-read from its
  // own bytes and must yield back the record id and token contribution the manifest claims.
  let reconciledInputTokens = 0
  let reconciledOutputTokens = 0
  for (const request of prepared.requests) {
    const reconciliation = reconcileRequestBodyText(request.bodyText)
    if (
      reconciliation.recordId !== request.customId ||
      reconciliation.bodySha256 !== request.bodySha256 ||
      reconciliation.inputTokens !== request.estimate.inputTokens ||
      reconciliation.outputTokenAllowance !== request.estimate.outputTokenAllowance
    ) {
      throw new Error(
        'A prepared request does not reconcile with its own bytes; refusing to record it.',
      )
    }
    reconciledInputTokens += reconciliation.inputTokens
    reconciledOutputTokens += reconciliation.outputTokenAllowance
  }
  if (
    reconciledInputTokens !== prepared.manifest.totalEstimatedInputTokens ||
    reconciledOutputTokens !== prepared.manifest.totalEstimatedOutputTokenAllowance
  ) {
    throw new Error('The prepared request manifest does not reconcile with the prepared bytes.')
  }
  const manifest: Record<string, unknown> = {
    ...prepared.manifest,
    reconciledInputTokens,
    reconciledOutputTokenAllowance: reconciledOutputTokens,
  }
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
  const preparation = await prepareRequestsForOperation(state, argv, false, 'estimate')
  const estimate = estimateCohortCost(
    preparation.requests.map((request) => request.estimate),
    { batch: flagPresent(argv, 'batch') },
  )
  // The ceilings still bite offline: they are how a plan is judged before anyone is asked to
  // authorize sending it. They gate the report, not a socket, because there is no socket.
  const maxRecords = numberFlag(argv, 'max-records')
  if (maxRecords !== undefined) assertWithinRecordCeiling(estimate.records, maxRecords)
  const maxCost = numberFlag(argv, 'max-estimated-cost-usd')
  if (maxCost !== undefined) assertWithinCostCeiling(estimate, maxCost)
  print({ command: 'estimate', manifest: preparation.manifest, estimate })
}

async function runPrepareRequests(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const preparation = await prepareRequestsForOperation(state, argv, true, 'prepare-requests')
  print({ command: 'prepare-requests', manifest: preparation.manifest })
}

/**
 * Recompute the canonical calibration split from the immutable truth authority and the fixed
 * corpus, then prove the stored split artifacts are exactly it. The stored files are a cache;
 * a manifest's own declared digests never authorize the identities sitting beside them.
 */
async function canonicalSplitAuthority(
  state: StateRoot,
  artifactPath: string | undefined,
): Promise<{ canonical: CanonicalSplitAuthority; lockedSanityPmids: Set<string> }> {
  if (!artifactPath) {
    throw new CliUsageError(
      '--artifact is required: the canonical split is recomputed from physician truth, never ' +
        'read from a stored manifest.',
    )
  }
  const truth = loadTruthAuthority(artifactPath)
  const { presence } = await collectTruthPresence(truth)
  const canonical = recomputeCanonicalSplit(truth, presence)
  const stored = await readSplitArtifacts(state)
  assertStoredSplitIsCanonical(stored, canonical, truth)
  return { canonical, lockedSanityPmids: new Set(canonical.split.lockedSanityPmids) }
}

/**
 * Every preparation command re-checks the operation it was handed: the declared cohort label
 * first, then — whenever a locked-membership set can be established — the operation's actual
 * record identities. An operation created before this release, or created under a friendlier
 * label, is caught here rather than at the point it would have been sent.
 */
async function assertPreparationPathwayNotLocked(
  state: StateRoot,
  paths: OperationPaths,
  argv: readonly string[],
  command: string,
): Promise<void> {
  const metadata = await loadOperationMetadata(paths)
  assertGenericCommandNotLocked(metadata.cohort, command)
  if (metadata.cohort === 'full-corpus') return
  const artifactPath = flagValue(argv, 'artifact')
  let lockedSanityPmids: Set<string>
  try {
    lockedSanityPmids = await lockedMembershipSet(state, artifactPath)
  } catch {
    // No split artifacts and no truth in reach: there is nothing to check membership against,
    // and inventing an empty set here would turn the guard into a rubber stamp.
    return
  }
  assertNoLockedMembership(
    (await readMapping(paths)).map((row) => row.pmid),
    lockedSanityPmids,
    command,
  )
}

async function runBatchPrepare(argv: readonly string[]): Promise<void> {
  const state = await stateFromArgv(argv)
  const operationId = requireFlag(argv, 'operation')
  const paths = operationPaths(state, operationId)
  await assertPreparationPathwayNotLocked(state, paths, argv, 'batch-prepare')
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
  // Each shard is re-read from the bytes just built. The plan's counts are only allowed to be
  // what the shard content itself yields back, so the priced plan and the file on disk cannot
  // describe two different cohorts.
  let reconciledRecords = 0
  let reconciledInputTokens = 0
  let reconciledOutputTokens = 0
  for (const shard of plan.shards) {
    const reconciliation = reconcileShardContent(shard.content)
    if (
      reconciliation.recordCount !== shard.recordCount ||
      reconciliation.uniqueCustomIdCount !== shard.recordCount ||
      reconciliation.estimatedInputTokens !== shard.estimatedInputTokens ||
      reconciliation.estimatedOutputTokenAllowance !== shard.estimatedOutputTokenAllowance ||
      reconciliation.contentSha256 !== shard.contentSha256
    ) {
      throw new Error('A prepared shard does not reconcile with its own bytes; refusing to write.')
    }
    reconciledRecords += reconciliation.recordCount
    reconciledInputTokens += reconciliation.estimatedInputTokens
    reconciledOutputTokens += reconciliation.estimatedOutputTokenAllowance
    await exclusiveWriteFile(join(paths.batchShardsDir, shard.filename), shard.content)
  }
  const summary = shardPlanSummary(plan)
  const estimate = estimateCohortCost([...estimates.values()], { batch: true })
  if (
    reconciledRecords !== estimate.records ||
    reconciledInputTokens !== estimate.inputTokens ||
    reconciledOutputTokens !== estimate.outputTokenAllowance
  ) {
    throw new Error('The shard plan estimate does not reconcile with the prepared shard bytes.')
  }
  const maxCost = numberFlag(argv, 'max-estimated-cost-usd')
  if (maxCost !== undefined) assertWithinCostCeiling(estimate, maxCost)
  await exclusiveWriteFile(
    join(paths.batchShardsDir, 'shard-plan.json'),
    `${canonicalJson({
      ...summary,
      estimate,
      reconciledFromShardBytes: {
        records: reconciledRecords,
        estimatedInputTokens: reconciledInputTokens,
        estimatedOutputTokenAllowance: reconciledOutputTokens,
      },
      submission: 'withheld: Batch submission is not part of this release',
    })}\n`,
  )
  print({ command: 'batch-prepare', summary, estimate })
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
      // A Batch result file present on this machine means the shards behind it were attempted,
      // however they got there. The shard files are authoritative for which custom ids that
      // covers; this release never submits them, so the evidence is the result file, not a
      // receipt this lane wrote.
      const results = await readdir(paths.batchRawDir)
      if (results.some((entry) => entry.endsWith('.jsonl'))) {
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
      // No batch artifacts at all: nothing was attempted through that route.
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
  // The coordinator's mapping is the one selection authority; every denominator derives from
  // it, and each of assignments, routing, and truth must equal it exactly.
  const selectedRecordIds = (await readMapping(paths)).map((row) => row.recordId)
  const report = buildEvaluationReport({
    cohortLabel: metadata.cohort,
    selectedRecordIds,
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

/**
 * The closed command inventory.
 *
 * This object is the whole executable surface of the lane. Every entry is offline: it reads
 * local files, computes, and writes local files. There is no hidden alias, no dynamic lookup,
 * and no fall-through — an unlisted name never reaches a handler.
 */
const COMMANDS: Record<string, (argv: readonly string[]) => Promise<void>> = {
  inventory: runInventory,
  split: runSplit,
  packets: runPackets,
  estimate: runEstimate,
  'prepare-requests': runPrepareRequests,
  'batch-prepare': runBatchPrepare,
  ingest: runIngest,
  route: runRoute,
  evaluate: runEvaluate,
  'review-queue': runReviewQueue,
  'audit-sample': runAuditSample,
  'review-app': runReviewApp,
}

/** The exact set of commands this release can execute, sorted. */
export const LUNA_CLI_COMMANDS: readonly string[] = Object.keys(COMMANDS).sort()

/**
 * Commands that are deliberately **withheld** rather than quietly missing.
 *
 * Naming them here is the point. A command that vanished without explanation invites someone
 * to reimplement it; a command that refuses with its reason states that the capability was
 * removed on purpose and names what has to happen before it comes back. Each refusal fires
 * from `runLunaTriageCli` before any flag parsing, any state resolution, any file read, and
 * any credential or socket could exist — there is no code behind these names to reach.
 */
export const WITHHELD_COMMANDS: Readonly<Record<string, string>> = {
  'run-sync':
    'Remote execution is withheld from this release. Preparing requests is offline and ' +
    'supported (prepare-requests, estimate); sending them requires a separately reviewed ' +
    'transport adapter and a separate owner spend authorization.',
  'run-locked':
    'The locked-sanity cohort has no executable pathway in this release. Its 200 identities ' +
    'are still constructed deterministically by split, but running them is the job of a ' +
    'separately reviewed locked coordinator.',
  'batch-submit':
    'Batch submission is withheld from this release. batch-prepare produces deterministic, ' +
    'content-addressed shards and a priced plan offline; uploading them and creating a Batch ' +
    'requires a separately reviewed transport adapter.',
  'batch-status':
    'Batch status polling is withheld from this release: no Batch can be created from here, ' +
    'so there is nothing for this command to poll.',
  'batch-fetch':
    'Batch result retrieval is withheld from this release. Result files that arrive on this ' +
    'machine by some other route are still ingested strictly by ingest --source batch.',
  qualify:
    'Qualification is withheld from this release. evaluate reports metrics and denominators ' +
    'descriptively; deciding that a model qualified is a release decision owned by the ' +
    'future locked coordinator, and nothing in this PR may claim it.',
  freeze:
    'Freeze receipts bound a locked run to one execution surface. With no locked run in this ' +
    'release there is nothing to freeze; the receipt returns with the locked coordinator.',
}

export class WithheldCommandError extends Error {
  constructor(command: string, reason: string) {
    super(`The "${command}" command is withheld in this release. ${reason}`)
    this.name = 'WithheldCommandError'
  }
}

export async function runLunaTriageCli(argv: readonly string[]): Promise<void> {
  const [command, ...rest] = argv
  // Withheld first: a withheld name must never fall through into usage-help territory where a
  // future edit could accidentally wire it to a handler.
  if (command !== undefined && Object.hasOwn(WITHHELD_COMMANDS, command)) {
    throw new WithheldCommandError(command, WITHHELD_COMMANDS[command])
  }
  if (!command || !Object.hasOwn(COMMANDS, command)) {
    throw new CliUsageError(
      `Usage: npx tsx scripts/literature-luna-triage/cli.ts <command>\n` +
        `Commands: ${LUNA_CLI_COMMANDS.join(', ')}\n` +
        `Withheld in this release: ${Object.keys(WITHHELD_COMMANDS).sort().join(', ')}`,
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
