/** @jest-environment node */

/**
 * Third review, finding 1 — every supported CLI invocation exits nonzero.
 *
 * The defect: `preflight.ts --print-query-plans` returned from `main()` *before* the trailing
 * `process.exitCode = 1`, so that one invocation exited 0. A shell `&&` chain, a CI step, or a
 * `set -e` script would have read a query-plan dump as a passing preflight.
 *
 * These are **subprocess** tests: they spawn the real CLIs through the same `tsx` loader that
 * `npm run literature:dedicated:preflight` uses, and assert on the actual process exit status and
 * the actual stdout. Source-scanning would not have caught the original defect; running it does.
 *
 * Fourth review, finding 4 — this suite previously widened the Jest timeout to 120 s. That is
 * gone: every invocation runs inside Jest's ordinary default test budget, and a hung child is
 * contained by the wrapper's own timeout/kill mechanism (`CHILD_TIMEOUT_MS` below), which is
 * itself exercised by adversarial hanging-child tests at the bottom of the suite.
 *
 * Fifth review, finding 2 — containment reaches the whole process **tree**, not just the direct
 * child. `spawn`'s built-in `timeout` option signals only the process it started, and the real
 * preflight spawns `git` subprocesses; a wedged CLI could therefore be killed while its `git`
 * descendant kept running, holding pipes and doing work after the test that "contained" it had
 * finished. Each CLI now runs in an **operation-owned process group** (`detached`, which makes the
 * child a group leader on POSIX so every descendant it spawns joins that group), and the timeout
 * signals the group — `process.kill(-pid, …)` — with an explicit direct-child fallback where
 * process groups are unavailable or the group signal cannot be delivered.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { LITERATURE_CATALOG_SECTIONS } from './lib/foundation-catalog'
import {
  LITERATURE_POSTFLIGHT_QUERY_PLAN_SHA256,
  LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256,
} from './lib/target-observation'

const ROOT = process.cwd()
const PREFLIGHT = 'scripts/literature-dedicated-supabase/preflight.ts'
const POSTFLIGHT = 'scripts/literature-dedicated-supabase/postflight.ts'

/**
 * Containment timeout for one CLI child process — a hung-process guard, not a performance
 * guarantee.
 *
 * Measured before choosing (Node 20, tsx 4.7, this repository): one direct
 * `node --import tsx preflight.ts` invocation completes in ≈0.09–0.12 s, and eight simultaneous
 * invocations complete in ≈0.21 s each. 4 000 ms is ≈19× the contended measurement while staying
 * below Jest's ordinary 5 000 ms per-test default, so a child that hits it is genuinely wedged:
 * it is SIGKILLed, the test fails with a controlled message, and nothing is left behind.
 */
const CHILD_TIMEOUT_MS = 4_000
const CHILD_KILL_SIGNAL = 'SIGKILL' as const
/** Bound captured output so a runaway child cannot balloon test memory. */
const MAX_CAPTURED_OUTPUT_CHARACTERS = 1_000_000

/**
 * Whether this platform has POSIX process groups. `detached` makes the child a process-group
 * leader here, and a signal sent to the negated PID reaches every process in that group. Windows
 * has no equivalent, so the wrapper falls back to signalling the direct child explicitly.
 */
const HAS_POSIX_PROCESS_GROUPS = process.platform !== 'win32'

interface CommandResult {
  code: number | null
  signal: NodeJS.Signals | null
  pid: number | undefined
  stdout: string
  stderr: string
  /** True when the containment timeout fired, whatever the child then reported. */
  timedOut: boolean
}

/**
 * Terminate the operation-owned process group, so a descendant such as `git` cannot outlive the
 * CLI that spawned it. Falls back to the direct child when process groups are unavailable
 * (Windows) or the group signal cannot be delivered.
 */
function terminateProcessTree(child: ChildProcess): void {
  const pid = child.pid
  let groupSignalled = false
  if (HAS_POSIX_PROCESS_GROUPS && pid !== undefined) {
    try {
      // The negated PID addresses the whole group this child leads — the CLI and every
      // descendant it started — in one signal.
      process.kill(-pid, CHILD_KILL_SIGNAL)
      groupSignalled = true
    } catch {
      // ESRCH (already gone) or EPERM: fall through to the explicit direct-child kill.
      groupSignalled = false
    }
  }
  if (!groupSignalled) child.kill(CHILD_KILL_SIGNAL)
}

