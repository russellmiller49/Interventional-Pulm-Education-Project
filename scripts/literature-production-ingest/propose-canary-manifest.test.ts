/** @jest-environment node */

/**
 * The canary-manifest proposal reads the most sensitive relation in the package, so it is held to
 * the strictest boundary in the package rather than to none.
 *
 * Before this correction it reached the local Postgres through a bare `docker exec <name> psql`
 * that ran none of the fixed-source guards: a `docker` earlier on `PATH` produced 630 synthetic
 * records and a perfectly well-formed manifest. It also forwarded an admin session cookie to that
 * child, accepted and printed a credential-shaped "seed", took an arbitrary `--out`, and wrote
 * mode-0644 through truncating, symlink-following semantics.
 *
 * The guard tests below all assert the same two things together: the read is refused, **and** no
 * psql process was ever started. A guard that fires after the query has run is not a guard.
 */

import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

import { DEVELOPMENT_SPLIT, buildCandidateSql, collectCandidates } from './canary-candidates'
import {
  EXPECTED_DEVELOPMENT_CANDIDATE_COUNT,
  SOURCE_CONTAINER,
  SOURCE_CONTAINER_ID,
  SOURCE_DATABASE,
  SOURCE_DATABASE_USER,
  SOURCE_IMAGE_ID,
  SOURCE_INTERNAL_PORT,
  SOURCE_PUBLISHED_PORT,
  SOURCE_SUPABASE_PROJECT,
} from './constants'
import {
  CANARY_MANIFEST_PROPOSAL_DIRECTORY,
  CANARY_MANIFEST_PROPOSAL_FILENAME,
  assertAcceptableSeed,
  createProposalFile,
  proposeCanaryManifest,
  readCandidates,
} from './propose-canary-manifest'
import {
  SOURCE_COMPLETE_PREFIX,
  SOURCE_IDENTITY_PREFIX,
  SOURCE_RECORD_PREFIX,
  buildSourcePsqlArguments,
  type SourceCommandRunner,
  type SourceStreamProcess,
  type SourceStreamRunner,
} from './source'

jest.setTimeout(20_000)

const ATTESTATION = {
  database: SOURCE_DATABASE,
  user: SOURCE_DATABASE_USER,
  port: SOURCE_INTERNAL_PORT,
  readOnly: true,
  isolation: 'repeatable read',
}
const CONTAINER_LINE = `${SOURCE_CONTAINER_ID}|${SOURCE_IMAGE_ID}|/${SOURCE_CONTAINER}|true|${SOURCE_PUBLISHED_PORT}|${SOURCE_SUPABASE_PROJECT}`

/** The two guard probes, answered correctly. */
function goodGuard(
  overrides: { endpoint?: string; container?: string; code?: number } = {},
): jest.MockedFunction<SourceCommandRunner> {
  let invocation = 0
  const runner: SourceCommandRunner = async () => {
    invocation += 1
    if (invocation === 1) {
      return {
        code: overrides.code ?? 0,
        stdout: `${JSON.stringify(overrides.endpoint ?? 'unix:///var/run/docker.sock')}\n`,
      }
    }
    return { code: overrides.code ?? 0, stdout: `${overrides.container ?? CONTAINER_LINE}\n` }
  }
  return jest.fn(runner)
}

/**
 * A cohort with the spread the real selector requires.
 *
 * A uniform fixture — every record with an abstract, one journal, one year — is refused by
 * `validateCanaryMixture`, and rightly so: it is not a shape the development split has.
 */
function candidateLine(pmid: string, index: number): string {
  return `${SOURCE_RECORD_PREFIX}${JSON.stringify({
    pmid,
    abstractPresent: index % 4 !== 0,
    publicationYear: 2000 + (index % 25),
    journal: `journal-${index % 17}`,
    publicationTypes: index % 3 === 0 ? ['Journal Article', 'Review'] : ['Journal Article'],
  })}\n`
}

