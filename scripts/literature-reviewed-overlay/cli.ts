/**
 * The reviewed-overlay operator CLI.
 *
 * Commands: `validate`, `dry-run`, `apply`, `reconcile`, `verify`. Only `apply` can mutate, and
 * only behind the full gate set (`--confirm-production-write`, the three destination variables,
 * the owner pins, and the owner authorization sentence). Credentials never travel in process
 * arguments; the parser refuses credential-shaped arguments before anything else runs. Every
 * command prints exactly one JSON line on stdout; failures are redacted and exit nonzero.
 */

import { pathToFileURL } from 'node:url'

import { redact } from '../literature-production-ingest/canonical'
import {
  assertNoCredentialArguments,
  resolveDestinationBinding,
} from '../literature-production-ingest/config'
import { streamGuardedReadOnlyQuery } from '../literature-production-ingest/source'
import { loadArtifactTruth, type ArtifactTruth } from './artifact'
import {
  readOverlayCheckpoint,
  readOverlayReceipt,
  validateOverlayReceiptAgainstCheckpoint,
  type OverlayReceipt,
} from './checkpoint'
import {
  OVERLAY_ARTIFACT_SHA256_ENV_NAME,
  OVERLAY_DEFAULT_RECORD_BATCH_LIMIT,
  OVERLAY_DEFAULT_STATE_DIRECTORY,
  OVERLAY_STATE_DIR_ENV_NAME,
} from './constants'
import {
  runApply,
  runDryRun,
  runReconcile,
  runValidate,
  runVerify,
  type OverlayEngineDependencies,
} from './engine'
import { buildCohortSql } from './projection'
import { assertRecordBatchLimit } from './plan'
import { PostgrestOverlayTransport } from './transport'

type OverlayCommand = 'validate' | 'dry-run' | 'apply' | 'reconcile' | 'verify'

const COMMANDS = new Set<OverlayCommand>(['validate', 'dry-run', 'apply', 'reconcile', 'verify'])

const VALUE_OPTIONS = new Set([
  'artifact',
  'state-dir',
  'record-batch-limit',
  'checkpoint',
  'receipt',
  'reconciliation',
])
const FLAG_OPTIONS = new Set(['resume', 'confirm-production-write'])

const COMMAND_OPTIONS: Record<OverlayCommand, { values: Set<string>; flags: Set<string> }> = {
  validate: { values: new Set(['artifact']), flags: new Set() },
  'dry-run': {
    values: new Set(['artifact', 'state-dir', 'record-batch-limit']),
    flags: new Set(),
  },
  apply: {
    values: new Set([
      'artifact',
      'state-dir',
      'record-batch-limit',
      'checkpoint',
      'reconciliation',
    ]),
    flags: new Set(['resume', 'confirm-production-write']),
  },
  reconcile: { values: new Set(['artifact', 'checkpoint']), flags: new Set() },
  verify: { values: new Set(['artifact', 'checkpoint', 'receipt']), flags: new Set() },
}

interface ParsedArguments {
  command: OverlayCommand
  values: Map<string, string>
  flags: Set<string>
}

