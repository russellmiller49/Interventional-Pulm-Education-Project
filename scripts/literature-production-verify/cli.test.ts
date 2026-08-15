/** @jest-environment node */

/**
 * The CLI as an operator actually runs it: a real subprocess, a real HTTP server, real exit codes.
 *
 * Source-scanning and unit tests establish that the transport refuses non-read methods. They
 * cannot establish that the *assembled program* only ever issues them — that is a property of
 * every code path running together, and the way to observe it is to stand up a server, run the
 * command against it, and look at what arrived. That is what the stub target here is for: it
 * records every request line and the assertion is over the recording.
 *
 * The stub also demonstrates something worth stating plainly: **a cooperative fake cannot make
 * this command report `verified`.** Every scenario that reads the database first checks it is the
 * approved project at the canonical URL, and a loopback stub is neither. A verification tool that
 * could be satisfied by a server you control would not be verifying anything.
 */

import { spawn } from 'node:child_process'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { AddressInfo } from 'node:net'

const ROOT = process.cwd()
const CLI = 'scripts/literature-production-verify/verify.ts'
const APPROVED_REF = 'itcttmkxdxvwmwcmzmey'
const LOCAL_CREDENTIAL = 'TESTONLY-opaque-local-stack-credential'

/**
 * Containment for one CLI child.
 *
 * A wedged child is killed and the test fails with a controlled message rather than hanging the
 * run. The suite budget below is raised past Jest's 5 s default because each case pays for a `tsx`
 * startup, which the default was never sized for.
 */
const CHILD_TIMEOUT_MS = 20_000
jest.setTimeout(60_000)

interface CommandResult {
  code: number | null
  stdout: string
  stderr: string
}

function runCli(
  argumentValues: readonly string[],
  environment: Readonly<Record<string, string>>,
): Promise<CommandResult> {
  // A clean environment: no ambient LITERATURE_* variable from the developer's shell can change
  // what a case is testing. `NODE_ENV` is carried only because the repository's `ProcessEnv`
  // requires it — the Literature contract deliberately derives nothing from it.
  const childEnvironment: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    NODE_ENV: 'test',
    NO_COLOR: '1',
    ...environment,
  }

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', resolve(ROOT, CLI), ...argumentValues],
      {
        cwd: ROOT,
        env: childEnvironment,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      rejectPromise(new Error(`The CLI did not exit within ${CHILD_TIMEOUT_MS} ms.`))
    }, CHILD_TIMEOUT_MS)

    child.on('error', rejectPromise)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolvePromise({ code, stdout, stderr })
    })
  })
}

/** Every request the stub target received, in order. */
interface RecordedRequest {
  method: string
  url: string
  hadBody: boolean
}

interface StubTarget {
  origin: string
  requests: RecordedRequest[]
  close: () => Promise<void>
}

/**
 * A cooperative PostgREST-shaped stub.
 *
 * It answers everything successfully so that any failure the CLI reports comes from the CLI's own
 * rules rather than from the fake being unhelpful.
 *
 * `truncateRowSets` flips one behaviour: the batch and provenance reads then claim a large
 * `Content-Range` total while returning no rows, which is what a server-side `max-rows` ceiling
 * looks like from the client. It is the shape of a silent short read, and the tool must notice.
 */
async function startStubTarget(truncateRowSets = false): Promise<StubTarget> {
  const requests: RecordedRequest[] = []

  const server: Server = createServer((request: IncomingMessage, response: ServerResponse) => {
    let body = ''
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8')
    })
    request.on('end', () => {
      requests.push({
        method: request.method ?? '',
        url: request.url ?? '',
        hadBody: body.length > 0,
      })
      const url = request.url ?? ''
      if (url.startsWith('/rest/v1/rpc/list_literature_gold_batches_v2')) {
        response.writeHead(404, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ code: 'PGRST202', message: 'no such function' }))
        return
      }
      if (url.startsWith('/rest/v1/rpc/literature_admin_stats_v1')) {
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ total_articles: 0 }))
        return
      }
      if (
        truncateRowSets &&
        (url.startsWith('/rest/v1/literature_import_batches') ||
          url.startsWith('/rest/v1/literature_article_sources'))
      ) {
        response.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Range': '0-0/9000',
        })
        response.end('[]')
        return
      }
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Range': '*/0',
      })
      response.end('[]')
    })
  })

  await new Promise<void>((resolveListen) => {
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const { port } = server.address() as AddressInfo

  return {
    origin: `http://127.0.0.1:${port}/`,
    requests,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()))
      }),
  }
}

