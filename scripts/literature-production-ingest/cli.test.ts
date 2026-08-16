/** @jest-environment node */

import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const CLI_PATH = resolve(__dirname, 'cli.ts')
const APPROVED_URL = 'https://itcttmkxdxvwmwcmzmey.supabase.co/'
const APPROVED_REF = 'itcttmkxdxvwmwcmzmey'
const SYNTHETIC_SECRET = 'sb_secret_SYNTHETIC_CLI_TEST_ONLY_123456789'

function runCli(
  arguments_: string[],
  environment: Readonly<Record<string, string | undefined>> = {},
) {
  return spawnSync(process.execPath, ['--import', 'tsx', CLI_PATH, ...arguments_], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'test',
      NODE_NO_WARNINGS: '1',
      ...environment,
    },
    maxBuffer: 256 * 1024,
    timeout: 10_000,
  })
}

const approvedEnvironment = {
  LITERATURE_SUPABASE_URL: APPROVED_URL,
  LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: APPROVED_REF,
  LITERATURE_SUPABASE_SECRET_KEY: SYNTHETIC_SECRET,
}

describe('production operator command boundary', () => {
  it('advertises every supported operator command', () => {
    const result = runCli(['--help'])

    expect(result.status).toBe(0)
    for (const command of ['validate', 'dry-run', 'canary', 'full', 'reconcile', 'verify']) {
      expect(result.stdout).toContain(command)
    }
    expect(result.stderr).toBe('')
  })

  it('rejects and redacts credential-shaped CLI arguments', () => {
    const result = runCli(['full', `--secret=${SYNTHETIC_SECRET}`])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('dedicated environment')
    expect(`${result.stdout}${result.stderr}`).not.toContain(SYNTHETIC_SECRET)
  })

  it('requires explicit write confirmation before configuration or transport work', () => {
    const result = runCli(['full'])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('--confirm-production-write')
    expect(result.stdout).toBe('')
  })

  it('rejects the prohibited Endoreels target before any source or remote request', () => {
    const result = runCli(['full', '--confirm-production-write'], {
      ...approvedEnvironment,
      LITERATURE_SUPABASE_URL: 'https://tqnhxlwvkkswuckszlee.supabase.co/',
      LITERATURE_SUPABASE_EXPECTED_PROJECT_REF: 'tqnhxlwvkkswuckszlee',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Endoreels')
  })

  it('requires both owner-approved full projection pins before reading the source', () => {
    const result = runCli(['full', '--confirm-production-write'], approvedEnvironment)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('LITERATURE_FULL_EXPECTED_RECORD_COUNT')
    expect(result.stderr).toContain('LITERATURE_FULL_EXPECTED_SOURCE_SHA256')
  })

  it('rejects a full projection count that is not a safe integer before reading the source', () => {
    const result = runCli(['full', '--confirm-production-write'], {
      ...approvedEnvironment,
      LITERATURE_FULL_EXPECTED_RECORD_COUNT: '999999999999999999999999',
      LITERATURE_FULL_EXPECTED_SOURCE_SHA256: 'a'.repeat(64),
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('must both pin')
  })

  it('requires an owner-pinned canary checksum before reading a manifest', () => {
    const result = runCli(
      [
        'canary',
        '--manifest',
        '/synthetic/manifest/that/need/not/exist.json',
        '--confirm-production-write',
      ],
      approvedEnvironment,
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('LITERATURE_CANARY_MANIFEST_SHA256')
  })

  it('rejects irrelevant resume limits instead of silently ignoring them', () => {
    const result = runCli([
      'full',
      '--resume',
      '--checkpoint',
      '/synthetic/checkpoint.json',
      '--record-batch-limit',
      '100',
      '--confirm-production-write',
    ])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('--record-batch-limit is not valid for full')
  })
})