function framed(
  count = EXPECTED_DEVELOPMENT_CANDIDATE_COUNT,
  options: { identity?: object; complete?: boolean } = {},
): SourceStreamProcess {
  const lines = [
    `${SOURCE_IDENTITY_PREFIX}${JSON.stringify(options.identity ?? ATTESTATION)}\n`,
    ...Array.from({ length: count }, (_, index) =>
      candidateLine(String(30_000_000 + index), index),
    ),
    ...(options.complete === false
      ? []
      : [`${SOURCE_COMPLETE_PREFIX}${JSON.stringify(ATTESTATION)}\n`]),
  ]
  return {
    stdout: Readable.from(lines),
    stderr: Readable.from([]),
    completion: Promise.resolve({ code: 0 }),
    terminate: jest.fn(),
  }
}

function streamRunner(process_ = () => framed()): jest.MockedFunction<SourceStreamRunner> {
  const runner: SourceStreamRunner = () => process_()
  return jest.fn(runner)
}

async function temporaryRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'canary-proposal-'))
}

/* --------------------------------------------------------------------------------------------- *
 * The fixed source boundary
 * --------------------------------------------------------------------------------------------- */

describe('the proposal reads through the fixed source boundary', () => {
  it('succeeds against the fixture source and uses the shared psql argv', async () => {
    const commandRunner = goodGuard()
    const stream = streamRunner()
    const candidates = await readCandidates({
      environment: { PATH: '/usr/bin' },
      commandRunner,
      streamRunner: stream,
    })

    expect(candidates).toHaveLength(EXPECTED_DEVELOPMENT_CANDIDATE_COUNT)
    // The identical argv the corpus read uses — including `--context default`, `--no-psqlrc`, and
    // `ON_ERROR_STOP=1`, all three of which the old hand-typed copy omitted.
    expect(stream.mock.calls[0][1]).toEqual(buildSourcePsqlArguments())
    expect(stream.mock.calls[0][0]).toBe('docker')
    // The SQL travels on stdin, so it never appears in a process listing — and the query text
    // names the cohort table.
    expect(stream.mock.calls[0][2].stdin).toBe(buildCandidateSql())
    expect(stream.mock.calls[0][1].join(' ')).not.toContain(DEVELOPMENT_SPLIT)
  })

  it.each([
    ['a substituted Docker endpoint', { endpoint: 'unix:///tmp/lookalike.sock' }],
    ['a failing docker executable', { code: 1 }],
    [
      'a wrong container id',
      {
        container: `deadbeef|${SOURCE_IMAGE_ID}|/${SOURCE_CONTAINER}|true|${SOURCE_PUBLISHED_PORT}|${SOURCE_SUPABASE_PROJECT}`,
      },
    ],
    [
      'a wrong image id',
      {
        container: `${SOURCE_CONTAINER_ID}|sha256:0000|/${SOURCE_CONTAINER}|true|${SOURCE_PUBLISHED_PORT}|${SOURCE_SUPABASE_PROJECT}`,
      },
    ],
    [
      'a wrong container name',
      {
        container: `${SOURCE_CONTAINER_ID}|${SOURCE_IMAGE_ID}|/other|true|${SOURCE_PUBLISHED_PORT}|${SOURCE_SUPABASE_PROJECT}`,
      },
    ],
    [
      'a stopped container',
      {
        container: `${SOURCE_CONTAINER_ID}|${SOURCE_IMAGE_ID}|/${SOURCE_CONTAINER}|false|${SOURCE_PUBLISHED_PORT}|${SOURCE_SUPABASE_PROJECT}`,
      },
    ],
    [
      'a wrong published port',
      {
        container: `${SOURCE_CONTAINER_ID}|${SOURCE_IMAGE_ID}|/${SOURCE_CONTAINER}|true|9999|${SOURCE_SUPABASE_PROJECT}`,
      },
    ],
    [
      'a wrong Supabase project label',
      {
        container: `${SOURCE_CONTAINER_ID}|${SOURCE_IMAGE_ID}|/${SOURCE_CONTAINER}|true|${SOURCE_PUBLISHED_PORT}|someone-elses-project`,
      },
    ],
  ])('refuses %s before any psql process starts', async (_label, overrides) => {
    const stream = streamRunner()
    await expect(
      readCandidates({
        environment: { PATH: '/usr/bin' },
        commandRunner: goodGuard(overrides),
        streamRunner: stream,
      }),
    ).rejects.toThrow()
    // The load-bearing assertion: a fake `docker` never got as far as producing records.
    expect(stream).not.toHaveBeenCalled()
  })

  it('refuses a stream that did not attest a read-only repeatable-read transaction', async () => {
    await expect(
      readCandidates({
        environment: { PATH: '/usr/bin' },
        commandRunner: goodGuard(),
        streamRunner: streamRunner(() =>
          framed(1, { identity: { ...ATTESTATION, readOnly: false } }),
        ),
      }),
    ).rejects.toThrow(/read-only/u)
  })

  it('refuses a stream whose isolation level is not repeatable read', async () => {
    await expect(
      readCandidates({
        environment: { PATH: '/usr/bin' },
        commandRunner: goodGuard(),
        streamRunner: streamRunner(() =>
          framed(1, { identity: { ...ATTESTATION, isolation: 'read committed' } }),
        ),
      }),
    ).rejects.toThrow(/identity or read-only transaction attestation failed/u)
  })

  it('refuses a truncated stream, which is how a partial cohort would arrive', async () => {
    await expect(
      readCandidates({
        environment: { PATH: '/usr/bin' },
        commandRunner: goodGuard(),
        streamRunner: streamRunner(() =>
          framed(EXPECTED_DEVELOPMENT_CANDIDATE_COUNT, { complete: false }),
        ),
      }),
    ).rejects.toThrow(/without complete read-only attestation/u)
  })

  it('issues a read-only transaction that rolls back', () => {
    const sql = buildCandidateSql()
    expect(sql).toContain('begin transaction isolation level repeatable read read only')
    expect(sql.trimEnd().endsWith('rollback;')).toBe(true)
  })
})