/** Local mode, so the stub's loopback origin is an acceptable *shape* of target. */
function localModeEnvironment(origin: string): Record<string, string> {
  return {
    LITERATURE_SUPABASE_RUNTIME_MODE: 'local',
    LITERATURE_SUPABASE_URL: origin,
    LITERATURE_SUPABASE_SECRET_KEY: LOCAL_CREDENTIAL,
    LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
  }
}

describe('the command refuses before it reads anything', () => {
  it('refuses a credential passed as an argument and exits nonzero', async () => {
    const result = await runCli(
      ['--scenario', 'foundation-empty', '--keyword', 'sb_secret_TESTONLYaaaaaaaaaaaaaaaa'],
      {},
    )
    expect(result.code).not.toBe(0)
    expect(result.stderr).toMatch(/looks like a credential/u)
    // The offending value is never echoed, so it does not end up in a CI log either.
    expect(`${result.stdout}${result.stderr}`).not.toContain('TESTONLY')
  })

  it('exits nonzero with no arguments', async () => {
    const result = await runCli([], {})
    expect(result.code).not.toBe(0)
    expect(result.stdout).toMatch(/Read-only Literature production verification/u)
  })

  it('exits nonzero for --help, because printing help verifies nothing', async () => {
    // The sibling preflight had exactly this bug: an informational flag returned before the
    // failure status was set, so a shell `&&` chain read a help dump as a passing run.
    expect((await runCli(['--help'], {})).code).not.toBe(0)
  })

  it('exits nonzero for an unknown scenario and lists the real ones', async () => {
    const result = await runCli(['--scenario', 'everything'], {})
    expect(result.code).not.toBe(0)
    expect(result.stderr).toMatch(/runtime-not-configured/u)
  })

  it('refuses --flag=value rather than silently ignoring it', async () => {
    // Previously this ran to completion, printed a normal report and a normal exit code, and
    // wrote no receipt. The only signal was the absence of a line.
    const result = await runCli(['--scenario=foundation-empty'], {})
    expect(result.code).not.toBe(0)
    expect(result.stderr).toMatch(/space-separated form/u)
  })

  it('refuses a flag whose value is the next flag', async () => {
    // `--receipt --json` would otherwise write the receipt to a file named `--json`.
    const result = await runCli(['--scenario', 'foundation-empty', '--receipt', '--json'], {})
    expect(result.code).not.toBe(0)
    expect(result.stderr).toMatch(/requires a value/u)
  })

  it('refuses a --pmid that is not a PubMed identifier', async () => {
    // `--pmid` is echoed into the report and the receipt, so an arbitrary token parked in it would
    // be written out verbatim — which the credential guard cannot catch for a shape it has never
    // seen.
    const result = await runCli(
      ['--scenario', 'foundation-populated', '--pmid', 'glpat-TESTONLY-unshaped-token'],
      {},
    )
    expect(result.code).not.toBe(0)
    expect(result.stderr).toMatch(/1 to 12 digits/u)
    expect(`${result.stdout}${result.stderr}`).not.toContain('TESTONLY')
  })

  it('reports not_configured when no Literature variable is set', async () => {
    const result = await runCli(['--scenario', 'foundation-empty'], {})
    expect(result.code).not.toBe(0)
    expect(result.stderr).toMatch(/not configured/u)
  })

  it('refuses a publishable key rather than reading with it', async () => {
    const result = await runCli(['--scenario', 'foundation-empty'], {
      LITERATURE_SUPABASE_URL: `https://${APPROVED_REF}.supabase.co/`,
      LITERATURE_SUPABASE_SECRET_KEY: 'sb_publishable_TESTONLYbbbbbbbbbbbb',
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
    })
    expect(result.code).not.toBe(0)
    expect(result.stderr).toMatch(/publishable/u)
    expect(`${result.stdout}${result.stderr}`).not.toContain('TESTONLY')
  })
})

