import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

import type { LiteratureValidationReport } from '@/features/literature/types'

function reportTimestamp(date = new Date()) {
  return date.toISOString().replaceAll(':', '-')
}

function timestampFromReportName(name: string) {
  return name.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z)\.json$/u)?.[1] ?? ''
}

export async function writeValidationReport(
  report: LiteratureValidationReport,
  reportDirectory: string,
  prefix = 'validation',
) {
  const absoluteDirectory = resolve(reportDirectory)
  await mkdir(absoluteDirectory, { recursive: true })
  const filePath = resolve(
    absoluteDirectory,
    `${prefix}-${reportTimestamp(new Date(report.generatedAt))}.json`,
  )
  await writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  })
  return filePath
}

export function formatValidationSummary(report: LiteratureValidationReport) {
  return [
    `Files scanned: ${report.filesScanned}`,
    `Records parsed: ${report.recordsParsed}`,
    `Unique PMIDs: ${report.uniquePmids}`,
    `Duplicate occurrences: ${report.duplicateRecordOccurrences}`,
    `Without PMID: ${report.recordsWithoutPmids}`,
    `Without title: ${report.recordsWithoutTitles}`,
    `Without abstract: ${report.recordsWithoutAbstracts}`,
    `Unmatched journals: ${Object.values(report.unmatchedJournals).reduce((sum, count) => sum + count, 0)}`,
    `Conflicting DOI records: ${report.conflictingDoiCandidates}`,
    `Parse/normalization issues: ${report.parseErrors.length}`,
    `Elapsed: ${(report.elapsedMs / 1_000).toFixed(2)}s`,
  ].join('\n')
}

export async function readLatestValidationReport(reportDirectory: string) {
  const absoluteDirectory = resolve(reportDirectory)
  const candidates = (await readdir(absoluteDirectory))
    .filter((name) => name.endsWith('.json'))
    .sort((left, right) => {
      const timestampOrder = timestampFromReportName(right).localeCompare(
        timestampFromReportName(left),
      )
      return timestampOrder || right.localeCompare(left)
    })

  const latest = candidates[0]
  if (!latest) {
    throw new Error(`No JSON reports found in ${absoluteDirectory}.`)
  }

  const filePath = resolve(absoluteDirectory, latest)
  const report = JSON.parse(await readFile(filePath, 'utf8')) as LiteratureValidationReport
  return { filePath, label: basename(filePath), report }
}
