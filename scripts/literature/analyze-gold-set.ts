import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'

import {
  analyzeLiteratureGoldPilot,
  serializeLiteratureGoldPilotAnalysisMarkdown,
} from '@/features/literature/gold-set/analysis'
import { parseLiteratureGoldReviewImportCsv } from '@/features/literature/gold-set/import'

import {
  assertKnownArguments,
  hasFlag,
  numberArgument,
  parseCliArguments,
  stringArgument,
} from './lib/cli'

const HELP = `
Validate and analyze a completed literature gold-set CSV without a database connection.

Usage:
  npm run literature:analyze-gold-set -- --input pilot-v1-all.csv --batch pilot-v1 --expected-count 100

Options:
  --input <path>          Required CSV gold-set export.
  --batch <id-or-name>    Optional expected batch UUID or name.
  --expected-count <n>    Optional exact row count.
  --output <path>         JSON output path. Markdown is written beside it.
  --help                  Show this help.
`.trim()

async function exists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  const arguments_ = parseCliArguments(process.argv.slice(2))
  assertKnownArguments(arguments_, ['input', 'batch', 'expected-count', 'output', 'help'])
  if (hasFlag(arguments_, 'help')) {
    console.log(HELP)
    return
  }

  const inputPath = stringArgument(arguments_, 'input')
  if (!inputPath) throw new Error('--input is required.')
  if (extname(inputPath).toLocaleLowerCase('en-US') !== '.csv') {
    throw new Error('--input must be a .csv gold-set export.')
  }

  const input = await readFile(resolve(inputPath), 'utf8')
  const parsed = parseLiteratureGoldReviewImportCsv(input, {
    completedOnly: true,
    expectedBatchReference: stringArgument(arguments_, 'batch'),
    expectedRowCount: numberArgument(arguments_, 'expected-count'),
  })
  const sourceSha256 = createHash('sha256').update(input).digest('hex')
  const report = analyzeLiteratureGoldPilot(parsed.rows, { sourceSha256 })
  const output = resolve(
    stringArgument(
      arguments_,
      'output',
      `local-data/literature/gold-sets/${parsed.batchName}-readiness.json`,
    ),
  )
  if (extname(output).toLocaleLowerCase('en-US') !== '.json') {
    throw new Error('--output must use the .json extension.')
  }
  const markdownOutput = `${output.slice(0, -extname(output).length)}.md`
  if ((await exists(output)) || (await exists(markdownOutput))) {
    throw new Error(`Refusing to overwrite an existing readiness report: ${output}`)
  }

  await mkdir(dirname(output), { recursive: true })
  await Promise.all([
    writeFile(output, `${JSON.stringify(report, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    }),
    writeFile(markdownOutput, serializeLiteratureGoldPilotAnalysisMarkdown(report), {
      encoding: 'utf8',
      flag: 'wx',
    }),
  ])

  console.log(`Validated completed decisions: ${parsed.summary.completed}`)
  console.log(`Readiness: ${report.readiness.status}`)
  console.log(`Calibrated bands: ${JSON.stringify(report.counts.calibratedRuleBand)}`)
  console.log(`JSON report: ${output}`)
  console.log(`Markdown report: ${markdownOutput}`)
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