describe('every request the assembled command issues is a read', () => {
  let stub: StubTarget

  beforeAll(async () => {
    stub = await startStubTarget()
  })

  afterAll(async () => {
    await stub.close()
  })

  it('issues GET requests only, with no body, across every scenario', async () => {
    for (const scenario of [
      'foundation-empty',
      'foundation-populated',
      'canary',
      'full-corpus',
      'public-exclusion',
      'batch-reconciliation',
      'gold-unavailable',
    ]) {
      await runCli(['--scenario', scenario], localModeEnvironment(stub.origin))
    }

    expect(stub.requests.length).toBeGreaterThan(0)
    const methods = [...new Set(stub.requests.map((request) => request.method))]
    expect(methods).toEqual(['GET'])
    expect(stub.requests.filter((request) => request.hadBody)).toEqual([])
  })

  it('never addresses a mutating RPC', async () => {
    const rpcPaths = stub.requests
      .map((request) => request.url.split('?')[0])
      .filter((path) => path.startsWith('/rest/v1/rpc/'))
    for (const path of rpcPaths) {
      expect(path).not.toMatch(/curate_|save_|freeze_|unlock_|update_/u)
    }
  })

  it('cannot be talked into a verified verdict by a cooperative fake', async () => {
    // The stub answers every read successfully. The command still refuses, because a loopback
    // origin is not the canonical production URL and the checks say so.
    const result = await runCli(['--scenario', 'canary'], localModeEnvironment(stub.origin))
    expect(result.code).not.toBe(0)
    expect(result.stdout).toMatch(/V02-canonical-url/u)
    expect(result.stdout).not.toMatch(/verdict: VERIFIED/u)
  })

  it('reports the gold workflow as absent when the target says PGRST202', async () => {
    const result = await runCli(
      ['--scenario', 'gold-unavailable'],
      localModeEnvironment(stub.origin),
    )
    expect(result.stdout).toMatch(/V95-gold-absent-in-database/u)
    expect(result.stdout).toMatch(/PGRST202/u)
  })
})

