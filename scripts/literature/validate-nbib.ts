import { resolve } from 'node:path'

import {
  assertKnownArguments,
  hasFlag,
  numberArgument,
  parseCliArguments,
  stringArgument,
} from './lib/cli'
import { resolveInputEntries } from './lib/input'
import { formatValidationSummary, writeValidationReport } from './lib/report'
import { validateLiteratureFiles } from './lib/validation'

const HELP = `
Validate NBIB files without writing to Supabase.

Usage:
  npm run literature:validate -- --manifest <path> [--limit <n>]
  npm run literature:validate -- --file <path> [--limit <n>]
  npm run literature:validate -- --directory <path> [--limit <n>]

Options:
  --manifest    Explicit provenance manifest. Default: local-data/literature/import-manifest.json
  --file        Validate one NBIB file as unmapped.
  --directory   Validate every NBIB file recursively as unmapped.
  --limit       Stop after this many record occurrences across all files.
  --report-dir  Default: local-data/literature/reports
  --help        Show this help.
`.trim()

async function main() {
  const arguments_ = parseCliArguments(process.argv.slice(2))
  assertKnownArguments(arguments_, ['manifest', 'file', 'directory', 'limit', 'report-dir', 'help'])
  if (hasFlag(arguments_, 'help')) {
    console.log(HELP)
    return
  }

  const entries = await resolveInputEntries(arguments_)
  const report = await validateLiteratureFiles({
    entries,
    limit: numberArgument(arguments_, 'limit'),
  })
  const reportPath = await writeValidationReport(
    report,
    stringArgument(arguments_, 'report-dir', 'local-data/literature/reports'),
  )

  console.log(formatValidationSummary(report))
  console.log(`Report: ${resolve(reportPath)}`)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