/* --------------------------------------------------------------------------------------------- *
 * Child environment
 * --------------------------------------------------------------------------------------------- */

describe('the child receives an allowlisted environment and nothing else', () => {
  it('forwards none of the cookie, session, token, or secret classes', async () => {
    /*
     * Each value is recognisable, and each class is one the previous denylist did not cover —
     * `LITERATURE_VERIFY_ADMIN_COOKIE` matched neither the operational nor the credential pattern
     * and was forwarded verbatim to a `docker exec` child that has no use for it.
     */
    const forbidden = {
      LITERATURE_VERIFY_ADMIN_COOKIE: 'COOKIE-SENTINEL-aaa',
      COOKIE: 'COOKIE-SENTINEL-bbb',
      SESSION_ID: 'SESSION-SENTINEL-ccc',
      AUTHORIZATION: 'AUTH-SENTINEL-ddd',
      GITHUB_TOKEN: 'TOKEN-SENTINEL-eee',
      LITERATURE_SUPABASE_SECRET_KEY: 'sb_secret_SENTINEL-fff',
      LITERATURE_SUPABASE_URL: 'https://itcttmkxdxvwmwcmzmey.supabase.co/',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_SENTINEL-ggg',
      PGPASSWORD: 'PASSWORD-SENTINEL-hhh',
      AWS_SECRET_ACCESS_KEY: 'SECRET-SENTINEL-iii',
      LITERATURE_ANYTHING_AT_ALL: 'LITERATURE-SENTINEL-jjj',
      DOCKER_HOST: 'tcp://attacker.example:2375',
    }
    const commandRunner = goodGuard()
    const stream = streamRunner()
    await readCandidates({
      environment: { PATH: '/usr/bin', HOME: '/home/reviewer', ...forbidden },
      commandRunner,
      streamRunner: stream,
    })

    const childEnvironments = [
      ...commandRunner.mock.calls.map((call) => call[2].environment),
      ...stream.mock.calls.map((call) => call[2].environment),
    ]
    expect(childEnvironments.length).toBeGreaterThan(0)
    for (const environment of childEnvironments) {
      expect(environment).toEqual({ PATH: '/usr/bin', HOME: '/home/reviewer' })
      const serialized = JSON.stringify(environment)
      for (const sentinel of Object.values(forbidden)) {
        expect(serialized).not.toContain(sentinel)
      }
      for (const name of Object.keys(forbidden)) {
        expect(Object.keys(environment)).not.toContain(name)
      }
    }
  })
})

/* --------------------------------------------------------------------------------------------- *
 * The seed
 * --------------------------------------------------------------------------------------------- */

