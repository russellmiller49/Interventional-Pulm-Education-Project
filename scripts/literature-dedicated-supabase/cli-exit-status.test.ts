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
 * contained by the child process's own timeout/kill mechanism (`CHILD_TIMEOUT_MS` below), which
 * is itself exercised by an adversarial hanging-child test at the bottom of the suite.
 */

import { spawn } from 'node:child_process'
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

interface CommandResult {
  code: number | null
  signal: NodeJS.Signals | null
  pid: number | undefined
  stdout: string
  stderr: string
}

/**
 * Spawn one contained child: no shell, bounded output capture, and a hard kill once `timeoutMs`
 * elapses (Node's own child-process timeout mechanism, so no timer of ours can leak). A killed
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
      timeout: timeoutMs,
      killSignal: CHILD_KILL_SIGNAL,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < MAX_CAPTURED_OUTPUT_CHARACTERS) stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < MAX_CAPTURED_OUTPUT_CHARACTERS) stderr += chunk.toString('utf8')
    })
    child.on('error', fail)
    child.on('close', (code, signal) => settle({ code, signal, pid: child.pid, stdout, stderr }))
  })
}

/**
 * Run one real CLI invocation. `node --import tsx` is the same loader the `tsx` binary wraps
 * (and what the npm scripts resolve to), invoked directly so the spawned process IS the process
 * doing the work — the containment timeout kills the whole invocation, with no wrapper process
 * that could orphan a grandchild.
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
