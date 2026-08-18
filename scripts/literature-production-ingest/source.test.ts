/** @jest-environment node */

import { PassThrough, Readable } from 'node:stream'

import {
  ARTICLE_SELECT_COLUMNS,
  DEFAULT_CANARY_SIZE,
  DESTINATION_ENV_NAMES,
  SOURCE_CONTAINER,
  SOURCE_CONTAINER_ID,
  SOURCE_DATABASE,
  SOURCE_DATABASE_USER,
  SOURCE_INTERNAL_PORT,
  SOURCE_IMAGE_ID,
  SOURCE_PUBLISHED_PORT,
  SOURCE_SUPABASE_PROJECT,
} from './constants'
import {
  buildSourceSql,
  createSourceFactory,
  DockerPsqlSource,
  sanitizeSourceEnvironment,
  SOURCE_COMPLETE_PREFIX,
  SOURCE_DOCKER_CONTEXT,
  SOURCE_IDENTITY_PREFIX,
  SOURCE_RECORD_PREFIX,
  type SourceCommandRunner,
  type SourceEnvironment,
  type SourceStreamProcess,
  type SourceStreamRunner,
} from './source'
import { fixtureEnvelope } from './test-fixtures'
import type { SourceEnvelope } from './types'

const CANARY_PMIDS = Array.from({ length: DEFAULT_CANARY_SIZE }, (_, index) =>
  String(10_000 + index),
)

function identityLine(): string {
  return `${SOURCE_IDENTITY_PREFIX}${JSON.stringify({
    database: SOURCE_DATABASE,
    user: SOURCE_DATABASE_USER,
    port: SOURCE_INTERNAL_PORT,
    readOnly: true,
    isolation: 'repeatable read',
  })}\n`
}

function recordLine(envelope: SourceEnvelope): string {
  return `${SOURCE_RECORD_PREFIX}${JSON.stringify(envelope)}\n`
}

function completionLine(): string {
  // The completion frame now carries the same full attestation payload as the identity frame, and
  // one assertion reads both. It used to carry `readOnly` alone, which is how the candidate query
  // came to attest a third, different subset of the same facts.
  return `${SOURCE_COMPLETE_PREFIX}${JSON.stringify({
    database: SOURCE_DATABASE,
    user: SOURCE_DATABASE_USER,
    port: SOURCE_INTERNAL_PORT,
    readOnly: true,
    isolation: 'repeatable read',
  })}\n`
}

function fixedGuardRunner(
  containerOutput = `${SOURCE_CONTAINER_ID}|${SOURCE_IMAGE_ID}|/${SOURCE_CONTAINER}|true|${SOURCE_PUBLISHED_PORT}|${SOURCE_SUPABASE_PROJECT}`,
): jest.MockedFunction<SourceCommandRunner> {
  let invocation = 0
  const runner: SourceCommandRunner = async () => {
    invocation += 1
    if (invocation === 1) return { code: 0, stdout: '"unix:///var/run/docker.sock"\n' }
    return { code: 0, stdout: `${containerOutput}\n` }
  }
  return jest.fn(runner)
}

function framedProcess(
  envelopes: readonly SourceEnvelope[],
  options: { complete?: boolean; code?: number } = {},
): SourceStreamProcess {
  const lines = [identityLine(), ...envelopes.map(recordLine)]
  if (options.complete !== false) lines.push(completionLine())
  return {
    stdout: Readable.from(lines),
    stderr: Readable.from([]),
    completion: Promise.resolve({ code: options.code ?? 0 }),
    terminate: jest.fn(),
  }
}

async function collect(source: AsyncIterable<SourceEnvelope>): Promise<SourceEnvelope[]> {
  const rows: SourceEnvelope[] = []
  for await (const row of source) rows.push(row)
  return rows
}

