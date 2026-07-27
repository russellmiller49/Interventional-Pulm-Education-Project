import { basename, extname, relative, sep } from 'node:path'

import { literatureQueryRegistry } from '@/features/literature/config'
import type { LiteratureManifestFile } from '@/features/literature/schemas/config'

import { portablePath } from './files'

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function exactIdentifierMatches(filename: string, identifiers: string[]) {
  const stem = basename(filename, extname(filename)).toLocaleLowerCase('en-US')
  return identifiers.filter((identifier) => {
    const normalized = identifier.toLocaleLowerCase('en-US')
    return new RegExp(`(?:^|[^a-z0-9])${escapeRegex(normalized)}(?:$|[^a-z0-9])`, 'u').test(stem)
  })
}

function corpusFolder(filePath: string, corpusRoot: string | undefined) {
  if (!corpusRoot) return null
  const relativePath = relative(corpusRoot, filePath)
  if (relativePath.startsWith(`..${sep}`) || relativePath === '..') return null
  return relativePath.split(sep)[0]?.toLocaleLowerCase('en-US') ?? null
}

export function inferLiteratureManifestEntry(
  filePath: string,
  corpusRoot?: string,
): LiteratureManifestFile {
  const journals = [
    ...literatureQueryRegistry.core_journals.map((journal) => ({
      ...journal,
      sourceKind: 'core_journal' as const,
    })),
    ...literatureQueryRegistry.optional_continuity_journals.map((journal) => ({
      ...journal,
      sourceKind: 'core_journal' as const,
    })),
    ...literatureQueryRegistry.expanded_journals.map((journal) => ({
      ...journal,
      sourceKind: 'expanded_journal' as const,
    })),
  ]
  const journalMatches = exactIdentifierMatches(
    filePath,
    journals.map((journal) => journal.id),
  )
  const queryMatches = exactIdentifierMatches(filePath, [
    ...Object.keys(literatureQueryRegistry.queries),
    ...literatureQueryRegistry.discovery_queries.map((query) => query.id),
  ])
  const folder = corpusFolder(filePath, corpusRoot)

  if (folder === 'full journals') {
    const journal = journals.find(
      (candidate) => candidate.id === journalMatches[0] && candidate.sourceKind === 'core_journal',
    )
    return {
      path: portablePath(filePath),
      source_kind: 'core_journal',
      source_id: journal?.id ?? 'core-journal-corpus',
      query_id: null,
      date_from: null,
      date_to: null,
      status: 'mapped',
      notes: journal
        ? 'Core-journal provenance comes from the supplied Full Journals folder; the journal ID is an exact filename match.'
        : 'Core-journal provenance comes from the supplied Full Journals folder.',
    }
  }

  if (folder === 'expanded-journal') {
    const journal = journals.find(
      (candidate) =>
        candidate.id === journalMatches[0] && candidate.sourceKind === 'expanded_journal',
    )
    return {
      path: portablePath(filePath),
      source_kind: 'expanded_journal',
      source_id: journal?.id ?? 'expanded-journal-corpus',
      query_id: null,
      date_from: null,
      date_to: null,
      status: 'mapped',
      notes: journal
        ? 'Expanded-journal provenance comes from the supplied Expanded-journal folder; the journal ID is an exact filename match.'
        : 'Expanded-journal provenance comes from the supplied Expanded-journal folder.',
    }
  }

  if (folder === 'all-pubmed discovery') {
    return {
      path: portablePath(filePath),
      source_kind: 'all_pubmed_discovery',
      source_id: 'all-pubmed-discovery-corpus',
      query_id: queryMatches.length === 1 ? queryMatches[0] : null,
      date_from: null,
      date_to: null,
      status: 'mapped',
      notes:
        queryMatches.length === 1
          ? 'Discovery provenance comes from the supplied All-PubMed discovery folder; the query ID is an exact filename match.'
          : 'Discovery provenance comes from the supplied All-PubMed discovery folder; no query ID was inferred.',
    }
  }

  if (journalMatches.length === 1 && queryMatches.length === 0) {
    const journal = journals.find((candidate) => candidate.id === journalMatches[0])
    if (journal) {
      return {
        path: portablePath(filePath),
        source_kind: journal.sourceKind,
        source_id: journal.id,
        query_id: null,
        date_from: null,
        date_to: null,
        status: 'mapped',
        notes: 'Mapped from an exact, unambiguous journal source ID in the filename.',
      }
    }
  }

  if (queryMatches.length === 1 && journalMatches.length === 0) {
    return {
      path: portablePath(filePath),
      source_kind: 'all_pubmed_discovery',
      source_id: 'all_pubmed',
      query_id: queryMatches[0],
      date_from: null,
      date_to: null,
      status: 'mapped',
      notes: 'Mapped from an exact, unambiguous query ID in the filename.',
    }
  }

  return {
    path: portablePath(filePath),
    source_kind: 'unmapped',
    source_id: null,
    query_id: null,
    date_from: null,
    date_to: null,
    status: 'needs_mapping',
    notes:
      journalMatches.length + queryMatches.length > 1
        ? `Ambiguous exact IDs: ${[...journalMatches, ...queryMatches].join(', ')}`
        : 'Filename contains no exact known source/query ID. Do not infer from article content.',
  }
}