describe('the seed is a non-secret identifier', () => {
  it.each([['canary-2026-08'], ['owner.review.1'], ['abc'], ['a_b-c.d']])('accepts %s', (seed) => {
    expect(() => assertAcceptableSeed(seed)).not.toThrow()
  })

  it.each([
    ['a Supabase secret key', 'sb_secret_abcdefghijklmnop'],
    ['a Supabase publishable key', 'sb_publishable_abcdefghijkl'],
    ['a JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop'],
    ['bearer text', 'bearer abcdefghijklmnop'],
    ['a URL with credentials', 'https://user:pw@example.com/x'],
    ['password vocabulary', 'my-password-value'],
    ['token vocabulary', 'review-token-42'],
    ['a path separator', '../../etc/passwd'],
    ['a control character', 'seed value'],
    ['an overlong value', 'a'.repeat(200)],
    ['an empty value', ''],
    ['uppercase, which no identifier here uses', 'SEED-VALUE'],
  ])('rejects %s', (_label, seed) => {
    expect(() => assertAcceptableSeed(seed)).toThrow()
  })

  it('never echoes a rejected seed', () => {
    const secret = 'sb_secret_do-not-print-me-ever'
    try {
      assertAcceptableSeed(secret)
      throw new Error('expected a refusal')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      expect(message).not.toContain(secret)
      expect(message).not.toContain('do-not-print-me-ever')
      expect(message).toMatch(/not echoed/u)
    }
  })
})

/* --------------------------------------------------------------------------------------------- *
 * The output path
 * --------------------------------------------------------------------------------------------- */

describe('the proposal is written to one fixed, private path', () => {
  const roots: string[] = []
  afterAll(async () => {
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
  })
  async function root(): Promise<string> {
    const created = await temporaryRoot()
    roots.push(created)
    return created
  }

  it('creates the directory 0700 and the file 0600', async () => {
    const repositoryRoot = await root()
    const written = await createProposalFile(repositoryRoot, '{"pmids":[]}\n')

    expect(written).toBe(
      join(
        await realpath(repositoryRoot),
        CANARY_MANIFEST_PROPOSAL_DIRECTORY,
        CANARY_MANIFEST_PROPOSAL_FILENAME,
      ),
    )
    const fileMode = (await stat(written)).mode & 0o777
    const directoryMode =
      (await stat(join(repositoryRoot, CANARY_MANIFEST_PROPOSAL_DIRECTORY))).mode & 0o777
    expect(fileMode).toBe(0o600)
    expect(directoryMode).toBe(0o700)
    expect(await readFile(written, 'utf8')).toBe('{"pmids":[]}\n')
  })

  it('refuses to overwrite an existing proposal', async () => {
    const repositoryRoot = await root()
    await createProposalFile(repositoryRoot, 'first\n')
    await expect(createProposalFile(repositoryRoot, 'second\n')).rejects.toThrow(/already exists/u)
    // Not truncated, not replaced: an owner may already have pinned its checksum.
    expect(
      await readFile(
        join(repositoryRoot, CANARY_MANIFEST_PROPOSAL_DIRECTORY, CANARY_MANIFEST_PROPOSAL_FILENAME),
        'utf8',
      ),
    ).toBe('first\n')
  })

  it('refuses a symlinked destination instead of following it', async () => {
    const repositoryRoot = await root()
    const elsewhere = join(repositoryRoot, 'elsewhere.json')
    await writeFile(elsewhere, 'untouched\n', 'utf8')
    const directory = join(repositoryRoot, CANARY_MANIFEST_PROPOSAL_DIRECTORY)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await symlink(elsewhere, join(directory, CANARY_MANIFEST_PROPOSAL_FILENAME))

    await expect(createProposalFile(repositoryRoot, 'cohort\n')).rejects.toThrow(/already exists/u)
    // The symlink target is untouched: `wx` never follows an existing link.
    expect(await readFile(elsewhere, 'utf8')).toBe('untouched\n')
    expect((await lstat(join(directory, CANARY_MANIFEST_PROPOSAL_FILENAME))).isSymbolicLink()).toBe(
      true,
    )
  })

  it('refuses a symlinked parent directory', async () => {
    const repositoryRoot = await root()
    const decoy = join(repositoryRoot, 'decoy')
    await mkdir(decoy, { recursive: true })
    await mkdir(join(repositoryRoot, 'local-data'), { recursive: true })
    await symlink(decoy, join(repositoryRoot, CANARY_MANIFEST_PROPOSAL_DIRECTORY))

    await expect(createProposalFile(repositoryRoot, 'cohort\n')).rejects.toThrow(
      /symbolic link|canonicalize/u,
    )
  })
})

