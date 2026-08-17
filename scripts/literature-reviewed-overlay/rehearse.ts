/**
 * Disposable end-to-end rehearsal of the reviewed-overlay operator.
 *
 * Creates a throwaway Supabase-image PostgreSQL 17 container (no published port, reached only
 * through `docker exec … psql` on its own unix socket), applies the foundation migration and
 * the additive overlay proposal, seeds a synthetic corpus of exactly the expected size, and
 * drives the real engine through the full lifecycle: precondition refusals, a confirmed
 * rejection with rollback, a lost acknowledgement with reconciliation, completion, idempotent
 * replay, drift detection, and verification. The protected real-local database and the real
 * dedicated project are never contacted; the rehearsal transport can only reach the container
 * it created.
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
  type OverlayReadTable,
} from './constants'
import {
  runApply,
  runReconcile,
  runValidate,
  runVerify,
  type OverlayEngineDependencies,
} from './engine'
import { buildReviewedSet } from './reviewed-set'
import { collectCohort } from './projection'
import { buildFixtureTruth, buildCorpusSeedSql } from './rehearsal-fixtures'
import {
  OverlayMutationAmbiguousError,
  OverlayMutationConfirmedFailureError,
  OverlayReadError,
  type OverlayReadQuery,
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

interface RehearsalScenario {
  name: string
  passed: boolean
  detail: string
}

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''")
}

/** Translate the narrow PostgREST query dialect the engine emits into plain SQL. */
export function translatePostgrestQuery(
  table: OverlayReadTable,
  query: string,
): { selectSql: string; countSql: string } {
  const parts = query.split('&')
  const first = parts.shift()
  if (!first || !first.startsWith('select=')) {
    throw new Error('The rehearsal transport requires a leading select= clause.')
  }
  const columns = first
    .slice('select='.length)
    .split(',')
    .map((column) => {
      if (!/^[a-z0-9_]+$/u.test(column)) {
        throw new Error('The rehearsal transport refuses a non-identifier column.')
      }
      return column
    })
  const conditions = parts.map((part) => {
    const equals = part.indexOf('=')
    if (equals < 1) throw new Error('The rehearsal transport could not parse a filter.')
    const column = part.slice(0, equals)
    if (!/^[a-z0-9_]+$/u.test(column)) {
      throw new Error('The rehearsal transport refuses a non-identifier filter column.')
    }
    const expression = part.slice(equals + 1)
    if (expression === 'not.is.null') return `${column} is not null`
    if (expression.startsWith('in.(') && expression.endsWith(')')) {
      const values = expression
        .slice('in.('.length, -1)
        .split(',')
        .map((value) => `'${escapeSqlLiteral(value)}'`)
      return `${column} in (${values.join(', ')})`
    }
    if (expression.startsWith('eq.')) {
      return `${column} = '${escapeSqlLiteral(expression.slice('eq.'.length))}'`
    }
    if (expression.startsWith('neq.')) {
      return `${column} <> '${escapeSqlLiteral(expression.slice('neq.'.length))}'`
    }
    throw new Error('The rehearsal transport refuses an unsupported filter operator.')
  })
  const where = conditions.length > 0 ? ` where ${conditions.join(' and ')}` : ''
  return {
    selectSql:
      `select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)::text from ` +
      `(select ${columns.join(', ')} from public.${table}${where}) as t`,
    countSql: `select count(*)::text from public.${table}${where}`,
  }
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

  async applyBatch(requestBody: string): Promise<unknown> {
    if (requestBody.includes(DOLLAR_TAG)) {
      throw new Error('The rehearsal transport cannot dollar-quote this body.')
    }
    let output: string
    try {
      output = await this.#psql(
        `select public.apply_literature_reviewed_overlay_batch_v1(` +
          `(${DOLLAR_TAG}${requestBody}${DOLLAR_TAG}::jsonb) -> 'p_operation', ` +
          `(${DOLLAR_TAG}${requestBody}${DOLLAR_TAG}::jsonb) -> 'p_records'` +
          `)::text;`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.startsWith('psql:') && message.includes('ERROR:')) {
        // A raised exception inside the RPC is a confirmed rejection, exactly as a PostgREST
        // 4xx would be.
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

  async readRows(table: OverlayReadTable, query: OverlayReadQuery): Promise<unknown[]> {
    const { selectSql } = translatePostgrestQuery(table, query.query)
    let output: string
    try {
      output = await this.#psql(`${selectSql};`)
    } catch (error) {
      throw new OverlayReadError(
        'read_rejected',
        error instanceof Error ? error.message : String(error),
      )
    }
    const parsed = JSON.parse(output) as unknown
    if (!Array.isArray(parsed)) {
      throw new OverlayReadError('read_malformed_response', 'Rehearsal rows were not an array.')
    }
    return parsed
  }

  async countRows(table: OverlayReadTable, filterQuery: string): Promise<number> {
    const { countSql } = translatePostgrestQuery(table, filterQuery)
    let output: string
    try {
      output = await this.#psql(`${countSql};`)
    } catch (error) {
      throw new OverlayReadError(
        'read_rejected',
        error instanceof Error ? error.message : String(error),
      )
    }
    if (!/^\d+$/u.test(output)) {
      throw new OverlayReadError('count_missing', 'Rehearsal count was not an integer.')
    }
    return Number.parseInt(output, 10)
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

  readRows(table: OverlayReadTable, query: OverlayReadQuery): Promise<unknown[]> {
    return this.inner.readRows(table, query)
  }

  countRows(table: OverlayReadTable, filterQuery: string): Promise<number> {
    return this.inner.countRows(table, filterQuery)
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

async function countEvents(world: RehearsalWorld): Promise<number> {
  const output = await psqlAdmin(
    world,
    REHEARSAL_DATABASE,
    'select count(*)::text from public.literature_curation_events;',
  )
  return Number.parseInt(output, 10)
}

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

    await psqlAdmin(world, 'postgres', `create database ${REHEARSAL_DATABASE};`)
    await psqlAdmin(world, 'postgres', `create database ${FOUNDATION_ONLY_DATABASE};`)
    // A freshly created database lacks the Supabase `extensions` schema the foundation
    // migration installs pg_trgm into; the foundation rehearsal bootstraps it the same way.
    await psqlAdmin(world, REHEARSAL_DATABASE, 'create schema if not exists extensions;')
    await psqlAdmin(world, FOUNDATION_ONLY_DATABASE, 'create schema if not exists extensions;')
    await psqlAdmin(world, REHEARSAL_DATABASE, foundationSql)
    await psqlAdmin(world, FOUNDATION_ONLY_DATABASE, foundationSql)
    await psqlAdmin(world, REHEARSAL_DATABASE, proposalSql)
    await psqlAdmin(world, REHEARSAL_DATABASE, buildCorpusSeedSql())

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

    // Scenario: read-only reconciliation classifies the lost batch as exactly applied.
    const reconciliation = await runReconcile(rehearsalDependencies(world, REHEARSAL_DATABASE), {
      checkpointPath,
    })
    const lostBatch = reconciliation.receipt.batches[0]
    record(
      world,
      'reconciliation-classifies-applied-exact',
      reconciliation.unresolvedBatchCount === 1 && lostBatch?.classification === 'applied_exact',
      JSON.stringify(lostBatch?.observed ?? {}),
    )
    const reconciliationPath = join(mainStateDir, 'reconciliation.json')
    const { writeFile } = await import('node:fs/promises')
    await writeFile(reconciliationPath, `${JSON.stringify(reconciliation.receipt, null, 2)}\n`, {
      mode: 0o600,
    })

    // Scenario: resume with the reconciliation receipt completes the operation without
    // duplicating the reconciled batch's history.
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
      applied.status === 'applied' && eventsAfterCompletion === OVERLAY_EXPECTED_RECORD_COUNT,
      `events=${eventsAfterCompletion}, receipt=${applied.receiptPath}`,
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

    // Scenario: verification proves the exact remote state.
    const verification = await runVerify(rehearsalDependencies(world, REHEARSAL_DATABASE), {
      checkpointPath,
    })
    record(
      world,
      'verify-exact',
      verification.remote.reviewedTotal === OVERLAY_EXPECTED_RECORD_COUNT &&
        verification.remote.foreignReviewed === 0 &&
        verification.remote.corpusTotal === OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
      JSON.stringify(verification.remote.classCounts),
    )

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

    // Scenario: a fresh state directory replays idempotently — zero new history rows.
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
        eventsAfterReplay === OVERLAY_EXPECTED_RECORD_COUNT,
      `events=${eventsAfterReplay}`,
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
