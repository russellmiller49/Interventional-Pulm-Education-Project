import { assertKnownArguments, hasFlag, parseCliArguments, stringArgument } from './lib/cli'
import { formatValidationSummary, readLatestValidationReport } from './lib/report'

const HELP = `
Print the latest machine-readable literature validation/import report.

Usage:
  npm run literature:report -- [--report-dir <path>]
`.trim()

async function main() {
  const arguments_ = parseCliArguments(process.argv.slice(2))
  assertKnownArguments(arguments_, ['report-dir', 'help'])
  if (hasFlag(arguments_, 'help')) {
    console.log(HELP)
    return
  }

  const latest = await readLatestValidationReport(
    stringArgument(arguments_, 'report-dir', 'local-data/literature/reports'),
  )
  console.log(`Report: ${latest.filePath}`)
  console.log(formatValidationSummary(latest.report))
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
