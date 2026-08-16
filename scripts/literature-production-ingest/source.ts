import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { Readable } from 'node:stream'

import {
  ARTICLE_SELECT_COLUMNS,
  DEFAULT_CANARY_SIZE,
  SOURCE_CONTAINER,
  SOURCE_CONTAINER_ID,
  SOURCE_DATABASE,
  SOURCE_DATABASE_USER,
  SOURCE_DOCKER_ENDPOINT,
  SOURCE_IMAGE_ID,
  SOURCE_INTERNAL_PORT,
  SOURCE_PUBLISHED_PORT,
  SOURCE_SUPABASE_PROJECT,
} from './constants'
import { validateSourceEnvelope } from './mapping'
import type { IngestMode, SourceEnvelope } from './types'

export const SOURCE_DOCKER_CONTEXT = 'default' as const
export const SOURCE_IDENTITY_PREFIX = 'LITERATURE_SOURCE_IDENTITY:' as const
export const SOURCE_RECORD_PREFIX = 'LITERATURE_SOURCE_RECORD:' as const
export const SOURCE_COMPLETE_PREFIX = 'LITERATURE_SOURCE_COMPLETE:' as const

/**
 * The complete environment a source child process receives.
 *
 * This was a denylist — strip anything matching `DOCKER|CONTAINER|SUPABASE|PG|…` or
 * `SECRET|PASSWORD|TOKEN|…` — and a denylist is only ever as good as the names someone thought of.
 * `LITERATURE_VERIFY_ADMIN_COOKIE` matched none of those patterns, so an admin session cookie was
 * forwarded to a `docker exec` child that has no use for one. Neither does anything else here: a
 * local `psql` read authenticates as the container's `postgres` user over a Unix socket and needs
 * no Literature production secret, no session, and no token of any kind.
 *
 * So the rule is inverted. Five names go through, chosen because `docker` and `psql` genuinely
 * need them, and everything else — every current variable and every variable anyone adds later —
 * is absent by default rather than by prediction. `DOCKER_HOST` and friends are excluded as a
 * consequence, which also means the pinned context cannot be redirected through the environment.
 */
export const SOURCE_ENVIRONMENT_ALLOWLIST: readonly string[] = [
  // `docker` and `psql` are resolved from PATH.
  'PATH',
  // `docker` reads ~/.docker/config.json to resolve the pinned context name.
  'HOME',
  // Locale only affects message formatting; the framed protocol is ASCII.
  'LANG',
  'LC_ALL',
  'TMPDIR',
]
const MAX_GUARD_OUTPUT_BYTES = 8 * 1024

const JOURNAL_SELECT_COLUMNS = [
  'id',
  'canonical_name',
  'pubmed_abbreviation',
  'nlm_id',
  'issn_print',
  'issn_electronic',
  'aliases',
  'source_tier',
  'active_from',
  'active_to',
  'notes',
  'registry_version',
] as const

/**
 * What the source must attest about itself, in band, before any row is believed.
 *
 * Both the opening identity frame and the closing completion frame now carry the full payload and
 * are checked by the same assertion. Previously the completion frame carried only `readOnly`, and
 * the candidate query in `canary-candidates.ts` carried a third, different subset — so "the same
 * attestation" was three attestations. One shape, one assertion, both ends.
 */
export interface SourceIdentity {
  database: string
  user: string
  port: string
  readOnly: boolean
  isolation: string
}

export interface SourceCommandResult {
  code: number
  stdout: string
}

export type SourceEnvironment = Record<string, string | undefined>

export interface SourceCommandOptions {
  environment: SourceEnvironment
}

export type SourceCommandRunner = (
  command: string,
  arguments_: readonly string[],
  options: SourceCommandOptions,
) => Promise<SourceCommandResult>

export interface SourceStreamProcess {
  stdout: Readable
  stderr: Readable
  completion: Promise<{ code: number }>
  terminate: () => void
}

export interface SourceStreamOptions extends SourceCommandOptions {
  stdin: string
}

export type SourceStreamRunner = (
  command: string,
  arguments_: readonly string[],
  options: SourceStreamOptions,
) => SourceStreamProcess

