import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  analyzeLiteratureGoldPilot,
  serializeLiteratureGoldPilotAnalysisMarkdown,
  type LiteratureGoldPilotAnalysis,
} from '@/features/literature/gold-set/analysis'
import { parseLiteratureGoldReviewImportCsv } from '@/features/literature/gold-set/import'

import {
  assertKnownArguments,
  hasFlag,
  numberArgument,
  parseCliArguments,
  stringArgument,
} from './lib/cli'

const READINESS_ARTIFACT_VERSION = 'v2'

const HELP = `
Validate and analyze a completed literature pilot without a database connection.

First-pass blinding is read from revision 1 of the immutable full-history JSON. Current labels,
confidence, and categorization are read from the current-state CSV and cross-checked against the
latest history revision. Corrected reports are always written as new v2 artifacts.

Usage:
  npm run literature:analyze-gold-set -- \\
    --input pilot-v1-all.csv \\
    --history pilot-v1-all-history.json \\
    --batch pilot-v1 \\
    --expected-count 100

Options:
  --input <path>          Required current-state CSV gold-set export.
  --history <path>        Required full-history JSON export from the same batch.
  --batch <id-or-name>    Optional expected batch UUID or name.
  --expected-count <n>    Optional exact row count.
  --output <path>         JSON path ending in -v2.json. Markdown is written beside it.
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

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function parseJson(input: string, field: string) {
  try {
    return JSON.parse(input) as unknown
  } catch {
    throw new Error(`${field} contains malformed JSON.`)
  }
}

export interface RunLiteratureGoldPilotAnalysisOptions {
  inputPath: string
  historyPath: string
  expectedBatchReference?: string
  expectedRowCount?: number
  outputPath?: string
  generatedAt?: string
}

export interface RunLiteratureGoldPilotAnalysisResult {
  report: LiteratureGoldPilotAnalysis
  completedCount: number
  artifacts: {
    json: string
    markdown: string
  }
}

export function resolveLiteratureGoldPilotReadinessOutput(
  batchName: string,
  requestedOutput?: string,
) {
  const output = resolve(
    requestedOutput ??
      `local-data/literature/gold-sets/${batchName}-readiness-${READINESS_ARTIFACT_VERSION}.json`,
  )
  if (extname(output).toLocaleLowerCase('en-US') !== '.json') {
    throw new Error('--output must use the .json extension.')
  }
  if (!basename(output).endsWith(`-${READINESS_ARTIFACT_VERSION}.json`)) {
    throw new Error(
      `--output must use a versioned filename ending in -${READINESS_ARTIFACT_VERSION}.json.`,
    )
  }
  return {
    json: output,
    markdown: `${output.slice(0, -extname(output).length)}.md`,
  }
}

export async function runLiteratureGoldPilotAnalysis(
  options: RunLiteratureGoldPilotAnalysisOptions,
): Promise<RunLiteratureGoldPilotAnalysisResult> {
  const inputPath = resolve(options.inputPath)
  if (extname(inputPath).toLocaleLowerCase('en-US') !== '.csv') {
    throw new Error('--input must be a .csv gold-set export.')
  }
  const historyPath = resolve(options.historyPath)
  if (extname(historyPath).toLocaleLowerCase('en-US') !== '.json') {
    throw new Error('--history must be a .json full-history export.')
  }

  const [input, historyInput] = await Promise.all([
    readFile(inputPath, 'utf8'),
    readFile(historyPath, 'utf8'),
  ])
  const parsed = parseLiteratureGoldReviewImportCsv(input, {
    completedOnly: true,
    expectedBatchReference: options.expectedBatchReference,
    expectedRowCount: options.expectedRowCount,
  })
  const report = analyzeLiteratureGoldPilot(
    parsed.rows,
    parseJson(historyInput, 'Full-history export'),
    {
      generatedAt: options.generatedAt,
      currentStateCsvSha256: sha256(input),
      fullHistoryJsonSha256: sha256(historyInput),
    },
  )
  const artifacts = resolveLiteratureGoldPilotReadinessOutput(parsed.batchName, options.outputPath)
  if ((await exists(artifacts.json)) || (await exists(artifacts.markdown))) {
    throw new Error(`Refusing to overwrite an existing readiness report: ${artifacts.json}`)
  }

  await mkdir(dirname(artifacts.json), { recursive: true })
  await Promise.all([
    writeFile(artifacts.json, `${JSON.stringify(report, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    }),
    writeFile(artifacts.markdown, serializeLiteratureGoldPilotAnalysisMarkdown(report), {
      encoding: 'utf8',
      flag: 'wx',
    }),
  ])

  return {
    report,
    completedCount: parsed.summary.completed,
    artifacts,
  }
}

function cliOptions(argv: string[]): RunLiteratureGoldPilotAnalysisOptions | null {
  const arguments_ = parseCliArguments(argv)
  assertKnownArguments(arguments_, [
    'input',
    'history',
    'batch',
    'expected-count',
    'output',
    'help',
  ])
  if (hasFlag(arguments_, 'help')) return null

  const inputPath = stringArgument(arguments_, 'input')
  if (!inputPath) throw new Error('--input is required.')
  const historyPath = stringArgument(arguments_, 'history')
  if (!historyPath) throw new Error('--history is required.')
  return {
    inputPath,
    historyPath,
    expectedBatchReference: stringArgument(arguments_, 'batch'),
    expectedRowCount: numberArgument(arguments_, 'expected-count'),
    outputPath: stringArgument(arguments_, 'output'),
  }
}

async function main() {
  const options = cliOptions(process.argv.slice(2))
  if (!options) {
    console.log(HELP)
    return
  }
  const result = await runLiteratureGoldPilotAnalysis(options)
  console.log(`Validated completed decisions: ${result.completedCount}`)
  console.log(`Readiness: ${result.report.readiness.status}`)
  console.log(`Calibrated bands: ${JSON.stringify(result.report.counts.calibratedRuleBand)}`)
  console.log(`JSON report: ${result.artifacts.json}`)
  console.log(`Markdown report: ${result.artifacts.markdown}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
