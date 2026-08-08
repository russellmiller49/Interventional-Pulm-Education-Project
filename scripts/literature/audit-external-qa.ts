import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runExternalQaAudit, type RunExternalQaAuditOptions } from './data-quality/external-qa'
import {
  assertKnownArguments,
  hasFlag,
  parseCliArguments,
  stringArgument,
  type ParsedCliArguments,
} from './lib/cli'

const HELP = `
Validate exported external-QA findings against a development-only V2 literature CSV.

This command is read-only except for exclusive creation of one JSON report under local-data.
It never connects to a database or network service and never applies suggested QA changes.

Usage:
  npx tsx scripts/literature/audit-external-qa.ts \\
    --findings gold-set-v1_external_QA_findings_v2_status.csv \\
    --source gold-set-v1_enrichment_results-full-text-reconciled-v2_quality-cleaned_630.csv

Options:
  --findings <path>  Required exported external-QA findings CSV.
  --source <path>    Required development-only V2 source CSV.
  --output <path>    Optional .json path under this checkout's ignored local-data tree.
  --help             Show this help.

No split option is accepted. Paths with held-out, test, or all-split semantics are rejected
before either input is opened.
`.trim()

const FORBIDDEN_SPLIT_OPTIONS = new Set([
  'split',
  'dataset-split',
  'test',
  'all',
  'held-out',
  'heldout',
  'include-test',
  'include-held-out',
])

function rejectForbiddenSplitOptions(arguments_: ParsedCliArguments) {
  const supplied = [...arguments_.flags, ...arguments_.values.keys()]
  const forbidden = supplied.filter((key) => FORBIDDEN_SPLIT_OPTIONS.has(key.toLowerCase()))
  if (forbidden.length > 0) {
    throw new Error(
      `Held-out/test/all split options are forbidden for this command: ${forbidden
        .map((key) => `--${key}`)
        .join(', ')}.`,
    )
  }
}

export function parseExternalQaAuditCliOptions(argv: string[]): RunExternalQaAuditOptions | null {
  const arguments_ = parseCliArguments(argv)
  rejectForbiddenSplitOptions(arguments_)
  assertKnownArguments(arguments_, ['findings', 'source', 'output', 'help'])
  if (hasFlag(arguments_, 'help')) return null

  const findingsPath = stringArgument(arguments_, 'findings')
  if (!findingsPath) throw new Error('--findings is required.')
  const sourcePath = stringArgument(arguments_, 'source')
  if (!sourcePath) throw new Error('--source is required.')
  return {
    findingsPath,
    sourcePath,
    outputPath: stringArgument(arguments_, 'output'),
  }
}

async function main() {
  const options = parseExternalQaAuditCliOptions(process.argv.slice(2))
  if (!options) {
    console.log(HELP)
    return
  }

  const result = await runExternalQaAudit(options)
  console.log(`V2 rows: ${result.report.sources.v2Source.rows}`)
  console.log(`External QA findings: ${result.report.summaries.totalFindings}`)
  for (const [tier, summary] of Object.entries(result.report.summaries.byTier)) {
    console.log(`${tier}: ${summary.findings} findings / ${summary.uniquePmids} unique PMIDs`)
  }
  console.log(`Source SHA-256: ${result.report.sources.v2Source.sha256}`)
  console.log(`Findings SHA-256: ${result.report.sources.findings.sha256}`)
  console.log(
    `Physician-field SHA-256: ${result.report.physicianFieldIntegrity.sha256Before} (unchanged)`,
  )
  console.log(
    `Accepted 180-character title prefixes: ${result.report.validation.titleMatches.acceptedTruncatedPrefix}`,
  )
  console.log(`Source mismatches: ${result.report.validation.mismatchCount}`)
  console.log(`JSON report: ${result.outputPath}`)
  if (!result.report.validation.ok) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
