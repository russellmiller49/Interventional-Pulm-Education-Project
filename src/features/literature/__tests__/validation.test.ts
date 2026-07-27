import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { LiteratureManifestFile } from '@/features/literature/schemas/config'
import {
  readLatestValidationReport,
  writeValidationReport,
} from '../../../../scripts/literature/lib/report'
import { validateLiteratureFiles } from '../../../../scripts/literature/lib/validation'

const fixtureRoot = join(process.cwd(), 'tests/fixtures/literature')

function entry(name: string): LiteratureManifestFile {
  return {
    path: join(fixtureRoot, name),
    source_kind: 'unmapped',
    source_id: null,
    query_id: null,
    date_from: null,
    date_to: null,
    status: 'needs_mapping',
    notes: null,
  }
}

describe('literature validation reports', () => {
  it('tracks duplicate PMID occurrences across files without merging provenance', async () => {
    const report = await validateLiteratureFiles({
      entries: [entry('duplicate-a.nbib'), entry('duplicate-b.nbib')],
    })

    expect(report).toMatchObject({
      filesScanned: 2,
      recordsParsed: 2,
      uniquePmids: 1,
      duplicateRecordOccurrences: 1,
      recordsWithoutPmids: 0,
    })
    expect(report.files).toHaveLength(2)
    expect(new Set(report.files.map((file) => file.sha256)).size).toBe(2)
  })

  it('honors a cross-file record limit', async () => {
    const report = await validateLiteratureFiles({
      entries: [entry('complex.nbib'), entry('duplicate-a.nbib')],
      limit: 1,
    })

    expect(report.recordsParsed).toBe(1)
    expect(report.filesScanned).toBe(1)
  })

  it('aggregates unmatched journals without crowding parser errors', async () => {
    const report = await validateLiteratureFiles({
      entries: [entry('complex.nbib')],
    })

    expect(report.unmatchedJournals).toEqual({
      'Unknown Journal of Fixtures': 1,
    })
    expect(report.parseErrors.some((issue) => issue.code === 'UNMATCHED_JOURNAL')).toBe(false)
    expect(report.parseErrors.map((issue) => issue.code)).toContain('CONFLICTING_DOI')
  })

  it('keeps millisecond precision so rapid reports do not collide', async () => {
    const report = await validateLiteratureFiles({
      entries: [entry('simple.nbib')],
    })
    const reportDirectory = await mkdtemp(join(tmpdir(), 'literature-report-test-'))

    try {
      const firstPath = await writeValidationReport(
        {
          ...report,
          generatedAt: '2026-07-27T04:06:11.100Z',
        },
        reportDirectory,
        'import',
      )
      const secondPath = await writeValidationReport(
        {
          ...report,
          generatedAt: '2026-07-27T04:06:11.200Z',
        },
        reportDirectory,
        'import',
      )

      expect(firstPath).not.toBe(secondPath)
      await expect(readFile(firstPath, 'utf8')).resolves.toContain('"reportVersion": "1.0.0"')
      await expect(readFile(secondPath, 'utf8')).resolves.toContain('"reportVersion": "1.0.0"')

      await writeValidationReport(
        {
          ...report,
          generatedAt: '2026-07-27T04:06:10.900Z',
        },
        reportDirectory,
        'validation',
      )
      const latest = await readLatestValidationReport(reportDirectory)
      expect(latest.filePath).toBe(secondPath)
    } finally {
      await rm(reportDirectory, { recursive: true, force: true })
    }
  })
})