export function parseOverlayArguments(argv: readonly string[]): ParsedArguments {
  assertNoCredentialArguments(argv)

  const [command, ...rest] = argv
  if (!command || !COMMANDS.has(command as OverlayCommand)) {
    throw new Error('Usage: cli.ts <validate|dry-run|apply|reconcile|verify> [--artifact <path>] …')
  }
  const allowed = COMMAND_OPTIONS[command as OverlayCommand]
  const values = new Map<string, string>()
  const flags = new Set<string>()
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index] as string
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected positional argument at position ${index + 2}.`)
    }
    const name = argument.slice(2)
    if (FLAG_OPTIONS.has(name)) {
      if (!allowed.flags.has(name)) {
        throw new Error(`The ${command} command does not accept --${name}.`)
      }
      if (flags.has(name)) throw new Error(`--${name} may not repeat.`)
      flags.add(name)
      continue
    }
    if (!VALUE_OPTIONS.has(name)) {
      throw new Error(`Unknown option --${name}.`)
    }
    if (!allowed.values.has(name)) {
      throw new Error(`The ${command} command does not accept --${name}.`)
    }
    if (values.has(name)) throw new Error(`--${name} may not repeat.`)
    const value = rest[index + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`--${name} requires a value.`)
    }
    values.set(name, value)
    index += 1
  }

  if (!values.has('artifact')) {
    throw new Error('Every overlay command requires --artifact <absolute path>.')
  }
  if ((command === 'reconcile' || command === 'verify') && !values.has('checkpoint')) {
    throw new Error(`The ${command} command requires --checkpoint <path>.`)
  }
  if (flags.has('resume') && !values.has('checkpoint')) {
    throw new Error('A resume requires --checkpoint <path>.')
  }
  if (values.has('reconciliation') && !flags.has('resume')) {
    throw new Error('--reconciliation is only meaningful with --resume.')
  }

  return { command: command as OverlayCommand, values, flags }
}

function stateDirectory(values: Map<string, string>): string {
  return (
    values.get('state-dir') ??
    process.env[OVERLAY_STATE_DIR_ENV_NAME] ??
    OVERLAY_DEFAULT_STATE_DIRECTORY
  )
}

function recordBatchLimit(values: Map<string, string>): number {
  const raw = values.get('record-batch-limit')
  if (raw === undefined) return OVERLAY_DEFAULT_RECORD_BATCH_LIMIT
  const parsed = Number.parseInt(raw, 10)
  assertRecordBatchLimit(parsed)
  return parsed
}

interface CliSecretHolder {
  secret: string | null
}

/**
 * The CLI's complete receipt-acceptance boundary for `verify --receipt`: the exact
 * receipt-to-checkpoint binding over every meaningful field, plus the requirement that the
 * receipt's post-observation binding is the one the FRESH verification just re-derived from
 * the destination. There is deliberately no smaller predicate — a receipt that self-checksums
 * and matches a field subset is not accepted anywhere.
 */
export function assertVerifiedReceiptBinding(
  receipt: unknown,
  checkpoint: unknown,
  verifiedPostObservationChecksum: string,
): asserts receipt is OverlayReceipt {
  validateOverlayReceiptAgainstCheckpoint(receipt, checkpoint)
  if ((receipt as OverlayReceipt).postObservationChecksum !== verifiedPostObservationChecksum) {
    throw new Error('The supplied receipt does not bind to the freshly verified remote state.')
  }
}

function buildDependencies(
  values: Map<string, string>,
  holder: CliSecretHolder,
): OverlayEngineDependencies {
  const artifactPath = values.get('artifact') as string
  return {
    environment: process.env,
    async readCohortPayloads() {
      const payloads: unknown[] = []
      for await (const payload of streamGuardedReadOnlyQuery({ sql: buildCohortSql() })) {
        payloads.push(payload)
      }
      return payloads
    },
    loadArtifact(): ArtifactTruth {
      const pin = process.env[OVERLAY_ARTIFACT_SHA256_ENV_NAME]
      return loadArtifactTruth(artifactPath, pin === undefined ? [] : [pin])
    },
    createTransport() {
      const binding = resolveDestinationBinding(process.env, true)
      if (!binding) {
        throw new Error('The Literature destination is not configured.')
      }
      holder.secret = binding.secret
      return new PostgrestOverlayTransport({ binding })
    },
    now: () => new Date(),
  }
}

async function main(): Promise<void> {
  const holder: CliSecretHolder = { secret: null }
  try {
    const parsed = parseOverlayArguments(process.argv.slice(2))
    const deps = buildDependencies(parsed.values, holder)

    // Non-mutating commands still refuse a legacy or partial destination configuration.
    if (parsed.command === 'validate' || parsed.command === 'dry-run') {
      resolveDestinationBinding(process.env, false)
    }

    let result: unknown
    if (parsed.command === 'validate') {
      result = await runValidate(deps)
    } else if (parsed.command === 'dry-run') {
      result = await runDryRun(deps, {
        stateDirectory: stateDirectory(parsed.values),
        recordBatchLimit: recordBatchLimit(parsed.values),
      })
    } else if (parsed.command === 'apply') {
      result = await runApply(deps, {
        stateDirectory: stateDirectory(parsed.values),
        recordBatchLimit: recordBatchLimit(parsed.values),
        resume: parsed.flags.has('resume'),
        checkpointPath: parsed.values.get('checkpoint'),
        reconciliationPath: parsed.values.get('reconciliation'),
        readReconciliation: async (path) => {
          const { readFile } = await import('node:fs/promises')
          return JSON.parse(await readFile(path, 'utf8')) as unknown
        },
        confirmProductionWrite: parsed.flags.has('confirm-production-write'),
      })
    } else if (parsed.command === 'reconcile') {
      const reconciled = await runReconcile(deps, {
        checkpointPath: parsed.values.get('checkpoint') as string,
      })
      result = reconciled
    } else {
      const checkpointPath = parsed.values.get('checkpoint') as string
      const verified = await runVerify(deps, { checkpointPath })
      const receiptPath = parsed.values.get('receipt')
      if (receiptPath !== undefined) {
        const receipt = await readOverlayReceipt(receiptPath)
        const checkpoint = await readOverlayCheckpoint(checkpointPath)
        assertVerifiedReceiptBinding(receipt, checkpoint, verified.postObservationChecksum)
      }
      result = verified
    }

    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch (error) {
    const secrets = holder.secret ? [holder.secret] : []
    process.stdout.write(
      `${JSON.stringify({ status: 'error', message: redact(error, secrets) })}\n`,
    )
    process.exitCode = 1
  }
}

if (pathToFileURL(process.argv[1] ?? '').href === import.meta.url) {
  void main()
}
