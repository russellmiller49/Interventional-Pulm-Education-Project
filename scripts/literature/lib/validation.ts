import { basename } from 'node:path'

import { literatureQueryRegistry } from '@/features/literature/config'
import { normalizeNbibRecord } from '@/features/literature/domain/normalize'
import { parseNbibFile } from '@/features/literature/domain/nbib-parser'
import type { LiteratureManifestFile } from '@/features/literature/schemas/config'
import type { LiteratureValidationReport, NbibIssue } from '@/features/literature/types'

import { resolveManifestPath, sha256File } from './files'

const MAX_REPORTED_ERRORS = 10_000

export interface ValidateLiteratureFilesOptions {
  entries: LiteratureManifestFile[]
  limit?: number
}

function manifestMappingKey(entry: LiteratureManifestFile) {
  return [
    entry.source_kind,
    entry.source_id ?? 'no-source',
    entry.query_id ?? 'no-query',
    entry.status,
  ].join(':')
}

export async function validateLiteratureFiles({
  entries,
  limit,
}: ValidateLiteratureFilesOptions): Promise<LiteratureValidationReport> {
  const startedAt = Date.now()
  const generatedAt = new Date().toISOString()
  const seenPmids = new Set<string>()
  const unmatchedJournals: Record<string, number> = {}
  const sourceQueryMappings: Record<string, number> = {}
  const parseErrors: LiteratureValidationReport['parseErrors'] = []
  const files: LiteratureValidationReport['files'] = []
  let recordsParsed = 0
  let duplicateRecordOccurrences = 0
  let recordsWithoutPmids = 0
  let recordsWithoutTitles = 0
  let recordsWithoutAbstracts = 0
  let conflictingDoiCandidates = 0

  function recordIssues(sourceFilename: string, issues: NbibIssue[], pmid: string | null) {
    for (const issue of issues) {
      // Unmatched journals already have a complete aggregate below. Keeping
      // one row per occurrence here would crowd actionable parser failures
      // out of the bounded detailed-error sample.
      if (issue.code === 'UNMATCHED_JOURNAL') {
        continue
      }
      if (parseErrors.length >= MAX_REPORTED_ERRORS) {
        return
      }
      parseErrors.push({
        sourceFilename,
        recordNumber: issue.recordNumber,
        pmid,
        code: issue.code,
        message: issue.message,
      })
    }
  }

  outer: for (const entry of entries) {
    const filePath = resolveManifestPath(entry.path)
    const sourceFilename = basename(filePath)
    const checksum = await sha256File(filePath)
    let fileRecordCount = 0
    const mappingKey = manifestMappingKey(entry)

    for await (const parsed of parseNbibFile(filePath)) {
      if (limit && recordsParsed >= limit) {
        files.push({
          path: entry.path,
          sourceKind: entry.source_kind,
          sourceId: entry.source_id,
          queryId: entry.query_id,
          status: entry.status,
          recordsParsed: fileRecordCount,
          sha256: checksum,
        })
        break outer
      }

      recordsParsed += 1
      fileRecordCount += 1
      sourceQueryMappings[mappingKey] = (sourceQueryMappings[mappingKey] ?? 0) + 1

      const rawPmid = parsed.record.tags.PMID?.[0]?.trim() ?? null
      if (!rawPmid) {
        recordsWithoutPmids += 1
      }

      const normalized = normalizeNbibRecord(parsed.record, literatureQueryRegistry, parsed.issues)
      recordIssues(sourceFilename, normalized.issues, rawPmid)

      if (normalized.issues.some((issue) => issue.code === 'MISSING_TITLE')) {
        recordsWithoutTitles += 1
      }
      if (normalized.issues.some((issue) => issue.code === 'CONFLICTING_DOI')) {
        conflictingDoiCandidates += 1
      }

      const article = normalized.article
      if (!article) {
        continue
      }

      if (seenPmids.has(article.pmid)) {
        duplicateRecordOccurrences += 1
      } else {
        seenPmids.add(article.pmid)
      }

      if (!article.abstract) {
        recordsWithoutAbstracts += 1
      }

      if (normalized.issues.some((issue) => issue.code === 'UNMATCHED_JOURNAL')) {
        const journalLabel =
          article.journalTitle ?? article.journalAbbreviation ?? 'Unknown journal'
        unmatchedJournals[journalLabel] = (unmatchedJournals[journalLabel] ?? 0) + 1
      }
    }

    files.push({
      path: entry.path,
      sourceKind: entry.source_kind,
      sourceId: entry.source_id,
      queryId: entry.query_id,
      status: entry.status,
      recordsParsed: fileRecordCount,
      sha256: checksum,
    })
  }

  return {
    reportVersion: '1.0.0',
    generatedAt,
    elapsedMs: Date.now() - startedAt,
    filesScanned: files.length,
    recordsParsed,
    uniquePmids: seenPmids.size,
    duplicateRecordOccurrences,
    recordsWithoutPmids,
    recordsWithoutTitles,
    recordsWithoutAbstracts,
    insertCandidates: seenPmids.size,
    updateCandidates: 0,
    unchangedRecords: 0,
    unmatchedJournals,
    conflictingDoiCandidates,
    sourceQueryMappings,
    parseErrors,
    files,
  }
}