export interface DockerPsqlSourceOptions {
  mode: IngestMode
  canaryPmids?: readonly string[]
  environment?: Readonly<SourceEnvironment>
  commandRunner?: SourceCommandRunner
  streamRunner?: SourceStreamRunner
}

export type SourceFactory = (
  mode: IngestMode,
  canaryPmids?: readonly string[],
) => AsyncIterable<SourceEnvelope>

export interface SourceFactoryDependencies {
  environment?: Readonly<SourceEnvironment>
  commandRunner?: SourceCommandRunner
  streamRunner?: SourceStreamRunner
}

/**
 * Reduce an environment to the allowlist, dropping everything else.
 *
 * Total and order-independent: what comes out is a function of `SOURCE_ENVIRONMENT_ALLOWLIST`
 * alone, so no caller can widen it and no new variable can leak in by being unanticipated.
 */
export function sanitizeSourceEnvironment(
  environment: Readonly<SourceEnvironment> = process.env,
): SourceEnvironment {
  const allowed = new Set(SOURCE_ENVIRONMENT_ALLOWLIST)
  return Object.fromEntries(
    Object.entries(environment).filter(
      ([name, value]) => allowed.has(name) && typeof value === 'string',
    ),
  )
}

function defaultCommandRunner(
  command: string,
  arguments_: readonly string[],
  options: SourceCommandOptions,
): Promise<SourceCommandResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, [...arguments_], {
      env: options.environment as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stdoutBytes = 0
    let settled = false

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdoutBytes += Buffer.byteLength(chunk)
      if (stdoutBytes > MAX_GUARD_OUTPUT_BYTES) {
        child.kill('SIGKILL')
        return
      }
      stdout += chunk
    })
    child.stderr.resume()
    child.on('error', () => {
      if (settled) return
      settled = true
      rejectPromise(new Error('Fixed source guard command could not start.'))
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      if (stdoutBytes > MAX_GUARD_OUTPUT_BYTES) {
        rejectPromise(new Error('Fixed source guard returned excessive output.'))
        return
      }
      resolvePromise({ code: code ?? -1, stdout })
    })
  })
}