describe('fixed read-only Docker psql source', () => {
  it('builds only an explicit, deterministic, repeatable-read bibliographic projection', () => {
    const sql = buildSourceSql('full')

    expect(sql).toContain('begin transaction isolation level repeatable read read only;')
    expect(sql).toContain('from public.literature_articles as article')
    expect(sql).toContain(
      'left join public.literature_journals as journal on journal.id = article.journal_id',
    )
    expect(sql).toContain('order by article.pmid collate "C" asc;')
    expect(sql).toContain('rollback;')
    for (const column of ARTICLE_SELECT_COLUMNS) {
      expect(sql).toContain(`'${column}', article.${column}`)
    }
    for (const journalColumn of [
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
    ]) {
      expect(sql).toContain(`'${journalColumn}', journal.${journalColumn}`)
    }
    expect(sql).not.toMatch(/\bselect\s+\*/iu)
    expect(sql).not.toMatch(/\b(?:insert|update|delete|truncate|alter|drop|create)\b/iu)
    expect(sql).not.toMatch(/\b(?:cohort|gold|review|label|dataset_split)\b/iu)
  })

  it('limits canary reads to exactly the frozen manifest IDs and no cohort relation', () => {
    const unsorted = [...CANARY_PMIDS].reverse()
    const sql = buildSourceSql('canary', unsorted)
    const pmidClause = sql.match(/where article\.pmid in \(([^)]+)\)/u)?.[1]

    expect(pmidClause).toBe(CANARY_PMIDS.map((pmid) => `'${pmid}'`).join(', '))
    expect(sql).not.toMatch(/\b(?:cohort|gold|review|label|dataset_split)\b/iu)
    expect(() => buildSourceSql('canary', CANARY_PMIDS.slice(1))).toThrow(
      `exactly ${DEFAULT_CANARY_SIZE}`,
    )
    expect(() => buildSourceSql('canary', [...CANARY_PMIDS.slice(0, -1), CANARY_PMIDS[0]])).toThrow(
      'duplicate PMIDs',
    )
    expect(() => buildSourceSql('full', CANARY_PMIDS)).toThrow('must not receive canary PMIDs')
  })

  it('removes remote configuration and credentials from every Docker child environment', () => {
    const environment = sanitizeSourceEnvironment({
      PATH: '/usr/bin',
      HOME: '/synthetic-home',
      DOCKER_HOST: 'tcp://arbitrary.example.invalid:2375',
      PGHOST: 'arbitrary.example.invalid',
      DATABASE_URL: 'postgres://user:credential@example.invalid/database',
      [DESTINATION_ENV_NAMES.url]: 'https://example.invalid/',
      [DESTINATION_ENV_NAMES.projectRef]: 'wrong-project',
      [DESTINATION_ENV_NAMES.secret]: 'destination-secret-value',
      THIRD_PARTY_API_KEY: 'third-party-secret-value',
    })

    expect(environment).toEqual({ PATH: '/usr/bin', HOME: '/synthetic-home' })
    expect(Object.values(environment).join(' ')).not.toContain('secret-value')
    expect(Object.values(environment).join(' ')).not.toContain('example.invalid')
  })

  it('guards the exact container identity, streams records, and never passes configuration via arguments', async () => {
    const commandRunner = fixedGuardRunner()
    let invocation:
      | {
          command: string
          arguments_: readonly string[]
          environment: SourceEnvironment
          stdin: string
        }
      | undefined
    const streamRunner: SourceStreamRunner = (command, arguments_, options) => {
      invocation = { command, arguments_, environment: options.environment, stdin: options.stdin }
      return framedProcess(CANARY_PMIDS.map((pmid) => fixtureEnvelope(pmid)))
    }
    const sourceFactory = createSourceFactory({
      environment: {
        PATH: '/usr/bin',
        DATABASE_URL: 'postgres://forbidden.invalid/database',
        [DESTINATION_ENV_NAMES.secret]: 'do-not-forward',
      },
      commandRunner,
      streamRunner,
    })

    const rows = await collect(sourceFactory('canary', CANARY_PMIDS))

    expect(rows.map((row) => row.article.pmid)).toEqual(CANARY_PMIDS)
    expect(commandRunner).toHaveBeenCalledTimes(2)
    expect(commandRunner.mock.calls[0]?.[0]).toBe('docker')
    expect(commandRunner.mock.calls[0]?.[1]).toEqual([
      'context',
      'inspect',
      SOURCE_DOCKER_CONTEXT,
      '--format',
      '{{json .Endpoints.docker.Host}}',
    ])
    expect(invocation).toBeDefined()
    expect(invocation?.command).toBe('docker')
    expect(invocation?.arguments_).toEqual([
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
    ])
    expect(invocation?.environment).toEqual({ PATH: '/usr/bin' })
    expect(invocation?.stdin).toBe(buildSourceSql('canary', CANARY_PMIDS))
    expect(invocation?.arguments_.join(' ')).not.toContain('do-not-forward')
    expect(invocation?.arguments_.join(' ')).not.toContain('forbidden.invalid')
  })

  it('yields a record before process completion instead of buffering the source corpus', async () => {
    const stdout = new PassThrough()
    let resolveCompletion: ((result: { code: number }) => void) | undefined
    let completionResolved = false
    const completion = new Promise<{ code: number }>((resolvePromise) => {
      resolveCompletion = (result) => {
        completionResolved = true
        resolvePromise(result)
      }
    })
    const terminate = jest.fn(() => {
      stdout.end()
      resolveCompletion?.({ code: -1 })
    })
    const streamRunner: SourceStreamRunner = () => ({
      stdout,
      stderr: Readable.from([]),
      completion,
      terminate,
    })
    const source = new DockerPsqlSource({
      mode: 'full',
      environment: { PATH: '/usr/bin' },
      commandRunner: fixedGuardRunner(),
      streamRunner,
    })
    const iterator = source[Symbol.asyncIterator]()
    const firstPromise = iterator.next()
    stdout.write(identityLine())
    stdout.write(recordLine(fixtureEnvelope('10001')))

    const first = await firstPromise

    expect(first.done).toBe(false)
    expect(first.value?.article.pmid).toBe('10001')
    expect(completionResolved).toBe(false)
    stdout.write(completionLine())
    stdout.end()
    resolveCompletion?.({ code: 0 })
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true })
    expect(terminate).not.toHaveBeenCalled()
  })

  it('does not retain full-mode PMID identities in a corpus-sized Set', async () => {
    const pmids = ['10101', '10102']
    const retainedPmids: string[] = []
    const originalAdd = Set.prototype.add
    const addSpy = jest.spyOn(Set.prototype, 'add').mockImplementation(function (
      this: Set<unknown>,
      value: unknown,
    ) {
      if (typeof value === 'string' && pmids.includes(value)) retainedPmids.push(value)
      return originalAdd.call(this, value)
    })
    try {
      const source = new DockerPsqlSource({
        mode: 'full',
        environment: { PATH: '/usr/bin' },
        commandRunner: fixedGuardRunner(),
        streamRunner: () => framedProcess(pmids.map((pmid) => fixtureEnvelope(pmid))),
      })
      await expect(collect(source)).resolves.toHaveLength(2)
    } finally {
      addSpy.mockRestore()
    }

    expect(retainedPmids).toEqual([])
  })

  it('requires the exact approved local Docker endpoint', async () => {
    let invocation = 0
    const commandRunner = jest.fn<ReturnType<SourceCommandRunner>, Parameters<SourceCommandRunner>>(
      async () => {
        invocation += 1
        return invocation === 1
          ? { code: 0, stdout: '"unix:///tmp/lookalike.sock"\n' }
          : { code: 0, stdout: '' }
      },
    )
    const streamRunner = jest.fn<ReturnType<SourceStreamRunner>, Parameters<SourceStreamRunner>>()
    const source = new DockerPsqlSource({
      mode: 'full',
      environment: { PATH: '/usr/bin' },
      commandRunner,
      streamRunner,
    })

    await expect(collect(source)).rejects.toThrow('endpoint identity')
    expect(streamRunner).not.toHaveBeenCalled()
  })

  it('rejects wrong source identity before opening psql', async () => {
    const streamRunner = jest.fn<ReturnType<SourceStreamRunner>, Parameters<SourceStreamRunner>>()
    const source = new DockerPsqlSource({
      mode: 'full',
      environment: { PATH: '/usr/bin' },
      commandRunner: fixedGuardRunner(
        `${SOURCE_CONTAINER_ID}|${SOURCE_IMAGE_ID}|/${SOURCE_CONTAINER}|true|9999|${SOURCE_SUPABASE_PROJECT}`,
      ),
      streamRunner,
    })

    await expect(collect(source)).rejects.toThrow('container identity')
    expect(streamRunner).not.toHaveBeenCalled()
  })

  it('stops on duplicated ordering, incomplete acknowledgement, and process failure without retry', async () => {
    const duplicatedStream = jest.fn(() =>
      framedProcess([fixtureEnvelope('10001'), fixtureEnvelope('10001')]),
    )
    await expect(
      collect(
        new DockerPsqlSource({
          mode: 'full',
          environment: { PATH: '/usr/bin' },
          commandRunner: fixedGuardRunner(),
          streamRunner: duplicatedStream,
        }),
      ),
    ).rejects.toThrow('duplicated or not in lexicographic order')
    expect(duplicatedStream).toHaveBeenCalledTimes(1)

    const incompleteStream = jest.fn(() =>
      framedProcess([fixtureEnvelope('10001')], { complete: false }),
    )
    await expect(
      collect(
        new DockerPsqlSource({
          mode: 'full',
          environment: { PATH: '/usr/bin' },
          commandRunner: fixedGuardRunner(),
          streamRunner: incompleteStream,
        }),
      ),
    ).rejects.toThrow('without complete read-only attestation')
    expect(incompleteStream).toHaveBeenCalledTimes(1)

    const failedStream = jest.fn(() => framedProcess([], { complete: false, code: 1 }))
    await expect(
      collect(
        new DockerPsqlSource({
          mode: 'full',
          environment: { PATH: '/usr/bin' },
          commandRunner: fixedGuardRunner(),
          streamRunner: failedStream,
        }),
      ),
    ).rejects.toThrow('psql stream failed')
    expect(failedStream).toHaveBeenCalledTimes(1)
  })
})
