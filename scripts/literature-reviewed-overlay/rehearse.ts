/**
 * Disposable end-to-end rehearsal of the reviewed-overlay operator.
 *
 * Creates a throwaway Supabase-image PostgreSQL 17 container (no published port, reached only
 * through `docker exec … psql` on its own unix socket) and proves two layers against real SQL:
 *
 *   1. The engine lifecycle on a synthetic full-size corpus: precondition refusals, a
 *      confirmed rejection with rollback, a lost acknowledgement with re-observed
 *      reconciliation, completion licensed by the read-only post-observation, corrections
 *      lineage, append-only enforcement, idempotent replay, drift detection, and both
 *      causality counterexamples — a lost FINAL fresh acknowledgement that must remain
 *      630 applied / 0 alreadyApplied, and a lost replay acknowledgement whose counters must
 *      remain replay.
 *   2. The RPC contract directly, on a tiny corpus: strict input validation before casts,
 *      duplicate rejection, frozen-reason identity, the causal-mode gate (fresh never targets
 *      a completed operation; replay never targets anything else), actual-totals finalization,
 *      completed-operation immutability, per-field fresh and replay predicates, bounded
 *      observation, and partial-schema safety of the bare-CREATE proposal.
 *
 * The protected real-local database and the real dedicated project are never contacted; the
 * rehearsal transport can only reach the container it created.
 *
 *   npx tsx scripts/literature-reviewed-overlay/rehearse.ts
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  REHEARSAL_POSTGRES_IMAGE,
  REHEARSAL_SUPERUSER,
  rehearsalResourceName,
  runCommand,
} from '../literature-dedicated-supabase/lib/disposable-target'
import {
  OVERLAY_ARTIFACT_SHA256,
  OVERLAY_ARTIFACT_SHA256_ENV_NAME,
  OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
  OVERLAY_EXPECTED_RECORD_COUNT,
  OVERLAY_NOTE_CORRECTIONS,
  OVERLAY_OWNER_AUTHORIZATION_ENV_NAME,
  OVERLAY_OWNER_AUTHORIZATION_SENTENCE,
  OVERLAY_PROJECTION_SHA256_ENV_NAME,
} from './constants'
import {
  runApply,
  runReconcile,
  runValidate,
  runVerify,
  type OverlayEngineDependencies,
} from './engine'
import { deterministicUuid } from './identity'
import { buildReviewedSet } from './reviewed-set'
import { collectCohort } from './projection'
import { buildFixtureTruth, buildCorpusSeedSql } from './rehearsal-fixtures'
import {
  OverlayMutationAmbiguousError,
  OverlayMutationConfirmedFailureError,
  OverlayReadError,
  type OverlayTransport,
} from './transport'

const FOUNDATION_MIGRATION_PATH = resolve(
  process.cwd(),
  'supabase/migrations/20260727032621_add_literature_explorer.sql',
)
const PROPOSAL_PATH = resolve(
  process.cwd(),
  'scripts/literature-reviewed-overlay/schema/reviewed-overlay-proposal.sql',
)

const REHEARSAL_DATABASE = 'literature_overlay_rehearsal'
const FOUNDATION_ONLY_DATABASE = 'literature_overlay_foundation_only'
const RPC_CONTRACT_DATABASE = 'literature_overlay_rpc_contract'
const PARTIAL_SCHEMA_DATABASE = 'literature_overlay_partial_schema'
const FINAL_ACK_DATABASE = 'literature_overlay_final_ack'

interface RehearsalScenario {
  name: string
  passed: boolean
  detail: string
}

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''")
}

/** A dollar-quote tag that cannot occur inside a JSON body built by this operator. */
const DOLLAR_TAG = '$overlay_rehearsal$'

class DockerPsqlOverlayTransport implements OverlayTransport {
  constructor(
    private readonly container: string,
    private readonly database: string,
  ) {}

  async #psql(sql: string): Promise<string> {
    const result = await runCommand(
      'docker',
      [
        'exec',
        '--interactive',
        this.container,
        'psql',
        '--no-psqlrc',
        '--set',
        'ON_ERROR_STOP=1',
        '--username',
        REHEARSAL_SUPERUSER,
        '--dbname',
        this.database,
        '--tuples-only',
        '--no-align',
        '--quiet',
      ],
      { stdin: sql, allowFailure: true, timeoutMs: 120_000 },
    )
    if (result.code !== 0) {
      throw new Error(`psql:${result.stderr.trim() || 'exit ' + String(result.code)}`)
    }
    return result.stdout.trim()
  }

  async #callRpc(functionName: string, argumentsSql: string): Promise<string> {
    return this.#psql(`select public.${functionName}(${argumentsSql})::text;`)
  }

  async applyBatch(requestBody: string): Promise<unknown> {
    if (requestBody.includes(DOLLAR_TAG)) {
      throw new Error('The rehearsal transport cannot dollar-quote this body.')
    }
    let output: string
    try {
      output = await this.#callRpc(
        'apply_literature_reviewed_overlay_batch_v1',
        `(${DOLLAR_TAG}${requestBody}${DOLLAR_TAG}::jsonb) -> 'p_operation', ` +
          `(${DOLLAR_TAG}${requestBody}${DOLLAR_TAG}::jsonb) -> 'p_records'`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.startsWith('psql:') && message.includes('ERROR:')) {
        // A raised exception inside the RPC is a confirmed rejection, exactly as a PostgREST
        // 4xx would be. The disposable database is rehearsal-owned, so surfacing its generic
        // ordinal-based error text here is safe and is what the scenarios assert against.
        throw new OverlayMutationConfirmedFailureError(message)
      }
      throw new OverlayMutationAmbiguousError('transport_exception', message)
    }
    try {
      return JSON.parse(output) as unknown
    } catch {
      throw new OverlayMutationAmbiguousError(
        'malformed_acknowledgement',
        'The rehearsal acknowledgement was not valid JSON.',
      )
    }
  }

  async observe(requestBody: string): Promise<unknown> {
    if (requestBody.includes(DOLLAR_TAG)) {
      throw new OverlayReadError(
        'read_rejected',
        'The rehearsal transport cannot dollar-quote this body.',
      )
    }
    let output: string
    try {
      output = await this.#callRpc(
        'observe_literature_reviewed_overlay_v1',
        `${DOLLAR_TAG}${requestBody}${DOLLAR_TAG}::jsonb`,
      )
    } catch (error) {
      throw new OverlayReadError(
        'read_rejected',
        error instanceof Error ? error.message : String(error),
      )
    }
    try {
      return JSON.parse(output) as unknown
    } catch {
      throw new OverlayReadError(
        'read_malformed_response',
        'The rehearsal observation was not valid JSON.',
      )
    }
  }
}

/** Swallow the acknowledgement of exactly one applyBatch call, after the mutation applied. */
class LostAcknowledgementTransport implements OverlayTransport {
  #callsSeen = 0

