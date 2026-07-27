import type { LiteratureQueryRegistry } from '@/features/literature/schemas/config'
import type { LiteratureJournalMatch, RawNbibRecord } from '@/features/literature/types'

import { normalizeSearchableText, normalizeWhitespace, stableUnique } from './text'

interface RegistryJournal {
  id: string
  displayName: string
  pubmedAbbreviation: string
  nlmId: string
  issnValues: string[]
  tier: string
}

function canonicalIssn(value: string) {
  return value.match(/\b\d{4}-[\dX]{4}\b/iu)?.[0]?.toUpperCase() ?? null
}

export function flattenRegistryJournals(registry: LiteratureQueryRegistry): RegistryJournal[] {
  return [
    ...registry.core_journals,
    ...registry.optional_continuity_journals,
    ...registry.expanded_journals,
  ].map((journal) => ({
    id: journal.id,
    displayName: journal.display_name,
    pubmedAbbreviation: journal.pubmed_abbreviation,
    nlmId: journal.nlm_id,
    issnValues: [journal.issn_print, journal.issn_online].filter((value): value is string =>
      Boolean(value),
    ),
    tier: journal.tier,
  }))
}

function uniqueMatch(
  journals: RegistryJournal[],
  matchedBy: LiteratureJournalMatch['matchedBy'],
): LiteratureJournalMatch | null {
  if (journals.length !== 1) {
    return null
  }

  const [journal] = journals
  return {
    id: journal.id,
    canonicalName: journal.displayName,
    sourceTier: journal.tier,
    matchedBy,
  }
}

export function matchJournalRegistry(
  record: RawNbibRecord,
  registry: LiteratureQueryRegistry,
): LiteratureJournalMatch | null {
  const journals = flattenRegistryJournals(registry)
  const nlmIds = new Set(stableUnique(record.tags.JID ?? []).map(normalizeWhitespace))
  const abbreviations = new Set(stableUnique(record.tags.TA ?? []).map(normalizeSearchableText))
  const titles = new Set(stableUnique(record.tags.JT ?? []).map(normalizeSearchableText))
  const issnValues = new Set(
    stableUnique(record.tags.IS ?? [])
      .map(canonicalIssn)
      .filter((value): value is string => Boolean(value)),
  )

  const nlmMatch = uniqueMatch(
    journals.filter((journal) => nlmIds.has(journal.nlmId)),
    'nlm_id',
  )
  if (nlmMatch) {
    return nlmMatch
  }

  const abbreviationMatch = uniqueMatch(
    journals.filter((journal) =>
      abbreviations.has(normalizeSearchableText(journal.pubmedAbbreviation)),
    ),
    'pubmed_abbreviation',
  )
  if (abbreviationMatch) {
    return abbreviationMatch
  }

  const titleMatch = uniqueMatch(
    journals.filter((journal) => titles.has(normalizeSearchableText(journal.displayName))),
    'canonical_name',
  )
  if (titleMatch) {
    return titleMatch
  }

  return uniqueMatch(
    journals.filter((journal) =>
      journal.issnValues.some((issn) => issnValues.has(issn.toUpperCase())),
    ),
    'issn',
  )
}
