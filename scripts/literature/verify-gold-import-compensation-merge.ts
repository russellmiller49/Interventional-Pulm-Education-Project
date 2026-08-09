import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  HISTORICAL_MERGE_EQUIVALENCE_MODE,
  PATH_SCOPED_MERGE_EQUIVALENCE_INPUT_SCHEMA_VERSION,
  SUBSEQUENT_MAINLINE_COMPATIBILITY_INPUT_SCHEMA_VERSION,
  SUBSEQUENT_MAINLINE_COMPATIBILITY_MODE,
  canonicalMergeEquivalenceJson,
  parsePathScopedMergeEquivalenceInput,
  parseStrictJson,
  parseSubsequentMainlineCompatibilityInput,
  publishPathScopedMergeEquivalenceReceipt,
  publishSubsequentMainlineCompatibilityReceipt,
  verifyPathScopedMergeEquivalence,
  verifySubsequentMainlineCompatibility,
  type PathScopedMergeEquivalenceInput,
  type PublishedMainlineCompatibilityReceipt,
  type PublishedMergeEquivalenceReceipt,
  type SubsequentMainlineCompatibilityInput,
} from './path-scoped-merge-equivalence'
import {
  assertKnownArguments,
  hasFlag,
  parseCliArguments,
  stringArgument,
  type ParsedCliArguments,
} from './lib/cli'

const HELP = `
Verify either the immutable historical merge receipt or a separately authorized
subsequent-mainline compatibility contract. The strict config schema selects
exactly one mode:

  historical_merge_equivalence
  subsequent_mainline_compatibility

Usage:
  --config <historical-or-subsequent-json>
  --output-root <existing-approved-non-symlink-directory>
  --output <new-child-directory>
  [--repository-root <git-checkout>]

The output root must already exist. The output must be a new confined child;
ancestor symlinks, path traversal, output escape, and collisions are rejected.
Canonical JSON and Markdown receipts plus a SHA-256 manifest are written with
restrictive exclusive creation. The verifier only reads Git objects and never
accesses a database. The committed subsequent-mainline fixture is regression
evidence only. For a release receipt, preserve and separately checksum a strict
external config whose candidateHead is the final post-commit SHA; the receipt
binds its parsed semantic identity and the supplied candidate commit.
`.trim()

const KNOWN_ARGUMENTS = ['config', 'help', 'output', 'output-root', 'repository-root'] as const

function required(arguments_: ParsedCliArguments, key: string): string {
  const value = stringArgument(arguments_, key)
  if (!value) throw new Error(`--${key} is required.`)
  return value
}

type VerificationInput =
  | {
      input: PathScopedMergeEquivalenceInput
      mode: typeof HISTORICAL_MERGE_EQUIVALENCE_MODE
    }
  | {
      input: SubsequentMainlineCompatibilityInput
      mode: typeof SUBSEQUENT_MAINLINE_COMPATIBILITY_MODE
    }

async function cliInput(
  arguments_: ParsedCliArguments,
  repositoryRoot: string,
): Promise<VerificationInput> {
  const configPath = resolve(repositoryRoot, required(arguments_, 'config'))
  const parsed = parseStrictJson(await readFile(configPath, 'utf8'), 'Merge-verification config')
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Merge-verification config must be a JSON object.')
  }
  if (parsed.schemaVersion === PATH_SCOPED_MERGE_EQUIVALENCE_INPUT_SCHEMA_VERSION) {
    return {
      mode: HISTORICAL_MERGE_EQUIVALENCE_MODE,
      input: parsePathScopedMergeEquivalenceInput(parsed),
    }
  }
  if (parsed.schemaVersion === SUBSEQUENT_MAINLINE_COMPATIBILITY_INPUT_SCHEMA_VERSION) {
    return {
      mode: SUBSEQUENT_MAINLINE_COMPATIBILITY_MODE,
      input: parseSubsequentMainlineCompatibilityInput(parsed),
    }
  }
  throw new Error('Config schemaVersion does not select a supported merge-verification mode.')
}

function resolvedOutputArgument(
  arguments_: ParsedCliArguments,
  repositoryRoot: string,
  key: 'output' | 'output-root',
): string {
  const raw = required(arguments_, key)
  if (raw.split(/[\\/]/u).some((component) => component === '..')) {
    throw new Error(`--${key} must not contain '..' traversal.`)
  }
  return resolve(repositoryRoot, raw)
}

export interface MergeEquivalenceCliResult {
  publication: PublishedMainlineCompatibilityReceipt | PublishedMergeEquivalenceReceipt
  result:
    | 'accepted_exact_tree'
    | 'accepted_structured_unrelated_mainline_delta'
    | 'accepted_unrelated_mainline_delta'
}

export async function runPathScopedMergeEquivalenceCli(
  argv: string[],
  defaultRepositoryRoot = process.cwd(),
  log: (message: string) => void = console.log,
): Promise<MergeEquivalenceCliResult | undefined> {
  const arguments_ = parseCliArguments(argv)
  assertKnownArguments(arguments_, KNOWN_ARGUMENTS)
  if (hasFlag(arguments_, 'help')) {
    log(HELP)
    return undefined
  }
  if (arguments_.values.has('help')) throw new Error('--help does not accept a value.')
  for (const key of KNOWN_ARGUMENTS.filter((key) => key !== 'help')) {
    if (arguments_.flags.has(key)) throw new Error(`--${key} requires a value.`)
  }

  const repositoryRoot = resolve(
    defaultRepositoryRoot,
    stringArgument(arguments_, 'repository-root', '.'),
  )
  const verification = await cliInput(arguments_, repositoryRoot)
  const outputRoot = resolvedOutputArgument(arguments_, repositoryRoot, 'output-root')
  const outputDirectory = resolvedOutputArgument(arguments_, repositoryRoot, 'output')
  let result: MergeEquivalenceCliResult
  if (verification.mode === HISTORICAL_MERGE_EQUIVALENCE_MODE) {
    const receipt = await verifyPathScopedMergeEquivalence(verification.input, { repositoryRoot })
    result = {
      result: receipt.result,
      publication: await publishPathScopedMergeEquivalenceReceipt(
        receipt,
        outputDirectory,
        outputRoot,
      ),
    }
  } else {
    const receipt = await verifySubsequentMainlineCompatibility(verification.input, {
      repositoryRoot,
    })
    result = {
      result: receipt.result,
      publication: await publishSubsequentMainlineCompatibilityReceipt(
        receipt,
        outputDirectory,
        outputRoot,
      ),
    }
  }
  log(canonicalMergeEquivalenceJson(result).trimEnd())
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runPathScopedMergeEquivalenceCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