/**
 * Spawn one contained child: no shell, bounded output capture, its own process group, and a hard
 * kill of that whole group once `timeoutMs` elapses. The containment timer is cleared when the
 * child closes and is `unref`ed besides, so it can neither leak nor hold the runner open. A killed
 * child surfaces as `code: null` plus the kill signal, which every assertion path treats as a
 * controlled failure — never as success.
 */
function runContained(
  command: string,
  argumentList: readonly string[],
  timeoutMs: number,
): Promise<CommandResult> {
  return new Promise((settle, fail) => {
    const child = spawn(command, argumentList, {
      cwd: ROOT,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      // Operation-owned process group. Deliberately *not* `spawn`'s own `timeout` option: that
      // signals only this process, leaving any descendant it spawned alive (fifth review).
      detached: HAS_POSIX_PROCESS_GROUPS,
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const containment = setTimeout(() => {
      timedOut = true
      terminateProcessTree(child)
    }, timeoutMs)
    // Belt and braces with the clearTimeout below: an unref'ed timer never keeps the loop alive.
    containment.unref()
    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < MAX_CAPTURED_OUTPUT_CHARACTERS) stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < MAX_CAPTURED_OUTPUT_CHARACTERS) stderr += chunk.toString('utf8')
    })
    child.on('error', (error) => {
      clearTimeout(containment)
      fail(error)
    })
    child.on('close', (code, signal) => {
      clearTimeout(containment)
      settle({ code, signal, pid: child.pid, stdout, stderr, timedOut })
    })
  })
}

/**
 * Run one real CLI invocation. `node --import tsx` is the same loader the `tsx` binary wraps (and
 * what the npm scripts resolve to), invoked directly so the spawned process IS the process doing
 * the work rather than a shell wrapper around it.
 *
 * That alone is not containment, though: the preflight itself spawns `git` (see
 * `gatherRepositoryFacts`), so the invocation is a small process *tree*. It is spawned into its
 * own group and the timeout kills the group, so no descendant can outlive the invocation.
 */
function runCli(script: string, argumentList: readonly string[]): Promise<CommandResult> {
  return runContained(
    process.execPath,
    ['--import', 'tsx', script, ...argumentList],
    CHILD_TIMEOUT_MS,
  )
}

/**
 * Tokens that would mean this repository had claimed authority it does not have. `proceed` is
 * matched as a whole word so ordinary prose ("do not proceed") is not mistaken for the removed
 * next-action name.
 */