  constructor(
    private readonly inner: OverlayTransport,
    private readonly loseCallIndex: number,
  ) {}

  async applyBatch(requestBody: string): Promise<unknown> {
    const callIndex = this.#callsSeen
    this.#callsSeen += 1
    const acknowledgement = await this.inner.applyBatch(requestBody)
    if (callIndex === this.loseCallIndex) {
      throw new OverlayMutationAmbiguousError(
        'request_timeout',
        'The rehearsal deliberately lost this acknowledgement.',
      )
    }
    return acknowledgement
  }

  observe(requestBody: string): Promise<unknown> {
    return this.inner.observe(requestBody)
  }
}

interface RehearsalWorld {
  container: string
  scenarios: RehearsalScenario[]
  stateRoot: string
}

function record(world: RehearsalWorld, name: string, passed: boolean, detail: string): void {
  world.scenarios.push({ name, passed, detail })
  if (!passed) {
    throw new Error(`Rehearsal scenario failed: ${name} — ${detail}`)
  }
}

async function expectRejection(action: () => Promise<unknown>, fragment: string): Promise<string> {
  try {
    await action()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes(fragment)) {
      throw new Error(`Expected a refusal mentioning "${fragment}"; saw: ${message}`)
    }
    return message
  }
  throw new Error(`Expected a refusal mentioning "${fragment}"; the action succeeded.`)
}

function rehearsalDependencies(
  world: RehearsalWorld,
  database: string,
  options: {
    transport?: OverlayTransport
    truth?: ReturnType<typeof buildFixtureTruth>
  } = {},
): OverlayEngineDependencies {
  const truth = options.truth ?? buildFixtureTruth()
  const transport = options.transport ?? new DockerPsqlOverlayTransport(world.container, database)
  return {
    environment: {
      [OVERLAY_ARTIFACT_SHA256_ENV_NAME]: OVERLAY_ARTIFACT_SHA256,
      [OVERLAY_PROJECTION_SHA256_ENV_NAME]: buildReviewedSet(
        collectCohort(truth.cohortPayloads),
        truth.artifact,
      ).projectionDigest,
      [OVERLAY_OWNER_AUTHORIZATION_ENV_NAME]: OVERLAY_OWNER_AUTHORIZATION_SENTENCE,
    },
    readCohortPayloads: () => Promise.resolve(truth.cohortPayloads),
    loadArtifact: () => truth.artifact,
    createTransport: () => transport,
    now: () => new Date(),
  }
}

async function psqlAdmin(world: RehearsalWorld, database: string, sql: string): Promise<string> {
  const result = await runCommand(
    'docker',
    [
      'exec',
      '--interactive',
      world.container,
      'psql',
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--username',
      REHEARSAL_SUPERUSER,
      '--dbname',
      database,
      '--tuples-only',
      '--no-align',
      '--quiet',
    ],
    { stdin: sql, timeoutMs: 300_000 },
  )
  return result.stdout.trim()
}

async function psqlAllowFailure(
  world: RehearsalWorld,
  database: string,
  sql: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return runCommand(
    'docker',
    [
      'exec',
      '--interactive',
      world.container,
      'psql',
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--username',
      REHEARSAL_SUPERUSER,
      '--dbname',
      database,
      '--tuples-only',
      '--no-align',
      '--quiet',
    ],
    { stdin: sql, allowFailure: true, timeoutMs: 120_000 },
  )
}

async function countEvents(
  world: RehearsalWorld,
  database: string = REHEARSAL_DATABASE,
): Promise<number> {
  const output = await psqlAdmin(
    world,
    database,
    'select count(*)::text from public.literature_curation_events;',
  )
  return Number.parseInt(output, 10)
}

/* -------------------------------------------------------------------------------------------
 * The direct RPC-contract layer: a tiny corpus, hand-built operations, and raw RPC calls.
 * ---------------------------------------------------------------------------------------- */

const CONTRACT_PMIDS = Array.from({ length: 12 }, (_, index) => String(900000001 + index))
const CONTRACT_REVIEWED_AT = '2026-08-17T12:00:00.000Z'

interface ContractRecord {
  pmid: string
  eventId: string
  reviewedRelevance: 'include_core' | 'include_adjacent' | 'exclude'
  enrichmentProvenance: 'physician_confirmed' | 'physician_modified' | 'qc_accepted'
  persistedHeadRevision: number | null
  noteCorrection: null
}

function contractOperation(
  name: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    operationId: deterministicUuid(['rehearsal-contract-operation', name]),
    writerIdentity: 'literature-reviewed-overlay',
    artifactSha256: OVERLAY_ARTIFACT_SHA256,
    sourceIdentity: 'rehearsal-contract-source',
    curationReason: `Rehearsal contract reason for ${name}.`,
    reviewedAt: CONTRACT_REVIEWED_AT,
    recordCount: 2,
    includeCoreCount: 1,
    includeAdjacentCount: 0,
    excludeCount: 1,
    physicianConfirmedCount: 1,
    physicianModifiedCount: 0,
    qcAcceptedCount: 1,
    causalMode: 'fresh',
    finalBatch: false,
    ...overrides,
  }
}

function contractRecord(
  operationName: string,
  pmid: string,
  overrides: Partial<ContractRecord> = {},
): ContractRecord {
  return {
    pmid,
    eventId: deterministicUuid(['rehearsal-contract-event', operationName, pmid]),
    reviewedRelevance: 'include_core',
    enrichmentProvenance: 'physician_confirmed',
    persistedHeadRevision: null,
    noteCorrection: null,
    ...overrides,
  }
}

