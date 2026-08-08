import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  PATH_SCOPED_MERGE_EQUIVALENCE_INPUT_SCHEMA_VERSION,
  canonicalMergeEquivalenceJson,
  parsePathScopedMergeEquivalenceInput,
  publishPathScopedMergeEquivalenceReceipt,
  verifyPathScopedMergeEquivalence,
  type AcceptedUnrelatedMergeInput,
  type PathScopedMergeEquivalenceInput,
  type PublishedMergeEquivalenceReceipt,
} from './path-scoped-merge-equivalence'
import {
  assertKnownArguments,
  hasFlag,
  parseCliArguments,
  stringArgument,
  type ParsedCliArguments,
} from './lib/cli'

const HELP = `
Verify path-scoped equivalence between a validated feature head and merged main.

Config-file form:
  --config <json> --output <new-directory> [--repository-root <git-checkout>]

Explicit-input form:
  --feature-head <40-char-sha>
  --merge-commit <40-char-sha>
  --merged-main <40-char-sha>
  --protected-path-inventory <json-or-line-file>
  [--accepted-unrelated-merge '<identity>=<40-char-merge-sha>']...
  --output <new-directory>
  [--repository-root <git-checkout>]

The output directory is created exclusively and receives canonical JSON and Markdown receipts
plus a SHA-256 manifest. The verifier only reads Git objects and never accesses a database.
`.trim()

const KNOWN_ARGUMENTS = [
  'accepted-unrelated-merge',
  'config',
  'feature-head',
  'help',
  'merge-commit',
  'merged-main',
  'output',
  'protected-path-inventory',
  'repository-root',
] as const

function required(arguments_: ParsedCliArguments, key: string): string {
  const value = stringArgument(arguments_, key)
  if (!value) throw new Error(`--${key} is required.`)
  return value
}

function acceptedMergeArgument(value: string): AcceptedUnrelatedMergeInput {
  const separator = value.lastIndexOf('=')
  if (separator <= 0 || separator === value.length - 1) {
    throw new Error("--accepted-unrelated-merge must use '<identity>=<40-char-merge-sha>' syntax.")
  }
  return {
    identity: value.slice(0, separator).trim(),
    mergeCommit: value.slice(separator + 1).trim(),
  }
}

async function readProtectedPathInventory(path: string): Promise<unknown[]> {
  const text = await readFile(path, 'utf8')
  const trimmed = text.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(text) as unknown
    if (Array.isArray(parsed)) return parsed
    if (parsed !== null && typeof parsed === 'object') {
      const protectedPaths = (parsed as Record<string, unknown>).protectedPaths
      if (Array.isArray(protectedPaths)) return protectedPaths
    }
    throw new Error(
      'The protected path inventory JSON must be an array or an object with protectedPaths.',
    )
  }
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
}

async function explicitInput(
  arguments_: ParsedCliArguments,
  repositoryRoot: string,
): Promise<PathScopedMergeEquivalenceInput> {
  const inventory = resolve(repositoryRoot, required(arguments_, 'protected-path-inventory'))
  const accepted = (arguments_.values.get('accepted-unrelated-merge') ?? []).map(
    acceptedMergeArgument,
  )
  return parsePathScopedMergeEquivalenceInput({
    schemaVersion: PATH_SCOPED_MERGE_EQUIVALENCE_INPUT_SCHEMA_VERSION,
    featureHead: required(arguments_, 'feature-head'),
    mergeCommit: required(arguments_, 'merge-commit'),
    mergedMain: required(arguments_, 'merged-main'),
    protectedPaths: await readProtectedPathInventory(inventory),
    acceptedUnrelatedMerges: accepted,
  })
}

async function cliInput(
  arguments_: ParsedCliArguments,
  repositoryRoot: string,
): Promise<PathScopedMergeEquivalenceInput> {
  const config = stringArgument(arguments_, 'config')
  const explicitKeys = [
    'feature-head',
    'merge-commit',
    'merged-main',
    'protected-path-inventory',
    'accepted-unrelated-merge',
  ]
  const hasExplicitInput = explicitKeys.some(
    (key) => arguments_.flags.has(key) || arguments_.values.has(key),
  )
  if (config && hasExplicitInput) {
    throw new Error('--config cannot be combined with explicit merge-equivalence inputs.')
  }
  if (config) {
    return parsePathScopedMergeEquivalenceInput(
      JSON.parse(await readFile(resolve(repositoryRoot, config), 'utf8')) as unknown,
    )
  }
  return explicitInput(arguments_, repositoryRoot)
}

export interface MergeEquivalenceCliResult {
  publication: PublishedMergeEquivalenceReceipt
  result: 'accepted_exact_tree' | 'accepted_unrelated_mainline_delta'
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
  const input = await cliInput(arguments_, repositoryRoot)
  const receipt = await verifyPathScopedMergeEquivalence(input, { repositoryRoot })
  const publication = await publishPathScopedMergeEquivalenceReceipt(
    receipt,
    resolve(repositoryRoot, required(arguments_, 'output')),
  )
  const result = { result: receipt.result, publication }
  log(canonicalMergeEquivalenceJson(result).trimEnd())
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void runPathScopedMergeEquivalenceCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