const FORBIDDEN_OUTPUT_PATTERNS: readonly [string, RegExp][] = [
  ['ready_to_apply', /ready_to_apply/u],
  ['applied_correct', /applied_correct/u],
  ['applied_drifted', /applied_drifted/u],
  ['an attested status', /attested/u],
  ['a proceed next action', /nextAction:\s*proceed\b/u],
  ['authoritative: true', /authoritative"?:\s*true/u],
]

function expectNoAuthoritativeSuccess(result: CommandResult) {
  const output = `${result.stdout}\n${result.stderr}`
  for (const [label, pattern] of FORBIDDEN_OUTPUT_PATTERNS) {
    if (pattern.test(output)) throw new Error(`CLI output contained ${label}`)
  }
}

function expectBlocked(result: CommandResult) {
  if (result.code === null) {
    // The containment guard killed a wedged child. A controlled failure, never a success.
    throw new Error(
      `CLI invocation did not exit on its own within ${CHILD_TIMEOUT_MS} ms and was killed ` +
        `(signal: ${String(result.signal)})`,
    )
  }
  expect(result.code).not.toBe(0)
  expect(result.code).toBeGreaterThan(0)
  expectNoAuthoritativeSuccess(result)
}

let temporaryRoot = ''
let validPreflightEvidence = ''
let validPostflightEvidence = ''
let invalidEvidence = ''

/**
 * Credential-shaped keys repeated inside the duplicate-key evidence documents, and the value each
 * carries. None may appear in a thrown error, in stdout, or in stderr (fifth review, finding 1).
 */
const DUPLICATE_KEY_SPELLINGS: [string, string][] = [
  ['a secret-prefixed key', 'sb_secret_LEAKED_FROM_A_DUPLICATE_KEY'],
  ['a JWT-shaped key', 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.LEAKEDSIG'],
  ['a connection-string key', 'postgresql://postgres:LEAKEDPASSWORD@db.example.com:5432/x'],
]
const DUPLICATE_KEY_VALUE = 'LEAKEDVALUEfromTheDuplicateMember'
/** Written in `beforeAll`, one document per spelling above, keyed by the spelling. */
const duplicateKeyEvidence = new Map<string, string>()

beforeAll(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'literature-cli-exit-'))

  const catalog = Object.fromEntries(
    LITERATURE_CATALOG_SECTIONS.map((section) => [section, [] as unknown[]]),
  )
  catalog.roleAttributes = [
    { role: 'anon', superuser: false, bypassRls: false, canLogin: false, inherit: false },
    { role: 'authenticated', superuser: false, bypassRls: false, canLogin: false, inherit: false },
    { role: 'service_role', superuser: false, bypassRls: true, canLogin: false, inherit: false },
  ]
  const prerequisites = {
    availableExtensions: ['pg_trgm'],
    roles: ['anon', 'authenticated', 'service_role'],
    schemas: ['extensions', 'public'],
  }

  validPreflightEvidence = join(temporaryRoot, 'preflight-evidence.json')
  await writeFile(
    validPreflightEvidence,
    JSON.stringify({
      schemaVersion: 'literature-dedicated-preflight-observation/3.0.0',
      queryPlanSha256: LITERATURE_PREFLIGHT_QUERY_PLAN_SHA256,
      migrationHistory: { tableExists: false, versions: null },
      catalog,
      prerequisites,
    }),
    'utf8',
  )

  validPostflightEvidence = join(temporaryRoot, 'postflight-evidence.json')
  await writeFile(
    validPostflightEvidence,
    JSON.stringify({
      schemaVersion: 'literature-dedicated-postflight-observation/3.0.0',
      queryPlanSha256: LITERATURE_POSTFLIGHT_QUERY_PLAN_SHA256,
      existenceProbe: { migrationHistoryTableExists: true, presentLiteratureTables: [] },
      migrationVersions: [],
      catalog,
      prerequisites,
      totalRowCount: 0,
    }),
    'utf8',
  )

  invalidEvidence = join(temporaryRoot, 'invalid-evidence.json')
  await writeFile(invalidEvidence, '{"schemaVersion": "not-a-known-schema", "catalog": 5}', 'utf8')

  // Documents whose only defect is a repeated, credential-shaped key. `JSON.stringify` cannot
  // produce a duplicate member, so the text is assembled directly.
  for (const [, spelling] of DUPLICATE_KEY_SPELLINGS) {
    const path = join(temporaryRoot, `duplicate-key-${duplicateKeyEvidence.size}.json`)
    const member = `${JSON.stringify(spelling)}:${JSON.stringify(DUPLICATE_KEY_VALUE)}`
    await writeFile(
      path,
      `{"schemaVersion":"literature-dedicated-preflight-observation/3.0.0",${member},${member}}`,
      'utf8',
    )
    duplicateKeyEvidence.set(spelling, path)
  }
})

afterAll(async () => {
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true })
})