function defaultStreamRunner(
  command: string,
  arguments_: readonly string[],
  options: SourceStreamOptions,
): SourceStreamProcess {
  const child = spawn(command, [...arguments_], {
    env: options.environment as NodeJS.ProcessEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const completion = new Promise<{ code: number }>((resolvePromise, rejectPromise) => {
    let settled = false
    child.on('error', () => {
      if (settled) return
      settled = true
      rejectPromise(new Error('Fixed source stream could not start.'))
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      resolvePromise({ code: code ?? -1 })
    })
  })
  // Docker can exit before psql consumes stdin. Drain the resulting EPIPE here; the child exit
  // code and mandatory source-completion frame still determine the fail-closed stream outcome.
  child.stdin.on('error', () => undefined)
  child.stdin.end(options.stdin)
  return {
    stdout: child.stdout,
    stderr: child.stderr,
    completion,
    terminate: () => child.kill('SIGKILL'),
  }
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

/**
 * The one attestation payload, emitted identically by every query that crosses this boundary.
 *
 * Exported so the candidate query in `canary-candidates.ts` builds the same frames rather than a
 * near-miss of them; `assertSourceIdentity` is the single reader of both.
 */
export const SOURCE_ATTESTATION_SQL = `jsonb_build_object(
  'database', current_database(),
  'user', current_user,
  'port', current_setting('port'),
  'readOnly', current_setting('transaction_read_only')::boolean,
  'isolation', current_setting('transaction_isolation')
)`

function assertCanaryPmids(pmids: readonly string[] | undefined): string[] {
  if (!pmids || pmids.length !== DEFAULT_CANARY_SIZE) {
    throw new Error(`Canary source requires exactly ${DEFAULT_CANARY_SIZE} frozen manifest PMIDs.`)
  }
  if (pmids.some((pmid) => !/^[0-9]{1,12}$/u.test(pmid))) {
    throw new Error('Canary manifest contains an invalid PMID.')
  }
  const unique = new Set(pmids)
  if (unique.size !== DEFAULT_CANARY_SIZE) {
    throw new Error('Canary manifest contains duplicate PMIDs.')
  }
  return [...unique].sort()
}

function jsonObjectProjection(alias: string, columns: readonly string[]): string {
  return columns.map((column) => `${sqlString(column)}, ${alias}.${column}`).join(',\n      ')
}

export function buildSourceSql(mode: IngestMode, canaryPmids?: readonly string[]): string {
  if (mode !== 'canary' && mode !== 'full') throw new Error('Source mode is invalid.')
  if (mode === 'full' && canaryPmids !== undefined) {
    throw new Error('Full source mode must not receive canary PMIDs.')
  }
  const frozenPmids = mode === 'canary' ? assertCanaryPmids(canaryPmids) : null
  const filter = frozenPmids
    ? `where article.pmid in (${frozenPmids.map(sqlString).join(', ')})`
    : ''

  return String.raw`begin transaction isolation level repeatable read read only;
set local statement_timeout = '0';
select ${sqlString(SOURCE_IDENTITY_PREFIX)} || ${SOURCE_ATTESTATION_SQL}::text;
select ${sqlString(SOURCE_RECORD_PREFIX)} || jsonb_build_object(
  'article', jsonb_build_object(
      ${jsonObjectProjection('article', ARTICLE_SELECT_COLUMNS)}
  ),
  'journal', case when journal.id is null then null else jsonb_build_object(
      ${jsonObjectProjection('journal', JOURNAL_SELECT_COLUMNS)}
  ) end
)::text
from public.literature_articles as article
left join public.literature_journals as journal on journal.id = article.journal_id
${filter}
order by article.pmid collate "C" asc;
select ${sqlString(SOURCE_COMPLETE_PREFIX)} || ${SOURCE_ATTESTATION_SQL}::text;
rollback;`
}

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    throw new Error(`${label} was not valid JSON.`)
  }
}

export function assertSourceIdentity(value: unknown): asserts value is SourceIdentity {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (value as Record<string, unknown>).database !== SOURCE_DATABASE ||
    (value as Record<string, unknown>).user !== SOURCE_DATABASE_USER ||
    (value as Record<string, unknown>).port !== SOURCE_INTERNAL_PORT ||
    (value as Record<string, unknown>).readOnly !== true ||
    (value as Record<string, unknown>).isolation !== 'repeatable read'
  ) {
    throw new Error('Source database identity or read-only transaction attestation failed.')
  }
}

/**
 * Every fixed-source guard, in the one place they exist.
 *
 * Exported because the canary-manifest proposal command reads the most sensitive relation in the
 * package — the review cohort — and used to reach it through a bare `docker exec` by container
 * name, running none of these. A PATH-level `docker` shim, the wrong context, the wrong container,
 * or a look-alike image all produced a perfectly well-formed manifest. There is deliberately no
 * second implementation to drift from: any caller that wants to read the local source awaits this.
 */
export async function assertFixedDockerSource(
  runner: SourceCommandRunner,
  environment: SourceEnvironment,
): Promise<void> {
  const context = await runner(
    'docker',
    ['context', 'inspect', SOURCE_DOCKER_CONTEXT, '--format', '{{json .Endpoints.docker.Host}}'],
    { environment },
  )
  if (context.code !== 0) throw new Error('Fixed local Docker context inspection failed.')
  let endpoint: unknown
  try {
    endpoint = JSON.parse(context.stdout.trim()) as unknown
  } catch {
    throw new Error('Fixed local Docker context returned an invalid endpoint.')
  }
  if (endpoint !== SOURCE_DOCKER_ENDPOINT) {
    throw new Error('Fixed source Docker endpoint identity guard failed.')
  }

  const inspected = await runner(
    'docker',
    [
      '--context',
      SOURCE_DOCKER_CONTEXT,
      'inspect',
      '--format',
      '{{.Id}}|{{.Image}}|{{.Name}}|{{.State.Running}}|{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}|{{index .Config.Labels "com.supabase.cli.project"}}',
      SOURCE_CONTAINER,
    ],
    { environment },
  )
  if (
    inspected.code !== 0 ||
    inspected.stdout.trim() !==
      `${SOURCE_CONTAINER_ID}|${SOURCE_IMAGE_ID}|/${SOURCE_CONTAINER}|true|${SOURCE_PUBLISHED_PORT}|${SOURCE_SUPABASE_PROJECT}`
  ) {
    throw new Error('Fixed source container identity, project, or port guard failed.')
  }
}

