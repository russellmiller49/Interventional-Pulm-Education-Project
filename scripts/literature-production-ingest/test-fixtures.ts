import { canonicalJson } from './canonical'
import type {
  IngestMode,
  PreparedRecord,
  SourceArticleRow,
  SourceEnvelope,
  SourceJournalRow,
} from './types'

export function fixtureJournal(overrides: Partial<SourceJournalRow> = {}): SourceJournalRow {
  return {
    id: 'journal-a',
    canonical_name: 'Synthetic Bronchoscopy Journal',
    pubmed_abbreviation: 'Synth Bronchosc J',
    nlm_id: '0000001',
    issn_print: '0000-0001',
    issn_electronic: null,
    aliases: [],
    source_tier: 'other',
    active_from: 1980,
    active_to: null,
    notes: null,
    registry_version: 'synthetic-v1',
    ...overrides,
  }
}

export function fixtureArticle(
  pmid: string,
  overrides: Partial<SourceArticleRow> = {},
): SourceArticleRow {
  const hashCharacter = Number(pmid.at(-1) ?? '0') % 2 === 0 ? 'a' : 'b'
  return {
    pmid,
    doi: `10.1000/${pmid}`,
    pmcid: null,
    title: `Synthetic article ${pmid}`,
    abstract: `Synthetic abstract for ${pmid}.`,
    abstract_display_policy: 'snippet_only',
    journal_id: 'journal-a',
    journal_title: 'Synthetic Bronchoscopy Journal',
    journal_abbreviation: 'Synth Bronchosc J',
    nlm_journal_id: '0000001',
    issn_values: ['0000-0001'],
    publication_date_raw: '2024 Jan 15',
    publication_year: 2024,
    publication_month: 1,
    publication_day: 15,
    publication_date_precision: 'day',
    publication_types: ['Journal Article'],
    mesh_terms: ['Bronchoscopy'],
    author_keywords: ['synthetic'],
    languages: ['eng'],
    authors: [{ fullName: 'Example, Ada', abbreviatedName: 'Example A' }],
    collective_authors: [],
    affiliations: ['Synthetic Institution'],
    volume: '1',
    issue: '2',
    pages: '1-5',
    article_number: null,
    place_of_publication: 'United States',
    citation_source: 'Synthetic citation',
    conflict_of_interest: null,
    pubmed_status: 'MEDLINE',
    pubmed_last_revised_at: '2024-02-01T00:00:00.000Z',
    pubmed_created_at: '2024-01-01T00:00:00.000Z',
    raw_nbib_tags: { PMID: [pmid], TI: [`Synthetic article ${pmid}`] },
    metadata_hash: hashCharacter.repeat(64),
    normalized_title: `synthetic article ${pmid}`,
    normalized_title_hash: 'c'.repeat(64),
    is_retracted: false,
    is_correction: false,
    is_conference_abstract: false,
    ...overrides,
  }
}

export function fixtureEnvelope(
  pmid: string,
  articleOverrides: Partial<SourceArticleRow> = {},
  journal: SourceJournalRow | null = fixtureJournal(),
): SourceEnvelope {
  return { article: fixtureArticle(pmid, articleOverrides), journal }
}

export async function* fixtureSource(rows: readonly SourceEnvelope[]) {
  for (const row of rows) yield row
}

export function fixtureMapper(batchId: string, mode: IngestMode) {
  return (envelope: SourceEnvelope): PreparedRecord => {
    const article = {
      ...envelope.article,
      relevance_state: 'unreviewed' as const,
      visibility_state: 'draft' as const,
      manual_override: false as const,
      is_landmark: false as const,
      curation_reason: null,
      classifier_version: null,
      classifier_payload: null,
    }
    const provenance = {
      pmid: article.pmid,
      batch_id: batchId,
      source_kind: 'unmapped' as const,
      source_id: 'fixed-local-bibliographic-corpus' as const,
      query_id: mode === 'canary' ? ('production-canary' as const) : ('production-full' as const),
      source_filename:
        mode === 'canary' ? 'authorized-canary-manifest.json' : 'fixed-local-literature-articles',
    }
    return {
      article,
      journal: envelope.journal,
      provenance,
      canonicalChecksumInput: canonicalJson({ article, journal: envelope.journal }),
    }
  }
}