describe('every preflight invocation exits nonzero', () => {
  it('with no arguments', async () => {
    expectBlocked(await runCli(PREFLIGHT, []))
  })

  it('with --print-query-plans, while still printing the plans', async () => {
    const result = await runCli(PREFLIGHT, ['--print-query-plans'])
    expectBlocked(result)
    // The correction must not be "stop printing the plans".
    expect(result.stdout).toContain('literature-preflight-observation-plan/3.0.0')
    expect(result.stdout).toContain('literature-postflight-existence-probe/3.0.0')
    expect(result.stdout).toContain('literature-postflight-observation-plan/3.0.0')
    expect(result.stdout).toContain('BEGIN READ ONLY'.toLowerCase())
  })

  it('with valid non-authoritative evidence and a full, correct argument set', async () => {
    const result = await runCli(PREFLIGHT, [
      '--owner-approved-commit',
      'a'.repeat(40),
      '--application-mechanism',
      'supabase_connector_apply_migration_v1',
      '--evidence',
      validPreflightEvidence,
    ])
    expectBlocked(result)
    expect(result.stdout).toContain('VERDICT:')
    expect(result.stdout).not.toContain('VERDICT: ready')
  })

  it('with invalid evidence', async () => {
    const result = await runCli(PREFLIGHT, ['--evidence', invalidEvidence])
    expectBlocked(result)
    expect(result.stdout).toContain('E00-evidence-parsed')
  })

  it('with an unreadable evidence path', async () => {
    expectBlocked(await runCli(PREFLIGHT, ['--evidence', join(temporaryRoot, 'absent.json')]))
  })

  it('with an unknown flag', async () => {
    expectBlocked(await runCli(PREFLIGHT, ['--not-a-flag']))
  })

  it('with a repeated flag', async () => {
    expectBlocked(
      await runCli(PREFLIGHT, [
        '--evidence',
        validPreflightEvidence,
        '--evidence',
        invalidEvidence,
      ]),
    )
  })

  it('with --print-query-plans combined with a full argument set', async () => {
    expectBlocked(
      await runCli(PREFLIGHT, [
        '--print-query-plans',
        '--owner-approved-commit',
        'a'.repeat(40),
        '--application-mechanism',
        'supabase_connector_apply_migration_v1',
        '--evidence',
        validPreflightEvidence,
      ]),
    )
  })
})

describe('every postflight invocation exits nonzero', () => {
  it('with no arguments', async () => {
    const result = await runCli(POSTFLIGHT, [])
    expectBlocked(result)
    expect(result.stdout).toContain('classification: provider_attestation_required')
    expect(result.stdout).toContain('nextAction: stop_read_only_reconciliation')
  })

  it('with valid non-authoritative evidence', async () => {
    const result = await runCli(POSTFLIGHT, ['--evidence', validPostflightEvidence])
    expectBlocked(result)
    expect(result.stdout).toContain('classification: provider_attestation_required')
  })

  it('with invalid evidence', async () => {
    const result = await runCli(POSTFLIGHT, ['--evidence', invalidEvidence])
    expectBlocked(result)
    expect(result.stdout).toContain('evidence:')
  })

  it('with an unknown flag', async () => {
    expectBlocked(await runCli(POSTFLIGHT, ['--print-query-plans']))
  })

  it('with a repeated flag', async () => {
    expectBlocked(
      await runCli(POSTFLIGHT, [
        '--evidence',
        validPostflightEvidence,
        '--evidence',
        invalidEvidence,
      ]),
    )
  })
})

/**
 * Fifth review, finding 1 — the duplicate-key rejection reaches an operator through this CLI's
 * stdout, so the redaction has to hold at the process boundary, not only at the thrown error.
 */
describe('a duplicate credential-shaped key is never echoed by the CLI', () => {
  const INVOCATIONS = (['preflight', 'postflight'] as const).flatMap((command) =>
    DUPLICATE_KEY_SPELLINGS.map(
      ([keyLabel, spelling]) =>
        [command, keyLabel, command === 'preflight' ? PREFLIGHT : POSTFLIGHT, spelling] as const,
    ),
  )

  it.each(INVOCATIONS)(
    '%s prints the failure for %s without the supplied key or value',
    async (_command, _keyLabel, cli, spelling) => {
      const evidencePath = duplicateKeyEvidence.get(spelling)
      if (!evidencePath) throw new Error(`no duplicate-key document for ${spelling}`)

      const result = await runCli(cli, ['--evidence', evidencePath])
      expectBlocked(result)

      // The failure is reported, by code, so the redaction is not "say nothing".
      const output = `${result.stdout}\n${result.stderr}`
      expect(output).toContain('duplicate_json_key')
      expect(output).toMatch(/character offset \d+/u)

      for (const stream of [result.stdout, result.stderr]) {
        expect(stream).not.toContain(spelling)
        expect(stream).not.toContain(DUPLICATE_KEY_VALUE)
        expect(stream).not.toContain('LEAKED')
        expect(stream).not.toContain('sb_secret_')
      }
    },
  )
})

