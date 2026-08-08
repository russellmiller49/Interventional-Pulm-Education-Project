import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runTaxonomyV2Audit, type RunTaxonomyV2AuditOptions } from './enrichment-taxonomy-v2-audit'
import {
  assertKnownArguments,
  hasFlag,
  parseCliArguments,
  stringArgument,
  type ParsedCliArguments,
} from './lib/cli'

const HELP = `
Build a deterministic, development-only taxonomy V2 audit and physician-adjudication plan.

This command only reads checksum-bound files and exclusively creates two JSON outputs beneath
this checkout's ignored local-data tree. It does not connect to a database or network service,
does not access held-out/test identities, and cannot apply or commit taxonomy or row changes.

Usage:
  npx tsx scripts/literature/audit-enrichment-taxonomy-v2.ts \\
    --canonical-source <canonical-pr70.csv> \\
    --canonical-receipt <canonical-pr70.receipt.json> \\
    --prior-enrichment <prior-v1-enrichment.csv> \\
    --qa-findings <external-qa-status.csv> \\
    --qa-review-1 <qa-review-1.xlsx> \\
    --qa-review-2 <qa-review-2.xlsx> \\
    --qa-vocabulary config/literature/enrichment-taxonomy-adoption.v2.json \\
    --output local-data/literature/taxonomy-v2/audit.json \\
    --upgrade-plan-output local-data/literature/taxonomy-v2/upgrade-plan.json

No split, test, all, held-out, commit, apply, import, database, or network option is accepted.
Paths with held-out/test/all semantics are rejected before any input file is opened.
`.trim()

const FORBIDDEN_SPLIT_OPTIONS = new Set([
  'split',
  'dataset-split',
  'test',
  'testing',
  'all',
  'held-out',
  'heldout',
  'holdout',
  'include-test',
  'include-held-out',
])

const FORBIDDEN_MUTATION_OPTIONS = new Set([
  'apply',
  'commit',
  'database',
  'db',
  'import',
  'mutate',
  'network',
  'push',
  'update',
  'write',
])

function rejectForbiddenOptions(arguments_: ParsedCliArguments) {
  const supplied = [...arguments_.flags, ...arguments_.values.keys()]
  const split = supplied.filter((key) => FORBIDDEN_SPLIT_OPTIONS.has(key.toLowerCase()))
  if (split.length > 0) {
    throw new Error(
      `Held-out/test/all split options are forbidden: ${split.map((key) => `--${key}`).join(', ')}.`,
    )
  }
  const mutation = supplied.filter((key) => FORBIDDEN_MUTATION_OPTIONS.has(key.toLowerCase()))
  if (mutation.length > 0) {
    throw new Error(
      `Mutation, import, database, network, and commit options are forbidden: ${mutation
        .map((key) => `--${key}`)
        .join(', ')}.`,
    )
  }
}

function requiredArgument(arguments_: ParsedCliArguments, key: string) {
  const value = stringArgument(arguments_, key)
  if (!value) throw new Error(`--${key} is required.`)
  return value
}

export function parseTaxonomyV2AuditCliOptions(argv: string[]): RunTaxonomyV2AuditOptions | null {
  const arguments_ = parseCliArguments(argv)
  rejectForbiddenOptions(arguments_)
  assertKnownArguments(arguments_, [
    'canonical-source',
    'canonical-receipt',
    'prior-enrichment',
    'qa-findings',
    'qa-review-1',
    'qa-review-2',
    'qa-vocabulary',
    'output',
    'upgrade-plan-output',
    'help',
  ])
  if (hasFlag(arguments_, 'help')) return null
  return {
    canonicalSourcePath: requiredArgument(arguments_, 'canonical-source'),
    canonicalReceiptPath: requiredArgument(arguments_, 'canonical-receipt'),
    priorEnrichmentPath: requiredArgument(arguments_, 'prior-enrichment'),
    qaFindingsPath: requiredArgument(arguments_, 'qa-findings'),
    qaReview1Path: requiredArgument(arguments_, 'qa-review-1'),
    qaReview2Path: requiredArgument(arguments_, 'qa-review-2'),
    qaVocabularyPath: requiredArgument(arguments_, 'qa-vocabulary'),
    outputPath: requiredArgument(arguments_, 'output'),
    upgradePlanOutputPath: requiredArgument(arguments_, 'upgrade-plan-output'),
  }
}

async function main() {
  const options = parseTaxonomyV2AuditCliOptions(process.argv.slice(2))
  if (!options) {
    console.log(HELP)
    return
  }
  const result = await runTaxonomyV2Audit(options)
  console.log(`Canonical development rows: ${result.report.canonicalDevelopment.rows}`)
  console.log(`Vocabulary proposals: ${result.report.migrationCompleteness.proposals}`)
  console.log(`Upgrade-plan rows: ${result.upgradePlan.rows.length}`)
  console.log(`Audit JSON: ${result.outputPath}`)
  console.log(`Upgrade-plan JSON: ${result.upgradePlanOutputPath}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