async function discard(stream: Readable): Promise<void> {
  for await (const chunk of stream) {
    void chunk
    // Drain without retaining stderr, which can contain runtime or environment diagnostics.
  }
}

/**
 * The exact `docker` argv every guarded read uses.
 *
 * A single array rather than two hand-typed ones: the proposal command's copy was missing
 * `--context default`, `--no-psqlrc`, and `ON_ERROR_STOP=1`, which is precisely the class of
 * divergence that a shared constant makes impossible.
 */
export function buildSourcePsqlArguments(): readonly string[] {
  return [
    '--context',
    SOURCE_DOCKER_CONTEXT,
    'exec',
    '--interactive',
    SOURCE_CONTAINER,
    'psql',
    '--no-psqlrc',
    '--set',
    'ON_ERROR_STOP=1',
    '--username',
    SOURCE_DATABASE_USER,
    '--dbname',
    SOURCE_DATABASE,
    '--tuples-only',
    '--no-align',
    '--quiet',
  ] as const
}

export interface GuardedReadOnlyQueryOptions {
  sql: string
  environment?: Readonly<SourceEnvironment>
  commandRunner?: SourceCommandRunner
  streamRunner?: SourceStreamRunner
}

/**
 * Run one read-only query through the fixed local source, and yield its record frames.
 *
 * This is the boundary itself, with nothing about the corpus in it: it knows the guards, the
 * process contract, the frame grammar, and the fail-closed rules, and it knows nothing about
 * articles, PMIDs, or manifests. Callers layer their own meaning on top of the `unknown` payloads.
 *
 * Everything it enforces, in order: the environment is sanitized to an allowlist; every fixed
 * Docker guard passes *before* a psql process exists; the SQL travels on stdin so it never appears
 * in a process listing; stderr is drained and never retained, because psql diagnostics echo query
 * text and the query text names the cohort; the identity frame arrives first and exactly once; the
 * completion frame arrives last and exactly once; any unframed line is fatal; a non-zero exit is
 * fatal; and an early abort kills the child rather than leaking it.
 */
export async function* streamGuardedReadOnlyQuery(
  options: GuardedReadOnlyQueryOptions,
): AsyncGenerator<unknown> {
  const environment = sanitizeSourceEnvironment(options.environment)
  const commandRunner = options.commandRunner ?? defaultCommandRunner
  const streamRunner = options.streamRunner ?? defaultStreamRunner

  await assertFixedDockerSource(commandRunner, environment)

  const sourceProcess = streamRunner('docker', buildSourcePsqlArguments(), {
    environment,
    stdin: options.sql,
  })
  const completionOutcome = sourceProcess.completion.then(
    (result) => ({ ok: true as const, result }),
    () => ({ ok: false as const }),
  )
  const stderrDrain = discard(sourceProcess.stderr)
  const lines = createInterface({ input: sourceProcess.stdout, crlfDelay: Infinity })
  let identitySeen = false
  let completionSeen = false
  let recordSeen = false
  let streamFinished = false

  try {
    for await (const line of lines) {
      if (!line) continue
      if (line.startsWith(SOURCE_IDENTITY_PREFIX)) {
        if (identitySeen || recordSeen || completionSeen) {
          throw new Error('Source identity marker was duplicated or out of order.')
        }
        assertSourceIdentity(
          parseJson(line.slice(SOURCE_IDENTITY_PREFIX.length), 'Source identity'),
        )
        identitySeen = true
        continue
      }
      if (line.startsWith(SOURCE_RECORD_PREFIX)) {
        if (!identitySeen || completionSeen) {
          throw new Error('Source record appeared outside its attested read-only stream.')
        }
        recordSeen = true
        yield parseJson(line.slice(SOURCE_RECORD_PREFIX.length), 'Source record')
        continue
      }
      if (line.startsWith(SOURCE_COMPLETE_PREFIX)) {
        if (!identitySeen || completionSeen) {
          throw new Error('Source completion marker was duplicated or out of order.')
        }
        assertSourceIdentity(
          parseJson(line.slice(SOURCE_COMPLETE_PREFIX.length), 'Source completion'),
        )
        completionSeen = true
        continue
      }
      throw new Error('Source stream returned an unexpected unframed line.')
    }

    const completion = await completionOutcome
    await stderrDrain
    streamFinished = true
    if (!completion.ok || completion.result.code !== 0) {
      throw new Error('Fixed source psql stream failed.')
    }
    if (!identitySeen || !completionSeen) {
      throw new Error('Fixed source stream ended without complete read-only attestation.')
    }
  } finally {
    lines.close()
    if (!streamFinished) sourceProcess.terminate()
    await completionOutcome
    await stderrDrain.catch(() => undefined)
  }
}