describe('the containment guard itself (fourth review, finding 4)', () => {
  it('kills a hanging child, reports a controlled failure, and leaves nothing behind', async () => {
    const marker = join(temporaryRoot, 'hang-survived.marker')
    const hangScript = join(temporaryRoot, 'hang.cjs')
    // A review-owned child that ignores nothing, hangs on an interval, and — if containment ever
    // failed — would prove its survival by writing a marker file 1.5 s in.
    await writeFile(
      hangScript,
      [
        "const { writeFileSync } = require('node:fs')",
        'const marker = process.argv[2]',
        "setTimeout(() => { writeFileSync(marker, 'survived') }, 1500)",
        'setInterval(() => {}, 1000)',
      ].join('\n'),
      'utf8',
    )

    const startedAt = Date.now()
    const result = await runContained(process.execPath, [hangScript, marker], 300)

    // Killed promptly by the configured signal, with no exit status of its own.
    expect(result.code).toBeNull()
    expect(result.signal).toBe(CHILD_KILL_SIGNAL)
    expect(Date.now() - startedAt).toBeLessThan(1500)

    // The wrapper's assertion path treats the kill as an explicit failure, never a success.
    expect(() => expectBlocked(result)).toThrow(/did not exit on its own/u)

    // The process is truly gone: signal 0 probes existence without sending anything.
    expect(result.pid).toBeDefined()
    expect(() => process.kill(result.pid as number, 0)).toThrow()

    // And it stays gone: wait past the would-be marker write, then prove it never happened.
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 1400))
    await expect(access(marker)).rejects.toThrow()
  })
})

/**
 * Fifth review, finding 2 — the guard must contain the whole process **tree**.
 *
 * The reproduction this replays: the real preflight spawns `git` (`gatherRepositoryFacts`). Under
 * `spawn`'s own `timeout` option only the direct process is signalled, so a wedged CLI died while
 * its `git` descendant kept running and kept working — here, by writing a marker file 1.5 s after
 * the containment kill. One process group and one group-directed signal close that gap.
 */