async function callApplyRpc(
  world: RehearsalWorld,
  operation: Record<string, unknown>,
  records: unknown[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  const body = JSON.stringify({ p_operation: operation, p_records: records })
  if (body.includes(DOLLAR_TAG)) throw new Error('contract body cannot be dollar-quoted')
  return psqlAllowFailure(
    world,
    RPC_CONTRACT_DATABASE,
    `select public.apply_literature_reviewed_overlay_batch_v1(` +
      `(${DOLLAR_TAG}${body}${DOLLAR_TAG}::jsonb) -> 'p_operation', ` +
      `(${DOLLAR_TAG}${body}${DOLLAR_TAG}::jsonb) -> 'p_records')::text;`,
  )
}

async function expectRpcRejection(
  world: RehearsalWorld,
  operation: Record<string, unknown>,
  records: unknown[],
  fragment: string,
): Promise<string> {
  const result = await callApplyRpc(world, operation, records)
  if (result.code === 0) {
    throw new Error(`Expected the RPC to reject mentioning "${fragment}"; it succeeded.`)
  }
  if (!result.stderr.includes(fragment)) {
    throw new Error(
      `Expected the RPC rejection to mention "${fragment}"; stderr was: ${result.stderr.trim()}`,
    )
  }
  return result.stderr
}

async function runRpcContractScenarios(world: RehearsalWorld): Promise<void> {
  // Duplicate PMIDs and duplicate event ids inside one batch are refused before mutation.
  const dupPmidOp = contractOperation('dup-pmid')
  await expectRpcRejection(
    world,
    dupPmidOp,
    [
      contractRecord('dup-pmid', CONTRACT_PMIDS[0] as string),
      contractRecord('dup-pmid-b', CONTRACT_PMIDS[0] as string, {
        reviewedRelevance: 'exclude',
        enrichmentProvenance: 'qc_accepted',
      }),
    ],
    'repeats a PMID within the batch',
  )
  const dupEventOp = contractOperation('dup-event')
  const sharedEvent = contractRecord('dup-event', CONTRACT_PMIDS[0] as string)
  await expectRpcRejection(
    world,
    dupEventOp,
    [
      sharedEvent,
      { ...contractRecord('dup-event', CONTRACT_PMIDS[1] as string), eventId: sharedEvent.eventId },
    ],
    'repeats an event id within the batch',
  )
  record(world, 'rpc-duplicates-refused', true, 'duplicate PMID and event id both rolled back')

  // Grammar is validated before any cast, and a rejected value never enters the error.
  const sentinel = 'sb_secret_SENTINEL_VALUE_12345'
  const badEventStderr = await expectRpcRejection(
    world,
    contractOperation('bad-event'),
    [
      {
        ...contractRecord('bad-event', CONTRACT_PMIDS[0] as string),
        eventId: sentinel,
      },
    ],
    'overlay record 1 has an invalid event id',
  )
  record(
    world,
    'rpc-grammar-before-cast-generic-errors',
    !badEventStderr.includes(sentinel),
    'malformed event id rejected without echoing the value',
  )
  await expectRpcRejection(
    world,
    { ...contractOperation('bad-shape'), surprise: true },
    [contractRecord('bad-shape', CONTRACT_PMIDS[0] as string)],
    'missing or unexpected fields',
  )
  await expectRpcRejection(
    world,
    { ...contractOperation('bad-count'), recordCount: '2' },
    [contractRecord('bad-count', CONTRACT_PMIDS[0] as string)],
    'counts are not well-formed',
  )
  record(world, 'rpc-strict-input-shapes', true, 'closed key sets and typed counts enforced')

  // The frozen curation reason is operation identity: a later batch with a different reason is
  // a foreign operation.
  const reasonOp = contractOperation('mixed-reason')
  const reasonApply = await callApplyRpc(world, reasonOp, [
    contractRecord('mixed-reason', CONTRACT_PMIDS[0] as string),
  ])
  if (reasonApply.code !== 0) {
    throw new Error(`mixed-reason batch 1 unexpectedly failed: ${reasonApply.stderr}`)
  }
  await expectRpcRejection(
    world,
    { ...reasonOp, curationReason: 'A drifted reason.' },
    [
      contractRecord('mixed-reason', CONTRACT_PMIDS[1] as string, {
        reviewedRelevance: 'exclude',
        enrichmentProvenance: 'qc_accepted',
      }),
    ],
    'identity does not match the registered operation',
  )
  const storedReason = await psqlAdmin(
    world,
    RPC_CONTRACT_DATABASE,
    `select curation_reason from public.literature_articles ` +
      `where pmid = '${CONTRACT_PMIDS[0] as string}';`,
  )
  const eventReason = await psqlAdmin(
    world,
    RPC_CONTRACT_DATABASE,
    `select reason from public.literature_curation_events ` +
      `where pmid = '${CONTRACT_PMIDS[0] as string}';`,
  )
  record(
    world,
    'rpc-curation-reason-bound',
    storedReason === (reasonOp.curationReason as string) &&
      eventReason === (reasonOp.curationReason as string),
    'article and event carry exactly the registered reason',
  )

  // Actual provenance totals gate completion: registered 1/0/1 versus actual 0/0/2 must
  // refuse finalization even though classes and total agree.
  const provenanceOp = contractOperation('provenance-gate', {
    curationReason: 'Rehearsal contract reason for provenance-gate.',
  })
  const provenanceApply = await callApplyRpc(world, { ...provenanceOp, finalBatch: false }, [
    contractRecord('provenance-gate', CONTRACT_PMIDS[2] as string, {
      enrichmentProvenance: 'qc_accepted',
    }),
  ])
  if (provenanceApply.code !== 0) {
    throw new Error(`provenance-gate batch 1 failed: ${provenanceApply.stderr}`)
  }
  await expectRpcRejection(
    world,
    { ...provenanceOp, finalBatch: true },
    [
      contractRecord('provenance-gate', CONTRACT_PMIDS[3] as string, {
        reviewedRelevance: 'exclude',
        enrichmentProvenance: 'qc_accepted',
      }),
    ],
    'finalization totals do not match the registered operation',
  )
  record(
    world,
    'rpc-actual-provenance-gates-completion',
    true,
    'registered 1/0/1 vs actual 0/0/2 refused finalization',
  )

  // A single-record operation completes, then becomes immutable.
  const sealedOp = contractOperation('sealed', {
    recordCount: 1,
    includeCoreCount: 1,
    excludeCount: 0,
    qcAcceptedCount: 0,
    finalBatch: true,
  })
  const sealedRecord = contractRecord('sealed', CONTRACT_PMIDS[4] as string)
  const sealedApply = await callApplyRpc(world, sealedOp, [sealedRecord])
  if (sealedApply.code !== 0) throw new Error(`sealed apply failed: ${sealedApply.stderr}`)
  const sealedAck = JSON.parse(sealedApply.stdout) as Record<string, unknown>
  record(
    world,
    'rpc-single-record-operation-completes',
    sealedAck.operationStatus === 'completed' && sealedAck.applied === 1,
    'operation registered, applied, and completed',
  )

  // The causal-mode gate: a fresh-mode request can never target the completed operation, and
  // a replay-mode request can never target an operation that is not completed — including a
  // brand-new operation, whose registration must roll back with the refused call.
  await expectRpcRejection(
    world,
    { ...sealedOp, finalBatch: false },
    [contractRecord('sealed-fresh-gate', CONTRACT_PMIDS[5] as string)],
    'fresh-mode request targets a completed operation',
  )
  const replayGateOp = contractOperation('replay-gate', { causalMode: 'replay' })
  await expectRpcRejection(
    world,
    replayGateOp,
    [contractRecord('replay-gate', CONTRACT_PMIDS[5] as string)],
    'replay-mode request targets an operation that is not completed',
  )
  const replayGateRegistered = await psqlAdmin(
    world,
    RPC_CONTRACT_DATABASE,
    `select count(*)::text from public.literature_reviewed_overlay_operations ` +
      `where id = '${replayGateOp.operationId as string}';`,
  )
  await expectRpcRejection(
    world,
    { ...contractOperation('bad-mode'), causalMode: 'REPLAY' },
    [contractRecord('bad-mode', CONTRACT_PMIDS[5] as string)],
    'causal mode is not well-formed',
  )
  record(
    world,
    'rpc-causal-mode-gate',
    replayGateRegistered === '0',
    'fresh-vs-completed and replay-vs-started both refused; refused registration rolled back',
  )

  // Completed operations are immutable: replay-mode extension by a fresh article, a foreign
  // article, and altered metadata all fail the entire call.
  const sealedReplayOp = { ...sealedOp, causalMode: 'replay' }
  await expectRpcRejection(
    world,
    { ...sealedReplayOp, finalBatch: false },
    [contractRecord('sealed-extend', CONTRACT_PMIDS[5] as string)],
    'attempts to extend a completed operation',
  )
  await expectRpcRejection(
    world,
    { ...sealedReplayOp, finalBatch: false },
    [contractRecord('sealed-foreign', CONTRACT_PMIDS[0] as string)],
    'attempts to extend a completed operation',
  )
  await expectRpcRejection(
    world,
    { ...sealedOp, recordCount: 2, includeCoreCount: 2, physicianConfirmedCount: 2 },
    [sealedRecord],
    'identity does not match the registered operation',
  )
  await expectRpcRejection(
    world,
    { ...sealedOp, recordCount: 2, includeCoreCount: 2 },
    [sealedRecord],
    'counts are not well-formed',
  )
  const registeredCount = await psqlAdmin(
    world,
    RPC_CONTRACT_DATABASE,
    `select record_count::text from public.literature_reviewed_overlay_operations ` +
      `where id = '${sealedOp.operationId as string}';`,
  )
  record(
    world,
    'rpc-completed-operation-immutable',
    registeredCount === '1',
    'no fresh article, foreign article, or metadata change entered the completed operation',
  )

  // Exact replay of a completed operation returns already_applied only — including a replay
  // that repeats the final batch — echoes the causal mode, and a replay mixing one exact and
  // one fresh record fails.
  const sealedReplay = await callApplyRpc(world, sealedReplayOp, [sealedRecord])
  if (sealedReplay.code !== 0) throw new Error(`sealed replay failed: ${sealedReplay.stderr}`)
  const sealedReplayAck = JSON.parse(sealedReplay.stdout) as Record<string, unknown>
  record(
    world,
    'rpc-exact-replay-already-applied',
    sealedReplayAck.applied === 0 &&
      sealedReplayAck.alreadyApplied === 1 &&
      sealedReplayAck.operationStatus === 'completed' &&
      sealedReplayAck.causalMode === 'replay',
    'replay returned already_applied only with the causal mode echoed',
  )
  await expectRpcRejection(
    world,
    { ...sealedReplayOp, finalBatch: false },
    [sealedRecord, contractRecord('sealed-mixed', CONTRACT_PMIDS[5] as string)],
    'attempts to extend a completed operation',
  )
  record(world, 'rpc-replay-with-fresh-record-fails-whole-call', true, 'mixed call rolled back')

  // A two-batch operation replays out of order after completion.
  const orderedOp = contractOperation('ordered', {
    curationReason: 'Rehearsal contract reason for ordered.',
  })
  const orderedA = contractRecord('ordered', CONTRACT_PMIDS[6] as string)
  const orderedB = contractRecord('ordered', CONTRACT_PMIDS[7] as string, {
    reviewedRelevance: 'exclude',
    enrichmentProvenance: 'qc_accepted',
  })
  const orderedFirst = await callApplyRpc(world, { ...orderedOp, finalBatch: false }, [orderedA])
  if (orderedFirst.code !== 0) throw new Error(`ordered batch 1 failed: ${orderedFirst.stderr}`)
  const orderedSecond = await callApplyRpc(world, { ...orderedOp, finalBatch: true }, [orderedB])
  if (orderedSecond.code !== 0) throw new Error(`ordered batch 2 failed: ${orderedSecond.stderr}`)
  const orderedReplayOp = { ...orderedOp, causalMode: 'replay' }
  const replayB = await callApplyRpc(world, { ...orderedReplayOp, finalBatch: true }, [orderedB])
  const replayA = await callApplyRpc(world, { ...orderedReplayOp, finalBatch: false }, [orderedA])
  const replayBAck = JSON.parse(replayB.stdout) as Record<string, unknown>
  const replayAAck = JSON.parse(replayA.stdout) as Record<string, unknown>
  record(
    world,
    'rpc-replay-batches-any-order',
    replayB.code === 0 &&
      replayA.code === 0 &&
      replayBAck.alreadyApplied === 1 &&
      replayAAck.alreadyApplied === 1 &&
      replayAAck.operationStatus === 'completed',
    'both batches replayed in swapped order as already_applied',
  )

  // Replay predicates are exact per protected field: any tampering is drift, never a silent
  // already_applied.
  const replayTampers: Array<[string, string]> = [
    ['visibility_state', `visibility_state = 'published'`],
    ['relevance_state', `relevance_state = 'candidate'`],
    ['manual_override', 'manual_override = false'],
    ['is_landmark', 'is_landmark = true'],
    ['curation_reason', `curation_reason = 'tampered reason'`],
    ['classifier_version', `classifier_version = 'ghost/1'`],
    ['classifier_payload', `classifier_payload = '{}'::jsonb`],
    ['reviewed_source_identity', `reviewed_source_identity = 'tampered-source'`],
    ['reviewed_at', `reviewed_at = reviewed_at + interval '1 second'`],
    ['reviewed_enrichment_provenance', `reviewed_enrichment_provenance = 'physician_modified'`],
  ]
  for (const [field, assignment] of replayTampers) {
    await psqlAdmin(
      world,
      RPC_CONTRACT_DATABASE,
      `update public.literature_articles set ${assignment} ` +
        `where pmid = '${CONTRACT_PMIDS[4] as string}';`,
    )
    await expectRpcRejection(
      world,
      sealedReplayOp,
      [sealedRecord],
      field === 'reviewed_enrichment_provenance'
        ? 'has drifted from the applied state'
        : 'has drifted from the applied state',
    )
    await psqlAdmin(
      world,
      RPC_CONTRACT_DATABASE,
      `update public.literature_articles set
         relevance_state = 'included',
         visibility_state = 'draft',
         manual_override = true,
         is_landmark = false,
         curation_reason = '${escapeSqlLiteral(sealedOp.curationReason as string)}',
         classifier_version = null,
         classifier_payload = null,
         reviewed_relevance = 'include_core',
         reviewed_enrichment_provenance = 'physician_confirmed',
         reviewed_source_identity = '${escapeSqlLiteral(sealedOp.sourceIdentity as string)}',
         reviewed_at = '${CONTRACT_REVIEWED_AT}'::timestamptz,
         reviewed_operation_id = '${sealedOp.operationId as string}'
       where pmid = '${CONTRACT_PMIDS[4] as string}';`,
    )
  }
  const sealedReplayAfterRestore = await callApplyRpc(world, sealedReplayOp, [sealedRecord])
  record(
    world,
    'rpc-replay-field-predicates-load-bearing',
    sealedReplayAfterRestore.code === 0,
    `${replayTampers.length} tampered fields each detected as drift, restored state replays`,
  )

  // Fresh-application predicates are exact per protected field.
  const freshTampers: Array<[string, string, string]> = [
    ['relevance_state', `relevance_state = 'candidate'`, `relevance_state = 'unreviewed'`],
    ['visibility_state', `visibility_state = 'hidden'`, `visibility_state = 'draft'`],
    ['manual_override', 'manual_override = true', 'manual_override = false'],
    ['is_landmark', 'is_landmark = true', 'is_landmark = false'],
    ['curation_reason', `curation_reason = 'pre-existing'`, 'curation_reason = null'],
    ['classifier_version', `classifier_version = 'ghost/1'`, 'classifier_version = null'],
    ['classifier_payload', `classifier_payload = '{}'::jsonb`, 'classifier_payload = null'],
  ]
  const freshVictim = CONTRACT_PMIDS[8] as string
  for (const [field, assignment, restore] of freshTampers) {
    await psqlAdmin(
      world,
      RPC_CONTRACT_DATABASE,
      `update public.literature_articles set ${assignment} where pmid = '${freshVictim}';`,
    )
    await expectRpcRejection(
      world,
      contractOperation(`fresh-${field}`, {
        recordCount: 1,
        includeCoreCount: 1,
        excludeCount: 0,
        qcAcceptedCount: 0,
        finalBatch: true,
      }),
      [contractRecord(`fresh-${field}`, freshVictim)],
      'not in the untouched imported state',
    )
    await psqlAdmin(
      world,
      RPC_CONTRACT_DATABASE,
      `update public.literature_articles set ${restore} where pmid = '${freshVictim}';`,
    )
  }
  record(
    world,
    'rpc-fresh-field-predicates-load-bearing',
    true,
    `${freshTampers.length} pre-touched fields each refused fresh application`,
  )

  // The observation RPC bounds and validates its request body.
  const oversized = JSON.stringify({
    operationId: sealedOp.operationId,
    pmids: Array.from({ length: 251 }, (_, index) => String(910000000 + index)),
    eventIds: [],
  })
  const oversizedResult = await psqlAllowFailure(
    world,
    RPC_CONTRACT_DATABASE,
    `select public.observe_literature_reviewed_overlay_v1(` +
      `${DOLLAR_TAG}${oversized}${DOLLAR_TAG}::jsonb)::text;`,
  )
  const badKeyResult = await psqlAllowFailure(
    world,
    RPC_CONTRACT_DATABASE,
    `select public.observe_literature_reviewed_overlay_v1(` +
      `${DOLLAR_TAG}{"operationId":"${sealedOp.operationId as string}","pmids":[],` +
      `"eventIds":[],"extra":true}${DOLLAR_TAG}::jsonb)::text;`,
  )
  record(
    world,
    'rpc-observation-bounded-and-strict',
    oversizedResult.code !== 0 &&
      oversizedResult.stderr.includes('bounded request size') &&
      badKeyResult.code !== 0 &&
      badKeyResult.stderr.includes('missing or unexpected fields'),
    'oversized and malformed observation requests refused',
  )
}

/* -------------------------------------------------------------------------------------------
 * The rehearsal itself.
 * ---------------------------------------------------------------------------------------- */

export async function runRehearsal(): Promise<{
  scenarios: RehearsalScenario[]
  container: string
}> {
  const container = rehearsalResourceName('overlay')
  const stateRoot = mkdtempSync(join(tmpdir(), 'literature-reviewed-overlay-rehearsal-'))
  const world: RehearsalWorld = { container, scenarios: [], stateRoot }

  await runCommand('docker', [
    'run',
    '--detach',
    '--rm',
    '--name',
    container,
    '--env',
    'POSTGRES_PASSWORD=rehearsal-only',
    REHEARSAL_POSTGRES_IMAGE,
  ])

  try {
    // Wait for the database to accept connections.
    let ready = false
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const probe = await runCommand(
        'docker',
        ['exec', container, 'pg_isready', '--username', REHEARSAL_SUPERUSER],
        { allowFailure: true },
      )
      if (probe.code === 0) {
        ready = true
        break
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000))
    }
    if (!ready) throw new Error('The rehearsal database never became ready.')
    // The Supabase image restarts the server once during first boot; settle briefly.
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 3000))

    const foundationSql = readFileSync(FOUNDATION_MIGRATION_PATH, 'utf8')
    const proposalSql = readFileSync(PROPOSAL_PATH, 'utf8')

    for (const database of [
      REHEARSAL_DATABASE,
      FOUNDATION_ONLY_DATABASE,
      RPC_CONTRACT_DATABASE,
      PARTIAL_SCHEMA_DATABASE,
      FINAL_ACK_DATABASE,
    ]) {
      await psqlAdmin(world, 'postgres', `create database ${database};`)
      // A freshly created database lacks the Supabase `extensions` schema the foundation
      // migration installs pg_trgm into; the foundation rehearsal bootstraps it the same way.
      await psqlAdmin(world, database, 'create schema if not exists extensions;')
      await psqlAdmin(world, database, foundationSql)
    }
    await psqlAdmin(world, REHEARSAL_DATABASE, proposalSql)
    await psqlAdmin(world, RPC_CONTRACT_DATABASE, proposalSql)
    await psqlAdmin(world, FINAL_ACK_DATABASE, proposalSql)
    await psqlAdmin(world, REHEARSAL_DATABASE, buildCorpusSeedSql())
    await psqlAdmin(world, FINAL_ACK_DATABASE, buildCorpusSeedSql())
    await psqlAdmin(
      world,
      RPC_CONTRACT_DATABASE,
      `insert into public.literature_articles (
         pmid, title, metadata_hash, normalized_title, normalized_title_hash
       )
       select p::text, 'Contract article ' || p, md5(p::text) || md5('m' || p::text),
              'contract article ' || p, md5('n' || p::text) || md5('h' || p::text)
       from generate_series(900000001, 900000012) as p;`,
    )

    // Partial-schema safety: an incompatible same-signature function must survive the
    // proposal, which must fail transactionally rather than replace it.
    await psqlAdmin(
      world,
      PARTIAL_SCHEMA_DATABASE,
      `create function public.apply_literature_reviewed_overlay_batch_v1(jsonb, jsonb)
         returns jsonb language sql as $incumbent$ select '"incumbent"'::jsonb $incumbent$;`,
    )
    const partialApply = await psqlAllowFailure(world, PARTIAL_SCHEMA_DATABASE, proposalSql)
    const incumbentSurvived = await psqlAdmin(
      world,
      PARTIAL_SCHEMA_DATABASE,
      `select public.apply_literature_reviewed_overlay_batch_v1('{}'::jsonb, '[]'::jsonb)::text;`,
    )
    const partialTables = await psqlAdmin(
      world,
      PARTIAL_SCHEMA_DATABASE,
      `select count(*)::text from pg_catalog.pg_tables ` +
        `where tablename = 'literature_reviewed_overlay_operations';`,
    )
    record(
      world,
      'proposal-partial-schema-fails-safely',
      partialApply.code !== 0 && incumbentSurvived === '"incumbent"' && partialTables === '0',
      'incompatible same-signature function intact; proposal rolled back whole',
    )

    const corpusTotal = await psqlAdmin(
      world,
      REHEARSAL_DATABASE,
      'select count(*)::text from public.literature_articles;',
    )
    record(
      world,
      'corpus-seeded',
      Number.parseInt(corpusTotal, 10) === OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
      `corpus=${corpusTotal}`,
    )

    const truth = buildFixtureTruth()
    const set = buildReviewedSet(collectCohort(truth.cohortPayloads), truth.artifact)

    // Scenario: validate succeeds against the fixture authorities.
    const validation = await runValidate(rehearsalDependencies(world, REHEARSAL_DATABASE))
    record(
      world,
      'validate',
      validation.reviewedSet.counts.recordCount === OVERLAY_EXPECTED_RECORD_COUNT,
      `projection=${validation.reviewedSet.projectionDigest.slice(0, 12)}`,
    )

    // Scenario: the overlay schema probe fails closed on a foundation-only database.
    await expectRejection(
      () =>
        runApply(rehearsalDependencies(world, FOUNDATION_ONLY_DATABASE), {
          stateDirectory: join(world.stateRoot, 'foundation-only'),
          recordBatchLimit: 90,
          resume: false,
          confirmProductionWrite: true,
        }),
      'reviewed-overlay schema is not present',
    )
    record(world, 'schema-probe-fails-closed', true, 'foundation-only database refused')

    // Scenario: a cohort PMID absent from the corpus stops before any mutation.
    const mutantTruth = buildFixtureTruth()
    const syntheticVictim = mutantTruth.artifact.rows.findIndex(
      (row) => !OVERLAY_NOTE_CORRECTIONS.some((c) => c.pmid === row.pmid),
    )
    const absentPmid = '999999999'
    const victimPmid = mutantTruth.artifact.rows[syntheticVictim]?.pmid as string
    mutantTruth.artifact.rows[syntheticVictim] = {
      ...(mutantTruth.artifact.rows[syntheticVictim] as { pmid: string }),
      pmid: absentPmid,
    } as (typeof mutantTruth.artifact.rows)[number]
    for (const payload of mutantTruth.cohortPayloads) {
      if (payload.pmid === victimPmid) payload.pmid = absentPmid
    }
    await expectRejection(
      () =>
        runApply(rehearsalDependencies(world, REHEARSAL_DATABASE, { truth: mutantTruth }), {
          stateDirectory: join(world.stateRoot, 'absent-pmid'),
          recordBatchLimit: 90,
          resume: false,
          confirmProductionWrite: true,
        }),
      'absent from the destination corpus',
    )
    record(
      world,
      'corpus-absent-pmid-fails-before-mutation',
      (await countEvents(world)) === 0,
      'no event was written',
    )

    // Scenario: apply refuses without the production confirmation flag.
    await expectRejection(
      () =>
        runApply(rehearsalDependencies(world, REHEARSAL_DATABASE), {
          stateDirectory: join(world.stateRoot, 'no-confirm'),
          recordBatchLimit: 90,
          resume: false,
          confirmProductionWrite: false,
        }),
      '--confirm-production-write',
    )
    record(world, 'confirmation-flag-required', true, 'refused without the flag')

    // Scenario: a poisoned article makes its batch a confirmed rejection, transactional
    // rollback keeps the batch all-or-nothing, and earlier batches stay applied.
    const poisonOrdinal = 3 * 90 + 5 // inside batch index 3
    const poisonPmid = set.records[poisonOrdinal - 1]?.pmid as string
    await psqlAdmin(
      world,
      REHEARSAL_DATABASE,
      `update public.literature_articles set manual_override = true ` +
        `where pmid = '${escapeSqlLiteral(poisonPmid)}';`,
    )
    const mainStateDir = join(world.stateRoot, 'main')
    await expectRejection(
      () =>
        runApply(rehearsalDependencies(world, REHEARSAL_DATABASE), {
          stateDirectory: mainStateDir,
          recordBatchLimit: 90,
          resume: false,
          confirmProductionWrite: true,
        }),
      'not in the untouched imported state',
    )
    const eventsAfterRejection = await countEvents(world)
    record(
      world,
      'confirmed-rejection-rolls-back-batch',
      eventsAfterRejection === 270,
      `events=${eventsAfterRejection} (batches 0-2 only)`,
    )

    // Repair the poisoned article, then resume with a transport that loses the next
    // acknowledgement (batch 3 applies, the acknowledgement never arrives).
    await psqlAdmin(
      world,
      REHEARSAL_DATABASE,
      `update public.literature_articles set manual_override = false ` +
        `where pmid = '${escapeSqlLiteral(poisonPmid)}';`,
    )
    const checkpointPath = join(mainStateDir, `overlay-${set.operationId}.checkpoint.json`)
    const lossyTransport = new LostAcknowledgementTransport(
      new DockerPsqlOverlayTransport(world.container, REHEARSAL_DATABASE),
      0,
    )
    await expectRejection(
      () =>
        runApply(rehearsalDependencies(world, REHEARSAL_DATABASE, { transport: lossyTransport }), {
          stateDirectory: mainStateDir,
          recordBatchLimit: 90,
          resume: true,
          checkpointPath,
          confirmProductionWrite: true,
        }),
      'deliberately lost this acknowledgement',
    )
    const eventsAfterLostAck = await countEvents(world)
    record(
      world,
      'lost-acknowledgement-is-ambiguous',
      eventsAfterLostAck === 360,
      `events=${eventsAfterLostAck} (batch 3 applied, acknowledgement lost)`,
    )

    // Scenario: resume without reconciliation is refused; no automatic second mutation.
    await expectRejection(
      () =>
        runApply(rehearsalDependencies(world, REHEARSAL_DATABASE), {
          stateDirectory: mainStateDir,
          recordBatchLimit: 90,
          resume: true,
          checkpointPath,
          confirmProductionWrite: true,
        }),
      'requires read-only reconciliation',
    )
    record(
      world,
      'resume-blocked-until-reconciled',
      (await countEvents(world)) === 360,
      'no second mutation happened',
    )

    // Scenario: read-only reconciliation classifies the lost batch as exactly applied, with
    // the registry observed consistent.
    const reconciliation = await runReconcile(rehearsalDependencies(world, REHEARSAL_DATABASE), {
      checkpointPath,
    })
    const lostBatch = reconciliation.receipt.batches[0]
    record(
      world,
      'reconciliation-classifies-applied-exact',
      reconciliation.unresolvedBatchCount === 1 &&
        reconciliation.receipt.registryConsistent === true &&
        reconciliation.receipt.operationScope?.reviewedForOperation === 360 &&
        reconciliation.receipt.operationScope.eventsForOperation === 360 &&
        lostBatch?.classification === 'applied_exact' &&
        lostBatch.requestMode === 'fresh' &&
        lostBatch.observed.exactRecords === 90,
      JSON.stringify(lostBatch?.observed ?? {}),
    )
    const reconciliationPath = join(mainStateDir, 'reconciliation.json')
    const { writeFile } = await import('node:fs/promises')
    await writeFile(reconciliationPath, `${JSON.stringify(reconciliation.receipt, null, 2)}\n`, {
      mode: 0o600,
    })

    // Scenario: resume with the reconciliation receipt re-observes, completes the operation
    // without duplicating the reconciled batch's history, and binds the post-observation.
    const applied = await runApply(rehearsalDependencies(world, REHEARSAL_DATABASE), {
      stateDirectory: mainStateDir,
      recordBatchLimit: 90,
      resume: true,
      checkpointPath,
      reconciliationPath,
      readReconciliation: async (path) => JSON.parse(readFileSync(path, 'utf8')) as unknown,
      confirmProductionWrite: true,
    })
    const eventsAfterCompletion = await countEvents(world)
    record(
      world,
      'resume-completes-without-duplicates',
      applied.status === 'applied' &&
        eventsAfterCompletion === OVERLAY_EXPECTED_RECORD_COUNT &&
        applied.counters.applied === OVERLAY_EXPECTED_RECORD_COUNT &&
        /^[a-f0-9]{64}$/u.test(applied.postObservationChecksum),
      `events=${eventsAfterCompletion}, postObservation=${applied.postObservationChecksum.slice(0, 12)}`,
    )

    // Scenario: the two corrections are represented in production history.
    const correctionRows = await psqlAdmin(
      world,
      REHEARSAL_DATABASE,
      `select count(*)::text from public.literature_curation_events ` +
        `where after_value -> 'note_correction' ->> 'ruleVersion' = ` +
        `'amended-two-row-physician-rationale-exception/1.0.0' ` +
        `and (after_value ->> 'persisted_head_revision')::integer = 2;`,
    )
    record(
      world,
      'corrections-preserved-in-history',
      Number.parseInt(correctionRows, 10) === OVERLAY_NOTE_CORRECTIONS.length,
      `correction events=${correctionRows}`,
    )

    // Scenario: verification re-observes and matches the completion binding, including every
    // registry field and the exact class/provenance totals.
    const verification = await runVerify(rehearsalDependencies(world, REHEARSAL_DATABASE), {
      checkpointPath,
    })
    record(
      world,
      'verify-exact',
      verification.postObservationChecksum === applied.postObservationChecksum &&
        verification.remote.totals.reviewedForOperation === OVERLAY_EXPECTED_RECORD_COUNT &&
        verification.remote.totals.foreignReviewed === 0 &&
        verification.remote.totals.corpusArticles === OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
      JSON.stringify({
        includeCore: verification.remote.totals.includeCore,
        includeAdjacent: verification.remote.totals.includeAdjacent,
        exclude: verification.remote.totals.exclude,
      }),
    )

    // Scenario: registry drift after completion fails verification (altered totals are read,
    // bound, and compared — never ignored).
    await psqlAdmin(
      world,
      REHEARSAL_DATABASE,
      `alter table public.literature_reviewed_overlay_operations ` +
        `disable trigger all;
       update public.literature_reviewed_overlay_operations ` +
        `set physician_confirmed_count = physician_confirmed_count + 1, ` +
        `physician_modified_count = physician_modified_count - 1 ` +
        `where id = '${set.operationId}';
       alter table public.literature_reviewed_overlay_operations enable trigger all;`,
    )
    await expectRejection(
      () => runVerify(rehearsalDependencies(world, REHEARSAL_DATABASE), { checkpointPath }),
      'different identity content',
    )
    await psqlAdmin(
      world,
      REHEARSAL_DATABASE,
      `update public.literature_reviewed_overlay_operations ` +
        `set physician_confirmed_count = physician_confirmed_count - 1, ` +
        `physician_modified_count = physician_modified_count + 1 ` +
        `where id = '${set.operationId}';`,
    )
    record(world, 'registry-drift-detected-by-verify', true, 'altered provenance totals refused')

    // Scenario: append-only enforcement — the operator (or anyone) cannot update history.
    await expectRejection(
      () =>
        psqlAdmin(
          world,
          REHEARSAL_DATABASE,
          `update public.literature_curation_events set reason = 'tampered' ` +
            `where after_value ->> 'reviewed_operation_id' = '${set.operationId}';`,
        ),
      'append-only',
    )
    record(world, 'history-append-only', true, 'event update refused by trigger')

    // Scenario: a fresh state directory replays idempotently — zero new history rows, with
    // every acknowledgement judged in replay context.
    const replay = await runApply(rehearsalDependencies(world, REHEARSAL_DATABASE), {
      stateDirectory: join(world.stateRoot, 'replay'),
      recordBatchLimit: 90,
      resume: false,
      confirmProductionWrite: true,
    })
    const eventsAfterReplay = await countEvents(world)
    record(
      world,
      'deterministic-replay-no-duplicates',
      replay.status === 'idempotent-replay' &&
        replay.counters.alreadyApplied === OVERLAY_EXPECTED_RECORD_COUNT &&
        replay.counters.applied === 0 &&
        eventsAfterReplay === OVERLAY_EXPECTED_RECORD_COUNT &&
        replay.postObservationChecksum === applied.postObservationChecksum,
      `events=${eventsAfterReplay}`,
    )

    // Scenario: a genuine completed-operation replay whose acknowledgement is lost keeps its
    // replay causality — reconciliation classifies through the batch's durable replay mode,
    // and the completed counters remain 0 applied / 630 alreadyApplied with no new history.
    const replayLossDir = join(world.stateRoot, 'replay-loss')
    const replayLossTransport = new LostAcknowledgementTransport(
      new DockerPsqlOverlayTransport(world.container, REHEARSAL_DATABASE),
      0,
    )
    await expectRejection(
      () =>
        runApply(
          rehearsalDependencies(world, REHEARSAL_DATABASE, { transport: replayLossTransport }),
          {
            stateDirectory: replayLossDir,
            recordBatchLimit: 250,
            resume: false,
            confirmProductionWrite: true,
          },
        ),
      'deliberately lost this acknowledgement',
    )
    const replayLossCheckpointPath = join(
      replayLossDir,
      `overlay-${set.operationId}.checkpoint.json`,
    )
    const replayLossReconciliation = await runReconcile(
      rehearsalDependencies(world, REHEARSAL_DATABASE),
      { checkpointPath: replayLossCheckpointPath },
    )
    const replayLossBatch = replayLossReconciliation.receipt.batches[0]
    record(
      world,
      'replay-lost-ack-reconciles-causally-replay',
      replayLossBatch?.classification === 'applied_exact' &&
        replayLossBatch.requestMode === 'replay' &&
        replayLossBatch.expectedRecordCount === 250,
      JSON.stringify(replayLossBatch?.observed ?? {}),
    )
    const replayLossReceiptPath = join(replayLossDir, 'reconciliation.json')
    await writeFile(
      replayLossReceiptPath,
      `${JSON.stringify(replayLossReconciliation.receipt, null, 2)}\n`,
      { mode: 0o600 },
    )
    const replayLossResumed = await runApply(rehearsalDependencies(world, REHEARSAL_DATABASE), {
      stateDirectory: replayLossDir,
      recordBatchLimit: 250,
      resume: true,
      checkpointPath: replayLossCheckpointPath,
      reconciliationPath: replayLossReceiptPath,
      readReconciliation: async (path) => JSON.parse(readFileSync(path, 'utf8')) as unknown,
      confirmProductionWrite: true,
    })
    record(
      world,
      'replay-counters-remain-replay-after-lost-ack',
      replayLossResumed.status === 'idempotent-replay' &&
        replayLossResumed.counters.applied === 0 &&
        replayLossResumed.counters.alreadyApplied === OVERLAY_EXPECTED_RECORD_COUNT &&
        (await countEvents(world)) === OVERLAY_EXPECTED_RECORD_COUNT,
      `counters=${JSON.stringify(replayLossResumed.counters)}`,
    )

    // Scenario: the review's exact counterexample — batches of 250/250/130, the FINAL batch
    // freshly applies and completes the operation remotely, and only its acknowledgement is
    // lost. The batch's durable fresh mode must survive the now-completed registry:
    // reconciliation reports 130 applied, the completed counters are 630 applied / 0
    // alreadyApplied, and no second mutation occurs.
    const finalAckStateDir = join(world.stateRoot, 'final-ack')
    const finalAckLossyTransport = new LostAcknowledgementTransport(
      new DockerPsqlOverlayTransport(world.container, FINAL_ACK_DATABASE),
      2,
    )
    await expectRejection(
      () =>
        runApply(
          rehearsalDependencies(world, FINAL_ACK_DATABASE, {
            transport: finalAckLossyTransport,
          }),
          {
            stateDirectory: finalAckStateDir,
            recordBatchLimit: 250,
            resume: false,
            confirmProductionWrite: true,
          },
        ),
      'deliberately lost this acknowledgement',
    )
    const finalAckRegistryStatus = await psqlAdmin(
      world,
      FINAL_ACK_DATABASE,
      `select status from public.literature_reviewed_overlay_operations ` +
        `where id = '${set.operationId}';`,
    )
    record(
      world,
      'final-batch-applied-remotely-ack-lost',
      finalAckRegistryStatus === 'completed' &&
        (await countEvents(world, FINAL_ACK_DATABASE)) === OVERLAY_EXPECTED_RECORD_COUNT,
      `registry=${finalAckRegistryStatus}, all 630 events present, acknowledgement lost`,
    )

    const finalAckCheckpointPath = join(
      finalAckStateDir,
      `overlay-${set.operationId}.checkpoint.json`,
    )
    const finalAckReconciliation = await runReconcile(
      rehearsalDependencies(world, FINAL_ACK_DATABASE),
      { checkpointPath: finalAckCheckpointPath },
    )
    const finalAckBatch = finalAckReconciliation.receipt.batches[0]
    record(
      world,
      'lost-final-ack-reconciles-causally-fresh',
      finalAckBatch?.classification === 'applied_exact' &&
        finalAckBatch.requestMode === 'fresh' &&
        finalAckBatch.expectedRecordCount === 130 &&
        finalAckReconciliation.receipt.operationScope?.reviewedForOperation === 630 &&
        finalAckReconciliation.receipt.operationScope.eventsForOperation === 630,
      JSON.stringify(finalAckBatch?.observed ?? {}),
    )
    const finalAckReceiptPath = join(finalAckStateDir, 'reconciliation.json')
    await writeFile(
      finalAckReceiptPath,
      `${JSON.stringify(finalAckReconciliation.receipt, null, 2)}\n`,
      { mode: 0o600 },
    )
    const finalAckResumed = await runApply(rehearsalDependencies(world, FINAL_ACK_DATABASE), {
      stateDirectory: finalAckStateDir,
      recordBatchLimit: 250,
      resume: true,
      checkpointPath: finalAckCheckpointPath,
      reconciliationPath: finalAckReceiptPath,
      readReconciliation: async (path) => JSON.parse(readFileSync(path, 'utf8')) as unknown,
      confirmProductionWrite: true,
    })
    record(
      world,
      'lost-final-ack-remains-fresh-630-applied',
      finalAckResumed.status === 'applied' &&
        finalAckResumed.counters.applied === OVERLAY_EXPECTED_RECORD_COUNT &&
        finalAckResumed.counters.alreadyApplied === 0 &&
        (await countEvents(world, FINAL_ACK_DATABASE)) === OVERLAY_EXPECTED_RECORD_COUNT,
      `counters=${JSON.stringify(finalAckResumed.counters)}, no second mutation`,
    )

    // Scenario: resuming a completed checkpoint is refused.
    await expectRejection(
      () =>
        runApply(rehearsalDependencies(world, REHEARSAL_DATABASE), {
          stateDirectory: mainStateDir,
          recordBatchLimit: 90,
          resume: true,
          checkpointPath,
          confirmProductionWrite: true,
        }),
      'already completed',
    )
    record(world, 'completed-checkpoint-resume-refused', true, 'refused')

    // Scenario: drift detection — a tampered current state fails verification.
    await psqlAdmin(
      world,
      REHEARSAL_DATABASE,
      `update public.literature_articles set curation_reason = 'tampered' ` +
        `where pmid = '${escapeSqlLiteral(poisonPmid)}';`,
    )
    await expectRejection(
      () => runVerify(rehearsalDependencies(world, REHEARSAL_DATABASE), { checkpointPath }),
      'not exactly applied',
    )
    record(world, 'drift-detected-by-verify', true, 'tampered article detected')

    // The direct RPC-contract layer.
    await runRpcContractScenarios(world)

    return { scenarios: world.scenarios, container }
  } finally {
    await runCommand('docker', ['rm', '--force', container], { allowFailure: true })
    rmSync(stateRoot, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  const outcome = await runRehearsal()
  process.stdout.write(
    `${JSON.stringify(
      {
        status: 'rehearsed',
        scenariosPassed: outcome.scenarios.length,
        scenarios: outcome.scenarios,
      },
      null,
      2,
    )}\n`,
  )
}

if (pathToFileURL(process.argv[1] ?? '').href === import.meta.url) {
  main().catch((error: unknown) => {
    process.stdout.write(
      `${JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      })}\n`,
    )
    process.exitCode = 1
  })
}