export class DockerPsqlSource implements AsyncIterable<SourceEnvelope> {
  readonly #mode: IngestMode
  readonly #canaryPmids: readonly string[] | undefined
  readonly #environment: SourceEnvironment
  readonly #commandRunner: SourceCommandRunner
  readonly #streamRunner: SourceStreamRunner

  constructor(options: DockerPsqlSourceOptions) {
    this.#mode = options.mode
    this.#canaryPmids = options.canaryPmids
    this.#environment = sanitizeSourceEnvironment(options.environment)
    this.#commandRunner = options.commandRunner ?? defaultCommandRunner
    this.#streamRunner = options.streamRunner ?? defaultStreamRunner
  }

  /**
   * The corpus read, layered on the shared boundary.
   *
   * Everything about processes, guards, frames, and fail-closed exit now lives in
   * `streamGuardedReadOnlyQuery`. What remains here is the part that is genuinely about the corpus:
   * envelope validation, lexicographic PMID ordering, and frozen-manifest membership.
   */
  async *[Symbol.asyncIterator](): AsyncIterator<SourceEnvelope> {
    const expectedCanaryPmids =
      this.#mode === 'canary' ? new Set(assertCanaryPmids(this.#canaryPmids)) : null
    const seenCanaryPmids = expectedCanaryPmids ? new Set<string>() : null
    let previousPmid: string | null = null

    for await (const payload of streamGuardedReadOnlyQuery({
      sql: buildSourceSql(this.#mode, this.#canaryPmids),
      environment: this.#environment,
      commandRunner: this.#commandRunner,
      streamRunner: this.#streamRunner,
    })) {
      const envelope = payload as SourceEnvelope
      validateSourceEnvelope(envelope)
      const pmid = envelope.article.pmid
      if (previousPmid !== null && pmid <= previousPmid) {
        throw new Error('Source PMIDs were duplicated or not in lexicographic order.')
      }
      if (expectedCanaryPmids && !expectedCanaryPmids.has(pmid)) {
        throw new Error('Source returned an article outside the frozen canary manifest.')
      }
      previousPmid = pmid
      seenCanaryPmids?.add(pmid)
      yield envelope
    }

    if (
      expectedCanaryPmids &&
      (seenCanaryPmids?.size !== expectedCanaryPmids.size ||
        [...expectedCanaryPmids].some((pmid) => !seenCanaryPmids?.has(pmid)))
    ) {
      throw new Error('Source did not return the complete frozen canary manifest.')
    }
  }
}

export function createSourceFactory(dependencies: SourceFactoryDependencies = {}): SourceFactory {
  return (mode, canaryPmids) =>
    new DockerPsqlSource({
      mode,
      canaryPmids,
      environment: dependencies.environment,
      commandRunner: dependencies.commandRunner,
      streamRunner: dependencies.streamRunner,
    })
}