describe('containment reaches descendants, not just the direct child (fifth review, finding 2)', () => {
  it('kills the CLI and its fake git descendant, and the descendant never writes its marker', async () => {
    const marker = join(temporaryRoot, 'descendant-survived.marker')
    // Stands in for the `git` subprocesses the real preflight spawns: harmless, review-owned, and
    // deliberately slower than the containment timeout so surviving it would be provable.
    const fakeGit = join(temporaryRoot, 'fake-git.cjs')
    await writeFile(
      fakeGit,
      [
        "const { writeFileSync } = require('node:fs')",
        'const marker = process.argv[2]',
        "setTimeout(() => { writeFileSync(marker, 'the descendant outlived containment') }, 1500)",
        'setInterval(() => {}, 1000)',
      ].join('\n'),
      'utf8',
    )
    // A CLI stand-in that shells out to that descendant, announces its PID, and then wedges.
    const fakeCli = join(temporaryRoot, 'fake-cli.cjs')
    await writeFile(
      fakeCli,
      [
        "const { spawn } = require('node:child_process')",
        'const [fakeGit, marker] = process.argv.slice(2)',
        "const descendant = spawn(process.execPath, [fakeGit, marker], { stdio: 'ignore' })",
        'process.stdout.write(`descendant-pid:${descendant.pid}\\n`)',
        'setInterval(() => {}, 1000)',
      ].join('\n'),
      'utf8',
    )

    const childProcessHandlesBefore = process
      .getActiveResourcesInfo()
      .filter((entry) => entry === 'ChildProcess').length

    const startedAt = Date.now()
    const result = await runContained(process.execPath, [fakeCli, fakeGit, marker], 500)

    // The direct child was killed by containment, and reported no exit status of its own.
    expect(result.timedOut).toBe(true)
    expect(result.code).toBeNull()
    expect(result.signal).toBe(CHILD_KILL_SIGNAL)
    expect(Date.now() - startedAt).toBeLessThan(1500)
    expect(() => expectBlocked(result)).toThrow(/did not exit on its own/u)

    const descendantPid = Number(/descendant-pid:(\d+)/u.exec(result.stdout)?.[1])
    expect(Number.isInteger(descendantPid)).toBe(true)
    expect(descendantPid).toBeGreaterThan(0)
    expect(result.pid).toBeDefined()
    expect(descendantPid).not.toBe(result.pid)

    // Wait past the descendant's would-be marker write before probing, so neither process can
    // still be a transient zombie and the marker window has fully elapsed.
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 1400))

    // Both processes are gone: signal 0 probes existence without sending anything.
    expect(() => process.kill(result.pid as number, 0)).toThrow()
    expect(() => process.kill(descendantPid, 0)).toThrow()

    // And the work the descendant would have done never happened.
    await expect(access(marker)).rejects.toThrow()

    // No handle is left behind either: the child-process handle is released and the containment
    // timer was cleared (an outstanding one would still be counted here as a Timeout).
    const childProcessHandlesAfter = process
      .getActiveResourcesInfo()
      .filter((entry) => entry === 'ChildProcess').length
    expect(childProcessHandlesAfter).toBeLessThanOrEqual(childProcessHandlesBefore)
  })

  it('contains one invocation without reaching a concurrent one, or the runner', async () => {
    // The group is owned by *one* operation. A group-directed kill that reached the runner's
    // group, or a sibling invocation's, would be a worse defect than the one being fixed — so the
    // over-reach direction is asserted too, not just the under-reach direction above.
    const marker = join(temporaryRoot, 'sibling-completed.marker')
    const sibling = join(temporaryRoot, 'sibling.cjs')
    await writeFile(
      sibling,
      [
        "const { writeFileSync } = require('node:fs')",
        'const marker = process.argv[2]',
        "setTimeout(() => { writeFileSync(marker, 'the sibling ran to completion') }, 700)",
      ].join('\n'),
      'utf8',
    )
    const hang = join(temporaryRoot, 'hang-beside-sibling.cjs')
    await writeFile(hang, 'setInterval(() => {}, 1000)\n', 'utf8')

    const [killed, survivor] = await Promise.all([
      runContained(process.execPath, [hang], 200),
      runContained(process.execPath, [sibling, marker], CHILD_TIMEOUT_MS),
    ])

    expect(killed.timedOut).toBe(true)
    expect(killed.code).toBeNull()
    expect(killed.signal).toBe(CHILD_KILL_SIGNAL)

    // The concurrent invocation was in a different group: it ran to completion and exited on its
    // own terms, unsignalled. The runner's own group is intact too — this assertion is running.
    expect(survivor.timedOut).toBe(false)
    expect(survivor.code).toBe(0)
    expect(survivor.signal).toBeNull()
    await expect(access(marker)).resolves.toBeUndefined()
  })
})

describe('the CLI sources still guarantee the status structurally', () => {
  it('sets the blocking exit status before any argument-dependent branch', async () => {
    const { readFile } = await import('node:fs/promises')
    for (const cli of [PREFLIGHT, POSTFLIGHT]) {
      const source = await readFile(resolve(ROOT, cli), 'utf8')
      const mainStart = source.indexOf('async function main()')
      const firstArgvUse = source.indexOf('process.argv', mainStart)
      const firstBlock = source.indexOf('blockExitStatus()', mainStart)
      expect(mainStart).toBeGreaterThan(-1)
      expect(firstBlock).toBeGreaterThan(-1)
      // The guard runs first; in the postflight there is no argv read inside main at all.
      if (firstArgvUse > -1) expect(firstBlock).toBeLessThan(firstArgvUse)
      // ...and it is re-asserted at finalization.
      expect(source).toMatch(/\.finally\(blockExitStatus\)/u)
      expect(source).not.toMatch(/process\.exitCode = 0/u)
    }
  })
})