/* --------------------------------------------------------------------------------------------- *
 * The command surface
 * --------------------------------------------------------------------------------------------- */

describe('the command refuses an arbitrary destination and never prints a PMID', () => {
  const roots: string[] = []
  afterAll(async () => {
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
  })

  async function runCommand(argv: readonly string[]) {
    const repositoryRoot = await temporaryRoot()
    roots.push(repositoryRoot)
    const lines: string[] = []
    await proposeCanaryManifest(argv, {
      repositoryRoot,
      environment: { PATH: '/usr/bin' },
      commandRunner: goodGuard(),
      streamRunner: streamRunner(),
      write: (line) => lines.push(line),
    })
    return { repositoryRoot, output: lines.join('\n') }
  }

  it.each([['--out'], ['--output'], ['--path'], ['--dir'], ['--destination']])(
    'rejects %s',
    async (flag) => {
      await expect(
        proposeCanaryManifest(['--seed', 'canary-1', flag, '/tmp/anywhere.json'], {
          repositoryRoot: '/tmp',
          environment: { PATH: '/usr/bin' },
          commandRunner: goodGuard(),
          streamRunner: streamRunner(),
          write: () => undefined,
        }),
      ).rejects.toThrow(/is not accepted/u)
    },
  )

  it('writes the selection to the fixed path and prints no PMID', async () => {
    const { repositoryRoot, output } = await runCommand(['--seed', 'canary-2026-08'])

    const written = join(
      await realpath(repositoryRoot),
      CANARY_MANIFEST_PROPOSAL_DIRECTORY,
      CANARY_MANIFEST_PROPOSAL_FILENAME,
    )
    const manifest = JSON.parse(await readFile(written, 'utf8')) as { pmids: string[] }
    expect(manifest.pmids).toHaveLength(25)

    // The whole point of the file: the identifiers live there and nowhere else.
    for (const pmid of manifest.pmids) {
      expect(output).not.toContain(pmid)
    }
    expect(output).toMatch(/deliberately not printed/u)
    expect(output).toContain('canary-2026-08')
  })

  it('refuses a credential-shaped seed before reading anything, without echoing it', async () => {
    // Two gates catch this: the package's existing credential-argument guard, and the seed grammar
    // behind it. Either refusal is correct; what must hold is that nothing is read and the value
    // is not echoed.
    const secret = 'sb_secret_abcdefghijklmnop'
    const stream = streamRunner()
    let message = ''
    await proposeCanaryManifest(['--seed', secret], {
      repositoryRoot: '/tmp',
      environment: { PATH: '/usr/bin' },
      commandRunner: goodGuard(),
      streamRunner: stream,
      write: () => undefined,
    }).catch((error: unknown) => {
      message = error instanceof Error ? error.message : String(error)
    })
    expect(message).not.toBe('')
    expect(message).not.toContain(secret)
    expect(stream).not.toHaveBeenCalled()
  })

  it('refuses a non-credential seed that is still not a bounded identifier', async () => {
    const stream = streamRunner()
    await expect(
      proposeCanaryManifest(['--seed', 'Seed With Spaces'], {
        repositoryRoot: '/tmp',
        environment: { PATH: '/usr/bin' },
        commandRunner: goodGuard(),
        streamRunner: stream,
        write: () => undefined,
      }),
    ).rejects.toThrow(/rejected/u)
    expect(stream).not.toHaveBeenCalled()
  })

  it('refuses a flag whose value is missing', async () => {
    await expect(
      proposeCanaryManifest(['--seed'], {
        repositoryRoot: '/tmp',
        environment: { PATH: '/usr/bin' },
        commandRunner: goodGuard(),
        streamRunner: streamRunner(),
        write: () => undefined,
      }),
    ).rejects.toThrow(/requires a value/u)
  })
})

/* --------------------------------------------------------------------------------------------- *
 * The cohort projection itself
 * --------------------------------------------------------------------------------------------- */

describe('the collected cohort remains bibliography-only and exact', () => {
  it('refuses a partial cohort', () => {
    expect(() => collectCandidates([])).toThrow(/exactly 630/u)
  })
})