describe('receipts are written redacted', () => {
  let stub: StubTarget
  let directory: string

  beforeAll(async () => {
    stub = await startStubTarget()
    directory = await mkdtemp(join(tmpdir(), 'literature-verify-'))
  })

  afterAll(async () => {
    await stub.close()
    await rm(directory, { recursive: true, force: true })
  })

  it('writes a receipt with no credential and an explicit no-authorization statement', async () => {
    const receiptPath = join(directory, 'receipt.json')
    await runCli(
      ['--scenario', 'foundation-empty', '--receipt', receiptPath],
      localModeEnvironment(stub.origin),
    )

    const receipt = await readFile(receiptPath, 'utf8')
    expect(receipt).not.toContain(LOCAL_CREDENTIAL)
    expect(receipt).not.toContain('TESTONLY')
    const parsed = JSON.parse(receipt) as {
      target: { credentialPresent: boolean }
      notAuthorization: string
      verdict: string
    }
    expect(parsed.target.credentialPresent).toBe(true)
    // A receipt outlives the terminal it was printed in. It should not have to be inferred that a
    // passing verification did not license the next step.
    expect(parsed.notAuthorization).toMatch(/authorizes nothing/u)
    expect(parsed.notAuthorization).toMatch(/not a canary/u)
  })

  it('emits the same envelope on stdout under --json, also redacted', async () => {
    const result = await runCli(
      ['--scenario', 'foundation-empty', '--json'],
      localModeEnvironment(stub.origin),
    )
    expect(result.stdout).not.toContain(LOCAL_CREDENTIAL)
    const parsed = JSON.parse(result.stdout) as { schemaVersion: string }
    expect(parsed.schemaVersion).toBe('literature-production-verification/1.1.0')
  })

  it('reports a silently truncated row set rather than a count derived from it', async () => {
    // A server-side row ceiling returns fewer rows than the table holds. Deriving a distinct-PMID
    // count from that short set and comparing it against the full corpus total would report a
    // provenance gap that does not exist — a confidently fabricated failure.
    const shortReading = await startStubTarget(true)
    try {
      const result = await runCli(
        ['--scenario', 'batch-reconciliation'],
        localModeEnvironment(shortReading.origin),
      )
      expect(result.code).not.toBe(0)
      expect(result.stdout).toMatch(/incomplete/u)
      // Reported as unknown, not as a coverage failure invented from partial evidence.
      expect(result.stdout).toMatch(/\[UNKNOWN\].*V63-provenance-coverage/u)
    } finally {
      await shortReading.close()
    }
  })

  it('reports a wrong-shaped evidence file as one unusable check, not an aborted run', async () => {
    // The natural mistake: saving the provider's list_migrations response as it came back,
    // {"migrations":[...]}, rather than the bare array. It parses, so the previous code cast it
    // and reached entries.map on a plain object — the run died with an empty report and no
    // verdict over a file that was one unwrapping away from correct.
    const wrongShape = join(directory, 'wrapped-migrations.json')
    await writeFile(
      wrongShape,
      JSON.stringify({ migrations: [{ version: '20260815223259' }] }),
      'utf8',
    )
    const result = await runCli(
      ['--scenario', 'foundation-empty', '--migration-history', wrongShape],
      localModeEnvironment(stub.origin),
    )
    expect(result.code).not.toBe(0)
    expect(result.stdout).toMatch(/not the expected shape/u)
    // Every other check still ran.
    expect(result.stdout).toMatch(/V20-schema-present/u)
    expect(result.stdout).toMatch(/verdict:/u)
  })

  it('round-trips its own receipt as the next run --baseline', async () => {
    // The file the runbook tells an operator to keep and the file --baseline can read are the
    // same file. Previously they were not, and feeding the receipt back produced a confident
    // "not idempotent: the corpus moved from undefined to 25".
    const first = join(directory, 'round-trip-1.json')
    await runCli(['--scenario', 'canary', '--receipt', first], localModeEnvironment(stub.origin))
    const receipt = JSON.parse(await readFile(first, 'utf8')) as { snapshot: unknown }
    expect(receipt.snapshot).not.toBeNull()

    const second = await runCli(
      ['--scenario', 'canary', '--baseline', first],
      localModeEnvironment(stub.origin),
    )
    expect(second.stdout).not.toMatch(/undefined/u)
    expect(second.stdout).not.toMatch(/NaN/u)
  })

  it('refuses to overwrite an existing receipt', async () => {
    // Re-using a path out of habit would destroy the run-1 receipt a later --baseline depends on.
    const existing = join(directory, 'already-there.json')
    await writeFile(existing, '{"important":"prior evidence"}', 'utf8')
    const result = await runCli(
      ['--scenario', 'foundation-empty', '--receipt', existing],
      localModeEnvironment(stub.origin),
    )
    expect(result.code).not.toBe(0)
    expect(result.stderr).toMatch(/never overwritten/u)
    expect(await readFile(existing, 'utf8')).toContain('prior evidence')
  })

  it('reports a malformed evidence file rather than proceeding without it', async () => {
    const result = await runCli(
      ['--scenario', 'foundation-empty', '--migration-history', join(directory, 'absent.json')],
      localModeEnvironment(stub.origin),
    )
    expect(result.code).not.toBe(0)
    expect(result.stdout).toMatch(/could not be read or parsed/u)
  })
})
